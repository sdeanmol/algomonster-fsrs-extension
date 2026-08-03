/**
 * @file features/common/data/remote/remoteBackupProvider.ts
 * @description Decoupled interface contracts for remote cloud auto-backup providers.
 */

export interface BackupPayload {
    /** Raw Gzip-compressed JSONL backup byte array */
    data: Uint8Array;
    /** Standard timestamped filename e.g. "algorecall_backup_2026-08-03_120000.jsonl.gz" */
    filename: string;
    /** FNV-1a checksum hex string for integrity validation */
    checksum: string;
    /** Epoch timestamp in milliseconds */
    timestamp: number;
}

export interface UploadResult {
    success: boolean;
    remoteId?: string;
    error?: string;
}

export interface RemoteBackupProvider {
    /** Unique provider identifier e.g. 'gdrive', 'firestore', 'onedrive', 'icloud' */
    readonly id: string;
    /** Human-readable display name e.g. 'Google Drive' */
    readonly name: string;

    /**
     * Authenticates or verifies connection with the cloud provider.
     * @param interactive - Whether user prompt UI should be shown if unauthenticated.
     */
    authenticate(interactive: boolean): Promise<boolean>;

    /**
     * Uploads the backup payload to the provider's remote storage location.
     */
    uploadBackup(payload: BackupPayload): Promise<UploadResult>;

    /**
     * Checks if the provider is currently connected and authenticated.
     */
    isConnected(): Promise<boolean>;

    /**
     * Disconnects / revokes access tokens for this provider.
     */
    disconnect(): Promise<void>;

    /**
     * Optional retention policy method to purge old automated backups.
     * @param maxBackupsToKeep - Maximum number of recent backup files to keep.
     */
    rotateBackups?(maxBackupsToKeep: number): Promise<void>;
}
