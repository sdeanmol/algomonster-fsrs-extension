/**
 * @file features/tracker/config/fsrsConfig.tsx
 * @description Manages configuration preferences for the Free Spaced Repetition Scheduler (FSRS).
 * Allows customized requests retention sliders, custom coefficients weights (17 parameters w0-w16),
 * and custom per-topic profiles mapped directly to tags.
 * Migrated to Preact with TypeScript for modular, accessible parameter sliders and profiles.
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
 * - `FSRSConfigManager`: Main controller class orchestrating UI forms, training routines, and persistence.
 */

import { h, Fragment, render, VNode } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import FsrsOptimizer from '../scheduler/fsrsOptimizer';
import FsrsOptimizerFast from '../scheduler/fsrsOptimizerFast';
import { Card, FSRSParameters, StorageData } from '../../../types/domain';
import { Logger } from '@common/logger';
import { UIUtils } from '@common/utils/uiUtils';
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
                        <span className="profile-weights-text">w: [{weights.join(', ')}]</span>
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
        <div className="mode-toggle-group">
            <button
                id="mode-simple-btn"
                className={`mode-btn ${currentMode === 'simple' ? 'active' : ''}`}
                role="tab"
                aria-selected={currentMode === 'simple'}
                onClick={() => onSelectMode('simple')}
            >
                Simple
            </button>
            <button
                id="mode-advanced-btn"
                className={`mode-btn ${currentMode === 'advanced' ? 'active' : ''}`}
                role="tab"
                aria-selected={currentMode === 'advanced'}
                onClick={() => onSelectMode('advanced')}
            >
                Advanced
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
    const [manager] = useState(() => initialManager || new FSRSConfigManager());
    const [mode, setMode] = useState<'simple' | 'advanced'>(manager.currentMode || 'simple');
    const [retention, setRetention] = useState<number>(manager.defaultRetention || 0.90);
    const [decay, setDecay] = useState<number>(manager.defaultDecay || -0.5);
    const [factor, setFactor] = useState<number>(manager.defaultFactor || 0.234567);
    const [weights, setWeights] = useState<number[]>([...manager.defaultWeights]);
    const [topicWeights, setTopicWeights] = useState<Record<string, number[]>>({});
    const [threshold, setThreshold] = useState<number>(1000);
    const [reviewCount, setReviewCount] = useState<number>(0);
    const [isEligible, setIsEligible] = useState<boolean>(false);
    const [newTagName, setNewTagName] = useState<string>('');
    const [newTagWeights, setNewTagWeights] = useState<string>('');
    const [, setRenderTrigger] = useState(0);

    const forceUpdate = () => setRenderTrigger(c => c + 1);

    const refreshFromStorage = () => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
        chrome.storage.local.get(['fsrsGlobalParams', 'fsrsTopicWeights', 'fsrsCards', 'extensionSettings'], (result: any) => {
            const params: FSRSParameters = result.fsrsGlobalParams || {};
            const topics: Record<string, number[]> = result.fsrsTopicWeights || {};
            if (params.requestRetention !== undefined) setRetention(params.requestRetention);
            if (params.decay !== undefined) setDecay(params.decay);
            if (params.factor !== undefined) setFactor(params.factor);
            if (params.w && Array.isArray(params.w)) setWeights([...params.w]);
            setTopicWeights(topics);

            // Compute eligibility
            const cards = result.fsrsCards || [];
            let totalReviews = 0;
            cards.forEach((c: any) => {
                if (c.historyLog && Array.isArray(c.historyLog)) {
                    totalReviews += c.historyLog.length;
                }
            });
            setReviewCount(totalReviews);
            const thresh = 1000;
            setIsEligible(totalReviews >= thresh);
            forceUpdate();
        });
    };

    useEffect(() => {
        manager.onUpdate = () => {
            refreshFromStorage();
        };
        refreshFromStorage();
    }, [manager]);

    const handleSelectMode = (newMode: 'simple' | 'advanced') => {
        setMode(newMode);
        manager.setMode(newMode);
    };

    const handleSelectRetention = (ret: number) => {
        setRetention(ret);
        manager.saveGlobalConfig();
    };

    const handleWeightChange = (index: number, val: number) => {
        const next = [...weights];
        next[index] = val;
        setWeights(next);
    };

    const handleDeleteProfile = (tag: string) => {
        manager.handleDeleteTagProfile(tag);
        const next = { ...topicWeights };
        delete next[tag];
        setTopicWeights(next);
    };

    const handleAddProfile = () => {
        manager.handleAddTagProfile();
    };

    const handleResetAll = () => {
        manager.restoreDefaults();
    };

    const handleClose = () => {
        window.close();
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
                            onInput={(e) => setRetention(parseFloat((e.target as HTMLInputElement).value))}
                            onChange={() => manager.saveGlobalConfig()}
                        />
                        <span className="input-hint">Recommended range: 0.75 - 0.95. Higher retention targets yield shorter intervals.</span>
                        <div className="preset-chips" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                            <PresetChips currentRetention={retention} onSelectRetention={handleSelectRetention} />
                        </div>
                    </div>

                    {/* Advanced Mathematical Constants */}
                    <div id="advanced-decay-factor" className="advanced-config-only grid-2" style={{ display: mode === 'advanced' ? 'grid' : 'none', marginTop: '16px' }}>
                        <div className="form-group">
                            <label htmlFor="decay-input">Decay Constant</label>
                            <input
                                type="number"
                                id="decay-input"
                                className="input-field"
                                step="0.05"
                                value={decay}
                                onInput={(e) => setDecay(parseFloat((e.target as HTMLInputElement).value) || 0)}
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
                                onInput={(e) => setFactor(parseFloat((e.target as HTMLInputElement).value) || 0)}
                            />
                            <span className="input-hint">Default is 19/81 (≈0.2346). Scales stability.</span>
                        </div>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                        <button id="reset-global-btn" className="btn btn-secondary" onClick={() => manager.restoreGlobalParameters()}>
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
                                <div id="opt-progress-fill" className="opt-progress-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <p id="opt-status-msg" className="opt-status-msg">
                                {isEligible ? 'Sufficient review volume reached. You can now train your personalized weights.' : 'Keep reviewing to unlock personalized optimization.'}
                            </p>
                        </div>

                        <div id="opt-actions-section" className="opt-actions" style={{ display: isEligible ? 'flex' : 'none', marginTop: '16px', flexWrap: 'wrap' }}>
                            <button id="btn-auto-train" className="btn btn-primary" style={{ minWidth: '160px' }} onClick={() => manager.handleAutoTrain()}>
                                Auto Train Weights
                            </button>
                            <button id="btn-export-weights" className="btn btn-secondary" onClick={() => manager.handleExportWeights()}>
                                Export
                            </button>
                            <button id="reset-opt-btn" className="btn btn-secondary" onClick={() => manager.resetOptimization()}>
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
                                onInput={(e) => setThreshold(parseInt((e.target as HTMLInputElement).value, 10) || 1000)}
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

                {/* FSRS Global Weights Configuration Card */}
                <div className="card weights-card advanced-config-only" style={{ display: mode === 'advanced' ? '' : 'none' }}>
                    <h2>📊 FSRS Coefficients (w0 - w16)</h2>
                    <p className="section-intro">
                        Coefficients that scale memory stability updates. Adjust carefully, or restore defaults if memory scheduling behaves unexpectedly.
                    </p>

                    <div className="weights-grid" id="weights-inputs-container">
                        <WeightsInputsGrid
                            weights={weights}
                            defaultWeights={manager.defaultWeights}
                            helpDetails={manager.weightsHelpDetails}
                            onWeightChange={handleWeightChange}
                        />
                    </div>

                    <div className="weights-actions">
                        <button id="save-global-btn" className="btn btn-primary" onClick={() => manager.saveGlobalConfig()}>
                            Save Parameters
                        </button>
                        <button id="reset-weights-btn" className="btn btn-secondary" onClick={() => manager.restoreWeights()}>
                            Reset Coefficients
                        </button>
                    </div>
                </div>

                {/* Tag-Specific Weights Card */}
                <div className="card tag-weights-card advanced-config-only" style={{ display: mode === 'advanced' ? '' : 'none' }}>
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
                            onInput={(e) => setNewTagName((e.target as HTMLInputElement).value)}
                        />
                        <input
                            type="text"
                            id="new-tag-weights"
                            className="input-field"
                            placeholder="17 comma-separated weights (w0,w1,...)"
                            value={newTagWeights}
                            onInput={(e) => setNewTagWeights((e.target as HTMLInputElement).value)}
                        />
                        <button id="add-tag-profile-btn" className="btn btn-primary" onClick={handleAddProfile}>
                            Add Profile
                        </button>
                    </div>
                    <span className="input-hint" style={{ display: 'block', marginTop: '4px' }}>Must contain exactly 17 comma-separated decimal coefficients.</span>

                    <div className="profiles-section">
                        <h3>Active Custom Profiles</h3>
                        <ul id="active-tag-profiles-list" className="profiles-list">
                            <TagProfilesList topicWeights={topicWeights} onDeleteProfile={handleDeleteProfile} />
                        </ul>
                    </div>
                </div>
            </div>

            {/* Status Toast */}
            <div id="status-toast" className="toast" />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG MANAGER CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for FSRS configuration settings and weight optimization workflows.
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
    /** Observer callback notifying root component of state updates. */
    public onUpdate?: () => void;

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
     * Initializes the configuration interface by binding events, injecting weight inputs,
     * loading stored parameters, and checking optimization eligibility.
     * 
     * @returns {void}
     */
    init(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<FSRSConfigApp manager={this} />, root);
                return;
            }

            this.bindEvents();
            this.injectWeightsInputs(this.defaultWeights);
            this.loadFSRSConfig();
            this.checkOptimizationEligibility();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to initialize FSRSConfigManager: ${errorMessage}`, { err });
        }
    }

    /**
     * Switches UI layout between Simple mode (retention slider only) and Advanced mode (full parameter controls).
     * 
     * @param {'simple' | 'advanced'} mode - Desired presentation mode.
     * @returns {void}
     */
    setMode(mode: 'simple' | 'advanced'): void {
        this.currentMode = mode;
        const simpleBtn = document.getElementById('mode-simple-btn');
        const advancedBtn = document.getElementById('mode-advanced-btn');

        if (mode === 'simple') {
            simpleBtn?.classList.add('active');
            simpleBtn?.setAttribute('aria-selected', 'true');
            advancedBtn?.classList.remove('active');
            advancedBtn?.setAttribute('aria-selected', 'false');
            document.querySelectorAll<HTMLElement>('.advanced-config-only').forEach(el => {
                el.style.display = 'none';
            });
        } else {
            advancedBtn?.classList.add('active');
            advancedBtn?.setAttribute('aria-selected', 'true');
            simpleBtn?.classList.remove('active');
            simpleBtn?.setAttribute('aria-selected', 'false');
            document.querySelectorAll<HTMLElement>('.advanced-config-only').forEach(el => {
                el.style.display = '';
            });
        }
    }

    /**
     * Registers UI event listeners for buttons, sliders, preset chips, and input changes.
     * 
     * @returns {void}
     */
    bindEvents(): void {
        try {
            const modeSimpleBtn = document.getElementById('mode-simple-btn');
            const modeAdvancedBtn = document.getElementById('mode-advanced-btn');
            if (modeSimpleBtn) modeSimpleBtn.addEventListener('click', () => this.setMode('simple'));
            if (modeAdvancedBtn) modeAdvancedBtn.addEventListener('click', () => this.setMode('advanced'));

            const slider = document.getElementById('retention-slider') as HTMLInputElement | null;
            const badge = document.getElementById('retention-val');

            document.querySelectorAll('.preset-chip').forEach(chip => {
                chip.addEventListener('click', (e: Event) => {
                    const target = e.currentTarget as HTMLElement;
                    const retentionStr = target.getAttribute('data-retention');
                    if (retentionStr && slider && badge) {
                        slider.value = retentionStr;
                        badge.textContent = `${Math.round(parseFloat(retentionStr) * 100)}%`;
                        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
                        target.classList.add('active');
                    }
                });
            });

            const backBtn = document.getElementById('back-to-popup-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    UIUtils.closeCurrentTab();
                });
            }

            if (slider && badge) {
                slider.addEventListener('input', (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    badge.textContent = `${Math.round(parseFloat(target.value) * 100)}%`;
                });
            }

            const saveGlobalBtn = document.getElementById('save-global-btn');
            if (saveGlobalBtn) saveGlobalBtn.addEventListener('click', () => this.saveGlobalConfig());

            const resetGlobalBtn = document.getElementById('reset-global-btn');
            if (resetGlobalBtn) resetGlobalBtn.addEventListener('click', () => this.restoreGlobalParameters());

            const resetOptBtn = document.getElementById('reset-opt-btn');
            if (resetOptBtn) resetOptBtn.addEventListener('click', () => this.resetOptimization());

            const resetWeightsBtn = document.getElementById('reset-weights-btn');
            if (resetWeightsBtn) resetWeightsBtn.addEventListener('click', () => this.restoreWeights());

            const resetAllBtn = document.getElementById('reset-all-btn');
            if (resetAllBtn) resetAllBtn.addEventListener('click', () => this.restoreDefaults());

            const addTagProfileBtn = document.getElementById('add-tag-profile-btn');
            if (addTagProfileBtn) addTagProfileBtn.addEventListener('click', () => this.handleAddTagProfile());

            const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement | null;
            if (thresholdInput) {
                thresholdInput.addEventListener('change', () => {
                    const display = document.getElementById('opt-threshold-display');
                    if (display) display.textContent = thresholdInput.value;
                    this.checkOptimizationEligibility();
                });
            }

            const autoTrainBtn = document.getElementById('btn-auto-train');
            if (autoTrainBtn) {
                autoTrainBtn.addEventListener('click', () => this.handleAutoTrain());
            }

            const exportBtn = document.getElementById('btn-export-weights');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.handleExportWeights());
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to bind UI events: ${errorMessage}`, { err });
        }
    }

    /**
     * Checks review history volume against the eligibility threshold to enable or disable the Auto Train button.
     * Updates the training progress bar and status message in the UI.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async checkOptimizationEligibility(): Promise<void> {
        try {
            const result: { fsrsCards?: Card[] } = await new Promise(r => chrome.storage.local.get(['fsrsCards'], r));
            const historyArray = result.fsrsCards || [];

            const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement | null;
            const threshold = parseInt(thresholdInput ? thresholdInput.value : '1000', 10) || 1000;

            const thresholdWarning = document.getElementById('opt-threshold-warning');
            if (thresholdWarning) {
                thresholdWarning.style.display = threshold < 1000 ? 'flex' : 'none';
            }

            const eligibility = this.computeEligibility(historyArray, threshold);

            const progressFill = document.getElementById('opt-progress-fill');
            const progressText = document.getElementById('opt-progress-text');
            const statusMsg = document.getElementById('opt-status-msg');
            const actionsSection = document.getElementById('opt-actions-section');

            const percentage = Math.min(100, Math.round((eligibility.count / threshold) * 100));
            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressText) progressText.textContent = `${eligibility.count} / ${threshold} Reviews`;

            if (statusMsg && progressFill && actionsSection) {
                if (eligibility.eligible) {
                    progressFill.style.backgroundColor = 'var(--md-primary)';
                    statusMsg.textContent = `Eligible! You have enough history to train personalized weights.`;
                    statusMsg.style.color = 'var(--md-primary)';
                    actionsSection.style.display = 'flex';
                } else {
                    progressFill.style.backgroundColor = 'var(--md-primary-container)';
                    statusMsg.textContent = `Keep reviewing to unlock personalized optimization.`;
                    statusMsg.style.color = 'var(--md-text-low)';
                    actionsSection.style.display = 'none';
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error checking optimization eligibility: ${errorMessage}`, { err });
        }
    }

    /**
     * Executes the personalized weights optimization training routine.
     * Attempts to train via the WASM/WASI optimizer (`FsrsOptimizer`), falling back to the pure JS
     * Nelder-Mead simplex optimizer (`FsrsOptimizerFast`) on failure or unsupported environments.
     * Saves resulting weights to `chrome.storage.local` and triggers a system notification.
     * 
     * @async
     * @fires chrome.notifications.create
     * @returns {Promise<void>}
     */
    async handleAutoTrain(): Promise<void> {
        const btn = document.getElementById('btn-auto-train') as HTMLButtonElement | null;
        const statusMsg = document.getElementById('opt-status-msg');

        if (!btn || !statusMsg) return;

        btn.innerHTML = 'Training<span id="train-dots" style="display:inline-block; width:1.2em; text-align:left;">...</span>';
        btn.disabled = true;

        statusMsg.textContent = 'Training in progress... This can take up to 5 minutes for very large histories. Please keep this tab open.';
        statusMsg.style.color = 'var(--md-primary)';

        let dotCount = 0;
        const dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            const dots = document.getElementById('train-dots');
            if (dots) dots.textContent = '.'.repeat(dotCount);
        }, 500);

        try {
            const result: { fsrsCards?: Card[] } = await new Promise(r => chrome.storage.local.get(['fsrsCards'], r));
            const historyArray = result.fsrsCards || [];

            const currentWeights: number[] = [];
            for (let i = 0; i < 17; i++) {
                const input = document.getElementById(`weight-input-${i}`) as HTMLInputElement | null;
                currentWeights.push(input ? parseFloat(input.value) : this.defaultWeights[i]);
            }
            const retentionSlider = document.getElementById('retention-slider') as HTMLInputElement | null;
            const targetRetention = parseFloat(retentionSlider ? retentionSlider.value : '0.90') || 0.90;

            let optimizedWeights: number[];
            const onProgress = (current: number, total: number) => {
                Logger.debug('FSRS', `Progress callback fired: ${current}/${total}`, { current, total });
            };

            try {
                const optimizer = new FsrsOptimizer();
                optimizedWeights = await optimizer.trainWeights(historyArray, currentWeights, targetRetention, onProgress);
            } catch (wasmError) {
                const wasmErrMsg = wasmError instanceof Error ? wasmError.message : String(wasmError);
                Logger.warn("FSRS", `WASM Optimizer failed (${wasmErrMsg}). Falling back to Fast JS Optimizer.`, { wasmError });
                const fastOptimizer = new FsrsOptimizerFast();
                optimizedWeights = await fastOptimizer.trainWeights(historyArray, currentWeights, targetRetention, onProgress);
            }

            this.injectWeightsInputs(optimizedWeights);

            const newParams: FSRSParameters = {
                w: optimizedWeights,
                decay: parseFloat((document.getElementById('decay-input') as HTMLInputElement)?.value) || this.defaultDecay,
                factor: parseFloat((document.getElementById('factor-input') as HTMLInputElement)?.value) || this.defaultFactor,
                requestRetention: targetRetention,
                version: 'personalized',
                timestamp: Date.now()
            };

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await new Promise<void>(r => chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => r()));
            }

            this.showToast("Personal memory optimization successful!", false);

            statusMsg.textContent = "Scheduler optimized successfully using your personal history!";
            statusMsg.style.color = 'var(--md-primary)';

            if (typeof chrome !== 'undefined' && chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '/icons/icon.png',
                    title: 'Optimization Complete',
                    message: 'Your personalized FSRS weights have been successfully trained in the background!'
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error("FSRS", `Optimization failed: ${errorMessage}`, { err });
            this.showToast("Optimization failed. See console.", true);
            statusMsg.textContent = "Optimization failed.";
            statusMsg.style.color = 'var(--md-error)';
        } finally {
            clearInterval(dotInterval);
            btn.textContent = 'Auto Train Weights';
            btn.disabled = false;
        }
    }

    /**
     * Serializes current input weights into a downloadable JSON file and triggers browser download.
     * 
     * @returns {void}
     */
    handleExportWeights(): void {
        try {
            const weights: number[] = [];
            for (let i = 0; i < 17; i++) {
                const input = document.getElementById(`weight-input-${i}`) as HTMLInputElement | null;
                weights.push(input ? parseFloat(input.value) : this.defaultWeights[i]);
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                version: "FSRS-4.5",
                exportDate: new Date().toISOString(),
                w: weights
            }, null, 2));

            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `fsrs_weights_${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            this.showToast("Weights exported to JSON!");
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to export weights: ${errorMessage}`, { err });
            this.showToast("Export failed.", true);
        }
    }

    /**
     * Reads global configuration parameters and custom topic profiles from `chrome.storage.local`
     * and initializes corresponding UI inputs.
     * 
     * @returns {void}
     */
    loadFSRSConfig(): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                Logger.warn('FSRSConfig', 'Browser extension storage unavailable in loadFSRSConfig.');
                return;
            }
            chrome.storage.local.get(['fsrsGlobalParams', 'fsrsTopicWeights'], (result: StorageData & { fsrsTopicWeights?: { [tag: string]: number[] } }) => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('FSRSConfig', `Storage get error in loadFSRSConfig: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    const globalParams: FSRSParameters = (result.fsrsGlobalParams as FSRSParameters) || {
                        w: this.defaultWeights,
                        decay: this.defaultDecay,
                        factor: this.defaultFactor,
                        requestRetention: this.defaultRetention
                    };

                    const slider = document.getElementById('retention-slider') as HTMLInputElement | null;
                    const badge = document.getElementById('retention-val');
                    const decayInput = document.getElementById('decay-input') as HTMLInputElement | null;
                    const factorInput = document.getElementById('factor-input') as HTMLInputElement | null;

                    const retention = globalParams.requestRetention !== undefined ? globalParams.requestRetention : this.defaultRetention;
                    if (slider) slider.value = retention.toString();
                    if (badge) badge.textContent = `${Math.round(retention * 100)}%`;

                    if (decayInput) decayInput.value = (globalParams.decay !== undefined ? globalParams.decay : this.defaultDecay).toString();
                    if (factorInput) factorInput.value = (globalParams.factor !== undefined ? globalParams.factor : this.defaultFactor).toString();

                    const currentWeights = globalParams.w && globalParams.w.length === 17 ? globalParams.w : this.defaultWeights;
                    this.injectWeightsInputs(currentWeights);

                    const topicWeights = result.fsrsTopicWeights || {};
                    this.renderTagProfiles(topicWeights);
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('FSRSConfig', `Error parsing stored FSRS config: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to load storage in loadFSRSConfig: ${errorMessage}`, { err });
        }
    }

    /**
     * Injects the 17 FSRS weight input fields into `#weights-inputs-container` using Preact.
     * 
     * @param {number[]} weightsArray - 17-element array of FSRS weight values.
     * @returns {void}
     */
    injectWeightsInputs(weightsArray: number[]): void {
        try {
            const container = document.getElementById('weights-inputs-container');
            if (!container) return;

            render(
                <WeightsInputsGrid
                    weights={weightsArray}
                    defaultWeights={this.defaultWeights}
                    helpDetails={this.weightsHelpDetails}
                    condensedHelp={this.weightsHelp}
                />,
                container
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to inject weight inputs: ${errorMessage}`, { err });
        }
    }

    /**
     * Evaluates card review logs to calculate total review counts and eligibility against the target threshold.
     * 
     * @param {Card[]} history - Array of all card objects in storage.
     * @param {number} [threshold=1000] - Minimum review count threshold to qualify.
     * @returns {EligibilityResult} Qualification metrics.
     */
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

    /**
     * Renders saved custom topic profiles into `#active-tag-profiles-list` using Preact.
     * 
     * @param {{ [tag: string]: number[] }} topicWeights - Mapping of topic tag names to 17-weight arrays.
     * @returns {void}
     */
    renderTagProfiles(topicWeights: { [tag: string]: number[] }): void {
        try {
            const list = document.getElementById('active-tag-profiles-list');
            if (!list) return;

            render(
                <TagProfilesList
                    topicWeights={topicWeights}
                    onDeleteProfile={(tag) => this.handleDeleteTagProfile(tag)}
                />,
                list
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to render tag profiles: ${errorMessage}`, { err });
        }
    }

    /**
     * Validates input values and saves the global FSRS configuration (weights, decay, factor, target retention)
     * back into `chrome.storage.local`.
     * 
     * @returns {void}
     */
    saveGlobalConfig(): void {
        try {
            const slider = document.getElementById('retention-slider') as HTMLInputElement | null;
            const decayInput = document.getElementById('decay-input') as HTMLInputElement | null;
            const factorInput = document.getElementById('factor-input') as HTMLInputElement | null;

            const retention = slider ? parseFloat(slider.value) : this.defaultRetention;
            const decay = decayInput ? parseFloat(decayInput.value) : this.defaultDecay;
            const factor = factorInput ? parseFloat(factorInput.value) : this.defaultFactor;

            if (isNaN(decay) || isNaN(factor)) {
                this.showToast("Decay and Factor must be valid numbers.", true);
                return;
            }

            const currentWeights: number[] = [];
            for (let i = 0; i < 17; i++) {
                const input = document.getElementById(`weight-input-${i}`) as HTMLInputElement | null;
                const val = input ? parseFloat(input.value) : this.defaultWeights[i];
                currentWeights.push(isNaN(val) ? this.defaultWeights[i] : val);
            }

            const newParams: FSRSParameters = {
                w: currentWeights,
                decay: decay,
                factor: factor,
                requestRetention: retention
            };

            chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('FSRSConfig', `Storage set error in saveGlobalConfig: ${errorMessage}`, { error: chrome.runtime.lastError });
                        this.showToast("Failed to save configuration.", true);
                        return;
                    }
                    this.showToast("FSRS Configuration saved successfully!");
                } catch (cbErr) {
                    const errorMessage = cbErr instanceof Error ? cbErr.message : String(cbErr);
                    Logger.error('FSRSConfig', `Error in storage set callback: ${errorMessage}`, { cbErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error saving global config: ${errorMessage}`, { err });
            this.showToast("Error saving configuration.", true);
        }
    }

    /**
     * Resets all FSRS configuration (weights, decay, factor, retention, custom profiles) back to factory defaults.
     * 
     * @returns {void}
     */
    restoreDefaults(): void {
        try {
            if (confirm("Reset ALL FSRS configurations and topic profiles to default? This cannot be undone.")) {
                const defaultParams: FSRSParameters = {
                    w: this.defaultWeights,
                    decay: this.defaultDecay,
                    factor: this.defaultFactor,
                    requestRetention: this.defaultRetention
                };
                chrome.storage.local.set({
                    fsrsGlobalParams: defaultParams,
                    fsrsTopicWeights: {}
                }, () => {
                    this.loadFSRSConfig();
                    this.showToast("Restored all defaults!");
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error restoring defaults: ${errorMessage}`, { err });
        }
    }

    /**
     * Resets global parameters (retention, decay, factor) back to baseline values without altering weights.
     * 
     * @returns {void}
     */
    restoreGlobalParameters(): void {
        try {
            if (confirm("Reset Request Retention, Decay, and Factor to defaults? (Weights will be kept)")) {
                const slider = document.getElementById('retention-slider') as HTMLInputElement | null;
                const badge = document.getElementById('retention-val');
                const decayInput = document.getElementById('decay-input') as HTMLInputElement | null;
                const factorInput = document.getElementById('factor-input') as HTMLInputElement | null;

                if (slider) slider.value = this.defaultRetention.toString();
                if (badge) badge.textContent = `${Math.round(this.defaultRetention * 100)}%`;
                if (decayInput) decayInput.value = this.defaultDecay.toString();
                if (factorInput) factorInput.value = this.defaultFactor.toString();

                this.saveGlobalConfig();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error restoring global parameters: ${errorMessage}`, { err });
        }
    }

    /**
     * Reverts optimized weights back to baseline defaults, clearing optimization history state.
     * 
     * @returns {void}
     */
    resetOptimization(): void {
        try {
            if (confirm("Reset personalized weights back to baseline? Any optimization will be lost.")) {
                this.injectWeightsInputs(this.defaultWeights);
                this.saveGlobalConfig();
                this.checkOptimizationEligibility();
                this.showToast("Weights reset to baseline defaults.");
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error in resetOptimization: ${errorMessage}`, { err });
        }
    }

    /**
     * Resets the 17 weight coefficients back to default FSRS-4.5 weights.
     * 
     * @returns {void}
     */
    restoreWeights(): void {
        try {
            if (confirm("Reset the 17 weights back to default FSRS-4.5 values?")) {
                this.injectWeightsInputs(this.defaultWeights);
                this.saveGlobalConfig();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error restoring weights: ${errorMessage}`, { err });
        }
    }

    /**
     * Parses and validates a new custom per-tag topic weight profile, persisting it to `chrome.storage.local`.
     * 
     * @returns {void}
     */
    handleAddTagProfile(): void {
        try {
            const tagInput = document.getElementById('new-tag-name') as HTMLInputElement | null;
            const weightsInput = document.getElementById('new-tag-weights') as HTMLInputElement | null;

            if (!tagInput || !weightsInput) return;

            const tag = tagInput.value.trim().toLowerCase();
            const weightsStr = weightsInput.value.trim();

            if (!tag) {
                this.showToast("Please provide a tag name.", true);
                return;
            }

            const weightsArray = weightsStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
            if (weightsArray.length !== 17) {
                this.showToast(`Weights must contain exactly 17 coefficients. Found ${weightsArray.length}.`, true);
                return;
            }

            chrome.storage.local.get(['fsrsTopicWeights'], (result: StorageData & { fsrsTopicWeights?: { [tag: string]: number[] } }) => {
                try {
                    const topicWeights = result.fsrsTopicWeights || {};
                    topicWeights[tag] = weightsArray;
                    chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, () => {
                        this.renderTagProfiles(topicWeights);
                        tagInput.value = '';
                        weightsInput.value = '';
                        this.showToast(`Custom profile saved for tag: ${tag}`);
                    });
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('FSRSConfig', `Error persisting new tag profile for ${tag}: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error handling add tag profile: ${errorMessage}`, { err });
        }
    }

    /**
     * Deletes a custom per-tag topic profile from `chrome.storage.local`.
     * 
     * @param {string} tag - Tag name of the profile to remove.
     * @returns {void}
     */
    handleDeleteTagProfile(tag: string): void {
        try {
            if (confirm(`Delete custom weights profile for tag "${tag}"?`)) {
                chrome.storage.local.get(['fsrsTopicWeights'], (result: StorageData & { fsrsTopicWeights?: { [tag: string]: number[] } }) => {
                    try {
                        const topicWeights = result.fsrsTopicWeights || {};
                        delete topicWeights[tag];
                        chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, () => {
                            this.renderTagProfiles(topicWeights);
                            this.showToast(`Deleted profile for tag: ${tag}`);
                        });
                    } catch (innerErr) {
                        const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                        Logger.error('FSRSConfig', `Error removing tag profile for ${tag}: ${errorMessage}`, { innerErr });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error handling delete tag profile: ${errorMessage}`, { err });
        }
    }

    /**
     * Displays a transient status feedback toast in the configuration view.
     * 
     * @param {string} msg - Message to display.
     * @param {boolean} [isError=false] - Whether the notification represents an error state.
     * @returns {void}
     */
    showToast(msg: string, isError: boolean = false): void {
        try {
            const toast = document.getElementById('status-toast');
            if (!toast) return;
            toast.textContent = msg;
            toast.className = 'toast show ' + (isError ? 'error' : 'success');
            setTimeout(() => {
                toast.className = 'toast';
            }, 2500);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.debug('FSRSConfig', `Ignore toast display error: ${errorMessage}`, { msg, err });
        }
    }
}

export function initFSRSConfig(): void {
    try {
        const manager = new FSRSConfigManager();
        manager.init();
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
}
