/**
 * @file features/common/theme-sync.ts
 * @description Automatically synchronizes the visual theme (light/dark mode) across standalone dashboard pages
 * by reading the stored extension settings and applying/removing the 'light-theme' class on the document root
 * before rendering, mitigating FOUC (Flash of Unstyled Content).
 */

import { Logger } from '@common/logger';

interface ThemeSyncClass {
    applyTheme(theme: string): void;
    init(): void;
}

interface AlgoRecallThemeGlobal {
    ThemeSync?: ThemeSyncClass;
}

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

export class ThemeSync {
    /**
     * Applies the selected visual theme to the document element classlist.
     * @param {string} theme - The target theme identifier ('light' or 'dark').
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
            // Comment: Non-fatal theme toggle failure; default styles remain intact
        }
    }

    /**
     * Initializes storage watchers and applies initial stored theme.
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
                        this.applyTheme(result.theme || 'dark');
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
            // Comment: Catch storage listener binding failure gracefully
        }
    }
}

try {
    getAlgoRecallGlobal().ThemeSync = ThemeSync;

    // Auto-run theme sync on document head parsing
    ThemeSync.init();
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('ThemeSync', `Error auto-running ThemeSync initialization: ${errorMessage}`, { err });
}
