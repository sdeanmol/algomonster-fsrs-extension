import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { OnboardingWelcome, WelcomeApp } from '../../../../../features/common/welcome/welcome';
import { UIUtils } from '../../../../../features/common/utils/uiUtils';

describe('OnboardingWelcome & WelcomeApp', () => {
  let welcome: OnboardingWelcome;
  let container: HTMLElement;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);

    jest.clearAllMocks();
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      if (typeof cb === 'function') cb({});
    });
    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (typeof cb === 'function') cb();
    });

    welcome = new OnboardingWelcome();
    render(h(WelcomeApp, { controller: welcome }), container);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  afterEach(() => {
    jest.clearAllMocks();
    render(null, container);
    container.remove();
    document.body.innerHTML = '';
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

    it('navigates through steps with next and prev buttons', async () => {
      const prevBtn = document.getElementById('welcome-prev-btn') as HTMLElement;
      const nextBtn = document.getElementById('welcome-next-btn') as HTMLElement;

      // Click Next: Step 1 -> Step 2
      nextBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(welcome.currentStep).toBe(2);
      expect(document.getElementById('step-2')?.classList.contains('active')).toBe(true);
      expect(prevBtn.classList.contains('invisible')).toBe(false);

      // Click Next: Step 2 -> Step 3
      nextBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(welcome.currentStep).toBe(3);
      expect(nextBtn.textContent).toBe('Next');

      // Click Next: Step 3 -> Step 4
      nextBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(welcome.currentStep).toBe(4);
      expect(nextBtn.textContent).toBe('Explore Guide');

      // Click Prev: Step 4 -> Step 3
      prevBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(welcome.currentStep).toBe(3);

      // Click Prev: Step 3 -> Step 2
      prevBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(welcome.currentStep).toBe(2);

      // Click Prev: Step 2 -> Step 1
      prevBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(welcome.currentStep).toBe(1);
      expect(prevBtn.classList.contains('invisible')).toBe(true);
    });

    it('redirects to help page when next is clicked on final step', async () => {
      delete (window as any).location;
      (window as any).location = { href: '' };

      welcome.goToStep(4);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const nextBtn = document.getElementById('welcome-next-btn') as HTMLElement;
      nextBtn.click();

      expect(window.location.href).toBe('../help/help.html');
    });

    it('UX-007: renders step 4 with extension pinning guide and LeetCode start practicing link', () => {
      expect(container.querySelector('#step-4')).not.toBeNull();
      expect(container.textContent).toContain('Pin Extension & Start Practicing!');
      expect(container.querySelector('#start-practicing-btn')).not.toBeNull();
      expect(container.querySelector('#start-practicing-btn')?.getAttribute('href')).toBe('https://leetcode.com/problemset/all/');
      expect(container.querySelector('#welcome-docs-link')).not.toBeNull();
      expect(container.querySelector('#welcome-pin-instructions')).not.toBeNull();
    });

    it('dynamically renders browser-specific pin instructions on init', () => {
      const pinInstructions = document.getElementById('welcome-pin-instructions');
      expect(pinInstructions?.innerHTML).toContain('Pin AlgoRecall');
      expect(pinInstructions?.innerHTML.length).toBeGreaterThan(0);
    });
  });

  describe('theme preference', () => {
    it('switches to dark theme when dark theme button is clicked', async () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        if (cb) cb();
      });

      const darkBtn = document.getElementById('set-dark-btn') as HTMLElement;
      darkBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'dark' }, expect.any(Function));
      expect(darkBtn.classList.contains('active')).toBe(true);
    });

    it('switches to light theme when light theme button is clicked', async () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        if (cb) cb();
      });

      const lightBtn = document.getElementById('set-light-btn') as HTMLElement;
      lightBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'light' }, expect.any(Function));
      expect(document.getElementById('set-light-btn')?.classList.contains('active')).toBe(true);
    });

    it('handles chrome.runtime.lastError in theme set callback', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Theme save error' };
        if (cb) cb();
        delete (chrome.runtime as any).lastError;
      });

      const darkBtn = document.getElementById('set-dark-btn') as HTMLElement;
      expect(() => darkBtn.click()).not.toThrow();
    });
  });

  describe('notifications permission flow', () => {
    it('updates UI when notification permission is granted', async () => {
      (global as any).Notification = {
        permission: 'granted',
        requestPermission: jest.fn().mockImplementation(() => Promise.resolve('granted'))
      };

      welcome.checkNotificationState();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const badge = document.getElementById('welcome-notif-status');
      const btn = document.getElementById('welcome-enable-btn');
      expect(badge?.textContent).toBe('Active');
      expect(btn).toBeNull();
    });

    it('requests notification permission on enable button click', async () => {
      const requestMock = jest.fn().mockImplementation(() => Promise.resolve('granted'));
      (global as any).Notification = {
        permission: 'default',
        requestPermission: requestMock
      };

      welcome.checkNotificationState();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const btn = document.getElementById('welcome-enable-btn') as HTMLElement;
      if (btn) btn.click();

      expect(requestMock).toHaveBeenCalled();
    });

    it('handles denied permission response gracefully', async () => {
      const requestMock = jest.fn().mockImplementation(() => Promise.resolve('denied'));
      (global as any).Notification = {
        permission: 'default',
        requestPermission: requestMock
      };

      welcome.checkNotificationState();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const btn = document.getElementById('welcome-enable-btn') as HTMLElement;
      if (btn) btn.click();
      await Promise.resolve();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toBe('Notifications were disabled at the OS level.');
    });
  });

  describe('toast and error recovery', () => {
    it('shows and hides toast notification after timer', () => {
      jest.useFakeTimers();
      UIUtils.showToast('Test Toast');

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toBe('Test Toast');
      expect(toast?.className).toBe('toast show');

      jest.advanceTimersByTime(2600);
      expect(toast?.className).toBe('toast');
      jest.useRealTimers();
    });

    it('handles DOM exceptions in goToStep and checkNotificationState gracefully', () => {
      expect(() => welcome.goToStep(2)).not.toThrow();
      expect(() => welcome.checkNotificationState()).not.toThrow();
      expect(() => UIUtils.showToast('Error Toast')).not.toThrow();
    });

    it('handles Notification.requestPermission promise rejection', async () => {
      const requestMock = jest.fn().mockImplementation(() => Promise.reject(new Error('Permission Rejected')));
      (global as any).Notification = {
        permission: 'default',
        requestPermission: requestMock
      };

      welcome.checkNotificationState();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const btn = document.getElementById('welcome-enable-btn') as HTMLElement;
      if (btn) expect(() => btn.click()).not.toThrow();
    });

    it('handles chrome.runtime.lastError in syncThemePreference', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Theme fetch error' };
        if (cb) cb({});
        delete (chrome.runtime as any).lastError;
      });

      expect(() => welcome.syncThemePreference()).not.toThrow();
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

    it('UA-032: closes window when skip button is clicked', () => {
      (window as any).close = jest.fn();

      const skipBtn = document.getElementById('welcome-skip-btn') as HTMLElement;
      skipBtn.click();
      expect(window.close).toHaveBeenCalled();
    });
  });
});
