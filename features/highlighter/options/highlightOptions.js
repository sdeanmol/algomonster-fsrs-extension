/**
 * @file features/highlighter/options/highlightOptions.js
 * @description Manages highlighter style options.
 * Allows users to set default highlight colors, create custom color palettes,
 * activate specific palette sets, and edit color hex values.
 * Upstream dependencies: None.
 * Downstream dependencies: chrome.storage (reads/writes chromeSettings).
 */

const DEFAULT_PALETTES = [
    { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
    { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
    { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
    { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
    { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
];

let chromeSettings = {
    defaultHighlightColor: '#f1c40f',
    recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
    showMarkerPopup: true,
    activePaletteIndex: 0,
    palettes: []
};

let editorColors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
let editingIndex = null; // null if creating, index number if editing

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial configuration load from storage
    chrome.storage.local.get(['chromeSettings'], (result) => {
        if (result.chromeSettings) {
            chromeSettings = { ...chromeSettings, ...result.chromeSettings };
        }
        
        // Ensure default palettes are set up
        if (!chromeSettings.palettes || chromeSettings.palettes.length === 0) {
            chromeSettings.palettes = JSON.parse(JSON.stringify(DEFAULT_PALETTES));
            chromeSettings.activePaletteIndex = 0;
            chromeSettings.recentColors = [...chromeSettings.palettes[0].colors];
        }

        // Set up General Options UI
        const defaultColor = chromeSettings.defaultHighlightColor || '#f1c40f';
        document.getElementById('default-color').value = defaultColor;
        document.getElementById('default-hex').textContent = defaultColor.toUpperCase();

        // Render Lists
        renderEditorSlots();
        renderPalettesList();
    });

    // 2. Default Highlight Color Event Listeners
    document.getElementById('default-color').addEventListener('input', (e) => {
        document.getElementById('default-hex').textContent = e.target.value.toUpperCase();
    });

    document.getElementById('default-color').addEventListener('change', (e) => {
        chromeSettings.defaultHighlightColor = e.target.value;
        saveSettings("Default highlight color updated!");
    });

    // 3. Add Slot Action inside Editor
    document.getElementById('add-slot-btn').addEventListener('click', () => {
        if (editorColors.length >= 5) {
            showToast("A palette can have a maximum of 5 colors.");
            return;
        }
        // Add default color as new slot color
        editorColors.push('#3498db');
        renderEditorSlots();
    });

    // 4. Save/Update Palette Action
    document.getElementById('save-palette-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('palette-name-input');
        const name = nameInput.value.trim();
        if (!name) {
            showToast("Please enter a palette name.");
            return;
        }

        if (editorColors.length === 0) {
            showToast("Palette must contain at least 1 color.");
            return;
        }

        const palettes = chromeSettings.palettes || [];

        if (editingIndex === null) {
            // Creation validation
            if (palettes.length >= 50) {
                showToast("Maximum limit of 50 palettes reached.");
                return;
            }
            palettes.push({ name, colors: [...editorColors] });
            showToast("Palette created successfully!");
        } else {
            // Update
            palettes[editingIndex] = { name, colors: [...editorColors] };
            showToast("Palette updated successfully!");

            // Update active cached state if editing active palette
            if (editingIndex === chromeSettings.activePaletteIndex) {
                chromeSettings.recentColors = [...editorColors];
            }
        }

        // Reset editor form states
        nameInput.value = '';
        editingIndex = null;
        document.getElementById('save-palette-btn').textContent = '💾 Save Palette';
        editorColors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

        chromeSettings.palettes = palettes;
        saveSettings();
        renderEditorSlots();
    });

    // 5. Reset to Defaults button handler
    document.getElementById('reset-palettes-btn').addEventListener('click', () => {
        chromeSettings.palettes = JSON.parse(JSON.stringify(DEFAULT_PALETTES));
        chromeSettings.activePaletteIndex = 0;
        chromeSettings.recentColors = [...chromeSettings.palettes[0].colors];
        chromeSettings.defaultHighlightColor = '#f1c40f';

        document.getElementById('default-color').value = '#f1c40f';
        document.getElementById('default-hex').textContent = '#F1C40F';
        
        // Reset Editor UI
        document.getElementById('palette-name-input').value = '';
        editingIndex = null;
        document.getElementById('save-palette-btn').textContent = '💾 Save Palette';
        editorColors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

        saveSettings("Reset to defaults successfully!");
        renderEditorSlots();
    });
});

/**
 * Helper: Renders input slots for color picker selection dynamically.
 */
function renderEditorSlots() {
    const container = document.getElementById('palette-slots-container');
    if (!container) return;
    container.innerHTML = '';

    editorColors.forEach((color, idx) => {
        const row = document.createElement('div');
        row.className = 'slot-row';

        const picker = document.createElement('input');
        picker.type = 'color';
        picker.className = 'color-picker';
        picker.value = color;
        picker.addEventListener('input', (e) => {
            editorColors[idx] = e.target.value;
            row.querySelector('.color-hex').textContent = e.target.value.toUpperCase();
        });

        const hexSpan = document.createElement('span');
        hexSpan.className = 'color-hex';
        hexSpan.textContent = color.toUpperCase();

        row.appendChild(picker);
        row.appendChild(hexSpan);

        // Delete slot action (require at least 1 color)
        if (editorColors.length > 1) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-danger';
            delBtn.innerHTML = `<svg class="svg-icon" style="width:12px; height:12px; stroke:currentColor;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
            delBtn.title = 'Remove color';
            delBtn.addEventListener('click', () => {
                editorColors.splice(idx, 1);
                renderEditorSlots();
            });
            row.appendChild(delBtn);
        }

        container.appendChild(row);
    });

    // Toggle button visibility based on slots length
    const addBtn = document.getElementById('add-slot-btn');
    if (addBtn) {
        addBtn.style.display = (editorColors.length >= 5) ? 'none' : 'block';
    }
}

/**
 * Helper: Renders list of available/saved custom palettes.
 */
function renderPalettesList() {
    const container = document.getElementById('palettes-list-container');
    if (!container) return;
    container.innerHTML = '';

    const palettes = chromeSettings.palettes || [];
    const countEl = document.getElementById('palette-count');
    if (countEl) {
        countEl.textContent = `${palettes.length} / 50`;
    }

    palettes.forEach((palette, idx) => {
        const isActive = idx === chromeSettings.activePaletteIndex;

        const card = document.createElement('div');
        card.className = `palette-card${isActive ? ' active' : ''}`;

        const header = document.createElement('div');
        header.className = 'palette-card-header';

        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'palette-title-wrapper';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'palette-name';
        nameSpan.textContent = palette.name;
        titleWrapper.appendChild(nameSpan);

        if (isActive) {
            const activeTag = document.createElement('span');
            activeTag.className = 'active-tag';
            activeTag.textContent = 'Active';
            titleWrapper.appendChild(activeTag);
        }

        header.appendChild(titleWrapper);
        card.appendChild(header);

        // Color preview bubbles
        const colorsDiv = document.createElement('div');
        colorsDiv.className = 'palette-colors';
        palette.colors.forEach(col => {
            const bubble = document.createElement('div');
            bubble.className = 'color-bubble';
            bubble.style.backgroundColor = col;
            colorsDiv.appendChild(bubble);
        });
        card.appendChild(colorsDiv);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'palette-actions';

        if (!isActive) {
            const activateBtn = document.createElement('button');
            activateBtn.className = 'btn-action btn-action-activate';
            activateBtn.textContent = 'Activate';
            activateBtn.addEventListener('click', () => {
                chromeSettings.activePaletteIndex = idx;
                chromeSettings.recentColors = [...palette.colors];
                saveSettings("Palette activated!");
            });
            actions.appendChild(activateBtn);
        }

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-action btn-action-edit';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            editingIndex = idx;
            document.getElementById('palette-name-input').value = palette.name;
            editorColors = [...palette.colors];
            renderEditorSlots();
            const saveBtn = document.getElementById('save-palette-btn');
            if (saveBtn) saveBtn.textContent = '💾 Update Palette';
        });
        actions.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-action btn-action-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            if (palettes.length <= 1) {
                showToast("Cannot delete the only remaining palette.");
                return;
            }
            chromeSettings.palettes.splice(idx, 1);
            if (isActive) {
                chromeSettings.activePaletteIndex = 0;
                chromeSettings.recentColors = [...chromeSettings.palettes[0].colors];
            } else if (chromeSettings.activePaletteIndex > idx) {
                chromeSettings.activePaletteIndex--;
            }
            saveSettings("Palette deleted.");
        });
        actions.appendChild(deleteBtn);

        card.appendChild(actions);
        container.appendChild(card);
    });
}

/**
 * Commits current settings back to Chrome storage and re-renders lists.
 * @param {string} [message=null] - Text message shown inside toast alerts.
 */
function saveSettings(message = null) {
    chrome.storage.local.set({ chromeSettings }, () => {
        renderPalettesList();
        if (message) showToast(message);
    });
}

/**
 * Renders status toast feedback indicators.
 * @param {string} message - Feedback message.
 */
function showToast(message) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}