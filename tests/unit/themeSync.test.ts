import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ThemeSync } from '../../features/common/theme-sync';

describe('ThemeSync', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    jest.clearAllMocks();
  });

  describe('applyTheme', () => {
    it('adds light-theme class when theme is "light"', () => {
      ThemeSync.applyTheme('light');
      expect(document.documentElement.classList.contains('light-theme')).toBe(true);
    });

    it('removes light-theme class when theme is "dark" or other', () => {
      document.documentElement.classList.add('light-theme');
      ThemeSync.applyTheme('dark');
      expect(document.documentElement.classList.contains('light-theme')).toBe(false);

      document.documentElement.classList.add('light-theme');
      ThemeSync.applyTheme('custom');
      expect(document.documentElement.classList.contains('light-theme')).toBe(false);
    });

    it('handles exceptions in applyTheme gracefully', () => {
      const origClassList = document.documentElement.classList;
      Object.defineProperty(document.documentElement, 'classList', {
        get() {
          throw new Error('DOM Error');
        },
        configurable: true
      });

      expect(() => ThemeSync.applyTheme('light')).not.toThrow();

      Object.defineProperty(document.documentElement, 'classList', {
        value: origClassList,
        configurable: true
      });
    });
  });

  describe('init', () => {
    it('fetches stored theme and listens for theme changes', () => {
      let storageCallback: ((result: any) => void) | undefined;
      let changeListener: ((changes: any, area: string) => void) | undefined;

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        storageCallback = cb;
      });

      (chrome.storage.onChanged.addListener as jest.Mock).mockImplementation((listener: any) => {
        changeListener = listener;
      });

      ThemeSync.init();

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['theme'], expect.any(Function));
      expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();

      if (storageCallback) {
        storageCallback({ theme: 'light' });
        expect(document.documentElement.classList.contains('light-theme')).toBe(true);
      }

      if (changeListener) {
        changeListener({ theme: { newValue: 'dark' } }, 'local');
        expect(document.documentElement.classList.contains('light-theme')).toBe(false);

        changeListener({ theme: { newValue: 'light' } }, 'local');
        expect(document.documentElement.classList.contains('light-theme')).toBe(true);

        changeListener({ theme: { newValue: 'dark' } }, 'sync');
        expect(document.documentElement.classList.contains('light-theme')).toBe(true);
      }
    });

    it('handles chrome.runtime.lastError in init callback', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage failure' };
        if (cb) cb({});
        delete (chrome.runtime as any).lastError;
      });

      expect(() => ThemeSync.init()).not.toThrow();
    });

    it('handles errors inside storage callbacks gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb(null);
      });

      expect(() => ThemeSync.init()).not.toThrow();
    });

    it('handles errors in storage listener callback', () => {
      let changeListener: ((changes: any, area: string) => void) | undefined;
      (chrome.storage.onChanged.addListener as jest.Mock).mockImplementation((listener: any) => {
        changeListener = listener;
      });

      ThemeSync.init();

      if (changeListener) {
        // Passing invalid changes object to trigger catch block
        expect(() => changeListener!(null as any, 'local')).not.toThrow();
      }
    });

    it('handles exceptions when chrome storage is not available or throws during init', () => {
      const origStorage = chrome.storage;
      Object.defineProperty(chrome, 'storage', {
        get() {
          throw new Error('Storage Access Error');
        },
        configurable: true
      });

      expect(() => ThemeSync.init()).not.toThrow();

      Object.defineProperty(chrome, 'storage', {
        value: origStorage,
        configurable: true
      });
    });
  });
});

