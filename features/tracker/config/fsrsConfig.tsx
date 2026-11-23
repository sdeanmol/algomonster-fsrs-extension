/**
 * @file features/tracker/config/fsrsConfig.tsx
 * @description Manages configuration preferences for the Free Spaced Repetition Scheduler (FSRS).
 * Allows customized requests retention sliders, custom coefficients weights (17 parameters w0-w16),
 * and custom per-topic profiles mapped directly to tags.
 * Migrated to Preact functional components with TypeScript.
 * 
 * Context: Standalone configuration tab (`fsrsConfig.html`) within the Chrome extension.
 * 
 * Key Exports:
 * - `WeightHelpDetail`: Interface describing explanatory tooltips for individual FSRS parameters.
 * - `EligibilityResult`: Interface representing review history qualification metrics for auto-training.
 * - `WeightInputCard`: Preact component for an individual FSRS parameter weight input card.
 * - `WeightsInputsGrid`: Preact component rendering all 17 FSRS parameter weight inputs.
 * - `TagProfilesList`: Preact component for custom per-tag topic weight profiles.
 * - `ModeToggle`: Preact component for switching between Simple and Advanced modes.
 * - `PresetChips`: Preact component for rapid retention preset selection chips.
 * - `AdvancedParametersSection`: Preact component rendering advanced mathematical constants and weight grids.
 * - `FSRSConfigApp`: Root Preact component orchestrating state, parameters, auto-training, and persistence.
 * - `FSRSConfigManager`: Controller and domain helper class supporting declarative Preact execution.
 */

import { h, Fragment, render, VNode } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import FsrsOptimizer from '../scheduler/fsrsOptimizer';
import FsrsOptimizerFast from '../scheduler/fsrsOptimizerFast';
import { Card, FSRSParameters, StorageData } from '../../../types/domain';
import { Logger } from '@common/logger';
import { UIUtils } from '@common/utils/uiUtils';
import { BROWSER_CONFIG } from '@common/browserConfig';
import { ActionService } from '@common/services/actionService';
import {
    DEFAULT_FSRS_W,
    DEFAULT_FSRS_DECAY,
    DEFAULT_FSRS_FACTOR,
    DEFAULT_FSRS_REQUEST_RETENTION
} from '@common/constants';

/**
 * Explanatory tooltip and contextual guidance metadata for an FSRS weight coefficient.
 */
export interface WeightHelpDetail {
    /** Human-readable title of the weight parameter. */
    title: string;
    /** Functional purpose of the coefficient in memory modeling equations. */
    purpose: string;
    /** Practical significance of tweaking this value up or down. */
    significance: string;
}

/**
 * Result metrics evaluating whether user review volume meets the threshold for weight optimization.
 */
export interface EligibilityResult {
    /** Whether review volume meets or exceeds the required training threshold. */
    eligible: boolean;
    /** Total number of qualified historical reviews. */
    count: number;
    /** Total number of unique cards with multiple reviews. */
    uniqueCards?: number;
    /** Target review count threshold required for training. */
    threshold: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightInputCardProps {
    index: number;
    value: number;
    detail: WeightHelpDetail;
    onChange?: (index: number, val: number) => void;
}

/**
 * Preact component for an individual FSRS parameter weight input card with contextual help tooltip.
 */
export function WeightInputCard({
    index,
    value,
    detail,
    onChange
}: WeightInputCardProps): VNode {
    return (
        <div className="weight-input-container">
            <div className="weight-label-wrapper">
                <span className="weight-index">w{index}</span>
                <div className="weight-info-trigger-wrapper" tabIndex={0} aria-label={`Information for w${index}`}>
                    <svg className="svg-icon weight-info-trigger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <div className="weight-tooltip" role="tooltip">
                        <div className="weight-tooltip-header">
                            <span className="weight-tooltip-badge">w{index}</span>
                            <span className="weight-tooltip-title">{detail.title}</span>
                        </div>
                        <div className="weight-tooltip-body">
                            <div className="weight-tooltip-section">
                                <span className="weight-tooltip-label">🎯 Purpose</span>
                                <p className="weight-tooltip-text">{detail.purpose}</p>
                            </div>
                            <div className="weight-tooltip-section">
                                <span className="weight-tooltip-label">💡 Significance</span>
                                <p className="weight-tooltip-text">{detail.significance}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <input
                type="number"
                step="0.01"
                className="weight-num-input"
                id={`weight-input-${index}`}
                value={value}
                onInput={(e) => {
                    const parsed = parseFloat((e.target as HTMLInputElement).value);
                    if (onChange) onChange(index, isNaN(parsed) ? 0 : parsed);
                }}
            />
        </div>
    );
}

export interface WeightsInputsGridProps {
    weights: number[];
    defaultWeights: number[];
    helpDetails: WeightHelpDetail[];
    condensedHelp?: string[];
    onWeightChange?: (index: number, val: number) => void;
}

/**
 * Preact component rendering all 17 FSRS parameter weight inputs in a responsive grid.
 */
export function WeightsInputsGrid({
    weights,
    defaultWeights,
    helpDetails,
    condensedHelp = [],
    onWeightChange
}: WeightsInputsGridProps): VNode {
    const cards = [];
    for (let i = 0; i < 17; i++) {
        const val = weights[i] !== undefined ? weights[i] : (defaultWeights[i] !== undefined ? defaultWeights[i] : 0);
        const detail = helpDetails[i] || {
            title: `Weight w${i}`,
            purpose: condensedHelp[i] || `Coefficient w${i}`,
            significance: "Scales memory stability update."
        };
        cards.push(
            <WeightInputCard
                key={i}
                index={i}
                value={val}
                detail={detail}
                onChange={onWeightChange}
            />
        );
    }

    return <Fragment>{cards}</Fragment>;
}

export interface TagProfilesListProps {
    topicWeights: Record<string, number[]>;
    onDeleteProfile: (tag: string) => void;
}

/**
 * Preact component rendering custom per-tag topic weight profiles.
 */
export function TagProfilesList({
    topicWeights,
    onDeleteProfile
}: TagProfilesListProps): VNode {
    const entries = Object.entries(topicWeights);

    if (entries.length === 0) {
        return (
            <li style={{ justifyContent: 'center', color: 'var(--md-text-low)', fontStyle: 'italic' }}>
                No custom profiles saved yet.
            </li>
        );
    }

    return (
        <Fragment>
            {entries.map(([tag, weights]) => (
                <li key={tag}>
                    <div className="profile-details">
                        <div>
                            <span className="profile-tag-badge">{tag}</span>
                        </div>
                        <span className="profile-weights-text">w: [{Array.isArray(weights) ? weights.join(', ') : String(weights)}]</span>
                    </div>
                    <button
                        className="delete-profile-btn"
                        data-tag={tag}
                        title="Delete this tag weights profile"
                        aria-label="Delete this tag weights profile"
                        onClick={() => onDeleteProfile(tag)}
                    >
                        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                    </button>
                </li>
            ))}
        </Fragment>
    );
}

export interface ModeToggleProps {
    currentMode: 'simple' | 'advanced';
    onSelectMode: (mode: 'simple' | 'advanced') => void;
}

/**
 * Preact component for switching between Simple and Advanced configuration modes.
 */
export function ModeToggle({ currentMode, onSelectMode }: ModeToggleProps): VNode {
    return (
        <div className="mode-toggle-group" role="tablist" aria-label="Configuration Mode">
            <button
                type="button"
                id="mode-simple-btn"
                className={`mode-pill ${currentMode === 'simple' ? 'active' : ''}`}
                role="tab"
                aria-selected={currentMode === 'simple'}
                onClick={() => onSelectMode('simple')}
            >
                Simple (Recommended)
            </button>
            <button
                type="button"
                id="mode-advanced-btn"
                className={`mode-pill ${currentMode === 'advanced' ? 'active' : ''}`}
                role="tab"
                aria-selected={currentMode === 'advanced'}
                onClick={() => onSelectMode('advanced')}
            >
                Advanced (Math &amp; Coefficients)
            </button>
        </div>
    );
}

export interface PresetChipsProps {
    currentRetention: number;
    onSelectRetention: (retention: number) => void;
}

/**
 * Preact component for rapid retention preset chips.
 */
export function PresetChips({ currentRetention, onSelectRetention }: PresetChipsProps): VNode {
    const presets = [
        { label: 'Relaxed (80%)', value: 0.80 },
        { label: 'Balanced (85%)', value: 0.85 },
        { label: 'Optimal (90%)', value: 0.90 },
        { label: 'Intensive (95%)', value: 0.95 }
    ];

    return (
        <div className="preset-chips-container">
            {presets.map((p) => {
                const isActive = Math.abs(currentRetention - p.value) < 0.005;
                return (
                    <button
                        key={p.value}
                        type="button"
                        className={`preset-chip ${isActive ? 'active' : ''}`}
                        data-retention={p.value.toString()}
                        onClick={() => onSelectRetention(p.value)}
                    >
                        {p.label}
                    </button>
                );
            })}
        </div>
    );
}

export interface AdvancedParametersSectionProps {
    mode?: 'simple' | 'advanced';
    decay: number;
    factor: number;
    weights: number[];
    defaultWeights: number[];
    helpDetails: WeightHelpDetail[];
    topicWeights: Record<string, number[]>;
    newTagName: string;
    newTagWeights: string;
    onDecayChange: (val: number) => void;
    onFactorChange: (val: number) => void;
    onWeightChange: (index: number, val: number) => void;
    onNewTagNameChange: (val: string) => void;
    onNewTagWeightsChange: (val: string) => void;
    onSaveGlobal: () => void;
    onResetWeights: () => void;
    onAddProfile: () => void;
    onDeleteProfile: (tag: string) => void;
}

/**
 * Preact component rendering advanced mathematical constants, FSRS coefficients (w0-w16),
 * and tag-specific custom profiles.
 */
export function AdvancedParametersSection({
    mode = 'advanced',
    decay,
    factor,
    weights,
    defaultWeights,
    helpDetails,
    topicWeights,
    newTagName,
    newTagWeights,
    onDecayChange,
    onFactorChange,
    onWeightChange,
    onNewTagNameChange,
    onNewTagWeightsChange,
    onSaveGlobal,
    onResetWeights,
    onAddProfile,
    onDeleteProfile
}: AdvancedParametersSectionProps): VNode {
    return (
        <div
            id="advanced-parameters-section"
            className="advanced-config-only"
            style={{ display: mode === 'advanced' ? '' : 'none' }}
        >
            {/* Advanced Decay & Factor Constants */}
            <div id="advanced-decay-factor" className="grid-2" style={{ marginTop: '16px' }}>
                <div className="form-group">
                    <label htmlFor="decay-input">Decay Constant</label>
                    <input
                        type="number"
                        id="decay-input"
                        className="input-field"
                        step="0.05"
                        value={decay}
                        onInput={(e) => onDecayChange(parseFloat((e.target as HTMLInputElement).value))}
                    />
                    <span className="input-hint">Default is -0.5. Controls memory decay speed.</span>
                </div>
                <div className="form-group">
                    <label htmlFor="factor-input">Factor Constant</label>
                    <input
                        type="number"
                        id="factor-input"
                        className="input-field"
                        step="0.01"
                        value={factor}
                        onInput={(e) => onFactorChange(parseFloat((e.target as HTMLInputElement).value))}
                    />
                    <span className="input-hint">Default is 19/81 (≈0.2346). Scales stability.</span>
                </div>
            </div>

            {/* FSRS Global Weights Configuration Card */}
            <div className="card weights-card" style={{ marginTop: '16px' }}>
                <h2>📊 FSRS Coefficients (w0 - w16)</h2>
                <p className="section-intro">
                    Coefficients that scale memory stability updates. Adjust carefully, or restore defaults if memory scheduling behaves unexpectedly.
                </p>

                <div className="weights-grid" id="weights-inputs-container">
                    <WeightsInputsGrid
                        weights={weights}
                        defaultWeights={defaultWeights}
                        helpDetails={helpDetails}
                        onWeightChange={onWeightChange}
                    />
                </div>

                <div className="weights-actions">
                    <button id="save-global-btn" className="btn btn-primary" onClick={onSaveGlobal}>
                        Save Parameters
                    </button>
                    <button id="reset-weights-btn" className="btn btn-secondary" onClick={onResetWeights}>
                        Reset Coefficients
                    </button>
                </div>
            </div>

            {/* Tag-Specific Weights Card */}
            <div className="card tag-weights-card" style={{ marginTop: '16px' }}>
                <h2>🏷️ Tag-Specific Profiles</h2>
                <p className="section-intro">
                    Create unique FSRS parameters profiles for specific topics (e.g. review Dynamic Programming cards faster than Arrays).
                </p>

                <div className="tag-input-row">
                    <input
                        type="text"
                        id="new-tag-name"
                        className="input-field"
                        placeholder="Tag name (e.g. Dynamic Programming)"
                        value={newTagName}
                        onInput={(e) => onNewTagNameChange((e.target as HTMLInputElement).value)}
                    />
                    <input
                        type="text"
                        id="new-tag-weights"
                        className="input-field"
                        placeholder="17 comma-separated weights (w0,w1,...)"
                        value={newTagWeights}
                        onInput={(e) => onNewTagWeightsChange((e.target as HTMLInputElement).value)}
                    />
                    <button id="add-tag-profile-btn" className="btn btn-primary" onClick={onAddProfile}>
                        Add Profile
                    </button>
                </div>
                <span className="input-hint" style={{ display: 'block', marginTop: '4px' }}>Must contain exactly 17 comma-separated decimal coefficients.</span>

                <div className="profiles-section">
                    <h3>Active Custom Profiles</h3>
                    <ul id="active-tag-profiles-list" className="profiles-list">
                        <TagProfilesList topicWeights={topicWeights} onDeleteProfile={onDeleteProfile} />
                    </ul>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface FSRSConfigAppProps {
    manager?: FSRSConfigManager;
}

/**
 * Root Preact component governing the full FSRS Configuration page.
 */
export function FSRSConfigApp({ manager: initialManager }: FSRSConfigAppProps): VNode {
    const fallbackManagerRef = useRef<FSRSConfigManager | null>(null);
    if (!fallbackManagerRef.current) {
        fallbackManagerRef.current = new FSRSConfigManager();
    }
    const manager = initialManager || fallbackManagerRef.current;
    const [mode, setMode] = useState<'simple' | 'advanced'>(manager.currentMode || 'simple');
    const [retention, setRetention] = useState<number>(manager.defaultRetention || 0.90);
    const [decay, setDecay] = useState<number>(manager.defaultDecay || -0.5);
    const [factor, setFactor] = useState<number>(manager.defaultFactor || 0.234567);
    const [weights, setWeights] = useState<number[]>([...manager.defaultWeights]);
    const [topicWeights, setTopicWeights] = useState<Record<string, number[]>>({});
    const [threshold, setThreshold] = useState<number>(1000);
    const [reviewCount, setReviewCount] = useState<number>(0);
    const [isEligible, setIsEligible] = useState<boolean>(false);
    const [isTraining, setIsTraining] = useState<boolean>(false);
    const [newTagName, setNewTagName] = useState<string>('');
    const [newTagWeights, setNewTagWeights] = useState<string>('');
    const [toastMessage, setToastMessage] = useState<string>('');
    const [toastVisible, setToastVisible] = useState<boolean>(false);
    const [toastIsError, setToastIsError] = useState<boolean>(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((msg: string, isError: boolean = false) => {
        setToastMessage(msg);
        setToastIsError(isError);
        setToastVisible(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            setToastVisible(false);
        }, 2500);
    }, []);

    const refreshFromStorage = useCallback(() => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
        chrome.storage.local.get(['fsrsGlobalParams', 'fsrsTopicWeights', 'fsrsCards', 'extensionSettings'], (result: any) => {
            if (chrome.runtime?.lastError) {
                Logger.error('FSRSConfig', `Storage get error: ${chrome.runtime.lastError.message}`);
                return;
            }
            const params: FSRSParameters = result?.fsrsGlobalParams || {};
            const topics: Record<string, number[]> = result?.fsrsTopicWeights || {};
            if (params.requestRetention !== undefined) {
                setRetention(params.requestRetention);
            }
            if (params.decay !== undefined) {
                setDecay(params.decay);
                manager.currentDecay = params.decay;
            }
            if (params.factor !== undefined) {
                setFactor(params.factor);
                manager.currentFactor = params.factor;
            }
            if (params.w && Array.isArray(params.w) && params.w.length === 17) {
                setWeights([...params.w]);
            }
            setTopicWeights(topics);

            const cards = result?.fsrsCards || [];
            const currentThreshold = manager.currentThreshold ?? threshold;
            const eligibility = manager.computeEligibility(cards, currentThreshold);
            setReviewCount(eligibility.count);
            setIsEligible(eligibility.eligible);
        });
    }, [manager, threshold]);

    const saveParamsToStorage = useCallback((newParams: FSRSParameters, successMsg: string = "FSRS Configuration saved successfully!") => {
        if (isNaN(newParams.decay) || isNaN(newParams.factor)) {
            showToast("Decay and Factor must be valid numbers.", true);
            return;
        }
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => {
                if (chrome.runtime?.lastError) {
                    showToast("Failed to save configuration.", true);
                    return;
                }
                showToast(successMsg);
            });
        }
    }, [showToast]);

    const handleSaveGlobal = useCallback(() => {
        const currentDecay = manager.currentDecay !== undefined ? manager.currentDecay : decay;
        const currentFactor = manager.currentFactor !== undefined ? manager.currentFactor : factor;

        if (isNaN(currentDecay) || isNaN(currentFactor)) {
            showToast("Decay and Factor must be valid numbers.", true);
            return;
        }

        saveParamsToStorage({
            w: weights,
            decay: currentDecay,
            factor: currentFactor,
            requestRetention: retention
        });
    }, [manager, weights, decay, factor, retention, saveParamsToStorage, showToast]);

    const handleResetGlobal = useCallback(() => {
        if (confirm("Reset Request Retention, Decay, and Factor to defaults? (Weights will be kept)")) {
            setRetention(manager.defaultRetention);
            setDecay(manager.defaultDecay);
            setFactor(manager.defaultFactor);
            saveParamsToStorage({
                w: weights,
                decay: manager.defaultDecay,
                factor: manager.defaultFactor,
                requestRetention: manager.defaultRetention
            });
        }
    }, [manager, weights, saveParamsToStorage]);

    const handleResetWeights = useCallback(() => {
        if (confirm("Reset the 17 weights back to default FSRS-4.5 values?")) {
            const defaultW = [...manager.defaultWeights];
            setWeights(defaultW);
            saveParamsToStorage({
                w: defaultW,
                decay,
                factor,
                requestRetention: retention
            });
        }
    }, [manager, decay, factor, retention, saveParamsToStorage]);

    const handleResetOptimization = useCallback(() => {
        if (confirm("Reset personalized weights back to baseline? Any optimization will be lost.")) {
            const defaultW = [...manager.defaultWeights];
            setWeights(defaultW);
            saveParamsToStorage({
                w: defaultW,
                decay,
                factor,
                requestRetention: retention
            }, "Weights reset to baseline defaults.");
        }
    }, [manager, decay, factor, retention, saveParamsToStorage]);

    const handleResetAll = useCallback(() => {
        if (confirm("Reset ALL FSRS configurations and topic profiles to default? This cannot be undone.")) {
            const defaultParams: FSRSParameters = {
                w: manager.defaultWeights,
                decay: manager.defaultDecay,
                factor: manager.defaultFactor,
                requestRetention: manager.defaultRetention
            };
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({
                    fsrsGlobalParams: defaultParams,
                    fsrsTopicWeights: {}
                }, () => {
                    setRetention(manager.defaultRetention);
                    setDecay(manager.defaultDecay);
                    setFactor(manager.defaultFactor);
                    setWeights([...manager.defaultWeights]);
                    setTopicWeights({});
                    showToast("Restored all defaults!");
                });
            }
        }
    }, [manager, showToast]);

    const handleAddProfile = useCallback((tagArg?: string, weightsArg?: number[]) => {
        let tag = tagArg !== undefined ? tagArg : (manager.pendingTagName !== undefined ? manager.pendingTagName : newTagName);
        let weightsArray = weightsArg;

        if (weightsArray === undefined) {
            const wStr = manager.pendingTagWeights !== undefined ? manager.pendingTagWeights : newTagWeights;
            weightsArray = wStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        }

        tag = tag.trim().toLowerCase();

        if (!tag) {
            showToast("Please provide a tag name.", true);
            return;
        }

        if (weightsArray.length !== 17) {
            showToast(`Weights must contain exactly 17 coefficients. Found ${weightsArray.length}.`, true);
            return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['fsrsTopicWeights'], (result: any) => {
                const nextTopics = result?.fsrsTopicWeights || {};
                nextTopics[tag] = weightsArray;
                chrome.storage.local.set({ fsrsTopicWeights: nextTopics }, () => {
                    setTopicWeights({ ...nextTopics });
                    setNewTagName('');
                    setNewTagWeights('');
                    manager.pendingTagName = '';
                    manager.pendingTagWeights = '';
                    showToast(`Custom profile saved for tag: ${tag}`);
                });
            });
        }
    }, [manager, newTagName, newTagWeights, showToast]);

    const handleDeleteProfile = useCallback((tag: string) => {
        if (confirm(`Delete custom weights profile for tag "${tag}"?`)) {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.get(['fsrsTopicWeights'], (result: any) => {
                    const nextTopics = result?.fsrsTopicWeights || {};
                    delete nextTopics[tag];
                    chrome.storage.local.set({ fsrsTopicWeights: nextTopics }, () => {
                        setTopicWeights({ ...nextTopics });
                        showToast(`Deleted profile for tag: ${tag}`);
                    });
                });
            }
        }
    }, [showToast]);

    const handleAutoTrain = useCallback(async () => {
        setIsTraining(true);
        try {
            const result: { fsrsCards?: Card[] } = await new Promise(r => chrome.storage.local.get(['fsrsCards'], r));
            const historyArray = result?.fsrsCards || [];

            let optimizedWeights: number[];
            const onProgress = (current: number, total: number) => {
                Logger.debug('FSRS', `Progress callback fired: ${current}/${total}`, { current, total });
            };

            try {
                const optimizer = new FsrsOptimizer();
                optimizedWeights = await optimizer.trainWeights(historyArray, weights, retention, onProgress);
            } catch (wasmError) {
                const wasmErrMsg = wasmError instanceof Error ? wasmError.message : String(wasmError);
                Logger.warn("FSRS", `WASM Optimizer failed (${wasmErrMsg}). Falling back to Fast JS Optimizer.`, { wasmError });
                const fastOptimizer = new FsrsOptimizerFast();
                optimizedWeights = await fastOptimizer.trainWeights(historyArray, weights, retention, onProgress);
            }

            setWeights(optimizedWeights);

            const newParams: FSRSParameters = {
                w: optimizedWeights,
                decay,
                factor,
                requestRetention: retention,
                version: 'personalized',
                timestamp: Date.now()
            };

            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await new Promise<void>(r => chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => r()));
            }

            showToast("Personal memory optimization successful!", false);

            if (typeof chrome !== 'undefined' && (chrome as any).notifications && BROWSER_CONFIG.supportsNotifications) {
                (chrome as any).notifications.create({
                    type: 'basic',
                    iconUrl: '/icons/icon.png',
                    title: 'Optimization Complete',
                    message: 'Your personalized FSRS weights have been successfully trained in the background!'
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error("FSRS", `Optimization failed: ${errorMessage}`, { err });
            showToast("Optimization failed. See console.", true);
        } finally {
            setIsTraining(false);
        }
    }, [weights, retention, decay, factor, showToast]);

    const handleExportWeights = useCallback(() => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                version: "FSRS-4.5",
                exportDate: new Date().toISOString(),
                w: weights
            }, null, 2));

            ActionService.triggerDomDownload(dataStr, `fsrs_weights_${Date.now()}.json`);
            // showToast("Weights exported to JSON!");
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to export weights: ${errorMessage}`, { err });
            showToast("Export failed.", true);
        }
    }, [weights, showToast]);

    // Synchronously wire manager observer callbacks
    manager.currentMode = mode;
    manager.onSetMode = (newMode: 'simple' | 'advanced') => {
        setMode(newMode);
        manager.currentMode = newMode;
    };
    manager.onSaveGlobalConfig = () => handleSaveGlobal();
    manager.onRestoreDefaults = () => handleResetAll();
    manager.onRestoreGlobalParameters = () => handleResetGlobal();
    manager.onResetOptimization = () => handleResetOptimization();
    manager.onRestoreWeights = () => handleResetWeights();
    manager.onAddTagProfile = (tag, w) => handleAddProfile(tag, w);
    manager.onDeleteTagProfile = (tag) => handleDeleteProfile(tag);
    manager.onAutoTrain = () => handleAutoTrain();
    manager.onExportWeights = () => handleExportWeights();
    manager.onShowToast = (msg, isErr) => showToast(msg, isErr);
    manager.onCheckEligibility = async () => { refreshFromStorage(); };
    manager.onLoadConfig = () => refreshFromStorage();
    manager.onInjectWeights = (newWeights) => setWeights([...newWeights]);
    manager.onRenderTagProfiles = (newTopics) => setTopicWeights({ ...newTopics });
    manager.onUpdate = () => refreshFromStorage();

    // Initial load from storage
    useEffect(() => {
        refreshFromStorage();
    }, [refreshFromStorage]);

    // Cleanup pending toast timer on unmount
    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
        chrome.storage.local.get(['fsrsCards'], (result: any) => {
            const cards = result?.fsrsCards || [];
            const eligibility = manager.computeEligibility(cards, threshold);
            setReviewCount(eligibility.count);
            setIsEligible(eligibility.eligible);
        });
    }, [manager, threshold]);

    const handleSelectMode = (newMode: 'simple' | 'advanced') => {
        setMode(newMode);
        manager.setMode(newMode);
    };

    const handleSelectRetention = (ret: number) => {
        setRetention(ret);
        saveParamsToStorage({
            w: weights,
            decay,
            factor,
            requestRetention: ret
        });
    };

    const handleWeightChange = (index: number, val: number) => {
        const next = [...weights];
        next[index] = val;
        setWeights(next);
    };

    const handleClose = () => {
        UIUtils.closeCurrentTab();
    };

    const progressPercent = Math.min(100, Math.round((reviewCount / threshold) * 100));

    return (
        <div className="container">
            {/* Header */}
            <div className="header">
                <div className="header-main">
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1 id="page-title">FSRS Customizer</h1>
                    <p id="page-subtitle" className="subtitle">Fine-tune memory retention, decay constants, and FSRS weights parameters.</p>
                </div>
                <div className="header-actions">
                    <button id="reset-all-btn" className="btn btn-danger" style={{ marginRight: '12px' }} onClick={handleResetAll}>
                        Reset All
                    </button>
                    <button id="back-to-popup-btn" className="btn btn-secondary" onClick={handleClose}>
                        Close Config
                    </button>
                </div>
            </div>

            <div className="grid-layout">
                {/* Mode Switch */}
                <div className="config-mode-bar">
                    <span className="mode-label">Configuration Mode:</span>
                    <ModeToggle currentMode={mode} onSelectMode={handleSelectMode} />
                </div>

                {/* Global Config Card */}
                <div className="card main-config-card">
                    <h2>⚙️ Global Parameters</h2>
                    <p className="section-intro">
                        FSRS uses target retention rate to scale review intervals. Lower target retention will lead to longer intervals between reviews.
                    </p>

                    <div className="form-group slider-group">
                        <div className="label-row">
                            <label htmlFor="retention-slider">Target Recall Retention Rate</label>
                            <span id="retention-val" className="badge">{Math.round(retention * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            id="retention-slider"
                            min="0.70"
                            max="0.99"
                            step="0.01"
                            value={retention}
                            className="slider-input"
                            onInput={(e) => {
                                const val = parseFloat((e.target as HTMLInputElement).value);
                                setRetention(val);
                            }}
                            onChange={handleSaveGlobal}
                        />
                        <span className="input-hint">Recommended range: 0.75 - 0.95. Higher retention targets yield shorter intervals.</span>
                        <div className="preset-chips" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                            <PresetChips currentRetention={retention} onSelectRetention={handleSelectRetention} />
                        </div>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                        <button id="reset-global-btn" className="btn btn-secondary" onClick={handleResetGlobal}>
                            Reset Global Parameters
                        </button>
                    </div>
                </div>

                {/* Personal Memory Optimization Card */}
                <div className="card optimization-card">
                    <h2>🧠 Optimize for Your Personal Memory</h2>
                    <p className="section-intro">
                        FSRS uses your historical review data to estimate your personal forgetting curve. Continue reviewing normally until you have completed at least <span id="opt-threshold-display">{threshold}</span> reviews. Once enough data has been collected, you can optimize the scheduler so future intervals better match your own memory patterns.
                    </p>

                    <div className="opt-status-container">
                        <div id="opt-progress-section">
                            <div className="opt-progress-header">
                                <span className="opt-progress-title">Personal Memory Training</span>
                                <span id="opt-progress-text" className="opt-progress-text">{reviewCount} / {threshold} Reviews</span>
                            </div>
                            <div className="opt-progress-track">
                                <div id="opt-progress-fill" className="opt-progress-fill" style={{ width: `${progressPercent}%`, backgroundColor: isEligible ? 'var(--md-primary)' : 'var(--md-primary-container)' }} />
                            </div>
                            <p id="opt-status-msg" className="opt-status-msg" style={{ color: isEligible ? 'var(--md-primary)' : 'var(--md-text-low)' }}>
                                {isTraining
                                    ? 'Training in progress... This can take up to 5 minutes for very large histories. Please keep this tab open.'
                                    : (isEligible
                                        ? 'Eligible! You have enough history to train personalized weights.'
                                        : 'Keep reviewing to unlock personalized optimization.')}
                            </p>
                        </div>

                        <div id="opt-actions-section" className="opt-actions" style={{ display: isEligible ? 'flex' : 'none', marginTop: '16px', flexWrap: 'wrap' }}>
                            <button id="btn-auto-train" className="btn btn-primary" style={{ minWidth: '160px' }} disabled={isTraining} onClick={handleAutoTrain}>
                                {isTraining ? 'Training...' : 'Auto Train Weights'}
                            </button>
                            <button id="btn-export-weights" className="btn btn-secondary" onClick={handleExportWeights}>
                                Export
                            </button>
                            <button id="reset-opt-btn" className="btn btn-secondary" onClick={handleResetOptimization}>
                                Reset Optimization
                            </button>
                            <div style={{ flexBasis: '100%', marginTop: '8px', fontSize: '12px', color: 'var(--md-text-low)' }}>
                                💡 Tip: The very first time you train your weights, it may take a few extra seconds to warm up the optimizer. Future runs will be instant!
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '16px' }}>
                            <label htmlFor="opt-threshold-input">Minimum Required Reviews</label>
                            <input
                                type="number"
                                id="opt-threshold-input"
                                className="input-field"
                                value={threshold}
                                min="5"
                                style={{ width: '100px' }}
                                onInput={(e) => {
                                    const parsed = parseInt((e.target as HTMLInputElement).value, 10);
                                    const val = isNaN(parsed) ? 1000 : parsed;
                                    setThreshold(val);
                                    manager.currentThreshold = val;
                                }}
                            />
                            <span className="input-hint">Threshold required to unlock optimization.</span>
                            <div id="opt-threshold-warning" className="actionable-insight-banner warning" style={{ display: threshold < 1000 ? 'flex' : 'none', marginTop: '12px', padding: '12px', flexDirection: 'row', alignItems: 'flex-start', gap: '8px' }}>
                                <svg className="svg-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }}>
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <div style={{ fontSize: '13px' }}>
                                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Warning: Low Review Sample Size</strong>
                                    FSRS relies on statistical confidence. Optimizing with fewer than 1000 reviews can cause the algorithm to overfit to short-term memory anomalies.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Advanced Parameters Section */}
                <AdvancedParametersSection
                    mode={mode}
                    decay={decay}
                    factor={factor}
                    weights={weights}
                    defaultWeights={manager.defaultWeights}
                    helpDetails={manager.weightsHelpDetails}
                    topicWeights={topicWeights}
                    newTagName={newTagName}
                    newTagWeights={newTagWeights}
                    onDecayChange={(val) => {
                        setDecay(val);
                        manager.currentDecay = val;
                    }}
                    onFactorChange={(val) => {
                        setFactor(val);
                        manager.currentFactor = val;
                    }}
                    onWeightChange={handleWeightChange}
                    onNewTagNameChange={(val) => {
                        setNewTagName(val);
                        manager.pendingTagName = val;
                    }}
                    onNewTagWeightsChange={(val) => {
                        setNewTagWeights(val);
                        manager.pendingTagWeights = val;
                    }}
                    onSaveGlobal={handleSaveGlobal}
                    onResetWeights={handleResetWeights}
                    onAddProfile={handleAddProfile}
                    onDeleteProfile={handleDeleteProfile}
                />
            </div>

            {/* Status Toast */}
            <div id="status-toast" className={`toast ${toastVisible ? 'show' : ''} ${toastIsError ? 'error' : 'success'}`}>
                {toastMessage}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG MANAGER CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller and domain helper for FSRS configuration settings and weight optimization workflows.
 */
export class FSRSConfigManager {
    /** Baseline FSRS weights (w0 through w16). */
    public defaultWeights: number[];
    /** Baseline memory decay coefficient. */
    public defaultDecay: number;
    /** Baseline interval calculation factor. */
    public defaultFactor: number;
    /** Baseline desired retention probability (e.g. 0.90 for 90%). */
    public defaultRetention: number;
    /** Detailed explanatory descriptions for each of the 17 weights. */
    public weightsHelpDetails: WeightHelpDetail[];
    /** Condensed string summaries of weight help entries. */
    public weightsHelp: string[];
    /** Current view mode: 'simple' for basic retention slider, 'advanced' for all coefficients. */
    public currentMode: 'simple' | 'advanced';
    public currentThreshold?: number;
    public pendingTagName?: string;
    public pendingTagWeights?: string;
    public currentDecay?: number;
    public currentFactor?: number;
    /** Observer callback notifying root component of state updates. */
    public onUpdate?: () => void;
    /** Observer callbacks wired by active FSRSConfigApp instance. */
    public onSetMode?: (mode: 'simple' | 'advanced') => void;
    public onSaveGlobalConfig?: () => void;
    public onRestoreDefaults?: () => void;
    public onRestoreGlobalParameters?: () => void;
    public onResetOptimization?: () => void;
    public onRestoreWeights?: () => void;
    public onAddTagProfile?: (tag?: string, weights?: number[]) => void;
    public onDeleteTagProfile?: (tag: string) => void;
    public onAutoTrain?: () => Promise<void>;
    public onExportWeights?: () => void;
    public onShowToast?: (msg: string, isError?: boolean) => void;
    public onCheckEligibility?: () => Promise<void>;
    public onLoadConfig?: () => void;
    public onInjectWeights?: (weights: number[]) => void;
    public onRenderTagProfiles?: (profiles: Record<string, number[]>) => void;

    /**
     * Initializes configuration manager defaults and documentation mappings.
     */
    constructor() {
        this.currentMode = 'simple';
        this.defaultWeights = [...DEFAULT_FSRS_W];
        this.defaultDecay = DEFAULT_FSRS_DECAY;
        this.defaultFactor = DEFAULT_FSRS_FACTOR;
        this.defaultRetention = DEFAULT_FSRS_REQUEST_RETENTION;

        this.weightsHelpDetails = [
            {
                title: "Initial Stability (Again)",
                purpose: "Sets the initial memory stability (in days) when a brand-new card is rated 'Again' (1).",
                significance: "Determines how soon a new card must be re-tested after a failed first attempt. Smaller values schedule near-immediate reviews."
            },
            {
                title: "Initial Stability (Hard)",
                purpose: "Sets the initial memory stability (in days) when a brand-new card is rated 'Hard' (2).",
                significance: "Establishes the starting interval for new material that was difficult to recall. Higher values increase initial spacing."
            },
            {
                title: "Initial Stability (Good)",
                purpose: "Sets the initial memory stability (in days) when a brand-new card is rated 'Good' (3).",
                significance: "Defines the standard baseline interval for successful first-time reviews of average difficulty material."
            },
            {
                title: "Initial Stability (Easy)",
                purpose: "Sets the initial memory stability (in days) when a brand-new card is rated 'Easy' (4).",
                significance: "Gives effortless new cards a larger initial review gap, preventing unnecessary early over-testing."
            },
            {
                title: "Initial Difficulty (Baseline)",
                purpose: "Sets the baseline difficulty score (on a 1-10 scale) assigned to new cards upon first review.",
                significance: "Serves as the difficulty anchor; higher baseline difficulty slows down future stability gains across subsequent reviews."
            },
            {
                title: "Difficulty Rating Step",
                purpose: "Scales how much card difficulty increases or decreases based on user performance ratings.",
                significance: "Controls sensitivity to review ratings. Higher values cause difficulty to react more aggressively to 'Again' or 'Hard' ratings."
            },
            {
                title: "Difficulty Mean Reversion",
                purpose: "Applies mean reversion to gradually pull card difficulty back toward average over time.",
                significance: "Prevents card difficulty from getting permanently stuck at extreme values (1 or 10) after temporary performance spikes or lapses."
            },
            {
                title: "Difficulty Fuzz / Modifier",
                purpose: "Modifies the interaction between card difficulty and stability growth during successful recalls.",
                significance: "Fine-tunes interval growth rates specifically for moderately hard versus moderately easy cards."
            },
            {
                title: "Recall Stability Base Multiplier",
                purpose: "Controls the base exponential growth factor of memory stability upon successful recall.",
                significance: "Main engine for interval expansion. Higher values cause review intervals to lengthen much faster after successful reviews."
            },
            {
                title: "Recall Stability Retrievability Sensitivity",
                purpose: "Adjusts stability increase based on retrievability (recall probability) at the moment of review.",
                significance: "Rewards 'desirable difficulty': reviewing a card just before forgetting yields a substantially higher stability boost."
            },
            {
                title: "Recall Stability Difficulty Dampening",
                purpose: "Dampens stability expansion for high-difficulty cards during successful recalls.",
                significance: "Ensures inherently difficult material maintains shorter intervals than easy material even when successfully recalled."
            },
            {
                title: "Recall Stability Delay Bonus",
                purpose: "Modifies stability gains when a card is successfully recalled past its scheduled due date.",
                significance: "Grants extra stability credit for overdue reviews, recognizing successful long-term retention under delay."
            },
            {
                title: "Lapse Stability Base Penalty",
                purpose: "Controls the initial post-lapse stability reduction multiplier when a card is forgotten ('Again').",
                significance: "Determines how sharply interval lengths collapse after a lapse. Lower values cause larger drops in stability."
            },
            {
                title: "Lapse Stability Difficulty Scaling",
                purpose: "Scales post-lapse stability reduction based on the card's current difficulty rating.",
                significance: "Ensures high-difficulty cards suffer harsher stability penalties upon forgetting than easy cards."
            },
            {
                title: "Lapse Stability Recovery Rate",
                purpose: "Modifies how quickly stability recovers across subsequent successful reviews following a lapse.",
                significance: "Controls the rebuilding phase after forgetting. Higher values restore previous spacing intervals more quickly."
            },
            {
                title: "Hard Rating Interval Dampener",
                purpose: "Applies an additional penalty factor to interval growth specifically when a review is rated 'Hard' (2).",
                significance: "Suppresses interval expansion for struggling recalls, keeping review dates closer together until recall solidifies."
            },
            {
                title: "Easy Rating Interval Bonus",
                purpose: "Multiplies stability expansion when a review is rated 'Easy' (4).",
                significance: "Rewards effortless mastery by spacing out subsequent reviews more aggressively."
            }
        ];

        this.weightsHelp = this.weightsHelpDetails.map(d => `${d.title}: ${d.purpose}`);
    }

    /**
     * Initializes the configuration interface by mounting the root Preact component.
     */
    init(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<FSRSConfigApp manager={this} />, root);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to initialize FSRSConfigManager: ${errorMessage}`, { err });
        }
    }

    /**
     * Switches view mode between Simple and Advanced.
     */
    setMode(mode: 'simple' | 'advanced'): void {
        this.currentMode = mode;
        if (this.onSetMode) {
            this.onSetMode(mode);
        }
    }

    bindEvents(): void {}

    async checkOptimizationEligibility(): Promise<void> {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onCheckEligibility) {
            await this.onCheckEligibility();
        }
    }

    async handleAutoTrain(): Promise<void> {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onAutoTrain) {
            await this.onAutoTrain();
        }
    }

    handleExportWeights(): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onExportWeights) {
            this.onExportWeights();
            return;
        }
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                version: "FSRS-4.5",
                exportDate: new Date().toISOString(),
                w: this.defaultWeights
            }, null, 2));

            ActionService.triggerDomDownload(dataStr, `fsrs_weights_${Date.now()}.json`);
        } catch (err) {}
    }

    loadFSRSConfig(): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onLoadConfig) {
            this.onLoadConfig();
            return;
        }
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['fsrsGlobalParams', 'fsrsTopicWeights'], () => {
                if (chrome.runtime?.lastError) {
                    Logger.error('FSRSConfig', `Storage get error: ${chrome.runtime.lastError.message}`);
                }
            });
        }
    }

    injectWeightsInputs(weightsArray: number[]): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onInjectWeights) {
            this.onInjectWeights(weightsArray);
        }
    }

    computeEligibility(history: Card[], threshold: number = 1000): EligibilityResult {
        try {
            if (!history || !Array.isArray(history)) return { eligible: false, count: 0, threshold };

            let reviewCount = 0;
            const uniqueCards = new Set<string>();

            history.forEach(card => {
                if (card.historyLog && card.historyLog.length > 1) {
                    reviewCount += (card.historyLog.length - 1);
                    uniqueCards.add(card.id);
                }
            });

            return {
                eligible: reviewCount >= threshold,
                count: reviewCount,
                uniqueCards: uniqueCards.size,
                threshold
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error computing eligibility: ${errorMessage}`, { err });
            return { eligible: false, count: 0, threshold };
        }
    }

    renderTagProfiles(topicWeights: { [tag: string]: number[] }): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onRenderTagProfiles) {
            this.onRenderTagProfiles(topicWeights);
        }
    }

    saveGlobalConfig(): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onSaveGlobalConfig) {
            this.onSaveGlobalConfig();
            return;
        }
        const decay = this.currentDecay !== undefined ? this.currentDecay : this.defaultDecay;
        const factor = this.currentFactor !== undefined ? this.currentFactor : this.defaultFactor;

        if (isNaN(decay) || isNaN(factor)) {
            this.showToast("Decay and Factor must be valid numbers.", true);
            return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.set({
                fsrsGlobalParams: {
                    w: this.defaultWeights,
                    decay,
                    factor,
                    requestRetention: this.defaultRetention
                }
            });
        }
    }

    restoreDefaults(): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onRestoreDefaults) {
            this.onRestoreDefaults();
            return;
        }
        if (confirm("Reset ALL FSRS configurations and topic profiles to default? This cannot be undone.")) {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({
                    fsrsGlobalParams: {
                        w: this.defaultWeights,
                        decay: this.defaultDecay,
                        factor: this.defaultFactor,
                        requestRetention: this.defaultRetention
                    },
                    fsrsTopicWeights: {}
                });
            }
        }
    }

    restoreGlobalParameters(): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onRestoreGlobalParameters) {
            this.onRestoreGlobalParameters();
            return;
        }
        if (confirm("Reset Request Retention, Decay, and Factor to defaults? (Weights will be kept)")) {
            this.saveGlobalConfig();
        }
    }

    resetOptimization(): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onResetOptimization) {
            this.onResetOptimization();
            return;
        }
        if (confirm("Reset personalized weights back to baseline? Any optimization will be lost.")) {
            this.saveGlobalConfig();
        }
    }

    restoreWeights(): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onRestoreWeights) {
            this.onRestoreWeights();
            return;
        }
        if (confirm("Reset the 17 weights back to default FSRS-4.5 values?")) {
            this.saveGlobalConfig();
        }
    }

    handleAddTagProfile(tag?: string, weights?: number[]): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onAddTagProfile) {
            this.onAddTagProfile(tag, weights);
            return;
        }

        const tagName = (tag !== undefined ? tag : (this.pendingTagName || '')).trim().toLowerCase();
        let weightsArray = weights;
        if (weightsArray === undefined && this.pendingTagWeights) {
            weightsArray = this.pendingTagWeights.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        }

        if (!tagName) {
            this.showToast("Please provide a tag name.", true);
            return;
        }

        if (!weightsArray || weightsArray.length !== 17) {
            this.showToast(`Weights must contain exactly 17 coefficients. Found ${weightsArray ? weightsArray.length : 0}.`, true);
            return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['fsrsTopicWeights'], (result: any) => {
                const nextTopics = result?.fsrsTopicWeights || {};
                nextTopics[tagName] = weightsArray;
                chrome.storage.local.set({ fsrsTopicWeights: nextTopics });
            });
        }
    }

    handleDeleteTagProfile(tag: string): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onDeleteTagProfile) {
            this.onDeleteTagProfile(tag);
            return;
        }
        if (confirm(`Delete custom weights profile for tag "${tag}"?`)) {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.get(['fsrsTopicWeights'], (result: any) => {
                    const nextTopics = result?.fsrsTopicWeights || {};
                    delete nextTopics[tag];
                    chrome.storage.local.set({ fsrsTopicWeights: nextTopics });
                });
            }
        }
    }

    showToast(msg: string, isError: boolean = false): void {
        if (typeof document !== 'undefined' && !document.getElementById('root')) return;
        if (this.onShowToast) {
            this.onShowToast(msg, isError);
        }
    }
}

export function initFSRSConfig(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<FSRSConfigApp />, root);
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('FSRSConfig', `Initialization failed: ${errorMessage}`, { err });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFSRSConfig);
    } else {
        initFSRSConfig();
    }
}

// Augment CommonJS exports to ensure test and module interoperability
if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).FSRSConfigManager = FSRSConfigManager;
    (module.exports as any).WeightInputCard = WeightInputCard;
    (module.exports as any).WeightsInputsGrid = WeightsInputsGrid;
    (module.exports as any).TagProfilesList = TagProfilesList;
    (module.exports as any).ModeToggle = ModeToggle;
    (module.exports as any).PresetChips = PresetChips;
    (module.exports as any).AdvancedParametersSection = AdvancedParametersSection;
    (module.exports as any).FSRSConfigApp = FSRSConfigApp;
}
