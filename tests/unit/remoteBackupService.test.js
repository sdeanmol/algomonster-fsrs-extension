/**
 * @file tests/unit/remoteBackupService.test.js
 * @description Unit tests for pluggable RemoteBackupService and GoogleDriveBackupProvider contracts.
 */
import { RemoteBackupService } from '../../features/common/data/remote/remoteBackupService';
import { GoogleDriveBackupProvider } from '../../features/common/data/remote/providers/googleDriveProvider';

describe('RemoteBackupService Pluggable Architecture', () => {
    let service;

    beforeEach(() => {
        service = RemoteBackupService.getInstance();
    });

    test('should register and retrieve default Google Drive provider', () => {
        const provider = service.getProvider('gdrive');
        expect(provider).toBeDefined();
        expect(provider.id).toBe('gdrive');
        expect(provider.name).toContain('Google Drive');
    });

    test('should support registering custom cloud providers cleanly', () => {
        const mockProvider = {
            id: 'mock_cloud',
            name: 'Mock Cloud Storage',
            authenticate: jest.fn().mockResolvedValue(true),
            uploadBackup: jest.fn().mockResolvedValue({ success: true, remoteId: 'mock_123' }),
            isConnected: jest.fn().mockResolvedValue(true),
            disconnect: jest.fn().mockResolvedValue()
        };

        service.registerProvider(mockProvider);

        const retrieved = service.getProvider('mock_cloud');
        expect(retrieved).toBe(mockProvider);
        expect(retrieved.id).toBe('mock_cloud');

        const providersList = service.listProviders();
        expect(providersList).toEqual(
            expect.arrayContaining([{ id: 'mock_cloud', name: 'Mock Cloud Storage' }])
        );
    });

    test('should save and retrieve remote backup settings', async () => {
        const settings = await service.saveSettings({
            enabled: true,
            providerId: 'gdrive',
            frequency: 'weekly'
        });

        expect(settings.enabled).toBe(true);
        expect(settings.providerId).toBe('gdrive');
        expect(settings.frequency).toBe('weekly');

        const loaded = await service.getSettings();
        expect(loaded.enabled).toBe(true);
    });

    test('GoogleDriveBackupProvider should adhere to RemoteBackupProvider interface', () => {
        const gdrive = new GoogleDriveBackupProvider();
        expect(gdrive.id).toBe('gdrive');
        expect(typeof gdrive.authenticate).toBe('function');
        expect(typeof gdrive.uploadBackup).toBe('function');
        expect(typeof gdrive.isConnected).toBe('function');
        expect(typeof gdrive.disconnect).toBe('function');
    });
});
