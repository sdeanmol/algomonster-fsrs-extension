/**
 * Logger module for centralized extension debugging.
 * Only logs to console when Developer Mode is enabled, except for ERROR and FATAL levels.
 */

export interface LogEntry {
    timestamp: string;
    level: string;
    module: string;
    message: string;
    data: string | null | { [key: string]: any };
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
            chrome.storage.onChanged.addListener((changes: { [key: string]: { oldValue?: any; newValue?: any } }, area: string) => {
                if (area === 'local' && changes.chromeSettings) {
                    const newSettings = changes.chromeSettings.newValue || {};
                    this.devMode = !!newSettings.developerMode;
                }
            });
        }
    }

    private _initDevMode(): void {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['chromeSettings'], (result: { [key: string]: any }) => {
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
                let logs: LogEntry[] = result.debugLogs || [];
                logs.push(...logsToFlush);

                // Limit to last 1000 logs to prevent storage bloat
                if (logs.length > 1000) {
                    logs = logs.slice(logs.length - 1000);
                }

                await chrome.storage.local.set({ debugLogs: logs });
            }
        } catch (e) {
            // Silently fail to avoid recursive error logging
        } finally {
            this.isFlushing = false;
            if (this.logQueue.length > 0) {
                this._flushLogs();
            }
        }
    }

    private _persistLog(level: string, module: string, message: string, data?: any): void {
        if (!this.devMode && level !== 'ERROR' && level !== 'FATAL') return;
        const timestamp = new Date().toISOString();
        let safeData: any = null;
        try {
            if (data instanceof Error) {
                safeData = { message: data.message, stack: data.stack };
            } else if (data) {
                safeData = JSON.stringify(data);
            }
        } catch (e) {
            safeData = "[Unserializable Data]";
        }

        this.logQueue.push({ timestamp, level, module, message, data: safeData });
        this._flushLogs();
    }

    /**
     * Formats the log message.
     */
    private _formatMsg(module: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${module}] ${message}`;
    }

    debug(module: string, message: string, data: any = null): void {
        if (!this._canLog('DEBUG')) return;
        this._persistLog('DEBUG', module, message, data);
        if (data) {
            console.debug(this._formatMsg(module, message), data);
        } else {
            console.debug(this._formatMsg(module, message));
        }
    }

    info(module: string, message: string, data: any = null): void {
        if (!this._canLog('INFO')) return;
        this._persistLog('INFO', module, message, data);
        if (data) {
            console.info(this._formatMsg(module, message), data);
        } else {
            console.info(this._formatMsg(module, message));
        }
    }

    warn(module: string, message: string, data: any = null): void {
        if (!this._canLog('WARN')) return;
        this._persistLog('WARN', module, message, data);
        if (data) {
            console.warn(this._formatMsg(module, message), data);
        } else {
            console.warn(this._formatMsg(module, message));
        }
    }

    error(module: string, message: string, data: any = null): void {
        if (!this._canLog('ERROR')) return;

        const errorData: { module: string; timestamp: string; message: string; error?: string; stack?: string; metadata?: any } = {
            module,
            timestamp: new Date().toISOString(),
            message
        };

        if (data instanceof Error) {
            errorData.error = data.message;
            errorData.stack = data.stack;
        } else if (data) {
            errorData.metadata = data;
        }

        this._persistLog('ERROR', module, message, data);
        console.error(this._formatMsg(module, message), errorData);
    }

    fatal(module: string, message: string, data: any = null): void {
        this.error(module, `FATAL: ${message}`, data);
    }

    group(module: string, groupName: string): void {
        if (!this._canLog('DEBUG')) return;
        console.group(this._formatMsg(module, groupName));
    }

    groupEnd(): void {
        if (!this._canLog('DEBUG')) return;
        console.groupEnd();
    }

    time(module: string, timerName: string): void {
        if (!this._canLog('DEBUG')) return;
        const key = `${module}:${timerName}`;
        this.timers.set(key, performance.now());
        console.time(`[${module}] ${timerName}`);
    }

    timeEnd(module: string, timerName: string): void {
        if (!this._canLog('DEBUG')) return;
        const key = `${module}:${timerName}`;
        if (!this.timers.has(key)) return;

        const start = this.timers.get(key);
        const duration = start ? (performance.now() - start).toFixed(2) + 'ms' : 'unknown';
        this.timers.delete(key);

        console.timeEnd(`[${module}] ${timerName}`);
        this.debug(module, `${timerName} completed in ${duration}`);
    }
}

export const Logger = new LoggerClass();

if (typeof globalThis !== 'undefined') {
    (globalThis as any).Logger = Logger;
}
if (typeof window !== 'undefined') {
    (window as any).Logger = Logger;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Logger };
}
