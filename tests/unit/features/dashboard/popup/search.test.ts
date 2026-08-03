import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { QuickSearchComponent } from '../../../../../features/dashboard/popup/search';
import { DashboardCoordinator } from '../../../../../features/dashboard/popup/DashboardComponent';
import { Card } from '../../../../../types/domain';

describe('QuickSearchComponent (Popup)', () => {
  let component: QuickSearchComponent;
  let mockCoordinator: DashboardCoordinator;

  const getFreshCards = (): Card[] => [
    {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      tags: ['Array', 'Hash Table'],
      note: 'Target sum logic',
      historyLog: []
    },
    {
      id: 'c2',
      problemTitle: '3Sum',
      problemUrl: 'https://leetcode.com/problems/3sum',
      tags: ['Array', 'Two Pointers'],
      note: 'Sort array first',
      historyLog: []
    }
  ] as unknown as Card[];

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <input id="popup-search-input" value="" />
      <select id="popup-tag-filter">
        <option value="all">All Tags</option>
      </select>
      <div id="popup-search-results"></div>
    `;

    mockCoordinator = {
      showStatus: jest.fn()
    };

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any) => {
      return Promise.resolve({ fsrsCards: getFreshCards() });
    });

    component = new QuickSearchComponent(mockCoordinator);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('load', () => {
    it('returns early if search elements are missing from DOM', async () => {
      document.body.innerHTML = '';
      await expect(component.load()).resolves.not.toThrow();
    });

    it('loads cards and populates tag filter select options', async () => {
      await component.load();

      const tagFilter = document.getElementById('popup-tag-filter') as HTMLSelectElement;
      expect(tagFilter.options.length).toBe(4); // 'All Tags', 'Array', 'Hash Table', 'Two Pointers'
    });

    it('handles storage load error gracefully', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.reject(new Error('Storage failure'));
      });

      await expect(component.load()).resolves.not.toThrow();
    });
  });

  describe('bindEvents and debounced search execution', () => {
    it('debounces text input and filters quick search results', async () => {
      await component.load();
      component.bindEvents();

      const searchInput = document.getElementById('popup-search-input') as HTMLInputElement;
      searchInput.value = 'Two Sum';
      searchInput.dispatchEvent(new Event('input'));

      jest.advanceTimersByTime(200);

      const results = document.getElementById('popup-search-results');
      expect(results?.children.length).toBeGreaterThan(0);
    });

    it('filters quick search results when search input is typed', async () => {
      await component.load();
      component.bindEvents();

      const searchInput = document.getElementById('popup-search-input') as HTMLInputElement;
      searchInput.value = '3Sum';
      component.renderQuickSearch();

      const results = document.getElementById('popup-search-results');
      expect(results?.children.length).toBe(1);
    });

    it('renders search result item with problem link href', async () => {
      await component.load();

      const searchInput = document.getElementById('popup-search-input') as HTMLInputElement;
      searchInput.value = 'Two';
      component.renderQuickSearch();

      const item = document.querySelector('.popup-search-item') as HTMLAnchorElement;
      expect(item?.href).toContain('https://leetcode.com/problems/two-sum');
    });
  });
});
