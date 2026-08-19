/**
 * @file features/highlighter/options/highlightOptions.ts
 * @description Manages options page configuration for highlight palettes, default colors, and color picker slots.
 */

import { Logger } from '@common/logger';
import { StorageData, ChromeSettings } from '../../../types/domain';
import { DEFAULT_PALETTES, DEFAULT_CHROME_SETTINGS } from '../../common/constants';

export interface Palette {
    name: string;
    colors: string[];
}

export { ChromeSettings };

export class HighlightOptionsManager {
    DEFAULT_PALETTES: Palette[];
    chromeSettings: ChromeSettings;
    editorColors: string[];
    editingIndex: number | null;

    constructor() {
        this.DEFAULT_PALETTES = DEFAULT_PALETTES;
        this.chromeSettings = JSON.parse(JSON.stringify(DEFAULT_CHROME_SETTINGS));

        this.editorColors = [...this.chromeSettings.recentColors!];
        this.editingIndex = null; // null if creating, index number if editing
    }

    /**
     * Initializes components and settings properties from Chrome storage.
     */
    init(): void {
        try {
            chrome.storage.local.get(['chromeSettings'], (result: StorageData) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('HighlightOptions', `Storage error fetching chromeSettings: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }

                    if (result.chromeSettings) {
                        this.chromeSettings = { ...this.chromeSettings, ...result.chromeSettings };
                    }
                    
                    // Ensure default palettes are set up
                    if (!this.chromeSettings.palettes || this.chromeSettings.palettes.length === 0) {
                        this.chromeSettings.palettes = JSON.parse(JSON.stringify(this.DEFAULT_PALETTES));
                        this.chromeSettings.activePaletteIndex = 0;
                        this.chromeSettings.recentColors = [...this.chromeSettings.palettes![0].colors];
                    }

                    // Set up General Options UI
                    const defaultColor = this.chromeSettings.defaultHighlightColor || '#f1c40f';
                    const defaultColorInput = document.getElementById('default-color') as HTMLInputElement | null;
                    const defaultHexSpan = document.getElementById('default-hex') as HTMLElement | null;

                    if (defaultColorInput) defaultColorInput.value = defaultColor;
                    if (defaultHexSpan) defaultHexSpan.textContent = defaultColor.toUpperCase();

                    // Bind Event Listeners
                    this.bindEvents();

                    // Render Lists
                    this.renderEditorSlots();
                    this.renderPalettesList();
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('HighlightOptions', `Error rendering options UI from storage: ${errorMessage}`, { innerErr });
                    // Comment: Non-fatal options UI render error
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error initializing HighlightOptionsManager: ${errorMessage}`, { err });
            // Comment: Catch options init failure gracefully
        }
    }

    /**
     * Registers control element action listeners.
     */
    bindEvents(): void {
        try {
            // Default Highlight Color Event Listeners
            const defaultColorEl = document.getElementById('default-color') as HTMLInputElement | null;
            if (defaultColorEl) {
                defaultColorEl.addEventListener('input', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const hexSpan = document.getElementById('default-hex');
                        if (hexSpan) hexSpan.textContent = target.value.toUpperCase();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in default color input listener: ${errorMessage}`, { err });
                    }
                });

                defaultColorEl.addEventListener('change', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        this.chromeSettings.defaultHighlightColor = target.value;
                        this.saveSettings("Default highlight color updated!");
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in default color change listener: ${errorMessage}`, { err });
                    }
                });
            }

            // Add Slot Action inside Editor
            const addSlotBtn = document.getElementById('add-slot-btn');
            if (addSlotBtn) {
                addSlotBtn.addEventListener('click', () => {
                    try {
                        if (this.editorColors.length >= 5) {
                            this.showToast("A palette can have a maximum of 5 colors.");
                            return;
                        }
                        // Add default color as new slot color
                        this.editorColors.push('#3498db');
                        this.renderEditorSlots();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in add slot button listener: ${errorMessage}`, { err });
                    }
                });
            }

            // Save/Update Palette Action
            const savePaletteBtn = document.getElementById('save-palette-btn');
            if (savePaletteBtn) {
                savePaletteBtn.addEventListener('click', () => {
                    try {
                        const nameInput = document.getElementById('palette-name-input') as HTMLInputElement | null;
                        const name = nameInput?.value.trim() || '';
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
                        if (nameInput) nameInput.value = '';
                        this.editingIndex = null;
                        if (savePaletteBtn) savePaletteBtn.textContent = '💾 Save Palette';
                        this.editorColors = [...this.chromeSettings.recentColors!];

                        this.chromeSettings.palettes = palettes;
                        this.saveSettings();
                        this.renderEditorSlots();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in save palette button listener: ${errorMessage}`, { err });
                    }
                });
            }

            // Reset to Defaults button handler
            const resetBtn = document.getElementById('reset-palettes-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    try {
                        this.chromeSettings.palettes = JSON.parse(JSON.stringify(this.DEFAULT_PALETTES));
                        this.chromeSettings.activePaletteIndex = 0;
                        this.chromeSettings.recentColors = [...this.chromeSettings.palettes![0].colors];
                        this.chromeSettings.defaultHighlightColor = '#f1c40f';

                        const defaultColorEl = document.getElementById('default-color') as HTMLInputElement | null;
                        const defaultHexEl = document.getElementById('default-hex');
                        const nameInput = document.getElementById('palette-name-input') as HTMLInputElement | null;
                        const saveBtn = document.getElementById('save-palette-btn');

                        if (defaultColorEl) defaultColorEl.value = '#f1c40f';
                        if (defaultHexEl) defaultHexEl.textContent = '#F1C40F';
                        
                        // Reset Editor UI
                        if (nameInput) nameInput.value = '';
                        this.editingIndex = null;
                        if (saveBtn) saveBtn.textContent = '💾 Save Palette';
                        this.editorColors = [...this.chromeSettings.recentColors!];

                        this.saveSettings("Reset to defaults successfully!");
                        this.renderEditorSlots();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in reset palettes button listener: ${errorMessage}`, { err });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error binding events: ${errorMessage}`, { err });
            // Comment: Non-fatal event binding catch
        }
    }

    /**
     * Helper: Renders input slots for color picker selection dynamically.
     */
    renderEditorSlots(): void {
        try {
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
                picker.addEventListener('input', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        this.editorColors[idx] = target.value;
                        const hexSpan = row.querySelector('.color-hex');
                        if (hexSpan) hexSpan.textContent = target.value.toUpperCase();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in color picker input handler for slot ${idx}: ${errorMessage}`, { idx, err });
                    }
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
                        try {
                            this.editorColors.splice(idx, 1);
                            this.renderEditorSlots();
                        } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            Logger.error('HighlightOptions', `Error deleting slot at index ${idx}: ${errorMessage}`, { idx, err });
                        }
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error rendering editor slots: ${errorMessage}`, { err });
            // Comment: Non-fatal editor slots rendering error
        }
    }

    /**
     * Helper: Renders list of available/saved custom palettes.
     */
    renderPalettesList(): void {
        try {
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
                        try {
                            this.chromeSettings.activePaletteIndex = idx;
                            this.chromeSettings.recentColors = [...palette.colors];
                            this.saveSettings("Palette activated!");
                        } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            Logger.error('HighlightOptions', `Error activating palette at index ${idx}: ${errorMessage}`, { idx, err });
                        }
                    });
                    actions.appendChild(activateBtn);
                }

                const editBtn = document.createElement('button');
                editBtn.className = 'btn-action btn-action-edit';
                editBtn.textContent = 'Edit';
                editBtn.addEventListener('click', () => {
                    try {
                        this.editingIndex = idx;
                        const nameInput = document.getElementById('palette-name-input') as HTMLInputElement | null;
                        if (nameInput) nameInput.value = palette.name;
                        this.editorColors = [...palette.colors];
                        this.renderEditorSlots();
                        const saveBtn = document.getElementById('save-palette-btn');
                        if (saveBtn) saveBtn.textContent = '💾 Update Palette';
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error editing palette at index ${idx}: ${errorMessage}`, { idx, err });
                    }
                });
                actions.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-action btn-action-delete';
                deleteBtn.textContent = 'Delete';
                deleteBtn.addEventListener('click', () => {
                    try {
                        if (palettes.length <= 1) {
                            this.showToast("Cannot delete the only remaining palette.");
                            return;
                        }
                        this.chromeSettings.palettes!.splice(idx, 1);
                        if (isActive) {
                            this.chromeSettings.activePaletteIndex = 0;
                            this.chromeSettings.recentColors = [...this.chromeSettings.palettes![0].colors];
                        } else if (this.chromeSettings.activePaletteIndex !== undefined && this.chromeSettings.activePaletteIndex > idx) {
                            this.chromeSettings.activePaletteIndex--;
                        }
                        this.saveSettings("Palette deleted.");
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error deleting palette at index ${idx}: ${errorMessage}`, { idx, err });
                    }
                });
                actions.appendChild(deleteBtn);

                card.appendChild(actions);
                container.appendChild(card);
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error rendering palettes list: ${errorMessage}`, { err });
            // Comment: Non-fatal palettes list rendering error
        }
    }

    /**
     * Commits current settings back to Chrome storage and re-renders lists.
     * @param {string} [message=null] - Text message shown inside toast alerts.
     */
    saveSettings(message: string | null = null): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                Logger.warn('HighlightOptions', 'Chrome storage API unavailable in saveSettings.');
                return;
            }
            chrome.storage.local.set({ chromeSettings: this.chromeSettings }, () => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('HighlightOptions', `Storage error saving chromeSettings: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    this.renderPalettesList();
                    if (message) this.showToast(message);
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('HighlightOptions', `Error in storage set callback for settings: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error saving settings: ${errorMessage}`, { err });
            // Comment: Non-fatal save settings catch
        }
    }

    /**
     * Renders status toast feedback indicators.
     * @param {string} message - Feedback message.
     */
    showToast(message: string): void {
        try {
            const toast = document.getElementById('status-toast');
            if (!toast) return;
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                try {
                    toast.classList.remove('show');
                } catch (animErr) {
                    const errorMessage = animErr instanceof Error ? animErr.message : String(animErr);
                    Logger.error('HighlightOptions', `Error removing toast show class: ${errorMessage}`, { animErr });
                }
            }, 3000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error showing toast message '${message}': ${errorMessage}`, { message, err });
        }
    }
}

function initHighlightOptions(): void {
    try {
        const manager = new HighlightOptionsManager();
        manager.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('HighlightOptions', `Initialization failed: ${errorMessage}`, { err });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHighlightOptions);
    } else {
        initHighlightOptions();
    }
}
