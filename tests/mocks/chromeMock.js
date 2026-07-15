// Mock for Chrome Extension APIs
const listeners = {};
global.mockStorage = {};

// Mock for BackupManager ReadableStream
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource) {
      this.underlyingSource = underlyingSource;
    }
    // Mock minimal stream methods used
    getReader() { return { read: async () => ({ done: true }) }; }
    pipeThrough(transformStream) { 
        return new global.ReadableStream(this.underlyingSource);
    }
  };
}
if (typeof global.WritableStream === 'undefined') {
  global.WritableStream = class WritableStream {
    constructor(underlyingSink) {
      this.underlyingSink = underlyingSink;
    }
    getWriter() { return { write: async () => {}, close: async () => {} }; }
  };
}

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const fetchResult = () => {
          if (typeof keys === 'string') {
            return { [keys]: global.mockStorage[keys] };
          } else if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(k => result[k] = global.mockStorage[k]);
            return result;
          } else {
            return global.mockStorage || {};
          }
        };
        if (callback) {
          callback(fetchResult());
        } else {
          return Promise.resolve(fetchResult());
        }
      }),
      set: jest.fn((data, callback) => {
        Object.assign(global.mockStorage, data);
        if (callback) callback();
        else return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (Array.isArray(keys)) {
          keys.forEach(k => delete global.mockStorage[k]);
        } else {
          delete global.mockStorage[keys];
        }
        if (callback) callback();
        else return Promise.resolve();
      }),
      clear: jest.fn(callback => {
        global.mockStorage = {};
        if (callback) callback();
        else return Promise.resolve();
      })
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn((fn) => {
        listeners.onMessage = fn;
      }),
      removeListener: jest.fn()
    },
    getURL: jest.fn(path => `chrome-extension://mock-id/${path}`)
  },
  tabs: {
    query: jest.fn((query, callback) => callback([{ id: 1, active: true, currentWindow: true }])),
    sendMessage: jest.fn(),
    create: jest.fn()
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  }
};

// Reset storage before each test
// Reset storage before each test if available
if (typeof beforeEach !== 'undefined') {
  beforeEach(() => {
    global.mockStorage = {};
    jest.clearAllMocks();
  });
}
