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
});
