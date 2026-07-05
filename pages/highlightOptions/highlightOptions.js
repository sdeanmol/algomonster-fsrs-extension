// Hardcoded defaults to fallback to
const DEFAULT_COLORS = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'];
const DEFAULT_MAIN = '#f1c40f';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load existing colors from storage
    chrome.storage.local.get(['chromeSettings'], (result) => {
        const settings = result.chromeSettings || {};
        
        const recentColors = settings.recentColors || DEFAULT_COLORS;
        const defaultColor = settings.defaultHighlightColor || DEFAULT_MAIN;

        // Populate inputs
        document.getElementById('default-color').value = defaultColor;
        document.getElementById('default-hex').textContent = defaultColor.toUpperCase();
        
        document.getElementById('color-1').value = recentColors[0];
        document.getElementById('color-2').value = recentColors[1];
        document.getElementById('color-3').value = recentColors[2];
        document.getElementById('color-4').value = recentColors[3];
    });

    // Update hex text dynamically when default color changes
    document.getElementById('default-color').addEventListener('input', (e) => {
        document.getElementById('default-hex').textContent = e.target.value.toUpperCase();
    });

    // 2. Save Button Logic
    document.getElementById('save-btn').addEventListener('click', () => {
        const newDefault = document.getElementById('default-color').value;
        const newPalette = [
            document.getElementById('color-1').value,
            document.getElementById('color-2').value,
            document.getElementById('color-3').value,
            document.getElementById('color-4').value
        ];

        // Fetch current settings so we don't overwrite other properties (like showMarkerPopup)
        chrome.storage.local.get(['chromeSettings'], (result) => {
            const currentSettings = result.chromeSettings || {};
            
            const updatedSettings = {
                ...currentSettings,
                defaultHighlightColor: newDefault,
                recentColors: newPalette
            };

            chrome.storage.local.set({ chromeSettings: updatedSettings }, () => {
                showToast("Colors saved successfully! Refresh your page to see changes.");
            });
        });
    });

    // 3. Reset Button Logic
    document.getElementById('reset-btn').addEventListener('click', () => {
        document.getElementById('default-color').value = DEFAULT_MAIN;
        document.getElementById('default-hex').textContent = DEFAULT_MAIN.toUpperCase();
        
        document.getElementById('color-1').value = DEFAULT_COLORS[0];
        document.getElementById('color-2').value = DEFAULT_COLORS[1];
        document.getElementById('color-3').value = DEFAULT_COLORS[2];
        document.getElementById('color-4').value = DEFAULT_COLORS[3];

        // Auto-save the reset values
        document.getElementById('save-btn').click();
    });
});

function showToast(message) {
    const toast = document.getElementById('status-toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}