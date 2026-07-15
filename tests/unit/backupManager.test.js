const { BackupManager, Fnv1aHasher, readLines } = require('../../features/common/data/backupManager.js');

// Mock globalThis.Logger
globalThis.Logger = {
  time: jest.fn(),
  timeEnd: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
};

// Mock TextEncoder and TextDecoder
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
  global.TextDecoder = require('util').TextDecoder;
}

// Mock Streams
class MockCompressionStream {
  constructor() {
    this.readable = new ReadableStream();
    this.writable = new WritableStream();
  }
}
global.CompressionStream = MockCompressionStream;
global.DecompressionStream = MockCompressionStream;
global.URL = { createObjectURL: jest.fn(() => 'blob:mock-url') };
global.Blob = class MockBlob {
  constructor(content) { this.content = content; }
};

describe('Fnv1aHasher', () => {
  it('correctly hashes a simple string', () => {
    const hasher = new Fnv1aHasher();
    hasher.update("hello world\n");
    expect(hasher.digest()).toBe('5e2d7456');
  });

  it('correctly calculates hash for multiple updates', () => {
    const hasher1 = new Fnv1aHasher();
    hasher1.update("abc");
    
    const hasher2 = new Fnv1aHasher();
    hasher2.update("a");
    hasher2.update("bc");

    expect(hasher1.digest()).toBe(hasher2.digest());
  });
});

describe('readLines generator', () => {
  it('yields lines from a stream correctly', async () => {
    // Mock a readable stream that returns specific chunks
    const chunks = [
      new TextEncoder().encode("line1\nli"),
      new TextEncoder().encode("ne2\nline3")
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
    };

    const lines = [];
    for await (const line of readLines(mockStream)) {
      lines.push(line);
    }
    
    expect(lines).toEqual(['line1', 'line2', 'line3']);
  });
});

describe('BackupManager', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    global.mockStorage = {
      fsrsCards: [{ id: '1', problemTitle: 'Mock Card', problemUrl: 'https://test.com', tags: [] }],
      bookmarks: [{ id: '2', url: 'https://test.com', title: 'Mock Bookmark' }],
      theme: 'dark'
    };
    global.chrome.downloads = { download: jest.fn() };
    global.chrome.storage.local.get.mockImplementation(async () => global.mockStorage);
    global.chrome.storage.local.set.mockImplementation(async () => {});
    global.chrome.storage.local.remove.mockImplementation(async () => {});
  });

  describe('exportBackup', () => {
    it('fetches storage and starts download', async () => {
      global.Response = class {
        constructor() {}
        blob() { return Promise.resolve(new Blob(['mock data'])); }
      };

      await BackupManager.exportBackup();
      
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(null);
      expect(global.chrome.downloads.download).toHaveBeenCalled();
      expect(global.chrome.downloads.download.mock.calls[0][0].url).toBe('blob:mock-url');
      expect(global.chrome.downloads.download.mock.calls[0][0].filename).toContain('.json.gz');
    });
  });

  describe('validateStream', () => {
    it('validates a correct stream successfully', async () => {
      // Mock File object
      const headerStr = JSON.stringify({ type: 'header', data: { version: '2.0', counts: { cards: 1 } } }) + '\n';
      const itemStr = JSON.stringify({ type: 'card', data: { id: '1' } }) + '\n';
      
      const hasher = new Fnv1aHasher();
      hasher.update(headerStr);
      hasher.update(itemStr);
      const checksum = hasher.digest();
      const footerStr = JSON.stringify({ type: 'footer', data: { checksum } });

      const mockFile = {
        stream: () => ({
          getReader: () => {
            const lines = [headerStr, itemStr, footerStr];
            let i = 0;
            return {
              read: async () => {
                if (i < lines.length) {
                  return { done: false, value: new TextEncoder().encode(lines[i++]) };
                }
                return { done: true, value: undefined };
              },
              releaseLock: jest.fn()
            };
          }
        })
      };

      const result = await BackupManager.validateStream(mockFile, false);
      expect(result.isV2).toBe(true);
      expect(result.header).toBeDefined();
    });

    it('returns isV2 false if header is missing or corrupted on first line', async () => {
       const mockFile = {
        stream: () => ({
          getReader: () => {
            const lines = ["Not JSON"];
            let i = 0;
            return {
              read: async () => {
                if (i < lines.length) {
                  return { done: false, value: new TextEncoder().encode(lines[i++]) };
                }
                return { done: true, value: undefined };
              },
              releaseLock: jest.fn()
            };
          }
        })
      };
      
      const result = await BackupManager.validateStream(mockFile, false);
      expect(result.isV2).toBe(false);
    });
    
    it('throws error on checksum mismatch', async () => {
      const headerStr = JSON.stringify({ type: 'header', data: { version: '2.0', counts: { cards: 1 } } }) + '\n';
      const footerStr = JSON.stringify({ type: 'footer', data: { checksum: 'wrong' } });

      const mockFile = {
        stream: () => ({
          getReader: () => {
            const lines = [headerStr, footerStr];
            let i = 0;
            return {
              read: async () => {
                if (i < lines.length) {
                  return { done: false, value: new TextEncoder().encode(lines[i++]) };
                }
                return { done: true, value: undefined };
              },
              releaseLock: jest.fn()
            };
          }
        })
      };

      await expect(BackupManager.validateStream(mockFile, false)).rejects.toThrow(/Integrity check failed: Checksum mismatch/);
    });
  });

  describe('importBackup', () => {
    it('delegates to legacy import if file is legacy json', async () => {
      jest.spyOn(BackupManager, 'importLegacy').mockResolvedValue(true);
      
      const mockFile = { 
        name: 'test.json',
        size: 10,
        slice: () => ({
          arrayBuffer: async () => new Uint8Array([0x7b, 0x00]).buffer // '{' is 0x7b
        })
      };
      const statusCallback = jest.fn();
      
      await BackupManager.importBackup(mockFile, statusCallback);
      
      expect(BackupManager.importLegacy).toHaveBeenCalledWith(mockFile, statusCallback);
    });

    it('processes V2 streams successfully', async () => {
      const mockFile = { 
        name: 'test.jsonl',
        size: 100,
        slice: () => ({
          arrayBuffer: async () => new Uint8Array([0x00, 0x00]).buffer // not gzip, not legacy
        }),
        stream: () => ({
          getReader: () => {
            const lines = [
              JSON.stringify({ type: 'settings', data: { theme: 'light' } }) + '\n'
            ];
            let i = 0;
            return {
              read: async () => {
                if (i < lines.length) {
                  return { done: false, value: new TextEncoder().encode(lines[i++]) };
                }
                return { done: true, value: undefined };
              },
              releaseLock: jest.fn()
            };
          }
        })
      };
      
      jest.spyOn(BackupManager, 'validateStream').mockResolvedValue({ 
          isV2: true, 
          counts: { cards: 1, bookmarks: 0 } 
      });
      
      const statusCallback = jest.fn();
      
      await BackupManager.importBackup(mockFile, statusCallback);
      expect(global.chrome.storage.local.set).toHaveBeenCalled();
      expect(statusCallback).toHaveBeenCalledWith(expect.stringContaining("Backup restored successfully!"));
    });
  });

  describe('importLegacy', () => {
    it('parses legacy JSON format and updates storage', async () => {
      const mockFile = { name: 'legacy.json', size: 100 };
      const statusCallback = jest.fn();

      const mockReadAsText = jest.fn(function() {
        if (this.onload) {
          this.onload({
            target: {
              result: JSON.stringify({
                cards: [{ id: '1' }],
                marks: [{ url: 'a' }],
                bookmarks: [],
                theme: 'light'
              })
            }
          });
        }
      });

      jest.spyOn(global, 'FileReader').mockImplementation(function() {
        this.readAsText = mockReadAsText;
      });

      await BackupManager.importLegacy(mockFile, statusCallback);

      expect(global.chrome.storage.local.set).toHaveBeenCalled();
      const setCall = global.chrome.storage.local.set.mock.calls[0][0];
      expect(setCall.fsrsCards.length).toBe(1);
      expect(setCall.theme).toBe('light');
      expect(statusCallback).toHaveBeenCalledWith("Legacy backup imported successfully!");
    });
  });
});
