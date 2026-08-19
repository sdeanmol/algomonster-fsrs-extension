/**
 * @file features/common/constants.ts
 * @description Centralized domain constants for time calculations, FSRS parameters, and activity thresholds.
 */

// Time conversions in milliseconds
import { Palette } from '../../types/domain';

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
    { domain: "algo.monster" },
    { domain: "systemdesignschool.io" },
    { domain: "codeforces.com" },
    { domain: "leetcode.com" },
    { domain: "codechef.com" },
    { domain: "atcoder.jp" },
    { domain: "hackerrank.com" },
    { domain: "hackerearth.com" },
    { domain: "codewars.com" },
    { domain: "codingame.com" }
];

export const DEFAULT_PALETTES: Palette[] = [
    { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
    { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
    { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
    { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
    { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
];

export const DEFAULT_CHROME_SETTINGS = {
    defaultHighlightColor: '#f1c40f',
    recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
    showMarkerPopup: true,
    activePaletteIndex: 0,
    palettes: DEFAULT_PALETTES
};
