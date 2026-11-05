/**
 * @file UI Helper Utilities and Centralized Error Handling
 * @module features/common/utils/uiUtils
 * @context Shared across Extension Pages, Popup, and Dashboard Controls
 * @description Provides common UI helpers including animated toast alerts, safe tab/window closing,
 * standardized exception logging, and Chrome storage error assertions.
 */

import { Logger } from '@common/logger';

/**
 * Static collection of UI and error handling utilities.
 */
export class UIUtils {
    /**
     * Displays an animated toast notification on the current HTML page.
     * Searches for an element with ID `status-toast` and applies the `.show` CSS class.
     * @param msg - Toast message text to display.
     * @param durationMs - Display duration in milliseconds before auto-dismissal (defaults to 2500ms).
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
     * Safely closes the active extension tab or window.
     * Attempts to query `chrome.tabs.getCurrent` and close the tab via `chrome.tabs.remove`,
     * falling back to standard `window.close()`.
     */
    static closeCurrentTab(): void {
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.getCurrent === 'function') {
                chrome.tabs.getCurrent((tab) => {
                    if (tab && tab.id !== undefined) {
                        chrome.tabs.remove(tab.id, () => {
                            if (chrome.runtime?.lastError) {
                                window.close();
                            }
                        });
                    } else {
                        window.close();
                    }
                });
            } else {
                window.close();
            }
        } catch {
            window.close();
        }
    }

    /**
     * Centralized error logger reducing boilerplate in try-catch blocks.
     * Extracts error messages, merges metadata, and logs to `Logger.error`.
     * @param moduleName - Originating subsystem or module name.
     * @param contextMessage - Descriptive text detailing what operation failed.
     * @param err - Unknown error object caught.
     * @param metadata - Optional key-value object containing contextual arguments.
     */
    static catchError(moduleName: string, contextMessage: string, err: unknown, metadata?: Record<string, unknown>): void {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const logData = metadata ? { err, ...metadata } : { err };
        Logger.error(moduleName, `${contextMessage}: ${errorMessage}`, logData);
    }

    /**
     * Inspects `chrome.runtime.lastError`. If an error occurred, logs it and returns true.
     * @param moduleName - Originating subsystem name.
     * @param contextMessage - Contextual operation description.
     * @param metadata - Optional metadata dictionary.
     * @returns True if `chrome.runtime.lastError` was populated, otherwise false.
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
