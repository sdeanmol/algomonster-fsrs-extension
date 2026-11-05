/**
 * @file Centralized Domain Constants and Defaults
 * @module features/common/constants
 * @context Shared across Background, Content Scripts, Popup UI, and Dashboard
 * @description Provides domain constants including time conversion factors, default FSRS
 * algorithmic parameters, notification intervals, UI theme defaults, whitelisted websites,
 * navigation routes, gamification milestones, and sanitization configurations.
 */

import { Palette, NotificationSettings, ExtensionSettings, PomodoroSettings, PomodoroStats } from '../../types/domain';
import { BackupRecordType } from '../../types/backup';
import type { FirebaseOptions } from 'firebase/app';

/** Milliseconds in a single second */
export const MS_PER_SECOND = 1000;
/** Milliseconds in a single minute */
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
/** Milliseconds in a single hour */
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
/** Milliseconds in a single 24-hour day */
export const MS_PER_DAY = 24 * MS_PER_HOUR;
/** Milliseconds in a standard 7-day week */
export const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Days in a standard calendar week */
export const DAYS_PER_WEEK = 7;
/** Days in a standard calendar year */
export const DAYS_PER_YEAR = 365;

/**
 * Standard 17-weight vector for FSRS v4.5 spaced repetition scheduler.
 * Weights govern initial stability for ratings, difficulty transitions, stability growth, and lapse recovery.
 */
export const DEFAULT_FSRS_W: number[] = [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
];

/** Power forgetting curve decay exponent for memory retrievability calculations */
export const DEFAULT_FSRS_DECAY = -0.5;

/** Default scale factor determining interval lengths based on target retention */
export const DEFAULT_FSRS_FACTOR = 19 / 81; // ~0.2345679

/** Default desired retention rate (90%) */
export const DEFAULT_FSRS_REQUEST_RETENTION = 0.90;

/** FSRS difficulty score threshold (>= 7) at which a card is classified as high difficulty */
export const HIGH_DIFFICULTY_THRESHOLD = 7;

/** Memory stability threshold in days (>= 7) at which a card is considered graduated from learning */
export const GRADUATED_STABILITY_THRESHOLD = 7;

/** Memory stability threshold in days (>= 14) at which a lapsed card is considered fully recovered */
export const RECOVERED_STABILITY_THRESHOLD = 14;

/** Desired recall performance percentage (>= 90%) considered healthy / green status */
export const RECALL_THRESHOLD_GOOD = 90;

/** Recall performance warning threshold percentage (< 75%) indicating high lapse risk */
export const RECALL_THRESHOLD_WARNING = 75;

/** Number of due cards threshold (>= 20) triggering backlog warning UI states */
export const DUE_CARDS_THRESHOLD_WARNING = 20;

/** Minimum review count required before running the FSRS parameter optimizer */
export const OPTIMIZER_DEFAULT_THRESHOLD = 1000;

/** Maximum number of cards sampled during optimizer training to preserve browser responsiveness */
export const OPTIMIZER_MAX_TRAINING_CARDS = 2500;

/** Default training epochs for gradient descent optimization */
export const OPTIMIZER_DEFAULT_EPOCHS = 50;

/** Default learning rate for FSRS parameter optimization */
export const OPTIMIZER_DEFAULT_LEARNING_RATE = 0.01;

/** Review completion count thresholds corresponding to heatmap color intensity levels 0 through 4 */
export const HEATMAP_LEVEL_THRESHOLDS = [0, 2, 5, 8];

/** Default background alarm polling interval in minutes for checking due reviews */
export const ALARM_DEFAULT_CHECK_INTERVAL_MIN = 60;

/** Period in minutes for daily maintenance alarms (24 hours) */
export const ALARM_DAILY_PERIOD_MIN = 1440;

/** Period in minutes for weekly digest summary generation alarms (7 days) */
export const ALARM_WEEKLY_PERIOD_MIN = 10080;

/** Default review prompt snooze duration in minutes */
export const SNOOZE_DEFAULT_MINUTES = 15;

/** Debounce time in milliseconds for user rating UI button clicks */
export const RATING_UI_DEBOUNCE_MS = 400;

/** Time window in milliseconds (1 minute) to ignore duplicate review rating requests */
export const ALGORITHMIC_DEBOUNCE_WINDOW_MS = 60 * 1000;

/** Default factory-whitelisted algorithmic coding platforms */
export const DEFAULT_WHITELISTED_WEBSITES = [
    { domain: "algo.monster", name: "AlgoMonster" },
    { domain: "systemdesignschool.io", name: "System Design School" },
    { domain: "codeforces.com", name: "Codeforces" },
    { domain: "leetcode.com", name: "LeetCode" },
    { domain: "codechef.com", name: "CodeChef" },
    { domain: "atcoder.jp", name: "AtCoder" },
    { domain: "hackerrank.com", name: "HackerRank" },
    { domain: "hackerearth.com", name: "HackerEarth" },
    { domain: "codewars.com", name: "Codewars" },
    { domain: "codingame.com", name: "CodinGame" }
];

/** Quick lookup dictionary mapping supported domain names to human-readable platform titles */
export const PLATFORM_NAMES = DEFAULT_WHITELISTED_WEBSITES.reduce((acc, site) => {
    acc[site.domain] = site.name;
    return acc;
}, {} as Record<string, string>);

/** Default highlighter color palettes available in the extension */
export const DEFAULT_PALETTES: Palette[] = [
    { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
    { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
    { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
    { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
    { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
];

/** Default application visual theme ('dark') */
export const DEFAULT_THEME = 'dark';

/** Default highlight annotation color (yellow hex) */
export const DEFAULT_HIGHLIGHT_COLOR = '#f1c40f';

/** Default extension settings fallback object */
export const DEFAULT_EXTENSION_SETTINGS = {
    defaultHighlightColor: DEFAULT_HIGHLIGHT_COLOR,
    recentColors: [DEFAULT_HIGHLIGHT_COLOR, '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
    showMarkerPopup: true,
    showLauncher: true,
    activePaletteIndex: 0,
    palettes: DEFAULT_PALETTES
};

/** Default notification preferences fallback object */
export const DEFAULT_NOTIFICATION_SETTINGS = {
    enabled: true,
    frequency: '60',
    priority: '2',
    requireInteraction: true,
    badgeEnabled: true
};

/** Default Pomodoro interval configuration (25 min focus, 5 min short break, 15 min long break) */
export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4
};

/** Default initial Pomodoro productivity statistics */
export const DEFAULT_POMODORO_STATS: PomodoroStats = {
    sessionsToday: 0,
    focusMinutesToday: 0,
    lastDate: ''
};

/**
 * Mapping between command action identifiers and their corresponding extension HTML page paths.
 */
export const ACTION_URL_MAP: Record<string, string> = {
    'open-analytics': 'features/dashboard/analytics/analytics.html',
    'open-pomodoro': 'features/dashboard/pomodoro/pomodoro.html',
    'open-study-plan': 'features/dashboard/studyplan/studyplan.html',
    'open-forecast': 'features/dashboard/forecast/forecast.html',
    'open-history': 'features/dashboard/history/history.html',
    'open-heatmap': 'features/dashboard/heatmap/heatmap.html',
    'view-all-cards': 'features/common/data/data.html?view=total',
    'view-due-cards': 'features/common/data/data.html?view=due',
    'view-retention-cards': 'features/common/data/data.html?view=retention',
    'open-highlights-manager': 'features/highlighter/manager/highlights.html',
    'open-highlights-options': 'features/highlighter/options/highlightOptions.html',
    'open-summary': 'features/dashboard/summary/summary.html',
    'open-websites-manager': 'features/common/websites/websites.html',
    'open-fsrs-config': 'features/tracker/config/fsrsConfig.html',
    'open-help': 'features/common/help/help.html',
};

/** Abbreviated calendar day names starting with Sunday */
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Full calendar month names */
export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/** Default daily problem review goal target */
export const DEFAULT_DAILY_GOAL = 10;

/** Milestone streaks in days that trigger celebration animations */
export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 365];

/** Total review count milestones that unlock milestone badges */
export const REVIEW_MILESTONES = [50, 100, 250, 500, 1000, 5000];

/** Confetti particle hex color palette for achievement celebrations */
export const CONFETTI_COLORS = [
    '#a8c7fa', '#f9ab00', '#81c995', '#f28b82',
    '#c58af9', '#4ecdc4', '#ff6b6b', '#ffe66d'
];

/** Particle count emitted during celebratory confetti bursts */
export const CONFETTI_PARTICLE_COUNT = 60;

/** Debounce delay in milliseconds for popup live search filtering */
export const SEARCH_DEBOUNCE_MS = 150;

/** Maximum number of quick search results rendered in the popup */
export const SEARCH_MAX_RESULTS = 5;

/** Number of days displayed into the future for upcoming review forecasts */
export const FORECAST_DAYS_TO_SHOW = 30;

/** Percentage drop threshold for flagging sudden memory decay */
export const RETENTION_DROP_THRESHOLD = 5;

/** Interval days tested for future memory retention curve predictions */
export const RETENTION_TIME_POINTS = [0, 1, 3, 7, 14, 21, 30];

/** Maximum projection horizon in days for future memory simulations */
export const SIMULATION_MAX_DAYS = 180;

/** Harmonious color palette used across analytics dashboard charts */
export const ANALYTICS_CHART_COLORS = [
    '#a8c7fa', '#81c995', '#fde293', '#f28b82',
    '#c4a8fa', '#8ecae6', '#f4a261', '#e76f51',
    '#90be6d', '#f9c74f', '#43aa8b', '#577590'
];

/** Human-readable display titles for daily review time-of-day buckets */
export const TIME_OF_DAY_BUCKET_NAMES: Record<string, string> = {
    morning: 'Morning (5AM - 12PM)',
    afternoon: 'Afternoon (12PM - 5PM)',
    evening: 'Evening (5PM - 9PM)',
    night: 'Night (9PM - 5AM)'
};

/** Maximum entry capacity for in-memory log buffer and persistent debug logs */
export const LOGGER_MAX_BUFFER_SIZE = 1000;

/** DOMPurify configuration options forbidding script execution, embedded forms, and dangerous styles */
export const MARKDOWN_PURIFY_OPTIONS = {
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'script', 'iframe', 'object', 'embed', 'style', 'link', 'meta'],
    FORBID_ATTR: ['style']
};

/** Set of valid NDJSON backup record type discriminator strings */
export const VALID_BACKUP_RECORD_TYPES: ReadonlySet<string> = new Set<BackupRecordType>([
    'header', 'page', 'card', 'mark', 'bookmark', 'pagecontent', 'activity', 'weights', 'settings', 'footer'
]);

/** 32-bit FNV-1a hash algorithm offset basis initial value */
export const FNV_OFFSET_BASIS_32 = 0x811c9dc5;

/** 32-bit FNV-1a hash algorithm prime multiplier */
export const FNV_PRIME_32 = 0x01000193;

/** Fallback Firebase configuration used for development sandboxes */
export const DEFAULT_FIREBASE_CONFIG: FirebaseOptions = {
    apiKey: 'AIzaSyDummyKeyForDevelopment1234567890',
    authDomain: 'algorecall-fsrs-dev.firebaseapp.com',
    projectId: 'algorecall-fsrs-dev',
    storageBucket: 'algorecall-fsrs-dev.appspot.com',
    messagingSenderId: '123456789012',
    appId: '1:123456789012:web:abcdef1234567890'
};
