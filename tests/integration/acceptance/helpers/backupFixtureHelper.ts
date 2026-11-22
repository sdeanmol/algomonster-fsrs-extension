/**
 * @file backupFixtureHelper.ts
 * @description Helper for loading, parsing, verifying FNV-1a checksums,
 * and creating synthetic corruptions of the user backup archive.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { Card, HighlightMark, BookmarkItem, WhitelistedWebsite, FSRSParameters } from '../../../../types/domain';
import { Fnv1aHasher } from '@common/data/backupManager';

export interface BackupHeaderRecord {
    version: number;
    timestamp: number;
    counts: {
        pages: number;
        cards: number;
        marks: number;
        bookmarks: number;
        pagecontents: number;
    };
}

export interface BackupPageRecord {
    id: number;
    url: string;
    title: string;
    icon?: string;
}

export interface ParsedBackup {
    header: BackupHeaderRecord;
    pages: BackupPageRecord[];
    cards: Card[];
    marks: HighlightMark[];
    bookmarks: BookmarkItem[];
    pagecontents: Array<{ url?: string; u?: number; description?: string; length?: number }>;
    activity: Record<string, number>;
    weights: Record<string, unknown>;
    settings: {
        extensionSettings?: Record<string, unknown>;
        notificationSettings?: Record<string, unknown>;
        theme?: string;
        fsrsGlobalParams?: FSRSParameters;
        ratingPromptState?: { snoozedUntil: number; status: string };
        dailyGoalTarget?: number | null;
        longestStreak?: number;
        whitelistedWebsites?: WhitelistedWebsite[];
        [key: string]: unknown;
    };
    footer: {
        checksum: string;
        count: number;
    };
    rawLines: string[];
}

const REPO_FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/algo_pro_backup_2026-11-20.json.gz');
const USER_UPLOADED_PATH = '/Users/anmolrastogi/.gemini/antigravity/brain/57728cce-647a-4f81-be56-a429cd46345b/.user_uploaded/media_1795353012141_54d1d515.gz';

/**
 * Retrieves the raw buffer of the reference user backup archive.
 */
export function getBackupBuffer(): Buffer {
    if (fs.existsSync(REPO_FIXTURE_PATH)) {
        return fs.readFileSync(REPO_FIXTURE_PATH);
    }
    if (fs.existsSync(USER_UPLOADED_PATH)) {
        return fs.readFileSync(USER_UPLOADED_PATH);
    }
    throw new Error(`User backup archive not found at ${REPO_FIXTURE_PATH} or ${USER_UPLOADED_PATH}`);
}

/**
 * Computes the 32-bit FNV-1a checksum of a string using the canonical extension hasher.
 */
export function computeFnv1a32(content: string): string {
    const hasher = new Fnv1aHasher();
    hasher.update(content);
    return hasher.digest();
}

/**
 * Parses and reconstructs the Gzip NDJSON backup archive into structured records.
 */
export function parseBackupArchive(buf: Buffer): ParsedBackup {
    const decompressed = zlib.gunzipSync(buf).toString('utf-8');
    const rawLines = decompressed.split('\n').filter(line => line.trim().length > 0);

    let header: BackupHeaderRecord | null = null;
    const pages: BackupPageRecord[] = [];
    const rawCards: Array<Record<string, unknown>> = [];
    const rawMarks: Array<Record<string, unknown>> = [];
    const rawBookmarks: Array<Record<string, unknown>> = [];
    const rawPageContents: Array<{ url?: string; u?: number; description?: string; length?: number }> = [];
    let activity: Record<string, number> = {};
    let weights: Record<string, unknown> = {};
    let settings: ParsedBackup['settings'] = {};
    let footer: { checksum: string; count: number } | null = null;

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const record = JSON.parse(line);
        switch (record.type) {
            case 'header':
                header = record.data;
                break;
            case 'page':
                pages.push(record.data);
                break;
            case 'card':
                rawCards.push(record.data);
                break;
            case 'mark':
                rawMarks.push(record.data);
                break;
            case 'bookmark':
                rawBookmarks.push(record.data);
                break;
            case 'pagecontent':
                rawPageContents.push(record.data);
                break;
            case 'activity':
                activity = record.data;
                break;
            case 'weights':
                weights = record.data;
                break;
            case 'settings':
                settings = record.data;
                break;
            case 'footer':
                footer = record.data;
                break;
        }
    }

    if (!header) {
        throw new Error('Corrupted archive: missing header record');
    }
    if (!footer) {
        throw new Error('Corrupted archive: missing footer record');
    }

    // Reconstruct URL references
    const cards: Card[] = rawCards.map(c => {
        const u = c.u as number | undefined;
        const page = u !== undefined ? pages[u] : undefined;
        const rc = { ...c } as unknown as Card;
        if (page) {
            rc.problemUrl = page.url;
            rc.problemTitle = page.title;
        }
        delete (rc as unknown as Record<string, unknown>).u;
        return rc;
    });

    const marks: HighlightMark[] = rawMarks.map(m => {
        const u = m.u as number | undefined;
        const page = u !== undefined ? pages[u] : undefined;
        const rm = { ...m } as unknown as HighlightMark;
        if (page) {
            rm.url = page.url;
        }
        rm.type = rm.type || 'highlight';
        delete (rm as unknown as Record<string, unknown>).u;
        return rm;
    });

    const bookmarks: BookmarkItem[] = rawBookmarks.map(b => {
        const u = b.u as number | undefined;
        const page = u !== undefined ? pages[u] : undefined;
        const meta = (b.meta ? { ...(b.meta as Record<string, unknown>) } : {}) as Record<string, unknown>;
        if (page && page.icon && !meta.favIconUrl) {
            meta.favIconUrl = page.icon;
        }
        return {
            url: page ? page.url : (b.url as string || ''),
            title: page ? page.title : (b.title as string || ''),
            meta: Object.keys(meta).length > 0 ? meta : undefined
        };
    });

    return {
        header,
        pages,
        cards,
        marks,
        bookmarks,
        pagecontents: rawPageContents,
        activity,
        weights,
        settings,
        footer,
        rawLines
    };
}

/**
 * Creates synthetic corrupted variants of the backup buffer for boundary testing.
 */
export function createCorruptedArchive(type: 'bad-magic' | 'bad-crc' | 'truncated' | 'bad-json' | 'missing-header' | 'missing-footer' | 'bad-checksum'): Buffer {
    const rawBuffer = getBackupBuffer();

    switch (type) {
        case 'bad-magic': {
            const copy = Buffer.from(rawBuffer);
            copy[0] = 0x00;
            copy[1] = 0x00;
            return copy;
        }
        case 'bad-crc': {
            const copy = Buffer.from(rawBuffer);
            // Flip byte in middle of compressed data
            copy[Math.floor(copy.length / 2)] ^= 0xff;
            return copy;
        }
        case 'truncated': {
            // Cut off abruptly mid-archive
            return rawBuffer.subarray(0, Math.min(100, rawBuffer.length));
        }
        case 'bad-json': {
            const decompressed = zlib.gunzipSync(rawBuffer).toString('utf-8');
            const lines = decompressed.split('\n');
            // Inject invalid json syntax at line 5
            lines.splice(5, 0, '{ INVALID_JSON: true, ');
            return zlib.gzipSync(lines.join('\n'));
        }
        case 'missing-header': {
            const decompressed = zlib.gunzipSync(rawBuffer).toString('utf-8');
            const lines = decompressed.split('\n');
            // Drop line 0 (header)
            lines.shift();
            return zlib.gzipSync(lines.join('\n'));
        }
        case 'missing-footer': {
            const decompressed = zlib.gunzipSync(rawBuffer).toString('utf-8');
            const lines = decompressed.split('\n').filter(Boolean);
            // Drop last line (footer)
            lines.pop();
            return zlib.gzipSync(lines.join('\n'));
        }
        case 'bad-checksum': {
            const decompressed = zlib.gunzipSync(rawBuffer).toString('utf-8');
            const lines = decompressed.split('\n').filter(Boolean);
            // Alter a character in line 2
            lines[2] = lines[2] + ' ';
            return zlib.gzipSync(lines.join('\n') + '\n');
        }
        default:
            throw new Error(`Unknown corruption type: ${type}`);
    }
}

/**
 * Creates a browser-compatible mock File object wrapping a Node Buffer.
 */
export function createMockBackupFile(buf: Buffer, name: string = 'algo_pro_backup_2026-11-20.json.gz'): File {
    const mock = {
        name,
        size: buf.length,
        type: 'application/gzip',
        slice: (start: number = 0, end: number = buf.length) => {
            const sub = buf.subarray(start, end);
            return {
                arrayBuffer: async () => {
                    const ab = new ArrayBuffer(sub.length);
                    const view = new Uint8Array(ab);
                    for (let i = 0; i < sub.length; i++) view[i] = sub[i];
                    return ab;
                }
            };
        },
        arrayBuffer: async () => {
            const ab = new ArrayBuffer(buf.length);
            const view = new Uint8Array(ab);
            for (let i = 0; i < buf.length; i++) view[i] = buf[i];
            return ab;
        },
        stream: () => {
            let offset = 0;
            return new ReadableStream({
                pull(controller) {
                    if (offset >= buf.length) {
                        controller.close();
                        return;
                    }
                    const chunk = new Uint8Array(buf.subarray(offset, offset + 16384));
                    offset += chunk.length;
                    controller.enqueue(chunk);
                }
            });
        }
    };
    return mock as unknown as File;
}
