/**
 * @file types/domain.ts
 * @description Central TypeScript type declarations and domain interfaces for Algomonster FSRS Extension.
 */

import { Rating, State } from 'ts-fsrs';

// Re-export core FSRS enums directly from ts-fsrs
export { Rating, State };

/**
 * FSRS Parameters structure
 */
export interface FSRSParameters {
    w: number[];
    decay: number;
    factor: number;
    requestRetention: number;
    version?: string;
    timestamp?: number;
}

/**
 * Historical review log entry on a card
 */
export interface ReviewLog {
    rating: Rating | number;
    date: number;
    duration?: number;
    state?: State;
    [key: string]: unknown;
}

/**
 * Representation of pure FSRS card state metrics (JSON-serializable timestamp numbers)
 */
export interface FSRSCardState {
    due: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    learning_steps: number;
    reps: number;
    lapses: number;
    state: State;
    last_review?: number | null;
}

/**
 * Application FSRS Card entity stored in local extension storage
 */
export interface Card extends FSRSCardState {
    id: string;
    problemTitle: string;
    problemUrl: string;
    textRead?: string;
    approach?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    tags?: string[];
    historyLog?: ReviewLog[];
    previousDue?: number;
    lastRating?: number;
    [key: string]: unknown;
}

/**
 * DOM Node metadata representation for highlighting range restoration
 */
export interface DOMMeta {
    path?: string;
    offset?: number;
    textSnippet?: string;
    [key: string]: unknown;
}

/**
 * Highlight mark entity stored in Chrome storage
 */
export interface HighlightMark {
    id: string;
    url: string;
    text: string;
    color: string;
    type?: string;
    createdAt: number;
    note?: string;
    category?: string;
    highlightSource?: {
        startMeta?: DOMMeta;
        endMeta?: DOMMeta;
    };
    [key: string]: unknown;
}

/**
 * Page bookmark item entity stored in Chrome storage
 */
export interface BookmarkItem {
    url: string;
    title: string;
    createdAt?: number;
    [key: string]: unknown;
}

/**
 * Message Type identifiers for extension runtime communications
 */
export enum MessageType {
    SYNC_CARD = 'SYNC_CARD',
    GET_CARD = 'GET_CARD',
    DELETE_CARD = 'DELETE_CARD',
    POMODORO_ACTION = 'POMODORO_ACTION',
    TEST_NOTIFICATION = 'TEST_NOTIFICATION',
    TOGGLE_WEEKLY_SUMMARY = 'TOGGLE_WEEKLY_SUMMARY',
    SNOOZE_NOTIFICATION = 'SNOOZE_NOTIFICATION',
    SAVE_APPROACH = 'SAVE_APPROACH',
    REFRESH_STATE = 'REFRESH_STATE'
}

/**
 * Chrome Extension Runtime Message structure
 */
export interface ExtensionMessage {
    type?: MessageType | string;
    action?: MessageType | string;
    payload?: unknown;
    minutes?: number;
    enabled?: boolean;
    [key: string]: unknown;
}

/**
 * Standard Chrome Extension Message Response
 */
export interface MessageResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    [key: string]: unknown;
}

/**
 * Notification Settings configuration
 */
export interface NotificationSettings {
    enabled?: boolean;
    frequency?: string;
    priority?: string;
    requireInteraction?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
}

/**
 * Whitelisted Website domain configuration
 */
export interface WhitelistedWebsite {
    domain: string;
    isDefault?: boolean;
    name?: string;
}

/**
 * Color Palette configuration
 */
export interface Palette {
    name: string;
    colors: string[];
}

/**
 * Extension Chrome display/theme settings
 */
export interface ChromeSettings {
    activePaletteIndex?: number;
    defaultHighlightColor?: string;
    defaultSymbolChar?: string;
    defaultSymbolColor?: string;
    developerMode?: boolean;
    palettes?: Palette[];
    recentColors?: string[];
    showCharts?: boolean;
    showMarkerPopup?: boolean;
}

/**
 * Overall User Settings Object
 */
export interface UserSettings {
    theme?: string;
    notificationSettings?: NotificationSettings;
    chromeSettings?: ChromeSettings;
    fsrsGlobalParams?: FSRSParameters | Partial<FSRSParameters> | Record<string, unknown>;
    whitelistedWebsites?: WhitelistedWebsite[];
    dailyGoalTarget?: number | null;
    longestStreak?: number;
    ratingPromptState?: { snoozedUntil?: number; status?: string };
    [key: string]: unknown;
}

/**
 * Exported JSON Backup file structure
 */
export interface BackupData {
    type?: string;
    data?: unknown;
    version?: string | number;
    timestamp?: number;
    counts?: { [key: string]: number };
    checksum?: string;
    [key: string]: unknown;
}

/**
 * Pomodoro active state structure
 */
export interface PomodoroState {
    state: 'idle' | 'running' | 'paused';
    phase: 'focus' | 'shortBreak' | 'longBreak';
    targetEndTime: number;
    currentSession: number;
}

/**
 * Pomodoro duration configurations
 */
export interface PomodoroSettings {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    sessionsBeforeLongBreak: number;
}

/**
 * Pomodoro tracking statistics
 */
export interface PomodoroStats {
    sessionsToday: number;
    focusMinutesToday: number;
    lastDate: string;
}

/**
 * Complete `chrome.storage.local` extension data schema
 */
export interface StorageData {
    fsrsCards?: Card[];
    fsrsActivity?: { [date: string]: number };
    fsrsTopicWeights?: { [topic: string]: number[] };
    fsrsGlobalParams?: FSRSParameters | Partial<FSRSParameters> | Record<string, unknown>;
    notificationSettings?: NotificationSettings;
    whitelistedWebsites?: WhitelistedWebsite[];
    chromeSettings?: ChromeSettings;
    theme?: string;
    marks?: HighlightMark[];
    bookmarks?: BookmarkItem[];
    pomodoroState?: PomodoroState;
    pomodoroSettings?: PomodoroSettings;
    pomodoroStats?: PomodoroStats;
    weeklySummaryEnabled?: boolean;
    userSettings?: UserSettings;
    [key: string]: unknown;
}

