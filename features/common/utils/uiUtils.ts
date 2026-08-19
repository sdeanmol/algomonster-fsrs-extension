import { Logger } from '@common/logger';

export class UIUtils {
    /**
     * Displays a temporary toast notification message.
     */
    static showToast(msg: string, durationMs: number = 2500): void {
        try {
            const toast = document.getElementById('status-toast');
            if (!toast) return;
            toast.textContent = msg;
            toast.className = 'toast show';
            setTimeout(() => {
                try {
                    toast.className = 'toast';
                } catch (animErr) {
                    this.catchError('UIUtils', 'Error hiding toast animation', animErr);
                }
            }, durationMs);
        } catch (err) {
            this.catchError('UIUtils', `Error showing toast message '${msg}'`, err, { msg });
        }
    }

    /**
     * Centralized error catching helper to reduce boilerplate in catch blocks.
     */
    static catchError(moduleName: string, contextMessage: string, err: unknown, metadata?: Record<string, unknown>): void {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const logData = metadata ? { err, ...metadata } : { err };
        Logger.error(moduleName, `${contextMessage}: ${errorMessage}`, logData);
    }

    /**
     * Centralized chrome.runtime.lastError check and logging.
     * Returns true if there was an error.
     */
    static checkStorageError(moduleName: string, contextMessage: string, metadata?: Record<string, unknown>): boolean {
        if (chrome.runtime?.lastError) {
            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
            const logData = metadata ? { error: chrome.runtime.lastError, ...metadata } : { error: chrome.runtime.lastError };
            Logger.error(moduleName, `${contextMessage}: ${errorMessage}`, logData);
            return true;
        }
        return false;
    }
}
