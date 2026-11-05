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
      approach: 'Target sum logic',
      due: Date.now() - 1000,
      historyLog: []
    },
    {
      id: 'c2',
      problemTitle: '3Sum',
      problemUrl: 'https://leetcode.com/problems/3sum',
      tags: ['Array', 'Two Pointers'],
      approach: 'Sort array first',
      due: Date.now() + 86400000,
      historyLog: []
    },
    {
      id: 'c3',
      problemTitle: '4Sum',
      problemUrl: 'https://leetcode.com/problems/4sum',
      tags: ['Array'],
      due: Date.now() + 86400000,
      historyLog: []
    },
    {
      id: 'c4',
      problemTitle: 'Subarray Sum',
      problemUrl: 'https://leetcode.com/problems/subarray-sum',
      tags: ['Array'],
      due: Date.now() + 86400000,
      historyLog: []
    },
    {
      id: 'c5',
      problemTitle: 'Combination Sum',
      problemUrl: 'https://leetcode.com/problems/combination-sum',
      tags: ['Array'],
      due: Date.now() + 86400000,
      historyLog: []
    },
    {
      id: 'c6',
      problemTitle: 'Path Sum',
      problemUrl: 'https://leetcode.com/problems/path-sum',
      tags: ['Tree'],
      due: Date.now() + 86400000,
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
        <option value="oldTag">Old Tag</option>
      </select>
      <div id="popup-search-results"></div>
    `;

    (chrome as any).runtime = {
      getURL: jest.fn((path: string) => `chrome-extension://mocked-id/${path}`)
    };

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

    it('loads cards, clears previous option elements, and populates tag filter select options', async () => {
      await component.load();

      const tagFilter = document.getElementById('popup-tag-filter') as HTMLSelectElement;
      expect(tagFilter.options.length).toBe(5); // 'All Tags', 'Array', 'Hash Table', 'Tree', 'Two Pointers'
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

    it('triggers tag filter change listener on select change', async () => {
      await component.load();
      component.bindEvents();

      const tagFilter = document.getElementById('popup-tag-filter') as HTMLSelectElement;
      tagFilter.value = 'Tree';
      tagFilter.dispatchEvent(new Event('change'));

      const results = document.getElementById('popup-search-results');
      expect(results?.children.length).toBe(1);
    });

    it('handles exceptions inside input listener and tag filter change listener', async () => {
      await component.load();
      component.bindEvents();

      const searchInput = document.getElementById('popup-search-input') as HTMLInputElement;
      const tagFilter = document.getElementById('popup-tag-filter') as HTMLSelectElement;

      // Force error inside renderQuickSearch
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('Render error'); };

      searchInput.value = 'Test';
      searchInput.dispatchEvent(new Event('input'));
      expect(() => jest.advanceTimersByTime(200)).not.toThrow();

      expect(() => tagFilter.dispatchEvent(new Event('change'))).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('handles exceptions inside bindEvents execution', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => component.bindEvents()).not.toThrow();

      document.getElementById = origGEBI;
    });
  });

  describe('renderQuickSearch branches', () => {
    it('clears container and returns early when query is empty and selectedTag is all', async () => {
      await component.load();
      const resultsContainer = document.getElementById('popup-search-results') as HTMLElement;
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = '<div>Previous</div>';

      const searchInput = document.getElementById('popup-search-input') as HTMLInputElement;
      searchInput.value = '';

      component.renderQuickSearch();
      expect(resultsContainer.style.display).toBe('none');
      expect(resultsContainer.innerHTML).toBe('');
    });

    it('renders empty result message when query does not match any card', async () => {
      await component.load();
      const searchInput = document.getElementById('popup-search-input') as HTMLInputElement;
      searchInput.value = 'NonExistentProblemQuery';

      component.renderQuickSearch();
      const resultsContainer = document.getElementById('popup-search-results') as HTMLElement;
      expect(resultsContainer.innerHTML).toContain('No matching patterns found.');
    });

    it('renders "View all X results" link when matching card count exceeds maxDisplay (5)', async () => {
      await component.load();
      const searchInput = document.getElementById('popup-search-input') as HTMLInputElement;
      searchInput.value = 'Sum';

      component.renderQuickSearch();
      const resultsContainer = document.getElementById('popup-search-results') as HTMLElement;
      expect(resultsContainer.innerHTML).toContain('View all 6 results');
    });

    it('returns early if search input or results container is missing', () => {
      document.getElementById('popup-search-input')?.remove();
      expect(() => component.renderQuickSearch()).not.toThrow();
    });

    it('handles renderQuickSearch exception gracefully', async () => {
      await component.load();
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('DOM render error'); };

      expect(() => component.renderQuickSearch()).not.toThrow();

      document.getElementById = origGEBI;
    });
  });
});
