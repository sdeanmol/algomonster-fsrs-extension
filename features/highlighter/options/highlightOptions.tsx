/**
 * @file features/highlighter/options/highlightOptions.tsx (Preact)
 * @description Manages options page configuration for highlight palettes, default colors, and color picker slots.
 * Allows users to create custom 5-color palettes, activate color sets, configure the default marker color,
 * and manage persistence in `chrome.storage.local`.
 * 
 * Context: Standalone extension options page (`highlightOptions.html`).
 * 
 * Key Exports:
 * - `Palette`: Interface defining a named color palette with hex color codes.
 * - `PaletteEditorSlots`: Preact component rendering color slot pickers.
 * - `PalettesList`: Preact component rendering saved palette cards.
 * - `HighlightOptionsManager`: Options controller managing palette CRUD, slot pickers, and storage sync.
 */

import { h, render, Fragment, JSX } from 'preact';
import { Logger } from '@common/logger';
import { StorageData, ExtensionSettings } from '../../../types/domain';
import { DEFAULT_PALETTES, DEFAULT_EXTENSION_SETTINGS, DEFAULT_HIGHLIGHT_COLOR } from '../../common/constants';

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
 * Preact Component for rendering the color slot editor rows.
 */
export function PaletteEditorSlots({
    colors,
    onColorChange,
    onDeleteSlot
}: {
    colors: string[];
    onColorChange: (index: number, newColor: string) => void;
    onDeleteSlot: (index: number) => void;
}): JSX.Element {
    return (
        <Fragment>
            {colors.map((color, idx) => (
                <div key={idx} className="slot-row">
                    <input
                        type="color"
                        className="color-picker"
                        value={color}
                        onInput={(e: Event) => {
                            const target = e.target as HTMLInputElement;
                            onColorChange(idx, target.value);
                        }}
                    />
                    <input
                        type="text"
                        className="color-hex"
                        value={color.toUpperCase()}
                        maxLength={7}
                        onChange={(e: Event) => {
                            const target = e.target as HTMLInputElement;
                            let val = target.value.trim();
                            if (!val.startsWith('#')) val = '#' + val;
                            if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
                                onColorChange(idx, val);
                                target.value = val.toUpperCase();
                            } else {
                                target.value = color.toUpperCase();
                            }
                        }}
                    />
                    {colors.length > 1 && (
                        <button
                            className="btn-danger"
                            title="Remove color"
                            aria-label={`Remove color slot ${idx + 1}`}
                            onClick={() => onDeleteSlot(idx)}
                        >
                            <svg className="svg-icon" style={{ width: '12px', height: '12px', stroke: 'currentColor' }} viewBox="0 0 24 24">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    )}
                </div>
            ))}
        </Fragment>
    );
}

/**
 * Preact Component for rendering the list of saved palette preview cards.
 */
export function PalettesList({
    palettes,
    activePaletteIndex,
    onActivate,
    onEdit,
    onDelete
}: {
    palettes: Palette[];
    activePaletteIndex?: number;
    onActivate: (index: number) => void;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
}): JSX.Element {
    return (
        <Fragment>
            {palettes.map((palette, idx) => {
                const isActive = idx === activePaletteIndex;
                return (
                    <div key={`${palette.name}-${idx}`} className={`palette-card${isActive ? ' active' : ''}`}>
                        <div className="palette-card-header">
                            <div className="palette-title-wrapper">
                                <span className="palette-name">{palette.name}</span>
                                {isActive && <span className="active-tag">Active</span>}
                            </div>
                        </div>
                        <div className="palette-colors">
                            {palette.colors.map((col, cIdx) => (
                                <div key={cIdx} className="color-bubble" style={{ backgroundColor: col }} />
                            ))}
                        </div>
                        <div className="palette-actions">
                            {!isActive && (
                                <button className="btn-action btn-action-activate" onClick={() => onActivate(idx)}>
                                    Activate
                                </button>
                            )}
                            <button className="btn-action btn-action-edit" onClick={() => onEdit(idx)}>
                                Edit
                            </button>
                            <button className="btn-action btn-action-delete" onClick={() => onDelete(idx)}>
                                Delete
                            </button>
                        </div>
                    </div>
                );
            })}
        </Fragment>
    );
}

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
        this.editingIndex = null;
    }

    /**
     * Initializes components and settings properties from Chrome storage.
     */
    init(): void {
        try {
            chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                try {
                    if (chrome.runtime?.lastError) {
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
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('HighlightOptions', `Error rendering options UI from storage: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error initializing HighlightOptionsManager: ${errorMessage}`, { err });
        }
    }

    /**
     * Registers control element action listeners for default colors, custom slots, palette saving, and defaults reset.
     */
    bindEvents(): void {
        try {
            // Default Highlight Color Event Listeners
            const defaultColorEl = document.getElementById('default-color') as HTMLInputElement | null;
            if (defaultColorEl) {
                defaultColorEl.addEventListener('input', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const hexInput = document.getElementById('default-hex') as HTMLInputElement | null;
                        if (hexInput) hexInput.value = target.value.toUpperCase();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in default color input listener: ${errorMessage}`, { err });
                    }
                });

                defaultColorEl.addEventListener('change', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        this.extensionSettings.defaultHighlightColor = target.value;
                        this.saveSettings("Default highlight color updated!");
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in default color change listener: ${errorMessage}`, { err });
                    }
                });
            }

            const defaultHexEl = document.getElementById('default-hex') as HTMLInputElement | null;
            if (defaultHexEl) {
                defaultHexEl.addEventListener('change', (e: Event) => {
                    try {
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
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in hex input listener: ${errorMessage}`, { err });
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
                        this.editorColors.push('#3498db');
                        this.renderEditorSlots();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in add slot button listener: ${errorMessage}`, { err });
                    }
                });
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
                savePaletteBtn.addEventListener('click', () => {
                    try {
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
                    if (!window.confirm('Are you sure you want to reset all highlighter palettes to defaults? This cannot be undone.')) {
                        return;
                    }
                    try {
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
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HighlightOptions', `Error in reset palettes button listener: ${errorMessage}`, { err });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error binding events: ${errorMessage}`, { err });
        }
    }

    /**
     * Dynamically renders color picker input rows via Preact.
     */
    renderEditorSlots(): void {
        try {
            const container = document.getElementById('palette-slots-container');
            if (!container) return;

            render(
                <PaletteEditorSlots
                    colors={this.editorColors}
                    onColorChange={(idx, newColor) => {
                        this.editorColors[idx] = newColor;
                    }}
                    onDeleteSlot={(idx) => {
                        this.editorColors.splice(idx, 1);
                        this.renderEditorSlots();
                    }}
                />,
                container
            );

            // Toggle button visibility based on slots length
            const addBtn = document.getElementById('add-slot-btn');
            if (addBtn) {
                addBtn.style.display = (this.editorColors.length >= 5) ? 'none' : 'block';
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error rendering editor slots: ${errorMessage}`, { err });
        }
    }

    /**
     * Renders saved palette preview cards via Preact.
     */
    renderPalettesList(): void {
        try {
            const container = document.getElementById('palettes-list-container');
            if (!container) return;

            const palettes = this.extensionSettings.palettes || [];
            const countEl = document.getElementById('palette-count');
            if (countEl) {
                countEl.textContent = `${palettes.length} / 50`;
            }

            render(
                <PalettesList
                    palettes={palettes}
                    activePaletteIndex={this.extensionSettings.activePaletteIndex}
                    onActivate={(idx) => {
                        this.extensionSettings.activePaletteIndex = idx;
                        this.extensionSettings.recentColors = [...palettes[idx].colors];
                        this.saveSettings("Palette activated!");
                    }}
                    onEdit={(idx) => {
                        this.editingIndex = idx;
                        const nameInput = document.getElementById('palette-name-input') as HTMLInputElement | null;
                        if (nameInput) nameInput.value = palettes[idx].name;
                        this.editorColors = [...palettes[idx].colors];
                        this.renderEditorSlots();
                        const saveBtn = document.getElementById('save-palette-btn') as HTMLButtonElement | null;
                        if (saveBtn) {
                            saveBtn.textContent = '💾 Update Palette';
                            saveBtn.disabled = !palettes[idx].name.trim();
                        }
                    }}
                    onDelete={(idx) => {
                        if (palettes.length <= 1) {
                            this.showToast("Cannot delete the only remaining palette.");
                            return;
                        }
                        const isActive = idx === this.extensionSettings.activePaletteIndex;
                        this.extensionSettings.palettes!.splice(idx, 1);
                        if (isActive) {
                            this.extensionSettings.activePaletteIndex = 0;
                            this.extensionSettings.recentColors = [...this.extensionSettings.palettes![0].colors];
                        } else if (this.extensionSettings.activePaletteIndex !== undefined && this.extensionSettings.activePaletteIndex > idx) {
                            this.extensionSettings.activePaletteIndex--;
                        }
                        this.saveSettings("Palette deleted.");
                    }}
                />,
                container
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error rendering palettes list: ${errorMessage}`, { err });
        }
    }

    /**
     * Persists updated settings to `chrome.storage.local` and refreshes the palette cards display.
     */
    saveSettings(message: string | null = null): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                Logger.warn('HighlightOptions', 'Browser storage API unavailable in saveSettings.');
                return;
            }
            chrome.storage.local.set({ extensionSettings: this.extensionSettings }, () => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('HighlightOptions', `Storage error saving extensionSettings: ${errorMessage}`, { error: chrome.runtime.lastError });
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
        }
    }

    /**
     * Renders a temporary floating toast notification in the options UI.
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

