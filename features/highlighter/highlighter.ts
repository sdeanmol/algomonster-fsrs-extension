/**
 * @file features/highlighter/highlighter.ts
 * @description In-page text selection highlighter, floating tooltip UI, and custom CSS Highlights API manager.
 */

import { Logger } from '@common/logger';
import { HighlightMark, DOMMeta, ChromeSettings, BookmarkItem, Card } from '../../types/domain';

export interface HighlighterState {
    currentTheme?: string;
    hoveredMarkId?: string | null;
    hideTooltipTimer?: ReturnType<typeof setTimeout> | null;
    chromeSettings: ChromeSettings;
    marks: HighlightMark[];
    bookmarks: BookmarkItem[];
    pagecontents: Array<{ url: string; description: string; length: number; [key: string]: unknown }>;
    activeMarkRanges: Array<{ markId: string; range: Range; color: string }>;
    cards?: Card[];
    [key: string]: unknown;
}

export interface HighlighterUtils {
    getDOMMeta?: (node: Node | null, offset: number) => DOMMeta;
    restoreRangeFromMeta?: (meta: { startMeta?: DOMMeta; endMeta?: DOMMeta } | undefined, text: string) => Range | null;
    ensureHighlightStyle?: (color: string, type: string) => string;
    getExtractedProblemTitle?: () => string;
    [key: string]: unknown;
}

export class Highlighter {
    state: HighlighterState;
    utils: HighlighterUtils;
    isHighlighterListenersBound: boolean = false;

    constructor() {
        try {
            const win = window as unknown as {
                AlgoRecall?: {
                    state?: HighlighterState;
                    Utils?: HighlighterUtils;
                };
            };
            this.state = (win.AlgoRecall && win.AlgoRecall.state) ? win.AlgoRecall.state : {
                chromeSettings: {},
                marks: [],
                bookmarks: [],
                pagecontents: [],
                activeMarkRanges: [],
                hoveredMarkId: null,
                hideTooltipTimer: null
            };
            this.utils = (win.AlgoRecall && win.AlgoRecall.Utils) ? win.AlgoRecall.Utils : {};
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error in Highlighter constructor: ${errorMessage}`, { err });
            this.state = {
                chromeSettings: {},
                marks: [],
                bookmarks: [],
                pagecontents: [],
                activeMarkRanges: [],
                hoveredMarkId: null,
                hideTooltipTimer: null
            };
            this.utils = {};
        }
    }

    createHighlighterUI(): void {
        try {
            if (!document.getElementById('algo-highlight-tooltip')) {
                const tooltip = document.createElement('div');
                tooltip.id = 'algo-highlight-tooltip';
                tooltip.setAttribute('role', 'dialog');
                tooltip.setAttribute('aria-label', 'Highlighter Options');
                tooltip.style.display = 'none';

                if (this.state && this.state.currentTheme === 'light') {
                    tooltip.classList.add('light-theme');
                }

                document.body.appendChild(tooltip);
            }

            if (this.isHighlighterListenersBound) return;

            this.bindEvents();
            this.isHighlighterListenersBound = true;
            Logger.debug('Highlighter', 'Highlighter UI created.');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error creating highlighter UI: ${errorMessage}`, { err });
            // Comment: Catch UI creation error gracefully
        }
    }

    removeHighlighterUI(): void {
        try {
            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (tooltip) tooltip.remove();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error removing highlighter UI: ${errorMessage}`, { err });
        }
    }

    bindEvents(): void {
        try {
            // 1. Text Selection Logic (For NEW highlights)
            document.addEventListener('pointerup', (e: MouseEvent) => {
                try {
                    const showPopup = this.state.chromeSettings?.showMarkerPopup !== false;
                    if (!showPopup) return;

                    const target = e.target as HTMLElement | null;
                    if (target?.closest('#algo-highlight-tooltip') || target?.closest('#algo-fsrs-container')) return;

                    const selection = window.getSelection();
                    const tooltip = document.getElementById('algo-highlight-tooltip');
                    if (!tooltip) return;

                    if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
                        if (this.state.hoveredMarkId === null) {
                            tooltip.style.display = 'none';
                        }
                        return;
                    }

                    this.state.hoveredMarkId = null;
                    if (this.state.hideTooltipTimer) {
                        clearTimeout(this.state.hideTooltipTimer);
                        this.state.hideTooltipTimer = null;
                    }

                    const range = selection.getRangeAt(0);

                    // Position tooltip anchored to end of text selection
                    const rects = range.getClientRects();
                    let lastRect = rects.length > 0 ? rects[rects.length - 1] : null;

                    if (!lastRect) {
                        const bounding = range.getBoundingClientRect();
                        if (bounding && (bounding.width > 0 || bounding.height > 0)) {
                            lastRect = bounding;
                        }
                    }

                    if (!lastRect) return;

                    this.renderTooltipColors(null, null);
                    tooltip.style.display = 'flex';
                    tooltip.style.left = `${lastRect.right + window.scrollX}px`;
                    tooltip.style.top = `${lastRect.bottom + window.scrollY}px`;
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error in pointerup event handler: ${errorMessage}`, { err });
                }
            }, true);

            // 2. Hover Detection Logic (For EXISTING highlights)
            document.addEventListener('mousemove', (e: MouseEvent) => {
                try {
                    const showPopup = this.state.chromeSettings?.showMarkerPopup !== false;
                    if (!showPopup) return;

                    const target = e.target as HTMLElement | null;
                    if (target?.closest('#algo-highlight-tooltip') || target?.closest('#algo-fsrs-container')) {
                        if (this.state.hideTooltipTimer) {
                            clearTimeout(this.state.hideTooltipTimer);
                            this.state.hideTooltipTimer = null;
                        }
                        return;
                    }

                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && selection.toString().trim() !== '') return;

                    let foundMark: { markId: string; range: Range; color: string } | null = null;
                    if (this.state.activeMarkRanges) {
                        for (const item of this.state.activeMarkRanges) {
                            const rects = item.range.getClientRects();
                            for (let i = 0; i < rects.length; i++) {
                                const r = rects[i];
                                if (e.clientX >= r.left - 5 && e.clientX <= r.right + 5 && e.clientY >= r.top - 5 && e.clientY <= r.bottom + 5) {
                                    foundMark = item;
                                    break;
                                }
                            }
                            if (foundMark) break;
                        }
                    }

                    const tooltip = document.getElementById('algo-highlight-tooltip');
                    if (!tooltip) return;

                    if (foundMark) {
                        if (this.state.hideTooltipTimer) {
                            clearTimeout(this.state.hideTooltipTimer);
                            this.state.hideTooltipTimer = null;
                        }

                        if (this.state.hoveredMarkId !== foundMark.markId) {
                            this.state.hoveredMarkId = foundMark.markId;
                            this.renderTooltipColors(this.state.hoveredMarkId, foundMark.color);
                            tooltip.style.display = 'flex';
                            tooltip.style.left = `${e.clientX + window.scrollX + 15}px`;
                            tooltip.style.top = `${e.clientY + window.scrollY}px`;
                        }
                    } else {
                        if (this.state.hoveredMarkId !== null && !this.state.hideTooltipTimer) {
                            this.state.hideTooltipTimer = setTimeout(() => {
                                try {
                                    this.state.hoveredMarkId = null;
                                    if (tooltip) tooltip.style.display = 'none';
                                    this.state.hideTooltipTimer = null;
                                } catch (timerErr) {
                                    const errorMessage = timerErr instanceof Error ? timerErr.message : String(timerErr);
                                    Logger.error('Highlighter', `Error in hide tooltip timer: ${errorMessage}`, { timerErr });
                                }
                            }, 400);
                        }
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error in mousemove event handler: ${errorMessage}`, { err });
                }
            });

            // Fallback for keyboard selection shifts
            document.addEventListener('keyup', (e: KeyboardEvent) => {
                try {
                    if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
                        this.handleTextSelection();
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error in keyup event handler: ${errorMessage}`, { err });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error binding events: ${errorMessage}`, { err });
            // Comment: Non-fatal event listener binding error
        }
    }

    handleTextSelection(): void {
        try {
            const selection = window.getSelection();
            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (!tooltip) return;

            if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
                if (!this.state.hoveredMarkId) {
                    tooltip.style.display = 'none';
                }
                return;
            }

            const showPopup = this.state.chromeSettings?.showMarkerPopup !== false;
            if (!showPopup) return;

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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error in handleTextSelection: ${errorMessage}`, { err });
        }
    }

    handleMouseMove(_e: MouseEvent): void {
        // Main mousemove handling is bound in bindEvents
    }

    renderTooltipColors(existingMarkId: string | null = null, currentColor: string | null = null): void {
        try {
            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (!tooltip) return;
            tooltip.innerHTML = '';

            let activeType = 'highlight';

            // 1. Add Type Selector for New Annotations
            if (!existingMarkId) {
                const typeContainer = document.createElement('div');
                typeContainer.className = 'algo-type-selector';
                typeContainer.style.display = 'flex';
                typeContainer.style.width = '100%';
                typeContainer.style.marginBottom = '12px';
                typeContainer.style.borderRadius = '8px';
                typeContainer.style.overflow = 'hidden';
                typeContainer.style.border = '1px solid var(--w-border, #444)';
                typeContainer.setAttribute('role', 'radiogroup');
                typeContainer.setAttribute('aria-label', 'Highlight Type');

                const types = ['highlight', 'underline'];
                const typeBtns: Record<string, HTMLButtonElement> = {};

                types.forEach((t) => {
                    const btn = document.createElement('button');
                    btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
                    btn.className = 'algo-type-btn';
                    btn.style.flex = '1';
                    btn.style.padding = '8px 0';
                    btn.style.fontSize = '12px';
                    btn.style.fontWeight = '500';
                    btn.style.cursor = 'pointer';
                    btn.style.border = 'none';
                    btn.style.outline = 'none';

                    const isActive = t === 'highlight';
                    btn.style.background = isActive ? 'var(--w-primary-container, #3498db)' : 'var(--w-bg-dark, #333)';
                    btn.style.color = isActive ? 'var(--w-on-primary-container, #fff)' : 'var(--w-text-med, #ccc)';

                    btn.setAttribute('role', 'radio');
                    btn.setAttribute('aria-checked', isActive.toString());
                    btn.setAttribute('tabindex', isActive ? '0' : '-1');

                    const setActiveType = (typeVal: string) => {
                        activeType = typeVal;
                        types.forEach((type) => {
                            const isBtnActive = type === typeVal;
                            if (typeBtns[type]) {
                                typeBtns[type].style.background = isBtnActive ? 'var(--w-primary-container, #3498db)' : 'var(--w-bg-dark, #333)';
                                typeBtns[type].style.color = isBtnActive ? 'var(--w-on-primary-container, #fff)' : 'var(--w-text-med, #ccc)';
                                typeBtns[type].setAttribute('aria-checked', isBtnActive.toString());
                                typeBtns[type].setAttribute('tabindex', isBtnActive ? '0' : '-1');
                            }
                        });
                    };

                    btn.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveType(t);
                    });

                    btn.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveType(t);
                        }
                    });
                    typeBtns[t] = btn;
                    typeContainer.appendChild(btn);
                });
                tooltip.appendChild(typeContainer);
            }

            // 2. Swatches and Input Controls Container
            const actionsContainer = document.createElement('div');
            actionsContainer.style.display = 'flex';
            actionsContainer.style.alignItems = 'center';
            actionsContainer.style.gap = '8px';
            actionsContainer.style.width = '100%';
            actionsContainer.style.flexWrap = 'wrap';

            const activeIndex = this.state.chromeSettings?.activePaletteIndex || 0;
            const activePalette = (this.state.chromeSettings?.palettes && this.state.chromeSettings.palettes[activeIndex])
                ? this.state.chromeSettings.palettes[activeIndex]
                : { colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] };

            const paletteColors = activePalette.colors || [];

            paletteColors.forEach((color: string) => {
                const swatch = document.createElement('div');
                swatch.className = 'algo-color-swatch';
                swatch.style.background = color;
                swatch.title = `Color: ${color}`;
                swatch.setAttribute('role', 'button');
                swatch.setAttribute('aria-label', `Highlight with color ${color}`);
                swatch.setAttribute('tabindex', '0');

                if (color === currentColor) {
                    swatch.classList.add('active');
                }

                const handleSwatchClick = () => {
                    try {
                        if (existingMarkId) this.updateHighlightColor(existingMarkId, color);
                        else this.saveHighlight(color, activeType);
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Highlighter', `Error handling swatch click for ${color}: ${errorMessage}`, { color, err });
                    }
                };

                swatch.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    handleSwatchClick();
                });

                swatch.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSwatchClick();
                    }
                });
                actionsContainer.appendChild(swatch);
            });

            // 3. Custom Color Picker
            const picker = document.createElement('input');
            picker.type = 'color';
            picker.id = 'algo-color-picker';
            picker.setAttribute('aria-label', 'Custom highlight color');
            picker.value = currentColor || this.state.chromeSettings?.defaultHighlightColor || '#f1c40f';
            picker.addEventListener('input', (e: Event) => {
                try {
                    const newColor = (e.target as HTMLInputElement).value;
                    if (existingMarkId) this.updateHighlightColor(existingMarkId, newColor);
                    else this.saveHighlight(newColor, activeType);
                    this.updateRecentColors(newColor);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error in custom color picker input: ${errorMessage}`, { err });
                }
            });
            actionsContainer.appendChild(picker);

            // 4. Delete Button (when editing existing highlight)
            if (existingMarkId) {
                const divider = document.createElement('div');
                divider.className = 'algo-tooltip-divider';
                actionsContainer.appendChild(divider);

                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'algo-delete-btn';
                deleteBtn.setAttribute('role', 'button');
                deleteBtn.setAttribute('aria-label', 'Delete Highlight');
                deleteBtn.setAttribute('tabindex', '0');
                deleteBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path></svg>`;

                const handleDelete = () => {
                    try {
                        this.deleteHighlight(existingMarkId);
                        this.renderTooltipColors();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Highlighter', `Error handling delete button click: ${errorMessage}`, { existingMarkId, err });
                    }
                };

                deleteBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    handleDelete();
                });

                deleteBtn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDelete();
                    }
                });
                actionsContainer.appendChild(deleteBtn);
            }

            tooltip.appendChild(actionsContainer);

            // 5. Notes & Category Section (when editing existing mark)
            if (existingMarkId) {
                const existingMark = this.state.marks.find((m: HighlightMark) => (m.id || m.createdAt.toString()) === existingMarkId);
                const noteSection = document.createElement('div');
                noteSection.className = 'algo-note-section';

                const categorySelect = document.createElement('select');
                categorySelect.className = 'algo-category-select';
                const categories = ['', 'Key Insight', 'Gotcha', 'Edge Case', 'Pattern'];
                categories.forEach((cat) => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat || 'No Category';
                    categorySelect.appendChild(opt);
                });
                categorySelect.value = existingMark?.category || '';
                categorySelect.addEventListener('change', (e: Event) => {
                    try {
                        this.saveMarkCategory(existingMarkId, (e.target as HTMLSelectElement).value);
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Highlighter', `Error in category select change listener: ${errorMessage}`, { err });
                    }
                });
                noteSection.appendChild(categorySelect);

                const noteInput = document.createElement('input');
                noteInput.type = 'text';
                noteInput.className = 'algo-note-input';
                noteInput.placeholder = 'Add note...';
                noteInput.value = existingMark?.note || '';
                noteInput.maxLength = 200;
                noteInput.addEventListener('input', (e: Event) => {
                    try {
                        this.saveMarkNote(existingMarkId, (e.target as HTMLInputElement).value);
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Highlighter', `Error in note input listener: ${errorMessage}`, { err });
                    }
                });
                noteSection.appendChild(noteInput);

                const linkBtn = document.createElement('button');
                linkBtn.className = 'algo-link-btn';
                linkBtn.title = 'Link Highlight to Card';
                linkBtn.setAttribute('aria-label', 'Link Highlight to Card');
                linkBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
                linkBtn.addEventListener('click', () => {
                    try {
                        this.linkHighlightToCard(existingMarkId);
                        const originalHtml = linkBtn.innerHTML;
                        linkBtn.innerHTML = '✓';
                        linkBtn.style.color = '#2ecc71';
                        setTimeout(() => {
                            try {
                                linkBtn.innerHTML = originalHtml;
                                linkBtn.style.color = '';
                            } catch (resetErr) {
                                const errorMessage = resetErr instanceof Error ? resetErr.message : String(resetErr);
                                Logger.error('Highlighter', `Error resetting link button HTML: ${errorMessage}`, { resetErr });
                            }
                        }, 1500);
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Highlighter', `Error in link button click listener: ${errorMessage}`, { err });
                    }
                });
                noteSection.appendChild(linkBtn);

                tooltip.appendChild(noteSection);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error rendering tooltip colors: ${errorMessage}`, { existingMarkId, currentColor, err });
            // Comment: Non-fatal tooltip render catch
        }
    }

    saveMarkCategory(markId: string, category: string): void {
        try {
            const markIndex = this.state.marks.findIndex((m: HighlightMark) => (m.id || m.createdAt.toString()) === markId);
            if (markIndex > -1) {
                this.state.marks[markIndex].category = category;
                chrome.storage.local.set({ marks: this.state.marks });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error saving mark category for ${markId}: ${errorMessage}`, { markId, category, err });
        }
    }

    linkHighlightToCard(markId: string): void {
        try {
            const mark = this.state.marks.find((m: HighlightMark) => (m.id || m.createdAt.toString()) === markId);
            if (!mark) return;

            const cleanUrl = window.location.href.split('?')[0].split('#')[0];
            const prefix = mark.category ? `**${mark.category}:** ` : '';
            const appendText = `\n\n> ${prefix}${mark.text}` + (mark.note ? `\n> *Note: ${mark.note}*` : '');

            chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result: { [key: string]: any }) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('Highlighter', `Storage error fetching cards for linking: ${errorMessage}`, { error: lastError });
                        return;
                    }

                    const cards: Card[] = result.fsrsCards || [];
                    const drafts = result.approachDrafts || {};
                    const win = window as unknown as {
                        AlgoRecall?: {
                            orchestrator?: { tracker?: { activeCardId?: string | null; refreshWidgetState?: () => void } };
                            trackerInstance?: { activeCardId?: string | null; refreshWidgetState?: () => void };
                            Notifier?: { showPageNotification: (title: string, message: string, type?: string) => void };
                        };
                    };

                    const tracker = win.AlgoRecall?.orchestrator?.tracker || win.AlgoRecall?.trackerInstance;
                    const trackerActiveId = tracker?.activeCardId;
                    const domActiveId = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');
                    const activeId = trackerActiveId || domActiveId;

                    const pageCards = cards.filter((c: Card) => c.problemUrl === cleanUrl);
                    let targetCard: Card | null = null;
                    let isNewDraft = false;

                    if (activeId === '__new__') {
                        isNewDraft = true;
                    } else if (activeId) {
                        targetCard = cards.find((c: Card) => c.id === activeId) || null;
                    }

                    if (!isNewDraft && !targetCard && pageCards.length > 0) {
                        targetCard = pageCards[0];
                    }

                    const approachArea = document.getElementById('fsrs-approach') as HTMLTextAreaElement | null;

                    if (targetCard) {
                        const approach = targetCard.approach || '';
                        targetCard.approach = (approach + appendText).trim();

                        if (this.state.cards) {
                            const stateCard = (this.state.cards as Card[]).find((c: Card) => c.id === targetCard!.id);
                            if (stateCard) stateCard.approach = targetCard.approach;
                        }

                        chrome.storage.local.set({ fsrsCards: cards }, () => {
                            try {
                                const setLastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                if (setLastError) {
                                    const errorMessage = setLastError.message || String(setLastError);
                                    Logger.error('Highlighter', `Storage set error saving targetCard approach: ${errorMessage}`, { error: setLastError });
                                    return;
                                }

                                if (approachArea) {
                                    const currentCardIdInUi = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');
                                    if (!currentCardIdInUi || currentCardIdInUi === targetCard!.id) {
                                        approachArea.value = targetCard!.approach || '';
                                    }
                                }

                                if (win.AlgoRecall?.Notifier) {
                                    win.AlgoRecall.Notifier.showPageNotification('Highlight Linked', 'Highlight appended to active FSRS card approach.', 'test');
                                }
                            } catch (setCbErr) {
                                const errorMessage = setCbErr instanceof Error ? setCbErr.message : String(setCbErr);
                                Logger.error('Highlighter', `Error in storage set callback for card link: ${errorMessage}`, { setCbErr });
                            }
                        });
                    } else {
                        let draft = drafts[cleanUrl];
                        if (!draft) {
                            draft = { approach: '', tags: '' };
                        } else if (typeof draft === 'string') {
                            draft = { approach: draft, tags: '' };
                        }

                        draft.approach = ((draft.approach || '') + appendText).trim();
                        drafts[cleanUrl] = draft;

                        chrome.storage.local.set({ approachDrafts: drafts }, () => {
                            try {
                                const setLastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                if (setLastError) {
                                    const errorMessage = setLastError.message || String(setLastError);
                                    Logger.error('Highlighter', `Storage set error saving approach draft: ${errorMessage}`, { error: setLastError });
                                    return;
                                }

                                if (approachArea) {
                                    const currentCardIdInUi = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');
                                    if (!currentCardIdInUi || currentCardIdInUi === '__new__') {
                                        approachArea.value = draft.approach || '';
                                    }
                                }

                                if (win.AlgoRecall?.Notifier) {
                                    win.AlgoRecall.Notifier.showPageNotification('Highlight Linked', 'Highlight appended to active unsaved card draft.', 'test');
                                }
                            } catch (draftCbErr) {
                                const errorMessage = draftCbErr instanceof Error ? draftCbErr.message : String(draftCbErr);
                                Logger.error('Highlighter', `Error in storage set callback for draft link: ${errorMessage}`, { draftCbErr });
                            }
                        });
                    }
                } catch (getInnerErr) {
                    const errorMessage = getInnerErr instanceof Error ? getInnerErr.message : String(getInnerErr);
                    Logger.error('Highlighter', `Error inside storage get callback for linkHighlightToCard: ${errorMessage}`, { getInnerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error linking highlight ${markId} to card: ${errorMessage}`, { markId, err });
        }
    }

    updateRecentColors(newColor: string): void {
        try {
            if (!this.state.chromeSettings) {
                this.state.chromeSettings = {
                    defaultHighlightColor: '#f1c40f',
                    recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
                    showMarkerPopup: true,
                    activePaletteIndex: 0,
                    palettes: []
                };
            }
            this.state.chromeSettings.defaultHighlightColor = newColor;
            const recent = this.state.chromeSettings.recentColors || [];
            this.state.chromeSettings.recentColors = [newColor, ...recent.filter((c: string) => c !== newColor)].slice(0, 4);
            chrome.storage.local.set({ chromeSettings: this.state.chromeSettings });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error updating recent colors with ${newColor}: ${errorMessage}`, { newColor, err });
        }
    }

    createHighlight(color: string, type: string = 'highlight'): void {
        try {
            this.saveHighlight(color, type);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error creating highlight: ${errorMessage}`, { color, type, err });
        }
    }

    saveHighlight(color: string, type: string = 'highlight'): void {
        try {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) return;

            const range = selection.getRangeAt(0);
            const text = selection.toString();
            const cleanUrl = window.location.href.split('?')[0].split('#')[0];
            const timestamp = Date.now();

            const startMeta = this.utils.getDOMMeta ? this.utils.getDOMMeta(range.startContainer, range.startOffset) : undefined;
            const endMeta = this.utils.getDOMMeta ? this.utils.getDOMMeta(range.endContainer, range.endOffset) : undefined;

            const newMark: HighlightMark = {
                id: `mark_${timestamp}_${Math.random().toString(36).substr(2, 5)}`,
                createdAt: timestamp,
                url: cleanUrl,
                text: text,
                color: color,
                type: type,
                note: '',
                highlightSource: { startMeta, endMeta }
            };

            if (!this.state.marks) this.state.marks = [];
            this.state.marks.push(newMark);

            if (!this.state.bookmarks) this.state.bookmarks = [];
            if (!this.state.bookmarks.find((b: BookmarkItem) => b.url === cleanUrl)) {
                const problemTitle = this.utils.getExtractedProblemTitle ? this.utils.getExtractedProblemTitle() : document.title;
                this.state.bookmarks.push({
                    url: cleanUrl,
                    title: problemTitle,
                    meta: { favIconUrl: 'https://algo.monster/favicon.ico' }
                });
            }

            if (!this.state.pagecontents) this.state.pagecontents = [];
            this.state.pagecontents = this.state.pagecontents.filter((p: { url: string }) => p.url !== cleanUrl);
            this.state.pagecontents.push({
                url: cleanUrl,
                description: document.body.innerText ? document.body.innerText.substring(0, 100) : '',
                length: document.body.innerText ? document.body.innerText.length : 0
            });

            chrome.storage.local.set({
                marks: this.state.marks,
                bookmarks: this.state.bookmarks,
                pagecontents: this.state.pagecontents
            });

            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (tooltip) tooltip.style.display = 'none';
            selection.removeAllRanges();

            this.applyHighlightsForCurrentPage();
            Logger.info('Highlighter', `Created new highlight with color: ${color}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Failed saving highlight: ${errorMessage}`, { color, type, err });
            // Comment: Non-fatal highlight saving catch, host page interaction continues
        }
    }

    updateHighlightColor(markId: string, newColor: string): void {
        try {
            const markIndex = this.state.marks.findIndex((m: HighlightMark) => (m.id || m.createdAt.toString()) === markId);
            if (markIndex > -1) {
                this.state.marks[markIndex].color = newColor;
                chrome.storage.local.set({ marks: this.state.marks });
                this.applyHighlightsForCurrentPage();
                this.renderTooltipColors(markId, newColor);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error updating highlight color for ${markId}: ${errorMessage}`, { markId, newColor, err });
        }
    }

    deleteHighlight(markId: string): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.runtime || !chrome.runtime.id) {
                Logger.warn('Highlighter', 'Extension context invalidated. Cannot delete highlight mark.');
                return;
            }
            Logger.debug('Highlighter', `Deleting highlight ID: ${markId}`);
            this.state.marks = this.state.marks.filter((m: HighlightMark) => (m.id || m.createdAt.toString()) !== markId);
            chrome.storage.local.set({ marks: this.state.marks });

            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (tooltip) tooltip.style.display = 'none';
            this.state.hoveredMarkId = null;
            this.applyHighlightsForCurrentPage();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error deleting highlight ${markId}: ${errorMessage}`, { markId, err });
            // Comment: Catch highlight deletion error gracefully
        }
    }

    saveMarkNote(markId: string, noteText: string): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.runtime || !chrome.runtime.id) {
                Logger.warn('Highlighter', 'Extension context invalidated. Cannot save mark note.');
                return;
            }
            const markIndex = this.state.marks.findIndex((m: HighlightMark) => (m.id || m.createdAt.toString()) === markId);
            if (markIndex > -1) {
                this.state.marks[markIndex].note = noteText.trim();
                chrome.storage.local.set({ marks: this.state.marks });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error saving note for mark ${markId}: ${errorMessage}`, { markId, err });
        }
    }

    applyHighlightsForCurrentPage(): void {
        try {
            if (typeof CSS === 'undefined' || !('highlights' in CSS)) {
                Logger.warn('Highlighter', 'CSS Custom Highlights API not supported in this browser.');
                return;
            }

            Logger.time('Highlighter', 'applyHighlightsForCurrentPage');

            const cleanUrl = window.location.href.split('?')[0].split('#')[0];
            const pageMarks = this.state.marks.filter((m: HighlightMark) => m.url === cleanUrl);

            (CSS as unknown as { highlights: { clear(): void; set(name: string, highlight: unknown): void } }).highlights.clear();

            document.querySelectorAll('.algo-floating-symbol').forEach(el => el.remove());

            const highlightsByColor: Record<string, Range[]> = {};
            this.state.activeMarkRanges = [];

            pageMarks.forEach((mark: HighlightMark) => {
                try {
                    const range = this.utils.restoreRangeFromMeta ? this.utils.restoreRangeFromMeta(mark.highlightSource, mark.text) : null;
                    if (range) {
                        const targetId = mark.id || mark.createdAt.toString();
                        this.state.activeMarkRanges.push({ markId: targetId, range: range, color: mark.color });

                        const type = mark.type || 'highlight';
                        const colorName = this.utils.ensureHighlightStyle ? this.utils.ensureHighlightStyle(mark.color, type) : mark.color;

                        if (!highlightsByColor[colorName]) highlightsByColor[colorName] = [];
                        highlightsByColor[colorName].push(range);
                    }
                } catch (markErr) {
                    const errorMessage = markErr instanceof Error ? markErr.message : String(markErr);
                    Logger.error('Highlighter', `Error restoring range for mark: ${errorMessage}`, { mark, markErr });
                }
            });

            for (const [colorName, ranges] of Object.entries(highlightsByColor)) {
                try {
                    const WindowHighlight = (window as unknown as { Highlight: new (...ranges: Range[]) => unknown }).Highlight;
                    (CSS as unknown as { highlights: { set(name: string, highlight: unknown): void } }).highlights.set(colorName, new WindowHighlight(...ranges));
                } catch (cssErr) {
                    const errorMessage = cssErr instanceof Error ? cssErr.message : String(cssErr);
                    Logger.error('Highlighter', `Error setting CSS highlight for ${colorName}: ${errorMessage}`, { colorName, cssErr });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error applying highlights for current page: ${errorMessage}`, { err });
        } finally {
            try {
                Logger.timeEnd('Highlighter', 'applyHighlightsForCurrentPage');
            } catch (timeErr) {
                // Ignore timer end error if time wasn't started
            }
        }
    }
}

try {
    const win = window as unknown as { AlgoRecall: { Highlighter?: typeof Highlighter } };
    win.AlgoRecall = win.AlgoRecall || {};
    win.AlgoRecall.Highlighter = Highlighter;
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('Highlighter', `Error attaching Highlighter to window.AlgoRecall: ${errorMessage}`, { err });
}
