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
 * - `HighlightOptionsApp`: Root Preact component for Highlighter Appearance & Palettes.
 * - `HighlightOptionsManager`: Options controller managing palette CRUD, slot pickers, and storage sync.
 */

import { h, render, Fragment, JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';
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

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface HighlightOptionsAppProps {
    manager?: HighlightOptionsManager;
}

export function HighlightOptionsApp({ manager: initialManager }: HighlightOptionsAppProps): JSX.Element {
    const [manager] = useState(() => initialManager || new HighlightOptionsManager());
    const [settings, setSettings] = useState<ExtensionSettings>(manager.extensionSettings || {});
    const [editorColors, setEditorColors] = useState<string[]>(manager.editorColors || []);
    const [paletteName, setPaletteName] = useState<string>('');
    const [editingIndex, setEditingIndex] = useState<number | null>(manager.editingIndex);
    const [, setRenderTrigger] = useState(0);

    const forceUpdate = () => setRenderTrigger(c => c + 1);

    useEffect(() => {
        manager.onUpdate = () => {
            setSettings({ ...manager.extensionSettings });
            setEditorColors([...manager.editorColors]);
            setEditingIndex(manager.editingIndex);
            forceUpdate();
        };

        chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
            if (result.extensionSettings) {
                manager.extensionSettings = { ...manager.extensionSettings, ...result.extensionSettings };
                if (!manager.extensionSettings.palettes || manager.extensionSettings.palettes.length === 0) {
                    manager.extensionSettings.palettes = JSON.parse(JSON.stringify(manager.DEFAULT_PALETTES));
                    manager.extensionSettings.activePaletteIndex = 0;
                    manager.extensionSettings.recentColors = [...manager.extensionSettings.palettes![0].colors];
                }
                manager.editorColors = [...(manager.extensionSettings.recentColors || [])];
                setSettings({ ...manager.extensionSettings });
                setEditorColors([...manager.editorColors]);
                forceUpdate();
            }
        });
    }, [manager]);

    const defaultColor = settings.defaultHighlightColor || DEFAULT_HIGHLIGHT_COLOR;
    const palettes = settings.palettes || [];

    const handleDefaultColorChange = (newColor: string) => {
        manager.extensionSettings.defaultHighlightColor = newColor;
        manager.saveSettings("Default highlight color updated!");
        setSettings({ ...manager.extensionSettings });
    };

    const handleAddSlot = () => {
        if (editorColors.length >= 5) {
            manager.showToast("A palette can have a maximum of 5 colors.");
            return;
        }
        manager.editorColors.push('#3498db');
        setEditorColors([...manager.editorColors]);
    };

    const handleSavePalette = () => {
        const name = paletteName.trim();
        if (!name) {
            manager.showToast("Please enter a palette name.");
            return;
        }
        if (editorColors.length === 0) {
            manager.showToast("Palette must contain at least 1 color.");
            return;
        }

        const currentPalettes = manager.extensionSettings.palettes || [];
        if (editingIndex === null) {
            if (currentPalettes.length >= 50) {
                manager.showToast("Maximum limit of 50 palettes reached.");
                return;
            }
            currentPalettes.push({ name, colors: [...editorColors] });
            manager.showToast("Palette created successfully!");
        } else {
            currentPalettes[editingIndex] = { name, colors: [...editorColors] };
            manager.showToast("Palette updated successfully!");
            if (editingIndex === manager.extensionSettings.activePaletteIndex) {
                manager.extensionSettings.recentColors = [...editorColors];
            }
        }

        setPaletteName('');
        manager.editingIndex = null;
        setEditingIndex(null);
        manager.editorColors = [...(manager.extensionSettings.recentColors || [])];
        setEditorColors([...manager.editorColors]);
        manager.extensionSettings.palettes = currentPalettes;
        manager.saveSettings();
        setSettings({ ...manager.extensionSettings });
    };

    const handleActivatePalette = (idx: number) => {
        manager.extensionSettings.activePaletteIndex = idx;
        manager.extensionSettings.recentColors = [...palettes[idx].colors];
        manager.saveSettings("Palette activated!");
        setSettings({ ...manager.extensionSettings });
    };

    const handleEditPalette = (idx: number) => {
        manager.editingIndex = idx;
        setEditingIndex(idx);
        setPaletteName(palettes[idx].name);
        manager.editorColors = [...palettes[idx].colors];
        setEditorColors([...manager.editorColors]);
    };

    const handleDeletePalette = (idx: number) => {
        if (palettes.length <= 1) {
            manager.showToast("Cannot delete the only remaining palette.");
            return;
        }
        const isActive = idx === manager.extensionSettings.activePaletteIndex;
        manager.extensionSettings.palettes!.splice(idx, 1);
        if (isActive) {
            manager.extensionSettings.activePaletteIndex = 0;
            manager.extensionSettings.recentColors = [...manager.extensionSettings.palettes![0].colors];
        } else if (manager.extensionSettings.activePaletteIndex !== undefined && manager.extensionSettings.activePaletteIndex > idx) {
            manager.extensionSettings.activePaletteIndex--;
        }
        manager.saveSettings("Palette deleted.");
        setSettings({ ...manager.extensionSettings });
    };

    return (
        <div className="container">
            {/* Page Header */}
            <div className="header">
                <div className="algorecall-brand-badge">
                    <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                        <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                    </svg>
                    <span className="algorecall-brand-name">AlgoRecall</span>
                </div>
                <h2>
                    <svg className="svg-icon header-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Highlighter Appearance
                </h2>
                <p>Customize the default marker color and manage your text selection palettes.</p>
            </div>

            <div className="settings-layout">
                {/* Left Side / General Settings & Editor */}
                <div className="settings-column">
                    <div className="panel">
                        <h3 className="panel-subtitle">General Options</h3>
                        <div className="settings-group">
                            <label>Default Highlight Color</label>
                            <div className="color-row">
                                <input
                                    type="color"
                                    id="default-color"
                                    className="color-picker"
                                    value={defaultColor}
                                    onInput={(e) => handleDefaultColorChange((e.target as HTMLInputElement).value)}
                                />
                                <input
                                    type="text"
                                    className="color-hex"
                                    id="default-hex"
                                    maxLength={7}
                                    value={defaultColor.toUpperCase()}
                                    onChange={(e) => {
                                        let val = (e.target as HTMLInputElement).value.trim();
                                        if (!val.startsWith('#')) val = '#' + val;
                                        if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
                                            handleDefaultColorChange(val);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="panel">
                        <div className="panel-header-row">
                            <h3 className="panel-subtitle">
                                <svg className="svg-icon section-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm1 4a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0zm4.5 4a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0zm-9 0a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0zm4.5 5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0z" />
                                </svg>
                                Palette Creator / Editor
                            </h3>
                            <span id="palette-count" className="badge">{palettes.length} / 50</span>
                        </div>
                        <div className="input-group">
                            <label htmlFor="palette-name-input">Palette Name</label>
                            <input
                                type="text"
                                id="palette-name-input"
                                className="input-field"
                                placeholder="My Custom Palette..."
                                value={paletteName}
                                onInput={(e) => setPaletteName((e.target as HTMLInputElement).value)}
                            />
                        </div>

                        <div className="settings-group" style={{ marginTop: '16px' }}>
                            <label>Palette Colors (1 - 5 Slots)</label>
                            <div id="palette-slots-container" className="slots-list">
                                <PaletteEditorSlots
                                    colors={editorColors}
                                    onColorChange={(idx, newCol) => {
                                        manager.editorColors[idx] = newCol;
                                        setEditorColors([...manager.editorColors]);
                                    }}
                                    onDeleteSlot={(idx) => {
                                        manager.editorColors.splice(idx, 1);
                                        setEditorColors([...manager.editorColors]);
                                    }}
                                />
                            </div>
                            {editorColors.length < 5 && (
                                <button id="add-slot-btn" className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }} onClick={handleAddSlot}>
                                    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Add Color Slot
                                </button>
                            )}
                        </div>

                        <div className="action-buttons" style={{ marginTop: '20px' }}>
                            <button
                                id="save-palette-btn"
                                className="btn btn-primary"
                                disabled={!paletteName.trim()}
                                onClick={handleSavePalette}
                            >
                                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                {editingIndex !== null ? '💾 Update Palette' : '💾 Save Palette'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side / Palettes List */}
                <div className="settings-column">
                    <div className="panel">
                        <h3 className="panel-subtitle">Saved Palettes</h3>
                        <div id="palettes-list-container" className="palettes-list">
                            <PalettesList
                                palettes={palettes}
                                activePaletteIndex={settings.activePaletteIndex}
                                onActivate={handleActivatePalette}
                                onEdit={handleEditPalette}
                                onDelete={handleDeletePalette}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Status toast */}
            <div id="status-toast" className="toast" />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT OPTIONS CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

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
    /** Update observer */
    onUpdate?: () => void;

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
            const root = document.getElementById('root');
            if (root) {
                render(<HighlightOptionsApp manager={this} />, root);
                return;
            }

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
            const root = document.getElementById('root');
            if (root) {
                render(<HighlightOptionsApp manager={this} />, root);
                return;
            }

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
            if (this.onUpdate) this.onUpdate();
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
            const root = document.getElementById('root');
            if (root) {
                render(<HighlightOptionsApp manager={this} />, root);
                return;
            }

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
            if (this.onUpdate) this.onUpdate();
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

export function initHighlightOptions(): void {
    try {
        const root = document.getElementById('root');
        const manager = new HighlightOptionsManager();
        if (root) {
            render(<HighlightOptionsApp manager={manager} />, root);
        } else {
            manager.init();
        }
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

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).PaletteEditorSlots = PaletteEditorSlots;
    (module.exports as any).PalettesList = PalettesList;
    (module.exports as any).HighlightOptionsApp = HighlightOptionsApp;
    (module.exports as any).HighlightOptionsManager = HighlightOptionsManager;
    (module.exports as any).initHighlightOptions = initHighlightOptions;
}
