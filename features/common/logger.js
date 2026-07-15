/**
 * Logger module for centralized extension debugging.
 * Only logs to console when Developer Mode is enabled, except for ERROR and FATAL levels.
 */

class LoggerClass {
    constructor() {
        this.devMode = false;
        this.timers = new Map();
        this.logQueue = [];
        this.isFlushing = false;
        
        // Initialize developer mode state from storage
        this._initDevMode();
        
        // Listen for changes to developer mode
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.chromeSettings) {
                    const newSettings = changes.chromeSettings.newValue || {};
                    this.devMode = !!newSettings.developerMode;
                }
            });
        }
    }

    _initDevMode() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['chromeSettings'], (result) => {
                const settings = result.chromeSettings || {};
                this.devMode = !!settings.developerMode;
            });
        }
    }

    /**
     * Checks if logging is allowed for the given level.
     * @param {string} level 
     * @returns {boolean}
     */
    _canLog(level) {
        if (level === 'ERROR' || level === 'FATAL') return true;
        return this.devMode;
    }

    async _flushLogs() {
        if (this.isFlushing || this.logQueue.length === 0) return;
        this.isFlushing = true;
        try {
            const logsToFlush = [...this.logQueue];
            this.logQueue = [];
            
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const result = await chrome.storage.local.get(['debugLogs']);
                let logs = result.debugLogs || [];
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

    _persistLog(level, module, message, data) {
        if (!this.devMode && level !== 'ERROR' && level !== 'FATAL') return;
        const timestamp = new Date().toISOString();
        let safeData = null;
        try {
            if (data instanceof Error) {
                safeData = { message: data.message, stack: data.stack };
            } else if (data) {
                safeData = JSON.stringify(data);
            }
        } catch (e) { safeData = "[Unserializable Data]"; }
        
        this.logQueue.push({ timestamp, level, module, message, data: safeData });
        this._flushLogs();
    }

    /**
     * Formats the log message.
     */
    _formatMsg(module, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${module}] ${message}`;
    }

    debug(module, message, data = null) {
        if (!this._canLog('DEBUG')) return;
        this._persistLog('DEBUG', module, message, data);
        if (data) {
            console.debug(this._formatMsg(module, message), data);
        } else {
            console.debug(this._formatMsg(module, message));
        }
    }

    info(module, message, data = null) {
        if (!this._canLog('INFO')) return;
        this._persistLog('INFO', module, message, data);
        if (data) {
            console.info(this._formatMsg(module, message), data);
        } else {
            console.info(this._formatMsg(module, message));
        }
    }

    warn(module, message, data = null) {
        if (!this._canLog('WARN')) return;
        this._persistLog('WARN', module, message, data);
        if (data) {
            console.warn(this._formatMsg(module, message), data);
        } else {
            console.warn(this._formatMsg(module, message));
        }
    }

    error(module, message, data = null) {
        if (!this._canLog('ERROR')) return;
        
        const errorData = {
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

    fatal(module, message, data = null) {
        this.error(module, `FATAL: ${message}`, data);
    }

    group(module, groupName) {
        if (!this._canLog('DEBUG')) return;
        console.group(this._formatMsg(module, groupName));
    }

    groupEnd() {
        if (!this._canLog('DEBUG')) return;
        console.groupEnd();
    }

    time(module, timerName) {
        if (!this._canLog('DEBUG')) return;
        const key = `${module}:${timerName}`;
        this.timers.set(key, performance.now());
        console.time(this._formatMsg(module, timerName));
    }

    timeEnd(module, timerName) {
        if (!this._canLog('DEBUG')) return;
        const key = `${module}:${timerName}`;
        const start = this.timers.get(key);
        const duration = start ? (performance.now() - start).toFixed(2) + 'ms' : 'unknown';
        this.timers.delete(key);
        
        console.timeEnd(this._formatMsg(module, timerName));
        this.debug(module, `${timerName} completed in ${duration}`);
    }
}

const Logger = new LoggerClass();
if (typeof globalThis !== 'undefined') {
    globalThis.Logger = Logger;
}
if (typeof window !== 'undefined') {
    window.Logger = Logger;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Logger };
}
