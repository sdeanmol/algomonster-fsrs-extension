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
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { flushSync } from 'preact/compat';
import { Logger } from '@common/logger';
import { StorageData, ExtensionSettings } from '../../../types/domain';
import { DEFAULT_PALETTES, DEFAULT_EXTENSION_SETTINGS, DEFAULT_HIGHLIGHT_COLOR } from '../../common/constants';

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

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
 * Props for the PaletteEditorSlots component.
 */
export interface PaletteEditorSlotsProps {
    /** Array of hex color strings currently in the palette */
    colors: string[];
    /** Callback when a specific color slot hex value changes */
    onColorChange: (index: number, newColor: string) => void;
    /** Callback to delete a color slot */
    onDeleteSlot: (index: number) => void;
    /** Optional callback when an invalid hex string is entered */
    onInvalidHex?: () => void;
}

/**
 * Preact Component for rendering the color slot editor rows.
 *
 * @param props - Color list and mutation callbacks.
 * @returns JSX rendered palette slot input rows.
 */
export function PaletteEditorSlots({
    colors,
    onColorChange,
    onDeleteSlot,
    onInvalidHex
}: PaletteEditorSlotsProps): JSX.Element {
    const handleHexChange = (idx: number, currentColor: string, e: Event) => {
        const target = e.target as HTMLInputElement;
        let val = target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
            onColorChange(idx, val);
            target.value = val.toUpperCase();
        } else {
            target.value = currentColor.toUpperCase();
            if (onInvalidHex) {
                onInvalidHex();
            }
        }
    };

    return (
        <Fragment>
            {colors.map((color, idx) => (
                <div key={idx} className="slot-row">
                    <input
                        type="color"
                        className="color-picker slot-color-picker"
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
                        onChange={(e: Event) => handleHexChange(idx, color, e)}
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
 * Props for the PalettesList component.
 */
export interface PalettesListProps {
    /** Array of saved palette definitions */
    palettes: Palette[];
    /** Index of the currently active/selected palette */
    activePaletteIndex?: number;
    /** Callback to set a palette as the active highlight palette */
    onActivate: (index: number) => void;
    /** Callback to load a palette into the color slot editor */
    onEdit: (index: number) => void;
    /** Callback to delete a palette */
    onDelete: (index: number) => void;
}

/**
 * Preact Component for rendering the list of saved palette preview cards.
 *
 * @param props - Palettes array, active index, and action callbacks.
 * @returns JSX rendered palette cards.
 */
export function PalettesList({
    palettes,
    activePaletteIndex,
    onActivate,
    onEdit,
    onDelete
}: PalettesListProps): JSX.Element {
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

/**
 * Props for the root HighlightOptionsApp component.
 */
export interface HighlightOptionsAppProps {
    /** Optional controller instance passed during testing or legacy integration */
    manager?: HighlightOptionsManager;
}

/**
 * Root Preact component for Highlighter Appearance & Palettes settings.
 *
 * Provides controls for configuring default marker colors, building custom 5-color palettes,
 * selecting active color schemes, and persisting settings to `chrome.storage.local`.
 *
 * @param props - Component configuration containing optional test manager.
 * @returns JSX rendered highlighter options view.
 */
export function HighlightOptionsApp({ manager: initialManager }: HighlightOptionsAppProps): JSX.Element {
    const [manager] = useState(() => initialManager || new HighlightOptionsManager());
    const [settings, setSettings] = useState<ExtensionSettings>(manager.extensionSettings || {});
    const [editorColors, setEditorColors] = useState<string[]>(manager.editorColors || []);
    const [paletteName, setPaletteName] = useState<string>('');
    const [editingIndex, setEditingIndex] = useState<number | null>(manager.editingIndex);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [toastVisible, setToastVisible] = useState<boolean>(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((msg: string) => {
        safeFlushSync(() => {
            setToastMessage(msg);
            setToastVisible(true);
        });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            safeFlushSync(() => {
                setToastVisible(false);
            });
        }, 3000);
    }, []);

    manager.onToast = showToast;
    manager.onUpdate = () => {
        safeFlushSync(() => {
            setSettings({ ...manager.extensionSettings });
            setEditorColors([...manager.editorColors]);
            setEditingIndex(manager.editingIndex);
            if (manager.editingIndex !== null && manager.extensionSettings.palettes) {
                const p = manager.extensionSettings.palettes[manager.editingIndex];
                if (p) setPaletteName(p.name);
            } else if (manager.editingIndex === null) {
                setPaletteName('');
            }
        });
    };

    const saveSettingsToStorage = useCallback((newSettings: ExtensionSettings, toastMsg?: string) => {
        manager.extensionSettings = newSettings;
        manager.saveSettings(toastMsg);
    }, [manager]);

    useEffect(() => {
        return () => {
            manager.onToast = undefined;
            manager.onUpdate = undefined;
        };
    }, [manager]);

    const defaultColor = settings.defaultHighlightColor || DEFAULT_HIGHLIGHT_COLOR;
    const palettes = settings.palettes || [];

    const handleDefaultColorChange = (newColor: string, isFinal = false) => {
        const nextSettings: ExtensionSettings = {
            ...settings,
            defaultHighlightColor: newColor
        };
        manager.extensionSettings = nextSettings;
        safeFlushSync(() => {
            setSettings(nextSettings);
        });
        if (isFinal) {
            saveSettingsToStorage(nextSettings, "Default highlight color updated!");
        }
    };

    const handleAddSlot = () => {
        if (manager.editorColors.length >= 5) {
            showToast("A palette can have a maximum of 5 colors.");
            return;
        }
        manager.editorColors.push('#3498db');
        safeFlushSync(() => {
            setEditorColors([...manager.editorColors]);
        });
    };

    const handleSavePalette = () => {
        const name = paletteName.trim();
        const currentEditingIndex = manager.editingIndex !== null ? manager.editingIndex : editingIndex;

        if (!name) {
            showToast("Please enter a palette name.");
            return;
        }
        if (manager.editorColors.length === 0) {
            showToast("Palette must contain at least 1 color.");
            return;
        }

        const currentPalettes = manager.extensionSettings.palettes || [];
        if (currentEditingIndex === null) {
            if (currentPalettes.length >= 50) {
                showToast("Maximum limit of 50 palettes reached.");
                return;
            }
            currentPalettes.push({ name, colors: [...manager.editorColors] });
            showToast("Palette created successfully!");
        } else {
            currentPalettes[currentEditingIndex] = { name, colors: [...manager.editorColors] };
            showToast("Palette updated successfully!");
            if (currentEditingIndex === manager.extensionSettings.activePaletteIndex) {
                manager.extensionSettings.recentColors = [...manager.editorColors];
            }
        }

        manager.editingIndex = null;
        manager.editorColors = [...(manager.extensionSettings.recentColors || ['#f1c40f'])];
        manager.extensionSettings.palettes = currentPalettes;
        safeFlushSync(() => {
            setPaletteName('');
            setEditingIndex(null);
            setEditorColors([...manager.editorColors]);
            setSettings({ ...manager.extensionSettings });
        });
        manager.saveSettings();
    };

    const handleActivatePalette = (idx: number) => {
        manager.extensionSettings.activePaletteIndex = idx;
        manager.extensionSettings.recentColors = [...(manager.extensionSettings.palettes || [])[idx].colors];
        safeFlushSync(() => {
            setSettings({ ...manager.extensionSettings });
        });
        saveSettingsToStorage(manager.extensionSettings, "Palette activated!");
    };

    const handleEditPalette = (idx: number) => {
        manager.editingIndex = idx;
        const palette = (manager.extensionSettings.palettes || [])[idx];
        manager.editorColors = [...palette.colors];
        safeFlushSync(() => {
            setEditingIndex(idx);
            setPaletteName(palette.name);
            setEditorColors([...manager.editorColors]);
        });
    };

    const handleDeletePalette = (idx: number) => {
        const palettes = manager.extensionSettings.palettes || [];
        if (palettes.length <= 1) {
            showToast("Cannot delete the only remaining palette.");
            return;
        }
        const isActive = idx === manager.extensionSettings.activePaletteIndex;
        palettes.splice(idx, 1);

        if (isActive) {
            manager.extensionSettings.activePaletteIndex = 0;
            manager.extensionSettings.recentColors = [...palettes[0].colors];
        } else if (manager.extensionSettings.activePaletteIndex !== undefined && manager.extensionSettings.activePaletteIndex > idx) {
            manager.extensionSettings.activePaletteIndex--;
        }

        safeFlushSync(() => {
            setSettings({ ...manager.extensionSettings });
        });
        saveSettingsToStorage(manager.extensionSettings, "Palette deleted.");
    };

    const handleResetPalettes = () => {
        if (!window.confirm('Are you sure you want to reset all highlighter palettes to defaults? This cannot be undone.')) {
            return;
        }
        manager.extensionSettings.palettes = JSON.parse(JSON.stringify(manager.DEFAULT_PALETTES));
        manager.extensionSettings.activePaletteIndex = 0;
        manager.extensionSettings.recentColors = [...manager.extensionSettings.palettes![0].colors];
        manager.extensionSettings.defaultHighlightColor = '#f1c40f';
        manager.editingIndex = null;
        manager.editorColors = [...manager.extensionSettings.recentColors];
        safeFlushSync(() => {
            setEditingIndex(null);
            setPaletteName('');
            setEditorColors([...manager.editorColors]);
            setSettings({ ...manager.extensionSettings });
        });
        saveSettingsToStorage(manager.extensionSettings, 'Reset to defaults successfully!');
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
                {/* Left Side / General Options & Editor */}
                <div className="settings-column">
                    <div className="panel">
                        <h3 className="panel-subtitle">General Options</h3>
                        <div className="settings-group">
                            <label>Default Highlight Color</label>
                            <div className="color-row">
                                <input
                                    type="color"
                                    id="default-color"
                                    className="color-picker default-color-picker"
                                    value={defaultColor}
                                    onInput={(e) => {
                                        const val = (e.target as HTMLInputElement).value;
                                        handleDefaultColorChange(val, false);
                                    }}
                                    onChange={(e) => {
                                        const val = (e.target as HTMLInputElement).value;
                                        handleDefaultColorChange(val, true);
                                    }}
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
                                            handleDefaultColorChange(val, true);
                                        } else {
                                            showToast("Invalid hex code");
                                            (e.target as HTMLInputElement).value = defaultColor.toUpperCase();
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
                                onInput={(e) => {
                                    const val = (e.target as HTMLInputElement).value;
                                    safeFlushSync(() => {
                                        setPaletteName(val);
                                    });
                                }}
                            />
                        </div>

                        <div className="settings-group" style={{ marginTop: '16px' }}>
                            <label>Palette Colors (1 - 5 Slots)</label>
                            <div id="palette-slots-container" className="slots-list">
                                <PaletteEditorSlots
                                    colors={editorColors}
                                    onColorChange={(idx, newColor) => {
                                        manager.editorColors[idx] = newColor;
                                        safeFlushSync(() => {
                                            setEditorColors([...manager.editorColors]);
                                        });
                                    }}
                                    onDeleteSlot={(idx) => {
                                        manager.editorColors.splice(idx, 1);
                                        safeFlushSync(() => {
                                            setEditorColors([...manager.editorColors]);
                                        });
                                    }}
                                    onInvalidHex={() => showToast("Invalid hex code")}
                                />
                            </div>
                            <button
                                id="add-slot-btn"
                                className="btn btn-secondary btn-sm"
                                style={{ marginTop: '8px', display: editorColors.length >= 5 ? 'none' : 'block' }}
                                onClick={handleAddSlot}
                            >
                                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Add Color Slot
                            </button>
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
                                {editingIndex !== null ? ' Update Palette' : ' Save Palette'}
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
                        <hr className="divider" />
                        <button id="reset-palettes-btn" className="btn btn-secondary w-full" onClick={handleResetPalettes}>
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            Reset to Defaults
                        </button>
                    </div>
                </div>
            </div>

            {/* Status toast */}
            <div id="status-toast" className={`toast${toastVisible ? ' show visible' : ''}`}>
                {toastMessage}
            </div>
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
    /** Toast trigger callback */
    onToast?: (msg: string) => void;

    /**
     * Initializes default properties and empty editor states.
     */
    constructor() {
        this.DEFAULT_PALETTES = DEFAULT_PALETTES;
        this.extensionSettings = JSON.parse(JSON.stringify(DEFAULT_EXTENSION_SETTINGS));

        this.editorColors = [...(this.extensionSettings.recentColors || ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'])];
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

                    if (!this.extensionSettings.palettes || this.extensionSettings.palettes.length === 0) {
                        this.extensionSettings.palettes = JSON.parse(JSON.stringify(this.DEFAULT_PALETTES));
                        this.extensionSettings.activePaletteIndex = 0;
                        this.extensionSettings.recentColors = [...this.extensionSettings.palettes![0].colors];
                        this.editorColors = [...this.extensionSettings.recentColors];
                    }

                    if (this.onUpdate) {
                        this.onUpdate();
                    } else {
                        const root = document.getElementById('root');
                        if (root) {
                            safeFlushSync(() => {
                                render(<HighlightOptionsApp manager={this} />, root);
                            });
                        }
                    }
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
     * Helper to render slots declaratively into slots container.
     */
    renderEditorSlots(): void {
        if (this.onUpdate) {
            this.onUpdate();
            return;
        }
        try {
            if (typeof document !== 'undefined') {
                const root = document.getElementById('root');
                if (root) {
                    safeFlushSync(() => {
                        render(<HighlightOptionsApp manager={this} />, root);
                    });
                }
            }
        } catch (_) {}
    }

    /**
     * Helper to render palettes list declaratively into container.
     */
    renderPalettesList(): void {
        if (this.onUpdate) {
            this.onUpdate();
            return;
        }
        try {
            if (typeof document !== 'undefined') {
                const root = document.getElementById('root');
                if (root) {
                    safeFlushSync(() => {
                        render(<HighlightOptionsApp manager={this} />, root);
                    });
                }
            }
        } catch (_) {}
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
            if (this.onToast) {
                this.onToast(message);
                return;
            }
            if (typeof document !== 'undefined') {
                const root = document.getElementById('root');
                if (root) {
                    safeFlushSync(() => {
                        render(<HighlightOptionsApp manager={this} />, root);
                    });
                    const toastFn = (this as any).onToast as ((msg: string) => void) | null;
                    if (toastFn) {
                        toastFn(message);
                    }
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightOptions', `Error showing toast message '${message}': ${errorMessage}`, { message, err });
        }
    }
}

export function initHighlightOptions(): void {
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

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).PaletteEditorSlots = PaletteEditorSlots;
    (module.exports as any).PalettesList = PalettesList;
    (module.exports as any).HighlightOptionsApp = HighlightOptionsApp;
    (module.exports as any).HighlightOptionsManager = HighlightOptionsManager;
    (module.exports as any).initHighlightOptions = initHighlightOptions;
}
