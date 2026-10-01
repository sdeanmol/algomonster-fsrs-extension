import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Notifier } from '../../../content/notifications';

describe('Notifier (Content Script Notifications)', () => {
  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="algo-fsrs-launcher" style="display: block;"></div>
      <div id="algo-fsrs-container" style="display: none;"></div>
    `;

    (chrome as any).runtime = {
      sendMessage: jest.fn().mockImplementation((msg: any, cb?: any) => {
        if (cb) cb({ success: true });
      }),
      lastError: undefined
    };

    (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    (window as any).AlgoRecall = {
      state: { currentTheme: 'dark' },
      orchestrator: {
        tracker: {
          startReview: jest.fn(),
          refreshWidgetState: jest.fn()
        }
      }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('showPageNotification', () => {
    it('creates custom floating review notification card in document body', () => {
      Notifier.showPageNotification('Review Due', 'You have 5 cards due for review!', 'review', 5);

      const notif = document.getElementById('algo-custom-notification-el');
      expect(notif).not.toBeNull();
      expect(notif?.innerHTML).toContain('Review Due');
      expect(notif?.innerHTML).toContain('Review Now');
      expect(notif?.innerHTML).toContain('Snooze (15m)');
    });

    it('creates alert notification card for non-review type and auto-dismisses after 6s', () => {
      Notifier.showPageNotification('Test Alert', 'This is a test notification message.', 'test');

      const notif = document.getElementById('algo-custom-notification-el');
      expect(notif).not.toBeNull();
      expect(notif?.innerHTML).toContain('Dismiss');

      // Advance timers to trigger auto-dismiss
      jest.advanceTimersByTime(6500);
      notif?.dispatchEvent(new Event('transitionend'));

      const dismissed = document.getElementById('algo-custom-notification-el');
      expect(dismissed).toBeNull();
    });

    it('removes existing notification element before creating a new one', () => {
      Notifier.showPageNotification('First Alert', 'First message', 'test');
      Notifier.showPageNotification('Second Alert', 'Second message', 'test');

      const notifs = document.querySelectorAll('#algo-custom-notification-el');
      expect(notifs.length).toBe(1);
    });

    it('triggers review action when clicking Review Now button', () => {
      Notifier.showPageNotification('Review Due', '5 cards due', 'review', 5);

      const reviewBtn = document.getElementById('algo-notif-btn-review');
      reviewBtn?.click();

      expect((window as any).AlgoRecall.orchestrator.tracker.startReview).toHaveBeenCalled();
    });

    it('triggers snooze action when clicking Snooze button', () => {
      Notifier.showPageNotification('Review Due', '5 cards due', 'review', 5);

      const snoozeBtn = document.getElementById('algo-notif-btn-snooze');
      snoozeBtn?.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'snooze_notification' }),
        expect.any(Function)
      );
    });

    it('dismisses notification when clicking close button', () => {
      Notifier.showPageNotification('Review Due', '5 cards due', 'review', 5);

      const closeBtn = document.getElementById('algo-notif-btn-close');
      const notif = document.getElementById('algo-custom-notification-el');
      closeBtn?.click();

      notif?.dispatchEvent(new Event('transitionend'));
      const removedNotif = document.getElementById('algo-custom-notification-el');
      expect(removedNotif).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles global access exception safely', () => {
      // Temporarily remove AlgoRecall to force the catch block
      const originalAlgoRecall = (window as any).AlgoRecall;
      delete (window as any).AlgoRecall;
      
      // Inject an error getter to force exception
      Object.defineProperty(window, 'AlgoRecall', {
        get: () => { throw new Error('Global access denied'); },
        configurable: true
      });

      // Should not throw
      expect(() => {
        Notifier.showPageNotification('Test', 'test', 'test');
      }).not.toThrow();
      
      // Restore
      Object.defineProperty(window, 'AlgoRecall', {
        value: originalAlgoRecall,
        configurable: true,
        writable: true
      });
    });

    it('handles chrome.runtime.lastError in snooze callback safely', () => {
      (chrome as any).runtime.sendMessage = jest.fn().mockImplementation((msg: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Network error' };
        if (cb) cb({ success: false });
        (chrome.runtime as any).lastError = undefined;
      });

      Notifier.showPageNotification('Review Due', '5 cards', 'review', 5);
      
      const snoozeBtn = document.getElementById('algo-notif-btn-snooze');
      expect(() => snoozeBtn?.click()).not.toThrow();
    });

    it('handles transitionend removal errors safely', () => {
      Notifier.showPageNotification('Test', 'Test', 'test');
      const notif = document.getElementById('algo-custom-notification-el');
      
      // Make remove throw
      if (notif) {
        notif.remove = jest.fn().mockImplementation(() => {
          throw new Error('Already removed');
        });
      }
      
      const closeBtn = document.getElementById('algo-notif-btn-close');
      closeBtn?.click();
      
      expect(() => {
        notif?.dispatchEvent(new Event('transitionend'));
      }).not.toThrow();
    });

    it('handles orchestrator absence when review is clicked safely', () => {
      // Remove orchestrator
      delete (window as any).AlgoRecall.orchestrator;
      
      Notifier.showPageNotification('Review', 'Review', 'review', 5);
      
      const reviewBtn = document.getElementById('algo-notif-btn-review');
      expect(() => reviewBtn?.click()).not.toThrow();
    });

    it('safely handles requestAnimationFrame failure', () => {
      (window as any).requestAnimationFrame = jest.fn().mockImplementation((cb: any) => {
        // mock classList.add to throw
        const notif = document.getElementById('algo-custom-notification-el');
        if (notif) {
           notif.classList.add = () => { throw new Error('DOM Exception'); };
        }
        cb(0);
      });
      
      expect(() => Notifier.showPageNotification('Test', 'Test', 'test')).not.toThrow();
    });

    it('safely handles dismissNotification outer transition listener failure', () => {
      Notifier.showPageNotification('Test', 'Test', 'test');
      const notif = document.getElementById('algo-custom-notification-el');
      if (notif) {
         notif.classList.remove = () => { throw new Error('Transition setup broke'); };
      }
      
      const closeBtn = document.getElementById('algo-notif-btn-close');
      expect(() => closeBtn?.click()).not.toThrow();
    });

    it('safely handles snooze context invalidation error', () => {
      Notifier.showPageNotification('Review', 'Review', 'review', 5);
      
      (chrome as any).runtime.sendMessage = () => { throw new Error('Extension context invalidated.'); };
      
      const snoozeBtn = document.getElementById('algo-notif-btn-snooze');
      expect(() => snoozeBtn?.click()).not.toThrow();
    });

    it('safely handles snooze callback lastError', () => {
      (chrome as any).runtime.sendMessage = jest.fn((msg: any, cb: any) => {
         (chrome as any).runtime.lastError = { message: 'Snooze failed' };
         if (cb) cb();
      });
      
      Notifier.showPageNotification('Review', 'Review', 'review', 5);
      
      const snoozeBtn = document.getElementById('algo-notif-btn-snooze');
      expect(() => snoozeBtn?.click()).not.toThrow();
      
      delete (chrome.runtime as any).lastError;
    });

    it('safely handles dismiss action failure', () => {
      Notifier.showPageNotification('Test', 'Test', 'test');
      const dismissBtn = document.getElementById('algo-notif-btn-dismiss');
      // trigger error in the dismiss handler itself by clearing the timeout
      jest.spyOn(global, 'clearTimeout').mockImplementationOnce(() => { throw new Error('Clear timeout broke'); });
      expect(() => dismissBtn?.click()).not.toThrow();
    });
  });
});
