/**
 * @file Cross-Page Theme Synchronization Engine
 * @module features/common/theme-sync
 * @context Shared across Extension Pages (Popup, Options, Dashboard, Data Manager)
 * @description Automatically synchronizes light and dark visual themes across all extension pages
 * by inspecting stored preferences and toggling the `light-theme` CSS class on `document.documentElement`
 * prior to page rendering, preventing Flash of Unstyled Content (FOUC).
 */

import { Logger } from '@common/logger';
import { CatchAndLog, withErrorHandling } from '../../decorators';
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
    return withErrorHandling(() => {
        const win = window as unknown as { AlgoRecall: AlgoRecallThemeGlobal };
        win.AlgoRecall = win.AlgoRecall || {};
        return win.AlgoRecall;
    }, 'ThemeSync', {
        contextMessage: 'Error accessing global AlgoRecall object',
        fallback: {}
    })() || {};
}

/**
 * Static service synchronizing theme state with `chrome.storage.local`.
 */
export class ThemeSync {
    /**
     * Applies the selected visual theme to the document element classlist.
     * @param theme - The target theme identifier ('light' or 'dark').
     */
    @CatchAndLog('ThemeSync', 'Error applying theme')
    static applyTheme(theme: string): void {
        if (theme === 'light') {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
    }

    /**
     * Initializes storage watchers, checks system color scheme preferences,
     * and sets up the active theme on page bootstrap.
     * @fires chrome.storage.local.get
     * @fires chrome.storage.local.set
     * @listens chrome.storage.onChanged
     */
    @CatchAndLog('ThemeSync', 'Error initializing ThemeSync')
    static init(): void {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['theme'], withErrorHandling((result: { theme?: string }) => {
                if (chrome.runtime?.lastError) {
                    const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                    Logger.error('ThemeSync', `Error fetching theme from storage: ${errorMessage}`, { error: chrome.runtime.lastError });
                    return;
                }
                if (!result.theme) {
                    const prefersLight = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
                    const initialTheme = prefersLight ? 'light' : DEFAULT_THEME;
                    ThemeSync.applyTheme(initialTheme);
                    chrome.storage.local.set({ theme: initialTheme });
                } else {
                    ThemeSync.applyTheme(result.theme);
                }
            }, 'ThemeSync', { contextMessage: 'Error in theme storage get callback' }));

            // Listen for changes
            chrome.storage.onChanged.addListener(withErrorHandling((changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
                if (areaName === 'local' && changes.theme) {
                    ThemeSync.applyTheme((changes.theme.newValue as string) || 'dark');
                }
            }, 'ThemeSync', { contextMessage: 'Error handling theme storage change' }));
        }
    }
}

withErrorHandling(() => {
    getAlgoRecallGlobal().ThemeSync = ThemeSync;

    // Auto-run theme sync on document head parsing
    ThemeSync.init();

    // UX-010: Prevent notification card flash on Safari
    if (/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
        document.documentElement.classList.add('safari-build');
    }
}, 'ThemeSync', { contextMessage: 'Error initializing ThemeSync global bindings' })();
