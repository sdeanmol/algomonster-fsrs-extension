/**
 * @file features/common/data/remote/remoteBackupService.ts
 * @description Central manager for pluggable remote cloud auto-backups.
 * Registers providers, computes payload checksums, manages alarm schedules, and orchestrates syncs.
 */
import { RemoteBackupProvider, BackupPayload, UploadResult } from './remoteBackupProvider';
import { GoogleDriveBackupProvider } from './providers/googleDriveProvider';
import { BackupManager, Fnv1aHasher } from '../backupManager';
import { Logger } from '@common/logger';

export interface RemoteBackupSettings {
    enabled: boolean;
    providerId: string;
    frequency: 'daily' | 'weekly' | 'manual';
    lastBackupTimestamp?: number;
    lastBackupChecksum?: string;
    lastBackupStatus?: string;
    lastError?: string;
}

export class RemoteBackupService {
    private static instance: RemoteBackupService;
    private providers: Map<string, RemoteBackupProvider> = new Map();

    private constructor() {
        // Register standard default providers
        this.registerProvider(new GoogleDriveBackupProvider());
    }

    public static getInstance(): RemoteBackupService {
        if (!RemoteBackupService.instance) {
            RemoteBackupService.instance = new RemoteBackupService();
        }
        return RemoteBackupService.instance;
    }

    /**
     * Registers a new remote backup provider implementation.
     * Easily plug in new cloud providers (e.g., Firestore, OneDrive, iCloud, S3).
     */
    public registerProvider(provider: RemoteBackupProvider): void {
        this.providers.set(provider.id, provider);
        Logger.info('RemoteBackupService', `Registered cloud backup provider: ${provider.name} (${provider.id})`);
    }

    /**
     * Retrieves a registered provider by ID or returns the default provider.
     */
    public getProvider(providerId?: string): RemoteBackupProvider | undefined {
        if (providerId) {
            return this.providers.get(providerId);
        }
        // Default to first provider
        const first = this.providers.values().next();
        return first.done ? undefined : first.value;
    }

    /**
     * Returns a list of all registered cloud provider metadata.
     */
    public listProviders(): Array<{ id: string; name: string }> {
        return Array.from(this.providers.values()).map(p => ({ id: p.id, name: p.name }));
    }

    /**
     * Loads remote backup configuration from storage.
     */
    public async getSettings(): Promise<RemoteBackupSettings> {
        try {
            const result = await chrome.storage.local.get(['remoteBackupSettings']);
            const settings: RemoteBackupSettings = result.remoteBackupSettings || {
                enabled: false,
                providerId: 'gdrive',
                frequency: 'daily'
            };
            return settings;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RemoteBackupService', `Error reading remoteBackupSettings: ${errorMessage}`, { err });
            return { enabled: false, providerId: 'gdrive', frequency: 'daily' };
        }
    }

    /**
     * Saves remote backup settings and updates the alarm schedule accordingly.
     */
    public async saveSettings(newSettings: Partial<RemoteBackupSettings>): Promise<RemoteBackupSettings> {
        try {
            const current = await this.getSettings();
            const updated: RemoteBackupSettings = { ...current, ...newSettings };
            await chrome.storage.local.set({ remoteBackupSettings: updated });
            await this.setupAlarmSchedule(updated);
            return updated;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RemoteBackupService', `Error saving remoteBackupSettings: ${errorMessage}`, { err });
            throw err;
        }
    }

    /**
     * Configures the background Chrome Alarm for automated remote backups.
     */
    public async setupAlarmSchedule(settingsInput?: RemoteBackupSettings): Promise<void> {
        try {
            if (typeof chrome === 'undefined' || !chrome.alarms) return;

            const settings = settingsInput || (await this.getSettings());
            await chrome.alarms.clear('remoteAutoBackup');

            if (!settings.enabled || settings.frequency === 'manual') {
                Logger.info('RemoteBackupService', 'Remote auto-backup is disabled or set to manual.');
                return;
            }

            const periodInMinutes = settings.frequency === 'weekly' ? 10080 : 1440; // 7 days or 24 hours
            chrome.alarms.create('remoteAutoBackup', {
                delayInMinutes: 60, // First check in 1 hour
                periodInMinutes
            });

            Logger.info('RemoteBackupService', `Scheduled remoteAutoBackup alarm every ${settings.frequency} (${periodInMinutes} mins).`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RemoteBackupService', `Failed to setup remote backup alarm schedule: ${errorMessage}`, { err });
        }
    }

    /**
     * Executes the cloud backup pipeline:
     * 1. Generates Gzip-compressed JSONL payload using backupManager.
     * 2. Computes FNV-1a checksum.
     * 3. Skips upload if data checksum hasn't changed since last successful backup.
     * 4. Delegates upload to the active RemoteBackupProvider.
     */
    public async performBackup(force: boolean = false): Promise<UploadResult> {
        try {
            const settings = await this.getSettings();
            const provider = this.getProvider(settings.providerId);

            if (!provider) {
                const error = `Selected provider '${settings.providerId}' is not registered.`;
                await this.updateStatus(false, error);
                return { success: false, error };
            }

            // Export Gzip byte array
            const gzipBytes = await BackupManager.exportDataGzip();
            const binaryStr = String.fromCharCode.apply(null, Array.from(gzipBytes));

            // Compute Checksum
            const hasher = new Fnv1aHasher();
            hasher.update(binaryStr);
            const checksum = hasher.digest();

            // Deduplication Check
            if (!force && settings.lastBackupChecksum === checksum && settings.lastBackupStatus === 'success') {
                Logger.info('RemoteBackupService', 'Remote backup skipped: Data has not changed since last backup.');
                return { success: true };
            }

            // Generate Timestamped Filename
            const d = new Date();
            const dateStr = d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `algorecall_backup_${dateStr}.jsonl.gz`;

            const payload: BackupPayload = {
                data: gzipBytes,
                filename,
                checksum,
                timestamp: d.getTime()
            };

            Logger.info('RemoteBackupService', `Initiating cloud upload with provider ${provider.name} (${payload.filename}, ${gzipBytes.byteLength} bytes)...`);

            const uploadResult = await provider.uploadBackup(payload);

            if (uploadResult.success) {
                await this.saveSettings({
                    lastBackupTimestamp: payload.timestamp,
                    lastBackupChecksum: checksum,
                    lastBackupStatus: 'success',
                    lastError: undefined
                });
                Logger.info('RemoteBackupService', `Remote cloud backup completed successfully.`);
            } else {
                await this.updateStatus(false, uploadResult.error || 'Unknown upload error');
            }

            return uploadResult;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RemoteBackupService', `Error performing remote backup: ${errorMessage}`, { err });
            await this.updateStatus(false, errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    private async updateStatus(success: boolean, error?: string): Promise<void> {
        try {
            await this.saveSettings({
                lastBackupStatus: success ? 'success' : 'failed',
                lastError: error
            });
        } catch (err) {
            // Safe recovery
        }
    }
}
