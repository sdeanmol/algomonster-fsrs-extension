import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { HelpCenterSPA } from '../../../../../features/common/help/help';

describe('HelpCenterSPA', () => {
  let helpCenter: HelpCenterSPA;

  beforeEach(() => {
    document.body.innerHTML = `
      <input id="help-search-input" value="" />
      <button id="close-help-btn">Close</button>
      <div class="tabs">
        <button class="tab-btn active" data-tab="overview" aria-selected="true">Overview</button>
        <button class="tab-btn" data-tab="shortcuts" aria-selected="false">Shortcuts</button>
        <button class="tab-btn" data-tab="strategy" aria-selected="false">Strategy</button>
      </div>
      <div id="tab-overview" class="tab-pane active">
        <div class="card">Overview Card content</div>
      </div>
      <div id="tab-shortcuts" class="tab-pane">
        <div class="gamify-card">Keyboard shortcuts info</div>
      </div>
      <div id="tab-strategy" class="tab-pane">
        <div class="strategy-card">Learning strategy details</div>
      </div>
    `;

    delete (window as any).location;
    (window as any).location = new URL('https://algo.monster/help/help.html?tab=shortcuts');

    window.close = jest.fn() as any;

    helpCenter = new HelpCenterSPA();
  });

  describe('init & tab switching', () => {
    it('initializes tab from URL query params and binds handlers', () => {
      helpCenter.init();
      expect(helpCenter.currentTab).toBe('shortcuts');

      const overviewPane = document.getElementById('tab-overview');
      const shortcutsPane = document.getElementById('tab-shortcuts');
      expect(overviewPane?.classList.contains('active')).toBe(false);
      expect(shortcutsPane?.classList.contains('active')).toBe(true);
    });

    it('switches tab on tab button click', () => {
      helpCenter.init();
      const strategyBtn = document.querySelector('.tab-btn[data-tab="strategy"]') as HTMLElement;
      strategyBtn.click();

      expect(helpCenter.currentTab).toBe('strategy');
      const strategyPane = document.getElementById('tab-strategy');
      expect(strategyPane?.classList.contains('active')).toBe(true);
    });

    it('resets search input when switching tab manually', () => {
      helpCenter.init();
      const searchInput = document.getElementById('help-search-input') as HTMLInputElement;
      searchInput.value = 'shortcuts';

      helpCenter.switchTab('overview');
      expect(searchInput.value).toBe('');
    });

    it('handles tab switch errors gracefully', () => {
      const spy = jest.spyOn(document, 'querySelectorAll').mockImplementation(() => {
        throw new Error('Query error');
      });
      expect(() => helpCenter.switchTab('overview')).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('live search filter', () => {
    it('filters cards by query term across all tab panes', () => {
      helpCenter.init();
      const searchInput = document.getElementById('help-search-input') as HTMLInputElement;
      searchInput.value = 'keyboard';
      searchInput.dispatchEvent(new Event('input'));

      const overviewPane = document.getElementById('tab-overview');
      const shortcutsPane = document.getElementById('tab-shortcuts');
      expect(overviewPane?.classList.contains('active')).toBe(false);
      expect(shortcutsPane?.classList.contains('active')).toBe(true);
    });

    it('restores normal view when search query is cleared', () => {
      helpCenter.init();
      const searchInput = document.getElementById('help-search-input') as HTMLInputElement;
      searchInput.value = 'strategy';
      searchInput.dispatchEvent(new Event('input'));

      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));

      const shortcutsPane = document.getElementById('tab-shortcuts');
      expect(shortcutsPane?.classList.contains('active')).toBe(true);
    });

    it('handles empty DOM elements or missing search input gracefully', () => {
      document.body.innerHTML = '';
      helpCenter.bindSearchFilter();
      expect(() => helpCenter.filterContent('query')).not.toThrow();
    });
  });

  describe('close button', () => {
    it('calls window.close when close button is clicked', () => {
      helpCenter.init();
      const closeBtn = document.getElementById('close-help-btn') as HTMLElement;
      closeBtn.click();
      expect(window.close).toHaveBeenCalled();
    });
  });

  describe('error handling paths', () => {
    it('handles errors in search input event listener callback', () => {
      helpCenter.init();
      const searchInput = document.getElementById('help-search-input') as HTMLInputElement;
      jest.spyOn(helpCenter, 'filterContent').mockImplementation(() => {
        throw new Error('Filter error');
      });

      expect(() => searchInput.dispatchEvent(new Event('input'))).not.toThrow();
    });

    it('handles errors in tab button click listener callback', () => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.setAttribute('data-tab', 'shortcuts');
      document.body.appendChild(btn);

      jest.spyOn(helpCenter, 'switchTab').mockImplementation(() => {
        throw new Error('Switch tab error');
      });

      helpCenter.bindTabNavigation();
      expect(() => btn.click()).not.toThrow();
    });

    it('handles querySelectorAll exceptions in bindTabNavigation and filterContent', () => {
      const origQSA = document.querySelectorAll;
      document.querySelectorAll = () => { throw new Error('QSA error'); };

      expect(() => helpCenter.bindTabNavigation()).not.toThrow();
      expect(() => helpCenter.filterContent('query')).not.toThrow();

      document.querySelectorAll = origQSA;
    });

    it('handles getElementById exceptions in bindSearchFilter and bindCloseButton', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => helpCenter.bindSearchFilter()).not.toThrow();
      expect(() => helpCenter.bindCloseButton()).not.toThrow();

      document.getElementById = origGEBI;
    });
  });
});




