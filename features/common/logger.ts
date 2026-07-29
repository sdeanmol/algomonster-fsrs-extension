/**
 * Centralized Extension & Application Logger powered by Winston.
 * Supports Chrome storage persistence, developer mode toggles, and safe metadata formatting.
 */

import winston from 'winston';

export interface LogEntry {
    timestamp: string;
    level: string;
    module: string;
    message: string;
    data: string | null | Record<string, unknown>;
}

// In-Memory Bounded Ring Buffer for rapid export / runtime inspection
const MAX_BUFFER_SIZE = 1000;
const memoryLogBuffer: LogEntry[] = [];

/**
 * Winston Custom Formatter for Console and Extension Output
 */
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, module: moduleName, data }) => {
        const mod = moduleName ? `[${moduleName}]` : '[Global]';
        let dataStr = '';
        if (data !== undefined && data !== null) {
            try {
                dataStr = typeof data === 'object' ? `\nData: ${JSON.stringify(data, null, 2)}` : `\nData: ${String(data)}`;
            } catch {
                dataStr = '\nData: [Circular/Unserializable]';
            }
        }
        return `[${timestamp}] [${level.toUpperCase()}] ${mod} ${message}${dataStr}`.trim();
    })
);

// Instantiate underlying Winston Logger instance
const winstonInstance = winston.createLogger({
    level: 'debug',
    format: customFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: true }),
                customFormat
            ),
        }),
    ],
});

export class LoggerClass {
    private devMode: boolean = false;
    private timers: Map<string, number> = new Map();
    private logQueue: LogEntry[] = [];
    private isFlushing: boolean = false;

    constructor() {
        // Initialize developer mode state from chrome storage
        this._initDevMode();

        // Listen for changes to developer mode dynamically
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } }, area: string) => {
                if (area === 'local' && changes.chromeSettings) {
                    const newSettings = (changes.chromeSettings.newValue || {}) as { developerMode?: boolean };
                    this.devMode = !!newSettings.developerMode;
                }
            });
        }
    }

    private _initDevMode(): void {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['chromeSettings'], (result: { chromeSettings?: { developerMode?: boolean } }) => {
                const settings = result.chromeSettings || {};
                this.devMode = !!settings.developerMode;
            });
        }
    }

    /**
     * Checks if logging is allowed for the given level.
     */
    private _canLog(level: string): boolean {
        if (level === 'ERROR' || level === 'FATAL') return true;
        return this.devMode;
    }

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
        } catch {
            // Silently fail to prevent recursive error loops during storage failure
        } finally {
            this.isFlushing = false;
            if (this.logQueue.length > 0) {
                this._flushLogs();
            }
        }
    }

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
        } catch {
            safeData = '[Unserializable Data]';
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

    debug(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('DEBUG')) return;
        this._persistLog('DEBUG', moduleName, message, data);
        winstonInstance.debug(message, { module: moduleName, data });
    }

    info(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('INFO')) return;
        this._persistLog('INFO', moduleName, message, data);
        winstonInstance.info(message, { module: moduleName, data });
    }

    warn(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('WARN')) return;
        this._persistLog('WARN', moduleName, message, data);
        winstonInstance.warn(message, { module: moduleName, data });
    }

    error(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('ERROR')) return;

        const errorData: Record<string, unknown> = {
            module: moduleName,
            timestamp: new Date().toISOString(),
            message,
        };

        if (data instanceof Error) {
            errorData.error = data.message;
            errorData.stack = data.stack;
        } else if (data) {
            errorData.metadata = data;
        }

        this._persistLog('ERROR', moduleName, message, data);
        winstonInstance.error(message, { module: moduleName, data: errorData });
    }

    fatal(moduleName: string, message: string, data: unknown = null): void {
        this.error(moduleName, `FATAL: ${message}`, data);
    }

    group(moduleName: string, groupName: string): void {
        if (!this._canLog('DEBUG')) return;
        console.group(`[${new Date().toISOString()}] [${moduleName}] ${groupName}`);
    }

    groupEnd(): void {
        if (!this._canLog('DEBUG')) return;
        console.groupEnd();
    }

    time(moduleName: string, timerName: string): void {
        if (!this._canLog('DEBUG')) return;
        const key = `${moduleName}:${timerName}`;
        this.timers.set(key, performance.now());
        console.time(`[${moduleName}] ${timerName}`);
    }

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

    /** Helper API Extensions **/
    public getBufferedLogs(): LogEntry[] {
        return [...memoryLogBuffer];
    }

    public clearBufferedLogs(): void {
        memoryLogBuffer.length = 0;
    }
}

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