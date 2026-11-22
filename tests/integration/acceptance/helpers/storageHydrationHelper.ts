/**
 * @file storageHydrationHelper.ts
 * @description Manages atomic seeding, snapshots, clearing of chrome.storage.local,
 * and deterministic freezing of system time at baseline 1795353012606.
 */

import { ParsedBackup, getBackupBuffer, parseBackupArchive } from './backupFixtureHelper';
import FsrsScheduler from '@tracker/scheduler/fsrsScheduler';
import { StorageData } from '../../../../types/domain';

export const BASELINE_TIMESTAMP = 1795353012606; // Sunday 2026-11-22T13:10:12.606Z

let cachedFsrsParams: any = parseBackupArchive(getBackupBuffer()).settings.fsrsGlobalParams || null;

export class ParityFsrsScheduler extends FsrsScheduler {
    constructor(params: any = null) {
        super(params || cachedFsrsParams);
    }
}

// Expose FsrsScheduler globally for browser / popup bundle parity
(global as any).FsrsScheduler = ParityFsrsScheduler;
if (typeof window !== 'undefined') {
    (window as any).FsrsScheduler = ParityFsrsScheduler;
}

// Ensure WHATWG streams are polyfilled with real Node stream/web in jsdom
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const streamWeb = require('stream/web');
    if (streamWeb) {
        if (streamWeb.ReadableStream) {
            (global as any).ReadableStream = streamWeb.ReadableStream;
            if (typeof window !== 'undefined') {
                (window as any).ReadableStream = streamWeb.ReadableStream;
            }
        }
        if (streamWeb.WritableStream) {
            (global as any).WritableStream = streamWeb.WritableStream;
            if (typeof window !== 'undefined') {
                (window as any).WritableStream = streamWeb.WritableStream;
            }
        }
        if (streamWeb.TransformStream) {
            (global as any).TransformStream = streamWeb.TransformStream;
            if (typeof window !== 'undefined') {
                (window as any).TransformStream = streamWeb.TransformStream;
            }
        }
        if (streamWeb.DecompressionStream) {
            (global as any).DecompressionStream = streamWeb.DecompressionStream;
            if (typeof window !== 'undefined') {
                (window as any).DecompressionStream = streamWeb.DecompressionStream;
            }
        }
        if (streamWeb.CompressionStream) {
            (global as any).CompressionStream = streamWeb.CompressionStream;
            if (typeof window !== 'undefined') {
                (window as any).CompressionStream = streamWeb.CompressionStream;
            }
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { Response: UndiciResponse } = require('undici');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { Blob: BufferBlob } = require('buffer');

            (global as any).Response = UndiciResponse;
            (global as any).Blob = BufferBlob;
            if (typeof window !== 'undefined') {
                (window as any).Response = UndiciResponse;
                (window as any).Blob = BufferBlob;
            }
        } catch {
            // Stream polyfill fallback
        }
    }
} catch (err) {
    // Stream polyfill fallback
}

/**
 * Freezes system time for Date.now() and new Date() constructor calls.
 * Returns a restoration function to unfreeze.
 */
export function freezeTime(timestampMs: number = BASELINE_TIMESTAMP): () => void {
    const originalDate = global.Date;

    class MockDate extends originalDate {
        constructor(...args: any[]) {
            if (args.length === 0) {
                super(timestampMs);
            } else {
                super(...(args as [any]));
            }
        }
    }

    MockDate.now = () => timestampMs;
    MockDate.UTC = originalDate.UTC;
    MockDate.parse = originalDate.parse;

    (global as any).Date = MockDate;
    if (typeof window !== 'undefined') {
        (window as any).Date = MockDate;
    }
    (global as any).FsrsScheduler = ParityFsrsScheduler;
    if (typeof window !== 'undefined') {
        (window as any).FsrsScheduler = ParityFsrsScheduler;
    }

    return () => {
        (global as any).Date = originalDate;
        if (typeof window !== 'undefined') {
            (window as any).Date = originalDate;
        }
    };
}

/**
 * Seeds chrome.storage.local with the fully parsed and reconstructed backup contents.
 */
export async function seedStorageFromBackup(parsed?: ParsedBackup): Promise<ParsedBackup> {
    const backupData = parsed || parseBackupArchive(getBackupBuffer());
    cachedFsrsParams = backupData.settings.fsrsGlobalParams || null;

    const storagePayload: Record<string, unknown> = {
        fsrsCards: backupData.cards,
        fsrsActivity: backupData.activity,
        fsrsTopicWeights: backupData.weights,
        marks: backupData.marks,
        bookmarks: backupData.bookmarks,
        pagecontents: backupData.pagecontents,
        extensionSettings: backupData.settings.extensionSettings || {},
        notificationSettings: backupData.settings.notificationSettings || {},
        theme: backupData.settings.theme || 'dark',
        fsrsGlobalParams: backupData.settings.fsrsGlobalParams || {},
        ratingPromptState: backupData.settings.ratingPromptState || { snoozedUntil: 0, status: 'rated' },
        dailyGoalTarget: backupData.settings.dailyGoalTarget ?? null,
        longestStreak: backupData.settings.longestStreak ?? 8,
        whitelistedWebsites: backupData.settings.whitelistedWebsites || []
    };

    if (typeof backupData.settings.weeklySummaryEnabled === 'boolean') {
        storagePayload.weeklySummaryEnabled = backupData.settings.weeklySummaryEnabled;
    }

    await chrome.storage.local.set(storagePayload);
    return backupData;
}

/**
 * Clears chrome.storage.local completely.
 */
export async function clearExtensionStorage(): Promise<void> {
    await chrome.storage.local.clear();
}

/**
 * Retrieves a full snapshot of chrome.storage.local.
 */
export async function getStorageSnapshot(): Promise<Record<string, any>> {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
            resolve(items || {});
        });
    });
}
