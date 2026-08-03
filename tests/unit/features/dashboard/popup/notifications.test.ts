import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NotificationsComponent } from '../../../../../features/dashboard/popup/notifications';
import { DashboardCoordinator } from '../../../../../features/dashboard/popup/DashboardComponent';

describe('NotificationsComponent (Popup)', () => {
  let component: NotificationsComponent;
  let mockCoordinator: DashboardCoordinator;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;

    document.body.innerHTML = `
      <div id="permission-warning-banner" class="hide-panel">
        <span></span>
        <button id="enable-notifications-btn">Enable</button>
      </div>

      <input id="toggle-notifications" type="checkbox" />
      <select id="notification-interval">
        <option value="60">1 Hour</option>
        <option value="custom">Custom</option>
      </select>
      <div id="custom-interval-container" class="hide-panel">
        <input id="custom-interval-input" value="" />
      </div>

      <input id="toggle-sticky-notification" type="checkbox" />
      <input id="toggle-quiet-hours" type="checkbox" />
      <div id="quiet-hours-container" class="hide-panel">
        <input id="quiet-hours-start" value="22:00" />
        <input id="quiet-hours-end" value="07:00" />
      </div>

      <button id="test-notification-btn">Test</button>
      <button id="test-summary-notification-btn">Test Summary</button>
      <input id="toggle-weekly-digest" type="checkbox" />
    `;

    mockCoordinator = {
      showStatus: jest.fn()
    };

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        notificationSettings: {
          enabled: true,
          frequency: '60',
          requireInteraction: true,
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00'
        },
        weeklySummaryEnabled: true
      };
      if (typeof cb === 'function') cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    });

    (chrome as any).runtime = {
      sendMessage: jest.fn().mockImplementation((msg: any, cb?: any) => {
        if (cb) cb({ success: true });
      }),
      lastError: undefined
    };

    (global as any).Notification = {
      permission: 'granted',
      requestPermission: jest.fn().mockImplementation(() => Promise.resolve('granted'))
    };

    component = new NotificationsComponent(mockCoordinator);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('load and checkPermissions', () => {
    it('loads notification settings and checks permission status', async () => {
      await component.load();

      const notifToggle = document.getElementById('toggle-notifications') as HTMLInputElement;
      expect(notifToggle.checked).toBe(true);

      const warningBanner = document.getElementById('permission-warning-banner');
      expect(warningBanner?.classList.contains('hide-panel')).toBe(true);
    });

    it('shows warning banner when Notification.permission is not granted', () => {
      (global as any).Notification.permission = 'default';
      component.checkPermissions();

      const warningBanner = document.getElementById('permission-warning-banner');
      expect(warningBanner?.classList.contains('hide-panel')).toBe(false);

      (global as any).Notification.permission = 'denied';
      component.checkPermissions();
      const enableBtn = document.getElementById('enable-notifications-btn');
      expect(enableBtn?.style.display).toBe('none');
    });

    it('returns early from checkPermissions if warningBanner is missing', () => {
      document.getElementById('permission-warning-banner')?.remove();
      expect(() => component.checkPermissions()).not.toThrow();
    });

    it('handles load exception gracefully', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.reject(new Error('Storage load failure'));
      });

      await expect(component.load()).resolves.not.toThrow();
    });
  });

  describe('loadSettings and UI input syncing', () => {
    it('shows custom interval container when frequency is custom value', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        const result = {
          notificationSettings: {
            enabled: true,
            frequency: '45',
            requireInteraction: true
          }
        };
        if (cb) cb(result);
        return Promise.resolve(result);
      });

      await component.load();

      const notifInterval = document.getElementById('notification-interval') as HTMLSelectElement;
      expect(notifInterval.value).toBe('custom');
      const customInput = document.getElementById('custom-interval-input') as HTMLInputElement;
      expect(customInput.value).toBe('45');
    });
  });

  describe('bindEvents and test notification actions', () => {
    it('binds toggle change listeners and saves updated settings for quiet hours and custom intervals', async () => {
      await component.load();
      component.bindEvents();

      const notifInterval = document.getElementById('notification-interval') as HTMLSelectElement;
      const customInput = document.getElementById('custom-interval-input') as HTMLInputElement;
      const stickyToggle = document.getElementById('toggle-sticky-notification') as HTMLInputElement;
      const quietToggle = document.getElementById('toggle-quiet-hours') as HTMLInputElement;
      const quietStart = document.getElementById('quiet-hours-start') as HTMLInputElement;
      const quietEnd = document.getElementById('quiet-hours-end') as HTMLInputElement;

      notifInterval.value = 'custom';
      notifInterval.dispatchEvent(new Event('change'));
      customInput.value = '90';
      customInput.dispatchEvent(new Event('input'));

      stickyToggle.checked = false;
      stickyToggle.dispatchEvent(new Event('change'));

      quietToggle.checked = true;
      quietToggle.dispatchEvent(new Event('change'));

      quietStart.value = '23:00';
      quietStart.dispatchEvent(new Event('change'));
      quietStart.dispatchEvent(new Event('input'));

      quietEnd.value = '08:00';
      quietEnd.dispatchEvent(new Event('change'));
      quietEnd.dispatchEvent(new Event('input'));

      await Promise.resolve();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('requests notification permission on enableBtn click and handles denied permission', async () => {
      (global as any).Notification.requestPermission = jest.fn().mockImplementation(() => Promise.resolve('denied'));

      await component.load();
      component.bindEvents();

      const enableBtn = document.getElementById('enable-notifications-btn');
      enableBtn?.click();
      await Promise.resolve();

      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Notifications were not allowed.');
    });

    it('handles test notification button click, responses, and lastError callbacks', async () => {
      await component.load();
      component.bindEvents();

      const testBtn = document.getElementById('test-notification-btn');

      // 1. Success response
      (chrome as any).runtime.sendMessage = jest.fn().mockImplementation((msg: any, cb: any) => {
        if (cb) cb({ success: true });
      });
      testBtn?.click();
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Test notification sent!');

      // 2. Failed response
      (chrome as any).runtime.sendMessage = jest.fn().mockImplementation((msg: any, cb: any) => {
        if (cb) cb({ success: false });
      });
      testBtn?.click();
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Failed to send test notification.');

      // 3. Runtime lastError
      (chrome as any).runtime.sendMessage = jest.fn().mockImplementation((msg: any, cb: any) => {
        (chrome.runtime as any).lastError = { message: 'Runtime test error' };
        if (cb) cb(undefined);
      });
      testBtn?.click();
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Error triggering notification.');
      delete (chrome.runtime as any).lastError;
    });

    it('handles test summary notification button click, responses, and lastError callbacks', async () => {
      await component.load();
      component.bindEvents();

      const testSummaryBtn = document.getElementById('test-summary-notification-btn');

      // 1. Success response
      (chrome as any).runtime.sendMessage = jest.fn().mockImplementation((msg: any, cb: any) => {
        if (cb) cb({ success: true });
      });
      testSummaryBtn?.click();
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Test weekly summary notification sent!');

      // 2. Failed response
      (chrome as any).runtime.sendMessage = jest.fn().mockImplementation((msg: any, cb: any) => {
        if (cb) cb({ success: false });
      });
      testSummaryBtn?.click();
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Failed to send test summary notification.');

      // 3. Runtime lastError
      (chrome as any).runtime.sendMessage = jest.fn().mockImplementation((msg: any, cb: any) => {
        (chrome.runtime as any).lastError = { message: 'Runtime summary error' };
        if (cb) cb(undefined);
      });
      testSummaryBtn?.click();
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Error triggering summary notification.');
      delete (chrome.runtime as any).lastError;
    });

    it('handles weekly digest toggle changes and storage errors', async () => {
      await component.load();
      component.bindEvents();

      const weeklyToggle = document.getElementById('toggle-weekly-digest') as HTMLInputElement;
      weeklyToggle.checked = false;

      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage save error' };
        if (cb) cb();
        return Promise.resolve();
      });

      weeklyToggle.dispatchEvent(new Event('change'));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'toggle_weekly_summary', enabled: false })
      );
      delete (chrome.runtime as any).lastError;
    });

    it('handles exceptions inside input and toggle change listeners', async () => {
      await component.load();
      component.bindEvents();

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Storage get error inside saveNotificationSettings');
      });

      const notifInterval = document.getElementById('notification-interval') as HTMLSelectElement;
      const notifToggle = document.getElementById('toggle-notifications') as HTMLInputElement;
      const stickyToggle = document.getElementById('toggle-sticky-notification') as HTMLInputElement;
      const quietToggle = document.getElementById('toggle-quiet-hours') as HTMLInputElement;
      const quietStart = document.getElementById('quiet-hours-start') as HTMLInputElement;
      const quietEnd = document.getElementById('quiet-hours-end') as HTMLInputElement;
      const customInput = document.getElementById('custom-interval-input') as HTMLInputElement;
      const testBtn = document.getElementById('test-notification-btn');
      const testSummaryBtn = document.getElementById('test-summary-notification-btn');
      const weeklyToggle = document.getElementById('toggle-weekly-digest') as HTMLInputElement;

      // Custom interval value fallback branch
      notifInterval.value = 'custom';
      customInput.value = '';
      expect(() => notifInterval.dispatchEvent(new Event('change'))).not.toThrow();

      // Non-custom interval hide-panel branch
      notifInterval.value = '60';
      expect(() => notifInterval.dispatchEvent(new Event('change'))).not.toThrow();

      expect(() => notifToggle.dispatchEvent(new Event('change'))).not.toThrow();
      expect(() => stickyToggle.dispatchEvent(new Event('change'))).not.toThrow();

      quietToggle.checked = false;
      expect(() => quietToggle.dispatchEvent(new Event('change'))).not.toThrow();

      expect(() => quietStart.dispatchEvent(new Event('change'))).not.toThrow();
      expect(() => quietEnd.dispatchEvent(new Event('change'))).not.toThrow();
      expect(() => customInput.dispatchEvent(new Event('input'))).not.toThrow();

      // Test response callback error catch block
      (chrome as any).runtime.sendMessage = jest.fn().mockImplementation((msg: any, cb: any) => {
        if (cb) cb({
          get success() { throw new Error('Response getter error'); }
        });
      });
      expect(() => testBtn?.click()).not.toThrow();
      expect(() => testSummaryBtn?.click()).not.toThrow();

      // Weekly digest change catch block
      (chrome.storage.local.set as jest.Mock).mockImplementation(() => {
        throw new Error('Storage set error');
      });
      expect(() => weeklyToggle.dispatchEvent(new Event('change'))).not.toThrow();
    });

    it('handles weekly digest storage get callback lastError and exception', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb: any) => {
        (chrome.runtime as any).lastError = { message: 'Get error' };
        if (cb) cb({});
        return Promise.resolve({});
      });

      await component.load();
      component.bindEvents();
      delete (chrome.runtime as any).lastError;

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb: any) => {
        if (cb) cb({
          get weeklySummaryEnabled() { throw new Error('Property error'); }
        });
        return Promise.resolve({});
      });

      expect(() => component.bindEvents()).not.toThrow();
    });

    it('handles DOM exceptions in bindEvents gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('DOM GEBI Error'); };

      expect(() => component.bindEvents()).not.toThrow();

      document.getElementById = origGEBI;
    });
  });
});
