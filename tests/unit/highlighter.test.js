const { Highlighter } = require('../../features/highlighter/highlighter.ts');

describe('Highlighter', () => {
    let highlighter;

    beforeEach(() => {
        document.body.innerHTML = '';
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn((keys, cb) => cb({ fsrsCards: [], approachDrafts: {} })),
                    set: jest.fn((data, cb) => cb && cb())
                }
            }
        };

        global.CSS = {
            highlights: {
                clear: jest.fn(),
                set: jest.fn()
            }
        };
        global.Highlight = class MockHighlight {};

        window.AlgoRecall = {
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
                restoreRangeFromMeta: () => null,
                ensureHighlightStyle: (color, type) => `style_${color}_${type}`
            }
        };

        highlighter = new Highlighter();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('initializes correctly with AlgoRecall state and utils', () => {
        expect(highlighter.state).toBe(window.AlgoRecall.state);
        expect(highlighter.utils).toBe(window.AlgoRecall.Utils);
    });

    it('creates highlighter UI tooltip container in document body', () => {
        highlighter.createHighlighterUI();
        const tooltip = document.getElementById('algo-highlight-tooltip');
        expect(tooltip).not.toBeNull();
        expect(tooltip.getAttribute('role')).toBe('dialog');
    });

    it('renders new annotation controls (type selector, swatches, picker) when no markId is passed', () => {
        highlighter.createHighlighterUI();
        highlighter.renderTooltipColors(null, null);

        const tooltip = document.getElementById('algo-highlight-tooltip');
        expect(tooltip.querySelector('.algo-type-selector')).not.toBeNull();
        expect(tooltip.querySelectorAll('.algo-color-swatch').length).toBe(3);
        expect(tooltip.querySelector('#algo-color-picker')).not.toBeNull();
        expect(tooltip.querySelector('.algo-delete-btn')).toBeNull();
    });

    it('renders existing annotation controls (delete, note, category, link button) when markId is provided', () => {
        window.AlgoRecall.state.marks.push({
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
        expect(tooltip.querySelector('.algo-type-selector')).toBeNull();
        expect(tooltip.querySelector('.algo-delete-btn')).not.toBeNull();
        expect(tooltip.querySelector('.algo-category-select')).not.toBeNull();
        expect(tooltip.querySelector('.algo-note-input').value).toBe('my note');
        expect(tooltip.querySelector('.algo-link-btn')).not.toBeNull();
    });

    it('updates mark category and saves to chrome storage', () => {
        window.AlgoRecall.state.marks.push({
            id: 'mark_2',
            createdAt: 2000,
            url: 'https://algo.monster/problem',
            text: 'sample text',
            color: '#f1c40f'
        });

        highlighter.saveMarkCategory('mark_2', 'Gotcha');

        expect(window.AlgoRecall.state.marks[0].category).toBe('Gotcha');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({ marks: window.AlgoRecall.state.marks })
        );
    });

    it('updates mark note and saves to chrome storage', () => {
        window.AlgoRecall.state.marks.push({
            id: 'mark_3',
            createdAt: 3000,
            url: 'https://algo.monster/problem',
            text: 'sample text',
            color: '#f1c40f'
        });

        highlighter.saveMarkNote('mark_3', 'test note text');

        expect(window.AlgoRecall.state.marks[0].note).toBe('test note text');
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({ marks: window.AlgoRecall.state.marks })
        );
    });

    it('updates recent colors in chrome settings and saves to storage', () => {
        highlighter.updateRecentColors('#2ecc71');

        expect(window.AlgoRecall.state.chromeSettings.defaultHighlightColor).toBe('#2ecc71');
        expect(window.AlgoRecall.state.chromeSettings.recentColors[0]).toBe('#2ecc71');
        expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });

    it('deletes highlight mark and updates storage', () => {
        window.AlgoRecall.state.marks = [
            { id: 'mark_del', createdAt: 4000, url: 'https://algo.monster/problem', text: 'text', color: '#e74c3c' }
        ];

        highlighter.deleteHighlight('mark_del');

        expect(window.AlgoRecall.state.marks.length).toBe(0);
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({ marks: [] })
        );
    });

    it('links highlight to card approach draft when no existing card exists', () => {
        window.AlgoRecall.state.marks = [
            { id: 'mark_link', createdAt: 5000, url: 'https://algo.monster/problem', text: 'linked text', color: '#3498db', category: 'Pattern', note: 'check complexity' }
        ];

        highlighter.linkHighlightToCard('mark_link');

        expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['fsrsCards', 'approachDrafts'], expect.any(Function));
    });

    it('links highlight to the specifically active card among multiple cards on the page', (done) => {
        const card1 = { id: 'card_1', problemUrl: 'http://localhost/', approach: 'Card 1 Approach' };
        const card2 = { id: 'card_2', problemUrl: 'http://localhost/', approach: 'Card 2 Approach' };

        global.chrome.storage.local.get = jest.fn((keys, cb) => {
            cb({ fsrsCards: [card1, card2], approachDrafts: {} });
        });

        window.AlgoRecall.orchestrator = {
            tracker: { activeCardId: 'card_2' }
        };

        window.AlgoRecall.state.marks = [
            { id: 'mark_link2', createdAt: 6000, url: 'http://localhost/', text: 'linked text for card 2', color: '#3498db' }
        ];

        highlighter.linkHighlightToCard('mark_link2');

        setTimeout(() => {
            expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    fsrsCards: expect.arrayContaining([
                        expect.objectContaining({ id: 'card_1', approach: 'Card 1 Approach' }),
                        expect.objectContaining({ id: 'card_2', approach: expect.stringContaining('linked text for card 2') })
                    ])
                }),
                expect.any(Function)
            );
            done();
        }, 50);
    });

    it('links highlight to unsaved draft when activeCardId is __new__', (done) => {
        const card1 = { id: 'card_1', problemUrl: 'http://localhost/', approach: 'Card 1 Approach' };

        global.chrome.storage.local.get = jest.fn((keys, cb) => {
            cb({ fsrsCards: [card1], approachDrafts: {} });
        });

        window.AlgoRecall.orchestrator = {
            tracker: { activeCardId: '__new__' }
        };

        window.AlgoRecall.state.marks = [
            { id: 'mark_link3', createdAt: 7000, url: 'http://localhost/', text: 'draft text', color: '#3498db' }
        ];

        highlighter.linkHighlightToCard('mark_link3');

        setTimeout(() => {
            expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    approachDrafts: expect.objectContaining({
                        'http://localhost/': expect.objectContaining({
                            approach: expect.stringContaining('draft text')
                        })
                    })
                }),
                expect.any(Function)
            );
            done();
        }, 50);
    });
});
