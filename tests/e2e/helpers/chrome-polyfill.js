/**
 * @file tests/e2e/helpers/chrome-polyfill.js
 * @description Shared Chrome Extension API mock/polyfill for Playwright E2E tests.
 * Provides an in-memory storage implementation with change listeners, runtime stubs,
 * alarms tracking, notifications spy, and permissions mock.
 *
 * Usage in spec files:
 *   const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
 *   await page.addInitScript(injectChromePolyfill, initialStorageData);
 */

/**
 * Injects a comprehensive Chrome Extension API polyfill into the browser page context.
 * Must be passed as a serialisable function to `page.addInitScript()`.
 *
 * @param {Object} initialData - Initial key-value pairs seeded into chrome.storage.local.
 */
function injectChromePolyfill(initialData) {
  const store = JSON.parse(JSON.stringify(initialData || {}));
  const changeListeners = [];
  const registeredAlarms = {};
  const createdNotifications = [];
  const sentMessages = [];

  window.__e2eStore = store;
  window.__e2eSentMessages = sentMessages;
  window.__e2eAlarms = registeredAlarms;
  window.__e2eNotifications = createdNotifications;

  window.chrome = window.chrome || {};

  // --- chrome.storage.local ---
  window.chrome.storage = {
    local: {
      get: (keys, cb) => {
        let res = {};
        if (keys === null || keys === undefined) {
          res = { ...store };
        } else if (Array.isArray(keys)) {
          keys.forEach(k => { if (k in store) res[k] = store[k]; });
        } else if (typeof keys === 'string') {
          if (keys in store) res[keys] = store[keys];
        } else if (typeof keys === 'object') {
          // Keys with defaults
          Object.keys(keys).forEach(k => {
            res[k] = k in store ? store[k] : keys[k];
          });
        }
        if (cb) cb(res);
        return Promise.resolve(res);
      },
      set: (items, cb) => {
        const changes = {};
        Object.keys(items).forEach(k => {
          changes[k] = { oldValue: store[k], newValue: items[k] };
          store[k] = items[k];
        });
        if (cb) cb();
        changeListeners.forEach(listener => {
          try { listener(changes, 'local'); } catch { /* noop */ }
        });
        return Promise.resolve();
      },
      remove: (keys, cb) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => delete store[k]);
        if (cb) cb();
        return Promise.resolve();
      },
      clear: (cb) => {
        Object.keys(store).forEach(k => delete store[k]);
        if (cb) cb();
        return Promise.resolve();
      }
    },
    onChanged: {
      addListener: (fn) => changeListeners.push(fn),
      removeListener: (fn) => {
        const idx = changeListeners.indexOf(fn);
        if (idx >= 0) changeListeners.splice(idx, 1);
      }
    }
  };

  // --- chrome.runtime ---
  const messageListeners = [];
  window.chrome.runtime = {
    id: 'test-extension-id',
    lastError: null,
    getURL: (p) => p,
    sendMessage: (msg, cb) => {
      sentMessages.push(msg);
      if (cb) cb({ success: true });
      return Promise.resolve({ success: true });
    },
    onMessage: {
      addListener: (fn) => messageListeners.push(fn),
      removeListener: (fn) => {
        const idx = messageListeners.indexOf(fn);
        if (idx >= 0) messageListeners.splice(idx, 1);
      }
    },
    onInstalled: {
      addListener: () => {}
    }
  };

  // --- chrome.tabs ---
  window.chrome.tabs = {
    query: (opts, cb) => {
      const tabs = [{ id: 1, url: window.location.href, active: true }];
      if (cb) cb(tabs);
      return Promise.resolve(tabs);
    },
    sendMessage: (tabId, msg, cb) => {
      sentMessages.push({ tabId, ...msg });
      if (cb) cb();
      return Promise.resolve();
    },
    create: (opts, cb) => {
      const tab = { id: 2, ...opts };
      if (cb) cb(tab);
      return Promise.resolve(tab);
    }
  };

  // --- chrome.alarms ---
  window.chrome.alarms = {
    create: (name, opts) => {
      registeredAlarms[name] = opts;
    },
    clear: (name, cb) => {
      delete registeredAlarms[name];
      if (cb) cb(true);
      return Promise.resolve(true);
    },
    getAll: (cb) => {
      const list = Object.entries(registeredAlarms).map(([name, opts]) => ({ name, ...opts }));
      if (cb) cb(list);
      return Promise.resolve(list);
    },
    onAlarm: {
      addListener: () => {}
    }
  };

  // --- chrome.notifications ---
  window.chrome.notifications = {
    create: (id, opts, cb) => {
      createdNotifications.push({ id, ...opts });
      if (cb) cb(id);
    },
    clear: (id, cb) => {
      if (cb) cb(true);
    },
    onClicked: {
      addListener: () => {}
    }
  };

  // --- chrome.action (badge) ---
  window.chrome.action = {
    setBadgeText: () => {},
    setBadgeBackgroundColor: () => {},
    setTitle: () => {}
  };

  // --- chrome.webNavigation ---
  window.chrome.webNavigation = {
    onHistoryStateUpdated: {
      addListener: () => {}
    }
  };

  // --- chrome.permissions ---
  window.chrome.permissions = {
    request: (perm, cb) => {
      if (cb) cb(true);
      return Promise.resolve(true);
    },
    contains: (perm, cb) => {
      if (cb) cb(true);
      return Promise.resolve(true);
    }
  };

  // --- chrome.downloads ---
  window.chrome.downloads = {
    download: (opts, cb) => {
      if (cb) cb(1);
    }
  };

  // --- Expose helper to simulate incoming messages ---
  window.__e2eSimulateMessage = (msg) => {
    messageListeners.forEach(fn => {
      try { fn(msg, { tab: { id: 1 } }, () => {}); } catch { /* noop */ }
    });
  };
}

module.exports = { injectChromePolyfill };
