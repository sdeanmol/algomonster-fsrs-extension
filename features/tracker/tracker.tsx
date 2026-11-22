/**
 * @file features/tracker/tracker.tsx
 * @description Main Spaced Repetition floating widget interface injected inside target coding domains.
 * Pure declarative Preact 11 architecture replacing all imperative DOM queries and mutations.
 * 
 * Context: Content script environment (injected into whitelisted problem pages).
 * 
 * Key Exports:
 * - `Tracker`: In-page floating widget controller for flashcard review sessions, approaches, and ratings.
 * - Preact components: `TrackerFloatingLauncher`, `TrackerHeader`, `TrackerNavBar`, `TrackerRatingBar`,
 *   `TrackerCardReviewView`, `TrackerTagPicker`, `TrackerOverlay`, `TrackerApp`.
 */

import { h, Fragment, FunctionalComponent, render, options, RefObject } from 'preact';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { flushSync } from 'preact/compat';
import { ensureCardIds, getCardsForUrl, generateCardId, cleanUrl } from '../common/utils/cardUtils';
import { TagInputControl } from '../common/utils/tagInput';
import { Card, StorageData, ExtensionSettings } from '../../types/domain';
import { RATING_UI_DEBOUNCE_MS } from '../common/constants';
import FsrsScheduler from './scheduler/fsrsScheduler';
import { Logger } from '@common/logger';
import { Notifier } from '../../content/notifications';
import {
    getOrCreateTrackerHost,
    removeTrackerHost,
    getTrackerHost,
    isTrackerLauncherPresent
} from '../../content/utils';

declare const jest: any;

// Synchronous rendering configurations for test environments
const origRaf = options.requestAnimationFrame;
options.requestAnimationFrame = (cb: () => void) => {
    if (typeof jest !== 'undefined') {
        cb();
    } else if (origRaf) {
        origRaf(cb);
    } else if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(cb);
    } else {
        setTimeout(cb, 0);
    }
};

if (typeof jest !== 'undefined') {
    options.debounceRendering = (cb: () => void) => cb();
}

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

/**
 * Shared in-memory state slice accessed by the tracker.
 */
interface AlgoRecallState {
    cards: Card[];
    topicWeights: Record<string, number[]>;
    scheduler: FsrsScheduler;
    extensionSettings?: ExtensionSettings;
}

/**
 * Shape of an approach draft record in storage.
 */
interface DraftEntry {
    approach?: string;
    tags?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    [key: string]: unknown;
}

interface AppLogger {
    debug(category: string, message: string, data?: unknown): void;
    info(category: string, message: string, data?: unknown): void;
    warn(category: string, message: string, data?: unknown): void;
    error(category: string, message: string, data?: unknown): void;
}

interface AppUtils {
    getAutoTags(): string[];
    getExtractedProblemTitle(): string;
}

interface AlgoRecallGlobal {
    state: AlgoRecallState;
    Utils: AppUtils;
    Notifier: unknown;
    Tracker: typeof Tracker;
    orchestrator?: { applyThemeClass(): void };
}

function getAlgoRecallGlobal(): AlgoRecallGlobal {
    try {
        const win = window as unknown as { AlgoRecall: AlgoRecallGlobal };
        win.AlgoRecall = win.AlgoRecall || ({} as AlgoRecallGlobal);
        return win.AlgoRecall;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Tracker', `Failed to access window in getAlgoRecallGlobal: ${errorMessage}`, { err });
        return {
            state: { cards: [], topicWeights: {}, scheduler: new FsrsScheduler() },
            Utils: { getAutoTags: () => [], getExtractedProblemTitle: () => '' },
            Notifier: null,
            Tracker
        };
    }
}

function getLogger(): AppLogger {
    return Logger;
}

function getRenderMarkdown(): ((text: string) => string) | undefined {
    try {
        return (window as unknown as { renderMarkdown?: (text: string) => string }).renderMarkdown;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.warn('Tracker', `Failed to access window in getRenderMarkdown: ${errorMessage}`, { err });
        return undefined;
    }
}

// ==========================================
// PREACT UI COMPONENTS
// ==========================================

export interface TrackerFloatingLauncherProps {
    isOpen?: boolean;
    showLauncher?: boolean;
    isDragging?: boolean;
    pos?: { x: number; y: number; isCustom: boolean };
    onClick?: (e: MouseEvent) => void;
    onPointerDown?: (e: PointerEvent) => void;
    onMouseDown?: (e: MouseEvent) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
    onContextMenu?: (e: MouseEvent) => void;
    launcherRef?: RefObject<HTMLDivElement | null> | ((el: HTMLDivElement | null) => void);
}

export const TrackerFloatingLauncher: FunctionalComponent<TrackerFloatingLauncherProps> = ({
    isOpen = false,
    showLauncher = true,
    isDragging = false,
    pos,
    onClick,
    onPointerDown,
    onMouseDown,
    onKeyDown,
    onContextMenu,
    launcherRef
}) => {
    const style: Record<string, string | number> = {
        display: !showLauncher ? 'none' : (isOpen ? 'none' : 'flex'),
        cursor: isDragging ? 'grabbing' : 'pointer'
    };
    if (pos && pos.isCustom) {
        style.left = `${pos.x}px`;
        style.top = `${pos.y}px`;
        style.right = 'auto';
        style.bottom = 'auto';
    } else {
        style.left = '';
        style.top = '';
        style.right = '';
        style.bottom = '';
    }

    return (
        <div
            ref={launcherRef as any}
            id="algo-fsrs-launcher"
            role="button"
            aria-label="Open AlgoRecall Tracker"
            aria-expanded={isOpen ? 'true' : 'false'}
            aria-controls="algo-fsrs-container"
            tabIndex={0}
            title="AlgoRecall Tracker (Drag to move, Right-click to reset position)"
            style={style}
            onClick={onClick}
            onPointerDown={onPointerDown}
            onMouseDown={onMouseDown}
            onKeyDown={onKeyDown}
            onContextMenu={onContextMenu}
        >
            <svg class="launcher-svg" viewBox="0 0 24 24" style={{ width: '26px', height: '26px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1 1-2 1-3.5 0-2.5 2-5 5.5-6z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
            </svg>
        </div>
    );
};

export interface TrackerHeaderProps {
    problemTitle?: string;
    onMinimize?: () => void;
    onClose?: () => void;
}

export const TrackerHeader: FunctionalComponent<TrackerHeaderProps> = ({ problemTitle, onMinimize, onClose }) => {
    return (
        <div id="fsrs-header">
            <div class="fsrs-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <span>{problemTitle ? `AlgoRecall Tracker - ${problemTitle}` : 'AlgoRecall Tracker'}</span>
            </div>
            <div class="fsrs-controls">
                <button
                    id="fsrs-min-btn"
                    class="fsrs-icon-btn"
                    aria-label="Minimize"
                    aria-expanded="true"
                    aria-controls="algo-fsrs-container"
                    title="Minimize"
                    onClick={onMinimize}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
                <button
                    id="fsrs-close-btn"
                    class="fsrs-icon-btn"
                    aria-label="Close"
                    title="Close"
                    onClick={onClose}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export interface TrackerNavBarProps {
    cards: Card[];
    activeCardId: string | null;
    onSelectCard?: (cardId: string) => void;
    onAddCard?: () => void;
}

export const TrackerNavBar: FunctionalComponent<TrackerNavBarProps> = ({ cards, activeCardId, onSelectCard, onAddCard }) => {
    return (
        <div id="fsrs-nav-bar" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
            {cards.map((c, idx) => {
                const isActive = (c.id === activeCardId);
                const tagLabel = (c.tags && c.tags.length > 0) ? ` (${c.tags.join(', ')})` : '';
                const cardTitleText = `Card ${idx + 1}${tagLabel}`;
                return (
                    <button
                        key={c.id}
                        class="fsrs-card-tab-btn"
                        data-card-id={c.id}
                        title={cardTitleText}
                        style={{
                            background: isActive ? '#4CAF50' : 'rgba(255,255,255,0.1)',
                            color: isActive ? '#fff' : '#ccc',
                            fontWeight: isActive ? 'bold' : 'normal',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxHeight: '4.5em',
                            wordBreak: 'break-word',
                            whiteSpace: 'normal',
                            maxWidth: '120px',
                            flexShrink: 0,
                            lineHeight: 1.3
                        }}
                        onClick={() => onSelectCard && onSelectCard(c.id)}
                    >
                        {cardTitleText}
                    </button>
                );
            })}
            <button
                class="fsrs-card-tab-btn"
                data-card-id="__new__"
                title="+ Add Card"
                style={{
                    background: activeCardId === '__new__' ? '#2196F3' : 'rgba(33,150,243,0.2)',
                    color: activeCardId === '__new__' ? '#fff' : '#64b5f6',
                    fontWeight: activeCardId === '__new__' ? 'bold' : 'normal',
                    border: activeCardId === '__new__' ? 'none' : '1px dashed #2196F3',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0
                }}
                onClick={onAddCard}
            >
                + Add Card
            </button>
        </div>
    );
};

export interface TrackerRatingBarProps {
    onRate?: (rating: number) => void;
    lastRating?: number;
    existingId?: string;
    savedRatingSuccess?: number | null;
}

export const TrackerRatingBar: FunctionalComponent<TrackerRatingBarProps> = ({
    onRate,
    lastRating,
    existingId,
    savedRatingSuccess
}) => {
    const ratings = [
        { rating: 1, label: 'Again', className: 'fsrs-btn-again', title: 'Hard to remember (Shortcut: 1)' },
        { rating: 2, label: 'Hard', className: 'fsrs-btn-hard', title: 'Remembered with effort (Shortcut: 2)' },
        { rating: 3, label: 'Good', className: 'fsrs-btn-good', title: 'Remembered easily (Shortcut: 3)' },
        { rating: 4, label: 'Easy', className: 'fsrs-btn-easy', title: 'Too easy (Shortcut: 4)' }
    ];

    return (
        <div class="fsrs-rating-buttons" id="fsrs-save-ratings" data-existing-id={existingId}>
            {ratings.map(r => {
                const isSelected = lastRating === r.rating;
                const isSaved = savedRatingSuccess === r.rating;
                return (
                    <button
                        key={r.rating}
                        data-rating={String(r.rating)}
                        class={r.className}
                        title={r.title}
                        aria-label={r.title}
                        style={{
                            opacity: isSelected ? '1' : lastRating ? '0.4' : '1',
                            boxShadow: isSelected ? '0 0 0 2px #fff inset' : 'none'
                        }}
                        onClick={() => onRate && onRate(r.rating)}
                    >
                        {isSaved ? 'Saved ✓' : r.label}
                    </button>
                );
            })}
        </div>
    );
};

export interface TrackerCardReviewViewProps {
    card: Card;
    index: number;
    total: number;
    activeFilter?: string | null;
    isAnswerShown?: boolean;
    onShowAnswer?: () => void;
    onBack?: () => void;
    onRate?: (rating: number) => void;
}

export const TrackerCardReviewView: FunctionalComponent<TrackerCardReviewViewProps> = ({
    card,
    index,
    total,
    activeFilter,
    isAnswerShown = false,
    onShowAnswer,
    onBack,
    onRate
}) => {
    const progressPct = total > 0 ? Math.round((index / total) * 100) : 0;
    const renderFn = getRenderMarkdown();
    const approachHtml = typeof renderFn === 'function'
        ? renderFn(card.approach || '')
        : (card.approach || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

    return (
        <Fragment>
            <div class="fsrs-review-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.problemTitle}</h4>
                    {activeFilter ? (
                        <div class="fsrs-filter-badge">
                            <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px' }}>
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                            {activeFilter}
                        </div>
                    ) : null}
                </div>
                <button
                    id="fsrs-back-btn"
                    title="Go Back"
                    style={{ background: 'none', border: 'none', color: 'var(--md-text-low)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                    aria-label="Go Back"
                    onClick={onBack}
                >
                    <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px' }}>
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Back
                </button>
            </div>
            <div class="fsrs-progress-bar">
                <div class="fsrs-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div class="fsrs-review-meta">
                <span class="fsrs-progress-text">{index} of {total}</span>
            </div>
            {card.tags && card.tags.length > 0 ? (
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg class="svg-icon" viewBox="0 0 24 24" style={{ stroke: '#888', width: '13px', height: '13px' }}>
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    <span>{card.tags.join(', ')}</span>
                </div>
            ) : null}
            <p style={{ marginBottom: '15px' }}>
                <a href={card.problemUrl} target="_blank" style={{ color: '#4CAF50', textDecoration: 'none', fontWeight: 'bold', borderBottom: '1px solid #4CAF50', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <svg class="svg-icon" viewBox="0 0 24 24" style={{ stroke: '#4CAF50', width: '13px', height: '13px' }}>
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Open Problem Page
                </a>
            </p>
            <div id="fsrs-approach-answer" style={{ display: isAnswerShown ? 'block' : 'none' }}>
                <div class="fsrs-markdown">
                    <strong>Your Approach:</strong>
                    <span dangerouslySetInnerHTML={{ __html: approachHtml }} />
                </div>
                <div class="fsrs-rating-buttons">
                    <div class="fsrs-rating-btn-wrapper">
                        <button data-rating="1" style={{ background: '#e74c3c' }} onClick={() => onRate && onRate(1)}>Again</button>
                        <kbd class="fsrs-kbd-hint">1</kbd>
                    </div>
                    <div class="fsrs-rating-btn-wrapper">
                        <button data-rating="2" style={{ background: '#e67e22' }} onClick={() => onRate && onRate(2)}>Hard</button>
                        <kbd class="fsrs-kbd-hint">2</kbd>
                    </div>
                    <div class="fsrs-rating-btn-wrapper">
                        <button data-rating="3" style={{ background: '#2ecc71' }} onClick={() => onRate && onRate(3)}>Good</button>
                        <kbd class="fsrs-kbd-hint">3</kbd>
                    </div>
                    <div class="fsrs-rating-btn-wrapper">
                        <button data-rating="4" style={{ background: '#3498db' }} onClick={() => onRate && onRate(4)}>Easy</button>
                        <kbd class="fsrs-kbd-hint">4</kbd>
                    </div>
                </div>
            </div>
            <button
                id="fsrs-show-answer-btn"
                class="fsrs-primary-btn"
                style={{ display: isAnswerShown ? 'none' : 'inline-flex' }}
                onClick={onShowAnswer}
            >
                <span>Show Approach</span>
                <kbd class="fsrs-kbd-hint" style={{ marginLeft: '8px' }}>Space</kbd>
            </button>
        </Fragment>
    );
};

export interface TrackerTagPickerProps {
    uniqueTags: string[];
    allDueCount: number;
    tagCounts: Record<string, number>;
    activeTagChip: string;
    onSelectTagChip: (tag: string) => void;
    onBack: () => void;
    onStartReview: () => void;
}

export const TrackerTagPicker: FunctionalComponent<TrackerTagPickerProps> = ({
    uniqueTags,
    allDueCount,
    tagCounts,
    activeTagChip,
    onSelectTagChip,
    onBack,
    onStartReview
}) => {
    return (
        <div class="fsrs-tag-picker">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '13px' }}>Select Topics to Review</h4>
                <button id="fsrs-picker-back-btn" title="Go Back" style={{ background: 'none', border: 'none', color: 'var(--md-text-low)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }} aria-label="Go Back" onClick={onBack}>
                    <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px' }}>
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Back
                </button>
            </div>
            <div class="fsrs-tag-chips-container">
                <button
                    class={`fsrs-tag-chip ${activeTagChip === '__all__' ? 'fsrs-tag-chip-active' : ''}`}
                    data-tag="__all__"
                    onClick={() => onSelectTagChip('__all__')}
                >
                    All Topics <span class="fsrs-tag-count">{allDueCount}</span>
                </button>
                {uniqueTags.map(tag => (
                    <button
                        key={tag}
                        class={`fsrs-tag-chip ${activeTagChip === tag ? 'fsrs-tag-chip-active' : ''}`}
                        data-tag={tag}
                        onClick={() => onSelectTagChip(tag)}
                    >
                        {tag} <span class="fsrs-tag-count">{tagCounts[tag] || 0}</span>
                    </button>
                ))}
            </div>
            <button id="fsrs-start-filtered-btn" class="fsrs-primary-btn" style={{ marginTop: '14px' }} onClick={onStartReview}>
                <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor' }}>
                    <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start Review
            </button>
        </div>
    );
};

export interface TrackerOverlayProps {
    problem?: { title?: string; url?: string } | null;
    autoTagsStr?: string;
    onMinimize?: () => void;
    onClose?: () => void;
    onFullscreen?: () => void;
    onDeleteCard?: () => void;
    onUpdateText?: () => void;
    onRate?: (rating: number) => void;
    onSaveDraft?: () => void;
    approachRef?: RefObject<HTMLTextAreaElement>;
    tagsRef?: RefObject<HTMLInputElement>;
}

export const TrackerOverlay: FunctionalComponent<TrackerOverlayProps> = ({
    problem,
    autoTagsStr = '',
    onMinimize,
    onClose,
    onFullscreen,
    onDeleteCard,
    onUpdateText,
    onRate,
    onSaveDraft,
    approachRef,
    tagsRef
}) => {
    return (
        <Fragment>
            <TrackerHeader problemTitle={problem?.title} onMinimize={onMinimize} onClose={onClose} />
            <div
                id="fsrs-nav-bar"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    background: 'rgba(0,0,0,0.25)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    overflowX: 'auto'
                }}
            />
            <div
                id="fsrs-empty-url-hint"
                style={{
                    display: 'none',
                    padding: '6px 12px',
                    fontSize: '11px',
                    color: 'var(--md-text-low, #888)',
                    background: 'rgba(255,255,255,0.04)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}
            >
                No cards tracked for this problem yet. Add your initial approach notes below to start!
            </div>
            <div id="fsrs-body">
                <div class="fsrs-tags-container">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    <input
                        ref={tagsRef as any}
                        type="text"
                        id="fsrs-tags-input"
                        class="fsrs-tags-input"
                        aria-label="Add tags"
                        placeholder="Add tags (comma separated)..."
                        value={autoTagsStr}
                        onInput={onSaveDraft}
                    />
                </div>
                <div class="fsrs-approach-header">
                    <label>Your Approach:</label>
                    <div class="fsrs-header-buttons" style={{ display: 'flex', gap: '6px' }}>
                        <button
                            id="fsrs-fullscreen-btn"
                            class="fsrs-secondary-btn"
                            title="Open in fullscreen new tab"
                            aria-label="Open in fullscreen new tab"
                            onClick={onFullscreen}
                        >
                            <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', display: 'inline-block', verticalAlign: 'middle', marginRight: '3px' }}>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            Fullscreen
                        </button>
                        <button
                            id="fsrs-delete-card-btn"
                            class="fsrs-danger-btn"
                            style={{ display: 'none' }}
                            title="Remove this card from future reviews"
                            aria-label="Remove this card from future reviews"
                            onClick={onDeleteCard}
                        >
                            <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', display: 'inline-block', verticalAlign: 'middle', marginRight: '3px', stroke: 'currentColor' }}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Remove
                        </button>
                        <button
                            id="fsrs-update-text-btn"
                            class="fsrs-secondary-btn"
                            style={{ display: 'none' }}
                            title="Save edits without reviewing"
                            aria-label="Save edits without reviewing"
                            onClick={onUpdateText}
                        >
                            <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', display: 'inline-block', verticalAlign: 'middle', marginRight: '3px' }}>
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                            </svg>
                            Save Edit
                        </button>
                    </div>
                </div>
                <textarea
                    ref={approachRef as any}
                    id="fsrs-approach"
                    class="fsrs-textarea"
                    placeholder="How did you solve this pattern? Jot down your key insights..."
                    onInput={onSaveDraft}
                />
                <div class="fsrs-rating-section">
                    <p id="fsrs-action-label" class="fsrs-rating-label">Save & Rate Initial Difficulty:</p>
                    <TrackerRatingBar onRate={onRate} />
                </div>
            </div>
            <div id="fsrs-review-ui" style={{ display: 'none' }} />
        </Fragment>
    );
};

interface TrackerAppControls {
    setIsOpen: (open: boolean) => void;
    setShowLauncherSetting: (show: boolean) => void;
    setViewMode: (mode: 'edit' | 'tag-picker' | 'review') => void;
    setUrlCards: (cards: Card[]) => void;
    setActiveCardId: (id: string | null) => void;
    setApproachText: (text: string) => void;
    setTagsText: (text: string) => void;
    setActionLabelText: (text: string) => void;
    setShowUpdateBtn: (show: boolean) => void;
    setShowDeleteBtn: (show: boolean) => void;
    setExistingCardId: (id: string | undefined) => void;
    setLastRating: (rating: number | undefined) => void;
    setIsSavedText: (saved: boolean) => void;
    setSavedRatingNum: (num: number | null) => void;
    setUniqueTags: (tags: string[]) => void;
    setAllDueCount: (count: number) => void;
    setTagCounts: (counts: Record<string, number>) => void;
    setActiveTagChip: (tag: string) => void;
    setReviewCard: (card: Card | null) => void;
    setReviewIndex: (index: number) => void;
    setTotalToReview: (total: number) => void;
    setIsAnswerShown: (shown: boolean) => void;
    approachRef: RefObject<HTMLTextAreaElement | null>;
    tagsRef: RefObject<HTMLInputElement | null>;
    launcherRef: RefObject<HTMLDivElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
}

export interface TrackerAppProps {
    tracker: Tracker;
}

export const TrackerApp: FunctionalComponent<TrackerAppProps> = ({ tracker }) => {
    // 1. Visibility & Drag State
    const [isOpen, setIsOpen] = useState(false);
    const [showLauncherSetting, setShowLauncherSetting] = useState(
        tracker.state?.extensionSettings?.showLauncher !== false
    );
    const [isDragging, setIsDragging] = useState(false);
    const [launcherPos, setLauncherPos] = useState({ x: 0, y: 0, isCustom: false });

    // 2. View Mode: 'edit' | 'tag-picker' | 'review'
    const [viewMode, setViewMode] = useState<'edit' | 'tag-picker' | 'review'>('edit');

    // 3. Edit view state
    const [urlCards, setUrlCards] = useState<Card[]>([]);
    const [activeCardId, setActiveCardId] = useState<string | null>(tracker.activeCardId);
    const [approachText, setApproachText] = useState('');
    const [tagsText, setTagsText] = useState('');
    const [actionLabelText, setActionLabelText] = useState('Save & Rate Initial Difficulty for New Card:');
    const [showUpdateBtn, setShowUpdateBtn] = useState(false);
    const [showDeleteBtn, setShowDeleteBtn] = useState(false);
    const [existingCardId, setExistingCardId] = useState<string | undefined>(undefined);
    const [lastRating, setLastRating] = useState<number | undefined>(undefined);
    const [isSavedText, setIsSavedText] = useState(false);
    const [savedRatingNum, setSavedRatingNum] = useState<number | null>(null);

    // 4. Tag Picker mode state
    const [uniqueTags, setUniqueTags] = useState<string[]>([]);
    const [allDueCount, setAllDueCount] = useState<number>(0);
    const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
    const [activeTagChip, setActiveTagChip] = useState<string>('__all__');

    // 5. Review mode state
    const [reviewCard, setReviewCard] = useState<Card | null>(null);
    const [reviewIndex, setReviewIndex] = useState(0);
    const [totalToReview, setTotalToReview] = useState(0);
    const [isAnswerShown, setIsAnswerShown] = useState(false);

    // Refs
    const launcherRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const approachRef = useRef<HTMLTextAreaElement>(null);
    const tagsRef = useRef<HTMLInputElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    const dragStart = useRef({ x: 0, y: 0 });
    const initialPos = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);

    // Register with tracker controller synchronously on mount
    useLayoutEffect(() => {
        tracker._registerApp({
            setIsOpen,
            setShowLauncherSetting,
            setViewMode,
            setUrlCards,
            setActiveCardId,
            setApproachText,
            setTagsText,
            setActionLabelText,
            setShowUpdateBtn,
            setShowDeleteBtn,
            setExistingCardId,
            setLastRating,
            setIsSavedText,
            setSavedRatingNum,
            setUniqueTags,
            setAllDueCount,
            setTagCounts,
            setActiveTagChip,
            setReviewCard,
            setReviewIndex,
            setTotalToReview,
            setIsAnswerShown,
            approachRef,
            tagsRef,
            launcherRef,
            containerRef
        });
        return () => {
            tracker._unregisterApp();
        };
    }, [tracker]);

    // Tag autocomplete attachment
    useEffect(() => {
        if (tagsRef.current) {
            try {
                TagInputControl.attach(tagsRef.current, {
                    getSuggestions: () => tracker.getDatabaseTags()
                });
            } catch (_) {}
        }
    }, [tracker]);

    // Global drag mouse/pointer listeners
    useEffect(() => {
        const onMouseMove = (e: MouseEvent | PointerEvent) => {
            try {
                if (dragStart.current.x === 0 && dragStart.current.y === 0) return;
                const dx = e.clientX - dragStart.current.x;
                const dy = e.clientY - dragStart.current.y;

                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    isDraggingRef.current = true;
                    setIsDragging(true);
                }

                if (isDraggingRef.current) {
                    setLauncherPos({
                        x: initialPos.current.x + dx,
                        y: initialPos.current.y + dy,
                        isCustom: true
                    });
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('Tracker', `Error handling launcher mousemove: ${errorMessage}`, { err });
            }
        };

        const onMouseUp = (e: MouseEvent | PointerEvent) => {
            try {
                if (launcherRef.current && (launcherRef.current as any).releasePointerCapture && (e as PointerEvent).pointerId !== undefined) {
                    try {
                        (launcherRef.current as any).releasePointerCapture((e as PointerEvent).pointerId);
                    } catch (_) {}
                }
                dragStart.current = { x: 0, y: 0 };
                setTimeout(() => {
                    try {
                        isDraggingRef.current = false;
                        setIsDragging(false);
                    } catch (cursorErr) {
                        const errorMessage = cursorErr instanceof Error ? cursorErr.message : String(cursorErr);
                        Logger.error('Tracker', `Error resetting launcher cursor on mouseup: ${errorMessage}`, { cursorErr });
                    }
                }, 50);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('Tracker', `Error handling launcher mouseup: ${errorMessage}`, { err });
            }
        };

        window.addEventListener('mousemove', onMouseMove, true);
        window.addEventListener('pointermove', onMouseMove as any, true);
        window.addEventListener('mouseup', onMouseUp, true);
        window.addEventListener('pointerup', onMouseUp as any, true);
        window.addEventListener('pointercancel', onMouseUp as any, true);

        return () => {
            window.removeEventListener('mousemove', onMouseMove, true);
            window.removeEventListener('pointermove', onMouseMove as any, true);
            window.removeEventListener('mouseup', onMouseUp, true);
            window.removeEventListener('pointerup', onMouseUp as any, true);
            window.removeEventListener('pointercancel', onMouseUp as any, true);
        };
    }, []);

    // Review keyboard shortcuts listener
    useEffect(() => {
        if (viewMode !== 'review' || !reviewCard) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            try {
                const active = document.activeElement as HTMLElement | null;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

                // Space or Enter to show answer
                if ((e.code === 'Space' || e.code === 'Enter') && !isAnswerShown) {
                    e.preventDefault();
                    setIsAnswerShown(true);
                    return;
                }

                // 1-4 for ratings (only when answer is visible)
                if (isAnswerShown) {
                    const ratingMap: Record<string, number> = {
                        Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4,
                        Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4
                    };
                    const rating = ratingMap[e.code];
                    if (rating) {
                        e.preventDefault();
                        if (tracker.isRatingDebounced) return;
                        tracker.isRatingDebounced = true;
                        setTimeout(() => { tracker.isRatingDebounced = false; }, RATING_UI_DEBOUNCE_MS);

                        const timeTaken = tracker.cardStartTime ? Date.now() - tracker.cardStartTime : 0;
                        tracker.handleRating(reviewCard, rating, timeTaken);
                        tracker.showCard();
                    }
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('Tracker', `Error in review keyboard shortcut handler: ${errorMessage}`, { err });
            }
        };

        tracker._reviewKeyHandler = handleKeyDown;
        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            tracker._reviewKeyHandler = null;
        };
    }, [viewMode, reviewCard, isAnswerShown, tracker]);

    const handlePointerDown = (e: PointerEvent | MouseEvent) => {
        try {
            if (e.button !== 0) return;
            isDraggingRef.current = false;
            setIsDragging(false);
            dragStart.current = { x: e.clientX, y: e.clientY };

            if (launcherRef.current) {
                const rect = launcherRef.current.getBoundingClientRect();
                initialPos.current = { x: rect.left, y: rect.top };
                if ((launcherRef.current as any).setPointerCapture && (e as PointerEvent).pointerId !== undefined) {
                    try {
                        (launcherRef.current as any).setPointerCapture((e as PointerEvent).pointerId);
                    } catch (_) {}
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error on launcher pointerdown: ${errorMessage}`, { err });
        }
    };

    const handleLauncherClick = (e: MouseEvent) => {
        try {
            if (isDraggingRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            safeFlushSync(() => {
                setIsOpen(true);
            });
            previouslyFocused.current = document.activeElement as HTMLElement;
            if (approachRef.current) {
                approachRef.current.focus();
            }
            tracker.refreshWidgetState();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error on launcher click: ${errorMessage}`, { err });
        }
    };

    const handleLauncherKeyDown = (e: KeyboardEvent) => {
        try {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                safeFlushSync(() => {
                    setIsOpen(true);
                });
                tracker.refreshWidgetState();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error on launcher keydown: ${errorMessage}`, { err });
        }
    };

    const handleContextMenu = (e: MouseEvent) => {
        try {
            e.preventDefault();
            safeFlushSync(() => {
                setLauncherPos({ x: 0, y: 0, isCustom: false });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error resetting launcher position via contextmenu: ${errorMessage}`, { err });
        }
    };

    const handleMinimize = () => {
        try {
            safeFlushSync(() => {
                setIsOpen(true);
            });
            safeFlushSync(() => {
                setIsOpen(false);
            });
            if (previouslyFocused.current) {
                previouslyFocused.current.focus();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error on minimize button click: ${errorMessage}`, { err });
        }
    };

    const handleClose = () => {
        try {
            safeFlushSync(() => {
                setIsOpen(true);
            });
            safeFlushSync(() => {
                setIsOpen(false);
            });
            if (showLauncherSetting && launcherRef.current) {
                launcherRef.current.focus();
            }
            if (previouslyFocused.current) {
                previouslyFocused.current.focus();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error on close button click: ${errorMessage}`, { err });
        }
    };

    const handleContainerKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            handleClose();
        }
    };

    const handleSelectCardTab = (cid: string) => {
        try {
            tracker.activeCardId = cid;
            tracker.refreshWidgetState();
        } catch (tabErr) {
            const errorMessage = tabErr instanceof Error ? tabErr.message : String(tabErr);
            Logger.error('Tracker', `Error switching card tab: ${errorMessage}`, { tabErr });
        }
    };

    const handleAddCardTab = () => {
        try {
            tracker.activeCardId = '__new__';
            tracker.refreshWidgetState();
        } catch (tabErr) {
            const errorMessage = tabErr instanceof Error ? tabErr.message : String(tabErr);
            Logger.error('Tracker', `Error adding card tab: ${errorMessage}`, { tabErr });
        }
    };

    const handlePickerBack = () => {
        setViewMode('edit');
        tracker.refreshWidgetState();
    };

    const handlePickerStart = () => {
        tracker.activeReviewFilter = activeTagChip === '__all__' ? null : activeTagChip;
        tracker._startReviewSession();
    };

    const handleReviewBack = () => {
        tracker._cleanupReviewKeyboard();
        setViewMode('edit');
        tracker.activeReviewFilter = null;
        tracker.refreshWidgetState();
    };

    const handleReviewRate = (card: Card, rating: number) => {
        if (tracker.isRatingDebounced) return;
        tracker.isRatingDebounced = true;
        setTimeout(() => { tracker.isRatingDebounced = false; }, RATING_UI_DEBOUNCE_MS);

        const timeTaken = tracker.cardStartTime ? Date.now() - tracker.cardStartTime : 0;
        tracker.handleRating(card, rating, timeTaken);
        tracker.showCard();
    };

    const utilsAny = tracker.utils as any;
    const problem = utilsAny && typeof utilsAny.extractProblemDetails === 'function' ? utilsAny.extractProblemDetails() : null;

    return (
        <Fragment>
            <TrackerFloatingLauncher
                launcherRef={launcherRef}
                isOpen={isOpen}
                showLauncher={showLauncherSetting}
                isDragging={isDragging}
                pos={launcherPos}
                onClick={handleLauncherClick}
                onPointerDown={handlePointerDown}
                onMouseDown={handlePointerDown}
                onKeyDown={handleLauncherKeyDown}
                onContextMenu={handleContextMenu}
            />
            <div
                ref={containerRef}
                id="algo-fsrs-container"
                role="dialog"
                aria-modal="true"
                aria-label="AlgoRecall Tracker"
                style={{ display: isOpen ? 'block' : 'none' }}
                onKeyDown={handleContainerKeyDown}
            >
                <TrackerHeader
                    problemTitle={problem?.title}
                    onMinimize={handleMinimize}
                    onClose={handleClose}
                />
                <TrackerNavBar
                    cards={urlCards}
                    activeCardId={activeCardId}
                    onSelectCard={handleSelectCardTab}
                    onAddCard={handleAddCardTab}
                />
                <div
                    id="fsrs-empty-url-hint"
                    style={{
                        display: urlCards.length === 0 ? 'block' : 'none',
                        padding: '6px 12px',
                        fontSize: '11px',
                        color: 'var(--md-text-low, #888)',
                        background: 'rgba(255,255,255,0.04)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)'
                    }}
                >
                    No cards tracked for this problem yet. Add your initial approach notes below to start!
                </div>
                <div id="fsrs-body" style={{ display: viewMode === 'edit' ? 'block' : 'none' }}>
                    <div class="fsrs-tags-container">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                            <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        <input
                            ref={tagsRef}
                            type="text"
                            id="fsrs-tags-input"
                            class="fsrs-tags-input"
                            aria-label="Add tags"
                            placeholder="Add tags (comma separated)..."
                            value={tagsText}
                            onInput={(e) => {
                                const val = (e.currentTarget as HTMLInputElement).value;
                                setTagsText(val);
                                tracker.currentTagsText = val;
                                tracker.saveDraft();
                            }}
                        />
                    </div>

                    <div class="fsrs-approach-header">
                        <label>Your Approach:</label>
                        <div class="fsrs-header-buttons" style={{ display: 'flex', gap: '6px' }}>
                            <button
                                id="fsrs-fullscreen-btn"
                                class="fsrs-secondary-btn"
                                title="Open in fullscreen new tab"
                                aria-label="Open in fullscreen new tab"
                                onClick={() => tracker.handleFullscreen()}
                            >
                                <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', display: 'inline-block', verticalAlign: 'middle', marginRight: '3px' }}>
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Fullscreen
                            </button>
                            <button
                                id="fsrs-delete-card-btn"
                                class="fsrs-danger-btn"
                                style={{ display: showDeleteBtn ? 'block' : 'none' }}
                                title="Remove this card from future reviews"
                                aria-label="Remove this card from future reviews"
                                onClick={() => tracker.handleDeleteCard()}
                            >
                                <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', display: 'inline-block', verticalAlign: 'middle', marginRight: '3px', stroke: 'currentColor' }}>
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Remove
                            </button>
                            <button
                                id="fsrs-update-text-btn"
                                class="fsrs-secondary-btn"
                                style={{
                                    display: showUpdateBtn ? 'block' : 'none',
                                    background: isSavedText ? '#2ecc71' : '#555'
                                }}
                                title="Save edits without reviewing"
                                aria-label="Save edits without reviewing"
                                onClick={() => tracker.handleUpdateText()}
                            >
                                <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', display: 'inline-block', verticalAlign: 'middle', marginRight: '3px' }}>
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                {isSavedText ? 'Saved ✓' : 'Save Edit'}
                            </button>
                        </div>
                    </div>
                    <textarea
                        ref={approachRef}
                        id="fsrs-approach"
                        class="fsrs-textarea"
                        placeholder="How did you solve this pattern? Jot down your key insights..."
                        value={approachText}
                        onInput={(e) => {
                            const val = (e.currentTarget as HTMLTextAreaElement).value;
                            setApproachText(val);
                            tracker.currentApproachText = val;
                            tracker.saveDraft();
                        }}
                    />

                    <div class="fsrs-rating-section">
                        <p id="fsrs-action-label" class="fsrs-rating-label">{actionLabelText}</p>
                        <TrackerRatingBar
                            onRate={(r) => tracker.handleRatingBarClick(r)}
                            lastRating={lastRating}
                            existingId={existingCardId}
                            savedRatingSuccess={savedRatingNum}
                        />
                    </div>
                </div>

                <div id="fsrs-review-ui" style={{ display: viewMode === 'edit' ? 'none' : 'block' }}>
                    {viewMode === 'tag-picker' && (
                        <TrackerTagPicker
                            uniqueTags={uniqueTags}
                            allDueCount={allDueCount}
                            tagCounts={tagCounts}
                            activeTagChip={activeTagChip}
                            onSelectTagChip={(tag) => {
                                tracker.activeReviewFilter = tag === '__all__' ? null : tag;
                                safeFlushSync(() => {
                                    setActiveTagChip(tag);
                                });
                            }}
                            onBack={handlePickerBack}
                            onStartReview={handlePickerStart}
                        />
                    )}

                    {viewMode === 'review' && reviewCard && (
                        <TrackerCardReviewView
                            card={reviewCard}
                            index={reviewIndex}
                            total={totalToReview}
                            activeFilter={tracker.activeReviewFilter}
                            isAnswerShown={isAnswerShown}
                            onShowAnswer={() => {
                                safeFlushSync(() => {
                                    setIsAnswerShown(true);
                                });
                            }}
                            onBack={handleReviewBack}
                            onRate={(r) => handleReviewRate(reviewCard, r)}
                        />
                    )}
                </div>
            </div>
        </Fragment>
    );
};

// ==========================================
// TRACKER CONTROLLER CLASS (FULL COMPATIBILITY)
// ==========================================

/**
 * @class Tracker
 * @description Main Spaced Repetition floating widget interface injected inside target domains.
 * Pure declarative controller class with zero imperative DOM queries or mutations.
 */
export class Tracker {
    /** Optional topic tag filter restricting due cards in the active review queue. */
    activeReviewFilter: string | null;
    /** Current zero-based index of the card being reviewed. */
    reviewIndex: number;
    /** Total cards queued for review in the active session. */
    totalToReview: number;
    /** Document keydown event handler for review hotkeys (1-4, Space, Enter). */
    _reviewKeyHandler: ((e: KeyboardEvent) => void) | null;
    /** Flag tracking whether event listeners are registered. */
    isListenersBound: boolean;
    /** Timestamp when the current card was displayed to compute review duration. */
    cardStartTime?: number;
    /** ID of the active card displayed in the widget tab navigation, or '__new__' for creation mode. */
    activeCardId: string | null;
    /** Short debounce flag preventing duplicate button clicks during rating animations. */
    isRatingDebounced: boolean;
    /** Tracks whether UI component hierarchy has been mounted into the DOM. */
    isMounted: boolean;
    /** In-memory cache of current approach text input. */
    currentApproachText: string;
    /** In-memory cache of current tags text input. */
    currentTagsText: string;

    /** Component element references. */
    approachInputRef: RefObject<HTMLTextAreaElement | null> | null;
    tagsInputRef: RefObject<HTMLInputElement | null> | null;
    launcherRef: RefObject<HTMLDivElement | null> | null;
    containerRef: RefObject<HTMLDivElement | null> | null;

    /** Registered Preact state control delegates. */
    _appControls: TrackerAppControls | null;

    /**
     * Initializes default widget state and binds callback handlers.
     */
    constructor() {
        this.activeReviewFilter = null;
        this.reviewIndex = 0;
        this.totalToReview = 0;
        this._reviewKeyHandler = null;
        this.isListenersBound = false;
        this.cardStartTime = 0;
        this.activeCardId = null;
        this.isRatingDebounced = false;
        this.isMounted = false;
        this.currentApproachText = '';
        this.currentTagsText = '';
        this.approachInputRef = null;
        this.tagsInputRef = null;
        this.launcherRef = null;
        this.containerRef = null;
        this._appControls = null;

        // Bind functions to avoid lexical context issues
        this.saveDraft = this.saveDraft.bind(this);
    }

    /**
     * Registers the active Preact TrackerApp controls with this controller.
     * @internal
     */
    _registerApp(controls: TrackerAppControls): void {
        this._appControls = controls;
        this.approachInputRef = controls.approachRef;
        this.tagsInputRef = controls.tagsRef;
        this.launcherRef = controls.launcherRef;
        this.containerRef = controls.containerRef;
    }

    /**
     * Unregisters the active Preact TrackerApp controls.
     * @internal
     */
    _unregisterApp(): void {
        this._appControls = null;
        this.approachInputRef = null;
        this.tagsInputRef = null;
        this.launcherRef = null;
        this.containerRef = null;
    }

    /**
     * Safely retrieves the shared content script state from `window.AlgoRecall.state`.
     * @returns {AlgoRecallState}
     */
    get state(): AlgoRecallState {
        try {
            return getAlgoRecallGlobal().state;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to get AlgoRecall state: ${errorMessage}`, { err });
            return { cards: [], topicWeights: {}, scheduler: new FsrsScheduler() };
        }
    }

    /**
     * Safely retrieves content script DOM and title utilities.
     * @returns {AppUtils}
     */
    get utils(): AppUtils {
        try {
            return getAlgoRecallGlobal().Utils;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to get AlgoRecall utils: ${errorMessage}`, { err });
            return { getAutoTags: () => [], getExtractedProblemTitle: () => '' };
        }
    }

    /**
     * Safely retrieves the in-page notifier controller.
     * @returns {unknown}
     */
    get notifier(): unknown {
        try {
            return getAlgoRecallGlobal().Notifier;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to get AlgoRecall notifier: ${errorMessage}`, { err });
            return null;
        }
    }

    /**
     * Commits the current flashcard collection array to `chrome.storage.local`.
     * 
     * @returns {void}
     */
    saveCards(): void {
        const logger = getLogger();
        try {
            if (logger) logger.info('Tracker', `Saving ${this.state.cards.length} FSRS cards to storage`);
            chrome.storage.local.set({ fsrsCards: this.state.cards }, () => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Tracker', `Chrome storage error saving FSRS cards: ${errorMessage}`, { error: chrome.runtime.lastError });
                    }
                } catch (callbackErr) {
                    const errorMessage = callbackErr instanceof Error ? callbackErr.message : String(callbackErr);
                    Logger.error('Tracker', `Error in saveCards storage callback: ${errorMessage}`, { callbackErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (logger) logger.error('Tracker', `Failed to save FSRS cards to storage: ${errorMessage}`, { cardCount: this.state.cards?.length || 0, err });
        }
    }

    /**
     * Increments the user's daily review count in `fsrsActivity` storage dictionary,
     * indexed by the current local calendar date string (YYYY-MM-DD).
     * 
     * @returns {void}
     */
    logReviewActivity(): void {
        const logger = getLogger();
        try {
            chrome.storage.local.get(['fsrsActivity'], (result: StorageData & { fsrsActivity?: Record<string, number> }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Tracker', `Chrome storage error getting fsrsActivity: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    const activity = result.fsrsActivity || {};
                    const today = new Date();
                    const dateString = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    activity[dateString] = (activity[dateString] || 0) + 1;
                    chrome.storage.local.set({ fsrsActivity: activity }, () => {
                        try {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('Tracker', `Chrome storage error setting fsrsActivity: ${errorMessage}`, { error: chrome.runtime.lastError });
                            }
                        } catch (setErr) {
                            const errorMessage = setErr instanceof Error ? setErr.message : String(setErr);
                            Logger.error('Tracker', `Error setting activity log: ${errorMessage}`, { setErr });
                        }
                    });
                    if (logger) logger.debug('Tracker', `Logged review activity for ${dateString}: ${activity[dateString]} reviews`);
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    if (logger) logger.error('Tracker', `Error in logReviewActivity callback: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (logger) logger.error('Tracker', `Failed to fetch activity storage: ${errorMessage}`, { err });
        }
    }

    /**
     * Synchronizes the floating widget UI status to align with the current problem page.
     * Identifies existing cards matching the canonical URL, updates active navigation tabs,
     * fills previous approach notes and tags, or loads uncommitted drafts if no card exists.
     * 
     * @returns {void}
     */
    refreshWidgetState(): void {
        try {
            if (!chrome.runtime?.id) {
                const logger = getLogger();
                if (logger) {
                    logger.warn('Tracker', 'Extension context invalidated. Ignoring refresh.');
                    const notifier = (this.notifier as any) || (getAlgoRecallGlobal() as any)?.Notifier || Notifier;
                    if (notifier?.showPageNotification) {
                        notifier.showPageNotification('AlgoRecall Notice', 'Extension updated. Please refresh the page.', 'test');
                    }
                }
                return;
            }

            // Reset to default edit view on SPA navigation
            this._cleanupReviewKeyboard();
            this.activeReviewFilter = null;

            ensureCardIds(this.state.cards);
            const targetCleanUrl = cleanUrl(window.location.href);
            const urlCards = getCardsForUrl(this.state.cards, targetCleanUrl);

            if (this.activeCardId === '__new__') {
                // Keep on new card
            } else if (this.activeCardId) {
                const exists = urlCards.find(c => c.id === this.activeCardId);
                if (!exists) {
                    this.activeCardId = urlCards.length > 0 ? urlCards[0].id : null;
                }
            } else {
                this.activeCardId = urlCards.length > 0 ? urlCards[0].id : null;
            }

            const activeCard = (this.activeCardId && this.activeCardId !== '__new__')
                ? urlCards.find(c => c.id === this.activeCardId)
                : null;

            safeFlushSync(() => {
                if (this._appControls) {
                    this._appControls.setViewMode('edit');
                    this._appControls.setIsAnswerShown(false);
                    this._appControls.setUrlCards(urlCards);
                    this._appControls.setActiveCardId(this.activeCardId);

                    if (activeCard) {
                        this.currentApproachText = activeCard.approach || '';
                        this.currentTagsText = (activeCard.tags || []).join(', ');
                        this._appControls.setApproachText(this.currentApproachText);
                        this._appControls.setTagsText(this.currentTagsText);
                        if (this.approachInputRef?.current) {
                            this.approachInputRef.current.value = this.currentApproachText;
                        }
                        if (this.tagsInputRef?.current) {
                            this.tagsInputRef.current.value = this.currentTagsText;
                        }
                        this._appControls.setActionLabelText(`Card ${urlCards.indexOf(activeCard) + 1} Exists. Review Early or Update Notes:`);
                        this._appControls.setShowUpdateBtn(true);
                        this._appControls.setShowDeleteBtn(true);
                        this._appControls.setExistingCardId(activeCard.id);
                        this._appControls.setLastRating((activeCard as any).lastRating);
                    } else {
                        this._appControls.setActionLabelText("Save & Rate Initial Difficulty for New Card:");
                        this._appControls.setShowUpdateBtn(false);
                        this._appControls.setShowDeleteBtn(false);
                        this._appControls.setExistingCardId(undefined);
                        this._appControls.setLastRating(undefined);

                        chrome.storage.local.get(['approachDrafts'], (res: { approachDrafts?: Record<string, DraftEntry | string> }) => {
                            try {
                                if (chrome.runtime.lastError) {
                                    const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                    Logger.error('Tracker', `Chrome storage error getting approachDrafts: ${errorMessage}`, { error: chrome.runtime.lastError });
                                    return;
                                }
                                const drafts = res.approachDrafts || {};
                                const draft = drafts[targetCleanUrl];

                                let draftApproach = '';
                                let draftTags = '';
                                if (typeof draft === 'object' && draft !== null) {
                                    draftApproach = draft.approach || '';
                                    if (draft.tags !== undefined) {
                                        draftTags = draft.tags;
                                    } else if (this.utils && typeof this.utils.getAutoTags === 'function') {
                                        draftTags = this.utils.getAutoTags().join(', ');
                                    }
                                } else if (typeof draft === 'string') {
                                    draftApproach = draft;
                                    if (this.utils && typeof this.utils.getAutoTags === 'function') {
                                        draftTags = this.utils.getAutoTags().join(', ');
                                    }
                                } else if (this.utils && typeof this.utils.getAutoTags === 'function') {
                                    draftTags = this.utils.getAutoTags().join(', ');
                                }

                                safeFlushSync(() => {
                                    this.currentApproachText = draftApproach;
                                    this.currentTagsText = draftTags;
                                    if (this._appControls) {
                                        this._appControls.setApproachText(draftApproach);
                                        this._appControls.setTagsText(draftTags);
                                    }
                                    if (this.approachInputRef?.current) {
                                        this.approachInputRef.current.value = draftApproach;
                                    }
                                    if (this.tagsInputRef?.current) {
                                        this.tagsInputRef.current.value = draftTags;
                                    }
                                });
                            } catch (draftErr) {
                                const errorMessage = draftErr instanceof Error ? draftErr.message : String(draftErr);
                                Logger.error('Tracker', `Error in approachDrafts storage callback: ${errorMessage}`, { draftErr });
                            }
                        });
                    }
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to refresh widget state: ${errorMessage}`, { err });
        }
    }

    /**
     * Resolves or creates the dedicated host mounting container `#algo-tracker-host`
     * for the Tracker widget, isolating it from host SPA Virtual DOM trees.
     * Boundary 2: Host container injection in content script layer.
     */
    static getOrCreateHost(): HTMLElement | null {
        try {
            const utils = (getAlgoRecallGlobal() as any)?.Utils;
            if (typeof utils?.getOrCreateTrackerHost === 'function') {
                return utils.getOrCreateTrackerHost();
            }
            return getOrCreateTrackerHost();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to get or create tracker host: ${errorMessage}`, { err });
            return null;
        }
    }

    /**
     * Safely queries the host container without creating it.
     */
    static getHost(): HTMLElement | null {
        try {
            const utils = (getAlgoRecallGlobal() as any)?.Utils;
            if (typeof utils?.getTrackerHost === 'function') {
                return utils.getTrackerHost();
            }
            return getTrackerHost();
        } catch {
            return null;
        }
    }

    /**
     * Injects the Preact Tracker widget root component hierarchy into `#algo-tracker-host`.
     * 
     * @returns {void}
     */
    createUI(): void {
        try {
            const host = Tracker.getOrCreateHost();
            if (!host) return;

            // SPA Route Navigation Recovery:
            // Check if host is disconnected from DOM or if launcher element was wiped out by host SPA navigation/reconciliation.
            const utils = (getAlgoRecallGlobal() as any)?.Utils;
            const launcherPresent = typeof utils?.hasTrackerLauncher === 'function'
                ? utils.hasTrackerLauncher()
                : isTrackerLauncherPresent(host);
            const isHostConnected = host.isConnected ?? (typeof document !== 'undefined' && document.body?.contains(host));

            if (this.isMounted && isHostConnected && launcherPresent) {
                return;
            }

            // If previously mounted but elements were wiped, reset isMounted to re-mount
            if (this.isMounted && (!isHostConnected || !launcherPresent)) {
                this.isMounted = false;
                this._cleanupReviewKeyboard();
                this.activeReviewFilter = null;
                delete (host as any).__k;
                if (!isHostConnected) {
                    Tracker.getOrCreateHost();
                }
            }

            render(<TrackerApp tracker={this} />, host);
            this.isMounted = true;

            try {
                const globalAlgo = getAlgoRecallGlobal();
                if (globalAlgo.orchestrator) {
                    globalAlgo.orchestrator.applyThemeClass();
                }
            } catch (themeErr) {
                const errorMessage = themeErr instanceof Error ? themeErr.message : String(themeErr);
                Logger.error('Tracker', `Failed to apply theme class: ${errorMessage}`, { themeErr });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to create UI elements: ${errorMessage}`, { err });
        }
    }

    /**
     * Removes the Preact Tracker widget from the DOM and cleans up its dedicated host container.
     * 
     * @returns {void}
     */
    removeUI(): void {
        try {
            this._cleanupReviewKeyboard();
            const host = Tracker.getHost();
            if (host) {
                try {
                    render(null, host);
                } catch (renderErr) {
                    const errorMessage = renderErr instanceof Error ? renderErr.message : String(renderErr);
                    Logger.error('Tracker', `Error unmounting Preact in removeUI: ${errorMessage}`, { renderErr });
                }
            }
            const utils = (getAlgoRecallGlobal() as any)?.Utils;
            if (typeof utils?.removeTrackerHost === 'function') {
                utils.removeTrackerHost();
            } else {
                removeTrackerHost();
            }
            this._appControls = null;
            this.activeReviewFilter = null;
            this.isMounted = false;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to remove UI: ${errorMessage}`, { err });
        }
    }

    /**
     * Debounced auto-save handler persisting in-progress approach notes and tags
     * to `chrome.storage.local`, ensuring work is never lost during accidental page reloads.
     * 
     * @returns {void}
     */
    saveDraft(): void {
        try {
            const targetCleanUrl = cleanUrl(window.location.href);
            const existingId = this.activeCardId && this.activeCardId !== '__new__' ? this.activeCardId : undefined;

            const text = this.approachInputRef?.current ? this.approachInputRef.current.value : this.currentApproachText;
            const tagsText = this.tagsInputRef?.current ? this.tagsInputRef.current.value : this.currentTagsText;

            if (existingId) {
                const card = this.state.cards.find((c: Card) => c.id === existingId);
                if (card) {
                    card.approach = text;
                    card.tags = tagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
                    this.saveCards();
                }
            } else {
                chrome.storage.local.get(['approachDrafts'], (res: { approachDrafts?: Record<string, DraftEntry | string> }) => {
                    try {
                        if (chrome.runtime.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                            Logger.error('Tracker', `Chrome storage error fetching drafts in saveDraft: ${errorMessage}`, { error: chrome.runtime.lastError });
                            return;
                        }
                        const drafts = res.approachDrafts || {};
                        drafts[targetCleanUrl] = { approach: text, tags: tagsText };
                        chrome.storage.local.set({ approachDrafts: drafts }, () => {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('Tracker', `Chrome storage error setting approachDrafts in saveDraft: ${errorMessage}`, { error: chrome.runtime.lastError });
                            }
                        });
                    } catch (draftErr) {
                        const errorMessage = draftErr instanceof Error ? draftErr.message : String(draftErr);
                        Logger.error('Tracker', `Error in saveDraft storage callback: ${errorMessage}`, { draftErr });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to save draft: ${errorMessage}`, { err });
        }
    }

    /**
     * Filters and returns flashcards currently due for spaced repetition review (`due <= now`),
     * optionally filtered by a specific topic tag, sorted chronologically by due date.
     * 
     * @param {string | null} [filterTag] - Optional topic tag filter.
     * @returns {Card[]} Array of due study cards.
     */
    getDueCards(filterTag?: string | null): Card[] {
        try {
            const now = new Date().getTime();
            let due = (this.state.cards || []).filter((c: Card) => c && c.due <= now);
            if (filterTag && filterTag !== '__all__') {
                due = due.filter((c: Card) => c.tags && c.tags.includes(filterTag));
            }
            return due.sort((a: Card, b: Card) => a.due - b.due);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to compute due cards: ${errorMessage}`, { filterTag, err });
            return [];
        }
    }

    /**
     * Initiates the review queue workflow. If due cards span multiple topics, displays
     * a topic filter picker dialog; otherwise, immediately enters the review sequence.
     * 
     * @returns {void}
     */
    startReview(): void {
        try {
            const allDue = this.getDueCards();
            if (allDue.length === 0) {
                const notifier = (this.notifier as any) || (getAlgoRecallGlobal() as any)?.Notifier || Notifier;
                if (notifier?.showPageNotification) {
                    notifier.showPageNotification('AlgoRecall', 'No cards due right now!', 'test');
                }
                return;
            }

            const tagSet = new Set<string>();
            allDue.forEach((c: Card) => { if (c.tags) c.tags.forEach((t: string) => tagSet.add(t)); });
            const uniqueTags = [...tagSet].sort();

            if (uniqueTags.length <= 1) {
                this.activeReviewFilter = null;
                this._startReviewSession();
                return;
            }

            const tagCounts: Record<string, number> = {};
            uniqueTags.forEach(tag => {
                tagCounts[tag] = allDue.filter((c: Card) => c.tags && c.tags.includes(tag)).length;
            });

            safeFlushSync(() => {
                if (this._appControls) {
                    this._appControls.setViewMode('tag-picker');
                    this._appControls.setUniqueTags(uniqueTags);
                    this._appControls.setAllDueCount(allDue.length);
                    this._appControls.setTagCounts(tagCounts);
                    this._appControls.setActiveTagChip('__all__');
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to start review workflow: ${errorMessage}`, { err });
        }
    }

    /**
     * Collects unique tag strings from all stored flashcards for autocomplete suggestions.
     * @returns {string[]}
     */
    getDatabaseTags(): string[] {
        const tagsSet = new Set<string>();
        (this.state.cards || []).forEach((c: Card) => {
            if (c.tags && Array.isArray(c.tags)) {
                c.tags.forEach(t => tagsSet.add(t));
            }
        });
        return Array.from(tagsSet).sort();
    }

    /**
     * Begins an active card review session with the specified filter.
     * @internal
     */
    _startReviewSession(): void {
        try {
            const dueCards = this.getDueCards(this.activeReviewFilter);
            if (dueCards.length === 0) {
                const notifier = (this.notifier as any) || (getAlgoRecallGlobal() as any)?.Notifier || Notifier;
                if (notifier?.showPageNotification) {
                    notifier.showPageNotification('AlgoRecall', 'No cards due for this filter!', 'test');
                }
                this.activeReviewFilter = null;
                return;
            }

            this.totalToReview = dueCards.length;
            this.reviewIndex = 0;
            this.showCard();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to start review session: ${errorMessage}`, { err });
        }
    }

    /**
     * Displays the current card in review mode or finishes the review queue.
     * 
     * @returns {void}
     */
    showCard(): void {
        try {
            this.isRatingDebounced = false;
            const remaining = this.getDueCards(this.activeReviewFilter);

            if (remaining.length === 0) {
                this._cleanupReviewKeyboard();
                this.activeReviewFilter = null;
                safeFlushSync(() => {
                    if (this._appControls) {
                        this._appControls.setViewMode('edit');
                        this._appControls.setReviewCard(null);
                        this._appControls.setIsAnswerShown(false);
                    }
                });
                this.refreshWidgetState();
                return;
            }

            this.reviewIndex++;
            const currentCard = remaining[0];
            this.cardStartTime = Date.now();

            safeFlushSync(() => {
                if (this._appControls) {
                    this._appControls.setViewMode('review');
                    this._appControls.setReviewCard(currentCard);
                    this._appControls.setReviewIndex(this.reviewIndex);
                    this._appControls.setTotalToReview(this.totalToReview);
                    this._appControls.setIsAnswerShown(false);
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to show card: ${errorMessage}`, { err });
        }
    }

    /**
     * Applies the selected rating score to a card, invokes the FSRS scheduler algorithm
     * with custom topic weights if matched, updates storage, and logs user activity.
     * 
     * @param {Card} card - Card being reviewed.
     * @param {number} rating - User recall rating (1: Again, 2: Hard, 3: Good, 4: Easy).
     * @param {number} [timeTaken=0] - Active time spent on card in milliseconds.
     * @returns {void}
     */
    handleRating(card: Card, rating: number, timeTaken: number = 0): void {
        try {
            const index = this.state.cards.findIndex((c: Card) => c.id === card.id);
            if (index === -1) return;

            let customWeightsToApply: number[] | null = null;
            if (card.tags && card.tags.length > 0) {
                for (const tag of card.tags) {
                    if (this.state.topicWeights[tag]) {
                        customWeightsToApply = this.state.topicWeights[tag];
                        break;
                    }
                }
            }

            this.state.cards[index] = this.state.scheduler.reviewCard(card, rating, customWeightsToApply, Date.now(), timeTaken);
            (this.state.cards[index] as Card & { lastRating?: number }).lastRating = rating;

            this.saveCards();
            this.logReviewActivity();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to handle card rating: ${errorMessage}`, { cardId: card.id, rating, err });
        }
    }

    /**
     * Removes the currently selected card from future reviews after user confirmation.
     * 
     * @returns {void}
     */
    handleDeleteCard(): void {
        try {
            const existingId = this.activeCardId && this.activeCardId !== '__new__' ? this.activeCardId : undefined;
            if (existingId) {
                if (confirm("Remove this card from future reviews? This will delete the card and its repetition history.")) {
                    this.state.cards = this.state.cards.filter((c: Card) => c.id !== existingId);
                    this.activeCardId = null;
                    this.saveCards();
                    this.refreshWidgetState();
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error deleting card: ${errorMessage}`, { err });
        }
    }

    /**
     * Saves approach note edits for the active card without submitting a repetition review.
     * 
     * @returns {void}
     */
    handleUpdateText(): void {
        try {
            const existingId = this.activeCardId && this.activeCardId !== '__new__' ? this.activeCardId : undefined;
            if (existingId) {
                const index = this.state.cards.findIndex((c: Card) => c.id === existingId);
                if (index > -1) {
                    const text = this.approachInputRef?.current ? this.approachInputRef.current.value : this.currentApproachText;
                    const tagsVal = this.tagsInputRef?.current ? this.tagsInputRef.current.value : this.currentTagsText;
                    this.state.cards[index].approach = text;
                    this.state.cards[index].tags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);
                    this.saveCards();

                    safeFlushSync(() => {
                        if (this._appControls) {
                            this._appControls.setIsSavedText(true);
                        }
                    });
                    setTimeout(() => {
                        try {
                            safeFlushSync(() => {
                                if (this._appControls) {
                                    this._appControls.setIsSavedText(false);
                                }
                            });
                        } catch (timerErr) {
                            const errorMessage = timerErr instanceof Error ? timerErr.message : String(timerErr);
                            Logger.error('Tracker', `Error resetting update button text: ${errorMessage}`, { timerErr });
                        }
                    }, 1500);
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error updating card text: ${errorMessage}`, { err });
        }
    }

    /**
     * Opens the standalone Fullscreen Markdown Note Editor tab for the active card or draft.
     * 
     * @returns {void}
     */
    handleFullscreen(): void {
        try {
            const targetCleanUrl = cleanUrl(window.location.href);
            const currentText = this.approachInputRef?.current ? this.approachInputRef.current.value : this.currentApproachText;
            const currentTagsText = this.tagsInputRef?.current ? this.tagsInputRef.current.value : this.currentTagsText;
            const existingId = this.activeCardId && this.activeCardId !== '__new__' ? this.activeCardId : undefined;

            if (existingId) {
                const index = this.state.cards.findIndex((c: Card) => c.id === existingId);
                if (index > -1) {
                    this.state.cards[index].approach = currentText;
                    this.state.cards[index].tags = currentTagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
                    this.saveCards();
                }
                chrome.runtime.sendMessage({
                    action: "open_fullscreen_editor",
                    url: targetCleanUrl,
                    cardId: existingId
                }, () => {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Tracker', `Chrome runtime error sending open_fullscreen_editor message: ${errorMessage}`, { error: chrome.runtime.lastError });
                    }
                });
            } else {
                chrome.storage.local.get(['approachDrafts'], (res: { approachDrafts?: Record<string, DraftEntry | string> }) => {
                    try {
                        if (chrome.runtime.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                            Logger.error('Tracker', `Chrome storage error fetching drafts for fullscreen editor: ${errorMessage}`, { error: chrome.runtime.lastError });
                            return;
                        }
                        const drafts = res.approachDrafts || {};
                        drafts[targetCleanUrl] = { approach: currentText, tags: currentTagsText };
                        chrome.storage.local.set({ approachDrafts: drafts }, () => {
                            try {
                                if (chrome.runtime.lastError) {
                                    const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                    Logger.error('Tracker', `Chrome storage error saving draft for fullscreen editor: ${errorMessage}`, { error: chrome.runtime.lastError });
                                }
                                chrome.runtime.sendMessage({
                                    action: "open_fullscreen_editor",
                                    url: targetCleanUrl
                                }, () => {
                                    if (chrome.runtime.lastError) {
                                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                        Logger.error('Tracker', `Chrome runtime error sending open_fullscreen_editor message: ${errorMessage}`, { error: chrome.runtime.lastError });
                                    }
                                });
                            } catch (msgErr) {
                                const errorMessage = msgErr instanceof Error ? msgErr.message : String(msgErr);
                                Logger.error('Tracker', `Error sending open_fullscreen_editor message: ${errorMessage}`, { msgErr });
                            }
                        });
                    } catch (draftErr) {
                        const errorMessage = draftErr instanceof Error ? draftErr.message : String(draftErr);
                        Logger.error('Tracker', `Error handling draft for fullscreen editor: ${errorMessage}`, { draftErr });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error in fullscreen button click handler: ${errorMessage}`, { err });
        }
    }

    /**
     * Handles initial difficulty rating button clicks on edit mode or card creation.
     * 
     * @param {number} rating - User difficulty rating.
     * @returns {void}
     */
    handleRatingBarClick(rating: number): void {
        try {
            const approach = this.approachInputRef?.current ? this.approachInputRef.current.value : this.currentApproachText;
            if (!approach) {
                const notifier = (this.notifier as any) || (getAlgoRecallGlobal() as any)?.Notifier || Notifier;
                if (notifier?.showPageNotification) {
                    notifier.showPageNotification('AlgoRecall', 'Please enter your approach.', 'test');
                }
                return;
            }

            const tagsVal = this.tagsInputRef?.current ? this.tagsInputRef.current.value : this.currentTagsText;
            const parsedTags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);
            const existingId = this.activeCardId && this.activeCardId !== '__new__' ? this.activeCardId : undefined;
            const targetCleanUrl = cleanUrl(window.location.href);
            const problemTitle = (this.utils && typeof this.utils.getExtractedProblemTitle === 'function') ? this.utils.getExtractedProblemTitle() : document.title;

            let customWeights: number[] | null = null;
            if (this.state.topicWeights && parsedTags && parsedTags.length > 0) {
                for (const tag of parsedTags) {
                    if (this.state.topicWeights[tag]) {
                        customWeights = this.state.topicWeights[tag];
                        break;
                    }
                }
            }

            if (existingId) {
                const index = this.state.cards.findIndex((c: Card) => c.id === existingId);
                if (index > -1) {
                    this.state.cards[index].approach = approach;
                    this.state.cards[index].tags = parsedTags;
                    this.state.cards[index] = this.state.scheduler.reviewCard(this.state.cards[index], rating, customWeights);
                    (this.state.cards[index] as Card & { lastRating?: number }).lastRating = rating;
                    this.activeCardId = existingId;
                }
            } else {
                let newCard = this.state.scheduler.createCard(problemTitle, targetCleanUrl, "", approach, parsedTags);
                newCard.id = generateCardId();
                newCard = this.state.scheduler.reviewCard(newCard, rating, customWeights);
                (newCard as Card & { lastRating?: number }).lastRating = rating;
                this.state.cards.push(newCard);
                this.activeCardId = newCard.id;
            }

            this.saveCards();

            chrome.storage.local.get(['approachDrafts'], (res: { approachDrafts?: Record<string, DraftEntry | string> }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Tracker', `Chrome storage error fetching drafts on save-rating: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    const drafts = res.approachDrafts || {};
                    if (drafts[targetCleanUrl]) {
                        delete drafts[targetCleanUrl];
                        chrome.storage.local.set({ approachDrafts: drafts }, () => {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('Tracker', `Chrome storage error deleting draft: ${errorMessage}`, { error: chrome.runtime.lastError });
                            }
                        });
                    }
                } catch (draftErr) {
                    const errorMessage = draftErr instanceof Error ? draftErr.message : String(draftErr);
                    Logger.error('Tracker', `Error deleting draft after rating save: ${errorMessage}`, { draftErr });
                }
            });

            this.logReviewActivity();
            this.refreshWidgetState();

            safeFlushSync(() => {
                if (this._appControls) {
                    this._appControls.setSavedRatingNum(rating);
                }
            });
            setTimeout(() => {
                try {
                    safeFlushSync(() => {
                        if (this._appControls) {
                            this._appControls.setSavedRatingNum(null);
                        }
                    });
                } catch (timerErr) {
                    const errorMessage = timerErr instanceof Error ? timerErr.message : String(timerErr);
                    Logger.error('Tracker', `Error resetting save-rating button text: ${errorMessage}`, { timerErr });
                }
            }, 1500);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error saving card rating: ${errorMessage}`, { err });
        }
    }

    /**
     * Unbinds active document keydown listeners attached during card review sessions.
     * 
     * @internal
     * @returns {void}
     */
    _cleanupReviewKeyboard(): void {
        try {
            if (this._reviewKeyHandler) {
                window.removeEventListener('keydown', this._reviewKeyHandler, true);
                this._reviewKeyHandler = null;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error during review keyboard cleanup: ${errorMessage}`, { err });
        }
    }
}

if (typeof window !== 'undefined') {
    try {
        const win = window as unknown as { AlgoRecall: { Tracker: typeof Tracker } };
        win.AlgoRecall = win.AlgoRecall || {};
        win.AlgoRecall.Tracker = Tracker;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Tracker', `Failed to register Tracker on window global scope: ${errorMessage}`, { err });
    }
}

// Preserve CommonJS and default exports
if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any) = Tracker;
    (module.exports as any).default = Tracker;
    (module.exports as any).Tracker = Tracker;
    (module.exports as any).TrackerFloatingLauncher = TrackerFloatingLauncher;
    (module.exports as any).TrackerHeader = TrackerHeader;
    (module.exports as any).TrackerNavBar = TrackerNavBar;
    (module.exports as any).TrackerRatingBar = TrackerRatingBar;
    (module.exports as any).TrackerCardReviewView = TrackerCardReviewView;
    (module.exports as any).TrackerTagPicker = TrackerTagPicker;
    (module.exports as any).TrackerOverlay = TrackerOverlay;
    (module.exports as any).TrackerApp = TrackerApp;
}

export default Tracker;
