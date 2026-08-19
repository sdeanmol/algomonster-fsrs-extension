/**
 * @file content/state.ts
 * @description Global state manager declarations shared across the content script scope.
 * Injected sequentially by manifest.json before other script files (utils, highlighter, tracker, content)
 * to act as a shared memory layer on targeted domains.
 */

import { Card, HighlightMark, BookmarkItem, ChromeSettings } from '../types/domain';
import AbstractScheduler from '../features/tracker/scheduler/scheduler';
import { Logger } from '@common/logger';
import { DEFAULT_PALETTES } from '../features/common/constants';

export interface AlgoRecallState {
    scheduler: AbstractScheduler;
    cards: Card[];
    lastCheckedUrl: string;
    topicWeights: Record<string, number[]>;
    currentTheme: string;
    marks: HighlightMark[];
    bookmarks: BookmarkItem[];
    pagecontents: unknown[];
    chromeSettings: ChromeSettings;
    activeHighlightStyles: Set<string>;
    highlightDebounceTimer: ReturnType<typeof setTimeout> | null;
    activeMarkRanges: unknown[];
    hoveredMarkId: string | number | null;
    hideTooltipTimer: ReturnType<typeof setTimeout> | null;
}

export interface AlgoRecallGlobal {
    state?: AlgoRecallState;
    Utils?: any;
    Notifier?: any;
    Tracker?: any;
    Highlighter?: any;
    Orchestrator?: any;
    orchestrator?: any;
    HighlightsHelpers?: any;
    HighlightsManager?: any;
}

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
    currentTheme: 'dark',

    // --- Highlighter State ---
    // Saved user text highlight models
    marks: [],

    // Saved page bookmarks
    bookmarks: [],

    // Injected notes/highlights content collections
    pagecontents: [],

    // User settings layout preferences
    chromeSettings: {
        defaultHighlightColor: '#f1c40f',
        recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
        showMarkerPopup: true,
        activePaletteIndex: 0,
        palettes: DEFAULT_PALETTES
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
