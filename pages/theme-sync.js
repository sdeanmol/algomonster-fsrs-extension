(function() {
    // Apply theme immediately to prevent FOUC (Flash of Unstyled Content)
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
