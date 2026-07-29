/**
 * Centralized Extension & Application Logger.
 * Supports Chrome storage persistence, developer mode toggles, in-memory ring buffer,
 * safe metadata formatting, and rich DevTools console color-coding.
 */

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

    private _formatMsg(moduleName: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${moduleName}] ${message}`;
    }

    /**
     * Generates DevTools console CSS styling parameters for color-coded log outputs.
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
        } else if (data !== null && data !== undefined) {
            errorData.metadata = data;
        }

        this._persistLog('ERROR', moduleName, message, data);
        const consoleArgs = this._getColoredConsoleArgs('ERROR', moduleName, message);
        console.error(...consoleArgs, errorData);
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