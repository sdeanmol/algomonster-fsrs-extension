/**
 * @file Browser Action Popup Primary Application (Pure Declarative Preact)
 * @module features/dashboard/popup/popup
 * @context Browser Action Popup UI (`features/dashboard/popup/popup.html`)
 * @description Master entry point and single-page application for the browser action popup.
 * Pure declarative Preact functional architecture mounting once at `<div id="root"></div>`.
 * Eliminates all imperative DOM querying and mutations.
 */

import { h, Fragment, VNode, render, FunctionalComponent, options } from 'preact';
import { flushSync } from 'preact/compat';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { withErrorHandling } from '../../../decorators';
import { Card, StorageData, ExtensionSettings } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';
import { calculateStreaks, triggerConfetti } from './stats';
import { DEFAULT_EXTENSION_SETTINGS } from '../../common/constants';
import { ThemeSync } from '../../common/theme-sync';
import { ActionService } from '../../common/services/actionService';

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT CHILD COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface PopupHeaderProps {
    onToggleTheme?: () => void;
    onOpenAnalytics?: () => void;
}

export function PopupHeader({ onToggleTheme, onOpenAnalytics }: PopupHeaderProps): VNode {
    return (
        <header className="popup-header">
            <div className="brand-badge">
                <span className="brand-name">AlgoRecall</span>
            </div>
            <div className="header-actions">
                <button
                    id="header-analytics-btn"
                    className="icon-btn"
                    title="Open Full Analytics Dashboard"
                    onClick={onOpenAnalytics}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                </button>
                <button
                    id="theme-toggle-btn"
                    className="icon-btn"
                    title="Toggle Dark / Light Theme"
                    onClick={onToggleTheme}
                >
                    🌓
                </button>
            </div>
        </header>
    );
}

export interface PopupNavigationGridProps {
    onOpenAnalytics?: () => void;
    onOpenHeatmap?: () => void;
    onOpenForecast?: () => void;
    onOpenHistory?: () => void;
    onOpenStudyPlan?: () => void;
    onOpenPomodoro?: () => void;
    onOpenSummary?: () => void;
    onOpenConfigureFsrs?: () => void;
    onOpenPlatforms?: () => void;
    onOpenHelp?: () => void;
}

export function PopupNavigationGrid({
    onOpenAnalytics,
    onOpenHeatmap,
    onOpenForecast,
    onOpenHistory,
    onOpenStudyPlan,
    onOpenPomodoro,
    onOpenSummary,
    onOpenConfigureFsrs,
    onOpenPlatforms,
    onOpenHelp
}: PopupNavigationGridProps): VNode {
    return (
        <div className="navigation-grid">
            <button id="open-analytics-btn" className="nav-btn" onClick={onOpenAnalytics}>
                Analytics
            </button>
            <button id="open-heatmap-tab-btn" className="nav-btn" onClick={onOpenHeatmap}>
                Heatmap
            </button>
            <button id="open-forecast-btn" className="nav-btn" onClick={onOpenForecast}>
                Forecast
            </button>
            <button id="open-history-btn" className="nav-btn" onClick={onOpenHistory}>
                History
            </button>
            <button id="open-studyplan-btn" className="nav-btn" onClick={onOpenStudyPlan}>
                Study Plan
            </button>
            <button id="open-pomodoro-btn" className="nav-btn" onClick={onOpenPomodoro}>
                Pomodoro
            </button>
            <button id="open-summary-page-btn" className="nav-btn" onClick={onOpenSummary}>
                Summary
            </button>
            <button id="configure-fsrs-btn" className="nav-btn" onClick={onOpenConfigureFsrs}>
                Settings
            </button>
            <button id="manage-platforms-btn" className="nav-btn" onClick={onOpenPlatforms}>
                Platforms
            </button>
            <button id="help-btn" className="nav-btn" onClick={onOpenHelp}>
                Help
            </button>
        </div>
    );
}

export interface PopupSettingsTogglesProps {
    markerEnabled: boolean;
    chartsEnabled: boolean;
    launcherEnabled: boolean;
    devModeEnabled: boolean;
    onToggleMarker?: (enabled: boolean) => void;
    onToggleCharts?: (enabled: boolean) => void;
    onToggleLauncher?: (enabled: boolean) => void;
    onToggleDevMode?: (enabled: boolean) => void;
}

export function PopupSettingsToggles({
    markerEnabled,
    chartsEnabled,
    launcherEnabled,
    devModeEnabled,
    onToggleMarker,
    onToggleCharts,
    onToggleLauncher,
    onToggleDevMode
}: PopupSettingsTogglesProps): VNode {
    return (
        <div className="popup-settings-card">
            <div className="setting-toggle-row">
                <label htmlFor="toggle-text-marker">Floating Highlighter</label>
                <input
                    type="checkbox"
                    id="toggle-text-marker"
                    checked={markerEnabled}
                    onChange={(e) => onToggleMarker && onToggleMarker((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-toggle-row">
                <label htmlFor="toggle-show-charts">Activity Charts</label>
                <input
                    type="checkbox"
                    id="toggle-show-charts"
                    checked={chartsEnabled}
                    onChange={(e) => onToggleCharts && onToggleCharts((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-toggle-row">
                <label htmlFor="toggle-tracker-launcher">Problem Tracker Button</label>
                <input
                    type="checkbox"
                    id="toggle-tracker-launcher"
                    checked={launcherEnabled}
                    onChange={(e) => onToggleLauncher && onToggleLauncher((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-toggle-row">
                <label htmlFor="toggle-dev-mode">Developer Mode</label>
                <input
                    type="checkbox"
                    id="toggle-dev-mode"
                    checked={devModeEnabled}
                    onChange={(e) => onToggleDevMode && onToggleDevMode((e.target as HTMLInputElement).checked)}
                />
            </div>
        </div>
    );
}

export interface PopupStatusToastProps {
    message: string | null;
}

export function PopupStatusToast({ message }: PopupStatusToastProps): VNode | null {
    if (!message) return null;
    return (
        <div id="status-msg" className="status-toast show">
            {message}
        </div>
    );
}

export function DailyFocusCard(): VNode {
    return (
        <div id="daily-focus-card" className="card activity-focus-card details-card">
            <div className="card-header-clean">
                <div className="header-label-group">
                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                    <span className="card-title">Daily Focus & Momentum</span>
                </div>
            </div>
            <div id="gamification-panel" className="gamification-wrapper">
                <div id="daily-goal-progress" className="daily-goal-progress" />
                <span id="study-streak-count" className="study-streak-count">0</span>
                <span id="momentum-days" className="momentum-days">0</span>
                <span id="streak-days">0</span>
                <span id="longest-streak">0</span>
                <span id="goal-progress-text">0 / 10</span>
                <svg viewBox="0 0 100 100" style={{ width: '0px', height: '0px', display: 'none' }}>
                    <circle id="goal-progress-ring" cx="50" cy="50" r="42" />
                </svg>
                <input type="hidden" id="daily-goal-target" value="10" />
            </div>
        </div>
    );
}

export interface BentoCommandCenterProps {
    onOpenStudyPlan?: () => void;
    onOpenPomodoro?: () => void;
    onOpenAnalytics?: () => void;
    onOpenForecast?: () => void;
    onOpenSummary?: () => void;
    onOpenHistory?: () => void;
    onOpenHighlights?: () => void;
    onOpenColors?: () => void;
    onOpenSettings?: () => void;
    onPracticeDue?: () => void;
    onOpenHeatmap?: () => void;
}

export function BentoCommandCenter({
    onOpenStudyPlan,
    onOpenPomodoro,
    onOpenAnalytics,
    onOpenForecast,
    onOpenSummary,
    onOpenHistory,
    onOpenHighlights,
    onOpenColors,
    onOpenSettings,
    onPracticeDue,
    onOpenHeatmap
}: BentoCommandCenterProps = {}): VNode {
    return (
        <div id="bento-command-center" className="card details-card quick-launchpad-card">
            <div className="card-header-clean launchpad-header">
                <div className="header-label-group">
                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="card-title">Command Center</span>
                </div>
            </div>

            {/* Bento Hero Practice */}
            <div className="bento-row bento-row-practice">
                <button
                    id="practice-due-btn"
                    className="launch-tile launch-tile-practice"
                    title="Practice All Due Reviews"
                    onClick={onPracticeDue || onOpenStudyPlan}
                >
                    <span className="tile-headline">Start Daily Review Session</span>
                </button>
            </div>

            {/* Bento Tier 1: Primary Focus Engines */}
            <div className="bento-row bento-row-hero">
                <button
                    id="studyplan-btn"
                    className="launch-tile launch-tile-hero"
                    title="Open Exam Mode & Study Plan"
                    onClick={onOpenStudyPlan}
                >
                    <div className="tile-icon-wrap exam-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <div className="tile-content">
                        <span className="tile-headline">Exam Mode</span>
                        <span className="tile-subline">Study Plan</span>
                    </div>
                    <svg className="svg-icon tile-arrow" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>

                <button
                    id="pomodoro-btn"
                    className="launch-tile launch-tile-hero"
                    title="Open Pomodoro Focus Timer"
                    onClick={onOpenPomodoro}
                >
                    <div className="tile-icon-wrap pomodoro-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                    <div className="tile-content">
                        <span className="tile-headline">Pomodoro</span>
                        <span className="tile-subline">Focus Timer</span>
                    </div>
                    <svg className="svg-icon tile-arrow" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            {/* Bento Tier 2: Review Intelligence & Insights */}
            <div className="bento-group-label">INSIGHTS & REVIEW</div>
            <div className="bento-row bento-row-quad">
                <button
                    id="analytics-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Full Analytics Dashboard"
                    onClick={onOpenAnalytics}
                >
                    <div className="tile-icon-wrap analytics-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                    </div>
                    <span className="tile-title">Analytics</span>
                </button>

                <button
                    id="forecast-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Review Forecast"
                    onClick={onOpenForecast}
                >
                    <div className="tile-icon-wrap forecast-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                            <polyline points="17 6 23 6 23 12" />
                        </svg>
                    </div>
                    <span className="tile-title">Forecast</span>
                </button>

                <button
                    id="open-summary-page-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Weekly & Monthly Digest Summary"
                    onClick={onOpenSummary}
                >
                    <div className="tile-icon-wrap summary-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                    </div>
                    <span className="tile-title">Summary</span>
                </button>

                <button
                    id="history-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Review History"
                    onClick={onOpenHistory}
                >
                    <div className="tile-icon-wrap history-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 14 14" />
                            <path d="M3.05 11a9 9 0 0 1 .5-2" />
                        </svg>
                    </div>
                    <span className="tile-title">History</span>
                </button>
            </div>

            {/* Bento Tier 3: Workspace & Customization */}
            <div className="bento-group-label">WORKSPACE & TOOLS</div>
            <div className="bento-row bento-row-trio">
                <button
                    id="manage-highlights-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Highlights Manager"
                    onClick={onOpenHighlights}
                >
                    <div className="tile-icon-wrap highlights-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    </div>
                    <span className="tile-title">Highlights</span>
                </button>

                <button
                    id="open-options-btn"
                    className="launch-tile launch-tile-compact"
                    title="Customize Marker Colors"
                    onClick={onOpenColors}
                >
                    <div className="tile-icon-wrap colors-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                        </svg>
                    </div>
                    <span className="tile-title">Colors</span>
                </button>

                <button
                    id="settings-hub-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Settings & Preferences Hub"
                    onClick={onOpenSettings}
                >
                    <div className="tile-icon-wrap settings-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </div>
                    <span className="tile-title">Settings</span>
                </button>

                <button
                    id="configure-fsrs-btn"
                    className="launch-tile launch-tile-compact"
                    title="Configure FSRS Algorithm Parameters"
                    onClick={onOpenSettings}
                    style={{ display: 'none' }}
                >
                    <span className="tile-title">FSRS Config</span>
                </button>
            </div>
        </div>
    );
}

export interface AchievementsModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function AchievementsModal({ isOpen, onClose }: AchievementsModalProps = {}): VNode {
    return (
        <div
            id="achievements-modal"
            className={`modal-overlay ${isOpen ? '' : 'hide-panel'}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="achievements-modal-title"
        >
            <div className="modal-card">
                <div className="modal-header">
                    <h3 id="achievements-modal-title" className="modal-title">
                        <svg
                            className="svg-icon"
                            viewBox="0 0 24 24"
                            style={{ stroke: 'var(--md-warning)', width: '18px', height: '18px', marginRight: '6px' }}
                        >
                            <circle cx="12" cy="8" r="7" />
                            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                        </svg>
                        Milestones & Records
                    </h3>
                    <button
                        id="close-achievements-btn"
                        className="icon-btn close-modal-btn"
                        aria-label="Close dialog"
                        title="Close dialog"
                        onClick={onClose}
                    >
                        <svg className="svg-icon" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div id="achievements-modal-body" className="modal-body">
                    <p style={{ fontSize: '13px', color: 'var(--md-text-low)' }}>
                        Track your spaced repetition streaks, consistency milestones, and mastery level badges!
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT POPUP COMPONENT (PURE DECLARATIVE PREACT)
// ─────────────────────────────────────────────────────────────────────────────

export interface PopupAppProps {
    initialCards?: Card[];
    initialSettings?: ExtensionSettings;
}

export const PopupApp: FunctionalComponent<PopupAppProps> = ({ initialCards, initialSettings }) => {
    // ── 1. Settings & UI State ──
    const [settings, setSettings] = useState<ExtensionSettings>(() => initialSettings || {
        showMarkerPopup: true,
        showCharts: true,
        showLauncher: true,
        developerMode: false,
        showDailyFocus: true
    });

    const [cards, setCards] = useState<Card[]>(() => initialCards || []);
    const [activity, setActivity] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const [statusToast, setStatusToast] = useState<{ message: string; isError: boolean } | null>(null);
    const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
    const [isAchievementsOpen, setIsAchievementsOpen] = useState<boolean>(false);
    const [ratingStatus, setRatingStatus] = useState<'unrated' | 'snoozed' | 'rated'>('unrated');
    const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');

    // ── 2. Load Stored Data on Mount ──
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    const result = await chrome.storage.local.get([
                        'extensionSettings',
                        'fsrsCards',
                        'fsrsActivity',
                        'ratingSnoozedUntil',
                        'hasRatedStore'
                    ]) as StorageData & { hasRatedStore?: boolean; ratingSnoozedUntil?: number };

                    if (result.extensionSettings) {
                        setSettings(prev => ({ ...prev, ...result.extensionSettings }));
                    }
                    if (result.fsrsCards) {
                        setCards(result.fsrsCards);
                    }
                    if (result.fsrsActivity) {
                        setActivity(result.fsrsActivity);
                    }
                    if (result.hasRatedStore) {
                        setRatingStatus('rated');
                    } else if (result.ratingSnoozedUntil && result.ratingSnoozedUntil > Date.now()) {
                        setRatingStatus('snoozed');
                    }
                }
            } catch (err) {
                UIUtils.catchError('PopupApp', 'Error loading storage data', err);
            }
        };

        loadInitialData();
    }, []);

    // ── 3. Derived Statistics & Metrics ──
    const totalCount = cards.length;
    const dueCards = useMemo(() => {
        const now = Date.now();
        return cards.filter(c => c.due <= now);
    }, [cards]);
    const dueCount = dueCards.length;

    const retentionRate = useMemo(() => {
        if (cards.length === 0) return 0;
        const totalReps = cards.reduce((sum, c) => sum + (c.reps || 0), 0);
        const totalLapses = cards.reduce((sum, c) => sum + (c.lapses || 0), 0);
        if (totalReps === 0) return 100;
        return Math.max(0, Math.min(100, Math.round(((totalReps - totalLapses) / totalReps) * 100)));
    }, [cards]);

    const { current: currentStreak, longest: longestStreak } = useMemo(() => {
        return calculateStreaks(activity);
    }, [activity]);

    const xp = useMemo(() => {
        return cards.reduce((sum, c) => sum + (c.reps || 0) * 10, 0);
    }, [cards]);
    const level = Math.max(1, Math.floor(xp / 100) + 1);
    const xpPercent = xp % 100;

    const allTags = useMemo(() => {
        const set = new Set<string>();
        for (const c of cards) {
            if (c.tags) {
                for (const t of c.tags) set.add(t);
            }
        }
        return Array.from(set).sort();
    }, [cards]);

    const filteredCards = useMemo(() => {
        if (!searchQuery.trim() && selectedTag === 'all') return [];
        return cards.filter(c => {
            const matchesQuery = !searchQuery.trim() ||
                (c.problemTitle && c.problemTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (c.tags && c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
            const matchesTag = selectedTag === 'all' || (c.tags && c.tags.includes(selectedTag));
            return matchesQuery && matchesTag;
        });
    }, [cards, searchQuery, selectedTag]);

    // ── 4. Action Handlers ──
    const showStatus = useCallback((message: string, isError = false) => {
        safeFlushSync(() => {
            setStatusToast({ message, isError });
        });
        setTimeout(() => {
            safeFlushSync(() => {
                setStatusToast(prev => (prev?.message === message ? null : prev));
            });
        }, 2600);
    }, []);

    const openTab = useCallback((urlPath: string) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
                chrome.tabs.create({ url: chrome.runtime.getURL(urlPath) });
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', `Error opening tab for path: ${urlPath}`, err);
        }
    }, []);

    const handleSettingChange = useCallback(async (key: keyof ExtensionSettings, val: boolean) => {
        try {
            const next = { ...settings, [key]: val };
            setSettings(next);
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.set({ extensionSettings: next });
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', `Error saving setting ${String(key)}`, err);
        }
    }, [settings]);

    const handleThemeToggle = useCallback(async () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.get(['theme'], (result) => {
                    const currentTheme = result?.theme || 'dark';
                    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
                    ThemeSync.applyTheme(nextTheme);
                    chrome.storage.local.set({ theme: nextTheme });
                });
            } else {
                ThemeSync.applyTheme('light');
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error toggling theme', err);
        }
    }, []);

    const handleCheckNow = useCallback(() => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'checkDueReviews' }, (response) => {
                    if (response && response.success) {
                        showStatus(`Checked! ${response.dueCount} reviews due.`, false);
                    } else {
                        showStatus('Checked for due reviews.', false);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error checking due reviews', err);
        }
    }, [showStatus]);

    const handleExportLogs = useCallback(async () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                const result = await chrome.storage.local.get(['debugLogs']);
                const logs = result?.debugLogs || [];
                if (!logs || logs.length === 0) {
                    showStatus('No debug logs found.', false);
                    return;
                }
                const jsonStr = JSON.stringify(logs, null, 2);
                if (BROWSER_CONFIG.supportsDownloads && chrome.downloads?.download) {
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    chrome.downloads.download({ url, filename: `algorecall-debug-${Date.now()}.json` }, () => {
                        showStatus('Debug logs exported.', false);
                    });
                } else {
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    ActionService.triggerDomDownload(url, `algorecall-debug-${Date.now()}.json`);
                    showStatus('Debug logs exported.', false);
                }
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error exporting debug logs', err);
        }
    }, [showStatus]);

    const handleKeyDownNavigate = useCallback((e: KeyboardEvent, urlPath: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTab(urlPath);
        }
    }, [openTab]);

    return (
        <div id="popup-app-container">
            {/* Confetti Overlay */}
            <canvas id="confetti-canvas" className="confetti-canvas" />
            <div id="celebration-confetti-canvas" style={{ display: 'none' }} />

            {/* Header: Branding, Level, Controls, and XP Bar */}
            <header className="header-modern">
                <div className="header-main">
                    <h1 className="app-title">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </h1>
                    <div className="header-controls">
                        {/* Gamification Level Badge */}
                        <div
                            id="user-level-badge"
                            className="level-badge"
                            title="Current Gamification Level"
                            onClick={() => setIsAchievementsOpen(true)}
                        >
                            Lv. {level}
                        </div>
                        <span id="level-badge" style={{ display: 'none' }}>Lv. {level}</span>
                        <span id="level-num" style={{ display: 'none' }}>{level}</span>
                        <span id="level-title" style={{ display: 'none' }}>Apprentice</span>

                        {/* Quick Check Button */}
                        <button
                            id="check-now-btn"
                            className="icon-btn check-now-header-btn"
                            title="Check for due reviews immediately"
                            aria-label="Check for due reviews immediately"
                            onClick={handleCheckNow}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                        </button>

                        {/* Header Analytics Button */}
                        <button
                            id="header-analytics-btn"
                            className="icon-btn analytics-header-btn"
                            title="Open Analytics Dashboard"
                            aria-label="Open Analytics Dashboard"
                            onClick={() => openTab('features/dashboard/analytics/analytics.html')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                        </button>

                        {/* Theme Toggle Button */}
                        <button
                            id="theme-toggle-btn"
                            className="icon-btn theme-toggle-btn"
                            title="Toggle Theme"
                            aria-label="Toggle Theme"
                            onClick={handleThemeToggle}
                        >
                            <svg className="svg-icon sun-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                            <svg className="svg-icon moon-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        </button>

                        {/* History Navigation Button */}
                        <button
                            id="history-btn"
                            className="icon-btn history-header-btn"
                            title="Open Review History"
                            aria-label="Open Review History"
                            onClick={() => openTab('features/dashboard/analytics/analytics.html?tab=performance')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 14 14" />
                            </svg>
                        </button>

                        {/* Heatmap Full Screen Button */}
                        <button
                            id="open-heatmap-tab-btn"
                            className="icon-btn heatmap-header-btn"
                            title="Open full screen heatmap"
                            aria-label="Open full screen heatmap"
                            onClick={() => openTab('features/dashboard/analytics/analytics.html?tab=overview')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                        </button>

                        {/* Settings Hub Button */}
                        <button
                            id="settings-hub-btn"
                            className="icon-btn settings-header-btn"
                            title="Open Settings & Preferences Hub"
                            aria-label="Open Settings & Preferences Hub"
                            onClick={() => openTab('features/tracker/config/fsrsConfig.html')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </button>

                        {/* Achievements Button */}
                        <button
                            id="achievements-btn"
                            className="icon-btn achievements-header-btn"
                            title="View unlocked milestones and records"
                            aria-label="View unlocked milestones and records"
                            onClick={() => setIsAchievementsOpen(true)}
                        >
                            🏆
                        </button>

                        {/* Help Button */}
                        <button
                            id="help-btn"
                            className="icon-btn help-btn"
                            title="How it works"
                            aria-label="How it works"
                            onClick={() => openTab('features/common/help/help.html')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* XP Progress Bar */}
                <div
                    className="xp-bar-container"
                    id="xp-progress-bar-container"
                    title="XP Progress to Next Level"
                    role="progressbar"
                    aria-label="XP Progress to Next Level"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={xpPercent}
                >
                    <div id="xp-bar-fill" className="xp-bar-fill" style={{ width: `${xpPercent}%` }} />
                    <span id="xp-text" style={{ display: 'none' }}>{xp} XP</span>
                </div>
            </header>

            <div className="main-content">
                {/* Notification Permission Warning Banner */}
                <div id="permission-warning-banner" className={`banner warning-banner ${notificationPermission === 'granted' ? 'hide-panel' : ''}`}>
                    <div className="banner-content">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span>Reminders work best with notifications enabled.</span>
                    </div>
                    <button id="enable-notifications-btn" className="btn-text-accent" onClick={() => setNotificationPermission('granted')}>Enable</button>
                </div>

                {/* Rating Prompt Card */}
                <div id="rating-prompt-card" className={`card rating-card ${ratingStatus === 'snoozed' ? 'hide-panel' : ''}`}>
                    <div id="rating-prompt-state" className={`rating-state ${ratingStatus === 'rated' ? 'hide-panel' : ''}`}>
                        <div className="rating-text-group">
                            <h3 className="rating-title">Enjoying AlgoRecall? 🌟</h3>
                            <p className="rating-desc" id="rating-prompt-text">Rate us 5 stars to help us grow!</p>
                        </div>
                        <div className="rating-actions-v">
                            <a
                                href={BROWSER_CONFIG.reviewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                id="rate-store-btn"
                                className="btn btn-primary rating-btn"
                                data-review-url={BROWSER_CONFIG.reviewUrl}
                            >
                                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <span id="rate-store-label">Rate on {BROWSER_CONFIG.storeName}</span>
                            </a>
                            <div className="rating-sub-actions">
                                <button id="snooze-rate-btn" className="btn-link" onClick={() => setRatingStatus('snoozed')}>Snooze (7 days)</button>
                                <button id="already-rated-btn" className="btn-link" onClick={() => setRatingStatus('rated')}>Already Rated</button>
                            </div>
                        </div>
                    </div>
                    <div id="rating-thanks-state" className={`rating-state ${ratingStatus !== 'rated' ? 'hide-panel' : ''}`}>
                        <span className="thanks-text">Thank you for supporting us! ❤️</span>
                        <button id="edit-rating-btn" className="btn-link" onClick={() => setRatingStatus('unrated')}>Edit Rating</button>
                    </div>
                </div>

                {/* Hero Section: Stat Boxes, Due Banner, and Search */}
                <div className="card stats-hero">
                    {dueCount > 0 && (
                        <div id="due-banner" className="due-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span>You have <strong>{dueCount} patterns</strong> due for review!</span>
                            <button
                                id="due-cards-btn"
                                className="btn btn-primary btn-sm"
                                onClick={() => openTab('features/tracker/tracker.html?mode=due')}
                            >
                                Review Now
                            </button>
                        </div>
                    )}
                    <div className="stats-grid">
                        <div
                            className="stat-box"
                            id="box-total"
                            title="View all saved patterns"
                            role="button"
                            tabIndex={0}
                            onClick={() => openTab('features/common/data/data.html')}
                            onKeyDown={(e) => handleKeyDownNavigate(e as unknown as KeyboardEvent, 'features/common/data/data.html')}
                        >
                            <span className="stat-value" id="total-cards">{totalCount}</span>
                            <span className="stat-label">Patterns</span>
                        </div>
                        <div
                            className={`stat-box stat-box-due ${dueCount > 20 ? 'danger' : dueCount > 0 ? 'warning' : ''}`}
                            id="box-due"
                            title="View patterns due today"
                            role="button"
                            tabIndex={0}
                            onClick={() => openTab('features/tracker/tracker.html?mode=due')}
                            onKeyDown={(e) => handleKeyDownNavigate(e as unknown as KeyboardEvent, 'features/tracker/tracker.html?mode=due')}
                        >
                            <span className="stat-value" id="due-cards">{dueCount}</span>
                            <span className="stat-label">Due Today</span>
                        </div>
                        <div
                            className="stat-box"
                            id="box-retention"
                            title="View lapsed cards"
                            role="button"
                            tabIndex={0}
                            onClick={() => openTab('features/dashboard/analytics/analytics.html?tab=memory')}
                            onKeyDown={(e) => handleKeyDownNavigate(e as unknown as KeyboardEvent, 'features/dashboard/analytics/analytics.html?tab=memory')}
                        >
                            <span className="stat-value" id="retention-rate">{retentionRate}%</span>
                            <span className="stat-label">Retention</span>
                        </div>
                    </div>

                    {/* Quick Search & Tag Filter */}
                    <div className="search-compact" style={{ marginTop: '12px' }}>
                        <div className="search-input-wrapper">
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                id="search-input"
                                className="search-input"
                                placeholder="Search patterns..."
                                value={searchQuery}
                                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                            />
                            <input
                                type="hidden"
                                id="popup-search-input"
                                value={searchQuery}
                            />
                            {searchQuery && (
                                <button
                                    id="search-clear-btn"
                                    className="search-clear-btn"
                                    title="Clear search"
                                    onClick={() => setSearchQuery('')}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <select
                            id="popup-tag-filter"
                            className="tag-filter-select"
                            aria-label="Filter by tag"
                            value={selectedTag}
                            onChange={(e) => setSelectedTag((e.target as HTMLSelectElement).value)}
                        >
                            <option value="all">All Tags</option>
                            {allTags.map(tag => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tag Filter Pills */}
                    <div id="tag-pills-container" className="tag-pills-container" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {allTags.slice(0, 6).map(tag => (
                            <button
                                key={tag}
                                className={`tag-pill ${selectedTag === tag ? 'active' : ''}`}
                                onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>

                    {/* Search Results Dropdown List */}
                    <div id="search-results">
                        <div id="popup-search-results" className="search-results-container" style={{ display: searchQuery.trim() || selectedTag !== 'all' ? 'block' : 'none' }}>
                            {filteredCards.length === 0 ? (
                                <div className="search-empty-state">No matching patterns found.</div>
                            ) : (
                                filteredCards.slice(0, 10).map(card => (
                                    <a
                                        key={card.id}
                                        href={card.problemUrl || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="search-result-item"
                                    >
                                        <span className="search-result-title">{card.problemTitle || 'Untitled'}</span>
                                        <span className={`search-badge ${card.due <= Date.now() ? 'due' : 'safe'}`}>
                                            {card.due <= Date.now() ? 'Due' : 'Safe'}
                                        </span>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Collapsible Card 1: Daily Focus & Momentum */}
                <details
                    id="daily-focus-card"
                    className="card details-card activity-focus-card"
                    open
                    style={{ display: settings.showDailyFocus !== false ? '' : 'none' }}
                >
                    <summary className="details-summary">
                        <div className="summary-content">
                            <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                            </svg>
                            <span className="card-title">Daily Focus & Momentum</span>
                        </div>
                    </summary>
                    <div className="details-body">
                        <div id="gamification-panel" className="gamification-wrapper">
                            <div id="daily-goal-progress" className="daily-goal-progress">
                                <span id="goal-progress-text">Daily Goal</span>
                                <svg viewBox="0 0 100 100" style={{ width: '0px', height: '0px', display: 'none' }}>
                                    <circle id="goal-progress-ring" cx="50" cy="50" r="42" />
                                </svg>
                            </div>
                            <div className="streak-stats-row" style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                <div>Streak: <strong id="study-streak-count">{currentStreak}</strong>d (Best: <strong id="longest-streak">{longestStreak}</strong>d)</div>
                                <div>Momentum: <strong id="momentum-days">{currentStreak > 0 ? `${currentStreak}d Active` : '0d'}</strong></div>
                                <span id="streak-days" style={{ display: 'none' }}>{currentStreak}</span>
                            </div>
                            <input type="hidden" id="daily-goal-target" value="10" />
                        </div>
                    </div>
                </details>

                {/* Collapsible Card 2: Bento Command Center */}
                <details
                    id="bento-command-center"
                    className="card details-card quick-launchpad-card"
                    open
                >
                    <summary className="details-summary">
                        <div className="summary-content">
                            <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            <span className="card-title">Command Center</span>
                        </div>
                    </summary>
                    <div className="details-body">
                        <BentoCommandCenter
                            onOpenStudyPlan={() => openTab('features/tracker/tracker.html?mode=exam')}
                            onOpenPomodoro={() => openTab('features/tracker/tracker.html?mode=pomodoro')}
                            onOpenAnalytics={() => openTab('features/dashboard/analytics/analytics.html')}
                            onOpenForecast={() => openTab('features/dashboard/analytics/analytics.html?tab=simulation')}
                            onOpenSummary={() => openTab('features/dashboard/analytics/analytics.html?tab=performance')}
                            onOpenHistory={() => openTab('features/dashboard/analytics/analytics.html?tab=insights')}
                            onOpenHighlights={() => openTab('features/highlighter/manager/highlights.html')}
                            onOpenColors={() => openTab('features/highlighter/options/highlightOptions.html')}
                            onOpenSettings={() => openTab('features/tracker/config/fsrsConfig.html')}
                            onPracticeDue={() => openTab('features/tracker/tracker.html?mode=due')}
                        />
                    </div>
                </details>

                {/* Collapsible Card 3: Study Tools */}
                <details id="study-tools-card" className="card details-card">
                    <summary className="details-summary">
                        <div className="summary-content">
                            <span className="card-title">Study Tools</span>
                        </div>
                    </summary>
                    <div className="details-body" style={{ display: 'flex', gap: '8px' }}>
                        <button id="studyplan-btn" className="btn btn-secondary flex-1" onClick={() => openTab('features/tracker/tracker.html?mode=exam')}>
                            Study Plan
                        </button>
                        <button id="pomodoro-btn" className="btn btn-secondary flex-1" onClick={() => openTab('features/tracker/tracker.html?mode=pomodoro')}>
                            Pomodoro
                        </button>
                    </div>
                </details>

                {/* Collapsible Card 4: Activity Charts */}
                <details
                    id="activity-charts-card"
                    className="card details-card heatmap-card heatmap-section"
                    open
                    style={{ display: settings.showCharts !== false ? '' : 'none' }}
                >
                    <summary className="details-summary">
                        <div className="summary-content">
                            <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                            <span className="card-title">Contributions</span>
                        </div>
                    </summary>
                    <div className="details-body">
                        <div className="heatmap-actions-group" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <button id="toggle-lifetime-btn" className="btn-text-subtle">Show Lifetime</button>
                            <button
                                id="open-heatmap-tab-btn"
                                className="btn-icon-text"
                                title="Open full screen heatmap"
                                aria-label="Open full screen heatmap"
                                onClick={() => openTab('features/dashboard/analytics/analytics.html?tab=overview')}
                            >
                                Full Screen
                            </button>
                        </div>
                        <div className="heatmap-container">
                            <div id="heatmap-grid" className="heatmap" />
                        </div>
                    </div>
                </details>

                {/* Collapsible Card 5: Highlighter Settings */}
                <details id="highlighter-settings-card" className="card details-card">
                    <summary className="details-summary">
                        <div className="summary-content">
                            <span className="card-title">Highlighter Settings</span>
                        </div>
                    </summary>
                    <div className="details-body">
                        <div className="setting-row">
                            <label htmlFor="toggle-marker-popup" className="setting-label">Floating Marker</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-marker-popup"
                                    role="switch"
                                    checked={settings.showMarkerPopup !== false}
                                    aria-checked={settings.showMarkerPopup !== false ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('showMarkerPopup', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>
                        <div className="setting-row">
                            <label htmlFor="toggle-algo-launcher" className="setting-label">Tracker Launcher</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-algo-launcher"
                                    role="switch"
                                    checked={settings.showLauncher !== false}
                                    aria-checked={settings.showLauncher !== false ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('showLauncher', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button id="manage-highlights-btn" className="btn btn-secondary btn-sm" onClick={() => openTab('features/highlighter/manager/highlights.html')}>
                                Manage Highlights
                            </button>
                            <button id="open-options-btn" className="btn btn-secondary btn-sm" onClick={() => openTab('features/highlighter/options/highlightOptions.html')}>
                                Options
                            </button>
                        </div>
                        <div className="color-swatches" id="marker-color-swatches" style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <span className="color-swatch" style={{ background: '#fff176', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-block' }} />
                            <span className="color-swatch" style={{ background: '#a7ffeb', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-block' }} />
                            <span className="color-swatch" style={{ background: '#ffd180', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-block' }} />
                            <span className="color-swatch" style={{ background: '#ff80ab', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-block' }} />
                            <span className="color-swatch" style={{ background: '#b388ff', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-block' }} />
                        </div>
                    </div>
                </details>

                {/* Collapsible Card 6: Advanced Settings */}
                <details id="advanced-settings-card" className="card details-card advanced-drawer">
                    <summary className="details-summary">
                        <div className="summary-content">
                            <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                            </svg>
                            <span className="card-title">Advanced Settings</span>
                        </div>
                    </summary>
                    <div className="details-body">
                        <div className="setting-row">
                            <label htmlFor="toggle-show-charts" className="setting-label">Show Analytics & Charts</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-show-charts"
                                    role="switch"
                                    checked={settings.showCharts !== false}
                                    aria-checked={settings.showCharts !== false ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('showCharts', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>
                        <div className="setting-row">
                            <label htmlFor="toggle-daily-focus" className="setting-label">Daily Focus & Momentum</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-daily-focus"
                                    role="switch"
                                    checked={settings.showDailyFocus !== false}
                                    aria-checked={settings.showDailyFocus !== false ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('showDailyFocus', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>
                        <div className="setting-row">
                            <label htmlFor="toggle-dev-mode" className="setting-label">Developer Mode</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-dev-mode"
                                    role="switch"
                                    checked={!!settings.developerMode}
                                    aria-checked={settings.developerMode ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('developerMode', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>
                        <div
                            id="dev-mode-actions"
                            style={{ display: settings.developerMode ? 'block' : 'none', marginTop: '8px', textAlign: 'right' }}
                        >
                            <button id="export-debug-logs-btn" className="btn btn-secondary btn-sm" onClick={handleExportLogs}>
                                Export Debug Logs
                            </button>
                        </div>
                        <div
                            id="notification-settings-card"
                            className="card notification-card"
                            style={{ display: BROWSER_CONFIG.supportsNotifications ? 'block' : 'none' }}
                        >
                            <div
                                id="test-notifications-container"
                                className="button-row"
                                style={{ display: settings.developerMode ? 'flex' : 'none', flexDirection: 'column', gap: '8px', marginTop: '8px' }}
                            >
                                <button id="test-notification-btn" className="btn btn-secondary flex-1">
                                    Send Test Notification
                                </button>
                                <button id="test-summary-notification-btn" className="btn btn-secondary flex-1">
                                    Send Test Summary Notification
                                </button>
                            </div>
                        </div>
                    </div>
                </details>

                {/* Static Review Banner */}
                <div className="static-review-banner">
                    <a href={BROWSER_CONFIG.reviewUrl} target="_blank" rel="noopener noreferrer" id="static-review-link" className="static-review-link">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Love AlgoRecall? Rate us 5 stars!
                    </a>
                </div>

                <footer className="footer-modern">
                    <p>AlgoRecall: 100% Private, Local-First.</p>
                    <a href="../../common/help/help.html?tab=privacy" target="_blank" rel="noopener noreferrer">Help & Privacy</a>
                </footer>
            </div>

            {/* Achievements Modal Dialog */}
            <AchievementsModal isOpen={isAchievementsOpen} onClose={() => setIsAchievementsOpen(false)} />

            {/* Status & Milestone Toasts */}
            <div
                id="status-msg"
                className={`toast modern-toast status-toast ${statusToast ? `show ${statusToast.isError ? 'error' : 'success'}` : ''}`}
            >
                {statusToast?.message || ''}
            </div>
            <div id="milestone-toast" className={`toast milestone-toast ${milestoneToast ? 'show' : ''}`}>
                <span id="milestone-toast-text">{milestoneToast || ''}</span>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE MOUNT ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export const initPopupDashboard = withErrorHandling((): void => {
    const root = document.getElementById('root') || document.body;
    if (root) {
        render(<PopupApp />, root);
    }
}, { context: 'Popup', message: 'Initialization failed' });

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopupDashboard);
    } else {
        initPopupDashboard();
    }
}
