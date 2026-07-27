/**
 * @file features/common/constants.ts
 * @description Centralized domain constants for time calculations, FSRS parameters, and activity thresholds.
 */

// Time conversions in milliseconds
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
