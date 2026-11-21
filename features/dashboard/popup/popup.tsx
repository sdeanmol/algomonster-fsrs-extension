
/**
 * @file Browser Action Popup Primary Application (Preact)
 * @module features/dashboard/popup/popup
 * @context Browser Action Popup UI (`features/dashboard/popup/popup.html`)
 * @description Master entry point and single-page application for the browser action popup.
 * Orchestrates hero stats overview, daily study goal progress ring, contribution heatmap,
 * quick search with tag filtering, notification preferences, study tool launchers, and backup/restore.
 *
 * Key Exports:
 * - `PopupApp`: Root Preact application component.
 * - `PopupHeader`: Preact header component with brand badge, analytics launcher, and theme toggle.
 * - `PopupNavigationGrid`: Preact grid launcher for study tools and configuration pages.
 * - `AlgoRecallDashboard`: Coordinator controller orchestrating popup sub-views and storage sync.
 */

import { h, Fragment, VNode, render, FunctionalComponent } from "preact";
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { CatchAndLog, MeasureTime, withErrorHandling } from '../../../decorators';
import { StatsComponent } from './stats';
import { HeatmapComponent } from './heatmap';
import { NotificationsComponent } from './notifications';
import { RatingComponent } from './rating';
import { QuickSearchComponent } from './search';
import { StorageData, ExtensionSettings } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';
import { ActionService } from '../../common/services/actionService';


/**
 * Props for the PopupHeader component.
 */
export interface PopupHeaderProps {
    /** Callback to toggle between light and dark theme */
    onToggleTheme?: () => void;
    /** Callback to open the full analytics dashboard in a new tab */
    onOpenAnalytics?: () => void;
}

/**
 * Preact component rendering the popup header bar with branding and actions.
 *
 * @param props - Header action callbacks for theme and analytics.
 * @returns VNode rendered header element.
 */
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
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
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

export interface DailyFocusCardProps {
    // Extensible properties for daily focus container
}

/**
 * Preact component rendering the Daily Focus & Momentum section with gamification ring.
 */
export function DailyFocusCard(): VNode {
    return (
        <div id="daily-focus-card" className="card activity-focus-card">
            <div className="card-header-clean">
                <div className="header-label-group">
                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                    <span className="card-title">Daily Focus & Momentum</span>
                </div>
            </div>
            <div id="gamification-panel" className="gamification-wrapper" />
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
}

/**
 * Preact component rendering the modern Bento Command Center launcher grid.
 */
export function BentoCommandCenter({
    onOpenStudyPlan,
    onOpenPomodoro,
    onOpenAnalytics,
    onOpenForecast,
    onOpenSummary,
    onOpenHistory,
    onOpenHighlights,
    onOpenColors,
    onOpenSettings
}: BentoCommandCenterProps = {}): VNode {
    return (
        <div className="card quick-launchpad-card">
            <div className="card-header-clean launchpad-header">
                <div className="header-label-group">
                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="card-title">Command Center</span>
                </div>
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
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </div>
                    <span className="tile-title">Settings</span>
                </button>
            </div>
        </div>
    );
}

export interface AchievementsModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

/**
 * Preact component rendering the Achievements & Personal Records modal dialog.
 */
export function AchievementsModal({ isOpen, onClose }: AchievementsModalProps = {}): VNode {
    return (
        <div
            id="achievements-modal"
            className={`modal-overlay ${isOpen ? "" : "hide-panel"}`}
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
                            style={{ stroke: "var(--md-warning)", width: "18px", height: "18px", marginRight: "6px" }}
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
                <div id="achievements-modal-body" className="modal-body" />
            </div>
        </div>
    );
}

export const PopupApp: FunctionalComponent<{ dashboard?: AlgoRecallDashboard }> = ({ dashboard }) => {
    return (
        <div id="popup-app-container">
            {/* Confetti Canvas Overlay: Activated on study streak milestones and level ups */}
            <canvas id="confetti-canvas" className="confetti-canvas" />

            {/* Header: Application branding, level badge, quick check, analytics, theme, settings, and help */}
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
                        {/* User gamification level badge */}
                        <div id="user-level-badge" className="level-badge" title="Current Gamification Level">Lv. 1</div>
                        {/* Quick Check Due Reviews Trigger */}
                        <button id="check-now-btn" className="icon-btn check-now-header-btn" title="Check for due reviews immediately" aria-label="Check for due reviews immediately">
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                        </button>
                        {/* Analytics dashboard button */}
                        <button id="header-analytics-btn" className="icon-btn analytics-header-btn" title="Open Analytics Dashboard" aria-label="Open Analytics Dashboard">
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                        </button>
                        {/* Theme switcher button */}
                        <button id="theme-toggle-btn" className="icon-btn theme-toggle-btn" title="Toggle Theme" aria-label="Toggle Theme">
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
                        {/* Documentation help modal trigger */}
                        <button id="help-btn" className="icon-btn help-btn" title="How it works" aria-label="How it works">
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </button>
                    </div>
                </div>
                {/* XP Progress bar */}
                <div className="xp-bar-container" id="xp-progress-bar-container" title="XP Progress to Next Level" role="progressbar" aria-label="XP Progress to Next Level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
                    <div id="xp-bar-fill" className="xp-bar-fill" />
                </div>
            </header>

            <div className="main-content">
                {/* Notification Permission Warning Banner */}
                <div id="permission-warning-banner" className="banner warning-banner hide-panel">
                    <div className="banner-content">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span>Reminders work best with notifications enabled.</span>
                    </div>
                    <button id="enable-notifications-btn" className="btn-text-accent">Enable</button>
                </div>

                {/* Rating Prompt Card */}
                <div id="rating-prompt-card" className="card rating-card hide-panel">
                    <div id="rating-prompt-state" className="rating-state">
                        <div className="rating-text-group">
                            <h3 className="rating-title">Enjoying AlgoRecall? 🌟</h3>
                            <p className="rating-desc" id="rating-prompt-text">Rate us 5 stars to help us grow!</p>
                        </div>
                        <div className="rating-actions-v">
                            <a href="#" target="_blank" id="rate-store-btn" className="btn btn-primary rating-btn" data-review-url="">
                                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <span id="rate-store-label">Rate on Store</span>
                            </a>
                            <div className="rating-sub-actions">
                                <button id="snooze-rate-btn" className="btn-link">Snooze (7 days)</button>
                                <button id="already-rated-btn" className="btn-link">Already Rated</button>
                            </div>
                        </div>
                    </div>
                    <div id="rating-thanks-state" className="rating-state hide-panel">
                        <span className="thanks-text">Thank you for supporting us! ❤️</span>
                        <button id="edit-rating-btn" className="btn-link">Edit Rating</button>
                    </div>
                </div>

                {/* Hero Section: Overview Stats */}
                <div className="card stats-hero">
                    <div className="stats-grid">
                        <div className="stat-box" id="box-total" title="View all saved patterns" role="button" tabIndex={0}>
                            <span className="stat-value" id="total-cards">...</span>
                            <span className="stat-label">Patterns</span>
                        </div>
                        <div className="stat-box stat-box-due" id="box-due" title="View patterns due today" role="button" tabIndex={0}>
                            <span className="stat-value" id="due-cards">...</span>
                            <span className="stat-label">Due Today</span>
                        </div>
                        <div className="stat-box" id="box-retention" title="View lapsed cards" role="button" tabIndex={0}>
                            <span className="stat-value" id="retention-rate">...</span>
                            <span className="stat-label">Retention</span>
                        </div>
                    </div>
                    {/* Quick Search Input & Tag Filter */}
                    <div className="search-compact">
                        <div className="search-input-wrapper">
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input type="text" id="popup-search-input" className="search-input" placeholder="Search patterns..." />
                        </div>
                        <select id="popup-tag-filter" className="tag-filter-select" aria-label="Filter by tag">
                            <option value="all">All Tags</option>
                        </select>
                    </div>
                    {/* Search Results Dropdown List */}
                    <div id="popup-search-results" className="search-results-container" />
                </div>

                {/* Daily Focus & Momentum Card */}
                <DailyFocusCard />

                {/* Modern Bento Command Center Launchpad */}
                <BentoCommandCenter />

                {/* Activity Heatmap Section */}
                <div id="activity-charts-card" className="card heatmap-card heatmap-section">
                    <div className="heatmap-header">
                        <div className="heatmap-title-wrap">
                            <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                            <span className="heatmap-label">Contributions</span>
                        </div>
                        <div className="heatmap-actions-group">
                            <button id="toggle-lifetime-btn" className="btn-text-subtle">Show Lifetime</button>
                            <button id="open-heatmap-tab-btn" className="btn-icon-text" title="Open full screen heatmap" aria-label="Open full screen heatmap">
                                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Full Screen
                            </button>
                        </div>
                    </div>
                    <div className="heatmap-container">
                        <div id="heatmap-grid" className="heatmap" />
                    </div>
                </div>

                {/* Progressive Disclosure Drawer */}
                <details id="advanced-tools-drawer" className="card details-card advanced-drawer">
                    <summary className="details-summary">
                        <div className="summary-content">
                            <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                            </svg>
                            <span className="card-title">Advanced Options</span>
                        </div>
                        <svg className="svg-icon chevron" viewBox="0 0 24 24" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </summary>

                    <div className="details-body">
                        {/* Floating Marker Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-marker-popup" className="setting-label">Floating Marker</label>
                            <label className="switch">
                                <input type="checkbox" id="toggle-marker-popup" role="switch" defaultChecked aria-checked="true" />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Tracker Launcher Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-algo-launcher" className="setting-label">Tracker Launcher</label>
                            <label className="switch">
                                <input type="checkbox" id="toggle-algo-launcher" role="switch" defaultChecked aria-checked="true" />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Show Analytics & Charts Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-show-charts" className="setting-label">Show Analytics & Charts</label>
                            <label className="switch">
                                <input type="checkbox" id="toggle-show-charts" role="switch" defaultChecked aria-checked="true" />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Daily Focus & Momentum Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-daily-focus" className="setting-label">Daily Focus & Momentum</label>
                            <label className="switch">
                                <input type="checkbox" id="toggle-daily-focus" role="switch" defaultChecked aria-checked="true" />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Developer Mode Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-dev-mode" className="setting-label">Developer Mode</label>
                            <label className="switch">
                                <input type="checkbox" id="toggle-dev-mode" role="switch" aria-checked="false" />
                                <span className="slider" />
                            </label>
                        </div>

                        <div id="dev-mode-actions" style={{ display: 'none', marginTop: '8px', textAlign: 'right' }}>
                            <button id="export-debug-logs-btn" className="btn btn-secondary btn-sm">Export Debug Logs</button>
                        </div>

                        {/* Notification Configuration Controls (Migrated to Settings Hub) */}
                        <div id="notification-settings-card" className="card notification-card">
                            <div id="test-notifications-container" className="button-row" style={{ display: 'none', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                <button id="test-notification-btn" className="btn btn-secondary flex-1">Send Test Notification</button>
                                <button id="test-summary-notification-btn" className="btn btn-secondary flex-1">Send Test Summary Notification</button>
                            </div>
                        </div>
                    </div>
                </details>

                {/* Static Review Banner */}
                <div className="static-review-banner">
                    <a href="#" target="_blank" id="static-review-link" className="static-review-link">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Love AlgoRecall? Rate us 5 stars!
                    </a>
                </div>

                <footer className="footer-modern">
                    <p>AlgoRecall: 100% Private, Local-First.</p>
                    <a href="../../common/help/help.html?tab=privacy" target="_blank">Help & Privacy</a>
                </footer>
            </div>

            {/* Achievements Modal Dialog */}
            <AchievementsModal />

            {/* Status Toasts */}
            <div id="status-msg" className="toast modern-toast" />
            <div id="milestone-toast" className="toast milestone-toast">
                <span id="milestone-toast-text" />
            </div>
        </div>
    );
};

/**
 * @file features/dashboard/popup/popup.ts
 * @description Central coordinator for the AlgoRecall popup dashboard window.
 * Manages configuration updates (theme, in-page toggles), launchpad navigation,
 * and instantiates visual dashboard components (stats, heatmap, notifications,
 * ratings, and quick search).
 *
 * Architecture Role: Popup Master Controller and View Coordinator.
 * Context: Extension Action Popup (`features/dashboard/popup/popup.html`).
 * Key Exports:
 * - {@link PopupDOM}: Interface mapping cached DOM element references for the popup.
 * - {@link AlgoRecallDashboard}: Main coordinator class managing popup lifecycle, settings, and tabs.
 */



/**
 * Cached DOM elements for the primary popup dashboard window.
 */
export interface PopupDOM {
    /** Button toggling light/dark theme. */
    themeToggleBtn: HTMLElement | null;
    /** Toggle switch enabling/disabling floating text highlighter popup. */
    markerToggle: HTMLInputElement | null;
    /** Toggle switch enabling/disabling visual SVG activity charts. */
    chartsToggle: HTMLInputElement | null;
    /** Toggle switch enabling/disabling daily goal focus and streak momentum. */
    dailyFocusToggle: HTMLInputElement | null;
    /** Toggle switch enabling/disabling problem tracker launcher button on content pages. */
    launcherToggle: HTMLInputElement | null;
    /** Toggle switch enabling developer debug tools. */
    devModeToggle: HTMLInputElement | null;
    /** Button navigating to user documentation and help page. */
    helpBtn: HTMLElement | null;
    /** Button navigating to historical review logs page. */
    historyBtn: HTMLElement | null;
    /** Button opening dedicated full-tab heatmap page. */
    openHeatmapTabBtn: HTMLElement | null;
    /** Stat box displaying total cards tracked. */
    boxTotal: HTMLElement | null;
    /** Stat box displaying cards currently due for review. */
    boxDue: HTMLElement | null;
    /** Stat box displaying overall retention percentage. */
    boxRetention: HTMLElement | null;
    /** Button opening highlights manager page. */
    manageHighlightsBtn: HTMLElement | null;
    /** Button opening highlighter palette options page. */
    openOptionsBtn: HTMLElement | null;
    /** Launchpad button opening full analytics dashboard. */
    analyticsBtn: HTMLElement | null;
    /** Header button opening full analytics dashboard. */
    headerAnalyticsBtn: HTMLElement | null;
    /** Button opening future workload forecast page. */
    forecastBtn: HTMLElement | null;
    /** Button opening achievements and records dialog. */
    achievementsBtn: HTMLElement | null;
    /** Button opening exam countdown study plan page. */
    studyplanBtn: HTMLElement | null;
    /** Button opening Pomodoro timer page. */
    pomodoroBtn: HTMLElement | null;
    /** Button opening review session summary page. */
    openSummaryPageBtn: HTMLElement | null;
    /** Button in launchpad opening dedicated settings hub. */
    settingsHubBtn: HTMLElement | null;
    /** Status toast banner container for temporary user notifications. */
    statusMsg: HTMLElement | null;
    /** Container element holding developer-only action buttons. */
    devModeActions: HTMLElement | null;
    /** Button exporting internal debug log history as JSON. */
    exportDebugLogsBtn: HTMLElement | null;
    /** Container element holding test notification triggers in developer mode. */
    testNotificationsContainer: HTMLElement | null;
}

/**
 * Central coordinator for the AlgoRecall popup options dashboard page.
 * Manages configuration updates (theme, in-page toggles), launchpad navigation,
 * and instantiates visual dashboard components.
 */
export class AlgoRecallDashboard {
    /** Active timeout handle for auto-dismissing toast notifications. */
    statusTimeout: ReturnType<typeof setTimeout> | null = null;
    /** Cached DOM elements for the dashboard window. */
    dom: PopupDOM;
    /** Sub-component rendering summary counters and retention metrics. */
    stats: StatsComponent;
    /** Sub-component rendering mini activity heatmap grid. */
    heatmap: HeatmapComponent;
    /** Sub-component managing background reminder schedules and permissions. */
    notifications: NotificationsComponent;
    /** Sub-component providing inline card rating interface. */
    rating: RatingComponent;
    /** Sub-component providing search bar for quick problem lookup. */
    search: QuickSearchComponent;

    /**
     * Initializes the popup dashboard, caching element references and instantiating sub-components.
     */
    constructor() {
        try {
            // Cache global/page-level elements
            this.dom = {
                themeToggleBtn: document.getElementById('theme-toggle-btn'),
                markerToggle: document.getElementById('toggle-marker-popup') as HTMLInputElement | null,
                chartsToggle: document.getElementById('toggle-show-charts') as HTMLInputElement | null,
                dailyFocusToggle: document.getElementById('toggle-daily-focus') as HTMLInputElement | null,
                launcherToggle: document.getElementById('toggle-algo-launcher') as HTMLInputElement | null,
                devModeToggle: document.getElementById('toggle-dev-mode') as HTMLInputElement | null,
                helpBtn: document.getElementById('help-btn'),
                historyBtn: document.getElementById('history-btn'),
                openHeatmapTabBtn: document.getElementById('open-heatmap-tab-btn'),
                boxTotal: document.getElementById('box-total'),
                boxDue: document.getElementById('box-due'),
                boxRetention: document.getElementById('box-retention'),
                manageHighlightsBtn: document.getElementById('manage-highlights-btn'),
                openOptionsBtn: document.getElementById('open-options-btn'),
                analyticsBtn: document.getElementById('analytics-btn'),
                headerAnalyticsBtn: document.getElementById('header-analytics-btn'),
                forecastBtn: document.getElementById('forecast-btn'),
                achievementsBtn: document.getElementById('achievements-btn'),
                studyplanBtn: document.getElementById('studyplan-btn'),
                pomodoroBtn: document.getElementById('pomodoro-btn'),
                openSummaryPageBtn: document.getElementById('open-summary-page-btn'),
                settingsHubBtn: document.getElementById('settings-hub-btn'),
                statusMsg: document.getElementById('status-msg'),
                devModeActions: document.getElementById('dev-mode-actions'),
                exportDebugLogsBtn: document.getElementById('export-debug-logs-btn'),
                testNotificationsContainer: document.getElementById('test-notifications-container'),
            };

            // Subclass Components instantiation
            this.stats = new StatsComponent(this);
            this.heatmap = new HeatmapComponent(this);
            this.notifications = new NotificationsComponent(this);
            this.rating = new RatingComponent(this);
            this.search = new QuickSearchComponent(this);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Popup', `Error in AlgoRecallDashboard constructor: ${errorMessage}`, { err });
            this.dom = {} as PopupDOM;
            this.stats = new StatsComponent(this);
            this.heatmap = new HeatmapComponent(this);
            this.notifications = new NotificationsComponent(this);
            this.rating = new RatingComponent(this);
            this.search = new QuickSearchComponent(this);
        }
    }

    /**
     * Initializes the dashboard, binds page event listeners, and boots sub-components.
     */
    @MeasureTime('Popup', 'init')
    @CatchAndLog('Popup', 'Failed popup initialization')
    cacheDom(): void {
        this.dom = {
            themeToggleBtn: document.getElementById('theme-toggle-btn'),
            markerToggle: document.getElementById('toggle-marker-popup') as HTMLInputElement | null,
            chartsToggle: document.getElementById('toggle-show-charts') as HTMLInputElement | null,
            dailyFocusToggle: document.getElementById('toggle-daily-focus') as HTMLInputElement | null,
            launcherToggle: document.getElementById('toggle-algo-launcher') as HTMLInputElement | null,
            devModeToggle: document.getElementById('toggle-dev-mode') as HTMLInputElement | null,
            helpBtn: document.getElementById('help-btn'),
            historyBtn: document.getElementById('history-btn'),
            openHeatmapTabBtn: document.getElementById('open-heatmap-tab-btn'),
            boxTotal: document.getElementById('box-total'),
            boxDue: document.getElementById('box-due'),
            boxRetention: document.getElementById('box-retention'),
            manageHighlightsBtn: document.getElementById('manage-highlights-btn'),
            openOptionsBtn: document.getElementById('open-options-btn'),
            analyticsBtn: document.getElementById('analytics-btn'),
            headerAnalyticsBtn: document.getElementById('header-analytics-btn'),
            forecastBtn: document.getElementById('forecast-btn'),
            achievementsBtn: document.getElementById('achievements-btn'),
            studyplanBtn: document.getElementById('studyplan-btn'),
            pomodoroBtn: document.getElementById('pomodoro-btn'),
            openSummaryPageBtn: document.getElementById('open-summary-page-btn'),
            settingsHubBtn: document.getElementById('settings-hub-btn'),
            statusMsg: document.getElementById('status-msg'),
            devModeActions: document.getElementById('dev-mode-actions'),
            exportDebugLogsBtn: document.getElementById('export-debug-logs-btn'),
            testNotificationsContainer: document.getElementById('test-notifications-container'),
        };
    }

    @MeasureTime('Popup', 'init')
    @CatchAndLog('Popup', 'Failed popup initialization')
    async init(): Promise<void> {
        Logger.info('Popup', 'Popup initialized.');
        const root = document.getElementById('root');
        if (root) {
            render(<PopupApp dashboard={this} />, root);
            this.cacheDom();
        }
        this.bindEvents();

        // Boot component lifecycle steps
        this.stats.bindEvents();
        this.heatmap.bindEvents();
        this.notifications.bindEvents();
        this.rating.bindEvents();
        this.search.bindEvents();

        // Perform initial loading from storage databases
        await this.loadAll();
    }

    /**
     * Triggers asynchronous state loads across all child panel classes.
     */
    @CatchAndLog('Popup', 'Error loading child components in loadAll')
    async loadAll(): Promise<void> {
        await Promise.all([
            this.stats.load(),
            this.heatmap.load(),
            this.notifications.checkPermissions(),
            this.notifications.loadSettings(),
            this.rating.load(),
            this.search.load()
        ]);
    }

    /**
     * Binds click and state change event listeners for settings panels, exports, and page routers.
     */
    @CatchAndLog('Popup', 'Error binding popup dashboard events')
    bindEvents(): void {
        // Theme Switcher Initialization
        if (this.dom.themeToggleBtn) {
            this.dom.themeToggleBtn.addEventListener('click', withErrorHandling(async () => {
                const newTheme = await ActionService.toggleTheme();
                this.showStatus(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode!`);
            }, { context: 'Popup', message: 'Error toggling theme settings' }));
        }

        // Floating Highlighter switch setup
        if (this.dom.markerToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching marker toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                if (result.extensionSettings && result.extensionSettings.showMarkerPopup !== undefined && this.dom.markerToggle) {
                    this.dom.markerToggle.checked = result.extensionSettings.showMarkerPopup;
                }
            }, { context: 'Popup', message: 'Error rendering marker toggle setting' }));

            this.dom.markerToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showMarkerPopup = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
            }, { context: 'Popup', message: 'Error setting showMarkerPopup config' }));
        }

        // Visual charts display switch setup
        if (this.dom.chartsToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching charts toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                const showCharts = result.extensionSettings && result.extensionSettings.showCharts !== undefined
                    ? result.extensionSettings.showCharts
                    : true;
                if (this.dom.chartsToggle) {
                    this.dom.chartsToggle.checked = showCharts;
                    this.dom.chartsToggle.setAttribute('aria-checked', showCharts.toString());
                }
                this.updateChartsVisibility(showCharts);
            }, { context: 'Popup', message: 'Error rendering charts toggle setting' }));

            this.dom.chartsToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                target.setAttribute('aria-checked', target.checked.toString());
                this.updateChartsVisibility(target.checked);
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showCharts = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
                this.showStatus(`Visual charts ${target.checked ? 'enabled' : 'disabled'}!`);
            }, { context: 'Popup', message: 'Error setting showCharts config' }));
        }

        // Daily Focus & Momentum display switch setup
        if (this.dom.dailyFocusToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching daily focus toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                const showDailyFocus = result.extensionSettings && result.extensionSettings.showDailyFocus !== undefined
                    ? result.extensionSettings.showDailyFocus
                    : true;
                if (this.dom.dailyFocusToggle) {
                    this.dom.dailyFocusToggle.checked = showDailyFocus;
                    this.dom.dailyFocusToggle.setAttribute('aria-checked', showDailyFocus.toString());
                }
                this.updateDailyFocusVisibility(showDailyFocus);
            }, { context: 'Popup', message: 'Error rendering daily focus toggle setting' }));

            this.dom.dailyFocusToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                target.setAttribute('aria-checked', target.checked.toString());
                this.updateDailyFocusVisibility(target.checked);
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showDailyFocus = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
                this.showStatus(`Daily Focus & Momentum ${target.checked ? 'enabled' : 'hidden'}!`);
            }, { context: 'Popup', message: 'Error setting showDailyFocus config' }));
        }

        // Problem tracker launcher toggle setup
        if (this.dom.launcherToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching launcher toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                const showLauncher = result.extensionSettings && result.extensionSettings.showLauncher !== undefined
                    ? result.extensionSettings.showLauncher
                    : true;
                if (this.dom.launcherToggle) {
                    this.dom.launcherToggle.checked = showLauncher;
                    this.dom.launcherToggle.setAttribute('aria-checked', showLauncher.toString());
                }
            }, { context: 'Popup', message: 'Error rendering launcher toggle setting' }));

            this.dom.launcherToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                target.setAttribute('aria-checked', target.checked.toString());
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showLauncher = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
                this.showStatus(`Problem tracker launcher ${target.checked ? 'enabled' : 'disabled'}!`);
            }, { context: 'Popup', message: 'Error setting showLauncher config' }));
        }

        // Developer mode display switch setup
        if (this.dom.devModeToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching dev mode toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                const devMode = result.extensionSettings && result.extensionSettings.developerMode !== undefined
                    ? result.extensionSettings.developerMode
                    : false;
                if (this.dom.devModeToggle) {
                    this.dom.devModeToggle.checked = devMode;
                    this.dom.devModeToggle.setAttribute('aria-checked', devMode.toString());
                }
                if (this.dom.devModeActions) {
                    this.dom.devModeActions.style.display = devMode ? 'block' : 'none';
                }
                if (this.dom.testNotificationsContainer) {
                    this.dom.testNotificationsContainer.style.display = devMode ? 'flex' : 'none';
                }
            }, { context: 'Popup', message: 'Error rendering dev mode toggle setting' }));

            this.dom.devModeToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                target.setAttribute('aria-checked', target.checked.toString());
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.developerMode = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
                if (this.dom.devModeActions) {
                    this.dom.devModeActions.style.display = target.checked ? 'block' : 'none';
                }
                if (this.dom.testNotificationsContainer) {
                    this.dom.testNotificationsContainer.style.display = target.checked ? 'flex' : 'none';
                }
                this.showStatus(`Developer mode ${target.checked ? 'enabled' : 'disabled'}!`);
            }, { context: 'Popup', message: 'Error setting developerMode config' }));

            if (this.dom.exportDebugLogsBtn) {
                this.dom.exportDebugLogsBtn.addEventListener('click', withErrorHandling(() => {
                    chrome.storage.local.get(['debugLogs'], withErrorHandling((result: { debugLogs?: unknown[] }) => {
                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                        if (lastError) {
                            const errorMessage = lastError.message || String(lastError);
                            Logger.error('Popup', `Storage error fetching debug logs: ${errorMessage}`, { error: lastError });
                            return;
                        }
                        const logs = result.debugLogs || [];
                        if (logs.length === 0) {
                            this.showStatus('No debug logs found.', true);
                            return;
                        }

                        const logLines = logs.map((l: unknown) => JSON.stringify(l)).join('\n');
                        const blob = new Blob([logLines], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const filename = `algorecall_debug_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

                        // Safari does not support chrome.downloads — use anchor-click fallback.
                        if (BROWSER_CONFIG.supportsDownloads) {
                            chrome.downloads.download({
                                url: url,
                                filename,
                                saveAs: true
                            }, () => {
                                try {
                                    URL.revokeObjectURL(url);
                                } catch (revokeErr) {
                                    const errorMessage = revokeErr instanceof Error ? revokeErr.message : String(revokeErr);
                                    Logger.debug('Popup', `Ignore revokeObjectURL error: ${errorMessage}`, { revokeErr });
                                }
                            });
                        } else {
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }
                        this.showStatus(`Exported ${logs.length} debug logs!`);
                    }, { context: 'Popup', message: 'Error exporting debug logs from callback' }));
                }, { context: 'Popup', message: 'Error handling export debug logs click' }));
            }
        }

        // Navigation and Tool Actions
        this.dom.helpBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-help');
        }, { context: 'Popup', message: 'Error navigating to help.html' }));

        this.dom.historyBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-history');
        }, { context: 'Popup', message: 'Error navigating to history.html' }));

        this.dom.openHeatmapTabBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-heatmap');
        }, { context: 'Popup', message: 'Error navigating to heatmap.html' }));

        const addAccessibleClick = (el: HTMLElement | null, handler: () => void) => {
            if (!el) return;
            el.addEventListener('click', handler);
            el.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler();
                }
            });
        };

        addAccessibleClick(this.dom.boxTotal, withErrorHandling(() => {
            ActionService.executeAction('view-all-cards');
        }, { context: 'Popup', message: 'Error navigating to total data view' }));

        addAccessibleClick(this.dom.boxDue, withErrorHandling(() => {
            ActionService.executeAction('view-due-cards');
        }, { context: 'Popup', message: 'Error navigating to due data view' }));

        addAccessibleClick(this.dom.boxRetention, withErrorHandling(() => {
            ActionService.executeAction('view-retention-cards');
        }, { context: 'Popup', message: 'Error navigating to retention data view' }));

        this.dom.manageHighlightsBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-highlights-manager');
        }, { context: 'Popup', message: 'Error navigating to highlights.html' }));

        this.dom.openOptionsBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-highlights-options');
        }, { context: 'Popup', message: 'Error navigating to highlightOptions.html' }));

        const openAnalyticsTab = withErrorHandling(() => {
            ActionService.executeAction('open-analytics');
        }, { context: 'Popup', message: 'Error navigating to analytics.html' });
        this.dom.analyticsBtn?.addEventListener('click', openAnalyticsTab);
        this.dom.headerAnalyticsBtn?.addEventListener('click', openAnalyticsTab);

        this.dom.settingsHubBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-settings');
        }, { context: 'Popup', message: 'Error navigating to settings.html' }));

        this.dom.forecastBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-forecast');
        }, { context: 'Popup', message: 'Error navigating to forecast.html' }));

        this.dom.achievementsBtn?.addEventListener('click', withErrorHandling(() => {
            this.stats.bindAchievementsModal();
            const openBtn = document.getElementById('achievements-open-btn');
            if (openBtn) {
                openBtn.click();
            } else {
                const modal = document.getElementById('achievements-modal');
                modal?.classList.remove('hide-panel');
            }
        }, { context: 'Popup', message: 'Error opening achievements dialog' }));

        this.dom.studyplanBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-study-plan');
        }, { context: 'Popup', message: 'Error navigating to studyplan.html' }));

        this.dom.pomodoroBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-pomodoro');
        }, { context: 'Popup', message: 'Error navigating to pomodoro.html' }));

        this.dom.openSummaryPageBtn?.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            try {
                ActionService.executeAction('open-summary');
            } catch (err) {
                UIUtils.catchError('Popup', 'Error navigating to summary.html', err);
            }
        });

        // UA-029: Manual Check Reviews Now trigger
        const checkNowBtn = document.getElementById('check-now-btn');
        if (checkNowBtn) {
            checkNowBtn.addEventListener('click', withErrorHandling(async () => {
                checkNowBtn.setAttribute('disabled', 'true');
                chrome.runtime.sendMessage({ action: 'check_due_cards_now' }, (response) => {
                    checkNowBtn.removeAttribute('disabled');
                    if (response && response.success) {
                        const count = typeof response.dueCount === 'number' ? response.dueCount : 0;
                        this.showStatus(`Checked! ${count} review${count === 1 ? '' : 's'} due.`);
                    } else {
                        this.showStatus('Checked for due reviews.');
                    }
                    this.loadAll();
                });
            }, { context: 'Popup', message: 'Error checking due cards manually' }));
        }

        // UA-010: Safari notification capability guard
        if (!BROWSER_CONFIG.supportsNotifications) {
            const notifCard = document.getElementById('notification-settings-card');
            if (notifCard) {
                notifCard.style.display = 'none';
            }
        }
    }

    /**
     * Triggers a status message toast at the top of the popup dashboard.
     * @param {string} msg - Descriptive message string.
     * @param {boolean} [isError=false] - Signals if the status indicates an error.
     */
    @CatchAndLog('Popup', 'Error rendering status toast')
    showStatus(msg: string, isError: boolean = false): void {
        const el = this.dom.statusMsg;
        if (!el) return;

        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        const iconHtml = isError
            ? `<svg class="svg-icon" style="stroke: var(--md-danger); width: 14px; height: 14px;" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
            : `<svg class="svg-icon" style="stroke: var(--md-success); width: 14px; height: 14px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        el.innerHTML = iconHtml + `<span>${msg}</span>`;
        el.className = 'toast show ' + (isError ? 'error' : 'success');

        this.statusTimeout = setTimeout(withErrorHandling(() => {
            el.classList.remove('show');
        }, { context: 'Popup', message: 'Error hiding status toast' }), 2500);
    }

    /**
     * Updates visibility of the charts and activity panel in popup.
     */
    updateChartsVisibility(showCharts: boolean): void {
        const card = document.getElementById('activity-charts-card');
        if (card) {
            card.style.display = showCharts ? '' : 'none';
        }
    }

    /**
     * Updates visibility of the Daily Focus & Momentum card in popup.
     */
    updateDailyFocusVisibility(showDailyFocus: boolean): void {
        const card = document.getElementById('daily-focus-card');
        if (card) {
            card.style.display = showDailyFocus ? '' : 'none';
        }
    }
}

/**
 * Initializes the popup dashboard controller when the DOM is ready.
 */
const initPopupDashboard = withErrorHandling((): void => {
    const dashboard = new AlgoRecallDashboard();
    dashboard.init();
}, { context: 'Popup', message: 'Initialization failed' });

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopupDashboard);
    } else {
        initPopupDashboard();
    }
}


if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).AlgoRecallDashboard = AlgoRecallDashboard;
    (module.exports as any).PopupHeader = PopupHeader;
    (module.exports as any).PopupNavigationGrid = PopupNavigationGrid;
    (module.exports as any).PopupSettingsToggles = PopupSettingsToggles;
    (module.exports as any).PopupStatusToast = PopupStatusToast;
    (module.exports as any).DailyFocusCard = DailyFocusCard;
    (module.exports as any).BentoCommandCenter = BentoCommandCenter;
    (module.exports as any).AchievementsModal = AchievementsModal;
    (module.exports as any).PopupApp = PopupApp;
    (module.exports as any).initPopupDashboard = initPopupDashboard;
}
