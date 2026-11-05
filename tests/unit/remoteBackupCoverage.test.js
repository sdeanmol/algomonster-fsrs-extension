/**
 * @file tests/unit/remoteBackupCoverage.test.js
 * @description Comprehensive unit test suite targeting >90% coverage for RemoteBackupService & GoogleDriveBackupProvider.
 */

import { RemoteBackupService } from '../../features/common/data/remote/remoteBackupService';
import { GoogleDriveBackupProvider } from '../../features/common/data/remote/providers/googleDriveProvider';
import { BackupManager } from '../../features/common/data/backupManager';

describe('Remote Cloud Auto-Backup Deep Coverage Suite', () => {
    let originalChrome;
    let originalFetch;

    beforeEach(() => {
        originalChrome = global.chrome;
        originalFetch = global.fetch;

        // Mock chrome storage
        const storageMock = {};
        global.chrome = {
            runtime: {},
            storage: {
                local: {
                    get: jest.fn((keys, callback) => {
                        let result = {};
                        if (keys === null) {
                            result = { ...storageMock };
                        } else if (Array.isArray(keys)) {
                            keys.forEach(k => { if (storageMock[k] !== undefined) result[k] = storageMock[k]; });
                        } else if (typeof keys === 'object') {
                            Object.keys(keys).forEach(k => { result[k] = storageMock[k] !== undefined ? storageMock[k] : keys[k]; });
                        }
                        if (callback) callback(result);
                        return Promise.resolve(result);
                    }),
                    set: jest.fn((data, callback) => {
                        Object.assign(storageMock, data);
                        if (callback) callback();
                        return Promise.resolve();
                    }),
                    remove: jest.fn((keys, callback) => {
                        const arr = Array.isArray(keys) ? keys : [keys];
                        arr.forEach(k => delete storageMock[k]);
                        if (callback) callback();
                        return Promise.resolve();
                    })
                }
            },
            alarms: {
                create: jest.fn(),
                clear: jest.fn(() => Promise.resolve(true))
            },
            identity: {
                getAuthToken: jest.fn((opts, callback) => callback('mock_oauth_token_123')),
                removeCachedAuthToken: jest.fn((opts, callback) => callback())
            }
        };

        // Mock fetch globally
        global.fetch = jest.fn();
    });

    afterEach(() => {
        global.chrome = originalChrome;
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    // =========================================================================
    // 1. GoogleDriveBackupProvider Comprehensive Coverage Tests
    // =========================================================================
    describe('GoogleDriveBackupProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new GoogleDriveBackupProvider();
        });

        test('id and name properties are correctly set', () => {
            expect(provider.id).toBe('gdrive');
            expect(provider.name).toBe('Google Drive (AppData)');
        });

        test('authenticate returns false when chrome.identity is missing', async () => {
            delete global.chrome.identity;
            const res = await provider.authenticate(false);
            expect(res).toBe(false);
        });

        test('authenticate returns false when chrome.runtime.lastError is present', async () => {
            global.chrome.runtime.lastError = { message: 'Auth popup closed by user' };
            global.chrome.identity.getAuthToken = jest.fn((opts, callback) => callback(undefined));
            const res = await provider.authenticate(true);
            expect(res).toBe(false);
            delete global.chrome.runtime.lastError;
        });

        test('authenticate catches exceptions and returns false', async () => {
            global.chrome.identity.getAuthToken = jest.fn(() => {
                throw new Error('Identity API Crash');
            });
            const res = await provider.authenticate(true);
            expect(res).toBe(false);
        });

        test('isConnected calls authenticate and reflects connection state', async () => {
            global.chrome.identity.getAuthToken = jest.fn((opts, cb) => cb('token_valid'));
            expect(await provider.isConnected()).toBe(true);

            global.chrome.identity.getAuthToken = jest.fn((opts, cb) => cb(undefined));
            expect(await provider.isConnected()).toBe(false);
        });

        test('disconnect removes cached token via chrome.identity', async () => {
            await provider.disconnect();
            expect(global.chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
                { token: 'mock_oauth_token_123' },
                expect.any(Function)
            );
        });

        test('disconnect catches errors gracefully', async () => {
            global.chrome.identity.removeCachedAuthToken = jest.fn(() => {
                throw new Error('Remove token failure');
            });
            await expect(provider.disconnect()).resolves.not.toThrow();
        });

        test('uploadBackup fails when unauthenticated', async () => {
            global.chrome.identity.getAuthToken = jest.fn((opts, cb) => cb(undefined));
            const payload = { data: new Uint8Array([1, 2, 3]), filename: 'test.jsonl.gz', checksum: '1234', timestamp: Date.now() };
            const result = await provider.uploadBackup(payload);
            expect(result.success).toBe(false);
            expect(result.error).toContain('User is not authenticated');
        });

        test('uploadBackup fails when token acquisition fails on second attempt', async () => {
            let calls = 0;
            global.chrome.identity.getAuthToken = jest.fn((opts, cb) => {
                calls++;
                cb(calls === 1 ? 'valid_token' : undefined);
            });

            const payload = { data: new Uint8Array([1, 2, 3]), filename: 'test.jsonl.gz', checksum: '1234', timestamp: Date.now() };
            const result = await provider.uploadBackup(payload);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to acquire access token.');
        });

        test('uploadBackup handles non-200 HTTP response from Google Drive REST API', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 507,
                text: jest.fn().mockResolvedValue('Insufficient Storage')
            });

            const payload = { data: new Uint8Array([65, 66, 67]), filename: 'test.jsonl.gz', checksum: '1234', timestamp: Date.now() };
            const result = await provider.uploadBackup(payload);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Google Drive HTTP 507');
        });

        test('uploadBackup successfully posts multipart payload and triggers backup rotation', async () => {
            // Upload POST success response
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ id: 'gdrive_file_id_999' })
            });

            // List backups GET response for rotateBackups
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    files: [
                        { id: '1', name: 'algorecall_backup_1.jsonl.gz', createdTime: '2026-08-01' },
                        { id: '2', name: 'algorecall_backup_2.jsonl.gz', createdTime: '2026-08-02' },
                        { id: '3', name: 'algorecall_backup_3.jsonl.gz', createdTime: '2026-08-03' },
                        { id: '4', name: 'algorecall_backup_4.jsonl.gz', createdTime: '2026-08-04' },
                        { id: '5', name: 'algorecall_backup_5.jsonl.gz', createdTime: '2026-08-05' },
                        { id: '6', name: 'algorecall_backup_6.jsonl.gz', createdTime: '2026-08-06' }
                    ]
                })
            });

            // Delete request for 6th file
            global.fetch.mockResolvedValueOnce({ ok: true });

            const payload = { data: new Uint8Array([72, 69, 76, 76, 79]), filename: 'test_backup.jsonl.gz', checksum: 'a1b2c3d4', timestamp: Date.now() };
            const result = await provider.uploadBackup(payload);

            expect(result.success).toBe(true);
            expect(result.remoteId).toBe('gdrive_file_id_999');
            expect(global.fetch).toHaveBeenCalledWith(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                expect.objectContaining({ method: 'POST' })
            );
        });

        test('uploadBackup catches network exceptions cleanly', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network offline'));
            const payload = { data: new Uint8Array([1, 2]), filename: 'test.jsonl.gz', checksum: '1234', timestamp: Date.now() };
            const result = await provider.uploadBackup(payload);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Network offline');
        });

        test('rotateBackups handles early exit when token is missing or fetch fails', async () => {
            global.chrome.identity.getAuthToken = jest.fn((opts, cb) => cb(undefined));
            await expect(provider.rotateBackups(5)).resolves.not.toThrow();

            global.chrome.identity.getAuthToken = jest.fn((opts, cb) => cb('valid_token'));
            global.fetch.mockResolvedValueOnce({ ok: false });
            await expect(provider.rotateBackups(5)).resolves.not.toThrow();
        });

        test('rotateBackups handles deletion fetch errors for single file gracefully', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    files: [
                        { id: '1', name: 'algorecall_backup_1.jsonl.gz' },
                        { id: '2', name: 'algorecall_backup_2.jsonl.gz' },
                        { id: '3', name: 'algorecall_backup_3.jsonl.gz' },
                        { id: '4', name: 'algorecall_backup_4.jsonl.gz' },
                        { id: '5', name: 'algorecall_backup_5.jsonl.gz' },
                        { id: '6', name: 'algorecall_backup_6.jsonl.gz' }
                    ]
                })
            });

            // Single file deletion fails
            global.fetch.mockRejectedValueOnce(new Error('Delete permission error'));
            await expect(provider.rotateBackups(5)).resolves.not.toThrow();
        });

        describe('launchWebAuthFlow fallback (Firefox/Safari)', () => {
            beforeEach(() => {
                delete global.chrome.identity.getAuthToken;
                delete global.chrome.identity.removeCachedAuthToken;
                global.chrome.identity.getRedirectURL = jest.fn((path) => `https://mock-extension-id.chromiumapp.org/${path}`);
                global.chrome.identity.launchWebAuthFlow = jest.fn();
                global.chrome.runtime.getManifest = jest.fn(() => ({
                    oauth2: { client_id: 'test-cross-browser-client-id' }
                }));
            });

            test('authenticates successfully via launchWebAuthFlow and caches token', async () => {
                global.chrome.identity.launchWebAuthFlow.mockImplementation((opts, callback) => {
                    callback('https://mock-extension-id.chromiumapp.org/oauth2#access_token=flow_token_xyz&token_type=Bearer&expires_in=3600');
                });

                const result = await provider.authenticate(true);
                expect(result).toBe(true);
                expect(global.chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
                    expect.objectContaining({
                        interactive: true,
                        url: expect.stringContaining('client_id=test-cross-browser-client-id')
                    }),
                    expect.any(Function)
                );

                // Subsequent check should retrieve cached token without re-launching flow
                global.chrome.identity.launchWebAuthFlow.mockClear();
                const connected = await provider.isConnected();
                expect(connected).toBe(true);
                expect(global.chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
            });

            test('returns false when launchWebAuthFlow encounters an error or user cancels', async () => {
                global.chrome.runtime.lastError = { message: 'The user cancelled the authorization flow.' };
                global.chrome.identity.launchWebAuthFlow.mockImplementation((opts, callback) => {
                    callback(undefined);
                });

                const result = await provider.authenticate(true);
                expect(result).toBe(false);
                delete global.chrome.runtime.lastError;
            });

            test('returns false when response URL has no access token hash', async () => {
                global.chrome.identity.launchWebAuthFlow.mockImplementation((opts, callback) => {
                    callback('https://mock-extension-id.chromiumapp.org/oauth2?error=access_denied');
                });

                const result = await provider.authenticate(true);
                expect(result).toBe(false);
            });

            test('disconnect clears stored token in launchWebAuthFlow mode', async () => {
                global.chrome.identity.launchWebAuthFlow.mockImplementation((opts, callback) => {
                    callback('https://mock-extension-id.chromiumapp.org/oauth2#access_token=to_be_cleared&expires_in=3600');
                });
                await provider.authenticate(true);
                expect(await provider.isConnected()).toBe(true);

                await provider.disconnect();
                expect(await provider.isConnected()).toBe(false);
            });
        });
    });

    // =========================================================================
    // 2. RemoteBackupService Comprehensive Coverage Tests
    // =========================================================================
    describe('RemoteBackupService', () => {
        let service;

        beforeEach(() => {
            service = RemoteBackupService.getInstance();
        });

        test('getInstance returns the same singleton instance', () => {
            const instance1 = RemoteBackupService.getInstance();
            const instance2 = RemoteBackupService.getInstance();
            expect(instance1).toBe(instance2);
        });

        test('listProviders returns registered provider metadata', () => {
            const providers = service.listProviders();
            expect(Array.isArray(providers)).toBe(true);
            expect(providers.length).toBeGreaterThanOrEqual(1);
            expect(providers[0]).toHaveProperty('id');
            expect(providers[0]).toHaveProperty('name');
        });

        test('getProvider falls back to first provider if requested ID is omitted', () => {
            const defaultProvider = service.getProvider();
            expect(defaultProvider).toBeDefined();
            expect(defaultProvider.id).toBe('gdrive');
        });

        test('setupAlarmSchedule handles weekly and daily alarm periods', async () => {
            await service.setupAlarmSchedule({ enabled: true, providerId: 'gdrive', frequency: 'weekly' });
            expect(global.chrome.alarms.create).toHaveBeenCalledWith(
                'remoteAutoBackup',
                { delayInMinutes: 60, periodInMinutes: 10080 }
            );

            await service.setupAlarmSchedule({ enabled: true, providerId: 'gdrive', frequency: 'daily' });
            expect(global.chrome.alarms.create).toHaveBeenCalledWith(
                'remoteAutoBackup',
                { delayInMinutes: 60, periodInMinutes: 1440 }
            );

            await service.setupAlarmSchedule({ enabled: false, providerId: 'gdrive', frequency: 'daily' });
            expect(global.chrome.alarms.clear).toHaveBeenCalledWith('remoteAutoBackup');
        });

        test('setupAlarmSchedule recovers gracefully if chrome.alarms throws', async () => {
            global.chrome.alarms.clear = jest.fn(() => {
                throw new Error('Alarms clear fail');
            });
            await expect(service.setupAlarmSchedule({ enabled: true, providerId: 'gdrive', frequency: 'daily' })).resolves.not.toThrow();
        });

        test('performBackup returns error when provider is unregistered', async () => {
            await service.saveSettings({ enabled: true, providerId: 'unknown_provider' });
            const result = await service.performBackup(true);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Selected provider \'unknown_provider\' is not registered.');
        });

        test('performBackup bypasses network upload when checksum is identical and force is false', async () => {
            const mockExportGzip = jest.spyOn(BackupManager, 'exportDataGzip').mockResolvedValue(new Uint8Array([10, 20, 30]));

            // First run forced upload
            const mockProvider = {
                id: 'gdrive',
                name: 'Google Drive',
                authenticate: jest.fn().mockResolvedValue(true),
                uploadBackup: jest.fn().mockResolvedValue({ success: true, remoteId: 'file_1' }),
                isConnected: jest.fn().mockResolvedValue(true),
                disconnect: jest.fn().mockResolvedValue()
            };
            service.registerProvider(mockProvider);
            await service.saveSettings({ enabled: true, providerId: 'gdrive', frequency: 'daily' });

            const firstRun = await service.performBackup(true);
            expect(firstRun.success).toBe(true);
            expect(mockProvider.uploadBackup).toHaveBeenCalledTimes(1);

            // Second run without force (same data)
            const secondRun = await service.performBackup(false);
            expect(secondRun.success).toBe(true);
            // Upload should NOT be called again due to checksum deduplication match!
            expect(mockProvider.uploadBackup).toHaveBeenCalledTimes(1);

            mockExportGzip.mockRestore();
        });

        test('performBackup updates failure status when provider upload fails', async () => {
            const mockExportGzip = jest.spyOn(BackupManager, 'exportDataGzip').mockResolvedValue(new Uint8Array([1, 2, 3]));
            const mockFailingProvider = {
                id: 'fail_provider',
                name: 'Failing Provider',
                authenticate: jest.fn().mockResolvedValue(true),
                uploadBackup: jest.fn().mockResolvedValue({ success: false, error: 'Quota exceeded' }),
                isConnected: jest.fn().mockResolvedValue(true),
                disconnect: jest.fn().mockResolvedValue()
            };

            service.registerProvider(mockFailingProvider);
            await service.saveSettings({ enabled: true, providerId: 'fail_provider', frequency: 'daily' });

            const result = await service.performBackup(true);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Quota exceeded');

            const settings = await service.getSettings();
            expect(settings.lastBackupStatus).toBe('failed');
            expect(settings.lastError).toBe('Quota exceeded');

            mockExportGzip.mockRestore();
        });

        test('performBackup handles exceptions thrown during execution', async () => {
            const mockExportGzip = jest.spyOn(BackupManager, 'exportDataGzip').mockImplementation(() => {
                throw new Error('Gzip Compression Engine Error');
            });

            const result = await service.performBackup(true);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Gzip Compression Engine Error');

            mockExportGzip.mockRestore();
        });
    });
});
