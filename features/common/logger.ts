/**
 * @file Centralized Extension and Application Logger
 * @module features/common/logger
 * @context Shared across Background Service Worker, Content Scripts, Popup UI, and Dashboard
 * @description Provides structured, level-based logging with DevTools console color-coding,
 * an in-memory bounded ring buffer, developer mode storage synchronization, performance timing,
 * and persistent storage queue flushing.
 */

import { LOGGER_MAX_BUFFER_SIZE } from './constants';

/**
 * Represents a single structured log entry record.
 */
export interface LogEntry {
    /** ISO 8601 formatted timestamp string of the log event */
    timestamp: string;
    /** Log severity level ('DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL') */
    level: string;
    /** Subsystem or module name generating the log */
    module: string;
    /** Human-readable log message */
    message: string;
    /** Optional serialized contextual metadata, stack trace, or payload */
    data: string | null | Record<string, unknown>;
}

/** In-Memory Bounded Ring Buffer for rapid export and runtime inspection */
const MAX_BUFFER_SIZE = LOGGER_MAX_BUFFER_SIZE;
const memoryLogBuffer: LogEntry[] = [];

/**
 * Core logging utility class handling formatting, console output, and storage persistence.
 */
export class LoggerClass {
    /** Internal flag tracking whether developer verbose logging is enabled */
    private devMode: boolean = false;
    /** Active performance timer start marks keyed by module and timer label */
    private timers: Map<string, number> = new Map();
    /** Queue of logs awaiting asynchronous persistence to `chrome.storage.local` */
    private logQueue: LogEntry[] = [];
    /** Mutex flag preventing concurrent flush loops */
    private isFlushing: boolean = false;

    /**
     * Initializes console monkey-patching, reads initial developer mode preference,
     * and sets up storage listeners to react to developer mode toggles in real time.
     * @listens chrome.storage.onChanged
     */
    constructor() {
        this._patchConsole();
        // Initialize developer mode state from chrome storage
        this._initDevMode();

        // Listen for changes to developer mode dynamically
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } }, area: string) => {
                if (area === 'local' && changes.extensionSettings) {
                    const newSettings = (changes.extensionSettings.newValue || {}) as { developerMode?: boolean };
                    this._setDevMode(!!newSettings.developerMode);
                }
            });
        }
    }

    /**
     * Updates internal and global developer mode status flags.
     * @param enabled - True to enable verbose logging, false to suppress non-error logs.
     */
    private _setDevMode(enabled: boolean): void {
        this.devMode = enabled;
        if (typeof globalThis !== 'undefined') {
            (globalThis as any).__algorecall_dev_mode = enabled;
        }
    }

    /**
     * Monkey-patches `console.debug` to suppress noisy third-party libraries (such as ts-fsrs)
     * unless extension developer mode is explicitly enabled.
     */
    private _patchConsole(): void {
        if (typeof console === 'undefined') return;
        const consoleObj = console as unknown as { __algorecall_patched?: boolean; debug: (...args: unknown[]) => void };
        if (consoleObj.__algorecall_patched) return;
        consoleObj.__algorecall_patched = true;
        const origDebug = console.debug;
        if (typeof origDebug === 'function') {
            console.debug = (...args: unknown[]) => {
                const isDev = typeof globalThis !== 'undefined' && typeof (globalThis as any).__algorecall_dev_mode === 'boolean'
                    ? (globalThis as any).__algorecall_dev_mode
                    : this.devMode;
                if (isDev) {
                    origDebug.apply(console, args);
                }
            };
        }
    }

    /**
     * Reads the current developerMode setting from `chrome.storage.local`.
     * @fires chrome.storage.local.get
     */
    private _initDevMode(): void {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['extensionSettings'], (result: { extensionSettings?: { developerMode?: boolean } }) => {
                if (chrome.runtime?.lastError) {
                    return;
                }
                const settings = result.extensionSettings || {};
                this._setDevMode(!!settings.developerMode);
            });
        }
    }

    /**
     * Determines whether messages of a specified level should be output to the console.
     * @param level - Log severity level string.
     * @returns True if logging should proceed.
     */
    private _canLog(level: string): boolean {
        return this.devMode;
    }

    /**
     * Asynchronously drains queued log entries into `chrome.storage.local` under the `debugLogs` key,
     * maintaining buffer size constraints.
     * @async
     * @fires chrome.storage.local.set
     */
    private async _flushLogs(): Promise<void> {
        if (this.isFlushing || this.logQueue.length === 0) return;
        this.isFlushing = true;

        try {
            const logsToFlush = [...this.logQueue];
            this.logQueue = [];

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const result = await chrome.storage.local.get(['debugLogs']);
                let logs: LogEntry[] = (result.debugLogs as LogEntry[]) || [];
                logs.push(...logsToFlush);

                // Limit storage to prevent storage bloat
                if (logs.length > MAX_BUFFER_SIZE) {
                    logs = logs.slice(logs.length - MAX_BUFFER_SIZE);
                }

                await chrome.storage.local.set({ debugLogs: logs });
            }
        } catch (flushErr) {
            // Silently handle to prevent recursive error loops during storage failure
            if (this.devMode) {
                console.warn('[AlgoRecall Logger] Log flush storage failure:', flushErr);
            }
        } finally {
            this.isFlushing = false;
            if (this.logQueue.length > 0) {
                this._flushLogs();
            }
        }
    }

    /**
     * Records a log entry into the in-memory ring buffer and dispatches to the persistence queue.
     * @param level - Log level.
     * @param moduleName - Originating module name.
     * @param message - Main log message.
     * @param data - Optional data or Error object to serialize safely.
     */
    private _persistLog(level: string, moduleName: string, message: string, data?: unknown): void {
        if (!this.devMode && level !== 'ERROR' && level !== 'FATAL') return;

        const timestamp = new Date().toISOString();
        let safeData: string | Record<string, unknown> | null = null;

        try {
            if (data instanceof Error) {
                safeData = { message: data.message, stack: data.stack };
            } else if (data !== undefined && data !== null) {
                safeData = JSON.parse(JSON.stringify(data));
            }
        } catch (serializeErr) {
            const errorMessage = serializeErr instanceof Error ? serializeErr.message : String(serializeErr);
            safeData = `[Unserializable Data: ${errorMessage}]`;
        }

        const entry: LogEntry = { timestamp, level, module: moduleName, message, data: safeData };

        // Append to local memory buffer
        if (memoryLogBuffer.length >= MAX_BUFFER_SIZE) {
            memoryLogBuffer.shift();
        }
        memoryLogBuffer.push(entry);

        // Queue for Chrome Storage persistence
        this.logQueue.push(entry);
        this._flushLogs();
    }

    /**
     * Formats a raw log line with timestamp and module header.
     * @param moduleName - Originating module.
     * @param message - Message content.
     * @returns Formatted log string.
     */
    private _formatMsg(moduleName: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${moduleName}] ${message}`;
    }

    /**
     * Generates DevTools console CSS styling parameters for color-coded log outputs.
     * @param level - Severity level.
     * @param moduleName - Module name.
     * @param message - Message text.
     * @returns Array of format string and CSS style directives suitable for `console.log`.
     */
    private _getColoredConsoleArgs(level: string, moduleName: string, message: string): string[] {
        const timestamp = new Date().toLocaleTimeString();
        let levelStyle = '';

        switch (level) {
            case 'DEBUG':
                levelStyle = 'color: #70c0e8; font-weight: bold; background: rgba(112, 192, 232, 0.15); padding: 1px 5px; border-radius: 3px;';
                break;
            case 'INFO':
                levelStyle = 'color: #81c995; font-weight: bold; background: rgba(129, 201, 149, 0.15); padding: 1px 5px; border-radius: 3px;';
                break;
            case 'WARN':
                levelStyle = 'color: #fde293; font-weight: bold; background: rgba(253, 226, 147, 0.15); padding: 1px 5px; border-radius: 3px;';
                break;
            case 'ERROR':
            case 'FATAL':
                levelStyle = 'color: #f28b82; font-weight: bold; background: rgba(242, 139, 130, 0.2); padding: 1px 5px; border-radius: 3px;';
                break;
            default:
                levelStyle = 'color: #a8c7fa; font-weight: bold;';
        }

        const timestampStyle = 'color: #8e9099; font-weight: normal; font-size: 11px;';
        const moduleStyle = 'color: #c4a8fa; font-weight: 600;';
        const msgStyle = 'color: inherit; font-weight: normal;';

        const formatStr = `%c[${timestamp}] %c${level} %c[${moduleName}] %c${message}`;
        return [formatStr, timestampStyle, levelStyle, moduleStyle, msgStyle];
    }

    /**
     * Dispatches a fine-grained debug-level log message (suppressed unless developerMode is on).
     * @param moduleName - Source module name.
     * @param message - Diagnostic message text.
     * @param data - Optional data payload or context object.
     */
    debug(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('DEBUG')) return;
        this._persistLog('DEBUG', moduleName, message, data);
        const consoleArgs = this._getColoredConsoleArgs('DEBUG', moduleName, message);
        if (data !== null && data !== undefined) {
            console.debug(...consoleArgs, data);
        } else {
            console.debug(...consoleArgs);
        }
    }

    /**
     * Dispatches an informational status log message.
     * @param moduleName - Source module name.
     * @param message - Information text.
     * @param data - Optional associated payload.
     */
    info(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('INFO')) return;
        this._persistLog('INFO', moduleName, message, data);
        const consoleArgs = this._getColoredConsoleArgs('INFO', moduleName, message);
        if (data !== null && data !== undefined) {
            console.info(...consoleArgs, data);
        } else {
            console.info(...consoleArgs);
        }
    }

    /**
     * Dispatches a warning message indicating non-fatal anomalies or fallback states.
     * @param moduleName - Source module name.
     * @param message - Warning description.
     * @param data - Optional warning metadata.
     */
    warn(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('WARN')) return;
        this._persistLog('WARN', moduleName, message, data);
        const consoleArgs = this._getColoredConsoleArgs('WARN', moduleName, message);
        if (data !== null && data !== undefined) {
            console.warn(...consoleArgs, data);
        } else {
            console.warn(...consoleArgs);
        }
    }

    /**
     * Dispatches an error log message, always persisting it to the storage queue
     * and outputting to the console regardless of developerMode setting.
     * @param moduleName - Source module name.
     * @param message - Failure description.
     * @param data - Error instance or contextual diagnostics.
     */
    error(moduleName: string, message: string, data: unknown = null): void {
        this._persistLog('ERROR', moduleName, message, data);
        if (!this._canLog('ERROR')) return;

        const errorData: Record<string, unknown> = {
            module: moduleName,
            timestamp: new Date().toISOString(),
            message,
        };

        if (data instanceof Error) {
            errorData.error = data.message;
            errorData.stack = data.stack;
        } else if (data !== null && data !== undefined) {
            errorData.metadata = data;
        }

        const consoleArgs = this._getColoredConsoleArgs('ERROR', moduleName, message);
        console.error(...consoleArgs, errorData);
    }

    /**
     * Dispatches a critical fatal error log message.
     * @param moduleName - Source module name.
     * @param message - Fatal condition description.
     * @param data - Optional error instance or details.
     */
    fatal(moduleName: string, message: string, data: unknown = null): void {
        this.error(moduleName, `FATAL: ${message}`, data);
    }

    /**
     * Begins an indented console group in DevTools.
     * @param moduleName - Source module name.
     * @param groupName - Group title.
     */
    group(moduleName: string, groupName: string): void {
        if (!this._canLog('DEBUG')) return;
        console.group(this._formatMsg(moduleName, groupName));
    }

    /**
     * Closes the most recently opened console group.
     */
    groupEnd(): void {
        if (!this._canLog('DEBUG')) return;
        console.groupEnd();
    }

    /**
     * Starts a named performance timer.
     * @param moduleName - Source module name.
     * @param timerName - Unique timer identifier.
     */
    time(moduleName: string, timerName: string): void {
        if (!this._canLog('DEBUG')) return;
        const key = `${moduleName}:${timerName}`;
        this.timers.set(key, performance.now());
        console.time(`[${moduleName}] ${timerName}`);
    }

    /**
     * Stops a named performance timer and logs the elapsed duration in milliseconds.
     * @param moduleName - Source module name.
     * @param timerName - Unique timer identifier to stop.
     */
    timeEnd(moduleName: string, timerName: string): void {
        if (!this._canLog('DEBUG')) return;
        const key = `${moduleName}:${timerName}`;
        if (!this.timers.has(key)) return;

        const start = this.timers.get(key);
        const duration = start ? (performance.now() - start).toFixed(2) + 'ms' : 'unknown';
        this.timers.delete(key);

        console.timeEnd(`[${moduleName}] ${timerName}`);
        this.debug(moduleName, `${timerName} completed in ${duration}`);
    }

    /**
     * Returns a snapshot copy of all log records currently retained in the in-memory ring buffer.
     * @returns Array of recent log entries.
     */
    public getBufferedLogs(): LogEntry[] {
        return [...memoryLogBuffer];
    }

    /**
     * Flushes and clears all entries from the in-memory ring buffer.
     */
    public clearBufferedLogs(): void {
        memoryLogBuffer.length = 0;
    }
}

/**
 * Singleton instance of the application Logger.
 */
export const Logger = new LoggerClass();

if (typeof globalThis !== 'undefined') {
    (globalThis as unknown as { Logger?: LoggerClass }).Logger = Logger;
}
if (typeof window !== 'undefined') {
    (window as unknown as { Logger?: LoggerClass }).Logger = Logger;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Logger, LoggerClass };
}
