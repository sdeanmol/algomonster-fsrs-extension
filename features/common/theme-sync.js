/**
 * @file features/common/theme-sync.js
 * @description Automatically synchronizes the visual theme (light/dark mode) across standalone dashboard pages
 * by reading the stored extension settings and applying/removing the 'light-theme' class on the document root
 * before rendering, mitigating FOUC (Flash of Unstyled Content).
 * Upstream dependencies: chrome.storage (Chrome Extensions API).
 * Downstream dependencies: Various HTML dashboards loading theme-sync.js in their `<head>` scripts.
 */

(function() {
    /**
     * Applies the selected visual theme to the document element classlist.
     * @param {string} theme - The target theme identifier ('light' or 'dark').
     */
    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
    }

    // Read initial theme from storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['theme'], (result) => {
            applyTheme(result.theme || 'dark');
        });

        // Listen for changes
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.theme) {
                applyTheme(changes.theme.newValue);
            }
        });
    }
})();

