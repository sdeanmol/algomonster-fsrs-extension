/**
 * @file features/highlighter/options/highlightOptions.js
 * @description Manages highlighter style options.
 * Allows users to set default highlight colors, create custom color palettes,
 * activate specific palette sets, and edit color hex values.
 */
class HighlightOptionsManager {
    constructor() {
        this.DEFAULT_PALETTES = [
            { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
            { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
            { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
            { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
            { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
        ];

        this.chromeSettings = {
            defaultHighlightColor: '#f1c40f',
            recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
            showMarkerPopup: true,
            activePaletteIndex: 0,
            palettes: []
        };

        this.editorColors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
        this.editingIndex = null; // null if creating, index number if editing
    }

    /**
     * Initializes components and settings properties from Chrome storage.
     */
    init() {
        chrome.storage.local.get(['chromeSettings'], (result) => {
            if (result.chromeSettings) {
                this.chromeSettings = { ...this.chromeSettings, ...result.chromeSettings };
            }
            
            // Ensure default palettes are set up
            if (!this.chromeSettings.palettes || this.chromeSettings.palettes.length === 0) {
                this.chromeSettings.palettes = JSON.parse(JSON.stringify(this.DEFAULT_PALETTES));
                this.chromeSettings.activePaletteIndex = 0;
                this.chromeSettings.recentColors = [...this.chromeSettings.palettes[0].colors];
            }

            // Set up General Options UI
            const defaultColor = this.chromeSettings.defaultHighlightColor || '#f1c40f';
            document.getElementById('default-color').value = defaultColor;
            document.getElementById('default-hex').textContent = defaultColor.toUpperCase();

            // Bind Event Listeners
            this.bindEvents();

            // Render Lists
            this.renderEditorSlots();
            this.renderPalettesList();
        });
    }

    /**
     * Registers control element action listeners.
     */
    bindEvents() {
        // Default Highlight Color Event Listeners
        document.getElementById('default-color').addEventListener('input', (e) => {
            document.getElementById('default-hex').textContent = e.target.value.toUpperCase();
        });

        document.getElementById('default-color').addEventListener('change', (e) => {
            this.chromeSettings.defaultHighlightColor = e.target.value;
            this.saveSettings("Default highlight color updated!");
        });

        // Add Slot Action inside Editor
        document.getElementById('add-slot-btn').addEventListener('click', () => {
            if (this.editorColors.length >= 5) {
                this.showToast("A palette can have a maximum of 5 colors.");
                return;
            }
            // Add default color as new slot color
            this.editorColors.push('#3498db');
            this.renderEditorSlots();
        });

        // Save/Update Palette Action
        document.getElementById('save-palette-btn').addEventListener('click', () => {
            const nameInput = document.getElementById('palette-name-input');
            const name = nameInput.value.trim();
            if (!name) {
                this.showToast("Please enter a palette name.");
                return;
            }

            if (this.editorColors.length === 0) {
                this.showToast("Palette must contain at least 1 color.");
                return;
            }

            const palettes = this.chromeSettings.palettes || [];

            if (this.editingIndex === null) {
                // Creation validation
                if (palettes.length >= 50) {
                    this.showToast("Maximum limit of 50 palettes reached.");
                    return;
                }
                palettes.push({ name, colors: [...this.editorColors] });
                this.showToast("Palette created successfully!");
            } else {
                // Update
                palettes[this.editingIndex] = { name, colors: [...this.editorColors] };
                this.showToast("Palette updated successfully!");

                // Update active cached state if editing active palette
                if (this.editingIndex === this.chromeSettings.activePaletteIndex) {
                    this.chromeSettings.recentColors = [...this.editorColors];
                }
            }

            // Reset editor form states
            nameInput.value = '';
            this.editingIndex = null;
            document.getElementById('save-palette-btn').textContent = '💾 Save Palette';
            this.editorColors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

            this.chromeSettings.palettes = palettes;
            this.saveSettings();
            this.renderEditorSlots();
        });

        // Reset to Defaults button handler
        document.getElementById('reset-palettes-btn').addEventListener('click', () => {
            this.chromeSettings.palettes = JSON.parse(JSON.stringify(this.DEFAULT_PALETTES));
            this.chromeSettings.activePaletteIndex = 0;
            this.chromeSettings.recentColors = [...this.chromeSettings.palettes[0].colors];
            this.chromeSettings.defaultHighlightColor = '#f1c40f';

            document.getElementById('default-color').value = '#f1c40f';
            document.getElementById('default-hex').textContent = '#F1C40F';
            
            // Reset Editor UI
            document.getElementById('palette-name-input').value = '';
            this.editingIndex = null;
            document.getElementById('save-palette-btn').textContent = '💾 Save Palette';
            this.editorColors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

            this.saveSettings("Reset to defaults successfully!");
            this.renderEditorSlots();
        });
    }

    /**
     * Helper: Renders input slots for color picker selection dynamically.
     */
    renderEditorSlots() {
        const container = document.getElementById('palette-slots-container');
        if (!container) return;
        container.innerHTML = '';

        this.editorColors.forEach((color, idx) => {
            const row = document.createElement('div');
            row.className = 'slot-row';

            const picker = document.createElement('input');
            picker.type = 'color';
            picker.className = 'color-picker';
            picker.value = color;
            picker.addEventListener('input', (e) => {
                this.editorColors[idx] = e.target.value;
                row.querySelector('.color-hex').textContent = e.target.value.toUpperCase();
            });

            const hexSpan = document.createElement('span');
            hexSpan.className = 'color-hex';
            hexSpan.textContent = color.toUpperCase();

            row.appendChild(picker);
            row.appendChild(hexSpan);

            // Delete slot action (require at least 1 color)
            if (this.editorColors.length > 1) {
                const delBtn = document.createElement('button');
                delBtn.className = 'btn-danger';
                delBtn.innerHTML = `<svg class="svg-icon" style="width:12px; height:12px; stroke:currentColor;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
                delBtn.title = 'Remove color';
                delBtn.addEventListener('click', () => {
                    this.editorColors.splice(idx, 1);
                    this.renderEditorSlots();
                });
                row.appendChild(delBtn);
            }

            container.appendChild(row);
        });

        // Toggle button visibility based on slots length
        const addBtn = document.getElementById('add-slot-btn');
        if (addBtn) {
            addBtn.style.display = (this.editorColors.length >= 5) ? 'none' : 'block';
        }
    }

    /**
     * Helper: Renders list of available/saved custom palettes.
     */
    renderPalettesList() {
        const container = document.getElementById('palettes-list-container');
        if (!container) return;
        container.innerHTML = '';

        const palettes = this.chromeSettings.palettes || [];
        const countEl = document.getElementById('palette-count');
        if (countEl) {
            countEl.textContent = `${palettes.length} / 50`;
        }

        palettes.forEach((palette, idx) => {
            const isActive = idx === this.chromeSettings.activePaletteIndex;

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
                    this.chromeSettings.activePaletteIndex = idx;
                    this.chromeSettings.recentColors = [...palette.colors];
                    this.saveSettings("Palette activated!");
                });
                actions.appendChild(activateBtn);
            }

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-action btn-action-edit';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => {
                this.editingIndex = idx;
                document.getElementById('palette-name-input').value = palette.name;
                this.editorColors = [...palette.colors];
                this.renderEditorSlots();
                const saveBtn = document.getElementById('save-palette-btn');
                if (saveBtn) saveBtn.textContent = '💾 Update Palette';
            });
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-action btn-action-delete';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                if (palettes.length <= 1) {
                    this.showToast("Cannot delete the only remaining palette.");
                    return;
                }
                this.chromeSettings.palettes.splice(idx, 1);
                if (isActive) {
                    this.chromeSettings.activePaletteIndex = 0;
                    this.chromeSettings.recentColors = [...this.chromeSettings.palettes[0].colors];
                } else if (this.chromeSettings.activePaletteIndex > idx) {
                    this.chromeSettings.activePaletteIndex--;
                }
                this.saveSettings("Palette deleted.");
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
    saveSettings(message = null) {
        chrome.storage.local.set({ chromeSettings: this.chromeSettings }, () => {
            this.renderPalettesList();
            if (message) this.showToast(message);
        });
    }

    /**
     * Renders status toast feedback indicators.
     * @param {string} message - Feedback message.
     */
    showToast(message) {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const manager = new HighlightOptionsManager();
    manager.init();
});