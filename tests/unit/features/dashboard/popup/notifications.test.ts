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
          quietHoursEnabled: false,
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
    it('binds toggle change listeners and saves updated settings', async () => {
      await component.load();
      component.bindEvents();

      const notifToggle = document.getElementById('toggle-notifications') as HTMLInputElement;
      notifToggle.checked = false;
      notifToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('requests notification permission on enableBtn click', async () => {
      await component.load();
      component.bindEvents();

      const enableBtn = document.getElementById('enable-notifications-btn');
      enableBtn?.click();
      await Promise.resolve();

      expect(Notification.requestPermission).toHaveBeenCalled();
    });

    it('handles test notification button click and sends message to background', async () => {
      await component.load();
      component.bindEvents();

      const testBtn = document.getElementById('test-notification-btn');
      testBtn?.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'test_notification' }),
        expect.any(Function)
      );
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Test notification sent!');
    });

    it('handles test summary notification button click', async () => {
      await component.load();
      component.bindEvents();

      const testSummaryBtn = document.getElementById('test-summary-notification-btn');
      testSummaryBtn?.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'test_summary_notification' }),
        expect.any(Function)
      );
    });

    it('handles weekly digest toggle changes', async () => {
      await component.load();
      component.bindEvents();

      const weeklyToggle = document.getElementById('toggle-weekly-digest') as HTMLInputElement;
      weeklyToggle.checked = false;
      weeklyToggle.dispatchEvent(new Event('change'));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'toggle_weekly_summary', enabled: false })
      );
    });
  });
});
