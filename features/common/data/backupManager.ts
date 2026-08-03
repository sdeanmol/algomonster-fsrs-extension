/**
 * @file features/common/data/backupManager.ts
 * @description Highly optimized backup and restoration manager for AlgoRecall.
 * Implements a Gzip-compressed, URL-deduplicated JSON Lines (JSONL) format with streaming parser.
 */
import { Logger } from '@common/logger';
import { ensureCardIds } from '../utils/cardUtils';
import { Card, StorageData, UserSettings, WhitelistedWebsite, HighlightMark, BookmarkItem } from '../../../types/domain';
import {
    BackupRecord,
    BackupRecordType,
    BackupHeaderRecord,
    PageRecord,
    CardRecordData,
    MarkRecordData,
    BookmarkRecordData,
    PageContentRecordData,
    SettingsData,
    FooterRecord
} from '../../../types/backup';

export type BackupPageData = PageRecord['data'];
export type BackupCardData = CardRecordData;
export type BackupBookmarkData = BookmarkRecordData;
export type BackupMarkData = MarkRecordData;
export type BackupPageContentData = PageContentRecordData;
export type BackupCounts = BackupHeaderRecord['data']['counts'];
export type BackupHeader = BackupHeaderRecord;
export type BackupFooter = FooterRecord;
export type BackupLine = BackupRecord;

const VALID_RECORD_TYPES: ReadonlySet<string> = new Set<BackupRecordType>([
    'header',
    'page',
    'card',
    'mark',
    'bookmark',
    'pagecontent',
    'activity',
    'weights',
    'settings',
    'footer'
]);

/**
 * Validates whether a parsed JSON object is a conforming BackupRecord line.
 */
export function isValidBackupRecord(parsed: unknown): parsed is BackupRecord {
    try {
        if (typeof parsed !== 'object' || parsed === null) return false;
        const rec = parsed as { type?: unknown; data?: unknown };
        if (typeof rec.type !== 'string' || !VALID_RECORD_TYPES.has(rec.type as BackupRecordType)) {
            return false;
        }
        return typeof rec.data === 'object' && rec.data !== null;
    } catch (err) {
        // Comment: Recover gracefully with false if property access throws
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.warn('Backup', `Validation error in isValidBackupRecord: ${errorMessage}`, { err });
        return false;
    }
}

/**
 * Incremental 32-bit FNV-1a Hasher for integrity verification.
 */
export class Fnv1aHasher {
    hash: number;

    constructor() {
        this.hash = 0x811c9dc5;
    }

    /**
     * Feed a string into the hasher.
     */
    update(str: string): void {
        try {
            for (let i = 0; i < str.length; i++) {
                this.hash ^= str.charCodeAt(i);
                this.hash = (this.hash * 0x01000193) >>> 0;
            }
        } catch (err) {
            // Comment: Catch hasher string update error
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Backup', `Fnv1aHasher update failed: ${errorMessage}`, { err });
        }
    }

    /**
     * Retrieve the final hex checksum digest.
     */
    digest(): string {
        try {
            return this.hash.toString(16).padStart(8, '0');
        } catch (err) {
            // Comment: Return default empty digest on formatting error
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Backup', `Fnv1aHasher digest failed: ${errorMessage}`, { err });
            return '00000000';
        }
    }
}

/**
 * Generator helper to read line-by-line from a stream of bytes.
 */
export async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, unknown> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
        reader = stream.getReader();
        const decoder = new TextDecoder("utf-8");
        let { value, done } = await reader.read();
        let buffer = "";
        while (!done) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // keep last incomplete line in buffer
            for (const line of lines) {
                yield line;
            }
            ({ value, done } = await reader.read());
        }
        buffer += decoder.decode(); // flush remaining
        if (buffer) {
            yield buffer;
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Backup', `Error reading line stream: ${errorMessage}`, { err });
        // Comment: Re-throw stream read error so stream consumers are notified of stream failure
        throw err;
    } finally {
        // Comment: Release stream reader lock when line generator finishes or errors
        try {
            if (reader) {
                reader.releaseLock();
            }
        } catch {
            // Ignore releaseLock error if stream was already closed
        }
    }
}

export class BackupManager {
    /**
     * Exports all user data into a compressed, deduplicated backup file.
     * Yields output chunks using a ReadableStream and triggers a download.
     */
    static async exportBackup(): Promise<void> {
        Logger.time('Backup', 'exportBackup');
        Logger.info('Backup', 'Starting backup export process...');
        try {
            const raw = (await chrome.storage.local.get(null)) as StorageData & {
                marks?: BackupMarkData[];
                bookmarks?: BackupBookmarkData[];
                pagecontents?: BackupPageContentData[];
                ratingPromptState?: unknown;
                dailyGoalTarget?: number | null;
                longestStreak?: number;
            };

            // Extract and deduplicate URLs across bookmarks, cards, marks, pagecontents
            const pages: BackupPageData[] = [];
            const urlToPageId = new Map<string, number>();

            const getOrCreatePageId = (url: string | undefined, title: string = '', icon: string = ''): number | null => {
                if (!url) return null;
                let id = urlToPageId.get(url);
                if (id === undefined) {
                    id = pages.length;
                    urlToPageId.set(url, id);
                    pages.push({ id, url, title, icon });
                } else {
                    if (title && !pages[id].title) pages[id].title = title;
                    if (icon && !pages[id].icon) pages[id].icon = icon;
                }
                return id;
            };

            // Populate URLs from bookmarks
            for (const b of raw.bookmarks || []) {
                getOrCreatePageId(b.url, b.title, b.meta?.favIconUrl);
            }

            // Populate URLs from FSRS cards
            for (const c of raw.fsrsCards || []) {
                getOrCreatePageId(c.problemUrl, c.problemTitle);
            }

            // Populate URLs from marks
            for (const m of raw.marks || []) {
                getOrCreatePageId(m.url);
            }

            // Populate URLs from pagecontents
            for (const pc of raw.pagecontents || []) {
                getOrCreatePageId(pc.url);
            }

            // Generate deduplicated structures
            const dupBookmarks: BackupBookmarkData[] = (raw.bookmarks || []).map((b) => ({
                u: b.url ? (urlToPageId.get(b.url) ?? undefined) : undefined,
                meta: (b.meta as { favIconUrl?: string;[key: string]: unknown }) || undefined
            }));

            const dupCards: BackupCardData[] = (raw.fsrsCards || []).map((c) => {
                const copy: BackupCardData = { ...(c as unknown as BackupCardData) };
                if (c.problemUrl) copy.u = urlToPageId.get(c.problemUrl) ?? undefined;
                delete copy.problemUrl;
                delete copy.problemTitle;
                return copy;
            });

            const dupMarks: BackupMarkData[] = (raw.marks || []).map((m) => {
                const copy: BackupMarkData = { ...m };
                if (m.url) copy.u = urlToPageId.get(m.url) ?? undefined;
                delete copy.url;
                return copy;
            });

            const dupPageContents: BackupPageContentData[] = (raw.pagecontents || []).map((pc) => {
                const copy: BackupPageContentData = { ...pc };
                if (pc.url) copy.u = urlToPageId.get(pc.url) ?? undefined;
                delete copy.url;
                return copy;
            });

            // Generator yielding each serialized line
            function* generateLines(): Generator<string, void, unknown> {
                const header: BackupHeaderRecord = {
                    type: "header",
                    data: {
                        version: 2,
                        timestamp: Date.now(),
                        counts: {
                            pages: pages.length,
                            cards: dupCards.length,
                            marks: dupMarks.length,
                            bookmarks: dupBookmarks.length,
                            pagecontents: dupPageContents.length
                        }
                    }
                };
                yield JSON.stringify(header);

                for (const p of pages) {
                    yield JSON.stringify({ type: "page", data: p });
                }
                for (const c of dupCards) {
                    yield JSON.stringify({ type: "card", data: c });
                }
                for (const m of dupMarks) {
                    yield JSON.stringify({ type: "mark", data: m });
                }
                for (const b of dupBookmarks) {
                    yield JSON.stringify({ type: "bookmark", data: b });
                }
                for (const pc of dupPageContents) {
                    yield JSON.stringify({ type: "pagecontent", data: pc });
                }

                if (raw.fsrsActivity) {
                    yield JSON.stringify({ type: "activity", data: raw.fsrsActivity });
                }

                if (raw.fsrsTopicWeights) {
                    yield JSON.stringify({ type: "weights", data: raw.fsrsTopicWeights });
                }

                // Export general user preferences and statistics
                const settings: SettingsData = {
                    chromeSettings: raw.chromeSettings || {},
                    notificationSettings: raw.notificationSettings || {},
                    theme: raw.theme || 'dark',
                    fsrsGlobalParams: raw.fsrsGlobalParams || {},
                    ratingPromptState: raw.ratingPromptState as { snoozedUntil?: number; status?: string } || {},
                    dailyGoalTarget: raw.dailyGoalTarget || null,
                    longestStreak: raw.longestStreak || 0
                };
                if (raw.whitelistedWebsites !== undefined) {
                    settings.whitelistedWebsites = raw.whitelistedWebsites;
                }
                yield JSON.stringify({ type: "settings", data: settings });
            }

            const lineGenerator = generateLines();
            const hasher = new Fnv1aHasher();
            const encoder = new TextEncoder();
            let totalCount = 0;

            const stream = new ReadableStream({
                pull(controller) {
                    try {
                        const { value, done } = lineGenerator.next();
                        if (done) {
                            const checksum = hasher.digest();
                            const footerLine = JSON.stringify({ type: "footer", data: { checksum, count: totalCount } });
                            controller.enqueue(encoder.encode(footerLine + "\n"));
                            controller.close();
                            return;
                        }

                        const lineWithNewline = value + "\n";
                        hasher.update(lineWithNewline);
                        totalCount++;

                        controller.enqueue(encoder.encode(lineWithNewline));
                    } catch (pullErr) {
                        // Comment: Abort stream controller on line generation error
                        const errorMessage = pullErr instanceof Error ? pullErr.message : String(pullErr);
                        Logger.error('Backup', `Error in export stream pull: ${errorMessage}`, { pullErr });
                        controller.error(pullErr);
                    }
                }
            });

            // Native Compression Stream
            const windowWithCompression = window as unknown as { CompressionStream: new (format: string) => TransformStream };
            const compressedStream = stream.pipeThrough(new windowWithCompression.CompressionStream('gzip'));
            const response = new Response(compressedStream, {
                headers: { 'Content-Type': 'application/gzip' }
            });
            const rawBlob = await response.blob();
            const blob = new Blob([rawBlob], { type: 'application/gzip' });
            const blobUrl = URL.createObjectURL(blob);

            const filename = `algo_pro_backup_${new Date().toISOString().split('T')[0]}.json.gz`;
            chrome.downloads.download({
                url: blobUrl,
                filename: filename,
                saveAs: true
            });
            Logger.info('Backup', `Backup export completed successfully. Download started for ${filename}.`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Backup', `Backup export failed: ${errorMessage}`, { err });
            // Comment: Re-throw export error so calling UI component can show error notification
            throw err;
        } finally {
            // Comment: Always end exportBackup performance timer regardless of success or failure
            Logger.timeEnd('Backup', 'exportBackup');
        }
    }

    /**
     * Exports all user data into a Gzip-compressed byte array (Uint8Array).
     */
    static async exportDataGzip(): Promise<Uint8Array> {
        const raw = (await chrome.storage.local.get(null)) as StorageData & {
            marks?: BackupMarkData[];
            bookmarks?: BackupBookmarkData[];
            pagecontents?: BackupPageContentData[];
            ratingPromptState?: unknown;
            dailyGoalTarget?: number | null;
            longestStreak?: number;
        };

        const pages: BackupPageData[] = [];
        const urlToPageId = new Map<string, number>();

        const getOrCreatePageId = (url: string | undefined, title: string = '', icon: string = ''): number | null => {
            if (!url) return null;
            let id = urlToPageId.get(url);
            if (id === undefined) {
                id = pages.length;
                urlToPageId.set(url, id);
                pages.push({ id, url, title, icon });
            } else {
                if (title && !pages[id].title) pages[id].title = title;
                if (icon && !pages[id].icon) pages[id].icon = icon;
            }
            return id;
        };

        for (const b of raw.bookmarks || []) getOrCreatePageId(b.url, b.title, b.meta?.favIconUrl);
        for (const c of raw.fsrsCards || []) getOrCreatePageId(c.problemUrl, c.problemTitle);
        for (const m of raw.marks || []) getOrCreatePageId(m.url);
        for (const pc of raw.pagecontents || []) getOrCreatePageId(pc.url);

        const dupBookmarks: BackupBookmarkData[] = (raw.bookmarks || []).map((b) => ({
            u: b.url ? (urlToPageId.get(b.url) ?? undefined) : undefined,
            meta: (b.meta as { favIconUrl?: string; [key: string]: unknown }) || undefined
        }));

        const dupCards: BackupCardData[] = (raw.fsrsCards || []).map((c) => {
            const copy: BackupCardData = { ...(c as unknown as BackupCardData) };
            if (c.problemUrl) copy.u = urlToPageId.get(c.problemUrl) ?? undefined;
            delete copy.problemUrl;
            delete copy.problemTitle;
            return copy;
        });

        const dupMarks: BackupMarkData[] = (raw.marks || []).map((m) => {
            const copy: BackupMarkData = { ...m };
            if (m.url) copy.u = urlToPageId.get(m.url) ?? undefined;
            delete copy.url;
            return copy;
        });

        const dupPageContents: BackupPageContentData[] = (raw.pagecontents || []).map((pc) => {
            const copy: BackupPageContentData = { ...pc };
            if (pc.url) copy.u = urlToPageId.get(pc.url) ?? undefined;
            delete copy.url;
            return copy;
        });

        function* generateLines(): Generator<string, void, unknown> {
            const header: BackupHeaderRecord = {
                type: "header",
                data: {
                    version: 2,
                    timestamp: Date.now(),
                    counts: {
                        pages: pages.length,
                        cards: dupCards.length,
                        marks: dupMarks.length,
                        bookmarks: dupBookmarks.length,
                        pagecontents: dupPageContents.length
                    }
                }
            };
            yield JSON.stringify(header);

            for (const p of pages) yield JSON.stringify({ type: "page", data: p });
            for (const c of dupCards) yield JSON.stringify({ type: "card", data: c });
            for (const m of dupMarks) yield JSON.stringify({ type: "mark", data: m });
            for (const b of dupBookmarks) yield JSON.stringify({ type: "bookmark", data: b });
            for (const pc of dupPageContents) yield JSON.stringify({ type: "pagecontent", data: pc });

            if (raw.fsrsActivity) yield JSON.stringify({ type: "activity", data: raw.fsrsActivity });
            if (raw.fsrsTopicWeights) yield JSON.stringify({ type: "weights", data: raw.fsrsTopicWeights });

            const settings: SettingsData = {
                chromeSettings: raw.chromeSettings || {},
                notificationSettings: raw.notificationSettings || {},
                theme: raw.theme || 'dark',
                fsrsGlobalParams: raw.fsrsGlobalParams || {},
                ratingPromptState: raw.ratingPromptState as { snoozedUntil?: number; status?: string } || {},
                dailyGoalTarget: raw.dailyGoalTarget || null,
                longestStreak: raw.longestStreak || 0
            };
            if (raw.whitelistedWebsites !== undefined) {
                settings.whitelistedWebsites = raw.whitelistedWebsites;
            }
            yield JSON.stringify({ type: "settings", data: settings });
        }

        const lineGenerator = generateLines();
        const hasher = new Fnv1aHasher();
        const encoder = new TextEncoder();
        let totalCount = 0;

        const stream = new ReadableStream({
            pull(controller) {
                try {
                    const { value, done } = lineGenerator.next();
                    if (done) {
                        const checksum = hasher.digest();
                        const footerLine = JSON.stringify({ type: "footer", data: { checksum, count: totalCount } });
                        controller.enqueue(encoder.encode(footerLine + "\n"));
                        controller.close();
                        return;
                    }

                    const lineWithNewline = value + "\n";
                    hasher.update(lineWithNewline);
                    totalCount++;

                    controller.enqueue(encoder.encode(lineWithNewline));
                } catch (pullErr) {
                    controller.error(pullErr);
                }
            }
        });

        const windowWithCompression = (typeof window !== 'undefined' ? window : self) as unknown as { CompressionStream: new (format: string) => TransformStream };
        const compressedStream = stream.pipeThrough(new windowWithCompression.CompressionStream('gzip'));
        const response = new Response(compressedStream, {
            headers: { 'Content-Type': 'application/gzip' }
        });
        const rawBuffer = await response.arrayBuffer();
        return new Uint8Array(rawBuffer);
    }

    /**
     * Imports a backup file. Auto-detects Gzip/Text, performs schema version checks,
     * validates checksum, and hydrates local storage atomically.
     */
    static async importBackup(file: File, onStatus: (msg: string, isError?: boolean) => void): Promise<void> {
        Logger.time('Backup', 'importBackup');
        Logger.info('Backup', `Starting backup import from file: ${file.name} (${file.size} bytes)`);
        try {
            // 1. Detect format using magic bytes
            const headerBuffer = await file.slice(0, 2).arrayBuffer();
            const bytes = new Uint8Array(headerBuffer);
            const isGzip = (bytes[0] === 0x1f && bytes[1] === 0x8b);
            const isLegacy = !isGzip && (bytes[0] === 0x7b || bytes[0] === 0x5b); // '{' or '['

            if (isLegacy) {
                onStatus("Parsing legacy backup file...");
                await this.importLegacy(file, onStatus);
                return;
            }

            // 2. Perform fast pre-pass validation to check integrity (only for V2 backups)
            let prePassResult: { isV2: boolean; header?: BackupHeaderRecord; counts?: BackupCounts };
            try {
                prePassResult = await this.validateStream(file, isGzip);
            } catch (err) {
                const errorObj = err instanceof Error ? err : new Error(String(err));
                Logger.error('Backup', `Integrity/Checksum error during pre-pass validation: ${errorObj.message}`, { err: errorObj });
                onStatus(errorObj.message, true);
                return;
            }

            if (!prePassResult.isV2) {
                onStatus("Corrupted file format", true);
                return;
            }

            onStatus("Pre-pass validated! Restoring data...");

            // 3. Reconstruct tables from lines in the second pass
            let stream: ReadableStream = file.stream();
            if (isGzip) {
                const windowWithDecompression = window as unknown as { DecompressionStream: new (format: string) => TransformStream };
                stream = stream.pipeThrough(new windowWithDecompression.DecompressionStream('gzip'));
            }

            const pages: BackupPageData[] = [];
            const cards: BackupCardData[] = [];
            const marks: BackupMarkData[] = [];
            const bookmarks: BackupBookmarkData[] = [];
            const pagecontents: BackupPageContentData[] = [];
            let activity: Record<string, number> = {};
            let weights: Record<string, number[]> = {};
            let settings: SettingsData = {};

            const linesIterable = readLines(stream);
            for await (const line of linesIterable) {
                if (!line.trim()) continue;
                let parsed: unknown;
                try {
                    parsed = JSON.parse(line);
                } catch {
                    throw new Error("Corrupted file: Invalid JSON line format");
                }

                if (!isValidBackupRecord(parsed)) {
                    throw new Error("Corrupted file: Misformed or unknown backup line record type");
                }

                switch (parsed.type) {
                    case "page":
                        if (parsed.data.id !== undefined) pages[parsed.data.id] = parsed.data;
                        break;
                    case "card":
                        cards.push(parsed.data);
                        break;
                    case "mark":
                        marks.push(parsed.data);
                        break;
                    case "bookmark":
                        bookmarks.push(parsed.data);
                        break;
                    case "pagecontent":
                        pagecontents.push(parsed.data);
                        break;
                    case "activity":
                        activity = parsed.data;
                        break;
                    case "weights":
                        weights = parsed.data;
                        break;
                    case "settings":
                        settings = parsed.data;
                        break;
                    case "header":
                    case "footer":
                        break;
                }
            }

            // Reconstruct URL references
            const reconstructedCards: Card[] = cards.map(c => {
                const page = c.u !== undefined ? pages[c.u] : undefined;
                if (!page) return c as unknown as Card;
                const rc: Card = { ...(c as unknown as Card) };
                rc.problemUrl = page.url;
                rc.problemTitle = page.title;
                delete (rc as unknown as BackupCardData).u;
                return rc;
            });
            ensureCardIds(reconstructedCards);

            const reconstructedBookmarks = bookmarks.map(b => {
                const page = b.u !== undefined ? pages[b.u] : undefined;
                if (!page) return b;
                return {
                    url: page.url,
                    title: page.title,
                    meta: b.meta || { favIconUrl: page.icon }
                };
            });

            const reconstructedMarks = marks.map(m => {
                const page = m.u !== undefined ? pages[m.u] : undefined;
                if (!page) return m;
                const rm = { ...m };
                rm.url = page.url;
                delete rm.u;
                rm.type = rm.type || 'highlight';
                return rm;
            });

            const reconstructedPageContents = pagecontents.map(pc => {
                const page = pc.u !== undefined ? pages[pc.u] : undefined;
                if (!page) return pc;
                const rpc = { ...pc };
                rpc.url = page.url;
                delete rpc.u;
                return rpc;
            });

            // Hydrate local storage atomically
            const storageUpdate: StorageData & Record<string, unknown> = {
                fsrsCards: reconstructedCards,
                fsrsActivity: activity,
                fsrsTopicWeights: weights,
                marks: reconstructedMarks as unknown as HighlightMark[],
                bookmarks: reconstructedBookmarks as unknown as BookmarkItem[],
                pagecontents: reconstructedPageContents,
                chromeSettings: settings.chromeSettings || {},
                notificationSettings: settings.notificationSettings || {},
                theme: (settings.theme as 'dark' | 'light') || 'dark',
                fsrsGlobalParams: settings.fsrsGlobalParams || {},
                ratingPromptState: settings.ratingPromptState || {},
                dailyGoalTarget: (settings.dailyGoalTarget as number | null) || null,
                longestStreak: (settings.longestStreak as number) || 0
            };

            if (settings.whitelistedWebsites && Array.isArray(settings.whitelistedWebsites) && settings.whitelistedWebsites.length > 0) {
                storageUpdate.whitelistedWebsites = settings.whitelistedWebsites as WhitelistedWebsite[];
            } else {
                await chrome.storage.local.remove('whitelistedWebsites');
            }

            await chrome.storage.local.set(storageUpdate);
            onStatus("Backup restored successfully!");
            Logger.info('Backup', 'Backup restored successfully!');
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            Logger.error('Backup', `Backup restoration failed: ${errorObj.message}`, { err: errorObj });
            onStatus("Restoration failed: " + errorObj.message, true);
        } finally {
            // Comment: Always end importBackup performance timer regardless of outcome
            Logger.timeEnd('Backup', 'importBackup');
        }
    }

    /**
     * Reads through the backup file stream without executing database writes,
     * ensuring formatting constraints and the checksum match.
     */
    static async validateStream(file: File, isGzip: boolean): Promise<{ isV2: boolean; header?: BackupHeaderRecord; counts?: BackupCounts }> {
        try {
            let stream: ReadableStream = file.stream();
            if (isGzip) {
                const windowWithDecompression = window as unknown as { DecompressionStream: new (format: string) => TransformStream };
                stream = stream.pipeThrough(new windowWithDecompression.DecompressionStream('gzip'));
            }

            const hasher = new Fnv1aHasher();
            let lineCount = 0;
            let header: BackupHeaderRecord | null = null;
            let footer: FooterRecord | null = null;

            const linesIterable = readLines(stream);
            for await (const line of linesIterable) {
                if (!line.trim()) continue;

                let parsed: unknown;
                try {
                    parsed = JSON.parse(line);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Backup', `JSON parse error in validateStream line ${lineCount + 1}: ${errorMessage}`, { lineContent: line, lineCount, err });
                    // If it fails on the first line, it's definitely not V2 JSONL
                    if (lineCount === 0) {
                        return { isV2: false };
                    }
                    // Comment: Re-throw validation error to abort corrupted backup validation
                    throw new Error(`Corrupted file: Invalid JSON structure at line ${lineCount + 1}`);
                }

                if (!isValidBackupRecord(parsed)) {
                    if (lineCount === 0) {
                        return { isV2: false };
                    }
                    Logger.error('Backup', `Misformed line record in validateStream line ${lineCount + 1}`, { parsed, lineCount });
                    // Comment: Re-throw validation error for misformed backup record type
                    throw new Error(`Corrupted file: Misformed line record at line ${lineCount + 1}`);
                }

                if (parsed.type === "header") {
                    if (lineCount !== 0) {
                        Logger.error('Backup', 'Misplaced header record in backup file', { lineCount });
                        // Comment: Re-throw error for misplaced header record
                        throw new Error("Corrupted file: Backup header misplaced");
                    }
                    header = parsed;
                    const lineWithNewline = line + "\n";
                    hasher.update(lineWithNewline);
                } else if (parsed.type === "footer") {
                    footer = parsed;
                    break;
                } else {
                    const lineWithNewline = line + "\n";
                    hasher.update(lineWithNewline);
                }
                lineCount++;
            }

            if (!header) {
                return { isV2: false };
            }

            if (!footer) {
                throw new Error("Corrupted file: Missing checksum integrity footer");
            }

            const calculatedChecksum = hasher.digest();
            if (calculatedChecksum !== footer.data.checksum) {
                throw new Error(`Integrity check failed: Checksum mismatch (expected ${footer.data.checksum}, calculated ${calculatedChecksum})`);
            }

            return { isV2: true, header, counts: header.data.counts };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Backup', `Error during validateStream: ${errorMessage}`, { err });
            // Comment: Re-throw stream validation exception to notify importer caller
            throw err;
        }
    }

    /**
     * Handles legacy JSON formatting structure and migrates it successfully to local storage.
     */
    static importLegacy(file: File, onStatus: (msg: string, isError?: boolean) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () => {
                const errorMsg = reader.error ? reader.error.message : 'File read error';
                Logger.error('Backup', `FileReader error during legacy import: ${errorMsg}`, { error: reader.error });
                onStatus("Failed to read legacy backup file: " + errorMsg, true);
                reject(new Error(errorMsg));
            };

            reader.onload = async (event: ProgressEvent<FileReader>) => {
                try {
                    const text = event.target?.result as string;
                    const imported = JSON.parse(text) as {
                        cards?: Card[];
                        activity?: Record<string, number>;
                        weights?: Record<string, number[]>;
                        marks?: BackupMarkData[];
                        bookmarks?: BackupBookmarkData[];
                        pagecontents?: BackupPageContentData[];
                        chromeSettings?: Record<string, unknown>;
                        notificationSettings?: Record<string, unknown>;
                        theme?: 'dark' | 'light';
                        whitelistedWebsites?: WhitelistedWebsite[];
                        fsrsGlobalParams?: Record<string, unknown>;
                        ratingPromptState?: Record<string, unknown>;
                        dailyGoalTarget?: number | null;
                        longestStreak?: number;
                    } | Card[];

                    let rawImportedCards: Card[] = [];
                    if (Array.isArray(imported)) {
                        rawImportedCards = imported;
                    } else if (imported.cards && Array.isArray(imported.cards)) {
                        rawImportedCards = imported.cards;
                    }

                    ensureCardIds(rawImportedCards);

                    const storageUpdate: StorageData & Record<string, unknown> = {
                        fsrsCards: rawImportedCards,
                        fsrsActivity: Array.isArray(imported) ? {} : (imported.activity || {}),
                        fsrsTopicWeights: Array.isArray(imported) ? {} : (imported.weights || {})
                    };

                    if (!Array.isArray(imported)) {
                        if (imported.marks) {
                            storageUpdate.marks = (imported.marks as unknown as HighlightMark[]).map((m) => {
                                m.type = m.type || 'highlight';
                                return m;
                            });
                        }
                        if (imported.bookmarks) storageUpdate.bookmarks = imported.bookmarks as unknown as BookmarkItem[];
                        if (imported.pagecontents) storageUpdate.pagecontents = imported.pagecontents;
                        if (imported.chromeSettings) storageUpdate.chromeSettings = imported.chromeSettings;
                        if (imported.notificationSettings) storageUpdate.notificationSettings = imported.notificationSettings;

                        if (imported.theme) storageUpdate.theme = imported.theme;
                        if (imported.whitelistedWebsites && imported.whitelistedWebsites.length > 0) {
                            storageUpdate.whitelistedWebsites = imported.whitelistedWebsites;
                        }
                        if (imported.fsrsGlobalParams) storageUpdate.fsrsGlobalParams = imported.fsrsGlobalParams;
                        if (imported.ratingPromptState) storageUpdate.ratingPromptState = imported.ratingPromptState;
                        if (imported.dailyGoalTarget !== undefined) storageUpdate.dailyGoalTarget = imported.dailyGoalTarget;
                        if (imported.longestStreak !== undefined) storageUpdate.longestStreak = imported.longestStreak;
                    }

                    await chrome.storage.local.set(storageUpdate);
                    onStatus("Legacy backup imported successfully!");
                    resolve();
                } catch (err) {
                    const errorObj = err instanceof Error ? err : new Error(String(err));
                    Logger.error('Backup', `Error reading legacy file: ${errorObj.message}`, { err: errorObj });
                    onStatus("Failed to parse JSON: " + errorObj.message, true);
                    reject(errorObj);
                }
            };
            reader.readAsText(file);
        });
    }
}
