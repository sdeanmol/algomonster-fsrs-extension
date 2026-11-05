/**
 * @file features/common/data/remote/providers/googleDriveProvider.ts
 * @description Google Drive AppData implementation of RemoteBackupProvider.
 * Stores Gzip-compressed JSONL backup files inside the hidden appDataFolder in Google Drive.
 * Supports cross-browser authentication via chrome.identity.getAuthToken (Chrome)
 * and chrome.identity.launchWebAuthFlow (Firefox, Safari, and other browsers).
 */
import { RemoteBackupProvider, BackupPayload, UploadResult } from '../remoteBackupProvider';
import { Logger } from '@common/logger';

interface StoredOAuthToken {
    accessToken: string;
    expiresAt: number;
}

export class GoogleDriveBackupProvider implements RemoteBackupProvider {
    readonly id = 'gdrive';
    readonly name = 'Google Drive (AppData)';

    /** In-memory fallback token cache for launchWebAuthFlow */
    private memoryCachedToken: StoredOAuthToken | null = null;

    /**
     * Acquires or checks an OAuth2 access token for Google Drive AppData scope.
     * Uses chrome.identity.getAuthToken on Chrome or launchWebAuthFlow on Firefox/Safari.
     */
    async authenticate(interactive: boolean = false): Promise<boolean> {
        try {
            if (typeof chrome === 'undefined' || !chrome.identity) {
                Logger.warn('GoogleDriveProvider', 'chrome.identity API is unavailable.');
                return false;
            }

            const token = await this.getAuthToken(interactive);
            if (!token) {
                Logger.warn('GoogleDriveProvider', 'Authentication check failed: No token received.');
                return false;
            }

            Logger.info('GoogleDriveProvider', 'Successfully authenticated with Google Drive.');
            return true;
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

            const token = await this.getAuthToken(false);
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
            const token = await this.getAuthToken(false);
            if (token && typeof chrome !== 'undefined' && chrome.identity?.removeCachedAuthToken) {
                await new Promise<void>((resolve) => {
                    chrome.identity.removeCachedAuthToken({ token }, () => {
                        Logger.info('GoogleDriveProvider', 'Google Drive auth token removed from cache.');
                        resolve();
                    });
                });
            }
            await this.clearStoredToken();
            Logger.info('GoogleDriveProvider', 'Google Drive user disconnected.');
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
            const token = await this.getAuthToken(false);
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
     * Retrieves an OAuth access token using Chrome getAuthToken or Universal launchWebAuthFlow.
     */
    private async getAuthToken(interactive: boolean = false): Promise<string | undefined> {
        if (typeof chrome === 'undefined' || !chrome.identity) {
            return undefined;
        }

        // 1. Preferred Native Path: Chrome Identity getAuthToken
        if (typeof chrome.identity.getAuthToken === 'function') {
            return new Promise((resolve) => {
                try {
                    chrome.identity.getAuthToken({ interactive }, (token?: string) => {
                        const lastError = chrome.runtime?.lastError;
                        if (lastError || !token) {
                            resolve(undefined);
                        } else {
                            resolve(token);
                        }
                    });
                } catch {
                    resolve(undefined);
                }
            });
        }

        // 2. Cross-Browser Path: launchWebAuthFlow (Firefox, Safari, etc.)
        if (typeof chrome.identity.launchWebAuthFlow === 'function') {
            // Check storage / in-memory cache first
            const cached = await this.getStoredToken();
            if (cached && cached.expiresAt > Date.now() + 60000) {
                return cached.accessToken;
            }

            if (!interactive) {
                return undefined;
            }

            return this.runWebAuthFlow(interactive);
        }

        return undefined;
    }

    /**
     * Executes OAuth2 web auth flow via chrome.identity.launchWebAuthFlow.
     */
    private runWebAuthFlow(interactive: boolean): Promise<string | undefined> {
        return new Promise((resolve) => {
            try {
                const redirectUrl = typeof chrome.identity.getRedirectURL === 'function'
                    ? chrome.identity.getRedirectURL('oauth2')
                    : '';

                const manifest = typeof chrome.runtime?.getManifest === 'function'
                    ? chrome.runtime.getManifest()
                    : undefined;
                const clientId = (manifest as unknown as { oauth2?: { client_id?: string } })?.oauth2?.client_id ||
                    '837482928374-exampleclientid.apps.googleusercontent.com';

                const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                authUrl.searchParams.set('client_id', clientId);
                authUrl.searchParams.set('response_type', 'token');
                authUrl.searchParams.set('redirect_uri', redirectUrl);
                authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.appdata');
                authUrl.searchParams.set('prompt', 'select_account');

                chrome.identity.launchWebAuthFlow({
                    url: authUrl.toString(),
                    interactive
                }, (responseUrl?: string) => {
                    const lastError = chrome.runtime?.lastError;
                    if (lastError || !responseUrl) {
                        const msg = lastError ? (lastError.message || String(lastError)) : 'No response URL';
                        Logger.warn('GoogleDriveProvider', `launchWebAuthFlow failed: ${msg}`);
                        resolve(undefined);
                        return;
                    }

                    // Parse access token from redirect URL hash: #access_token=...&expires_in=...
                    const hashIndex = responseUrl.indexOf('#');
                    if (hashIndex === -1) {
                        resolve(undefined);
                        return;
                    }

                    const params = new URLSearchParams(responseUrl.substring(hashIndex + 1));
                    const accessToken = params.get('access_token');
                    const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

                    if (accessToken) {
                        const expiresAt = Date.now() + expiresIn * 1000;
                        this.saveStoredToken(accessToken, expiresAt);
                        resolve(accessToken);
                    } else {
                        resolve(undefined);
                    }
                });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('GoogleDriveProvider', `Exception in launchWebAuthFlow: ${errorMessage}`, { err });
                resolve(undefined);
            }
        });
    }

    /**
     * Reads cached token from memory or chrome.storage.local.
     */
    private async getStoredToken(): Promise<StoredOAuthToken | null> {
        if (this.memoryCachedToken) {
            return this.memoryCachedToken;
        }
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            const res = await chrome.storage.local.get(['gdrive_oauth_token']);
            if (res.gdrive_oauth_token && typeof res.gdrive_oauth_token.accessToken === 'string') {
                this.memoryCachedToken = res.gdrive_oauth_token;
                return this.memoryCachedToken;
            }
        }
        return null;
    }

    /**
     * Persists token into memory and chrome.storage.local.
     */
    private async saveStoredToken(accessToken: string, expiresAt: number): Promise<void> {
        this.memoryCachedToken = { accessToken, expiresAt };
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({ gdrive_oauth_token: this.memoryCachedToken });
        }
    }

    /**
     * Clears persisted token from memory and chrome.storage.local.
     */
    private async clearStoredToken(): Promise<void> {
        this.memoryCachedToken = null;
        if (typeof chrome !== 'undefined' && chrome.storage?.local && typeof chrome.storage.local.remove === 'function') {
            await chrome.storage.local.remove(['gdrive_oauth_token']);
        }
    }
}
