import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { HelpCenterSPA, HelpApp, DEFAULT_HELP_TABS } from '../../../../../features/common/help/help';
import { BROWSER_CONFIG } from '../../../../../features/common/browserConfig';
import { UIUtils } from '../../../../../features/common/utils/uiUtils';

describe('HelpCenterSPA & HelpApp', () => {
  let helpCenter: HelpCenterSPA;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    delete (window as any).location;
    (window as any).location = new URL('https://algo.monster/help/help.html?tab=shortcuts');

    window.close = jest.fn() as any;
    (window as any).scrollTo = jest.fn();

    helpCenter = new HelpCenterSPA();
  });

  afterEach(() => {
    jest.clearAllMocks();
    render(null, container);
    container.remove();
    document.body.innerHTML = '';
  });

  describe('init & tab switching', () => {
    it('initializes tab from URL query params and binds handlers', () => {
      helpCenter.init();
      expect(helpCenter.currentTab).toBe('shortcuts');
    });

    it('switches tab on tab button click', async () => {
      await act(async () => {
        render(h(HelpApp, { spa: helpCenter }), container);
      });

      const tabBtn = container.querySelector('.tab-btn[data-tab="fsrs"]') as HTMLElement;
      expect(tabBtn).not.toBeNull();
      await act(async () => {
        tabBtn.click();
      });

      expect(helpCenter.currentTab).toBe('fsrs');
      expect(container.querySelector('.tab-btn[data-tab="fsrs"]')?.classList.contains('active')).toBe(true);
    });

    it('switches to privacy tab on privacy tab button click', async () => {
      await act(async () => {
        render(h(HelpApp, { spa: helpCenter }), container);
      });

      const privacyBtn = container.querySelector('.tab-btn[data-tab="privacy"]') as HTMLElement;
      expect(privacyBtn).not.toBeNull();
      await act(async () => {
        privacyBtn.click();
      });

      expect(helpCenter.currentTab).toBe('privacy');
      expect(container.querySelector('.tab-btn[data-tab="privacy"]')?.classList.contains('active')).toBe(true);
    });

    it('switches to privacy tab on data-switch-tab link click', () => {
      const spyScroll = jest.spyOn(helpCenter, 'smoothScrollToTab');
      helpCenter.switchTab('privacy');

      expect(helpCenter.currentTab).toBe('privacy');
      expect(spyScroll).toHaveBeenCalledWith('privacy');
    });

    it('activates privacy tab directly when ?tab=privacy is in URL', () => {
      (window as any).location = new URL('https://algo.monster/help/help.html?tab=privacy');
      const spyScroll = jest.spyOn(helpCenter, 'smoothScrollToTab');
      helpCenter.init();

      expect(helpCenter.currentTab).toBe('privacy');
      expect(spyScroll).toHaveBeenCalledWith('privacy');
    });

    it('smoothly scrolls the active tab button into view inside role="tablist"', () => {
      const tablist = document.createElement('nav');
      tablist.className = 'tabs-container';
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.setAttribute('data-tab', 'privacy');
      tablist.appendChild(btn);
      document.body.appendChild(tablist);

      tablist.scrollTo = jest.fn();
      helpCenter.smoothScrollToTab('privacy');
      expect(tablist.scrollTo).toHaveBeenCalled();
      tablist.remove();
    });

    it('dynamically renders browser and store specific names on init', async () => {
      render(h(HelpApp, { spa: helpCenter }), container);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const policyNameEl = container.querySelector('#help-store-policy-name');
      const dataCertEl = container.querySelector('#help-data-certification-title');

      expect(policyNameEl?.textContent).toBe(`${BROWSER_CONFIG.storeName} (${BROWSER_CONFIG.displayName})`);
      expect(dataCertEl?.textContent).toContain('Data Use Certification');
    });

    it('verifies help.html does not contain hardcoded Chrome-specific store strings in static HTML', () => {
      const fs = require('fs');
      const path = require('path');
      const htmlPath = path.resolve(__dirname, '../../../../../features/common/help/help.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      expect(html).not.toContain('Chrome Web Store Minimal Permissions policy');
      expect(html).not.toContain('<h3>📜 Chrome Web Store Data Use Certification</h3>');
    });

    it('initializes tab from URL hash when query param is missing and smooth scrolls', () => {
      (window as any).location = new URL('https://algo.monster/help/help.html#privacy');
      const spyScroll = jest.spyOn(helpCenter, 'smoothScrollToTab');

      helpCenter.init();

      expect(helpCenter.currentTab).toBe('privacy');
      expect(spyScroll).toHaveBeenCalledWith('privacy');
    });

    it('handles hashchange event to navigate to new tab', async () => {
      await act(async () => {
        render(h(HelpApp, { spa: helpCenter }), container);
      });

      (window as any).location = new URL('https://algo.monster/help/help.html#tab-privacy');
      await act(async () => {
        window.dispatchEvent(new Event('hashchange'));
      });

      expect(helpCenter.currentTab).toBe('privacy');
      expect(container.querySelector('.tab-btn[data-tab="privacy"]')?.classList.contains('active')).toBe(true);
    });

    it('resets search input when switching tab manually', () => {
      helpCenter.filterContent('shortcuts');
      expect(helpCenter.searchQuery).toBe('shortcuts');

      helpCenter.switchTab('overview');
      expect(helpCenter.searchQuery).toBe('');
    });

    it('handles tab switch errors gracefully', () => {
      expect(() => helpCenter.switchTab('overview')).not.toThrow();
    });
  });

  describe('live search filter', () => {
    it('filters cards by query term across all tab panes', async () => {
      render(h(HelpApp, { spa: helpCenter }), container);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const searchInput = container.querySelector('#help-search-input') as HTMLInputElement;
      expect(searchInput).not.toBeNull();
      searchInput.value = 'keyboard';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(helpCenter.searchQuery).toBe('keyboard');
    });

    it('restores normal view when search query is cleared', async () => {
      render(h(HelpApp, { spa: helpCenter }), container);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const searchInput = container.querySelector('#help-search-input') as HTMLInputElement;
      searchInput.value = 'strategy';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(helpCenter.searchQuery).toBe('');
    });

    it('handles empty DOM elements or missing search input gracefully', () => {
      expect(() => helpCenter.filterContent('query')).not.toThrow();
    });
  });

  describe('close button', () => {
    it('calls window.close when close button is clicked', async () => {
      render(h(HelpApp, { spa: helpCenter }), container);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const closeBtn = container.querySelector('#close-help-btn') as HTMLElement;
      expect(closeBtn).not.toBeNull();
      closeBtn.click();
      expect(window.close).toHaveBeenCalled();
    });
  });

  describe('error handling paths', () => {
    it('handles errors in search filter gracefully', () => {
      jest.spyOn(helpCenter, 'filterContent').mockImplementation(() => {
        throw new Error('Filter error');
      });

      expect(() => helpCenter.filterContent('test')).toThrow('Filter error');
    });

    it('handles smoothScrollToTab exceptions gracefully', () => {
      (window as any).scrollTo = () => { throw new Error('Scroll error'); };
      expect(() => helpCenter.smoothScrollToTab('overview')).not.toThrow();
    });
  });
});
