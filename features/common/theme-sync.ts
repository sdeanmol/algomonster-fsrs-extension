(window as any).AlgoRecall = (window as any).AlgoRecall || {};

/**
 * @class ThemeSync
 * @description Automatically synchronizes the visual theme (light/dark mode) across standalone dashboard pages
 * by reading the stored extension settings and applying/removing the 'light-theme' class on the document root
 * before rendering, mitigating FOUC (Flash of Unstyled Content).
 */
(window as any).AlgoRecall.ThemeSync = class ThemeSync {
    /**
     * Applies the selected visual theme to the document element classlist.
     * @param {string} theme - The target theme identifier ('light' or 'dark').
     */
    static applyTheme(theme: string): void {
        if (theme === 'light') {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
    }

    /**
     * Initializes storage watchers and applies initial stored theme.
     */
    static init(): void {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['theme'], (result: { [key: string]: any }) => {
                this.applyTheme(result.theme || 'dark');
            });

            // Listen for changes
            chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
                if (areaName === 'local' && changes.theme) {
                    this.applyTheme(changes.theme.newValue);
                }
            });
        }
    }
};

// Auto-run theme sync on document head parsing
(window as any).AlgoRecall.ThemeSync.init();
