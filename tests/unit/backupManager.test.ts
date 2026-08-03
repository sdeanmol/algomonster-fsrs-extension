import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BackupManager, Fnv1aHasher, readLines, isValidBackupRecord } from '../../features/common/data/backupManager';

describe('backupManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).mockStorage = {
      fsrsCards: [{ id: '1', problemTitle: 'Mock Card', problemUrl: 'https://test.com', tags: [] }],
      bookmarks: [{ id: '2', url: 'https://test.com', title: 'Mock Bookmark' }],
      theme: 'dark'
    };
    (global as any).chrome.downloads = { download: jest.fn() };
    (global as any).chrome.storage.local.get = jest.fn(async () => (global as any).mockStorage);
    (global as any).chrome.storage.local.set = jest.fn(async () => {});
    (global as any).chrome.storage.local.remove = jest.fn(async () => {});

    // Mock CompressionStream / DecompressionStream if needed
    (global as any).CompressionStream = class {
      readable = new ReadableStream();
      writable = new WritableStream();
    };
    (global as any).DecompressionStream = class {
      readable = new ReadableStream();
      writable = new WritableStream();
    };
    (global as any).URL = { createObjectURL: jest.fn(() => 'blob:mock-url') };
    (global as any).Blob = class MockBlob {
      content: any;
      constructor(content: any) { this.content = content; }
    };
  });

  describe('isValidBackupRecord', () => {
    it('validates correct record structures', () => {
      expect(isValidBackupRecord({ type: 'header', data: {} })).toBe(true);
      expect(isValidBackupRecord({ type: 'card', data: { id: 1 } })).toBe(true);
      expect(isValidBackupRecord({ type: 'settings', data: {} })).toBe(true);
      expect(isValidBackupRecord({ type: 'footer', data: {} })).toBe(true);
    });

    it('rejects invalid or corrupted record objects', () => {
      expect(isValidBackupRecord(null)).toBe(false);
      expect(isValidBackupRecord(undefined)).toBe(false);
      expect(isValidBackupRecord('string')).toBe(false);
      expect(isValidBackupRecord({ type: 'invalid_type', data: {} })).toBe(false);
      expect(isValidBackupRecord({ type: 'header', data: null })).toBe(false);
      expect(isValidBackupRecord({ type: 'header' })).toBe(false);

      const throwingObj = {
        get type() {
          throw new Error('Getter error');
        }
      };
      expect(isValidBackupRecord(throwingObj)).toBe(false);
    });
  });

  describe('Fnv1aHasher', () => {
    it('correctly hashes strings and produces hex digest', () => {
      const hasher = new Fnv1aHasher();
      hasher.update('hello world\n');
      expect(hasher.digest()).toBe('5e2d7456');
    });

    it('produces identical hash for chunked vs full string', () => {
      const h1 = new Fnv1aHasher();
      h1.update('abcde');

      const h2 = new Fnv1aHasher();
      h2.update('ab');
      h2.update('cde');

      expect(h1.digest()).toBe(h2.digest());
    });

    it('handles exceptions in update and digest gracefully', () => {
      const hasher = new Fnv1aHasher();
      // Force error in update
      hasher.update(null as any);

      // Force error in digest by breaking hash value
      (hasher as any).hash = { toString: () => { throw new Error('Format error'); } };
      expect(hasher.digest()).toBe('00000000');
    });
  });

  describe('readLines generator', () => {
    it('yields lines from a stream correctly across chunk boundaries', async () => {
      const chunks = [
        new TextEncoder().encode('line1\nli'),
        new TextEncoder().encode('ne2\nline3')
      ];
      let chunkIndex = 0;

      const mockStream = {
        getReader: () => ({
          read: async () => {
            if (chunkIndex < chunks.length) {
              return { done: false, value: chunks[chunkIndex++] };
            }
            return { done: true, value: undefined };
          },
          releaseLock: jest.fn()
        })
      } as any;

      const lines: string[] = [];
      for await (const line of readLines(mockStream)) {
        lines.push(line);
      }
      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('re-throws error on stream read failure and releases lock', async () => {
      const releaseLockMock = jest.fn();
      const mockStream = {
        getReader: () => ({
          read: async () => {
            throw new Error('Stream error');
          },
          releaseLock: releaseLockMock
        })
      } as any;

      await expect(async () => {
        for await (const _ of readLines(mockStream)) {}
      }).rejects.toThrow('Stream error');

      expect(releaseLockMock).toHaveBeenCalled();
    });
  });

  describe('BackupManager.exportBackup', () => {
    it('fetches storage and triggers browser download for backup', async () => {
      (global as any).mockStorage = {
        fsrsCards: [{ id: 'c1', problemTitle: 'Two Sum', problemUrl: 'https://leetcode.com/problems/two-sum' }],
        bookmarks: [{ id: 'b1', url: 'https://leetcode.com/problems/two-sum', title: 'Two Sum' }],
        marks: [{ id: 'm1', url: 'https://leetcode.com/problems/two-sum', type: 'highlight' }],
        pagecontents: [{ id: 'pc1', url: 'https://leetcode.com/problems/two-sum', text: 'code' }],
        fsrsActivity: { '2026-08-01': 3 },
        fsrsTopicWeights: { Array: [0.1, 0.2] },
        theme: 'dark',
        whitelistedWebsites: [{ domain: 'leetcode.com', enabled: true }]
      };

      (global as any).Response = class {
        blob() { return Promise.resolve(new (global as any).Blob(['mock compressed data'])); }
      };

      await BackupManager.exportBackup();
      expect((global as any).chrome.storage.local.get).toHaveBeenCalledWith(null);
      expect((global as any).chrome.downloads.download).toHaveBeenCalled();
    });

    it('re-throws export exceptions on failure', async () => {
      (global as any).chrome.storage.local.get = jest.fn(async () => {
        throw new Error('Storage read failure');
      });

      await expect(BackupManager.exportBackup()).rejects.toThrow('Storage read failure');
    });
  });

  describe('BackupManager.validateStream', () => {
    it('validates a correct stream successfully', async () => {
      const headerStr = JSON.stringify({ type: 'header', data: { version: 2, counts: { cards: 1 } } }) + '\n';
      const cardStr = JSON.stringify({ type: 'card', data: { id: '1' } }) + '\n';

      const hasher = new Fnv1aHasher();
      hasher.update(headerStr);
      hasher.update(cardStr);
      const checksum = hasher.digest();
      const footerStr = JSON.stringify({ type: 'footer', data: { checksum, count: 2 } });

      const mockFile = {
        stream: () => ({
          getReader: () => {
            const lines = [headerStr, cardStr, footerStr];
            let idx = 0;
            return {
              read: async () => {
                if (idx < lines.length) return { done: false, value: new TextEncoder().encode(lines[idx++]) };
                return { done: true, value: undefined };
              },
              releaseLock: jest.fn()
            };
          }
        })
      } as any;

      const res = await BackupManager.validateStream(mockFile, false);
      expect(res.isV2).toBe(true);
      expect(res.header).toBeDefined();
    });

    it('returns isV2 false if first line is invalid JSON', async () => {
      const mockFile = {
        stream: () => ({
          getReader: () => {
            const lines = ['NOT_JSON_DATA'];
            let idx = 0;
            return {
              read: async () => {
                if (idx < lines.length) return { done: false, value: new TextEncoder().encode(lines[idx++]) };
                return { done: true, value: undefined };
              },
              releaseLock: jest.fn()
            };
          }
        })
      } as any;

      const res = await BackupManager.validateStream(mockFile, false);
      expect(res.isV2).toBe(false);
    });

    it('throws error on checksum mismatch', async () => {
      const headerStr = JSON.stringify({ type: 'header', data: { version: 2, counts: { cards: 1 } } }) + '\n';
      const footerStr = JSON.stringify({ type: 'footer', data: { checksum: 'badchecksum' } });

      const mockFile = {
        stream: () => ({
          getReader: () => {
            const lines = [headerStr, footerStr];
            let idx = 0;
            return {
              read: async () => {
                if (idx < lines.length) return { done: false, value: new TextEncoder().encode(lines[idx++]) };
                return { done: true, value: undefined };
              },
              releaseLock: jest.fn()
            };
          }
        })
      } as any;

      await expect(BackupManager.validateStream(mockFile, false)).rejects.toThrow(/Checksum mismatch/);
    });
  });

  describe('BackupManager.importBackup & importLegacy', () => {
    it('restores full V2 backup stream records into local storage', async () => {
      const mockFile = {
        name: 'full_backup.jsonl',
        size: 200,
        slice: () => ({
          arrayBuffer: async () => new Uint8Array([0x00, 0x00]).buffer
        }),
        stream: () => ({
          getReader: () => {
            const lines = [
              JSON.stringify({ type: 'page', data: { id: 0, url: 'https://test.com', title: 'Test' } }) + '\n',
              JSON.stringify({ type: 'card', data: { u: 0, stability: 10 } }) + '\n',
              JSON.stringify({ type: 'bookmark', data: { u: 0 } }) + '\n',
              JSON.stringify({ type: 'mark', data: { u: 0 } }) + '\n',
              JSON.stringify({ type: 'pagecontent', data: { u: 0 } }) + '\n',
              JSON.stringify({ type: 'activity', data: { '2026-08-01': 5 } }) + '\n',
              JSON.stringify({ type: 'weights', data: { Array: [0.1] } }) + '\n',
              JSON.stringify({ type: 'settings', data: { theme: 'light', whitelistedWebsites: [{ domain: 'test.com' }] } }) + '\n'
            ];
            let idx = 0;
            return {
              read: async () => {
                if (idx < lines.length) return { done: false, value: new TextEncoder().encode(lines[idx++]) };
                return { done: true, value: undefined };
              },
              releaseLock: jest.fn()
            };
          }
        })
      };

      jest.spyOn(BackupManager, 'validateStream').mockResolvedValue({
        isV2: true,
        counts: { pages: 1, cards: 1, marks: 1, bookmarks: 1, pagecontents: 1 }
      });

      const onStatus = jest.fn();
      await BackupManager.importBackup(mockFile as any, onStatus);

      expect((global as any).chrome.storage.local.set).toHaveBeenCalled();
      const setArg = (global as any).chrome.storage.local.set.mock.calls[0][0];
      expect(setArg.fsrsCards[0].problemUrl).toBe('https://test.com');
      expect(setArg.theme).toBe('light');
      expect(onStatus).toHaveBeenCalledWith('Backup restored successfully!');
    });

    it('imports legacy backup format successfully', async () => {
      const mockFile = { name: 'legacy.json', size: 50 };
      const onStatus = jest.fn();

      const mockReadAsText = jest.fn(function (this: any) {
        if (this.onload) {
          this.onload({
            target: {
              result: JSON.stringify({
                cards: [{ id: 'card1', problemTitle: 'Two Sum' }],
                marks: [{ url: 'https://test.com', type: 'highlight' }],
                theme: 'dark'
              })
            }
          });
        }
      });

      jest.spyOn(global as any, 'FileReader').mockImplementation(function (this: any) {
        this.readAsText = mockReadAsText;
      });

      await BackupManager.importLegacy(mockFile as any, onStatus);
      expect((global as any).chrome.storage.local.set).toHaveBeenCalled();
      expect(onStatus).toHaveBeenCalledWith('Legacy backup imported successfully!');
    });

    it('handles legacy file read error gracefully', async () => {
      const mockFile = { name: 'corrupted.json', size: 50 };
      const onStatus = jest.fn();

      const mockReadAsText = jest.fn(function (this: any) {
        this.error = new Error('File read failure');
        if (this.onerror) {
          this.onerror();
        }
      });

      jest.spyOn(global as any, 'FileReader').mockImplementation(function (this: any) {
        this.readAsText = mockReadAsText;
      });

      await expect(BackupManager.importLegacy(mockFile as any, onStatus)).rejects.toThrow('File read failure');
      expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('Failed to read legacy backup file'), true);
    });
  });
});
