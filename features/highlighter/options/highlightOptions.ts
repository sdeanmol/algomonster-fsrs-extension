/**
 * @file features/highlighter/options/highlightOptions.ts
 * @description Manages options page configuration for highlight palettes, default colors, and color picker slots.
 * Allows users to create custom 5-color palettes, activate color sets, configure the default marker color,
 * and manage persistence in `chrome.storage.local`.
 * 
 * Context: Standalone extension options page (`highlightOptions.html`).
 * 
 * Key Exports:
 * - `Palette`: Interface defining a named color palette with hex color codes.
 * - `HighlightOptionsManager`: Options controller managing palette CRUD, slot pickers, and storage sync.
 */

import { Logger } from '@common/logger';
import { StorageData, ExtensionSettings } from '../../../types/domain';
import { DEFAULT_PALETTES, DEFAULT_EXTENSION_SETTINGS, DEFAULT_HIGHLIGHT_COLOR } from '../../common/constants';
import { CatchAndLog, withErrorHandling } from '../../../decorators';

/**
 * Representation of a named highlight palette containing up to 5 hex color values.
 */
export interface Palette {
    /** Display name of the palette. */
    name: string;
    /** Array of hex color strings (e.g. ['#f1c40f', '#2ecc71']). */
    colors: string[];
}

export { ExtensionSettings };

/**
 * Controller for highlight palettes and annotation preferences options page.
 */
export class HighlightOptionsManager {
    /** Factory default preset palettes. */
    DEFAULT_PALETTES: Palette[];
    /** Active extension configuration settings. */
    extensionSettings: ExtensionSettings;
    /** Current working colors in the palette editor form. */
    editorColors: string[];
    /** Index of the palette currently being edited, or null if creating a new palette. */
    editingIndex: number | null;

    /**
     * Initializes default properties and empty editor states.
     */
    constructor() {
        this.DEFAULT_PALETTES = DEFAULT_PALETTES;
        this.extensionSettings = JSON.parse(JSON.stringify(DEFAULT_EXTENSION_SETTINGS));

        this.editorColors = [...this.extensionSettings.recentColors!];
        this.editingIndex = null; // null if creating, index number if editing
    }

    /**
     * Initializes components and settings properties from Chrome storage.
     * 
     * @returns {void}
     */
    @CatchAndLog('HighlightOptions', 'Error initializing HighlightOptionsManager')
    init(): void {
        chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
            if (chrome.runtime.lastError) {
                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                Logger.error('HighlightOptions', `Storage error fetching extensionSettings: ${errorMessage}`, { error: chrome.runtime.lastError });
                return;
            }

            if (result.extensionSettings) {
                this.extensionSettings = { ...this.extensionSettings, ...result.extensionSettings };
            }
            
            // Ensure default palettes are set up
            if (!this.extensionSettings.palettes || this.extensionSettings.palettes.length === 0) {
                this.extensionSettings.palettes = JSON.parse(JSON.stringify(this.DEFAULT_PALETTES));
                this.extensionSettings.activePaletteIndex = 0;
                this.extensionSettings.recentColors = [...this.extensionSettings.palettes![0].colors];
            }

            // Set up General Options UI
            const defaultColor = this.extensionSettings.defaultHighlightColor || DEFAULT_HIGHLIGHT_COLOR;
            const defaultColorInput = document.getElementById('default-color') as HTMLInputElement | null;
            const defaultHexInput = document.getElementById('default-hex') as HTMLInputElement | null;

            if (defaultColorInput) defaultColorInput.value = defaultColor;
            if (defaultHexInput) defaultHexInput.value = defaultColor.toUpperCase();

            // Bind Event Listeners
            this.bindEvents();

            // Render Lists
            this.renderEditorSlots();
            this.renderPalettesList();
        }, 'HighlightOptions', 'Error rendering options UI from storage'));
    }

    /**
     * Registers control element action listeners for default colors, custom slots, palette saving, and defaults reset.
     * 
     * @returns {void}
     */
    @CatchAndLog('HighlightOptions', 'Error binding events')
    bindEvents(): void {
        // Default Highlight Color Event Listeners
        const defaultColorEl = document.getElementById('default-color') as HTMLInputElement | null;
        if (defaultColorEl) {
            defaultColorEl.addEventListener('input', withErrorHandling((e: Event) => {
                const target = e.target as HTMLInputElement;
                const hexInput = document.getElementById('default-hex') as HTMLInputElement | null;
                if (hexInput) hexInput.value = target.value.toUpperCase();
            }, 'HighlightOptions', 'Error in default color input listener'));

            defaultColorEl.addEventListener('change', withErrorHandling((e: Event) => {
                const target = e.target as HTMLInputElement;
                this.extensionSettings.defaultHighlightColor = target.value;
                this.saveSettings("Default highlight color updated!");
            }, 'HighlightOptions', 'Error in default color change listener'));
        }

        const defaultHexEl = document.getElementById('default-hex') as HTMLInputElement | null;
        if (defaultHexEl) {
            defaultHexEl.addEventListener('change', withErrorHandling((e: Event) => {
                const target = e.target as HTMLInputElement;
                let val = target.value.trim();
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
                    if (defaultColorEl) {
                        defaultColorEl.value = val;
                        this.extensionSettings.defaultHighlightColor = val;
                        this.saveSettings("Default highlight color updated!");
                    }
                    target.value = val.toUpperCase();
                } else {
                    this.showToast("Invalid hex code");
                    target.value = (this.extensionSettings.defaultHighlightColor || '#f1c40f').toUpperCase();
                }
            }, 'HighlightOptions', 'Error in hex input listener'));
        }

        // Add Slot Action inside Editor
        const addSlotBtn = document.getElementById('add-slot-btn');
        if (addSlotBtn) {
            addSlotBtn.addEventListener('click', withErrorHandling(() => {
                if (this.editorColors.length >= 5) {
                    this.showToast("A palette can have a maximum of 5 colors.");
                    return;
                }
                // Add default color as new slot color
                this.editorColors.push('#3498db');
                this.renderEditorSlots();
            }, 'HighlightOptions', 'Error in add slot button listener'));
        }

        // Save/Update Palette Action
        const nameInput = document.getElementById('palette-name-input') as HTMLInputElement | null;
        const savePaletteBtn = document.getElementById('save-palette-btn') as HTMLButtonElement | null;

        const updateSaveButtonState = () => {
            if (savePaletteBtn) {
                const hasName = !!(nameInput && nameInput.value.trim().length > 0);
                savePaletteBtn.disabled = !hasName;
            }
        };

        if (nameInput) {
            nameInput.addEventListener('input', updateSaveButtonState);
            nameInput.addEventListener('change', updateSaveButtonState);
        }
        updateSaveButtonState();

        if (savePaletteBtn) {
            savePaletteBtn.addEventListener('click', withErrorHandling(() => {
                const name = nameInput?.value.trim() || '';
                if (!name) {
                    this.showToast("Please enter a palette name.");
                    updateSaveButtonState();
                    return;
                }

                if (this.editorColors.length === 0) {
                    this.showToast("Palette must contain at least 1 color.");
                    return;
                }

                const palettes = this.extensionSettings.palettes || [];

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
                    if (this.editingIndex === this.extensionSettings.activePaletteIndex) {
                        this.extensionSettings.recentColors = [...this.editorColors];
                    }
                }

                // Reset editor form states
                if (nameInput) nameInput.value = '';
                this.editingIndex = null;
                if (savePaletteBtn) {
                    savePaletteBtn.textContent = '💾 Save Palette';
                    savePaletteBtn.disabled = true;
                }
                this.editorColors = [...this.extensionSettings.recentColors!];

                this.extensionSettings.palettes = palettes;
                this.saveSettings();
                this.renderEditorSlots();
            }, 'HighlightOptions', 'Error in save palette button listener'));
        }

        // Reset to Defaults button handler
        const resetBtn = document.getElementById('reset-palettes-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (!window.confirm('Are you sure you want to reset all highlighter palettes to defaults? This cannot be undone.')) {
                    return;
                }
                withErrorHandling(() => {
                    this.extensionSettings.palettes = JSON.parse(JSON.stringify(this.DEFAULT_PALETTES));
                    this.extensionSettings.activePaletteIndex = 0;
                    this.extensionSettings.recentColors = [...this.extensionSettings.palettes![0].colors];
                    this.extensionSettings.defaultHighlightColor = '#f1c40f';

                    const defaultColorEl = document.getElementById('default-color') as HTMLInputElement | null;
                    const defaultHexEl = document.getElementById('default-hex') as HTMLInputElement | null;
                    const nameInput = document.getElementById('palette-name-input') as HTMLInputElement | null;
                    const saveBtn = document.getElementById('save-palette-btn') as HTMLButtonElement | null;

                    if (defaultColorEl) defaultColorEl.value = '#f1c40f';
                    if (defaultHexEl) defaultHexEl.value = '#F1C40F';
                    
                    // Reset Editor UI
                    if (nameInput) nameInput.value = '';
                    this.editingIndex = null;
                    if (saveBtn) {
                        saveBtn.textContent = '💾 Save Palette';
                        saveBtn.disabled = true;
                    }
                    this.editorColors = [...this.extensionSettings.recentColors!];

                    this.saveSettings("Reset to defaults successfully!");
                    this.renderEditorSlots();
                }, 'HighlightOptions', 'Error in reset palettes button listener')();
            });
        }
    }

    /**
     * Dynamically renders color picker input rows and hex inputs for the palette currently being created or edited.
     * 
     * @returns {void}
     */
    @CatchAndLog('HighlightOptions', 'Error rendering editor slots')
    renderEditorSlots(): void {
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
            picker.addEventListener('input', withErrorHandling((e: Event) => {
                const target = e.target as HTMLInputElement;
                this.editorColors[idx] = target.value;
                const hexInput = row.querySelector('.color-hex') as HTMLInputElement | null;
                if (hexInput) hexInput.value = target.value.toUpperCase();
            }, 'HighlightOptions', `Error in color picker input handler for slot ${idx}`));

            const hexInput = document.createElement('input');
            hexInput.type = 'text';
            hexInput.className = 'color-hex';
            hexInput.value = color.toUpperCase();
            hexInput.maxLength = 7;
            hexInput.addEventListener('change', withErrorHandling((e: Event) => {
                const target = e.target as HTMLInputElement;
                let val = target.value.trim();
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
                    picker.value = val;
                    this.editorColors[idx] = val;
                    target.value = val.toUpperCase();
                } else {
                    this.showToast("Invalid hex code");
                    target.value = this.editorColors[idx].toUpperCase();
                }
            }, 'HighlightOptions', `Error in hex input handler for slot ${idx}`));

            row.appendChild(picker);
            row.appendChild(hexInput);

            // Delete slot action (require at least 1 color)
            if (this.editorColors.length > 1) {
                const delBtn = document.createElement('button');
                delBtn.className = 'btn-danger';
                delBtn.innerHTML = `<svg class="svg-icon" style="width:12px; height:12px; stroke:currentColor;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
                delBtn.title = 'Remove color';
                delBtn.setAttribute('aria-label', `Remove color slot ${idx + 1}`);
                delBtn.addEventListener('click', withErrorHandling(() => {
                    this.editorColors.splice(idx, 1);
                    this.renderEditorSlots();
                }, 'HighlightOptions', `Error deleting slot at index ${idx}`));
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
     * Renders saved palette preview cards with activate, edit, and delete action buttons.
     * 
     * @returns {void}
     */
    @CatchAndLog('HighlightOptions', 'Error rendering palettes list')
    renderPalettesList(): void {
        const container = document.getElementById('palettes-list-container');
        if (!container) return;
        container.innerHTML = '';

        const palettes = this.extensionSettings.palettes || [];
        const countEl = document.getElementById('palette-count');
        if (countEl) {
            countEl.textContent = `${palettes.length} / 50`;
        }

        palettes.forEach((palette, idx) => {
            const isActive = idx === this.extensionSettings.activePaletteIndex;

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
                activateBtn.addEventListener('click', withErrorHandling(() => {
                    this.extensionSettings.activePaletteIndex = idx;
                    this.extensionSettings.recentColors = [...palette.colors];
                    this.saveSettings("Palette activated!");
                }, 'HighlightOptions', `Error activating palette at index ${idx}`));
                actions.appendChild(activateBtn);
            }

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-action btn-action-edit';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', withErrorHandling(() => {
                this.editingIndex = idx;
                const nameInput = document.getElementById('palette-name-input') as HTMLInputElement | null;
                if (nameInput) nameInput.value = palette.name;
                this.editorColors = [...palette.colors];
                this.renderEditorSlots();
                const saveBtn = document.getElementById('save-palette-btn') as HTMLButtonElement | null;
                if (saveBtn) {
                    saveBtn.textContent = '💾 Update Palette';
                    saveBtn.disabled = !palette.name.trim();
                }
            }, 'HighlightOptions', `Error editing palette at index ${idx}`));
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-action btn-action-delete';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', withErrorHandling(() => {
                if (palettes.length <= 1) {
                    this.showToast("Cannot delete the only remaining palette.");
                    return;
                }
                this.extensionSettings.palettes!.splice(idx, 1);
                if (isActive) {
                    this.extensionSettings.activePaletteIndex = 0;
                    this.extensionSettings.recentColors = [...this.extensionSettings.palettes![0].colors];
                } else if (this.extensionSettings.activePaletteIndex !== undefined && this.extensionSettings.activePaletteIndex > idx) {
                    this.extensionSettings.activePaletteIndex--;
                }
                this.saveSettings("Palette deleted.");
            }, 'HighlightOptions', `Error deleting palette at index ${idx}`));
            actions.appendChild(deleteBtn);

            card.appendChild(actions);
            container.appendChild(card);
        });
    }

    /**
     * Persists updated settings to `chrome.storage.local` and refreshes the palette cards display.
     * 
     * @param {string | null} [message=null] - Optional toast message to display upon save.
     * @returns {void}
     */
    @CatchAndLog('HighlightOptions', 'Error saving settings')
    saveSettings(message: string | null = null): void {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            Logger.warn('HighlightOptions', 'Browser storage API unavailable in saveSettings.');
            return;
        }
        chrome.storage.local.set({ extensionSettings: this.extensionSettings }, withErrorHandling(() => {
            if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                Logger.error('HighlightOptions', `Storage error saving extensionSettings: ${errorMessage}`, { error: chrome.runtime.lastError });
                return;
            }
            this.renderPalettesList();
            if (message) this.showToast(message);
        }, 'HighlightOptions', 'Error in storage set callback for settings'));
    }

    /**
     * Renders a temporary floating toast notification in the options UI.
     * 
     * @param {string} message - Toast message text.
     * @returns {void}
     */
    @CatchAndLog('HighlightOptions', 'Error showing toast message')
    showToast(message: string): void {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(withErrorHandling(() => {
            toast.classList.remove('show');
        }, 'HighlightOptions', 'Error removing toast show class'), 3000);
    }
}

const initHighlightOptions = withErrorHandling((): void => {
    const manager = new HighlightOptionsManager();
    manager.init();
}, 'HighlightOptions', 'Initialization failed');

withErrorHandling((): void => {
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initHighlightOptions);
        } else {
            initHighlightOptions();
        }
    }
}, 'HighlightOptions', 'Error in DOMContentLoaded listener setup')();
