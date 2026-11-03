/**
 * @file features/highlighter/highlighter.tsx
 * @description In-page text selection highlighter, floating tooltip UI, and CSS Custom Highlights API manager.
 * Detects user text selections, displays anchored color swatch tooltips, manages note annotations,
 * links highlights to flashcard problem approaches, and restores highlight ranges across page sessions.
 * Migrated to Preact with TypeScript for modular, accessible tooltip UI rendering.
 * 
 * Context: Content script environment (injected into target web pages within the extension context).
 * 
 * Key Exports:
 * - `HighlighterState`: State interface managing in-memory marks, bookmarks, and tooltip timers.
 * - `HighlighterUtils`: Helper utilities interface for DOM range serialization and title extraction.
 * - `ApproachDraft`: Draft notes interface for uncommitted problem approaches.
 * - `Highlighter`: Main highlighter controller class managing DOM marks, tooltips, and storage persistence.
 * - `HighlighterTypeSelector`: Preact component for annotation type selection.
 * - `HighlighterSwatches`: Preact component for palette swatches and default color selection.
 * - `HighlighterColorPicker`: Preact component for native custom color picker.
 * - `HighlighterDeleteButton`: Preact component for highlight deletion.
 * - `HighlighterNotesSection`: Preact component for category and note annotations.
 * - `HighlighterTooltipView`: Preact container component for the floating highlighter tooltip.
 */

import { h, Fragment, render, ComponentChildren, VNode } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { HighlightMark, DOMMeta, ExtensionSettings, BookmarkItem, Card } from '../../types/domain';
import { DEFAULT_EXTENSION_SETTINGS, DEFAULT_PALETTES, DEFAULT_HIGHLIGHT_COLOR } from '../common/constants';

/**
 * Shared in-memory highlighter state container.
 */
export interface HighlighterState {
    /** Active theme indicator ('light' | 'dark'). */
    currentTheme?: string;
    /** Identifier of the highlight mark currently hovered by the user cursor. */
    hoveredMarkId?: string | null;
    /** Timer reference to delay tooltip dismissal during mouse movement transitions. */
    hideTooltipTimer?: ReturnType<typeof setTimeout> | null;
    /** Extension layout preferences and active palette selections. */
    extensionSettings: ExtensionSettings;
    /** Collection of all saved text highlight annotations. */
    marks: HighlightMark[];
    /** Saved problem page bookmarks. */
    bookmarks: BookmarkItem[];
    /** Injected page content excerpts and length metadata. */
    pagecontents: Array<{ url: string; description: string; length: number; [key: string]: unknown }>;
    /** Active live DOM Range references and colors for hover detection. */
    activeMarkRanges: Array<{ markId: string; range: Range; color: string }>;
    /** Optional cached study cards collection for approach linking. */
    cards?: Card[];
    /** Flag indicating whether the native color picker dialog is currently open. */
    isColorPickerOpen?: boolean;
    /** Cached range selection preserved while the color picker dialog is focused. */
    savedRange?: Range | null;
    /** Active mark ID being configured during creation mode. */
    activeCreationMarkId?: string | null;
    [key: string]: unknown;
}

/**
 * Utility functions required by the highlighter module.
 */
export interface HighlighterUtils {
    /** Serializes the DOM path coordinates of a given text boundary node. */
    getDOMMeta?: (node: Node | null, offset: number) => DOMMeta;
    /** Reconstructs a DOM Range from serialized start and end metadata coordinates. */
    restoreRangeFromMeta?: (meta: { startMeta?: DOMMeta; endMeta?: DOMMeta } | undefined, text: string) => Range | null;
    /** Injects custom CSS style rules for a specific color and annotation type. */
    ensureHighlightStyle?: (color: string, type: string) => string;
    /** Parses document title and DOM structure for clean problem titles. */
    getExtractedProblemTitle?: () => string;
    [key: string]: unknown;
}

/**
 * Interface defining approach draft notes stored for problem pages.
 */
export interface ApproachDraft {
    /** Markdown explanation of the algorithmic solution. */
    approach?: string;
    /** Comma-separated topic tag list. */
    tags?: string;
    [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface HighlighterTypeSelectorProps {
    activeType?: string;
    onSelectType: (type: string) => void;
}

/**
 * Preact component for annotation type selection ('highlight' vs 'underline').
 */
export function HighlighterTypeSelector({ activeType = 'highlight', onSelectType }: HighlighterTypeSelectorProps): VNode {
    const [currentType, setCurrentType] = useState<string>(activeType);

    const handleSelect = (t: string, e: Event) => {
        setCurrentType(t);
        const target = e.currentTarget as HTMLElement | null;
        const container = target?.closest('.algo-type-selector');
        if (container) {
            const btns = container.querySelectorAll('.algo-type-btn');
            btns.forEach((btn) => {
                const isMatch = (btn.textContent || '').trim().toLowerCase() === t.toLowerCase();
                btn.setAttribute('aria-checked', isMatch.toString());
                btn.setAttribute('tabindex', isMatch ? '0' : '-1');
                (btn as HTMLElement).style.background = isMatch ? 'var(--w-primary-container, #3498db)' : 'var(--w-bg-dark, #333)';
                (btn as HTMLElement).style.color = isMatch ? 'var(--w-on-primary-container, #fff)' : 'var(--w-text-med, #ccc)';
            });
        }
        onSelectType(t);
    };

    const types = ['highlight', 'underline'];

    return (
        <div
            className="algo-type-selector"
            role="radiogroup"
            aria-label="Highlight Type"
            style={{
                display: 'flex',
                width: '100%',
                marginBottom: '12px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--w-border, #444)'
            }}
        >
            {types.map((t) => {
                const isActive = t === currentType;
                return (
                    <button
                        key={t}
                        type="button"
                        className="algo-type-btn"
                        role="radio"
                        aria-checked={isActive ? 'true' : 'false'}
                        tabIndex={isActive ? 0 : -1}
                        style={{
                            flex: '1',
                            padding: '8px 0',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            border: 'none',
                            outline: 'none',
                            background: isActive ? 'var(--w-primary-container, #3498db)' : 'var(--w-bg-dark, #333)',
                            color: isActive ? 'var(--w-on-primary-container, #fff)' : 'var(--w-text-med, #ccc)'
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelect(t, e);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSelect(t, e);
                            }
                        }}
                    >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                );
            })}
        </div>
    );
}

export interface HighlighterSwatchesProps {
    paletteColors: string[];
    defaultHighlightColor: string;
    currentColor: string | null;
    onSelectColor: (color: string) => void;
}

/**
 * Preact component for color swatches, including the default color swatch.
 */
export function HighlighterSwatches({
    paletteColors,
    defaultHighlightColor,
    currentColor,
    onSelectColor
}: HighlighterSwatchesProps): VNode {
    const handleSwatchKeyDown = (e: KeyboardEvent, color: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectColor(color);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null;
            if (next && typeof next.focus === 'function') next.focus();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLElement | null;
            if (prev && typeof prev.focus === 'function') prev.focus();
        }
    };

    return (
        <Fragment>
            {paletteColors.map((color) => {
                const isActive = color === currentColor;
                return (
                    <div
                        key={color}
                        className={`algo-color-swatch ${isActive ? 'active' : ''}`}
                        role="button"
                        aria-label={`Highlight with color ${color}`}
                        title={`Color: ${color}`}
                        tabIndex={0}
                        style={{ background: color }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelectColor(color);
                        }}
                        onKeyDown={(e) => handleSwatchKeyDown(e as unknown as KeyboardEvent, color)}
                    />
                );
            })}

            {/* Default Highlight Color Swatch */}
            <div
                className={`algo-color-swatch algo-default-swatch ${defaultHighlightColor === currentColor ? 'active' : ''}`}
                id="algo-default-color-swatch"
                role="button"
                aria-label={`Highlight with default color ${defaultHighlightColor}`}
                title={`Default Color: ${defaultHighlightColor}`}
                tabIndex={0}
                data-default-color={defaultHighlightColor}
                style={{ background: defaultHighlightColor }}
                onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectColor(defaultHighlightColor);
                }}
                onKeyDown={(e) => handleSwatchKeyDown(e as unknown as KeyboardEvent, defaultHighlightColor)}
            />
        </Fragment>
    );
}

export interface HighlighterColorPickerProps {
    currentColor: string | null;
    defaultHighlightColor: string;
    onColorInput: (color: string) => void;
    onColorChange: (color: string) => void;
    onCacheSelection: () => void;
    onBlur: () => void;
}

/**
 * Preact component for the custom HTML color picker input.
 */
export function HighlighterColorPicker({
    currentColor,
    defaultHighlightColor,
    onColorInput,
    onColorChange,
    onCacheSelection,
    onBlur
}: HighlighterColorPickerProps): VNode {
    const pickerRef = useRef<HTMLInputElement>(null);
    const initialValue = currentColor || defaultHighlightColor || DEFAULT_HIGHLIGHT_COLOR;
    const [pickerVal, setPickerVal] = useState<string>(initialValue);

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
        e.stopPropagation();
        onCacheSelection();
    };

    return (
        <input
            ref={pickerRef}
            type="color"
            id="algo-color-picker"
            aria-label="Custom highlight color"
            title="Custom Color Picker"
            value={pickerVal}
            onPointerDown={handlePointerDown}
            onMouseDown={handlePointerDown}
            onClick={handlePointerDown}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onInput={(e) => {
                const newColor = (e.target as HTMLInputElement).value;
                setPickerVal(newColor);
                onColorInput(newColor);
            }}
            onChange={(e) => {
                const newColor = (e.target as HTMLInputElement).value;
                onColorChange(newColor);
            }}
            onBlur={() => {
                onBlur();
            }}
        />
    );
}

export interface HighlighterDeleteButtonProps {
    onDelete: () => void;
}

/**
 * Preact component for deleting an existing highlight annotation.
 */
export function HighlighterDeleteButton({ onDelete }: HighlighterDeleteButtonProps): VNode {
    return (
        <div
            className="algo-delete-btn"
            role="button"
            aria-label="Delete Highlight"
            tabIndex={0}
            onMouseDown={(e) => {
                e.preventDefault();
                onDelete();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDelete();
                }
            }}
        >
            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }}>
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
            </svg>
        </div>
    );
}

export interface HighlighterNotesSectionProps {
    mark: HighlightMark | undefined;
    onSaveCategory: (category: string) => void;
    onSaveNote: (note: string) => void;
    onLinkCard: () => void;
}

/**
 * Preact component for category selection, text note annotation, and card linking.
 */
export function HighlighterNotesSection({
    mark,
    onSaveCategory,
    onSaveNote,
    onLinkCard
}: HighlighterNotesSectionProps): VNode {
    const linkBtnRef = useRef<HTMLButtonElement>(null);
    const categories = ['', 'Key Insight', 'Gotcha', 'Edge Case', 'Pattern'];

    const handleLinkClick = () => {
        onLinkCard();
        const btn = linkBtnRef.current;
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '✓';
            btn.style.color = '#2ecc71';
            setTimeout(() => {
                try {
                    btn.innerHTML = originalHtml;
                    btn.style.color = '';
                } catch {
                    // Ignore reset error
                }
            }, 1500);
        }
    };

    return (
        <div className="algo-note-section">
            <select
                className="algo-category-select"
                value={mark?.category || ''}
                onChange={(e) => onSaveCategory((e.target as HTMLSelectElement).value)}
            >
                {categories.map((cat) => (
                    <option key={cat} value={cat}>
                        {cat || 'No Category'}
                    </option>
                ))}
            </select>

            <input
                type="text"
                className="algo-note-input"
                placeholder="Add note..."
                value={mark?.note || ''}
                maxLength={200}
                onInput={(e) => onSaveNote((e.target as HTMLInputElement).value)}
            />

            <button
                ref={linkBtnRef}
                type="button"
                className="algo-link-btn"
                title="Link Highlight to Card"
                aria-label="Link Highlight to Card"
                onClick={handleLinkClick}
            >
                <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
            </button>
        </div>
    );
}

export interface HighlighterTooltipViewProps {
    existingMarkId: string | null;
    currentColor: string | null;
    activeType: string;
    paletteColors: string[];
    defaultHighlightColor: string;
    mark: HighlightMark | undefined;
    onSelectType: (type: string) => void;
    onSelectColor: (color: string) => void;
    onColorInput: (color: string) => void;
    onColorChange: (color: string) => void;
    onColorBlur: () => void;
    onCacheSelection: () => void;
    onDelete: () => void;
    onSaveCategory: (category: string) => void;
    onSaveNote: (note: string) => void;
    onLinkCard: () => void;
}

/**
 * Preact container view rendering all sub-components inside the floating tooltip.
 */
export function HighlighterTooltipView(props: HighlighterTooltipViewProps): VNode {
    return (
        <Fragment>
            {!props.existingMarkId && (
                <HighlighterTypeSelector
                    activeType={props.activeType}
                    onSelectType={props.onSelectType}
                />
            )}

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    flexWrap: 'wrap'
                }}
            >
                <HighlighterSwatches
                    paletteColors={props.paletteColors}
                    defaultHighlightColor={props.defaultHighlightColor}
                    currentColor={props.currentColor}
                    onSelectColor={props.onSelectColor}
                />

                <HighlighterColorPicker
                    currentColor={props.currentColor}
                    defaultHighlightColor={props.defaultHighlightColor}
                    onColorInput={props.onColorInput}
                    onColorChange={props.onColorChange}
                    onCacheSelection={props.onCacheSelection}
                    onBlur={props.onColorBlur}
                />

                {props.existingMarkId && (
                    <Fragment>
                        <div className="algo-tooltip-divider" />
                        <HighlighterDeleteButton onDelete={props.onDelete} />
                    </Fragment>
                )}
            </div>

            {props.existingMarkId && (
                <HighlighterNotesSection
                    mark={props.mark}
                    onSaveCategory={props.onSaveCategory}
                    onSaveNote={props.onSaveNote}
                    onLinkCard={props.onLinkCard}
                />
            )}
        </Fragment>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHTER CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for in-page text selection highlights, floating action tooltips, and CSS Custom Highlights.
 */
export class Highlighter {
    /** Shared state slice accessed by the highlighter. */
    state: HighlighterState;
    /** Content script utilities. */
    utils: HighlighterUtils;
    /** Flag tracking whether document pointer and keyboard listeners have been bound. */
    isHighlighterListenersBound: boolean = false;
    /** Active annotation type ('highlight' or 'underline') for new marks. */
    activeType: string = 'highlight';

    /**
     * Initializes the highlighter controller, attaching to `window.AlgoRecall.state` if available.
     */
    constructor() {
        try {
            const win = window as unknown as {
                AlgoRecall?: {
                    state?: HighlighterState;
                    Utils?: HighlighterUtils;
                };
            };
            this.state = (win.AlgoRecall && win.AlgoRecall.state) ? win.AlgoRecall.state : {
                extensionSettings: { ...DEFAULT_EXTENSION_SETTINGS },
                marks: [],
                bookmarks: [],
                pagecontents: [],
                activeMarkRanges: [],
                hoveredMarkId: null,
                hideTooltipTimer: null,
                isColorPickerOpen: false,
                savedRange: null,
                activeCreationMarkId: null
            };
            this.utils = (win.AlgoRecall && win.AlgoRecall.Utils) ? win.AlgoRecall.Utils : {};
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error in Highlighter constructor: ${errorMessage}`, { err });
            this.state = {
                extensionSettings: { ...DEFAULT_EXTENSION_SETTINGS },
                marks: [],
                bookmarks: [],
                pagecontents: [],
                activeMarkRanges: [],
                hoveredMarkId: null,
                hideTooltipTimer: null,
                isColorPickerOpen: false,
                savedRange: null,
                activeCreationMarkId: null
            };
            this.utils = {};
        }
    }

    /**
     * Injects the floating tooltip element `#algo-highlight-tooltip` into `document.body`
     * and binds pointerup, mousemove, and keyboard selection events.
     * 
     * @returns {void}
     */
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
        }
    }

    /**
     * Removes the floating highlighter tooltip DOM element if present.
     * 
     * @returns {void}
     */
    removeHighlighterUI(): void {
        try {
            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (tooltip) {
                render(null, tooltip);
                tooltip.remove();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error removing highlighter UI: ${errorMessage}`, { err });
        }
    }

    /**
     * Binds text selection triggers (pointerup), hover detection across active highlights (mousemove),
     * and keyboard selection adjustments (keyup).
     * 
     * @returns {void}
     */
    bindEvents(): void {
        try {
            // 1. Text Selection Logic (For NEW highlights)
            document.addEventListener('pointerup', (e: MouseEvent) => {
                try {
                    const showPopup = this.state.extensionSettings?.showMarkerPopup !== false;
                    if (!showPopup) return;

                    const tooltip = document.getElementById('algo-highlight-tooltip');
                    const isPickerOpen = Boolean(this.state.isColorPickerOpen || tooltip?.getAttribute('data-picker-open') === 'true');
                    if (isPickerOpen) {
                        if (this.state.hideTooltipTimer) {
                            clearTimeout(this.state.hideTooltipTimer);
                            this.state.hideTooltipTimer = null;
                        }
                        return;
                    }

                    const target = e.target as HTMLElement | null;
                    if (target && typeof target.closest === 'function' && (target.closest('#algo-highlight-tooltip') || target.closest('#algo-fsrs-container'))) return;

                    const selection = window.getSelection();
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
                    this.positionTooltip(tooltip, lastRect.right + window.scrollX, lastRect.bottom + window.scrollY, lastRect.top + window.scrollY);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error in pointerup event handler: ${errorMessage}`, { err });
                }
            }, true);

            // 2. Hover Detection Logic (For EXISTING highlights)
            document.addEventListener('mousemove', (e: MouseEvent) => {
                try {
                    const showPopup = this.state.extensionSettings?.showMarkerPopup !== false;
                    if (!showPopup) return;

                    const tooltip = document.getElementById('algo-highlight-tooltip');
                    const isPickerOpen = Boolean(this.state.isColorPickerOpen || tooltip?.getAttribute('data-picker-open') === 'true');
                    if (isPickerOpen) {
                        if (this.state.hideTooltipTimer) {
                            clearTimeout(this.state.hideTooltipTimer);
                            this.state.hideTooltipTimer = null;
                        }
                        return;
                    }

                    const target = e.target as HTMLElement | null;
                    if (target && typeof target.closest === 'function' && (target.closest('#algo-highlight-tooltip') || target.closest('#algo-fsrs-container'))) {
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

                    if (!tooltip) return;

                    if (foundMark) {
                        if (this.state.hideTooltipTimer) {
                            clearTimeout(this.state.hideTooltipTimer);
                            this.state.hideTooltipTimer = null;
                        }

                        if (this.state.hoveredMarkId !== foundMark.markId) {
                            this.state.hoveredMarkId = foundMark.markId;
                            this.renderTooltipColors(this.state.hoveredMarkId, foundMark.color);
                            const r = foundMark.range.getBoundingClientRect();
                            this.positionTooltip(tooltip, e.clientX + window.scrollX + 15, e.clientY + window.scrollY, r.top + window.scrollY);
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
        }
    }

    /**
     * Inspects current window text selection boundaries and anchors the floating highlighter tooltip.
     * 
     * @returns {void}
     */
    handleTextSelection(): void {
        try {
            if (this.state.isColorPickerOpen) return;
            const selection = window.getSelection();
            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (!tooltip) return;

            if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
                if (!this.state.hoveredMarkId) {
                    tooltip.style.display = 'none';
                }
                return;
            }

            const showPopup = this.state.extensionSettings?.showMarkerPopup !== false;
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
                this.positionTooltip(tooltip, lastRect.right + window.scrollX, lastRect.bottom + window.scrollY, lastRect.top + window.scrollY);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error in handleTextSelection: ${errorMessage}`, { err });
        }
    }

    /**
     * Calculates absolute screen coordinates for the floating tooltip, ensuring it stays within viewport
     * boundaries and flipping above the text range when bottom clearance is insufficient.
     * 
     * @param {HTMLElement} tooltip - Floating tooltip container element.
     * @param {number} x - Target horizontal page coordinate.
     * @param {number} y - Target vertical page coordinate.
     * @param {number} fallbackTop - Alternate top coordinate for upward flipping.
     * @returns {void}
     */
    positionTooltip(tooltip: HTMLElement, x: number, y: number, fallbackTop: number): void {
        tooltip.style.display = 'flex';
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left = x;
        let top = y;
        let isFlippedAbove = false;

        if (left + tooltipRect.width > window.scrollX + window.innerWidth) {
            left = window.scrollX + window.innerWidth - tooltipRect.width - 15;
        }
        if (left < window.scrollX + 5) left = window.scrollX + 5;

        if (top + tooltipRect.height > window.scrollY + window.innerHeight) {
            top = fallbackTop - tooltipRect.height - 10;
            isFlippedAbove = true;
        }
        if (top < window.scrollY + 5) top = window.scrollY + 5;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        // Compute dynamic caret horizontal position relative to anchor x
        const relativeX = x - left;
        const width = tooltipRect.width > 0 ? tooltipRect.width : 200;
        const caretLeft = Math.min(Math.max(relativeX, 16), width - 16);
        tooltip.style.setProperty('--tooltip-caret-left', `${caretLeft}px`);

        if (isFlippedAbove) {
            tooltip.classList.add('caret-bottom');
        } else {
            tooltip.classList.remove('caret-bottom');
        }
    }

    handleMouseMove(_e: MouseEvent): void {
        // Main mousemove handling is bound in bindEvents
    }

    /**
     * Renders palette color swatches, native color picker, type selector, and note editing forms
     * inside the floating tooltip. Adapts layout depending on whether creating a new or modifying an existing highlight.
     * 
     * @param {string | null} [existingMarkId=null] - Mark ID if editing an existing highlight.
     * @param {string | null} [currentColor=null] - Currently assigned hex color string.
     * @returns {void}
     */
    renderTooltipColors(existingMarkId: string | null = null, currentColor: string | null = null): void {
        try {
            if (this.state.isColorPickerOpen) return;
            const tooltip = document.getElementById('algo-highlight-tooltip');
            if (!tooltip) return;

            const activeIndex = this.state.extensionSettings?.activePaletteIndex || 0;
            const activePalette = (this.state.extensionSettings?.palettes && this.state.extensionSettings.palettes.length > activeIndex)
                ? this.state.extensionSettings.palettes[activeIndex]
                : { colors: DEFAULT_PALETTES[0].colors };

            const paletteColors = activePalette.colors || [];
            const defaultHighlightColor = this.state.extensionSettings?.defaultHighlightColor || DEFAULT_HIGHLIGHT_COLOR;

            const existingMark = existingMarkId
                ? this.state.marks.find((m: HighlightMark) => (m.id || m.createdAt.toString()) === existingMarkId)
                : undefined;

            const handleSelectType = (typeVal: string) => {
                this.activeType = typeVal;
            };

            const handleSelectColor = (color: string) => {
                try {
                    if (existingMarkId) {
                        this.updateHighlightColor(existingMarkId, color);
                    } else {
                        this.saveHighlight(color, this.activeType);
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error handling select color ${color}: ${errorMessage}`, { color, err });
                }
            };

            const handleColorInput = (newColor: string) => {
                try {
                    const defaultSwatch = tooltip.querySelector('#algo-default-color-swatch') as HTMLElement | null;
                    if (defaultSwatch) {
                        defaultSwatch.style.background = newColor;
                        defaultSwatch.title = `Default Color: ${newColor}`;
                        defaultSwatch.setAttribute('data-default-color', newColor);
                    }

                    this.updateRecentColors(newColor);

                    if (existingMarkId) {
                        this.updateHighlightColor(existingMarkId, newColor);
                    } else if (this.state.activeCreationMarkId) {
                        this.updateHighlightColor(this.state.activeCreationMarkId, newColor);
                    } else {
                        this.saveHighlight(newColor, this.activeType);
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error in custom color picker input: ${errorMessage}`, { err });
                }
            };

            const handleColorChange = (newColor: string) => {
                try {
                    setTimeout(() => {
                        this.state.isColorPickerOpen = false;
                        if (tooltip) tooltip.removeAttribute('data-picker-open');
                        this.state.savedRange = null;
                        this.state.activeCreationMarkId = null;
                        if (!existingMarkId) {
                            if (tooltip) tooltip.style.display = 'none';
                            const selection = window.getSelection();
                            if (selection) selection.removeAllRanges();
                        } else {
                            this.renderTooltipColors(existingMarkId, newColor);
                        }
                    }, 50);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error in picker change handler: ${errorMessage}`, { err });
                }
            };

            const handleCacheSelection = () => {
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                    this.state.savedRange = selection.getRangeAt(0).cloneRange();
                }
                this.state.isColorPickerOpen = true;
                if (tooltip) tooltip.setAttribute('data-picker-open', 'true');
                if (this.state.hideTooltipTimer) {
                    clearTimeout(this.state.hideTooltipTimer);
                    this.state.hideTooltipTimer = null;
                }
            };

            const handleColorBlur = () => {
                setTimeout(() => {
                    const picker = tooltip.querySelector('#algo-color-picker');
                    if (document.activeElement !== picker) {
                        this.state.isColorPickerOpen = false;
                        if (tooltip) tooltip.removeAttribute('data-picker-open');
                        this.state.savedRange = null;
                        this.state.activeCreationMarkId = null;
                    }
                }, 250);
            };

            const handleDelete = () => {
                try {
                    if (existingMarkId) {
                        this.deleteHighlight(existingMarkId);
                        this.renderTooltipColors();
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Highlighter', `Error handling delete button click: ${errorMessage}`, { existingMarkId, err });
                }
            };

            const handleSaveCategory = (category: string) => {
                if (existingMarkId) this.saveMarkCategory(existingMarkId, category);
            };

            const handleSaveNote = (noteText: string) => {
                if (existingMarkId) this.saveMarkNote(existingMarkId, noteText);
            };

            const handleLinkCard = () => {
                if (existingMarkId) this.linkHighlightToCard(existingMarkId);
            };

            // Mount Preact Component inside the tooltip DOM element
            render(
                <HighlighterTooltipView
                    existingMarkId={existingMarkId}
                    currentColor={currentColor}
                    activeType={this.activeType}
                    paletteColors={paletteColors}
                    defaultHighlightColor={defaultHighlightColor}
                    mark={existingMark}
                    onSelectType={handleSelectType}
                    onSelectColor={handleSelectColor}
                    onColorInput={handleColorInput}
                    onColorChange={handleColorChange}
                    onColorBlur={handleColorBlur}
                    onCacheSelection={handleCacheSelection}
                    onDelete={handleDelete}
                    onSaveCategory={handleSaveCategory}
                    onSaveNote={handleSaveNote}
                    onLinkCard={handleLinkCard}
                />,
                tooltip
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error rendering tooltip colors: ${errorMessage}`, { existingMarkId, currentColor, err });
        }
    }

    /**
     * Updates the category tag (e.g. 'Key Insight', 'Gotcha', 'Edge Case') for a saved highlight.
     * 
     * @param {string} markId - ID of the target highlight mark.
     * @param {string} category - Selected category string.
     * @returns {void}
     */
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

    /**
     * Appends the selected highlight snippet (and any attached note) into the active FSRS problem
     * card's approach notes or unsaved draft notes in storage.
     * 
     * @param {string} markId - ID of the highlight to link.
     * @returns {void}
     */
    linkHighlightToCard(markId: string): void {
        try {
            const mark = this.state.marks.find((m: HighlightMark) => (m.id || m.createdAt.toString()) === markId);
            if (!mark) return;

            const cleanUrl = window.location.href.split('?')[0].split('#')[0];
            const prefix = mark.category ? `**${mark.category}:** ` : '';
            const appendText = `\n\n> ${prefix}${mark.text}` + (mark.note ? `\n> *Note: ${mark.note}*` : '');

            chrome.storage.local.get(['fsrsCards', 'approachDrafts'], (result: { fsrsCards?: Card[]; approachDrafts?: Record<string, ApproachDraft | string> }) => {
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
                        const rawDraft = drafts[cleanUrl];
                        let draft: ApproachDraft;
                        if (!rawDraft) {
                            draft = { approach: '', tags: '' };
                        } else if (typeof rawDraft === 'string') {
                            draft = { approach: rawDraft, tags: '' };
                        } else {
                            draft = { ...rawDraft };
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

    /**
     * Caches recently used custom color selections in `extensionSettings.recentColors`.
     * 
     * @param {string} newColor - Hex color code.
     * @returns {void}
     */
    updateRecentColors(newColor: string): void {
        try {
            if (!this.state.extensionSettings || !this.state.extensionSettings.palettes) {
                this.state.extensionSettings = JSON.parse(JSON.stringify(DEFAULT_EXTENSION_SETTINGS));
            }
            this.state.extensionSettings.defaultHighlightColor = newColor;
            const recent = this.state.extensionSettings.recentColors || [];
            this.state.extensionSettings.recentColors = [newColor, ...recent.filter((c: string) => c !== newColor)].slice(0, 4);
            chrome.storage.local.set({ extensionSettings: this.state.extensionSettings });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error updating recent colors with ${newColor}: ${errorMessage}`, { newColor, err });
        }
    }

    /**
     * Alias method triggering `saveHighlight`.
     * 
     * @param {string} color - Hex color code.
     * @param {string} [type='highlight'] - Annotation style type.
     * @returns {void}
     */
    createHighlight(color: string, type: string = 'highlight'): void {
        try {
            this.saveHighlight(color, type);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error creating highlight: ${errorMessage}`, { color, type, err });
        }
    }

    /**
     * Serializes the active text selection or cached range coordinates into a new `HighlightMark` record,
     * updates bookmarks and page content snapshots, persists to storage, and activates DOM highlights.
     * 
     * @param {string} color - Hex color code for the highlight.
     * @param {string} [type='highlight'] - Visual style ('highlight' or 'underline').
     * @returns {void}
     */
    saveHighlight(color: string, type: string = 'highlight'): void {
        try {
            const selection = window.getSelection();
            let range: Range | null = null;
            let text = '';

            if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
                text = selection.toString();
            } else if (this.state.savedRange) {
                range = this.state.savedRange;
                text = range.toString();
            }

            if (!range || !text || text.trim() === '') return;

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
            if (this.state.isColorPickerOpen) {
                this.state.activeCreationMarkId = newMark.id;
            }

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
            const isPickerOpen = Boolean(this.state.isColorPickerOpen || tooltip?.getAttribute('data-picker-open') === 'true');
            if (tooltip && !isPickerOpen) tooltip.style.display = 'none';
            if (selection && !isPickerOpen) {
                selection.removeAllRanges();
            }

            this.applyHighlightsForCurrentPage();
            Logger.info('Highlighter', `Created new highlight with color: ${color}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Failed saving highlight: ${errorMessage}`, { color, type, err });
        }
    }

    /**
     * Modifies the color of an existing highlight mark and updates the CSS highlight representation.
     * 
     * @param {string} markId - Identifier of the target highlight mark.
     * @param {string} newColor - New hex color code.
     * @returns {void}
     */
    updateHighlightColor(markId: string, newColor: string): void {
        try {
            const markIndex = this.state.marks.findIndex((m: HighlightMark) => (m.id || m.createdAt.toString()) === markId);
            if (markIndex > -1) {
                this.state.marks[markIndex].color = newColor;
                chrome.storage.local.set({ marks: this.state.marks });
                this.applyHighlightsForCurrentPage();
                if (!this.state.isColorPickerOpen) {
                    this.renderTooltipColors(markId, newColor);
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Highlighter', `Error updating highlight color for ${markId}: ${errorMessage}`, { markId, newColor, err });
        }
    }

    /**
     * Deletes a highlight mark from extension storage and clears its CSS highlight overlay.
     * 
     * @param {string} markId - ID of the mark to delete.
     * @returns {void}
     */
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
        }
    }

    /**
     * Saves user note text attached to a specific highlight mark.
     * 
     * @param {string} markId - ID of the mark.
     * @param {string} noteText - Note content string.
     * @returns {void}
     */
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

    /**
     * Queries all saved marks for the active URL, deserializes their DOM tree ranges,
     * registers CSS style rules, and renders annotations via the CSS Custom Highlights API.
     * 
     * @returns {void}
     */
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

// Augment CommonJS exports to preserve backward compatibility for tests and callers
if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).Highlighter = Highlighter;
    (module.exports as any).HighlighterTooltipView = HighlighterTooltipView;
    (module.exports as any).HighlighterTypeSelector = HighlighterTypeSelector;
    (module.exports as any).HighlighterSwatches = HighlighterSwatches;
    (module.exports as any).HighlighterColorPicker = HighlighterColorPicker;
    (module.exports as any).HighlighterDeleteButton = HighlighterDeleteButton;
    (module.exports as any).HighlighterNotesSection = HighlighterNotesSection;
}
