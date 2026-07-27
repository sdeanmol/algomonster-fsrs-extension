/**
 * @file types/backup.ts
 * @description Strict TypeScript interfaces for backup management, serialization, and restoration.
 * Inferred from backup schemas (NDJSON / JSON line records).
 */

import { Rating, State } from 'ts-fsrs';
import { ChromeSettings, NotificationSettings, FSRSParameters, WhitelistedWebsite, ReviewLog } from './domain';

/**
 * Line record type discriminators for Backup NDJSON streams.
 */
export type BackupRecordType =
    | 'header'
    | 'page'
    | 'card'
    | 'mark'
    | 'bookmark'
    | 'pagecontent'
    | 'activity'
    | 'weights'
    | 'settings'
    | 'footer';

/**
 * Header record (line 1 of backup NDJSON stream)
 */
export interface BackupHeaderRecord {
    type: 'header';
    data: {
        version: number;
        timestamp: number;
        counts: Record<string, number>;
    };
}

/**
 * Deduplicated URL Page record
 */
export interface PageRecord {
    type: 'page';
    data: {
        id: number;
        url: string;
        title: string;
        icon: string;
    };
}

/**
 * FSRS Card record line.
 * Note: `id` is strictly `string` (accommodating alphanumeric strings as well as numeric timestamp strings).
 * `last_review`, `learning_steps`, and `previousDue` are optional fields.
 */
export interface CardRecordData {
    id: string;
    u?: number;
    problemUrl?: string;
    problemTitle?: string;
    due: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: State | number;
    last_review?: number | null;
    learning_steps?: number;
    previousDue?: number;
    textRead?: string;
    approach?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    tags?: string[];
    historyLog?: ReviewLog[];
    lastRating?: Rating | number;
    [key: string]: unknown;
}

export interface CardRecord {
    type: 'card';
    data: CardRecordData;
}

/**
 * Highlight mark record line
 */
export interface MarkRecordData {
    id: string;
    url?: string;
    u?: number;
    text: string;
    color: string;
    type?: string;
    createdAt: number;
    note?: string;
    category?: string;
    highlightSource?: unknown;
    [key: string]: unknown;
}

export interface MarkRecord {
    type: 'mark';
    data: MarkRecordData;
}

/**
 * Bookmark record line
 */
export interface BookmarkRecordData {
    url?: string;
    title?: string;
    u?: number;
    meta?: {
        favIconUrl?: string;
        [key: string]: unknown;
    };
}

export interface BookmarkRecord {
    type: 'bookmark';
    data: BookmarkRecordData;
}

/**
 * Page content description record line
 */
export interface PageContentRecordData {
    url?: string;
    u?: number;
    description?: string;
    length?: number;
    [key: string]: unknown;
}

export interface PageContentRecord {
    type: 'pagecontent';
    data: PageContentRecordData;
}

/**
 * Activity daily counts record line
 */
export interface ActivityRecord {
    type: 'activity';
    data: Record<string, number>;
}

/**
 * Topic weights map record line
 */
export interface WeightsRecord {
    type: 'weights';
    data: Record<string, number[]>;
}

/**
 * Settings configuration data object inside backup stream
 */
export interface SettingsData {
    chromeSettings?: ChromeSettings;
    notificationSettings?: NotificationSettings;
    theme?: string;
    fsrsGlobalParams?: FSRSParameters | Partial<FSRSParameters> | Record<string, unknown>;
    ratingPromptState?: {
        snoozedUntil?: number;
        status?: string;
    };
    dailyGoalTarget?: number | null;
    longestStreak?: number;
    whitelistedWebsites?: WhitelistedWebsite[];
    [key: string]: unknown;
}

export interface SettingsRecord {
    type: 'settings';
    data: SettingsData;
}

/**
 * Footer checksum record (final line of backup NDJSON stream)
 */
export interface FooterRecord {
    type: 'footer';
    data: {
        checksum: string;
        count: number;
    };
}

/**
 * Discriminated Union of all valid Backup NDJSON line records
 */
export type BackupRecord =
    | BackupHeaderRecord
    | PageRecord
    | CardRecord
    | MarkRecord
    | BookmarkRecord
    | PageContentRecord
    | ActivityRecord
    | WeightsRecord
    | SettingsRecord
    | FooterRecord;
