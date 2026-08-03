import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlgoRecallOrchestrator } from '../../../content/content';
import { Logger } from '@common/logger';

describe('AlgoRecallOrchestrator', () => {
  let orchestrator: AlgoRecallOrchestrator;

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="algo-fsrs-launcher" style="display: none;">Launcher</div>
      <div id="algo-fsrs-container" style="display: none;">Container</div>
      <div id="algo-highlight-tooltip" style="display: none;">Tooltip</div>
      <span id="fsrs-current-tags"></span>
      <div class="algo-custom-notification">Notif</div>
    `;

    delete (window as any).location;
    (window as any).location = new URL('https://leetcode.com/problems/two-sum');

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      if (cb) {
        cb({
          whitelistedWebsites: [{ domain: 'leetcode.com' }],
          fsrsCards: [{ id: 'c1', due: Date.now() }],
          theme: 'light',
          chromeSettings: { showMarkerPopup: true }
        });
      }
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
    });

    orchestrator = new AlgoRecallOrchestrator();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initialization and Domain Whitelisting', () => {
    it('initializes components and binds events on whitelisted domain', async () => {
      await orchestrator.init();
      expect(chrome.storage.local.get).toHaveBeenCalled();
      expect(orchestrator.state.currentTheme).toBe('light');
    });

    it('exits early on non-whitelisted domain', async () => {
      delete (window as any).location;
      (window as any).location = new URL('https://google.com/search');

      const createUISpy = jest.spyOn(orchestrator.tracker, 'createUI');
      await orchestrator.init();

      expect(createUISpy).not.toHaveBeenCalled();
    });

    it('initializes default palettes if none exist', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) {
          cb({
            whitelistedWebsites: [{ domain: 'leetcode.com' }],
            chromeSettings: { palettes: [] }
          });
        }
      });

      await orchestrator.init();
      expect(orchestrator.state.chromeSettings?.palettes?.length).toBe(5);
    });

    it('handles chrome.runtime.lastError in init storage callback', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Init storage failure' };
        if (cb) cb({});
        delete (chrome.runtime as any).lastError;
      });

      await expect(orchestrator.init()).resolves.not.toThrow();
    });

    it('handles inner exception during init storage processing', async () => {
      jest.spyOn(orchestrator.tracker, 'createUI').mockImplementation(() => {
        throw new Error('Tracker UI creation error');
      });

      await expect(orchestrator.init()).resolves.not.toThrow();
    });

    it('loads fsrsGlobalParams, marks, bookmarks, and pagecontents', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) {
          cb({
            whitelistedWebsites: [{ domain: 'leetcode.com' }],
            fsrsGlobalParams: { w: [0.1, 0.2], decay: 0.5, factor: 0.9, requestRetention: 0.85 },
            marks: [{ id: 'm1' }],
            bookmarks: [{ id: 'b1' }],
            pagecontents: [{ id: 'p1' }],
            fsrsTopicWeights: { array: [1, 2] }
          });
        }
      });

      await orchestrator.init();
      expect(orchestrator.state.marks).toEqual([{ id: 'm1' }]);
      expect(orchestrator.state.bookmarks).toEqual([{ id: 'b1' }]);
    });
  });

  describe('Event Listeners & Interaction Handlers', () => {
    it('triggers UI update on anchor or button element clicks', async () => {
      await orchestrator.init();

      const button = document.createElement('button');
      document.body.appendChild(button);

      button.click();

      jest.advanceTimersByTime(50);
      jest.advanceTimersByTime(400);

      expect(orchestrator.state.lastCheckedUrl).toBe('https://leetcode.com/problems/two-sum');
    });

    it('handles errors in click update timeouts gracefully', async () => {
      await orchestrator.init();
      jest.spyOn(orchestrator, 'triggerAggressiveUIUpdate').mockImplementation(() => {
        throw new Error('Aggressive UI error');
      });

      const button = document.createElement('button');
      document.body.appendChild(button);

      button.click();

      expect(() => {
        jest.advanceTimersByTime(50);
        jest.advanceTimersByTime(400);
      }).not.toThrow();
    });

    it('handles chrome.storage.onChanged updates for all key types', () => {
      orchestrator.handleStorageChanged(
        {
          chromeSettings: { newValue: { showMarkerPopup: true } },
          fsrsCards: { newValue: [{ id: 'c2' }] },
          fsrsTopicWeights: { newValue: { dp: [1] } },
          marks: { newValue: ['mark1'] },
          bookmarks: { newValue: ['bm1'] },
          pagecontents: { newValue: ['pc1'] },
          theme: { newValue: 'dark' },
          fsrsGlobalParams: { newValue: { w: [0.3], decay: 0.4, factor: 0.8, requestRetention: 0.9 } },
          approachDrafts: { newValue: {} }
        },
        'local'
      );

      expect(orchestrator.state.currentTheme).toBe('dark');
      expect(orchestrator.state.cards).toEqual([{ id: 'c2' }]);
    });

    it('renders tooltip when active text selection exists on storage change', () => {
      orchestrator.state.chromeSettings.showMarkerPopup = true;

      const mockRange = {
        getClientRects: () => [{ right: 100, bottom: 200 }],
        getBoundingClientRect: () => ({ right: 100, bottom: 200, width: 50, height: 20 })
      };
      const mockSelection = {
        isCollapsed: false,
        toString: () => 'selected text',
        getRangeAt: () => mockRange
      };

      const origGetSelection = window.getSelection;
      window.getSelection = () => mockSelection as any;

      const tooltip = document.getElementById('algo-highlight-tooltip');
      if (tooltip) tooltip.style.display = 'none';

      orchestrator.handleStorageChanged(
        {
          chromeSettings: { newValue: { showMarkerPopup: true } }
        },
        'local'
      );

      expect(tooltip?.style.display).toBe('flex');
      window.getSelection = origGetSelection;
    });

    it('removes or re-injects UI elements when whitelistedWebsites storage changes', () => {
      orchestrator.handleStorageChanged(
        {
          whitelistedWebsites: { newValue: [{ domain: 'example.com' }] }
        },
        'local'
      );

      orchestrator.handleStorageChanged(
        {
          whitelistedWebsites: { newValue: [{ domain: 'leetcode.com' }] }
        },
        'local'
      );
    });

    it('handles exception in handleStorageChanged gracefully', () => {
      expect(() => {
        orchestrator.handleStorageChanged(null as any, 'local');
      }).not.toThrow();
    });

    it('handles runtime message spa_url_changed', () => {
      const sendResponse = jest.fn();
      orchestrator.handleMessage({ action: 'spa_url_changed' }, {} as any, sendResponse);

      jest.advanceTimersByTime(50);
      expect(orchestrator.state.lastCheckedUrl).toBe('https://leetcode.com/problems/two-sum');
    });

    it('handles runtime message show_custom_notification', () => {
      const sendResponse = jest.fn();

      jest.spyOn(orchestrator.notifier, 'showPageNotification').mockImplementation(() => {});

      orchestrator.handleMessage(
        { action: 'show_custom_notification', title: 'Test', message: 'Hello', type: 'info' },
        {} as any,
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('handles notification display errors gracefully in handleMessage', () => {
      const sendResponse = jest.fn();

      jest.spyOn(orchestrator.notifier, 'showPageNotification').mockImplementation(() => {
        throw new Error('Notification display error');
      });

      orchestrator.handleMessage(
        { action: 'show_custom_notification', title: 'Test', message: 'Hello' },
        {} as any,
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Notification display error' });
    });

    it('handles top-level exception in handleMessage gracefully', () => {
      const sendResponse = jest.fn();
      const origDebug = Logger.debug;
      Logger.debug = () => { throw new Error('Logger error'); };

      orchestrator.handleMessage({ action: 'spa_url_changed' }, {} as any, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Logger error' });

      Logger.debug = origDebug;
    });
  });

  describe('UI Updates, Theme Application, Observer & Global Errors', () => {
    it('applies light-theme class to extension UI elements', () => {
      orchestrator.state.currentTheme = 'light';
      orchestrator.applyThemeClass();

      const launcher = document.getElementById('algo-fsrs-launcher');
      expect(launcher?.classList.contains('light-theme')).toBe(true);
    });

    it('applies dark-theme class to extension UI elements', () => {
      orchestrator.state.currentTheme = 'dark';
      orchestrator.applyThemeClass();

      const launcher = document.getElementById('algo-fsrs-launcher');
      expect(launcher?.classList.contains('light-theme')).toBe(false);
    });

    it('sets up mutation observer and re-injects missing UI elements on mutation', () => {
      orchestrator.setupMutationObserver();

      const launcher = document.getElementById('algo-fsrs-launcher');
      if (launcher) launcher.remove();

      const tooltip = document.getElementById('algo-highlight-tooltip');
      if (tooltip) tooltip.remove();

      delete (window as any).location;
      (window as any).location = new URL('https://leetcode.com/problems/three-sum');

      document.body.appendChild(document.createElement('div'));
      jest.advanceTimersByTime(100);
    });

    it('handles error inside mutation observer callback gracefully', () => {
      orchestrator.setupMutationObserver();

      jest.spyOn(orchestrator.highlighter, 'applyHighlightsForCurrentPage').mockImplementation(() => {
        throw new Error('Mutation highlight error');
      });

      document.body.appendChild(document.createElement('div'));
      expect(() => jest.advanceTimersByTime(100)).not.toThrow();
    });

    it('re-injects tracker UI in triggerAggressiveUIUpdate if container is missing', () => {
      const container = document.getElementById('algo-fsrs-container');
      if (container) container.remove();

      const createUISpy = jest.spyOn(orchestrator.tracker, 'createUI');
      orchestrator.triggerAggressiveUIUpdate();

      expect(createUISpy).toHaveBeenCalled();
    });

    it('re-injects UI on whitelistedWebsites storage change if overlay is missing', () => {
      const container = document.getElementById('algo-fsrs-container');
      if (container) container.remove();

      delete (window as any).location;
      (window as any).location = new URL('https://leetcode.com/problems/two-sum');

      orchestrator.handleStorageChanged(
        {
          whitelistedWebsites: { newValue: [{ domain: 'leetcode.com' }] }
        },
        'local'
      );
    });

    it('handles exceptions in applyThemeClass gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => orchestrator.applyThemeClass()).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('handles non-whitelisted domain storage change update', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://leetcode.com/problems/two-sum');

      (orchestrator.tracker as any).removeUI = jest.fn();

      orchestrator.handleStorageChanged(
        {
          whitelistedWebsites: { newValue: [{ domain: 'otherdomain.com' }] }
        },
        'local'
      );

      expect((orchestrator.tracker as any).removeUI).toHaveBeenCalled();
    });

    it('triggers DOMContentLoaded and readyState event handlers', () => {
      expect(() => {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }).not.toThrow();
    });

    it('handles exceptions in bindEvents, setupMutationObserver, and triggerAggressiveUIUpdate', () => {
      const origAddEventListener = document.addEventListener;
      document.addEventListener = () => { throw new Error('AddEventListener error'); };

      expect(() => orchestrator.bindEvents()).not.toThrow();

      document.addEventListener = origAddEventListener;

      const origMO = window.MutationObserver;
      (window as any).MutationObserver = function () {
        throw new Error('MO error');
      };

      expect(() => orchestrator.setupMutationObserver()).not.toThrow();

      (window as any).MutationObserver = origMO;

      jest.spyOn(orchestrator.highlighter, 'applyHighlightsForCurrentPage').mockImplementation(() => {
        throw new Error('Trigger UI update error');
      });

      expect(() => orchestrator.triggerAggressiveUIUpdate()).not.toThrow();
    });

    it('handles window error and unhandledrejection events', () => {
      expect(() => {
        const errorEvent = new Event('error') as any;
        errorEvent.filename = chrome.runtime.id + '/content.js';
        errorEvent.message = 'Script error';
        window.dispatchEvent(errorEvent);
      }).not.toThrow();

      expect(() => {
        const rejectionEvent = new Event('unhandledrejection') as any;
        rejectionEvent.reason = 'Unhandled promise failure';
        window.dispatchEvent(rejectionEvent);
      }).not.toThrow();
    });
  });
});


