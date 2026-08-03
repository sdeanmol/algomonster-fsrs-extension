// Mock for Chrome Extension APIs
const listeners = {
  onMessage: [],
  onAlarm: [],
  onStorageChanged: [],
  onNotificationClicked: [],
  onNotificationClosed: []
};

global.mockStorage = {};
global.mockSyncStorage = {};

// Mock for BackupManager ReadableStream
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource) {
      this.underlyingSource = underlyingSource;
    }
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

const createStorageAreaMock = (storageStore) => ({
  get: jest.fn((keys, callback) => {
    const fetchResult = () => {
      if (keys === null || keys === undefined) {
        return { ...storageStore };
      } else if (typeof keys === 'string') {
        return { [keys]: storageStore[keys] };
      } else if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(k => result[k] = storageStore[k]);
        return result;
      } else if (typeof keys === 'object') {
        const result = { ...keys };
        Object.keys(keys).forEach(k => {
          if (storageStore[k] !== undefined) result[k] = storageStore[k];
        });
        return result;
      } else {
        return { ...storageStore };
      }
    };
    const res = fetchResult();
    if (callback) {
      callback(res);
    }
    return Promise.resolve(res);
  }),
  set: jest.fn((data, callback) => {
    Object.assign(storageStore, data);
    if (callback) callback();
    return Promise.resolve();
  }),
  remove: jest.fn((keys, callback) => {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    keysArray.forEach(k => delete storageStore[k]);
    if (callback) callback();
    return Promise.resolve();
  }),
  clear: jest.fn(callback => {
    for (const key in storageStore) {
      delete storageStore[key];
    }
    if (callback) callback();
    return Promise.resolve();
  })
});

const mockLocal = createStorageAreaMock(global.mockStorage);
const mockSync = createStorageAreaMock(global.mockSyncStorage);

global.chrome = {
  storage: {
    local: mockLocal,
    sync: mockSync,
    onChanged: {
      addListener: jest.fn((fn) => { listeners.onStorageChanged.push(fn); }),
      removeListener: jest.fn((fn) => {
        const idx = listeners.onStorageChanged.indexOf(fn);
        if (idx !== -1) listeners.onStorageChanged.splice(idx, 1);
      })
    }
  },
  runtime: {
    id: 'mock-extension-id',
    lastError: undefined,
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),
    onMessage: {
      addListener: jest.fn((fn) => { listeners.onMessage.push(fn); }),
      removeListener: jest.fn((fn) => {
        const idx = listeners.onMessage.indexOf(fn);
        if (idx !== -1) listeners.onMessage.splice(idx, 1);
      }),
      hasListener: jest.fn((fn) => listeners.onMessage.includes(fn))
    },
    getURL: jest.fn(path => `chrome-extension://mock-id/${path}`),
    connect: jest.fn(() => ({
      onMessage: { addListener: jest.fn() },
      postMessage: jest.fn(),
      disconnect: jest.fn()
    }))
  },
  tabs: {
    query: jest.fn((query, callback) => {
      const tabs = [{ id: 1, active: true, currentWindow: true, url: 'https://algomonster.com/problems/two_sum' }];
      if (callback) callback(tabs);
      return Promise.resolve(tabs);
    }),
    sendMessage: jest.fn((tabId, msg, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),
    create: jest.fn((options, callback) => {
      const tab = { id: 2, ...options };
      if (callback) callback(tab);
      return Promise.resolve(tab);
    }),
    update: jest.fn((tabId, updateProps, callback) => {
      const tab = { id: tabId, ...updateProps };
      if (callback) callback(tab);
      return Promise.resolve(tab);
    }),
    remove: jest.fn((tabId, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    onUpdated: { addListener: jest.fn(), removeListener: jest.fn() },
    onActivated: { addListener: jest.fn(), removeListener: jest.fn() }
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setTitle: jest.fn()
  },
  browserAction: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setTitle: jest.fn()
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn((name, callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    clearAll: jest.fn((callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    get: jest.fn((name, callback) => {
      if (callback) callback(null);
      return Promise.resolve(null);
    }),
    getAll: jest.fn((callback) => {
      if (callback) callback([]);
      return Promise.resolve([]);
    }),
    onAlarm: {
      addListener: jest.fn((fn) => { listeners.onAlarm.push(fn); }),
      removeListener: jest.fn((fn) => {
        const idx = listeners.onAlarm.indexOf(fn);
        if (idx !== -1) listeners.onAlarm.splice(idx, 1);
      })
    }
  },
  notifications: {
    create: jest.fn((id, options, callback) => {
      const notifId = id || 'notification-id';
      if (callback) callback(notifId);
      return Promise.resolve(notifId);
    }),
    clear: jest.fn((id, callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    update: jest.fn((id, options, callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    onClicked: {
      addListener: jest.fn((fn) => { listeners.onNotificationClicked.push(fn); })
    },
    onClosed: {
      addListener: jest.fn((fn) => { listeners.onNotificationClosed.push(fn); })
    }
  },
  // Helpers for tests
  __triggerMessage: (message, sender = {}, sendResponse = () => {}) => {
    listeners.onMessage.forEach(fn => fn(message, sender, sendResponse));
  },
  __triggerAlarm: (alarm) => {
    listeners.onAlarm.forEach(fn => fn(alarm));
  },
  __triggerStorageChange: (changes, areaName = 'local') => {
    listeners.onStorageChanged.forEach(fn => fn(changes, areaName));
  }
};

if (typeof beforeEach !== 'undefined') {
  beforeEach(() => {
    for (const key in global.mockStorage) {
      delete global.mockStorage[key];
    }
    for (const key in global.mockSyncStorage) {
      delete global.mockSyncStorage[key];
    }
    listeners.onMessage = [];
    listeners.onAlarm = [];
    listeners.onStorageChanged = [];
    listeners.onNotificationClicked = [];
    listeners.onNotificationClosed = [];
    if (global.chrome && global.chrome.runtime) {
      global.chrome.runtime.lastError = undefined;
    }
    jest.clearAllMocks();
  });
}
