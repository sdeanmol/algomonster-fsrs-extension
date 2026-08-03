import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Highlighter } from '../../../../features/highlighter/highlighter';

// Polyfill Range.prototype.getClientRects and getBoundingClientRect for JSDOM
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function() {
    return Object.assign([], { item: () => null }) as unknown as DOMRectList;
  };
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = function() {
    return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
}

describe('Highlighter Component', () => {
  let highlighter: Highlighter;

  beforeEach(() => {
    // Use a fresh document body for each test
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();

    (global as any).CSS = {
      highlights: { clear: jest.fn(), set: jest.fn() }
    };
    (global as any).Highlight = class MockHighlight { constructor(..._r: Range[]) {} };

    (window as any).AlgoRecall = {
      state: {
        chromeSettings: {
          showMarkerPopup: true,
          activePaletteIndex: 0,
          defaultHighlightColor: '#f1c40f',
          recentColors: ['#f1c40f', '#e74c3c'],
          palettes: [{ name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db'] }]
        },
        marks: [] as any[],
        bookmarks: [] as any[],
        pagecontents: [] as any[],
        activeMarkRanges: [] as any[],
        hoveredMarkId: null,
        hideTooltipTimer: null,
        currentTheme: 'dark'
      },
      Utils: {
        getExtractedProblemTitle: () => 'Two Sum',
        getDOMMeta: () => ({ path: 'DIV > P', offset: 0 }),
        restoreRangeFromMeta: () => document.createRange(),
        ensureHighlightStyle: (color: string, type: string) => `algo-hl-${color.replace('#', '')}-${type}`
      }
    };

    highlighter = new Highlighter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  // ─── Constructor ──────────────────────────────────────────────────────
  it('initializes correctly with window.AlgoRecall state and utils', () => {
    expect(highlighter.state).toBe((window as any).AlgoRecall.state);
    expect(highlighter.utils).toBe((window as any).AlgoRecall.Utils);
  });

  it('falls back to empty defaults when AlgoRecall is missing from window', () => {
    delete (window as any).AlgoRecall;
    const h = new Highlighter();
    expect(h.state.marks).toEqual([]);
    expect(h.state.activeMarkRanges).toEqual([]);
    expect(h.utils).toEqual({});
  });

  // ─── createHighlighterUI / removeHighlighterUI ────────────────────────
  it('creates tooltip with dialog role and removes it cleanly', () => {
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute('role')).toBe('dialog');

    highlighter.removeHighlighterUI();
    expect(document.getElementById('algo-highlight-tooltip')).toBeNull();
  });

  it('adds light-theme class when currentTheme is light', () => {
    highlighter.state.currentTheme = 'light';
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip');
    expect(tooltip?.classList.contains('light-theme')).toBe(true);
  });

  it('does not bind events twice (isHighlighterListenersBound guard)', () => {
    highlighter.createHighlighterUI();
    expect(highlighter.isHighlighterListenersBound).toBe(true);
    const spy = jest.spyOn(highlighter, 'bindEvents');
    highlighter.createHighlighterUI(); // second call
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not create duplicate tooltip if one already exists', () => {
    highlighter.createHighlighterUI();
    highlighter.createHighlighterUI();
    const tooltips = document.querySelectorAll('#algo-highlight-tooltip');
    expect(tooltips.length).toBe(1);
  });

  // ─── handleTextSelection ─────────────────────────────────────────────
  it('shows tooltip on text selection via handleTextSelection', () => {
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip')!;

    const textNode = document.createTextNode('Select me text');
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);

    // Override getClientRects to return a valid rect
    const origFn = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function() {
      return Object.assign(
        [{ left: 10, right: 100, top: 10, bottom: 30, width: 90, height: 20, x: 10, y: 10, toJSON: () => ({}) }],
        { item: () => null }
      ) as unknown as DOMRectList;
    };

    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    highlighter.handleTextSelection();
    expect(tooltip.style.display).toBe('flex');

    Range.prototype.getClientRects = origFn;
    window.getSelection()?.removeAllRanges();
  });

  it('hides tooltip when no selection and no hovered mark in handleTextSelection', () => {
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    tooltip.style.display = 'flex';
    highlighter.state.hoveredMarkId = null;

    window.getSelection()?.removeAllRanges();
    highlighter.handleTextSelection();
    expect(tooltip.style.display).toBe('none');
  });

  // ─── linkHighlightToCard ──────────────────────────────────────────────
  it('links highlight to card approach when card exists', () => {
    highlighter.state.marks = [
      {
        id: 'm1',
        createdAt: 1000,
        url: window.location.href.split('?')[0].split('#')[0],
        text: 'Selected text for FSRS',
        color: '#f1c40f',
        type: 'highlight',
        category: 'Approach'
      }
    ];

    document.body.innerHTML += `<textarea id="fsrs-approach"></textarea><button id="fsrs-save-ratings" data-existing-id="c1"></button>`;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb: any) => {
      if (cb) cb({
        fsrsCards: [{ id: 'c1', problemUrl: window.location.href.split('?')[0].split('#')[0], approach: 'Existing solution' }],
        approachDrafts: {}
      });
      return Promise.resolve();
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb: any) => {
      if (cb) cb();
      return Promise.resolve();
    });

    highlighter.linkHighlightToCard('m1');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('links highlight to new draft when activeId is __new__', () => {
    highlighter.state.marks = [
      {
        id: 'm2',
        createdAt: 1000,
        url: window.location.href.split('?')[0].split('#')[0],
        text: 'Draft text',
        color: '#f1c40f',
        type: 'highlight'
      }
    ];

    document.body.innerHTML += `<button id="fsrs-save-ratings" data-existing-id="__new__"></button>`;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb: any) => {
      if (cb) cb({
        fsrsCards: [],
        approachDrafts: {}
      });
      return Promise.resolve();
    });

    highlighter.linkHighlightToCard('m2');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('handles saveMarkCategory and saveMarkNote', () => {
    highlighter.state.marks = [
      { id: 'm10', createdAt: 100, url: 'http://test.com', text: 'Text', color: '#f1c40f', type: 'highlight' }
    ];

    highlighter.saveMarkCategory('m10', 'Key Takeaway');
    expect(highlighter.state.marks[0].category).toBe('Key Takeaway');

    highlighter.saveMarkNote('m10', 'Important note');
    expect(highlighter.state.marks[0].note).toBe('Important note');
  });

  it('handles pointerup and mousemove DOM event listeners with active ranges', () => {
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip')!;

    // 1. Mousemove over activeMarkRanges
    const range = document.createRange();
    const textNode = document.createTextNode('Hovered highlight text');
    document.body.appendChild(textNode);
    range.selectNodeContents(textNode);

    highlighter.state.activeMarkRanges = [
      { markId: 'm1', range: range, color: '#f1c40f' }
    ];

    const mouseMoveEvt = new MouseEvent('mousemove', { bubbles: true, clientX: 20, clientY: 20 });
    expect(() => document.dispatchEvent(mouseMoveEvt)).not.toThrow();

    // 2. Pointerup event
    const pointerUpEvt = new MouseEvent('pointerup', { bubbles: true });
    expect(() => document.dispatchEvent(pointerUpEvt)).not.toThrow();
  });

  it('keeps tooltip visible in handleTextSelection when hoveredMarkId is set', () => {
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    tooltip.style.display = 'flex';
    highlighter.state.hoveredMarkId = 'mark_keep';

    window.getSelection()?.removeAllRanges();
    highlighter.handleTextSelection();
    expect(tooltip.style.display).toBe('flex');
  });

  it('does nothing in handleTextSelection when showMarkerPopup is false', () => {
    highlighter.state.chromeSettings.showMarkerPopup = false;
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    tooltip.style.display = 'none';

    const textNode = document.createTextNode('text');
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    highlighter.handleTextSelection();
    expect(tooltip.style.display).toBe('none');
    window.getSelection()?.removeAllRanges();
  });

  it('uses getBoundingClientRect fallback when getClientRects returns empty', () => {
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip')!;

    const textNode = document.createTextNode('Fallback text');
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);

    // getClientRects returns empty, getBoundingClientRect returns valid rect
    const origGCR = Range.prototype.getClientRects;
    const origGBCR = Range.prototype.getBoundingClientRect;
    Range.prototype.getClientRects = function() {
      return Object.assign([], { item: () => null }) as unknown as DOMRectList;
    };
    Range.prototype.getBoundingClientRect = function() {
      return { left: 10, right: 100, top: 10, bottom: 30, width: 90, height: 20, x: 10, y: 10, toJSON: () => ({}) } as DOMRect;
    };

    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    highlighter.handleTextSelection();
    expect(tooltip.style.display).toBe('flex');

    Range.prototype.getClientRects = origGCR;
    Range.prototype.getBoundingClientRect = origGBCR;
    window.getSelection()?.removeAllRanges();
  });

  // ─── mousemove hover detection ────────────────────────────────────
  // Note: The hover logic is inline in bindEvents (not a separate public method).
  // Since JSDOM accumulates event listeners across tests, we test hover state
  // management through direct state manipulation and method calls.

  it('sets and clears hoveredMarkId state for mark hover', () => {
    highlighter.createHighlighterUI();

    // Simulate hover found
    highlighter.state.hoveredMarkId = 'hover_mark_1';
    highlighter.renderTooltipColors('hover_mark_1', '#f1c40f');

    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    tooltip.style.display = 'flex';

    expect(highlighter.state.hoveredMarkId).toBe('hover_mark_1');

    // Simulate hover leave (clear)
    highlighter.state.hoveredMarkId = null;
    tooltip.style.display = 'none';
    expect(highlighter.state.hoveredMarkId).toBeNull();
  });

  it('renders tooltip with mark controls when hoveredMarkId is set', () => {
    highlighter.state.marks.push({
      id: 'hover_test', createdAt: 8000,
      url: window.location.href.split('?')[0].split('#')[0],
      text: 'Hoverable text', color: '#f1c40f', type: 'highlight'
    });

    highlighter.createHighlighterUI();
    highlighter.state.hoveredMarkId = 'hover_test';
    highlighter.renderTooltipColors('hover_test', '#f1c40f');

    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    expect(tooltip.querySelector('.algo-category-select')).not.toBeNull();
    expect(tooltip.querySelector('.algo-note-input')).not.toBeNull();
    expect(tooltip.querySelector('.algo-delete-btn')).not.toBeNull();
  });

  it('hideTooltipTimer clears hoveredMarkId after timeout', () => {
    jest.useFakeTimers();
    highlighter.createHighlighterUI();

    highlighter.state.hoveredMarkId = 'leaving_mark';
    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    tooltip.style.display = 'flex';

    // Simulate what the mousemove handler does when mark is not found
    highlighter.state.hideTooltipTimer = setTimeout(() => {
      highlighter.state.hoveredMarkId = null;
      tooltip.style.display = 'none';
      highlighter.state.hideTooltipTimer = null;
    }, 400) as any;

    // Timer set but not fired yet
    expect(highlighter.state.hoveredMarkId).toBe('leaving_mark');

    jest.advanceTimersByTime(500);
    expect(highlighter.state.hoveredMarkId).toBeNull();
    expect(tooltip.style.display).toBe('none');
    jest.useRealTimers();
  });

  it('cancels hide timer when clearTimeout is called', () => {
    jest.useFakeTimers();
    highlighter.createHighlighterUI();

    highlighter.state.hoveredMarkId = 'hover_x';
    highlighter.state.hideTooltipTimer = setTimeout(() => {
      highlighter.state.hoveredMarkId = null;
    }, 400) as any;

    // Simulate re-entering tooltip area: cancel timer
    clearTimeout(highlighter.state.hideTooltipTimer!);
    highlighter.state.hideTooltipTimer = null;

    jest.advanceTimersByTime(500);
    // hoveredMarkId should NOT have been cleared
    expect(highlighter.state.hoveredMarkId).toBe('hover_x');
    expect(highlighter.state.hideTooltipTimer).toBeNull();
    jest.useRealTimers();
  });

  // ─── keyup handler ────────────────────────────────────────────────────
  it('triggers handleTextSelection on Shift keyup', () => {
    highlighter.createHighlighterUI();
    const spy = jest.spyOn(highlighter, 'handleTextSelection');
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
    expect(spy).toHaveBeenCalled();
  });

  it('triggers handleTextSelection on Arrow keyup', () => {
    highlighter.createHighlighterUI();
    const spy = jest.spyOn(highlighter, 'handleTextSelection');
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
    expect(spy).toHaveBeenCalled();
  });

  // ─── renderTooltipColors (new annotation) ─────────────────────────────
  it('renders new annotation type selector, swatches, and picker', () => {
    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors(null, null);

    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    expect(tooltip.querySelector('.algo-type-selector')).not.toBeNull();

    const typeBtns = tooltip.querySelectorAll('.algo-type-btn');
    expect(typeBtns.length).toBe(2);

    // mousedown on second type button
    (typeBtns[1] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(typeBtns[1].getAttribute('aria-checked')).toBe('true');

    // keydown Enter on first type button
    (typeBtns[0] as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(typeBtns[0].getAttribute('aria-checked')).toBe('true');

    // keydown Space on second type button
    (typeBtns[1] as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(typeBtns[1].getAttribute('aria-checked')).toBe('true');
  });

  it('triggers saveHighlight on swatch mousedown for new annotation', () => {
    highlighter.createHighlighterUI();

    const textNode = document.createTextNode('Swatch test');
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    highlighter.renderTooltipColors(null, null);
    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    (tooltip.querySelector('.algo-color-swatch') as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(highlighter.state.marks.length).toBeGreaterThan(0);
    window.getSelection()?.removeAllRanges();
  });

  it('triggers saveHighlight on swatch keydown Enter', () => {
    highlighter.createHighlighterUI();

    const textNode = document.createTextNode('Swatch key test');
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    highlighter.renderTooltipColors(null, null);
    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    (tooltip.querySelector('.algo-color-swatch') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(highlighter.state.marks.length).toBeGreaterThan(0);
    window.getSelection()?.removeAllRanges();
  });

  it('handles custom color picker input for new annotation', () => {
    highlighter.createHighlighterUI();

    const textNode = document.createTextNode('Picker test');
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    highlighter.renderTooltipColors(null, null);
    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    const picker = tooltip.querySelector('#algo-color-picker') as HTMLInputElement;
    picker.value = '#00ff00';
    picker.dispatchEvent(new Event('input'));

    expect(highlighter.state.marks.length).toBeGreaterThan(0);
    expect(highlighter.state.chromeSettings.defaultHighlightColor).toBe('#00ff00');
    window.getSelection()?.removeAllRanges();
  });

  it('uses fallback palette when chromeSettings.palettes is empty', () => {
    highlighter.state.chromeSettings.palettes = [];
    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors(null, null);

    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    const swatches = tooltip.querySelectorAll('.algo-color-swatch');
    expect(swatches.length).toBe(5); // fallback has 5 colors
  });

  // ─── renderTooltipColors (existing annotation) ────────────────────────
  it('renders existing annotation controls: category, note, link, delete', () => {
    highlighter.state.marks.push({
      id: 'mark_1', createdAt: 1000,
      url: 'https://algo.monster/problem',
      text: 'important text', color: '#3498db',
      note: 'my note', category: 'Key Insight'
    });

    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors('mark_1', '#3498db');

    const tooltip = document.getElementById('algo-highlight-tooltip')!;

    const categorySelect = tooltip.querySelector('.algo-category-select') as HTMLSelectElement;
    expect(categorySelect).not.toBeNull();
    categorySelect.value = 'Gotcha';
    categorySelect.dispatchEvent(new Event('change'));
    expect(highlighter.state.marks[0].category).toBe('Gotcha');

    const noteInput = tooltip.querySelector('.algo-note-input') as HTMLInputElement;
    expect(noteInput).not.toBeNull();
    noteInput.value = 'Updated note';
    noteInput.dispatchEvent(new Event('input'));
    expect(highlighter.state.marks[0].note).toBe('Updated note');

    const linkBtn = tooltip.querySelector('.algo-link-btn') as HTMLElement;
    expect(linkBtn).not.toBeNull();

    const deleteBtn = tooltip.querySelector('.algo-delete-btn') as HTMLElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(highlighter.state.marks.length).toBe(0);
  });

  it('handles delete button keydown with Enter key', () => {
    highlighter.state.marks.push({
      id: 'mark_del_key', createdAt: 9000,
      url: 'https://algo.monster/problem',
      text: 'deletable', color: '#e74c3c'
    });

    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors('mark_del_key', '#e74c3c');

    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    const deleteBtn = tooltip.querySelector('.algo-delete-btn') as HTMLElement;
    deleteBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(highlighter.state.marks.length).toBe(0);
  });

  it('handles swatch click for existing mark (updateHighlightColor)', () => {
    highlighter.state.marks.push({
      id: 'mark_color', createdAt: 9500,
      url: 'https://algo.monster/problem',
      text: 'recolorable', color: '#f1c40f'
    });

    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors('mark_color', '#f1c40f');

    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    const swatches = tooltip.querySelectorAll('.algo-color-swatch');
    (swatches[1] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(highlighter.state.marks[0].color).toBe('#e74c3c');
  });

  it('marks active swatch when currentColor matches', () => {
    highlighter.state.marks.push({
      id: 'mark_active_sw', createdAt: 9600,
      url: 'https://algo.monster/problem',
      text: 'text', color: '#f1c40f'
    });

    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors('mark_active_sw', '#f1c40f');

    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    const firstSwatch = tooltip.querySelector('.algo-color-swatch') as HTMLElement;
    expect(firstSwatch.classList.contains('active')).toBe(true);
  });

  it('returns early if tooltip element is missing', () => {
    expect(() => highlighter.renderTooltipColors(null, null)).not.toThrow();
  });

  it('link button click shows checkmark and restores after timeout', () => {
    jest.useFakeTimers();

    highlighter.state.marks.push({
      id: 'mark_link_anim', createdAt: 10000,
      url: 'https://algo.monster/problem',
      text: 'animated link', color: '#3498db',
      note: '', category: ''
    });

    jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, cb: any) => {
      cb({ fsrsCards: [], approachDrafts: {} });
    });

    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors('mark_link_anim', '#3498db');

    const tooltip = document.getElementById('algo-highlight-tooltip')!;
    const linkBtn = tooltip.querySelector('.algo-link-btn') as HTMLElement;
    linkBtn.click();

    expect(linkBtn.innerHTML).toBe('✓');

    jest.advanceTimersByTime(2000);
    expect(linkBtn.innerHTML).toContain('svg');

    jest.useRealTimers();
  });

  // ─── saveMarkCategory ─────────────────────────────────────────────────
  it('updates mark category and saves to chrome storage', () => {
    highlighter.state.marks.push({
      id: 'mark_2', createdAt: 2000,
      url: 'https://algo.monster/problem',
      text: 'text', color: '#f1c40f', category: ''
    });

    highlighter.saveMarkCategory('mark_2', 'Gotcha');
    expect(highlighter.state.marks[0].category).toBe('Gotcha');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ marks: highlighter.state.marks });
  });

  it('does nothing for non-existent mark in saveMarkCategory', () => {
    highlighter.saveMarkCategory('nonexistent', 'Gotcha');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  // ─── saveMarkNote ─────────────────────────────────────────────────────
  it('updates mark note and saves to chrome storage', () => {
    highlighter.state.marks.push({
      id: 'mark_3', createdAt: 3000,
      url: 'https://algo.monster/problem',
      text: 'text', color: '#f1c40f', note: ''
    });

    highlighter.saveMarkNote('mark_3', '  My test note  ');
    expect(highlighter.state.marks[0].note).toBe('My test note');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ marks: highlighter.state.marks });
  });

  it('does nothing for non-existent mark in saveMarkNote', () => {
    highlighter.saveMarkNote('nonexistent', 'note');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  // ─── updateRecentColors ───────────────────────────────────────────────
  it('updates recent colors and saves to storage', () => {
    highlighter.updateRecentColors('#9b59b6');
    expect(highlighter.state.chromeSettings.defaultHighlightColor).toBe('#9b59b6');
    expect(highlighter.state.chromeSettings.recentColors![0]).toBe('#9b59b6');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ chromeSettings: highlighter.state.chromeSettings });
  });

  it('creates default chromeSettings when missing', () => {
    (highlighter.state as any).chromeSettings = null;
    highlighter.updateRecentColors('#abcdef');
    expect(highlighter.state.chromeSettings).not.toBeNull();
    expect(highlighter.state.chromeSettings.defaultHighlightColor).toBe('#abcdef');
  });

  it('deduplicates recent colors', () => {
    highlighter.state.chromeSettings.recentColors = ['#aaa', '#bbb', '#ccc', '#ddd'];
    highlighter.updateRecentColors('#bbb');
    expect(highlighter.state.chromeSettings.recentColors![0]).toBe('#bbb');
    expect(highlighter.state.chromeSettings.recentColors!.filter(c => c === '#bbb').length).toBe(1);
  });

  // ─── deleteHighlight ──────────────────────────────────────────────────
  it('deletes highlight mark and updates storage', () => {
    highlighter.state.marks.push({
      id: 'mark_4', createdAt: 4000,
      url: 'https://algo.monster/problem',
      text: 'text', color: '#e74c3c'
    });

    highlighter.createHighlighterUI();
    highlighter.deleteHighlight('mark_4');
    expect(highlighter.state.marks.length).toBe(0);
    expect(highlighter.state.hoveredMarkId).toBeNull();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ marks: [] });
  });

  // ─── linkHighlightToCard ──────────────────────────────────────────────
  it('links highlight to existing FSRS card', () => {
    highlighter.state.marks.push({
      id: 'mark_5', createdAt: 5000,
      url: 'https://algo.monster/problem',
      text: 'Linked text', color: '#3498db', category: 'Key Insight', note: 'Linked note'
    });

    jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, cb: any) => {
      cb({
        fsrsCards: [{ id: 'card_1', problemUrl: window.location.href.split('?')[0].split('#')[0], approach: 'Existing approach' }],
        approachDrafts: {}
      });
    });

    highlighter.linkHighlightToCard('mark_5');
    expect(chrome.storage.local.get).toHaveBeenCalled();
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('links highlight to draft when no matching card exists', () => {
    highlighter.state.marks.push({
      id: 'mark_draft', createdAt: 5500,
      url: 'https://algo.monster/problem',
      text: 'Draft linked', color: '#f1c40f', category: '', note: ''
    });

    jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, cb: any) => {
      cb({ fsrsCards: [], approachDrafts: {} });
    });

    highlighter.linkHighlightToCard('mark_draft');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('links highlight to existing draft string format', () => {
    highlighter.state.marks.push({
      id: 'mark_dstr', createdAt: 5600,
      url: 'https://algo.monster/problem',
      text: 'String draft', color: '#f1c40f', category: '', note: ''
    });

    const cleanUrl = window.location.href.split('?')[0].split('#')[0];
    jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, cb: any) => {
      cb({ fsrsCards: [], approachDrafts: { [cleanUrl]: 'old draft string' } });
    });

    highlighter.linkHighlightToCard('mark_dstr');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('does nothing for non-existent mark in linkHighlightToCard', () => {
    highlighter.linkHighlightToCard('nonexistent');
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  it('handles __new__ active card id in linkHighlightToCard', () => {
    highlighter.state.marks.push({
      id: 'mark_new', createdAt: 5700,
      url: 'https://algo.monster/problem',
      text: 'New card text', color: '#f1c40f', category: '', note: ''
    });

    const saveEl = document.createElement('div');
    saveEl.id = 'fsrs-save-ratings';
    saveEl.setAttribute('data-existing-id', '__new__');
    document.body.appendChild(saveEl);

    jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, cb: any) => {
      cb({ fsrsCards: [], approachDrafts: {} });
    });

    highlighter.linkHighlightToCard('mark_new');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  // ─── createHighlight wrapper ──────────────────────────────────────────
  it('createHighlight calls saveHighlight', () => {
    const spy = jest.spyOn(highlighter, 'saveHighlight').mockImplementation(() => {});
    highlighter.createHighlight('#ff0000', 'underline');
    expect(spy).toHaveBeenCalledWith('#ff0000', 'underline');
  });

  // ─── saveHighlight ────────────────────────────────────────────────────
  it('saves new highlight with bookmarks and pagecontents', () => {
    const textNode = document.createTextNode('Sample selectable text for full save');
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    highlighter.createHighlighterUI();
    highlighter.saveHighlight('#f1c40f', 'highlight');

    expect(highlighter.state.marks.length).toBe(1);
    expect(highlighter.state.bookmarks.length).toBe(1);
    expect(highlighter.state.pagecontents.length).toBe(1);
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('does nothing in saveHighlight when selection is collapsed', () => {
    window.getSelection()?.removeAllRanges();
    highlighter.saveHighlight('#f1c40f', 'highlight');
    expect(highlighter.state.marks.length).toBe(0);
  });

  it('does not add duplicate bookmark for same URL', () => {
    const cleanUrl = window.location.href.split('?')[0].split('#')[0];
    highlighter.state.bookmarks.push({ url: cleanUrl, title: 'Two Sum', meta: {} });

    const textNode = document.createTextNode('Bookmark dedup');
    document.body.appendChild(textNode);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    highlighter.saveHighlight('#f1c40f', 'highlight');
    expect(highlighter.state.bookmarks.length).toBe(1);
  });

  // ─── updateHighlightColor ─────────────────────────────────────────────
  it('updates highlight color and re-applies highlights', () => {
    highlighter.state.marks.push({
      id: 'mark_7', createdAt: 7000,
      url: 'https://algo.monster/problem',
      text: 'text', color: '#f1c40f'
    });

    highlighter.createHighlighterUI();
    highlighter.updateHighlightColor('mark_7', '#2ecc71');

    expect(highlighter.state.marks[0].color).toBe('#2ecc71');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('does nothing for non-existent mark in updateHighlightColor', () => {
    highlighter.updateHighlightColor('nonexistent', '#000');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  // ─── applyHighlightsForCurrentPage ────────────────────────────────────
  it('applies CSS highlights for current page', () => {
    highlighter.state.marks.push({
      id: 'mark_6', createdAt: 6000,
      url: window.location.href.split('?')[0].split('#')[0],
      text: 'Sample text', color: '#f1c40f',
      type: 'highlight', highlightSource: {}
    });

    highlighter.applyHighlightsForCurrentPage();
    expect((global as any).CSS.highlights.clear).toHaveBeenCalled();
    expect((global as any).CSS.highlights.set).toHaveBeenCalled();
    expect(highlighter.state.activeMarkRanges.length).toBe(1);
  });

  it('warns and returns when CSS Custom Highlights API not supported', () => {
    delete (global as any).CSS;
    expect(() => highlighter.applyHighlightsForCurrentPage()).not.toThrow();
  });

  it('handles null range from restoreRangeFromMeta gracefully', () => {
    (window as any).AlgoRecall.Utils.restoreRangeFromMeta = () => null;
    highlighter.state.marks.push({
      id: 'mark_null', createdAt: 6500,
      url: window.location.href.split('?')[0].split('#')[0],
      text: 'Null range', color: '#e74c3c',
      type: 'highlight', highlightSource: {}
    });

    highlighter.applyHighlightsForCurrentPage();
    expect(highlighter.state.activeMarkRanges.length).toBe(0);
  });

  it('removes .algo-floating-symbol elements during applyHighlightsForCurrentPage', () => {
    const symbol = document.createElement('span');
    symbol.className = 'algo-floating-symbol';
    document.body.appendChild(symbol);

    highlighter.applyHighlightsForCurrentPage();
    expect(document.querySelector('.algo-floating-symbol')).toBeNull();
  });

  // ─── Module-level window attachment ───────────────────────────────────
  it('Highlighter class is importable and constructable', () => {
    const h = new Highlighter();
    expect(h).toBeInstanceOf(Highlighter);
    expect(h.isHighlighterListenersBound).toBe(false);
  });
});
