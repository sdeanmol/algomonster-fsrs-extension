/**
 * Logger module for centralized extension debugging.
 * Only logs to console when Developer Mode is enabled, except for ERROR and FATAL levels.
 */

export interface LogEntry {
    timestamp: string;
    level: string;
    module: string;
    message: string;
    data: string | null | Record<string, unknown>;
}

export class LoggerClass {
    private devMode: boolean = false;
    private timers: Map<string, number> = new Map();
    private logQueue: LogEntry[] = [];
    private isFlushing: boolean = false;

    constructor() {
        // Initialize developer mode state from storage
        this._initDevMode();

        // Listen for changes to developer mode
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

                // Limit to last 1000 logs to prevent storage bloat
                if (logs.length > 1000) {
                    logs = logs.slice(logs.length - 1000);
                }

                await chrome.storage.local.set({ debugLogs: logs });
            }
        } catch {
            // Silently fail to avoid recursive error logging
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
            } else if (data) {
                safeData = JSON.stringify(data);
            }
        } catch {
            safeData = "[Unserializable Data]";
        }

        this.logQueue.push({ timestamp, level, module: moduleName, message, data: safeData });
        this._flushLogs();
    }

    /**
     * Formats the log message.
     */
    private _formatMsg(moduleName: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${moduleName}] ${message}`;
    }

    debug(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('DEBUG')) return;
        this._persistLog('DEBUG', moduleName, message, data);
        if (data) {
            console.debug(this._formatMsg(moduleName, message), data);
        } else {
            console.debug(this._formatMsg(moduleName, message));
        }
    }

    info(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('INFO')) return;
        this._persistLog('INFO', moduleName, message, data);
        if (data) {
            console.info(this._formatMsg(moduleName, message), data);
        } else {
            console.info(this._formatMsg(moduleName, message));
        }
    }

    warn(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('WARN')) return;
        this._persistLog('WARN', moduleName, message, data);
        if (data) {
            console.warn(this._formatMsg(moduleName, message), data);
        } else {
            console.warn(this._formatMsg(moduleName, message));
        }
    }

    error(moduleName: string, message: string, data: unknown = null): void {
        if (!this._canLog('ERROR')) return;

        const errorData: { module: string; timestamp: string; message: string; error?: string; stack?: string; metadata?: unknown } = {
            module: moduleName,
            timestamp: new Date().toISOString(),
            message
        };

        if (data instanceof Error) {
            errorData.error = data.message;
            errorData.stack = data.stack;
        } else if (data) {
            errorData.metadata = data;
        }

        this._persistLog('ERROR', moduleName, message, data);
        console.error(this._formatMsg(moduleName, message), errorData);
    }

    fatal(moduleName: string, message: string, data: unknown = null): void {
        this.error(moduleName, `FATAL: ${message}`, data);
    }

    group(moduleName: string, groupName: string): void {
        if (!this._canLog('DEBUG')) return;
        console.group(this._formatMsg(moduleName, groupName));
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
}

export const Logger = new LoggerClass();

if (typeof globalThis !== 'undefined') {
    (globalThis as unknown as { Logger?: LoggerClass }).Logger = Logger;
}
if (typeof window !== 'undefined') {
    (window as unknown as { Logger?: LoggerClass }).Logger = Logger;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Logger };
}
