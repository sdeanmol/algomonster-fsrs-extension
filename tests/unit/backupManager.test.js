const { BackupManager } = require('../../features/common/data/backupManager.js');

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

describe('BackupManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.mockStorage = {
      fsrsCards: [{ problemTitle: 'Mock Card', problemUrl: 'https://test.com', tags: [] }],
      bookmarks: [{ url: 'https://test.com', title: 'Mock Bookmark' }]
    };
    global.chrome.downloads = { download: jest.fn() };
  });

  describe('exportBackup', () => {
    it('fetches storage and starts download', async () => {
      // Mock Response for CompressionStream piping
      global.Response = class {
        constructor() {}
        blob() { return Promise.resolve(new Blob(['mock data'])); }
      };

      // Because we mock CompressionStream and Response very simply, we just want to ensure it calls down to chrome.downloads
      await BackupManager.exportBackup();
      
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(null);
      expect(global.chrome.downloads.download).toHaveBeenCalled();
      expect(global.chrome.downloads.download.mock.calls[0][0].url).toBe('blob:mock-url');
    });
  });

  describe('importLegacy', () => {
    it('parses legacy JSON format and updates storage', async () => {
      const mockFile = { name: 'legacy.json', size: 100 };
      const statusCallback = jest.fn();

      // Mock FileReader
      const mockFileReader = {
        readAsText: jest.fn(function() {
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
        })
      };
      global.FileReader = jest.fn(() => mockFileReader);

      await BackupManager.importLegacy(mockFile, statusCallback);

      expect(global.chrome.storage.local.set).toHaveBeenCalled();
      const setCall = global.chrome.storage.local.set.mock.calls[0][0];
      expect(setCall.fsrsCards.length).toBe(1);
      expect(setCall.theme).toBe('light');
      expect(statusCallback).toHaveBeenCalledWith("Legacy backup imported successfully!");
    });
  });
});
