/**
 * @file features/common/constants.ts
 * @description Centralized domain constants for time calculations, FSRS parameters, and activity thresholds.
 */

// Time conversions in milliseconds
import { Palette, NotificationSettings, ExtensionSettings, PomodoroSettings, PomodoroStats } from '../../types/domain';
import { BackupRecordType } from '../../types/backup';
import type { FirebaseOptions } from 'firebase/app';

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

export const DAYS_PER_WEEK = 7;
export const DAYS_PER_YEAR = 365;

// FSRS 4.5 Standard Algorithmic Parameters & Defaults
export const DEFAULT_FSRS_W: number[] = [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
];
export const DEFAULT_FSRS_DECAY = -0.5;
export const DEFAULT_FSRS_FACTOR = 19 / 81; // ~0.2345679
export const DEFAULT_FSRS_REQUEST_RETENTION = 0.90;

export const HIGH_DIFFICULTY_THRESHOLD = 7;
export const GRADUATED_STABILITY_THRESHOLD = 7;
export const RECOVERED_STABILITY_THRESHOLD = 14;

// Recall & Retention Performance Thresholds (%)
export const RECALL_THRESHOLD_GOOD = 90;
export const RECALL_THRESHOLD_WARNING = 75;

// Due Cards Thresholds
export const DUE_CARDS_THRESHOLD_WARNING = 20;

// Optimizer Defaults
export const OPTIMIZER_DEFAULT_THRESHOLD = 1000;
export const OPTIMIZER_MAX_TRAINING_CARDS = 2500;
export const OPTIMIZER_DEFAULT_EPOCHS = 50;
export const OPTIMIZER_DEFAULT_LEARNING_RATE = 0.01;

// Heatmap & Activity Levels
export const HEATMAP_LEVEL_THRESHOLDS = [0, 2, 5, 8];

// Notification & Alarm Default Intervals (minutes)
export const ALARM_DEFAULT_CHECK_INTERVAL_MIN = 60;
export const ALARM_DAILY_PERIOD_MIN = 1440;
export const ALARM_WEEKLY_PERIOD_MIN = 10080;
export const SNOOZE_DEFAULT_MINUTES = 15;

// Rating Debounce Thresholds
export const RATING_UI_DEBOUNCE_MS = 400;
export const ALGORITHMIC_DEBOUNCE_WINDOW_MS = 60 * 1000; // 1 minute window

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

export const PLATFORM_NAMES = DEFAULT_WHITELISTED_WEBSITES.reduce((acc, site) => {
    acc[site.domain] = site.name;
    return acc;
}, {} as Record<string, string>);

export const DEFAULT_PALETTES: Palette[] = [
    { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
    { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
    { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
    { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
    { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
];

// Theme & Highlight Defaults
export const DEFAULT_THEME = 'dark';
export const DEFAULT_HIGHLIGHT_COLOR = '#f1c40f';

export const DEFAULT_EXTENSION_SETTINGS = {
    defaultHighlightColor: DEFAULT_HIGHLIGHT_COLOR,
    recentColors: [DEFAULT_HIGHLIGHT_COLOR, '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
    showMarkerPopup: true,
    showLauncher: true,
    activePaletteIndex: 0,
    palettes: DEFAULT_PALETTES
};

// Notification & Reminder Defaults
export const DEFAULT_NOTIFICATION_SETTINGS = {
    enabled: true,
    frequency: '60',
    priority: '2',
    requireInteraction: true,
    badgeEnabled: true
};

// Pomodoro Timer Defaults
export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4
};

export const DEFAULT_POMODORO_STATS: PomodoroStats = {
    sessionsToday: 0,
    focusMinutesToday: 0,
    lastDate: ''
};

// Navigation Action URL Map
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

// Calendar & Date Constants
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Gamification, Streaks & Daily Goals
export const DEFAULT_DAILY_GOAL = 10;
export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 365];
export const REVIEW_MILESTONES = [50, 100, 250, 500, 1000, 5000];
export const CONFETTI_COLORS = [
    '#a8c7fa', '#f9ab00', '#81c995', '#f28b82',
    '#c58af9', '#4ecdc4', '#ff6b6b', '#ffe66d'
];
export const CONFETTI_PARTICLE_COUNT = 60;

// Quick Search & Filtering Constants
export const SEARCH_DEBOUNCE_MS = 150;
export const SEARCH_MAX_RESULTS = 5;

// Forecast Constants
export const FORECAST_DAYS_TO_SHOW = 30;

// Analytics & Retention Simulation Constants
export const RETENTION_DROP_THRESHOLD = 5;
export const RETENTION_TIME_POINTS = [0, 1, 3, 7, 14, 21, 30];
export const SIMULATION_MAX_DAYS = 180;
export const ANALYTICS_CHART_COLORS = [
    '#a8c7fa', '#81c995', '#fde293', '#f28b82',
    '#c4a8fa', '#8ecae6', '#f4a261', '#e76f51',
    '#90be6d', '#f9c74f', '#43aa8b', '#577590'
];
export const TIME_OF_DAY_BUCKET_NAMES: Record<string, string> = {
    morning: 'Morning (5AM - 12PM)',
    afternoon: 'Afternoon (12PM - 5PM)',
    evening: 'Evening (5PM - 9PM)',
    night: 'Night (9PM - 5AM)'
};

// Logger Buffer Size
export const LOGGER_MAX_BUFFER_SIZE = 1000;

// Markdown Sanitization Options
export const MARKDOWN_PURIFY_OPTIONS = {
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'script', 'iframe', 'object', 'embed', 'style', 'link', 'meta'],
    FORBID_ATTR: ['style']
};

// Backup Records & Checksum Constants
export const VALID_BACKUP_RECORD_TYPES: ReadonlySet<string> = new Set<BackupRecordType>([
    'header', 'page', 'card', 'mark', 'bookmark', 'pagecontent', 'activity', 'weights', 'settings', 'footer'
]);
export const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
export const FNV_PRIME_32 = 0x01000193;

// Firebase Configuration Default
export const DEFAULT_FIREBASE_CONFIG: FirebaseOptions = {
    apiKey: 'AIzaSyDummyKeyForDevelopment1234567890',
    authDomain: 'algorecall-fsrs-dev.firebaseapp.com',
    projectId: 'algorecall-fsrs-dev',
    storageBucket: 'algorecall-fsrs-dev.appspot.com',
    messagingSenderId: '123456789012',
    appId: '1:123456789012:web:abcdef1234567890'
};



