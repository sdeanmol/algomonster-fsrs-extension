import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { OnboardingWelcome } from '../../../../../features/common/welcome/welcome';

describe('OnboardingWelcome', () => {
  let welcome: OnboardingWelcome;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="status-toast" class="toast"></div>
      <span id="welcome-notif-status" class="status-badge"></span>
      <button id="welcome-enable-btn">Enable</button>

      <button id="welcome-prev-btn" class="invisible">Prev</button>
      <button id="welcome-next-btn">Next</button>

      <button id="set-dark-btn">Dark</button>
      <button id="set-light-btn">Light</button>

      <div id="step-1" class="step-card active">Step 1</div>
      <div id="step-2" class="step-card">Step 2</div>
      <div id="step-3" class="step-card">Step 3</div>

      <div id="dot-1" class="dot active"></div>
      <div id="dot-2" class="dot"></div>
      <div id="dot-3" class="dot"></div>
    `;

    jest.clearAllMocks();
    welcome = new OnboardingWelcome();
  });

  describe('init & step navigation', () => {
    it('initializes default state and binds event listeners', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ theme: 'dark' });
      });

      welcome.init();
      expect(welcome.currentStep).toBe(1);
      expect(chrome.storage.local.get).toHaveBeenCalled();
    });

    it('navigates through steps with next and prev buttons', () => {
      welcome.init();
      const prevBtn = document.getElementById('welcome-prev-btn') as HTMLElement;
      const nextBtn = document.getElementById('welcome-next-btn') as HTMLElement;

      // Click Next: Step 1 -> Step 2
      nextBtn.click();
      expect(welcome.currentStep).toBe(2);
      expect(document.getElementById('step-2')?.classList.contains('active')).toBe(true);
      expect(prevBtn.classList.contains('invisible')).toBe(false);

      // Click Next: Step 2 -> Step 3
      nextBtn.click();
      expect(welcome.currentStep).toBe(3);
      expect(nextBtn.textContent).toBe('Explore Guide');

      // Click Prev: Step 3 -> Step 2
      prevBtn.click();
      expect(welcome.currentStep).toBe(2);

      // Click Prev: Step 2 -> Step 1
      prevBtn.click();
      expect(welcome.currentStep).toBe(1);
      expect(prevBtn.classList.contains('invisible')).toBe(true);
    });

    it('redirects to help page when next is clicked on final step', () => {
      delete (window as any).location;
      (window as any).location = { href: '' };

      welcome.init();
      welcome.goToStep(3);

      const nextBtn = document.getElementById('welcome-next-btn') as HTMLElement;
      nextBtn.click();

      expect(window.location.href).toBe('../help/help.html');
    });
  });

  describe('theme preference', () => {
    it('switches to dark theme when dark theme button is clicked', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        if (cb) cb();
      });

      welcome.init();
      const darkBtn = document.getElementById('set-dark-btn') as HTMLElement;
      darkBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'dark' }, expect.any(Function));
      expect(darkBtn.classList.contains('active')).toBe(true);
    });

    it('switches to light theme when light theme button is clicked', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        if (cb) cb();
      });

      welcome.init();
      const lightBtn = document.getElementById('set-light-btn') as HTMLElement;
      lightBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'light' }, expect.any(Function));
      expect(lightBtn.classList.contains('active')).toBe(true);
    });

    it('handles chrome.runtime.lastError in theme set callback', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Theme save error' };
        if (cb) cb();
        delete (chrome.runtime as any).lastError;
      });

      welcome.init();
      const darkBtn = document.getElementById('set-dark-btn') as HTMLElement;
      expect(() => darkBtn.click()).not.toThrow();
    });
  });

  describe('notifications permission flow', () => {
    it('updates UI when notification permission is granted', () => {
      (global as any).Notification = {
        permission: 'granted',
        requestPermission: jest.fn().mockImplementation(() => Promise.resolve('granted'))
      };

      welcome.checkNotificationState();
      const badge = document.getElementById('welcome-notif-status');
      const btn = document.getElementById('welcome-enable-btn');
      expect(badge?.textContent).toBe('Active');
      expect(btn?.style.display).toBe('none');
    });

    it('requests notification permission on enable button click', async () => {
      const requestMock = jest.fn().mockImplementation(() => Promise.resolve('granted'));
      (global as any).Notification = {
        permission: 'default',
        requestPermission: requestMock
      };

      welcome.init();
      const btn = document.getElementById('welcome-enable-btn') as HTMLElement;
      btn.click();

      expect(requestMock).toHaveBeenCalled();
    });

    it('handles denied permission response gracefully', async () => {
      const requestMock = jest.fn().mockImplementation(() => Promise.resolve('denied'));
      (global as any).Notification = {
        permission: 'default',
        requestPermission: requestMock
      };

      welcome.init();
      const btn = document.getElementById('welcome-enable-btn') as HTMLElement;
      btn.click();
      await Promise.resolve();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toBe('Notifications were disabled.');
    });
  });

  describe('toast and error recovery', () => {
    it('shows and hides toast notification after timer', () => {
      jest.useFakeTimers();
      welcome.showToast('Test Toast');

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toBe('Test Toast');
      expect(toast?.className).toBe('toast show');

      jest.advanceTimersByTime(2100);
      expect(toast?.className).toBe('toast');
      jest.useRealTimers();
    });

    it('handles DOM exceptions in goToStep and checkNotificationState gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('DOM GEBI error'); };

      expect(() => welcome.goToStep(2)).not.toThrow();
      expect(() => welcome.checkNotificationState()).not.toThrow();
      expect(() => welcome.showToast('Error Toast')).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('handles errors in prev and next click event listeners', () => {
      welcome.init();
      jest.spyOn(welcome, 'goToStep').mockImplementation(() => {
        throw new Error('GoToStep error');
      });

      const prevBtn = document.getElementById('welcome-prev-btn') as HTMLElement;
      const nextBtn = document.getElementById('welcome-next-btn') as HTMLElement;

      welcome.currentStep = 2;
      expect(() => prevBtn.click()).not.toThrow();

      welcome.currentStep = 1;
      expect(() => nextBtn.click()).not.toThrow();
    });

    it('handles errors in dark and light theme click event listeners', () => {
      welcome.init();
      jest.spyOn(welcome, 'setThemePreference').mockImplementation(() => {
        throw new Error('SetTheme error');
      });

      const darkBtn = document.getElementById('set-dark-btn') as HTMLElement;
      const lightBtn = document.getElementById('set-light-btn') as HTMLElement;

      expect(() => darkBtn.click()).not.toThrow();
      expect(() => lightBtn.click()).not.toThrow();
    });

    it('handles Notification.requestPermission promise rejection', async () => {
      const requestMock = jest.fn().mockImplementation(() => Promise.reject(new Error('Permission Rejected')));
      (global as any).Notification = {
        permission: 'default',
        requestPermission: requestMock
      };

      welcome.init();
      const btn = document.getElementById('welcome-enable-btn') as HTMLElement;
      expect(() => btn.click()).not.toThrow();
    });

    it('handles chrome.runtime.lastError in syncThemePreference', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Theme fetch error' };
        if (cb) cb({});
        delete (chrome.runtime as any).lastError;
      });

      expect(() => welcome.syncThemePreference()).not.toThrow();
    });

    it('handles exceptions in Notification.requestPermission call and callback', () => {
      (global as any).Notification = {
        permission: 'default',
        requestPermission: () => { throw new Error('Permission call error'); }
      };

      welcome.init();
      const btn = document.getElementById('welcome-enable-btn') as HTMLElement;
      expect(() => btn.click()).not.toThrow();
    });

    it('handles exceptions in syncThemePreference and setThemePreference', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Storage get exception');
      });
      (chrome.storage.local.set as jest.Mock).mockImplementation(() => {
        throw new Error('Storage set exception');
      });

      expect(() => welcome.syncThemePreference()).not.toThrow();
      expect(() => welcome.setThemePreference('dark')).not.toThrow();
    });

    it('handles exceptions in setActiveThemeButton', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => welcome.setActiveThemeButton('dark')).not.toThrow();

      document.getElementById = origGEBI;
    });
  });
});



