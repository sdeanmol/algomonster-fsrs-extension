/**
 * @file Strict Data Schemas for NDJSON Stream Backups
 * @module types/backup
 * @context Shared across Extension environments (Background, Dashboard Data Management, Common Backup Services)
 * @description Provides TypeScript interface declarations for line-by-line streaming serialization
 * and deserialization of the extension's user data into NDJSON (Newline Delimited JSON) backup files.
 */

import { Rating, State } from 'ts-fsrs';
import { ExtensionSettings, NotificationSettings, FSRSParameters, WhitelistedWebsite, ReviewLog } from './domain';

/**
 * Line record discriminator identifiers for Backup NDJSON streams.
 * Each valid line in an exported backup begins with a distinct `type` tag.
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
 * Header record appearing strictly as Line 1 of a backup NDJSON stream.
 * Encapsulates format metadata, export timestamp, and expected entity counts.
 */
export interface BackupHeaderRecord {
    /** Record type discriminator */
    type: 'header';
    /** Metadata payload describing the backup stream */
    data: {
        /** Backup format schema version number */
        version: number;
        /** Unix epoch timestamp (milliseconds) when the backup was generated */
        timestamp: number;
        /** Entity count summary map keyed by record type name */
        counts: Record<string, number>;
    };
}

/**
 * Deduplicated URL and page metadata record within an NDJSON backup stream.
 */
export interface PageRecord {
    /** Record type discriminator */
    type: 'page';
    /** Page information payload */
    data: {
        /** Numeric surrogate key used for referencing pages in subsequent card/mark records */
        id: number;
        /** Target canonical page URL */
        url: string;
        /** Problem or page title */
        title: string;
        /** Favicon URL or base64 representation */
        icon: string;
    };
}

/**
 * Serialized representation of an individual FSRS Card in an NDJSON backup line.
 * Accommodates alphanumeric IDs as well as numeric timestamps.
 */
export interface CardRecordData {
    /** Unique problem or card identifier */
    id: string;
    /** Surrogate numeric reference to a preceding `PageRecord` ID */
    u?: number;
    /** Canonical problem URL */
    problemUrl?: string;
    /** Algorithmic problem title */
    problemTitle?: string;
    /** Next due date as a Unix timestamp (milliseconds) */
    due: number;
    /** FSRS memory stability in days */
    stability: number;
    /** FSRS difficulty rating on a 1-10 scale */
    difficulty: number;
    /** Days elapsed between last review and this scheduled repetition */
    elapsed_days: number;
    /** Days scheduled for the upcoming review interval */
    scheduled_days: number;
    /** Total number of successful repetitions performed */
    reps: number;
    /** Total number of memory lapses experienced */
    lapses: number;
    /** Current card state: New(0), Learning(1), Review(2), Relearning(3) */
    state: State | number;
    /** Unix timestamp (milliseconds) of the last review, or null/omitted if new */
    last_review?: number | null;
    /** Learning step index within short-term scheduling */
    learning_steps?: number;
    /** Due timestamp prior to the most recent review */
    previousDue?: number;
    /** User's markdown study notes or editorial review summary */
    textRead?: string;
    /** Explanation of the algorithmic approach or solution pattern */
    approach?: string;
    /** Big-O time complexity annotation (e.g. "O(N log N)") */
    timeComplexity?: string;
    /** Big-O space complexity annotation (e.g. "O(1)") */
    spaceComplexity?: string;
    /** Categorical tags assigned to the problem */
    tags?: string[];
    /** Chronological review history log */
    historyLog?: ReviewLog[];
    /** Last submitted user assessment rating (1-4) */
    lastRating?: Rating | number;
    /** Extensible metadata */
    [key: string]: unknown;
}

/**
 * Line record containing a single serialized FSRS card.
 */
export interface CardRecord {
    /** Record type discriminator */
    type: 'card';
    /** Serialized card payload */
    data: CardRecordData;
}

/**
 * Serialized representation of a webpage text highlight mark in a backup line.
 */
export interface MarkRecordData {
    /** Unique highlight mark identifier */
    id: string;
    /** Target webpage URL */
    url?: string;
    /** Surrogate reference to a preceding `PageRecord` ID */
    u?: number;
    /** Highlighted text snippet content */
    text: string;
    /** Background hex color code used for styling */
    color: string;
    /** Category or classification type of the highlight */
    type?: string;
    /** Creation timestamp in Unix epoch milliseconds */
    createdAt: number;
    /** User-annotated comment or note */
    note?: string;
    /** Classification folder or tag */
    category?: string;
    /** Anchor metadata for restoring selection boundaries */
    highlightSource?: unknown;
    /** Extensible attributes */
    [key: string]: unknown;
}

/**
 * Line record containing a single serialized highlight mark.
 */
export interface MarkRecord {
    /** Record type discriminator */
    type: 'mark';
    /** Highlight mark data payload */
    data: MarkRecordData;
}

/**
 * Serialized bookmark metadata payload in a backup line.
 */
export interface BookmarkRecordData {
    /** Destination URL */
    url?: string;
    /** Saved bookmark title */
    title?: string;
    /** Surrogate reference to a preceding `PageRecord` ID */
    u?: number;
    /** Associated bookmark metadata */
    meta?: {
        /** Favicon URL of the bookmarked site */
        favIconUrl?: string;
        /** Additional meta properties */
        [key: string]: unknown;
    };
}

/**
 * Line record containing a saved problem/page bookmark.
 */
export interface BookmarkRecord {
    /** Record type discriminator */
    type: 'bookmark';
    /** Bookmark data payload */
    data: BookmarkRecordData;
}

/**
 * Serialized summary or extracted text description of a problem webpage.
 */
export interface PageContentRecordData {
    /** Page URL */
    url?: string;
    /** Surrogate reference to a preceding `PageRecord` ID */
    u?: number;
    /** Extracted problem text description or overview */
    description?: string;
    /** Character length of the description */
    length?: number;
    /** Extensible fields */
    [key: string]: unknown;
}

/**
 * Line record containing extracted page content or description cache.
 */
export interface PageContentRecord {
    /** Record type discriminator */
    type: 'pagecontent';
    /** Page content payload */
    data: PageContentRecordData;
}

/**
 * Line record containing daily user activity counts ("YYYY-MM-DD" -> count).
 */
export interface ActivityRecord {
    /** Record type discriminator */
    type: 'activity';
    /** Activity map of dates to review completion numbers */
    data: Record<string, number>;
}

/**
 * Line record containing topic-specific custom FSRS weight arrays.
 */
export interface WeightsRecord {
    /** Record type discriminator */
    type: 'weights';
    /** Map of topic identifiers to custom FSRS algorithm weight vectors */
    data: Record<string, number[]>;
}

/**
 * Serialized user configuration object inside an NDJSON backup stream.
 */
export interface SettingsData {
    /** Visual appearance, highlighter palette, and UI display settings */
    extensionSettings?: ExtensionSettings;
    /** Notification timing, quiet hours, and badge display settings */
    notificationSettings?: NotificationSettings;
    /** Active theme name */
    theme?: string;
    /** Global customized FSRS algorithm parameters */
    fsrsGlobalParams?: FSRSParameters | Partial<FSRSParameters> | Record<string, unknown>;
    /** Review prompt snoozing state */
    ratingPromptState?: {
        /** Unix timestamp (milliseconds) until which rating prompts are snoozed */
        snoozedUntil?: number;
        /** Prompt status string */
        status?: string;
    };
    /** Target daily problem review count */
    dailyGoalTarget?: number | null;
    /** Longest recorded consecutive study streak in days */
    longestStreak?: number;
    /** Array of user-whitelisted domains */
    whitelistedWebsites?: WhitelistedWebsite[];
    /** Extensible configuration parameters */
    [key: string]: unknown;
}

/**
 * Line record containing user settings and preferences.
 */
export interface SettingsRecord {
    /** Record type discriminator */
    type: 'settings';
    /** User settings payload */
    data: SettingsData;
}

/**
 * Footer record appearing strictly as the final line of a backup NDJSON stream.
 * Encapsulates the stream integrity verification checksum and line count.
 */
export interface FooterRecord {
    /** Record type discriminator */
    type: 'footer';
    /** Footer verification payload */
    data: {
        /** Cryptographic or algebraic checksum of preceding records */
        checksum: string;
        /** Total line count of preceding records in the stream */
        count: number;
    };
}

/**
 * Discriminated union of all supported line record structures in an NDJSON backup stream.
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
