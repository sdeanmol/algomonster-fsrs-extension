import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Highlighter } from '../../features/highlighter/highlighter';

describe('Highlighter Component', () => {
  let highlighter: Highlighter;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();

    (global as any).CSS = {
      highlights: {
        clear: jest.fn(),
        set: jest.fn()
      }
    };
    (global as any).Highlight = class MockHighlight {};

    (window as any).AlgoRecall = {
      state: {
        chromeSettings: {
          showMarkerPopup: true,
          activePaletteIndex: 0,
          palettes: [{ name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db'] }]
        },
        marks: [],
        bookmarks: [],
        pagecontents: [],
        activeMarkRanges: [],
        hoveredMarkId: null
      },
      Utils: {
        getExtractedProblemTitle: () => 'Two Sum',
        getDOMMeta: () => ({ path: 'DIV > P', offset: 0 }),
        restoreRangeFromMeta: () => document.createRange(),
        ensureHighlightStyle: (color: string, type: string) => `style_${color}_${type}`
      }
    };

    highlighter = new Highlighter();
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  it('initializes correctly with window.AlgoRecall state and utils', () => {
    expect(highlighter.state).toBe((window as any).AlgoRecall.state);
    expect(highlighter.utils).toBe((window as any).AlgoRecall.Utils);
  });

  it('creates and removes highlighter UI tooltip container in DOM', () => {
    highlighter.createHighlighterUI();
    const tooltip = document.getElementById('algo-highlight-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute('role')).toBe('dialog');

    highlighter.removeHighlighterUI();
    expect(document.getElementById('algo-highlight-tooltip')).toBeNull();
  });

  it('handles pointerup selection event and shows tooltip popup', () => {
    highlighter.createHighlighterUI();

    const textNode = document.createTextNode('Sample selectable text for popup');
    document.body.appendChild(textNode);

    const range = document.createRange();
    range.selectNodeContents(textNode);
    (range as any).getClientRects = jest.fn().mockReturnValue([
      { left: 10, right: 100, top: 10, bottom: 30, width: 90, height: 20, x: 10, y: 10 }
    ]);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    document.dispatchEvent(new Event('pointerup', { bubbles: true }));

    const tooltip = document.getElementById('algo-highlight-tooltip');
    expect(tooltip).not.toBeNull();

    selection?.removeAllRanges();
  });

  it('handles mousemove hover event over active mark ranges', () => {
    window.getSelection()?.removeAllRanges();
    highlighter.createHighlighterUI();

    const mark = {
      id: 'hover_mark_1',
      createdAt: 8000,
      url: window.location.href.split('?')[0].split('#')[0],
      text: 'Hovered text',
      color: '#f1c40f',
      type: 'highlight'
    };
    highlighter.state.marks.push(mark);

    const range = document.createRange();
    (range as any).getClientRects = jest.fn().mockReturnValue([
      { left: 50, right: 150, top: 50, bottom: 80, width: 100, height: 30, x: 50, y: 50 }
    ]);

    highlighter.state.activeMarkRanges = [
      { markId: 'hover_mark_1', range: range, color: '#f1c40f' }
    ];

    const mouseEvent = new MouseEvent('mousemove', { clientX: 70, clientY: 60, bubbles: true });
    document.dispatchEvent(mouseEvent);

    expect(highlighter.state.hoveredMarkId).toBe('hover_mark_1');

    const mouseLeaveEvent = new MouseEvent('mousemove', { clientX: 500, clientY: 500, bubbles: true });
    document.dispatchEvent(mouseLeaveEvent);
  });

  it('renders new annotation controls (type selector, swatches, picker) when no markId is passed', () => {
    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors(null, null);

    const tooltip = document.getElementById('algo-highlight-tooltip');
    expect(tooltip?.querySelector('.algo-type-selector')).not.toBeNull();

    const typeBtns = tooltip?.querySelectorAll('.algo-type-btn');
    expect(typeBtns?.length).toBe(2);
    (typeBtns?.[1] as HTMLElement).click();

    const swatch = tooltip?.querySelector('.algo-color-swatch') as HTMLElement;
    swatch.click();

    const picker = tooltip?.querySelector('#algo-color-picker') as HTMLInputElement;
    picker.value = '#00ff00';
    picker.dispatchEvent(new Event('input'));
  });

  it('renders existing annotation controls (note, category, link button, delete) when markId is provided', () => {
    (window as any).AlgoRecall.state.marks.push({
      id: 'mark_1',
      createdAt: 1000,
      url: 'https://algo.monster/problem',
      text: 'important text',
      color: '#3498db',
      note: 'my note',
      category: 'Key Insight'
    });

    highlighter.createHighlighterUI();
    highlighter.renderTooltipColors('mark_1', '#3498db');

    const tooltip = document.getElementById('algo-highlight-tooltip');

    const categorySelect = tooltip?.querySelector('.algo-category-select') as HTMLSelectElement;
    expect(categorySelect).not.toBeNull();
    categorySelect.value = 'Gotcha';
    categorySelect.dispatchEvent(new Event('change'));

    const noteInput = tooltip?.querySelector('.algo-note-input') as HTMLInputElement;
    expect(noteInput).not.toBeNull();
    noteInput.value = 'Updated note';
    noteInput.dispatchEvent(new Event('input'));

    const linkBtn = tooltip?.querySelector('.algo-link-btn') as HTMLElement;
    expect(linkBtn).not.toBeNull();
    linkBtn.click();

    const deleteBtn = tooltip?.querySelector('.algo-delete-btn') as HTMLElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  });

  it('updates mark category and saves to chrome storage', () => {
    (window as any).AlgoRecall.state.marks.push({
      id: 'mark_2',
      createdAt: 2000,
      url: 'https://algo.monster/problem',
      text: 'text',
      color: '#f1c40f',
      category: ''
    });

    highlighter.saveMarkCategory('mark_2', 'Gotcha');
    expect((window as any).AlgoRecall.state.marks[0].category).toBe('Gotcha');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ marks: (window as any).AlgoRecall.state.marks });
  });

  it('updates mark note and saves to chrome storage', () => {
    (window as any).AlgoRecall.state.marks.push({
      id: 'mark_3',
      createdAt: 3000,
      url: 'https://algo.monster/problem',
      text: 'text',
      color: '#f1c40f',
      note: ''
    });

    highlighter.saveMarkNote('mark_3', 'My test note');
    expect((window as any).AlgoRecall.state.marks[0].note).toBe('My test note');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ marks: (window as any).AlgoRecall.state.marks });
  });

  it('updates recent colors in chrome settings and saves to storage', () => {
    highlighter.updateRecentColors('#9b59b6');
    expect(highlighter.state.chromeSettings.defaultHighlightColor).toBe('#9b59b6');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ chromeSettings: highlighter.state.chromeSettings });
  });

  it('deletes highlight mark and updates storage', () => {
    (window as any).AlgoRecall.state.marks.push({
      id: 'mark_4',
      createdAt: 4000,
      url: 'https://algo.monster/problem',
      text: 'text',
      color: '#e74c3c'
    });

    highlighter.deleteHighlight('mark_4');
    expect((window as any).AlgoRecall.state.marks.length).toBe(0);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ marks: [] });
  });

  it('links highlight to active FSRS card or unsaved draft', () => {
    (window as any).AlgoRecall.state.marks.push({
      id: 'mark_5',
      createdAt: 5000,
      url: 'https://algo.monster/problem',
      text: 'Linked text',
      category: 'Key Insight',
      note: 'Linked note'
    });

    jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, cb: any) => {
      cb({
        fsrsCards: [{ id: 'card_1', problemUrl: 'https://algo.monster/problem', approach: 'Existing approach' }],
        approachDrafts: {}
      });
    });

    highlighter.linkHighlightToCard('mark_5');
    expect(chrome.storage.local.get).toHaveBeenCalled();
  });

  it('applies CSS highlights for current page using CSS Custom Highlights API', () => {
    (window as any).AlgoRecall.state.marks.push({
      id: 'mark_6',
      createdAt: 6000,
      url: window.location.href.split('?')[0].split('#')[0],
      text: 'Sample text',
      color: '#f1c40f',
      type: 'highlight',
      highlightSource: {}
    });

    highlighter.applyHighlightsForCurrentPage();

    expect((global as any).CSS.highlights.clear).toHaveBeenCalled();
    expect((global as any).CSS.highlights.set).toHaveBeenCalled();
    expect(highlighter.state.activeMarkRanges.length).toBe(1);
  });

  it('saves new highlight selection', () => {
    const textNode = document.createTextNode('Sample selectable text');
    document.body.appendChild(textNode);

    const range = document.createRange();
    range.selectNodeContents(textNode);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    highlighter.saveHighlight('#f1c40f', 'highlight');

    expect(highlighter.state.marks.length).toBeGreaterThan(0);
    expect(chrome.storage.local.set).toHaveBeenCalled();

    selection?.removeAllRanges();
  });

  it('handles updateHighlightColor method call', () => {
    (window as any).AlgoRecall.state.marks.push({
      id: 'mark_7',
      createdAt: 7000,
      url: 'https://algo.monster/problem',
      text: 'text',
      color: '#f1c40f'
    });

    highlighter.updateHighlightColor('mark_7', '#2ecc71');

    expect((window as any).AlgoRecall.state.marks[0].color).toBe('#2ecc71');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});
