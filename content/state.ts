/**
 * @file content/state.ts
 * @description Global state manager declarations shared across the content script scope.
 * Injected sequentially by manifest.json before other script files (utils, highlighter, tracker, content)
 * to act as a shared memory layer on targeted domains.
 * 
 * Context: Content script isolation layer (runs in target web pages within the extension's isolated world,
 * attached to `window.AlgoRecall`).
 * 
 * Key Exports:
 * - `AlgoRecallState`: Interface defining in-memory content script runtime state.
 * - `OrchestratorContract`: Interface defining orchestrator lifecycle and tracker triggers.
 * - `AlgoRecallGlobal`: Interface defining the window-level extension namespace.
 * - `getAlgoRecallGlobal`: Helper accessor ensuring safe retrieval and creation of `window.AlgoRecall`.
 */

import { Card, HighlightMark, BookmarkItem, ExtensionSettings } from '../types/domain';
import AbstractScheduler from '../features/tracker/scheduler/scheduler';
import { Logger } from '@common/logger';
import { DEFAULT_PALETTES, DEFAULT_EXTENSION_SETTINGS, DEFAULT_THEME } from '../features/common/constants';

/**
 * In-memory state store containing shared application data across content script components
 * (Highlighter, Tracker, Orchestrator, Notifier).
 */
export interface AlgoRecallState {
    /** Active spaced repetition algorithm scheduler instance (typically FsrsScheduler). */
    scheduler: AbstractScheduler;
    /** Cached flashcards and study items retrieved from extension storage. */
    cards: Card[];
    /** Canonical URL of the last processed page, preventing duplicate scans during SPA navigation. */
    lastCheckedUrl: string;
    /** User-defined per-topic difficulty multiplier weights. */
    topicWeights: Record<string, number[]>;
    /** Current active theme indicator ('light' or 'dark'). */
    currentTheme: string;
    /** Saved user text highlight models across pages. */
    marks: HighlightMark[];
    /** Saved problem and article bookmarks. */
    bookmarks: BookmarkItem[];
    /** Injected notes and DOM content collections. */
    pagecontents: unknown[];
    /** User settings, UI preferences, and palette selections. */
    extensionSettings: ExtensionSettings;
    /** Set tracking registered custom CSS Highlight names to avoid duplicate DOM style rules. */
    activeHighlightStyles: Set<string>;
    /** Debounce timer ID for dynamic layout observer highlights updates. */
    highlightDebounceTimer: ReturnType<typeof setTimeout> | null;
    /** Cached active DOM ranges for hover tracking and tooltip triggers. */
    activeMarkRanges: unknown[];
    /** Identifier of the highlight mark currently hovered by the user cursor. */
    hoveredMarkId: string | number | null;
    /** Timer reference to delay tooltip dismissal during cursor movements. */
    hideTooltipTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Minimal contract representing the content script orchestrator instance exposed on `window.AlgoRecall.orchestrator`.
 */
export interface OrchestratorContract {
    /**
     * Initializes extension state, binds DOM/storage events, and registers UI observers.
     * @returns {void | Promise<void>}
     */
    init: () => void | Promise<void>;
    /** Optional reference to the problem tracker controller. */
    tracker?: {
        /** Refreshes current problem status, rating buttons, and tag displays. */
        refreshWidgetState: () => void;
        /** Opens the review widget panel and begins the active study flow. */
        startReview: () => void;
    };
}

/**
 * Window-level namespace object (`window.AlgoRecall`) exposing content script modules, state,
 * and constructors across sequentially loaded scripts.
 */
export interface AlgoRecallGlobal {
    /** In-memory state store shared across content scripts. */
    state?: AlgoRecallState;
    /** DOM traversal and styling helper utilities. */
    Utils?: any;
    /** Interactive in-page notification overlay manager. */
    Notifier?: any;
    /** Constructor for the problem tracking and review widget overlay. */
    Tracker?: new (...args: any[]) => any;
    /** Constructor for the text highlighter and annotation manager. */
    Highlighter?: new (...args: any[]) => any;
    /** Constructor for the primary content script orchestrator. */
    Orchestrator?: new (...args: any[]) => any;
    /** Instantiated orchestrator controller instance. */
    orchestrator?: OrchestratorContract;
    /** Range serialization and text matching helpers for highlights. */
    HighlightsHelpers?: any;
    /** Highlights list and persistence manager. */
    HighlightsManager?: any;
    /** Catch-all for dynamically registered global properties. */
    [key: string]: unknown;
}

/**
 * Safely accesses or initializes the global `window.AlgoRecall` namespace object.
 * Prevents throwing when run in unconventional environments or frames.
 * 
 * @returns {AlgoRecallGlobal} Global extension container on the current window.
 */
export function getAlgoRecallGlobal(): AlgoRecallGlobal {
    try {
        const win = window as unknown as { AlgoRecall?: AlgoRecallGlobal };
        win.AlgoRecall = win.AlgoRecall || {};
        return win.AlgoRecall;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('State', `Failed to access window global in getAlgoRecallGlobal: ${errorMessage}`, { err });
        return {};
    }
}

const algoGlobal = getAlgoRecallGlobal();

// Instantiated state container
let schedulerInstance: AbstractScheduler;
try {
    const SchedulerCtor = (window as unknown as { FsrsScheduler?: new () => AbstractScheduler }).FsrsScheduler;
    schedulerInstance = typeof SchedulerCtor === 'function' ? new SchedulerCtor() : ({} as AbstractScheduler);
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('State', `Failed to instantiate FsrsScheduler in content/state.ts: ${errorMessage}`, { err });
    // Comment: Fallback to dummy scheduler instance if constructor fails
    schedulerInstance = {} as AbstractScheduler;
}

algoGlobal.state = {
    // Instantiated scheduling algorithm controller (FSRS as default)
    scheduler: schedulerInstance,

    // Active collection of study cards/patterns loaded from storage
    cards: [],

    // URL caching to prevent duplicate triggers on SPA change transitions
    lastCheckedUrl: window.location.href,

    // Optional tag weights profile mappings
    topicWeights: {},

    // Active theme indicator
    currentTheme: DEFAULT_THEME,

    // --- Highlighter State ---
    // Saved user text highlight models
    marks: [],

    // Saved page bookmarks
    bookmarks: [],

    // Injected notes/highlights content collections
    pagecontents: [],

    // User settings layout preferences
    extensionSettings: {
        ...DEFAULT_EXTENSION_SETTINGS
    },

    // Set tracking registered custom CSS Highlights to avoid double DOM element styling
    activeHighlightStyles: new Set<string>(),

    // Debounce timer ID for dynamic layout observer highlights updates
    highlightDebounceTimer: null,

    // Active ranges map for Hover tracking
    activeMarkRanges: [],
    hoveredMarkId: null,
    hideTooltipTimer: null
};
