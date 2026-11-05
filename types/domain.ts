/**
 * @file Central Domain Models and Data Schemas
 * @module types/domain
 * @context Shared across all extension environments (Background Service Worker, Content Scripts, Popup UI, Dashboard, Options)
 * @description Defines the core data entities, spaced repetition (FSRS) states, highlight marks, Pomodoro timer
 * states, user configuration, cross-context messaging schemas, and the overarching `chrome.storage.local` structure.
 */

import { Rating, State } from 'ts-fsrs';

/**
 * Re-exported core FSRS review rating enum directly from ts-fsrs.
 * - `Again` (1): Complete blackout / incorrect recall.
 * - `Hard` (2): Correct response recalled with serious difficulty.
 * - `Good` (3): Correct response recalled after a hesitation.
 * - `Easy` (4): Perfect recall with zero hesitation.
 */
export { Rating };

/**
 * Re-exported core FSRS card learning state enum directly from ts-fsrs.
 * - `New` (0): Card has never been studied.
 * - `Learning` (1): Card is currently in the initial learning phase.
 * - `Review` (2): Card graduated into the regular spaced review cycle.
 * - `Relearning` (3): Card lapsed and is being relearned.
 */
export { State };

/**
 * FSRS algorithm parameters controlling memory stability, difficulty decay, and retention targets.
 */
export interface FSRSParameters {
    /** 17 or 19 model weights for the Free Spaced Repetition Scheduler algorithm */
    w: number[];
    /** Power forgetting curve decay exponent (standard value typically -0.5) */
    decay: number;
    /** Scale factor determining interval lengths based on target retention */
    factor: number;
    /** Desired probability of successful recall at review time (e.g. 0.9 for 90%) */
    requestRetention: number;
    /** Version identifier of the parameter configuration schema (e.g., "v4", "v5") */
    version?: string;
    /** Unix timestamp (milliseconds) when these parameters were calculated or updated */
    timestamp?: number;
}

/**
 * Historical review log entry recording a single spaced repetition study event for a card.
 */
export interface ReviewLog {
    /** The user's assessment rating (Again=1, Hard=2, Good=3, Easy=4) */
    rating: Rating | number;
    /** Unix timestamp (milliseconds) representing the exact time of the review */
    date: number;
    /** Time taken by the user to review and answer this problem (in milliseconds or seconds) */
    duration?: number;
    /** Card's learning state (`New`, `Learning`, `Review`, `Relearning`) at the time of review */
    state?: State;
    /** Additional metadata or custom fields stored alongside the review */
    [key: string]: unknown;
}

/**
 * Pure mathematical FSRS memory metrics for a card, serialized as numeric timestamps for JSON persistence.
 */
export interface FSRSCardState {
    /** Unix timestamp (milliseconds) indicating when the card is next due for review */
    due: number;
    /** Memory stability in days (time required for retrievability to drop from 100% to requestRetention) */
    stability: number;
    /** Card difficulty rating on a continuous scale from 1 (easiest) to 10 (hardest) */
    difficulty: number;
    /** Number of days elapsed since the card's previous review */
    elapsed_days: number;
    /** Number of days scheduled between the previous review and this due date */
    scheduled_days: number;
    /** Current step index in short-term learning/relearning sequence */
    learning_steps: number;
    /** Total number of successful review repetitions completed */
    reps: number;
    /** Total number of times recall failed after the card was in Review state (lapses) */
    lapses: number;
    /** Current memory lifecycle state: New(0), Learning(1), Review(2), Relearning(3) */
    state: State;
    /** Unix timestamp (milliseconds) of the most recent review, or null if unreviewed */
    last_review?: number | null;
}

/**
 * Application Spaced Repetition Card entity stored in `chrome.storage.local`.
 * Represents a tracked LeetCode/AlgoMonster problem and its notes, complexity, and FSRS parameters.
 */
export interface Card extends FSRSCardState {
    /** Unique problem identifier (e.g., URL slug or algorithmic problem title hash) */
    id: string;
    /** Human-readable title of the problem (e.g., "Two Sum") */
    problemTitle: string;
    /** Canonical URL to the problem page on LeetCode or AlgoMonster */
    problemUrl: string;
    /** Markdown notes, problem summary, or key learnings recorded by the user */
    textRead?: string;
    /** Algorithmic approach explanation (e.g., "Hash map with complement lookups") */
    approach?: string;
    /** Big-O time complexity annotation (e.g., "O(n)") */
    timeComplexity?: string;
    /** Big-O space complexity annotation (e.g., "O(n)") */
    spaceComplexity?: string;
    /** Categorical tags associated with this card (e.g., ["Array", "Hash Table"]) */
    tags?: string[];
    /** Chronological history of all review sessions performed on this card */
    historyLog?: ReviewLog[];
    /** Due timestamp prior to the latest review, used for review undo operations */
    previousDue?: number;
    /** Most recent user rating submitted for this card */
    lastRating?: number;
    /** Extensible metadata key-value store */
    [key: string]: unknown;
}

/**
 * DOM Node metadata representation for precise text range restoration across page reloads.
 */
export interface DOMMeta {
    /** XPath or CSS structural hierarchy path identifying the boundary DOM container */
    path?: string;
    /** Character offset within the container text node */
    offset?: number;
    /** Contextual prefix/suffix text snippet around the selection to verify anchor validity */
    textSnippet?: string;
    /** Additional anchor parameters */
    [key: string]: unknown;
}

/**
 * Web page text highlight mark entity stored in `chrome.storage.local`.
 */
export interface HighlightMark {
    /** Unique identifier for the highlight mark (UUID or timestamp) */
    id: string;
    /** Target webpage URL where the text was highlighted */
    url: string;
    /** The extracted string of highlighted text */
    text: string;
    /** Background hex color code used for rendering the highlight overlay */
    color: string;
    /** Semantic classification or highlight style type */
    type?: string;
    /** Unix timestamp (milliseconds) when the highlight was created */
    createdAt: number;
    /** User-annotated personal note or insight attached to this highlight */
    note?: string;
    /** User-defined category or folder tag (e.g., "Dynamic Programming") */
    category?: string;
    /** DOM boundary positioning metadata for restoring selections upon navigation */
    highlightSource?: {
        /** Start boundary anchor point */
        startMeta?: DOMMeta;
        /** End boundary anchor point */
        endMeta?: DOMMeta;
    };
    /** Extensible properties */
    [key: string]: unknown;
}

/**
 * Saved bookmark item linking to an algorithmic problem or documentation page.
 */
export interface BookmarkItem {
    /** Target destination URL */
    url: string;
    /** Page or problem title */
    title: string;
    /** Unix timestamp (milliseconds) when the bookmark was recorded */
    createdAt?: number;
    /** Additional bookmark attributes */
    [key: string]: unknown;
}

/**
 * Runtime messaging action types used for cross-context dispatching between
 * Background, Content Scripts, Popup, and Dashboard pages.
 */
export enum MessageType {
    /** Persist or update a card entity in central storage */
    SYNC_CARD = 'SYNC_CARD',
    /** Query card data by problem URL or ID */
    GET_CARD = 'GET_CARD',
    /** Delete a card entity from storage */
    DELETE_CARD = 'DELETE_CARD',
    /** Trigger or synchronize Pomodoro timer lifecycle actions */
    POMODORO_ACTION = 'POMODORO_ACTION',
    /** Dispatch a desktop notification for testing settings */
    TEST_NOTIFICATION = 'TEST_NOTIFICATION',
    /** Toggle the automated weekly summary generation flag */
    TOGGLE_WEEKLY_SUMMARY = 'TOGGLE_WEEKLY_SUMMARY',
    /** Snooze problem review notifications for a specified duration */
    SNOOZE_NOTIFICATION = 'SNOOZE_NOTIFICATION',
    /** Persist problem approach notes without mutating FSRS metrics */
    SAVE_APPROACH = 'SAVE_APPROACH',
    /** Broadcast a command to refresh active content script UI states */
    REFRESH_STATE = 'REFRESH_STATE'
}

/**
 * Standard envelope structure for cross-context Chrome runtime messages.
 */
export interface ExtensionMessage {
    /** Identified action type from the `MessageType` enum */
    type?: MessageType | string;
    /** Alternative action identifier field used interchangeably with `type` */
    action?: MessageType | string;
    /** Arbitrary data payload passed along with the message request */
    payload?: unknown;
    /** Snooze duration parameter in minutes (used with `SNOOZE_NOTIFICATION`) */
    minutes?: number;
    /** Boolean toggle flag (used with `TOGGLE_WEEKLY_SUMMARY`) */
    enabled?: boolean;
    /** Additional message properties */
    [key: string]: unknown;
}

/**
 * Standard structured response contract returned by runtime message listeners.
 * @template T - The type of data contained in the response payload.
 */
export interface MessageResponse<T = unknown> {
    /** True if the requested operation completed without error, otherwise false */
    success: boolean;
    /** Result data payload returned on success */
    data?: T;
    /** Human-readable error message explaining failure */
    error?: string;
    /** Additional response metadata */
    [key: string]: unknown;
}

/**
 * User configuration preferences for browser desktop notifications and badge icons.
 */
export interface NotificationSettings {
    /** Master switch for desktop notifications */
    enabled?: boolean;
    /** Notification schedule frequency (e.g. "daily", "hourly") */
    frequency?: string;
    /** Notification importance priority level */
    priority?: string;
    /** Whether desktop notifications remain visible until dismissed by the user */
    requireInteraction?: boolean;
    /** Whether notifications are suppressed during specified quiet hours */
    quietHoursEnabled?: boolean;
    /** Start time for quiet hours in "HH:MM" 24-hour format */
    quietHoursStart?: string;
    /** End time for quiet hours in "HH:MM" 24-hour format */
    quietHoursEnd?: string;
    /** Whether to display due card counts on the extension action badge */
    badgeEnabled?: boolean;
    /** Secondary flag controlling due badge rendering */
    showDueBadge?: boolean;
}

/**
 * Whitelist record specifying websites where the extension content script should activate.
 */
export interface WhitelistedWebsite {
    /** Fully qualified domain name or hostname pattern (e.g. "leetcode.com") */
    domain: string;
    /** True if this domain is bundled as part of the factory default whitelist */
    isDefault?: boolean;
    /** Display label for the website in the options list */
    name?: string;
}

/**
 * Named color palette definition for text highlighting.
 */
export interface Palette {
    /** Display name of the color palette */
    name: string;
    /** Array of hex color code strings belonging to this palette */
    colors: string[];
}

/**
 * Visual styling, popup display, and highlighter appearance settings.
 */
export interface ExtensionSettings {
    /** Index of the currently selected palette in `palettes` */
    activePaletteIndex?: number;
    /** Default hex color applied when creating a new highlight */
    defaultHighlightColor?: string;
    /** Default icon/symbol character used for annotations */
    defaultSymbolChar?: string;
    /** Default color applied to annotation symbols */
    defaultSymbolColor?: string;
    /** Flag enabling verbose debug logs and developer tooling */
    developerMode?: boolean;
    /** Available highlighter color palettes */
    palettes?: Palette[];
    /** Recently selected hex color strings for fast access */
    recentColors?: string[];
    /** Whether to render visual memory analytics charts in the popup/dashboard */
    showCharts?: boolean;
    /** Whether to display the inline toolbar when text is selected */
    showMarkerPopup?: boolean;
    /** Whether to display the floating launcher button on target problem pages */
    showLauncher?: boolean;
}

/**
 * Aggregated user preferences combining theme, notifications, FSRS tuning, and whitelists.
 */
export interface UserSettings {
    /** Selected UI color theme (e.g., "dark", "light", "system") */
    theme?: string;
    /** Desktop notification preferences */
    notificationSettings?: NotificationSettings;
    /** Visual and highlighter styling options */
    extensionSettings?: ExtensionSettings;
    /** Global customized FSRS model weights and retention configuration */
    fsrsGlobalParams?: FSRSParameters | Partial<FSRSParameters> | Record<string, unknown>;
    /** List of authorized web domains for content script execution */
    whitelistedWebsites?: WhitelistedWebsite[];
    /** Daily review goal target count, or null if disabled */
    dailyGoalTarget?: number | null;
    /** Longest consecutive daily study streak achieved */
    longestStreak?: number;
    /** State tracking for review rating prompt snoozing and visibility */
    ratingPromptState?: { snoozedUntil?: number; status?: string };
    /** Additional extensible settings keys */
    [key: string]: unknown;
}

/**
 * Exported JSON / NDJSON backup archive schema containing user study data and settings.
 */
export interface BackupData {
    /** Format type discriminator (e.g., "algomonster-fsrs-backup") */
    type?: string;
    /** Core payload or array of entity records */
    data?: unknown;
    /** Backup format schema version number */
    version?: string | number;
    /** Unix timestamp (milliseconds) when the backup archive was produced */
    timestamp?: number;
    /** Record counts summary map by entity type */
    counts?: { [key: string]: number };
    /** SHA-256 or MD5 integrity checksum of the serialized records */
    checksum?: string;
    /** Additional metadata fields */
    [key: string]: unknown;
}

/**
 * Active Pomodoro timer runtime state synchronized across windows and workers.
 */
export interface PomodoroState {
    /** Current operating state of the timer */
    state: 'idle' | 'running' | 'paused';
    /** Current session phase */
    phase: 'focus' | 'shortBreak' | 'longBreak';
    /** Unix timestamp (milliseconds) when the current countdown period completes */
    targetEndTime: number;
    /** Ordinal index of the current work session in the current cycle */
    currentSession: number;
}

/**
 * Configurable duration thresholds for Pomodoro cycles.
 */
export interface PomodoroSettings {
    /** Work focus duration in minutes */
    focusDuration: number;
    /** Short rest duration in minutes */
    shortBreakDuration: number;
    /** Extended rest duration in minutes after completing multiple focus cycles */
    longBreakDuration: number;
    /** Number of focus sessions required before triggering a long break */
    sessionsBeforeLongBreak: number;
}

/**
 * Cumulative Pomodoro productivity metrics tracked per calendar date.
 */
export interface PomodoroStats {
    /** Number of focus sessions completed today */
    sessionsToday: number;
    /** Cumulative focus minutes logged today */
    focusMinutesToday: number;
    /** ISO date string ("YYYY-MM-DD") representing the date of recorded stats */
    lastDate: string;
}

/**
 * Root schema definition for all entities persisted in `chrome.storage.local`.
 */
export interface StorageData {
    /** Collection of all tracked spaced repetition cards */
    fsrsCards?: Card[];
    /** Daily review count map indexed by ISO date string ("YYYY-MM-DD" -> count) */
    fsrsActivity?: { [date: string]: number };
    /** Topic-specific custom FSRS weight arrays indexed by category name */
    fsrsTopicWeights?: { [topic: string]: number[] };
    /** Global FSRS scheduler algorithm parameters */
    fsrsGlobalParams?: FSRSParameters | Partial<FSRSParameters> | Record<string, unknown>;
    /** Desktop notification configuration */
    notificationSettings?: NotificationSettings;
    /** Array of user-whitelisted domains where content scripts run */
    whitelistedWebsites?: WhitelistedWebsite[];
    /** Visual, toolbar, and palette customization settings */
    extensionSettings?: ExtensionSettings;
    /** Active UI theme name */
    theme?: string;
    /** Persistent text highlight marks across websites */
    marks?: HighlightMark[];
    /** Saved problem and documentation bookmarks */
    bookmarks?: BookmarkItem[];
    /** Live synchronized state of the Pomodoro timer */
    pomodoroState?: PomodoroState;
    /** User-defined Pomodoro interval lengths */
    pomodoroSettings?: PomodoroSettings;
    /** Daily Pomodoro session and time totals */
    pomodoroStats?: PomodoroStats;
    /** Flag indicating whether the weekly study digest summary is enabled */
    weeklySummaryEnabled?: boolean;
    /** Consolidated user settings wrapper */
    userSettings?: UserSettings;
    /** Extensible storage properties */
    [key: string]: unknown;
}
