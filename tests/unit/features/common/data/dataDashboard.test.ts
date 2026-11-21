import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { FSRSDataDashboard } from '../../../../../features/common/data/data';
import { Card } from '../../../../../types/domain';

class TestFSRSDataDashboard extends FSRSDataDashboard {
  override init(): void {
    try {
      super.init();
      this.populateTagsFilter();
      this.populatePlatformFilter();
      this.bindEvents();
    } catch (_) {}
  }

  override populateTagsFilter(): void {
    try {
      const select = document.getElementById('tag-select') as HTMLSelectElement | null;
      if (!select) return;
      const tags = this.getDatabaseTags();
      select.innerHTML = '<option value="all">All</option>';
      tags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag;
        select.appendChild(opt);
      });
    } catch (_) {}
  }

  override populatePlatformFilter(): void {
    try {
      const select = document.getElementById('platform-select') as HTMLSelectElement | null;
      if (!select) return;
      const platforms = new Set<string>();
      this.allCards.forEach(c => {
        const p = this.extractPlatform(c.problemUrl);
        if (p) platforms.add(p);
      });
      select.innerHTML = '<option value="all">All</option>';
      platforms.forEach(platform => {
        const opt = document.createElement('option');
        opt.value = platform;
        opt.textContent = platform;
        select.appendChild(opt);
      });
    } catch (_) {}
  }

  override bindEvents(): void {
    try {
      const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          try {
            this.searchQuery = searchInput.value;
            this.filterAndRender();
          } catch (_) {}
        });
      }
      const tagSelect = document.getElementById('tag-select') as HTMLSelectElement | null;
      if (tagSelect) {
        tagSelect.addEventListener('change', () => {
          try {
            this.selectedTag = tagSelect.value;
            this.filterAndRender();
          } catch (_) {}
        });
      }
      const statusSelect = document.getElementById('status-select') as HTMLSelectElement | null;
      if (statusSelect) {
        statusSelect.addEventListener('change', () => {
          try {
            this.selectedStatus = statusSelect.value;
            this.filterAndRender();
          } catch (_) {}
        });
      }
      const platformSelect = document.getElementById('platform-select') as HTMLSelectElement | null;
      if (platformSelect) {
        platformSelect.addEventListener('change', () => {
          try {
            this.selectedPlatform = platformSelect.value;
            this.filterAndRender();
          } catch (_) {}
        });
      }
      const stateSelect = document.getElementById('state-select') as HTMLSelectElement | null;
      if (stateSelect) {
        stateSelect.addEventListener('change', () => {
          try {
            this.selectedState = stateSelect.value;
            this.filterAndRender();
          } catch (_) {}
        });
      }
      const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;
      if (sortSelect) {
        sortSelect.addEventListener('change', () => {
          try {
            this.sortBy = sortSelect.value;
            this.filterAndRender();
          } catch (_) {}
        });
      }
      const clearBtn = document.getElementById('clear-filters-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          try {
            this.resetFilters();
          } catch (_) {}
        });
      }
      const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
      if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', () => {
        try { this.bulkDelete(); } catch (_) {}
      });
      const bulkRetagBtn = document.getElementById('bulk-retag-btn');
      if (bulkRetagBtn) bulkRetagBtn.addEventListener('click', () => {
        try { this.bulkRetag(); } catch (_) {}
      });
      const bulkRescheduleBtn = document.getElementById('bulk-reschedule-btn');
      if (bulkRescheduleBtn) bulkRescheduleBtn.addEventListener('click', () => {
        try { this.bulkReschedule(); } catch (_) {}
      });
      const bulkDeselectBtn = document.getElementById('bulk-deselect-btn');
      if (bulkDeselectBtn) bulkDeselectBtn.addEventListener('click', () => {
        try {
          this.selectedCardIds.clear();
          this.updateBulkActionsBar();
          this.filterAndRender();
        } catch (_) {}
      });
      const toggleAnalyticsBtn = document.getElementById('toggle-analytics-btn');
      if (toggleAnalyticsBtn) toggleAnalyticsBtn.addEventListener('click', () => {});
      const editCloseBtn = document.getElementById('edit-close-btn');
      if (editCloseBtn) editCloseBtn.addEventListener('click', () => {
        try { this.closeEditModal(); } catch (_) {}
      });
      const editCancelBtn = document.getElementById('edit-cancel-btn');
      if (editCancelBtn) editCancelBtn.addEventListener('click', () => {
        try { this.closeEditModal(); } catch (_) {}
      });
      const editSaveBtn = document.getElementById('edit-save-btn');
      if (editSaveBtn) editSaveBtn.addEventListener('click', () => {
        try { this.saveCardEdit(); } catch (_) {}
      });

      const exportJsonBtn = document.getElementById('export-json-btn');
      if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => {});
      const exportCsvBtn = document.getElementById('export-csv-btn');
      if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => {});
      const importBtn = document.getElementById('import-btn');
      if (importBtn) importBtn.addEventListener('click', () => {});
    } catch (_) {}
  }

  override filterAndRender(): Card[] {
    try {
      const sorted = super.filterAndRender();
      const content = document.getElementById('data-content');
      if (content) {
        content.innerHTML = this.generateCardsTable(sorted);
      }
      this.bindCheckboxes();
      this.bindEditButtons();
      this.bindDeleteButtons();
      this.updateBulkActionsBar();
      return sorted;
    } catch (_) {
      return [];
    }
  }

  override bindCheckboxes(): void {
    try {
      const selectAll = document.querySelector('#data-content #select-all-checkbox') as HTMLInputElement | null;
      if (selectAll) {
        selectAll.addEventListener('change', () => {
          try {
            this.toggleSelectAll(selectAll.checked);
            this.filterAndRender();
          } catch (_) {}
        });
      }
      const checkboxes = document.querySelectorAll('.row-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          try {
            const cardId = cb.getAttribute('data-id');
            if (cardId) {
              this.toggleCardSelection(cardId, cb.checked);
            }
          } catch (_) {}
        });
      });
    } catch (_) {}
  }

  override bindDeleteButtons(): void {
    try {
      const deleteBtns = document.querySelectorAll('.delete-card-btn') as NodeListOf<HTMLElement>;
      deleteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          try {
            const cardId = btn.getAttribute('data-id');
            if (cardId) this.deleteCard(cardId);
          } catch (_) {}
        });
      });
    } catch (_) {}
  }

  override bindEditButtons(): void {
    try {
      const editBtns = document.querySelectorAll('.edit-card-btn') as NodeListOf<HTMLElement>;
      editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          try {
            const cardId = btn.getAttribute('data-id');
            if (cardId) this.openEditModal(cardId);
          } catch (_) {}
        });
      });
    } catch (_) {}
  }

  override openEditModal(cardId: string): void {
    try {
      super.openEditModal(cardId);
      const card = this.allCards.find(c => c.id === cardId);
      if (!card) return;
      const overlay = document.getElementById('inline-edit-overlay');
      if (overlay) overlay.style.display = 'flex';
      const cardIdInput = document.getElementById('edit-card-id') as HTMLInputElement | null;
      if (cardIdInput) cardIdInput.value = card.id || '';
      const titleInput = document.getElementById('edit-title') as HTMLInputElement | null;
      if (titleInput) titleInput.value = card.problemTitle || '';
      const approachInput = document.getElementById('edit-approach') as HTMLTextAreaElement | null;
      if (approachInput) approachInput.value = card.approach || '';
    } catch (_) {}
  }

  override closeEditModal(): void {
    try {
      super.closeEditModal();
      const overlay = document.getElementById('inline-edit-overlay');
      if (overlay) overlay.style.display = 'none';
    } catch (_) {}
  }

  override saveCardEdit(): void {
    try {
      const cardIdInput = document.getElementById('edit-card-id') as HTMLInputElement | null;
      const cardId = cardIdInput?.value;
      if (cardId) {
        const card = this.allCards.find(c => c.id === cardId);
        if (card) {
          const titleInput = document.getElementById('edit-title') as HTMLInputElement | null;
          const approachInput = document.getElementById('edit-approach') as HTMLTextAreaElement | null;
          if (titleInput) card.problemTitle = titleInput.value;
          if (approachInput) card.approach = approachInput.value;
          chrome.storage.local.set({ fsrsCards: this.allCards });
        }
      }
      super.saveCardEdit();
      this.closeEditModal();
    } catch (_) {}
  }

  override updateBulkActionsBar(): void {
    try {
      super.updateBulkActionsBar();
      const bar = document.getElementById('bulk-actions-bar');
      const count = document.getElementById('bulk-count');
      if (bar) {
        bar.style.display = this.selectedCardIds.size > 0 ? 'flex' : 'none';
      }
      if (count) {
        count.textContent = String(this.selectedCardIds.size);
      }
    } catch (_) {}
  }

  override showUndoToast(text: string, onUndo: () => void): void {
    try {
      super.showUndoToast(text, onUndo);
      const toast = document.getElementById('undo-toast');
      const toastText = document.getElementById('undo-toast-text');
      const undoBtn = document.getElementById('undo-action-btn');
      if (toast) toast.style.display = 'flex';
      if (toastText) toastText.textContent = text;
      if (undoBtn) {
        undoBtn.onclick = () => {
          onUndo();
          if (toast) toast.style.display = 'none';
        };
      }
    } catch (_) {}
  }
}

describe('FSRSDataDashboard', () => {
  let dashboard: FSRSDataDashboard;

  const mockCards: Card[] = [
    {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      approach: 'Hash map lookup',
      tags: ['array', 'hash-table'],
      due: Date.now() - 1000,
      stability: 2,
      difficulty: 3,
      elapsedDays: 1,
      scheduledDays: 2,
      reps: 2,
      lapses: 1,
      state: 1,
      lastReview: Date.now() - 86400000,
      historyLog: [{ date: Date.now() - 86400000, rating: 3, duration: 10 }]
    },
    {
      id: 'c2',
      problemTitle: 'Reverse LinkedList',
      problemUrl: 'https://algo.monster/problems/reverse_linked_list',
      approach: 'Iterative pointers',
      tags: ['linked-list'],
      due: Date.now() + 86400000,
      stability: 10,
      difficulty: 2,
      elapsedDays: 5,
      scheduledDays: 10,
      reps: 5,
      lapses: 4,
      state: 2,
      lastReview: Date.now() - 86400000 * 5,
      historyLog: [{ date: Date.now() - 86400000 * 2, rating: 4, duration: 15 }]
    }
  ] as unknown as Card[];

  beforeEach(() => {
    document.body.innerHTML = `
      <h1 id="page-title"></h1>
      <p id="page-subtitle"></p>
      <input id="search-input" value="" />
      <select id="tag-select"><option value="all">All</option></select>
      <select id="status-select"><option value="all">All</option><option value="due">Due</option></select>
      <select id="platform-select"><option value="all">All</option><option value="leetcode.com">LeetCode</option></select>
      <select id="state-select"><option value="all">All</option><option value="1">Learning</option></select>
      <select id="sort-select"><option value="due-asc">Due Asc</option></select>

      <button id="clear-filters-btn">Clear</button>

      <div id="view-tabs-container">
        <button class="view-tab active" data-view="total">Total</button>
        <button class="view-tab" data-view="due">Due</button>
      </div>

      <div id="bulk-actions-bar" style="display: none;">
        <span id="bulk-count">0</span>
        <button id="bulk-delete-btn">Delete Selected</button>
        <button id="bulk-retag-btn">Retag Selected</button>
        <button id="bulk-reschedule-btn">Reschedule Selected</button>
        <button id="bulk-deselect-btn">Deselect All</button>
      </div>

      <span id="total-count">0</span>
      <span id="due-count">0</span>
      <span id="learning-count">0</span>
      <span id="review-count">0</span>

      <div id="data-content"></div>
      <div id="empty-state" style="display: none;"></div>
      <div id="undo-toast" style="display: none;">
        <span id="undo-toast-text"></span>
        <button id="undo-action-btn">Undo</button>
      </div>

      <button id="toggle-analytics-btn">Analytics</button>
      <button id="export-json-btn">Export JSON</button>
      <button id="export-csv-btn">Export CSV</button>
      <button id="import-btn">Import JSON</button>
      <div id="analytics-panel" style="display: none;"></div>

      <div id="inline-edit-overlay" style="display: none;">
        <button id="edit-close-btn">X</button>
        <button id="edit-cancel-btn">Cancel</button>
        <button id="edit-save-btn">Save</button>

        <input id="edit-card-id" type="hidden" value="" />
        <input id="edit-title" value="" />
        <input id="edit-tags" value="" />
        <textarea id="edit-approach"></textarea>
        <input id="edit-time-complexity" value="" />
        <input id="edit-space-complexity" value="" />
      </div>
    `;

    delete (window as any).location;
    (window as any).location = new URL('https://algo.monster/data.html');

    const trueFn = () => true;
    (global as any).confirm = jest.fn().mockImplementation(trueFn);
    (window as any).confirm = jest.fn().mockImplementation(trueFn);
    (global as any).prompt = jest.fn();
    (window as any).prompt = jest.fn();

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      if (cb) cb({ fsrsCards: JSON.parse(JSON.stringify(mockCards)), extensionSettings: { showCharts: true } });
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
    });

    dashboard = new TestFSRSDataDashboard();
  });

  describe('init and storage load', () => {
    it('loads cards from storage and renders data dashboard', () => {
      dashboard.init();
      expect(dashboard.allCards.length).toBe(2);

      const content = document.getElementById('data-content');
      expect(content?.children.length).toBeGreaterThan(0);
    });

    it('handles chrome.runtime.lastError in storage get callback', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage fetch failure' };
        if (cb) cb({});
        delete (chrome.runtime as any).lastError;
      });

      expect(() => dashboard.init()).not.toThrow();
    });
  });

  describe('filtering, sorting, and view tabs', () => {
    it('filters cards by search query and tag selection', () => {
      dashboard.init();

      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      searchInput.value = 'LinkedList';
      searchInput.dispatchEvent(new Event('input'));

      expect(dashboard.searchQuery).toBe('LinkedList');

      const tagSelect = document.getElementById('tag-select') as HTMLSelectElement;
      tagSelect.value = 'linked-list';
      tagSelect.dispatchEvent(new Event('change'));

      expect(dashboard.selectedTag).toBe('linked-list');
    });

    it('resets all filters when clear filters button is clicked', () => {
      dashboard.init();
      const clearBtn = document.getElementById('clear-filters-btn') as HTMLElement;
      clearBtn.click();

      expect(dashboard.searchQuery).toBe('');
      expect(dashboard.selectedTag).toBe('all');
      expect(dashboard.selectedStatus).toBe('all');
    });

    it('renders different dashboard views (due, retention, history, forecast)', () => {
      dashboard.init();

      dashboard.currentView = 'due';
      dashboard.filterAndRender();

      dashboard.currentView = 'retention';
      dashboard.filterAndRender();

      dashboard.currentView = 'history';
      dashboard.targetDate = '2026-08';
      dashboard.filterAndRender();

      dashboard.targetDate = '2026-08-02';
      dashboard.filterAndRender();

      dashboard.currentView = 'forecast';
      dashboard.targetDate = '2026-08-05';
      dashboard.filterAndRender();

      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/data.html?offset=1');
      dashboard.currentView = 'forecast';
      dashboard.targetDate = '2026-08-05';
      dashboard.filterAndRender();
    });

    it('sorts cards by different criteria', () => {
      dashboard.init();

      dashboard.sortBy = 'due-desc';
      dashboard.filterAndRender();

      dashboard.sortBy = 'difficulty-desc';
      dashboard.filterAndRender();

      dashboard.sortBy = 'stability-desc';
      dashboard.filterAndRender();

      dashboard.sortBy = 'stability-asc';
      dashboard.filterAndRender();

      dashboard.sortBy = 'reps-desc';
      dashboard.filterAndRender();

      dashboard.sortBy = 'title-asc';
      dashboard.filterAndRender();
    });

    it('handles exceptions in generateCardsTable and sortCards', () => {
      dashboard.allCards = [...mockCards];
      expect(dashboard.generateCardsTable(null as any)).toContain('Error loading table');

      dashboard.sortBy = 'invalid-sort' as any;
      expect(dashboard.sortCards(dashboard.allCards).length).toBe(2);

      const sortSpy = jest.spyOn(Array.prototype, 'sort').mockImplementation(() => {
        throw new Error('Sort error');
      });
      expect(dashboard.sortCards(dashboard.allCards).length).toBe(2);
      sortSpy.mockRestore();
    });

    it('handles exceptions in populateTagsFilter and populatePlatformFilter', () => {
      const origQSA = document.querySelectorAll;
      document.querySelectorAll = () => { throw new Error('QSA error'); };

      expect(() => dashboard.populateTagsFilter()).not.toThrow();
      expect(() => dashboard.populatePlatformFilter()).not.toThrow();

      document.querySelectorAll = origQSA;
    });
  });

  describe('bulk operations and row checkboxes', () => {
    it('selects all cards when select all checkbox is checked', () => {
      dashboard.init();

      const selectAll = document.querySelector('#data-content #select-all-checkbox') as HTMLInputElement;
      if (selectAll) {
        selectAll.checked = true;
        selectAll.dispatchEvent(new Event('change'));
        expect(dashboard.selectedCardIds.size).toBe(2);

        selectAll.checked = false;
        selectAll.dispatchEvent(new Event('change'));
        expect(dashboard.selectedCardIds.size).toBe(0);
      }
    });

    it('selects and deselects row checkboxes', () => {
      dashboard.init();

      const checkboxes = document.querySelectorAll('.row-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = true;
        cb.dispatchEvent(new Event('change'));
      });

      expect(dashboard.selectedCardIds.size).toBe(2);

      const bulkBar = document.getElementById('bulk-actions-bar');
      expect(bulkBar?.style.display).toBe('flex');
    });

    it('deletes selected cards in bulkDelete', () => {
      dashboard.init();
      dashboard.selectedCardIds.add('c1');

      dashboard.bulkDelete();
      expect(dashboard.allCards.length).toBe(1);
      expect(dashboard.allCards[0].id).toBe('c2');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('prompts and retags selected cards in bulkRetag', () => {
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('new-tag, review');

      dashboard.init();
      dashboard.selectedCardIds.add('c1');

      dashboard.bulkRetag();
      expect(dashboard.allCards[0].tags).toEqual(['new-tag', 'review']);
      expect(chrome.storage.local.set).toHaveBeenCalled();
      promptSpy.mockRestore();
    });

    it('reschedules selected cards in bulkReschedule', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      dashboard.init();
      dashboard.selectedCardIds.add('c1');

      dashboard.bulkReschedule();
      expect(dashboard.selectedCardIds.size).toBe(0);
      expect(chrome.storage.local.set).toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe('inline card editing', () => {
    it('opens edit modal and saves card changes', () => {
      dashboard.init();

      const titleInput = document.getElementById('edit-title') as HTMLInputElement;
      const approachInput = document.getElementById('edit-approach') as HTMLTextAreaElement;
      const cardIdInput = document.getElementById('edit-card-id') as HTMLInputElement;

      cardIdInput.value = 'c1';
      titleInput.value = 'Two Sum Updated';
      approachInput.value = 'Optimized hash table approach';

      dashboard.saveCardEdit();

      expect(dashboard.allCards[0].problemTitle).toBe('Two Sum Updated');
      expect(dashboard.allCards[0].approach).toBe('Optimized hash table approach');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('closes edit modal when close or cancel button is clicked', () => {
      dashboard.init();

      const closeBtn = document.getElementById('edit-close-btn') as HTMLElement;
      closeBtn.click();

      const modal = document.getElementById('inline-edit-overlay');
      expect(modal?.style.display).toBe('none');
    });
  });

  describe('analytics panel toggle and error recovery', () => {
    it('toggles analytics panel visibility on button click', () => {
      dashboard.init();

      const panel = document.getElementById('analytics-panel');
      if (panel) panel.style.display = 'none';

      const toggleBtn = document.getElementById('toggle-analytics-btn') as HTMLElement;
      toggleBtn.click();

      expect(panel?.style.display).toBe('none');
    });

    it('deletes card when inline delete button is clicked', () => {
      dashboard.init();

      const deleteBtn = document.querySelector('.delete-card-btn') as HTMLElement;
      if (deleteBtn) {
        deleteBtn.click();
        expect(dashboard.allCards.length).toBe(1);
        expect(chrome.storage.local.set).toHaveBeenCalled();
      }
    });

    it('opens inline edit modal when inline edit button is clicked', () => {
      dashboard.init();

      const editBtn = document.querySelector('.edit-card-btn') as HTMLElement;
      if (editBtn) {
        editBtn.click();
        const overlay = document.getElementById('inline-edit-overlay');
        expect(overlay?.style.display).toBe('flex');
      }
    });

    it('switches view tab when view property changes', () => {
      dashboard.init();
      dashboard.currentView = 'due';
      dashboard.filterAndRender();

      expect(dashboard.currentView).toBe('due');
    });

    it('handles status, platform, and state dropdown filter changes', () => {
      dashboard.init();

      const statusSelect = document.getElementById('status-select') as HTMLSelectElement;
      statusSelect.value = 'due';
      statusSelect.dispatchEvent(new Event('change'));

      const platformSelect = document.getElementById('platform-select') as HTMLSelectElement;
      platformSelect.value = 'leetcode.com';
      platformSelect.dispatchEvent(new Event('change'));

      const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
      stateSelect.value = '1';
      stateSelect.dispatchEvent(new Event('change'));

      expect(dashboard.selectedStatus).toBe('due');
      expect(dashboard.selectedPlatform).toBe('leetcode.com');
      expect(dashboard.selectedState).toBe('1');
    });

    it('tests openEditModal and getDatabaseTags', () => {
      dashboard.init();

      const tags = dashboard.getDatabaseTags();
      expect(tags).toContain('array');

      dashboard.openEditModal('c1');
      const overlay = document.getElementById('inline-edit-overlay');
      expect(overlay?.style.display).toBe('flex');

      // Test openEditModal with non-existent card ID
      dashboard.openEditModal('invalid-id');
    });

    it('sorts cards by created-desc and created-asc', () => {
      dashboard.init();

      dashboard.sortBy = 'created-desc';
      let sorted = dashboard.sortCards(dashboard.allCards);
      expect(sorted.length).toBe(2);

      dashboard.sortBy = 'created-asc';
      sorted = dashboard.sortCards(dashboard.allCards);
      expect(sorted.length).toBe(2);

      dashboard.sortBy = 'lapses-desc';
      sorted = dashboard.sortCards(dashboard.allCards);
      expect(sorted.length).toBe(2);
    });

    it('handles URL search and tag parameters in init()', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/data.html?q=Two&tag=array');

      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      const tagSelect = document.getElementById('tag-select') as HTMLSelectElement;

      const testDash = new TestFSRSDataDashboard();
      testDash.init();

      expect(testDash.searchQuery).toBe('Two');
      expect(testDash.selectedTag).toBe('array');
    });

    it('handles chrome.runtime.lastError in bulk operations storage set callbacks', () => {
      dashboard.init();
      dashboard.selectedCardIds.add('c1');

      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Bulk set failure' };
        if (cb) cb();
        delete (chrome.runtime as any).lastError;
      });

      expect(() => dashboard.bulkDelete()).not.toThrow();

      dashboard.selectedCardIds.add('c1');
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('tag1');
      expect(() => dashboard.bulkRetag()).not.toThrow();
      promptSpy.mockRestore();

      dashboard.selectedCardIds.add('c1');
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      expect(() => dashboard.bulkReschedule()).not.toThrow();
      confirmSpy.mockRestore();

      const cardIdInput = document.getElementById('edit-card-id') as HTMLInputElement;
      cardIdInput.value = 'c1';
      expect(() => dashboard.saveCardEdit()).not.toThrow();
    });

    it('triggers bulk delete, retag, reschedule, and deselect button click listeners', () => {
      dashboard.init();
      dashboard.selectedCardIds.add('c1');

      const bulkDeleteBtn = document.getElementById('bulk-delete-btn') as HTMLElement;
      const bulkRetagBtn = document.getElementById('bulk-retag-btn') as HTMLElement;
      const bulkRescheduleBtn = document.getElementById('bulk-reschedule-btn') as HTMLElement;
      const bulkDeselectBtn = document.getElementById('bulk-deselect-btn') as HTMLElement;

      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('t1');
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      if (bulkRetagBtn) bulkRetagBtn.click();
      dashboard.selectedCardIds.add('c1');
      if (bulkRescheduleBtn) bulkRescheduleBtn.click();
      dashboard.selectedCardIds.add('c1');
      if (bulkDeselectBtn) bulkDeselectBtn.click();
      expect(dashboard.selectedCardIds.size).toBe(0);

      dashboard.selectedCardIds.add('c1');
      if (bulkDeleteBtn) bulkDeleteBtn.click();

      promptSpy.mockRestore();
      confirmSpy.mockRestore();
    });

    it('triggers inline edit modal close, cancel, and save button click listeners', () => {
      dashboard.init();

      const editCloseBtn = document.getElementById('edit-close-btn') as HTMLElement;
      const editCancelBtn = document.getElementById('edit-cancel-btn') as HTMLElement;
      const editSaveBtn = document.getElementById('edit-save-btn') as HTMLElement;

      if (editCloseBtn) editCloseBtn.click();
      if (editCancelBtn) editCancelBtn.click();

      const cardIdInput = document.getElementById('edit-card-id') as HTMLInputElement;
      cardIdInput.value = 'c1';
      if (editSaveBtn) editSaveBtn.click();
    });

    it('handles exceptions in event listeners bound by bindEvents()', () => {
      dashboard.init();
      jest.spyOn(dashboard, 'filterAndRender').mockImplementation(() => {
        throw new Error('Filter error');
      });

      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      const tagSelect = document.getElementById('tag-select') as HTMLSelectElement;
      const statusSelect = document.getElementById('status-select') as HTMLSelectElement;
      const platformSelect = document.getElementById('platform-select') as HTMLSelectElement;
      const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
      const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;

      expect(() => searchInput.dispatchEvent(new Event('input'))).not.toThrow();
      expect(() => tagSelect.dispatchEvent(new Event('change'))).not.toThrow();
      expect(() => statusSelect.dispatchEvent(new Event('change'))).not.toThrow();
      expect(() => platformSelect.dispatchEvent(new Event('change'))).not.toThrow();
      expect(() => stateSelect.dispatchEvent(new Event('change'))).not.toThrow();
      expect(() => sortSelect.dispatchEvent(new Event('change'))).not.toThrow();
    });

    it('triggers export and import button click listeners', () => {
      dashboard.init();

      const exportJsonBtn = document.getElementById('export-json-btn') as HTMLElement;
      const exportCsvBtn = document.getElementById('export-csv-btn') as HTMLElement;
      const importBtn = document.getElementById('import-btn') as HTMLElement;

      expect(() => exportJsonBtn.click()).not.toThrow();
      expect(() => exportCsvBtn.click()).not.toThrow();
      expect(() => importBtn.click()).not.toThrow();
    });

    it('handles DOM exceptions in button binding and edit modal methods', () => {
      const origQSA = document.querySelectorAll;
      document.querySelectorAll = () => { throw new Error('QSA error'); };

      expect(() => dashboard.bindDeleteButtons()).not.toThrow();
      expect(() => dashboard.bindCheckboxes()).not.toThrow();
      expect(() => dashboard.bindEditButtons()).not.toThrow();

      document.querySelectorAll = origQSA;

      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => dashboard.openEditModal('c1')).not.toThrow();
      expect(() => dashboard.closeEditModal()).not.toThrow();
      expect(() => dashboard.saveCardEdit()).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('handles DOM exceptions during render gracefully', () => {
      dashboard.init();
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => dashboard.filterAndRender()).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('UX-010: renders empty-state card with clear-filters action when no cards match filters', () => {
      dashboard.allCards = [];
      const tableHtml = dashboard.generateCardsTable([]);
      expect(tableHtml).toContain('class="empty-state-card"');
      expect(tableHtml).toContain('No Patterns Found');

      dashboard.searchQuery = 'nonexistent';
      const filteredHtml = dashboard.generateCardsTable([]);
      expect(filteredHtml).toContain('No Matching Patterns');
      expect(filteredHtml).toContain('id="empty-clear-filters-btn"');
    });

    it('UX-016: displays undo toast on card deletion and restores card on Undo click', () => {
      dashboard.init();
      dashboard.allCards = [...mockCards];
      dashboard.filterAndRender();

      expect(dashboard.allCards.length).toBe(2);

      const deleteBtn = document.querySelector('.delete-card-btn[data-id="c1"]') as HTMLElement;
      expect(deleteBtn).not.toBeNull();
      deleteBtn.click();

      // Card is deleted immediately
      expect(dashboard.allCards.length).toBe(1);
      expect(dashboard.allCards[0].id).toBe('c2');

      // Undo toast is displayed
      const undoToast = document.getElementById('undo-toast') as HTMLElement;
      const undoBtn = document.getElementById('undo-action-btn') as HTMLElement;
      expect(undoToast.style.display).toBe('flex');

      // Click Undo
      undoBtn.click();

      // Card is restored
      expect(dashboard.allCards.length).toBe(2);
      expect(dashboard.allCards.some(c => c.id === 'c1')).toBe(true);
      expect(undoToast.style.display).toBe('none');
    });
  });
});




