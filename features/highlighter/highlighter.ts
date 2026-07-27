import { LoggerClass } from '../common/logger';
import { HighlightMark, DOMMeta, ChromeSettings } from '../../types/domain';

function getLogger(): LoggerClass | undefined {
    return (window as unknown as { Logger?: LoggerClass }).Logger;
}

export interface HighlighterState {
    currentTheme?: string;
    hoveredMarkId?: string | null;
    chromeSettings: ChromeSettings;
    marks: HighlightMark[];
    activeMarkRanges: Array<{ markId: string; range: Range; color: string }>;
    [key: string]: unknown;
}

export interface HighlighterUtils {
    getDOMMeta?: (node: Node | null, offset: number) => DOMMeta;
    restoreRangeFromMeta?: (meta: { startMeta?: DOMMeta; endMeta?: DOMMeta } | undefined, text: string) => Range | null;
    ensureHighlightStyle?: (color: string, type: string) => string;
    [key: string]: unknown;
}

export class Highlighter {
    state: HighlighterState;
    utils: HighlighterUtils;

    constructor() {
        const win = window as unknown as {
            AlgoRecall?: {
                state?: HighlighterState;
                Utils?: HighlighterUtils;
            };
        };
        this.state = (win.AlgoRecall && win.AlgoRecall.state) ? win.AlgoRecall.state : {
            chromeSettings: {},
            marks: [],
            activeMarkRanges: []
        };
        this.utils = (win.AlgoRecall && win.AlgoRecall.Utils) ? win.AlgoRecall.Utils : {};
    }

    createHighlighterUI(): void {
        const logger = getLogger();
        if (document.getElementById('algo-highlight-tooltip')) return;

        const tooltip = document.createElement('div');
        tooltip.id = 'algo-highlight-tooltip';
        tooltip.className = 'algo-highlight-tooltip';
        tooltip.style.display = 'none';

        if (this.state && this.state.currentTheme === 'light') {
            tooltip.classList.add('light-theme');
        }

        document.body.appendChild(tooltip);

        this.bindEvents();
        if (logger) logger.debug('Highlighter', 'Highlighter UI created.');
    }

    removeHighlighterUI(): void {
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (tooltip) tooltip.remove();
    }

    bindEvents(): void {
        document.addEventListener('mouseup', this.handleTextSelection.bind(this));
        document.addEventListener('keyup', (e: KeyboardEvent) => {
            if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
                this.handleTextSelection();
            }
        });

        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    }

    handleTextSelection(): void {
        const selection = window.getSelection();
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (!tooltip) return;

        if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
            if (!this.state.hoveredMarkId) {
                tooltip.style.display = 'none';
            }
            return;
        }

        if (!this.state.chromeSettings.showMarkerPopup) return;

        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        let lastRect = rects.length > 0 ? rects[rects.length - 1] : null;
        if (!lastRect) {
            const bounding = range.getBoundingClientRect();
            if (bounding && (bounding.width > 0 || bounding.height > 0)) lastRect = bounding;
        }

        if (lastRect) {
            this.renderTooltipColors(null, null);
            tooltip.style.display = 'flex';
            tooltip.style.left = `${lastRect.right + window.scrollX}px`;
            tooltip.style.top = `${lastRect.bottom + window.scrollY}px`;
        }
    }

    handleMouseMove(_e: MouseEvent): void {
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (!tooltip || tooltip.style.display === 'none') return;

        // Simple mouse distance check
    }

    renderTooltipColors(markId: string | null, activeColor: string | null): void {
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (!tooltip) return;

        const activeIndex = this.state.chromeSettings.activePaletteIndex || 0;
        const palette = (this.state.chromeSettings.palettes && this.state.chromeSettings.palettes[activeIndex])
            ? this.state.chromeSettings.palettes[activeIndex].colors
            : ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

        let html = `<div class="algo-tooltip-colors">`;
        palette.forEach((color: string) => {
            const isSelected = activeColor === color;
            html += `<button class="algo-color-swatch ${isSelected ? 'selected' : ''}" data-color="${color}" style="background-color: ${color};" aria-label="Highlight ${color}"></button>`;
        });
        html += `</div>`;

        if (markId) {
            html += `<button class="algo-tooltip-btn algo-delete-btn" data-action="delete" data-id="${markId}">Delete</button>`;
        }

        tooltip.innerHTML = html;

        tooltip.querySelectorAll('.algo-color-swatch').forEach(btn => {
            btn.addEventListener('click', (e: Event) => {
                const color = (e.currentTarget as HTMLElement).getAttribute('data-color');
                if (!color) return;

                if (markId) {
                    this.updateHighlightColor(markId, color);
                } else {
                    this.createHighlight(color);
                }
            });
        });

        const deleteBtn = tooltip.querySelector('.algo-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e: Event) => {
                const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                if (id) this.deleteHighlight(id);
            });
        }
    }

    createHighlight(color: string): void {
        const logger = getLogger();
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const text = range.toString();

        const startMeta = this.utils.getDOMMeta ? this.utils.getDOMMeta(range.startContainer, range.startOffset) : undefined;
        const endMeta = this.utils.getDOMMeta ? this.utils.getDOMMeta(range.endContainer, range.endOffset) : undefined;

        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const newMark: HighlightMark = {
            id: Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9),
            url: cleanUrl,
            text,
            color,
            type: 'highlight',
            createdAt: Date.now(),
            highlightSource: { startMeta, endMeta }
        };

        this.state.marks.push(newMark);
        chrome.storage.local.set({ marks: this.state.marks });

        selection.removeAllRanges();
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (tooltip) tooltip.style.display = 'none';

        this.applyHighlightsForCurrentPage();
        if (logger) logger.info('Highlighter', `Created new highlight with color: ${color}`);
    }

    updateHighlightColor(markId: string, newColor: string): void {
        const markIndex = this.state.marks.findIndex((m: HighlightMark) => (m.id || m.createdAt.toString()) === markId);
        if (markIndex > -1) {
            this.state.marks[markIndex].color = newColor;
            chrome.storage.local.set({ marks: this.state.marks });
            this.applyHighlightsForCurrentPage();
            this.renderTooltipColors(markId, newColor);
        }
    }

    deleteHighlight(markId: string): void {
        const logger = getLogger();
        if (logger) logger.debug('Highlighter', `Deleting highlight ID: ${markId}`);
        this.state.marks = this.state.marks.filter((m: HighlightMark) => (m.id || m.createdAt.toString()) !== markId);
        chrome.storage.local.set({ marks: this.state.marks });

        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (tooltip) tooltip.style.display = 'none';
        this.state.hoveredMarkId = null;
        this.applyHighlightsForCurrentPage();
    }

    saveMarkNote(markId: string, noteText: string): void {
        const markIndex = this.state.marks.findIndex((m: HighlightMark) => (m.id || m.createdAt.toString()) === markId);
        if (markIndex > -1) {
            this.state.marks[markIndex].note = noteText.trim();
            chrome.storage.local.set({ marks: this.state.marks });
        }
    }

    applyHighlightsForCurrentPage(): void {
        const logger = getLogger();
        if (!('highlights' in CSS)) {
            if (logger) logger.warn('Highlighter', 'CSS Custom Highlights API not supported in this browser.');
            return;
        }

        if (logger) logger.time('Highlighter', 'applyHighlightsForCurrentPage');

        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const pageMarks = this.state.marks.filter((m: HighlightMark) => m.url === cleanUrl);

        (CSS as unknown as { highlights: { clear(): void; set(name: string, highlight: unknown): void } }).highlights.clear();
        
        document.querySelectorAll('.algo-floating-symbol').forEach(el => el.remove());

        const highlightsByColor: Record<string, Range[]> = {};
        this.state.activeMarkRanges = [];

        pageMarks.forEach((mark: HighlightMark) => {
            const range = this.utils.restoreRangeFromMeta ? this.utils.restoreRangeFromMeta(mark.highlightSource, mark.text) : null;
            if (range) {
                const targetId = mark.id || mark.createdAt.toString();
                this.state.activeMarkRanges.push({ markId: targetId, range: range, color: mark.color });

                const type = mark.type || 'highlight';
                const colorName = this.utils.ensureHighlightStyle ? this.utils.ensureHighlightStyle(mark.color, type) : mark.color;
                
                if (!highlightsByColor[colorName]) highlightsByColor[colorName] = [];
                highlightsByColor[colorName].push(range);
            }
        });

        for (const [colorName, ranges] of Object.entries(highlightsByColor)) {
            const WindowHighlight = (window as unknown as { Highlight: new (...ranges: Range[]) => unknown }).Highlight;
            (CSS as unknown as { highlights: { set(name: string, highlight: unknown): void } }).highlights.set(colorName, new WindowHighlight(...ranges));
        }

        if (logger) logger.timeEnd('Highlighter', 'applyHighlightsForCurrentPage');
    }
}

const win = window as unknown as { AlgoRecall: { Highlighter?: typeof Highlighter } };
win.AlgoRecall = win.AlgoRecall || {};
win.AlgoRecall.Highlighter = Highlighter;
