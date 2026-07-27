/**
 * @file features/common/data/backupManager.ts
 * @description Highly optimized backup and restoration manager for AlgoRecall.
 * Implements a Gzip-compressed, URL-deduplicated JSON Lines (JSONL) format with streaming parser.
 */
import '../logger';

const Logger = (globalThis as any).Logger;

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
        for (let i = 0; i < str.length; i++) {
            this.hash ^= str.charCodeAt(i);
            this.hash = (this.hash * 0x01000193) >>> 0;
        }
    }

    /**
     * Retrieve the final hex checksum digest.
     */
    digest(): string {
        return this.hash.toString(16).padStart(8, '0');
    }
}

/**
 * Generator helper to read line-by-line from a stream of bytes.
 */
export async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, unknown> {
    const reader = stream.getReader();
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
}

export class BackupManager {
    /**
     * Exports all user data into a compressed, deduplicated backup file.
     * Yields output chunks using a ReadableStream and triggers a download.
     */
    static async exportBackup(): Promise<void> {
        if (Logger) {
            Logger.time('Backup', 'exportBackup');
            Logger.info('Backup', 'Starting backup export process...');
        }
        const raw = await chrome.storage.local.get(null);

        // Extract and deduplicate URLs across bookmarks, cards, marks, pagecontents
        const pages: Array<{ url: string; title: string; icon: string }> = [];
        const urlToPageId = new Map<string, number>();

        const getOrCreatePageId = (url: string | undefined, title: string = '', icon: string = ''): number | null => {
            if (!url) return null;
            let id = urlToPageId.get(url);
            if (id === undefined) {
                id = pages.length;
                urlToPageId.set(url, id);
                pages.push({ url, title, icon });
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

        // Populate URLs from highlights (marks)
        for (const m of raw.marks || []) {
            getOrCreatePageId(m.url);
        }

        // Populate URLs from pagecontents
        for (const pc of raw.pagecontents || []) {
            getOrCreatePageId(pc.url);
        }

        // Generate deduplicated structures
        const dupBookmarks = (raw.bookmarks || []).map((b: any) => ({
            u: urlToPageId.get(b.url),
            meta: b.meta
        }));

        const dupCards = (raw.fsrsCards || []).map((c: any) => {
            const copy = { ...c };
            copy.u = urlToPageId.get(c.problemUrl);
            delete copy.problemUrl;
            delete copy.problemTitle;
            return copy;
        });

        const dupMarks = (raw.marks || []).map((m: any) => {
            const copy = { ...m };
            copy.u = urlToPageId.get(m.url);
            delete copy.url;
            return copy;
        });

        const dupPageContents = (raw.pagecontents || []).map((pc: any) => {
            const copy = { ...pc };
            copy.u = urlToPageId.get(pc.url);
            delete copy.url;
            return copy;
        });

        // Setup streaming generator of lines
        function* generateLines() {
            const counts = {
                pages: pages.length,
                cards: dupCards.length,
                marks: dupMarks.length,
                bookmarks: dupBookmarks.length,
                pagecontents: dupPageContents.length
            };
            yield JSON.stringify({ type: "header", data: { version: 2, timestamp: Date.now(), counts } });

            for (let i = 0; i < pages.length; i++) {
                yield JSON.stringify({ type: "page", data: { id: i, ...pages[i] } });
            }

            for (const card of dupCards) {
                yield JSON.stringify({ type: "card", data: card });
            }

            for (const mark of dupMarks) {
                yield JSON.stringify({ type: "mark", data: mark });
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
            const settings: any = {
                chromeSettings: raw.chromeSettings || {},
                notificationSettings: raw.notificationSettings || {},
                theme: raw.theme || 'dark',
                fsrsGlobalParams: raw.fsrsGlobalParams || {},
                ratingPromptState: raw.ratingPromptState || {},
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
            }
        });

        // Native Compression Stream
        const compressedStream = stream.pipeThrough(new (window as any).CompressionStream('gzip'));
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
        if (Logger) {
            Logger.info('Backup', `Backup export completed successfully. Download started for ${filename}.`);
            Logger.timeEnd('Backup', 'exportBackup');
        }
    }

    /**
     * Imports a backup file. Auto-detects Gzip/Text, performs schema version checks,
     * validates checksum, and hydrates local storage atomically.
     */
    static async importBackup(file: File, onStatus: (msg: string, isError?: boolean) => void): Promise<void> {
        if (Logger) {
            Logger.time('Backup', 'importBackup');
            Logger.info('Backup', `Starting backup import from file: ${file.name} (${file.size} bytes)`);
        }
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
            let prePassResult: any;
            try {
                prePassResult = await this.validateStream(file, isGzip);
            } catch (err: any) {
                console.error("Integrity/Checksum error during pre-pass validation:", err);
                onStatus(err.message, true);
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
                stream = stream.pipeThrough(new (window as any).DecompressionStream('gzip'));
            }

            const pages: any[] = [];
            const cards: any[] = [];
            const marks: any[] = [];
            const bookmarks: any[] = [];
            const pagecontents: any[] = [];
            let activity: any = {};
            let weights: any = {};
            let settings: any = {};

            const linesIterable = readLines(stream);
            for await (const line of linesIterable) {
                if (!line.trim()) continue;
                const parsed = JSON.parse(line);
                if (parsed.type === "page") {
                    pages[parsed.data.id] = parsed.data;
                } else if (parsed.type === "card") {
                    cards.push(parsed.data);
                } else if (parsed.type === "mark") {
                    marks.push(parsed.data);
                } else if (parsed.type === "bookmark") {
                    bookmarks.push(parsed.data);
                } else if (parsed.type === "pagecontent") {
                    pagecontents.push(parsed.data);
                } else if (parsed.type === "activity") {
                    activity = parsed.data;
                } else if (parsed.type === "weights") {
                    weights = parsed.data;
                } else if (parsed.type === "settings") {
                    settings = parsed.data;
                }
            }

            // Reconstruct URL references
            const reconstructedCards = cards.map(c => {
                const page = pages[c.u];
                if (!page) return c;
                const rc = { ...c };
                rc.problemUrl = page.url;
                rc.problemTitle = page.title;
                delete rc.u;
                return rc;
            });

            const reconstructedBookmarks = bookmarks.map(b => {
                const page = pages[b.u];
                if (!page) return b;
                return {
                    url: page.url,
                    title: page.title,
                    meta: b.meta || { favIconUrl: page.icon }
                };
            });

            const reconstructedMarks = marks.map(m => {
                const page = pages[m.u];
                if (!page) return m;
                const rm = { ...m };
                rm.url = page.url;
                delete rm.u;
                rm.type = rm.type || 'highlight';
                return rm;
            });

            const reconstructedPageContents = pagecontents.map(pc => {
                const page = pages[pc.u];
                if (!page) return pc;
                const rpc = { ...pc };
                rpc.url = page.url;
                delete rpc.u;
                return rpc;
            });

            // Hydrate local storage atomically
            const storageUpdate: any = {
                fsrsCards: reconstructedCards,
                fsrsActivity: activity,
                fsrsTopicWeights: weights,
                marks: reconstructedMarks,
                bookmarks: reconstructedBookmarks,
                pagecontents: reconstructedPageContents,
                chromeSettings: settings.chromeSettings || {},
                notificationSettings: settings.notificationSettings || {},
                theme: settings.theme || 'dark',
                fsrsGlobalParams: settings.fsrsGlobalParams || {},
                ratingPromptState: settings.ratingPromptState || {},
                dailyGoalTarget: settings.dailyGoalTarget || null,
                longestStreak: settings.longestStreak || 0
            };

            if (settings.whitelistedWebsites && settings.whitelistedWebsites.length > 0) {
                storageUpdate.whitelistedWebsites = settings.whitelistedWebsites;
            } else {
                await chrome.storage.local.remove('whitelistedWebsites');
            }

            await chrome.storage.local.set(storageUpdate);
            onStatus("Backup restored successfully!");
            if (Logger) {
                Logger.info('Backup', 'Backup restored successfully!');
                Logger.timeEnd('Backup', 'importBackup');
            }

        } catch (err: any) {
            if (Logger) Logger.error('Backup', 'Backup restoration failed', err);
            console.error("Backup restoration failed:", err);
            onStatus("Restoration failed: " + err.message, true);
        }
    }

    /**
     * Reads through the backup file stream without executing database writes,
     * ensuring formatting constraints and the checksum match.
     */
    static async validateStream(file: File, isGzip: boolean): Promise<any> {
        let stream: ReadableStream = file.stream();
        if (isGzip) {
            stream = stream.pipeThrough(new (window as any).DecompressionStream('gzip'));
        }

        const hasher = new Fnv1aHasher();
        let lineCount = 0;
        let header: any = null;
        let footer: any = null;

        const linesIterable = readLines(stream);
        for await (const line of linesIterable) {
            if (!line.trim()) continue;

            let parsed: any;
            try {
                parsed = JSON.parse(line);
            } catch (err) {
                // If it fails on the first line, it's definitely not V2 JSONL
                if (lineCount === 0) {
                    return { isV2: false };
                }
                throw new Error(`Corrupted file: Invalid JSON structure at line ${lineCount + 1}`);
            }

            if (parsed.type === "header") {
                if (lineCount !== 0) {
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
    }

    /**
     * Handles legacy JSON formatting structure and migrates it successfully to local storage.
     */
    static importLegacy(file: File, onStatus: (msg: string, isError?: boolean) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event: ProgressEvent<FileReader>) => {
                try {
                    const text = event.target?.result as string;
                    const imported = JSON.parse(text);

                    const storageUpdate: any = {
                        fsrsCards: Array.isArray(imported) ? imported : (imported.cards || []),
                        fsrsActivity: Array.isArray(imported) ? {} : (imported.activity || {}),
                        fsrsTopicWeights: Array.isArray(imported) ? {} : (imported.weights || {})
                    };

                    if (imported.marks) {
                        storageUpdate.marks = imported.marks.map((m: any) => {
                            m.type = m.type || 'highlight';
                            return m;
                        });
                    }
                    if (imported.bookmarks) storageUpdate.bookmarks = imported.bookmarks;
                    if (imported.pagecontents) storageUpdate.pagecontents = imported.pagecontents;
                    if (imported.chromeSettings) storageUpdate.chromeSettings = imported.chromeSettings;
                    if (imported.notificationSettings) storageUpdate.notificationSettings = imported.notificationSettings;

                    if (imported.theme) storageUpdate.theme = imported.theme;
                    if (imported.whitelistedWebsites && imported.whitelistedWebsites.length > 0) {
                        storageUpdate.whitelistedWebsites = imported.whitelistedWebsites;
                    } else if (imported.whitelistedWebsites && imported.whitelistedWebsites.length === 0) {
                        await chrome.storage.local.remove('whitelistedWebsites');
                    }
                    if (imported.fsrsGlobalParams) storageUpdate.fsrsGlobalParams = imported.fsrsGlobalParams;
                    if (imported.ratingPromptState) storageUpdate.ratingPromptState = imported.ratingPromptState;
                    if (imported.dailyGoalTarget !== undefined) storageUpdate.dailyGoalTarget = imported.dailyGoalTarget;
                    if (imported.longestStreak !== undefined) storageUpdate.longestStreak = imported.longestStreak;

                    await chrome.storage.local.set(storageUpdate);
                    onStatus("Legacy backup imported successfully!");
                    if (Logger) {
                        Logger.info('Backup', 'Legacy backup imported successfully!');
                        Logger.timeEnd('Backup', 'importBackup');
                    }
                    resolve();
                } catch (err) {
                    if (Logger) Logger.error('Backup', 'Legacy backup restoration failed', err);
                    console.error("Legacy Backup Error:", err);
                    onStatus("Failed to parse legacy JSON backup file.", true);
                    reject(err);
                }
            };
            reader.onerror = () => {
                onStatus("Error reading legacy file.", true);
                reject(new Error("File reading error"));
            };
            reader.readAsText(file);
        });
    }
}
