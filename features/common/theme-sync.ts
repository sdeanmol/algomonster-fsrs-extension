/**
 * @file Cross-Page Theme Synchronization Engine
 * @module features/common/theme-sync
 * @context Shared across Extension Pages (Popup, Options, Dashboard, Data Manager)
 * @description Automatically synchronizes light and dark visual themes across all extension pages
 * by inspecting stored preferences and toggling the `light-theme` CSS class on `document.documentElement`
 * prior to page rendering, preventing Flash of Unstyled Content (FOUC).
 */

import { Logger } from '@common/logger';
import { DEFAULT_THEME } from './constants';

/**
 * Interface describing theme synchronization methods.
 */
interface ThemeSyncClass {
    /** Applies a visual theme class to the document root */
    applyTheme(theme: string): void;
    /** Initializes storage listeners and retrieves active theme */
    init(): void;
}

/**
 * Window extension namespace anchor for AlgoRecall.
 */
interface AlgoRecallThemeGlobal {
    ThemeSync?: ThemeSyncClass;
}

/**
 * Safely accesses the global `AlgoRecall` namespace object.
 * @returns The global AlgoRecall container.
 */
function getAlgoRecallGlobal(): AlgoRecallThemeGlobal {
    try {
        const win = window as unknown as { AlgoRecall: AlgoRecallThemeGlobal };
        win.AlgoRecall = win.AlgoRecall || {};
        return win.AlgoRecall;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('ThemeSync', `Error accessing global AlgoRecall object: ${errorMessage}`, { err });
        return {};
    }
}

/**
 * Static service synchronizing theme state with `chrome.storage.local`.
 */
export class ThemeSync {
    /**
     * Applies the selected visual theme to the document element classlist.
     * @param theme - The target theme identifier ('light' or 'dark').
     */
    static applyTheme(theme: string): void {
        try {
            if (theme === 'light') {
                document.documentElement.classList.add('light-theme');
            } else {
                document.documentElement.classList.remove('light-theme');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ThemeSync', `Error applying theme '${theme}': ${errorMessage}`, { err });
        }
    }

    /**
     * Initializes storage watchers, checks system color scheme preferences,
     * and sets up the active theme on page bootstrap.
     * @fires chrome.storage.local.get
     * @fires chrome.storage.local.set
     * @listens chrome.storage.onChanged
     */
    static init(): void {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['theme'], (result: { theme?: string }) => {
                    try {
                        if (chrome.runtime?.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                            Logger.error('ThemeSync', `Error fetching theme from storage: ${errorMessage}`, { error: chrome.runtime.lastError });
                            return;
                        }
                        if (!result.theme) {
                            const prefersLight = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
                            const initialTheme = prefersLight ? 'light' : DEFAULT_THEME;
                            this.applyTheme(initialTheme);
                            chrome.storage.local.set({ theme: initialTheme });
                        } else {
                            this.applyTheme(result.theme);
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('ThemeSync', `Error in theme storage get callback: ${errorMessage}`, { err });
                    }
                });

                // Listen for changes
                chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
                    try {
                        if (areaName === 'local' && changes.theme) {
                            this.applyTheme((changes.theme.newValue as string) || 'dark');
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('ThemeSync', `Error handling theme storage change: ${errorMessage}`, { err });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ThemeSync', `Error initializing ThemeSync: ${errorMessage}`, { err });
        }
    }
}

try {
    getAlgoRecallGlobal().ThemeSync = ThemeSync;

    // Auto-run theme sync on document head parsing
    ThemeSync.init();

    // UX-010: Prevent notification card flash on Safari
    if (/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
        document.documentElement.classList.add('safari-build');
    }
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('ThemeSync', `Error initializing ThemeSync global bindings: ${errorMessage}`, { err });
}
