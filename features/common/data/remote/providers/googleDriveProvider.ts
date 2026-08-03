/**
 * @file features/common/data/remote/providers/googleDriveProvider.ts
 * @description Google Drive AppData implementation of RemoteBackupProvider.
 * Stores Gzip-compressed JSONL backup files inside the hidden appDataFolder in Google Drive.
 */
import { RemoteBackupProvider, BackupPayload, UploadResult } from '../remoteBackupProvider';
import { Logger } from '@common/logger';

export class GoogleDriveBackupProvider implements RemoteBackupProvider {
    readonly id = 'gdrive';
    readonly name = 'Google Drive (AppData)';

    /**
     * Acquires or checks an OAuth2 access token for Google Drive AppData scope.
     */
    async authenticate(interactive: boolean = false): Promise<boolean> {
        try {
            if (typeof chrome === 'undefined' || !chrome.identity) {
                Logger.warn('GoogleDriveProvider', 'chrome.identity API is unavailable.');
                return false;
            }

            return new Promise<boolean>((resolve) => {
                try {
                    chrome.identity.getAuthToken({ interactive }, (token?: string) => {
                        const lastError = chrome.runtime?.lastError;
                        if (lastError || !token) {
                            const msg = lastError ? (lastError.message || String(lastError)) : 'No token received';
                            Logger.warn('GoogleDriveProvider', `Authentication check failed: ${msg}`);
                            resolve(false);
                        } else {
                            Logger.info('GoogleDriveProvider', 'Successfully authenticated with Google Drive.');
                            resolve(true);
                        }
                    });
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.warn('GoogleDriveProvider', `Authentication check exception: ${errorMessage}`);
                    resolve(false);
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('GoogleDriveProvider', `Authentication error: ${errorMessage}`, { err });
            return false;
        }
    }

    /**
     * Uploads the backup payload to Google Drive AppData folder using multipart upload.
     */
    async uploadBackup(payload: BackupPayload): Promise<UploadResult> {
        try {
            const authenticated = await this.authenticate(false);
            if (!authenticated) {
                return { success: false, error: 'User is not authenticated with Google Drive.' };
            }

            const token = await this.getAuthToken();
            if (!token) {
                return { success: false, error: 'Failed to acquire access token.' };
            }

            const metadata = {
                name: payload.filename,
                parents: ['appDataFolder'],
                description: `AlgoRecall Backup - Checksum: ${payload.checksum}`,
                mimeType: 'application/gzip'
            };

            const boundary = '-------314159265358979323846';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
            const mediaHeader = `${delimiter}Content-Type: application/gzip\r\nContent-Transfer-Encoding: base64\r\n\r\n`;

            // Convert Uint8Array to base64 for multipart transfer
            let binary = '';
            const bytes = payload.data;
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = btoa(binary);

            const multipartBody = metadataPart + mediaHeader + base64Data + closeDelimiter;

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartBody
            });

            if (!response.ok) {
                const errText = await response.text();
                Logger.error('GoogleDriveProvider', `Upload HTTP error ${response.status}: ${errText}`);
                return { success: false, error: `Google Drive HTTP ${response.status}: ${errText}` };
            }

            const responseData = await response.json();
            Logger.info('GoogleDriveProvider', `Successfully uploaded backup to Google Drive AppData with file ID: ${responseData.id}`);

            // Automatically clean up older backups
            await this.rotateBackups(5);

            return { success: true, remoteId: responseData.id };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('GoogleDriveProvider', `Failed to upload backup to Google Drive: ${errorMessage}`, { err });
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Checks if current user token is valid.
     */
    async isConnected(): Promise<boolean> {
        return this.authenticate(false);
    }

    /**
     * Revokes cached access token to disconnect user.
     */
    async disconnect(): Promise<void> {
        try {
            const token = await this.getAuthToken();
            if (token && typeof chrome !== 'undefined' && chrome.identity) {
                await new Promise<void>((resolve) => {
                    chrome.identity.removeCachedAuthToken({ token }, () => {
                        Logger.info('GoogleDriveProvider', 'Google Drive auth token removed from cache.');
                        resolve();
                    });
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('GoogleDriveProvider', `Disconnect error: ${errorMessage}`, { err });
        }
    }

    /**
     * Rotates automated backups in appDataFolder, deleting oldest files exceeding maxBackupsToKeep.
     */
    async rotateBackups(maxBackupsToKeep: number = 5): Promise<void> {
        try {
            const token = await this.getAuthToken();
            if (!token) return;

            const queryUrl = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,createdTime)&orderBy=createdTime%20desc';
            const res = await fetch(queryUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) return;

            const data = await res.json();
            const files: Array<{ id: string; name: string; createdTime: string }> = data.files || [];

            // Filter AlgoRecall backups
            const algoBackups = files.filter(f => f.name.startsWith('algorecall_backup_'));

            if (algoBackups.length > maxBackupsToKeep) {
                const toDelete = algoBackups.slice(maxBackupsToKeep);
                for (const file of toDelete) {
                    try {
                        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        Logger.info('GoogleDriveProvider', `Rotated old backup file: ${file.name} (${file.id})`);
                    } catch (delErr) {
                        // Non-fatal error deleting single old backup file
                    }
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.warn('GoogleDriveProvider', `Error rotating backups: ${errorMessage}`, { err });
        }
    }

    /**
     * Helper to retrieve cached token asynchronously.
     */
    private getAuthToken(): Promise<string | undefined> {
        return new Promise((resolve) => {
            if (typeof chrome === 'undefined' || !chrome.identity) {
                resolve(undefined);
                return;
            }
            chrome.identity.getAuthToken({ interactive: false }, (token) => {
                if (chrome.runtime?.lastError || !token) {
                    resolve(undefined);
                } else {
                    resolve(token);
                }
            });
        });
    }
}
