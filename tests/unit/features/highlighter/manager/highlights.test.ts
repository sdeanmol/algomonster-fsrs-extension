import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HighlightsManager } from '../../../../../features/highlighter/manager/highlights';
import { HighlightMark, BookmarkItem } from '../../../../../types/domain';

describe('HighlightsManager', () => {
  let manager: HighlightsManager;

  const mockMarks: HighlightMark[] = [
    {
      id: 'm1',
      url: 'https://leetcode.com/problems/two-sum',
      text: 'Dynamic Programming Approach',
      color: '#f1c40f',
      createdAt: 1000,
      type: 'highlight',
      note: 'Important note',
      category: 'Algo'
    },
    {
      url: 'https://leetcode.com/problems/three-sum',
      text: 'Two Pointer Technique for Searching arrays in linear time',
      color: '#e74c3c',
      createdAt: 2000,
      type: 'underline',
      note: '',
      category: ''
    },
    {
      id: 'm3',
      url: 'https://algo.monster/dp-pattern',
      text: 'Memoization Table',
      color: '#3498db',
      createdAt: 1500,
      type: 'highlight',
      note: 'Special memoization note',
      category: 'DP-Category'
    }
  ] as unknown as HighlightMark[];

  const mockBookmarks: BookmarkItem[] = [
    {
      url: 'https://leetcode.com/problems/two-sum',
      title: 'Two Sum Problem Page with a Very Long Title That Needs To Be Truncated Properly'
    }
  ] as unknown as BookmarkItem[];

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;

    document.body.innerHTML = `
      <button id="refresh-btn">Refresh</button>
      <button id="export-highlights-btn">Export</button>
      <input id="search-input" value="" />
      <select id="webpage-select"><option value="all">All Pages</option></select>
      <select id="sort-select">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="longest">Longest</option>
        <option value="shortest">Shortest</option>
        <option value="title">Title</option>
      </select>
      <button id="clear-filters-btn">Clear</button>

      <div id="color-filters-container"></div>
      <div id="highlights-container"></div>
      <span id="highlight-subtitle"></span>
    `;

    (global as any).confirm = jest.fn().mockReturnValue(true);
    (global as any).alert = jest.fn();

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = { marks: mockMarks, bookmarks: mockBookmarks };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
      return Promise.resolve();
    });

    (chrome as any).downloads = {
      download: jest.fn().mockImplementation((options: any, cb?: any) => {
        if (cb) cb(123);
      })
    };

    (global as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');

    manager = new HighlightsManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('initialization and event binding', () => {
    it('initializes manager and loads highlights from storage', () => {
      manager.init();
      expect(chrome.storage.local.get).toHaveBeenCalled();
      expect(manager.loadedMarks.length).toBe(3);
    });

    it('binds UI control listeners and triggers event handlers', () => {
      manager.init();

      const refreshBtn = document.getElementById('refresh-btn') as HTMLElement;
      refreshBtn.click();
      expect(chrome.storage.local.get).toHaveBeenCalledTimes(2);

      const exportBtn = document.getElementById('export-highlights-btn') as HTMLElement;
      exportBtn.click();
      expect(chrome.downloads.download).toHaveBeenCalled();

      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      searchInput.value = 'Dynamic';
      searchInput.dispatchEvent(new Event('input'));
      expect(manager.searchQuery).toBe('Dynamic');

      const webpageSelect = document.getElementById('webpage-select') as HTMLSelectElement;
      webpageSelect.value = 'https://leetcode.com/problems/two-sum';
      webpageSelect.dispatchEvent(new Event('change'));
      expect(manager.activePageFilter).toBe('https://leetcode.com/problems/two-sum');

      const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
      sortSelect.value = 'oldest';
      sortSelect.dispatchEvent(new Event('change'));
      expect(manager.sortOption).toBe('oldest');

      const clearBtn = document.getElementById('clear-filters-btn') as HTMLElement;
      clearBtn.click();
      expect(manager.searchQuery).toBe('');
      expect(manager.sortOption).toBe('newest');
    });

    it('catches exceptions inside event handler callbacks gracefully', () => {
      manager.init();

      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      Object.defineProperty(searchInput, 'value', {
        get: () => { throw new Error('Input value error'); }
      });
      expect(() => searchInput.dispatchEvent(new Event('input'))).not.toThrow();
    });

    it('handles DOM exceptions in event handlers cleanly', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI Error'); };

      expect(() => manager.init()).not.toThrow();
      document.getElementById = origGEBI;
    });
  });

  describe('search query matching branches', () => {
    it('matches search query across pageTitle, markUrl, markNote, and markCategory', () => {
      manager.loadedMarks = mockMarks;
      manager.loadedBookmarks = mockBookmarks;

      // Match by page title
      manager.searchQuery = 'Truncated';
      manager.filterAndRender();

      // Match by URL
      manager.searchQuery = 'algo.monster';
      manager.filterAndRender();

      // Match by note
      manager.searchQuery = 'Special memoization';
      manager.filterAndRender();

      // Match by category
      manager.searchQuery = 'DP-Category';
      manager.filterAndRender();

      const subtitle = document.getElementById('highlight-subtitle');
      expect(subtitle?.innerText || subtitle?.textContent).toContain('Found 1 matching');
    });
  });

  describe('storage error handling and webpage select population', () => {
    it('handles chrome.runtime.lastError when fetching marks from storage', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage quota exceeded' };
        if (cb) cb({});
      });

      manager.loadHighlights();
      expect(manager.loadedMarks).toEqual([]);
    });

    it('handles inner error in loadHighlights storage callback', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ marks: 'invalid' });
      });

      expect(() => manager.loadHighlights()).not.toThrow();
    });

    it('truncates long page titles in webpage select options', () => {
      manager.loadedMarks = mockMarks;
      manager.loadedBookmarks = mockBookmarks;
      manager.populateWebpageSelect();

      const select = document.getElementById('webpage-select') as HTMLSelectElement;
      expect(select.options.length).toBe(4);
      expect(select.options[1].textContent).toContain('...');
    });
  });

  describe('color filters and card rendering', () => {
    it('renders color filter bubbles and toggles active filter state', () => {
      manager.loadedMarks = mockMarks;
      manager.renderColorFilters();

      const container = document.getElementById('color-filters-container');
      const bubbles = container?.querySelectorAll('.color-filter-bubble');

      (bubbles?.[0] as HTMLElement).click();
      expect(manager.activeColorFilter).toBe('#f1c40f');

      (bubbles?.[0] as HTMLElement).click();
      expect(manager.activeColorFilter).toBeNull();
    });

    it('renders "No colors" text when loadedMarks has no colors', () => {
      manager.loadedMarks = [];
      manager.renderColorFilters();

      const container = document.getElementById('color-filters-container');
      expect(container?.textContent).toBe('No colors');
    });
  });

  describe('filtering and sorting highlights', () => {
    it('sorts highlights by newest, oldest, longest, shortest, title, and unknown sort option', () => {
      manager.loadedMarks = mockMarks;
      manager.loadedBookmarks = mockBookmarks;

      manager.sortOption = 'newest';
      manager.filterAndRender();

      manager.sortOption = 'oldest';
      manager.filterAndRender();

      manager.sortOption = 'longest';
      manager.filterAndRender();

      manager.sortOption = 'shortest';
      manager.filterAndRender();

      manager.sortOption = 'title';
      manager.filterAndRender();

      manager.sortOption = 'unknown_option';
      manager.filterAndRender();
      const cards = document.querySelectorAll('.highlight-card');
      expect(cards.length).toBe(3);
    });

    it('renders empty state when no highlights match search query', () => {
      manager.loadedMarks = mockMarks;
      manager.searchQuery = 'NonExistentTerm123';
      manager.filterAndRender();

      const container = document.getElementById('highlights-container');
      expect(container?.innerHTML).toContain('empty-state');
    });

    it('handles card copy and delete button actions including fallback id', () => {
      manager.loadedMarks = mockMarks;
      manager.filterAndRender();

      const copyBtn = document.querySelector('.action-btn-copy') as HTMLElement;
      expect(() => copyBtn.click()).not.toThrow();

      const deleteBtns = document.querySelectorAll('.action-btn-delete');
      (deleteBtns[1] as HTMLElement).click(); // mark m2 without id attribute (uses createdAt)
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('deleteHighlight and exportHighlightsToMarkdown', () => {
    it('does not delete highlight when confirm dialog is cancelled', () => {
      (global as any).confirm.mockReturnValue(false);

      manager.deleteHighlight('m1');
      expect(chrome.storage.local.get).not.toHaveBeenCalled();
    });

    it('handles chrome.runtime.lastError during delete highlight storage fetch', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Failed to read storage' };
        if (cb) cb({});
      });

      manager.deleteHighlight('m1');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('handles chrome.runtime.lastError during delete highlight storage set callback', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ marks: mockMarks });
      });

      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Write failed' };
        if (cb) cb();
      });

      manager.deleteHighlight('m1');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('exports highlights to Markdown file with notes and categories', () => {
      manager.loadedMarks = mockMarks;
      manager.loadedBookmarks = mockBookmarks;

      manager.exportHighlightsToMarkdown();
      expect(chrome.downloads.download).toHaveBeenCalled();
    });

    it('shows alert when no highlights exist to export', () => {
      manager.loadedMarks = [];
      manager.exportHighlightsToMarkdown();

      expect(global.alert).toHaveBeenCalledWith('No highlights to export!');
    });

    it('handles chrome.runtime.lastError in downloads callback', () => {
      (chrome.downloads.download as jest.Mock).mockImplementation((options: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Download interrupted' };
        if (cb) cb(null);
      });

      manager.loadedMarks = mockMarks;
      expect(() => manager.exportHighlightsToMarkdown()).not.toThrow();
    });
  });
});
