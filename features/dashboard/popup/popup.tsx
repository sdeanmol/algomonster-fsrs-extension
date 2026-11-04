
import { h, VNode, render, FunctionalComponent } from "preact";

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

export const PopupApp: FunctionalComponent<{ dashboard?: AlgoRecallDashboard }> = ({ dashboard }) => {
    return (
        <div id="popup-app-container">
            {/* Confetti Canvas Overlay: Activated on study streak milestones and level ups */}
            <canvas id="confetti-canvas" className="confetti-canvas" />

            {/* Header: Application branding, level badge, and top navigation controls */}
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
                        <div id="user-level-badge" className="level-badge">Lv. 1</div>
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
                        <div className="stat-box" id="box-due" title="View patterns due today" role="button" tabIndex={0}>
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

                {/* Middle Cards Grid Container */}
                <div className="popup-cards-layout">
                    <div className="popup-column">
                        {/* Gamification & Heatmap */}
                        <div id="activity-charts-card" className="card group-card">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-primary)', marginRight: '6px', width: '16px', height: '16px' }} aria-hidden="true">
                                        <line x1="18" y1="20" x2="18" y2="10" />
                                        <line x1="12" y1="20" x2="12" y2="4" />
                                        <line x1="6" y1="20" x2="6" y2="14" />
                                    </svg>
                                    Activity & Progress
                                </h3>
                            </div>
                            <div id="gamification-panel" className="gamification-wrapper" />
                            <div className="heatmap-section">
                                <div className="heatmap-header">
                                    <span className="heatmap-label">Contributions</span>
                                    <button id="open-heatmap-tab-btn" className="btn-icon-text" title="Open full screen heatmap" aria-label="Open full screen heatmap">
                                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                            <polyline points="15 3 21 3 21 9" />
                                            <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                        Full Screen
                                    </button>
                                </div>
                                <div className="heatmap-container">
                                    <div id="heatmap-grid" className="heatmap" />
                                </div>
                            </div>
                            <div className="action-chips">
                                <button id="toggle-lifetime-btn" className="chip">Lifetime</button>
                                <button id="analytics-btn" className="chip">Analytics</button>
                                <button id="forecast-btn" className="chip">Forecast</button>
                                <button id="history-btn" className="chip">History</button>
                            </div>
                        </div>

                        {/* Study Tools */}
                        <div className="card group-card">
                            <div className="card-header">
                                <h3 className="card-title" style={{ color: 'var(--md-secondary)' }}>
                                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-secondary)', marginRight: '6px', width: '16px', height: '16px' }} aria-hidden="true">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                                    </svg>
                                    Study Tools
                                </h3>
                            </div>
                            <div className="action-chips">
                                <button id="studyplan-btn" className="chip">Exam Mode</button>
                                <button id="pomodoro-btn" className="chip">Pomodoro</button>
                            </div>
                        </div>
                    </div>

                    <div className="popup-column">
                        {/* Highlighter Settings */}
                        <div className="card highlighter-card">
                            <div className="card-header">
                                <h3 className="card-title" style={{ color: 'var(--md-warning)' }}>
                                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-warning)', marginRight: '6px', width: '16px', height: '16px' }} aria-hidden="true">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                    Highlighter Settings
                                </h3>
                            </div>
                            <div className="setting-row">
                                <label htmlFor="toggle-marker-popup" className="setting-label">Floating Marker Menu</label>
                                <label className="switch">
                                    <input type="checkbox" id="toggle-marker-popup" defaultChecked />
                                    <span className="slider" />
                                </label>
                            </div>
                            <div className="button-row">
                                <button id="open-options-btn" className="btn btn-secondary flex-1" title="Manage highlighter colors" aria-label="Manage highlighter colors">
                                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                    Customize Colors
                                </button>
                                <button id="manage-highlights-btn" className="btn btn-primary flex-1" title="View all snippets" aria-label="View all snippets">
                                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                                        <line x1="8" y1="6" x2="21" y2="6" />
                                        <line x1="8" y1="12" x2="21" y2="12" />
                                        <line x1="8" y1="18" x2="21" y2="18" />
                                        <line x1="3" y1="6" x2="3.01" y2="6" />
                                        <line x1="3" y1="12" x2="3.01" y2="12" />
                                        <line x1="3" y1="18" x2="3.01" y2="18" />
                                    </svg>
                                    View All Highlights
                                </button>
                            </div>
                        </div>

                        {/* Notification Settings */}
                        <div className="card notification-card" id="notification-settings-card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 className="card-title" style={{ color: 'var(--md-danger)' }}>
                                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-danger)', marginRight: '6px', width: '16px', height: '16px' }} aria-hidden="true">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                    </svg>
                                    Notification Settings
                                </h3>
                                <button id="open-summary-page-btn" className="btn-icon-text" title="Open Weekly & Monthly Digest Summary" aria-label="Open Weekly & Monthly Digest Summary">
                                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'var(--md-danger)' }} aria-hidden="true">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                    Summary
                                </button>
                            </div>
                            <div className="setting-row">
                                <label htmlFor="toggle-notifications" className="setting-label">Review Reminders</label>
                                <label className="switch">
                                    <input type="checkbox" id="toggle-notifications" role="switch" defaultChecked aria-checked="true" />
                                    <span className="slider" />
                                </label>
                            </div>
                            <div className="setting-row">
                                <span className="setting-label">Check Interval</span>
                                <select id="notification-interval" className="modern-select">
                                    <option value="1" id="dev-interval-option" hidden disabled>1 min (Dev)</option>
                                    <option value="15">15 mins</option>
                                    <option value="30">30 mins</option>
                                    <option value="60" selected>1 hour</option>
                                    <option value="120">2 hours</option>
                                    <option value="360">6 hours</option>
                                    <option value="720">12 hours</option>
                                    <option value="1440">Daily</option>
                                    <option value="custom">Custom...</option>
                                </select>
                            </div>
                            <div id="custom-interval-container" className="setting-row hide-panel">
                                <span className="setting-label subtle">Custom (mins)</span>
                                <input type="number" id="custom-interval-input" className="modern-input short-input" min={1} max={1440} placeholder="60" />
                            </div>
                            <div className="setting-row">
                                <span className="setting-label">Sticky Notification</span>
                                <label className="switch">
                                    <input type="checkbox" id="toggle-sticky-notification" role="switch" defaultChecked aria-checked="true" />
                                    <span className="slider" />
                                </label>
                            </div>
                            <div className="setting-row">
                                <span className="setting-label">Quiet Hours</span>
                                <label className="switch">
                                    <input type="checkbox" id="toggle-quiet-hours" role="switch" aria-checked="false" />
                                    <span className="slider" />
                                </label>
                            </div>
                            <div id="quiet-hours-container" className="setting-row hide-panel">
                                <span className="setting-label subtle">Time Window</span>
                                <div className="time-range-group">
                                    <input type="time" id="quiet-hours-start" className="modern-input time-input" defaultValue="23:00" />
                                    <span className="time-separator">to</span>
                                    <input type="time" id="quiet-hours-end" className="modern-input time-input" defaultValue="07:00" />
                                </div>
                            </div>
                            <div className="setting-row">
                                <span className="setting-label">Weekly Digest</span>
                                <label className="switch">
                                    <input type="checkbox" id="toggle-weekly-digest" role="switch" defaultChecked aria-checked="true" />
                                    <span className="slider" />
                                </label>
                            </div>
                            <div className="setting-row">
                                <label htmlFor="toggle-badge-due-count" className="setting-label" title="Show count of reviews due on browser pinned extension icon">Pinned Icon Due Badge</label>
                                <label className="switch">
                                    <input type="checkbox" id="toggle-badge-due-count" role="switch" defaultChecked aria-checked="true" />
                                    <span className="slider" />
                                </label>
                            </div>
                            <div className="button-row" style={{ marginTop: '10px' }}>
                                <button id="check-now-btn" className="btn btn-secondary flex-1" title="Check for due reviews immediately" aria-label="Check for due reviews immediately">
                                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                                        <polyline points="23 4 23 10 17 10" />
                                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                    </svg>
                                    Check Due Reviews Now
                                </button>
                            </div>
                            <div id="test-notifications-container" className="button-row" style={{ display: 'none', flexDirection: 'column', gap: '8px' }}>
                                <button id="test-notification-btn" className="btn btn-secondary flex-1">
                                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                    </svg>
                                    Send Test Notification
                                </button>
                                <button id="test-summary-notification-btn" className="btn btn-secondary flex-1">
                                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                    Send Test Summary Notification
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Advanced Options Details */}
                <details className="card details-card">
                    <summary className="details-summary">
                        <div className="summary-content">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: '#9b59b6' }} aria-hidden="true">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            <span className="card-title">Data & Options</span>
                        </div>
                        <svg className="svg-icon chevron" viewBox="0 0 24 24" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </summary>

                    <div className="details-body">
                        <div className="setting-row" style={{ marginTop: '8px' }}>
                            <label htmlFor="toggle-algo-launcher" className="setting-label">Problem Tracker Launcher</label>
                            <label className="switch">
                                <input type="checkbox" id="toggle-algo-launcher" role="switch" defaultChecked aria-checked="true" />
                                <span className="slider" />
                            </label>
                        </div>
                        <div className="setting-row" style={{ marginTop: '8px' }}>
                            <label htmlFor="toggle-show-charts" className="setting-label">Show Analytics & Charts</label>
                            <label className="switch">
                                <input type="checkbox" id="toggle-show-charts" role="switch" defaultChecked aria-checked="true" />
                                <span className="slider" />
                            </label>
                        </div>
                        <div className="setting-row" style={{ marginTop: '8px' }}>
                            <label htmlFor="toggle-dev-mode" className="setting-label">Developer Mode</label>
                            <label className="switch">
                                <input type="checkbox" id="toggle-dev-mode" role="switch" aria-checked="false" />
                                <span className="slider" />
                            </label>
                        </div>
                        <div id="dev-mode-actions" style={{ display: 'none', marginTop: '8px', textAlign: 'right' }}>
                            <button id="export-debug-logs-btn" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>Export Debug Logs</button>
                        </div>

                        <div className="nav-list mt-2">
                            <button id="manage-platforms-btn" className="nav-item">
                                <div className="nav-item-left">
                                    <svg className="svg-icon settings-item-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-primary)' }} aria-hidden="true">
                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                        <line x1="8" y1="21" x2="16" y2="21" />
                                        <line x1="12" y1="17" x2="12" y2="21" />
                                    </svg>
                                    <span>Manage Active Websites</span>
                                </div>
                                <svg className="svg-icon chevron-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                            <button id="configure-fsrs-btn" className="nav-item">
                                <div className="nav-item-left">
                                    <svg className="svg-icon settings-item-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-warning)' }} aria-hidden="true">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                    <span>Configure FSRS Algorithm</span>
                                </div>
                                <svg className="svg-icon chevron-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>

                        <div className="data-actions-grid mt-3">
                            <button id="export-btn" className="data-btn success">
                                <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-success)', marginRight: '6px', width: '14px', height: '14px' }} aria-hidden="true">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Backup
                            </button>
                            <label id="import-btn-label" className="data-btn danger" tabIndex={0} role={"button" as any} aria-label="Restore backup from file">
                                <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-danger)', marginRight: '6px', width: '14px', height: '14px' }} aria-hidden="true">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                Restore
                                <input type="file" id="import-file" accept=".json,.gz,.json.gz" style={{ display: 'none' }} />
                            </label>
                            <button id="anki-export-btn" className="data-btn primary">
                                <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-primary)', marginRight: '6px', width: '14px', height: '14px' }} aria-hidden="true">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                                To Anki
                            </button>
                            <label id="anki-import-btn-label" className="data-btn purple" tabIndex={0} role={"button" as any} aria-label="Import cards from Anki">
                                <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: '#9b59b6', marginRight: '6px', width: '14px', height: '14px' }} aria-hidden="true">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                From Anki
                                <input type="file" id="anki-import-file" accept=".txt,.tsv" style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>
                </details>

                {/* Static Review Banner */}
                <div className="static-review-banner">
                    <a href="#" target="_blank" id="static-review-link" className="static-review-link">
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} aria-hidden="true">
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
 * Manages configuration updates (theme, highlighting visibility), page data backup (import/export),
 * Anki deck exchange utilities, and instantiates visual dashboard components (stats, heatmap,
 * notifications, ratings, and quick search).
 *
 * Architecture Role: Popup Master Controller and View Coordinator.
 * Context: Extension Action Popup (`features/dashboard/popup/popup.html`).
 * Key Exports:
 * - {@link PopupDOM}: Interface mapping cached DOM element references for the popup.
 * - {@link AlgoRecallDashboard}: Main coordinator class managing popup lifecycle, settings, and tabs.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { StatsComponent } from './stats';
import { HeatmapComponent } from './heatmap';
import { NotificationsComponent } from './notifications';
import { RatingComponent } from './rating';
import { QuickSearchComponent } from './search';
import { BackupManager } from '../../common/data/backupManager';
import { Card, StorageData, ExtensionSettings } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';
import { ActionService } from '../../common/services/actionService';

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
    /** Toggle switch enabling/disabling problem tracker launcher button on content pages. */
    launcherToggle: HTMLInputElement | null;
    /** Toggle switch enabling developer debug tools and short test intervals. */
    devModeToggle: HTMLInputElement | null;
    /** Button navigating to supported websites management page. */
    managePlatformsBtn: HTMLElement | null;
    /** Button navigating to FSRS algorithmic weight configuration page. */
    configureFsrsBtn: HTMLElement | null;
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
    /** Footer button opening full analytics dashboard. */
    analyticsBtn: HTMLElement | null;
    /** Header button opening full analytics dashboard. */
    headerAnalyticsBtn: HTMLElement | null;
    /** Button opening future workload forecast page. */
    forecastBtn: HTMLElement | null;
    /** Button triggering JSON database backup export. */
    exportBtn: HTMLElement | null;
    /** Hidden file input element for restoring JSON backup file. */
    importFile: HTMLInputElement | null;
    /** Button exporting cards formatted for Anki deck import. */
    ankiExportBtn: HTMLElement | null;
    /** Hidden file input element for importing Anki text deck. */
    ankiImportFile: HTMLInputElement | null;
    /** Button opening exam countdown study plan page. */
    studyplanBtn: HTMLElement | null;
    /** Button opening Pomodoro timer page. */
    pomodoroBtn: HTMLElement | null;
    /** Button opening review session summary page. */
    openSummaryPageBtn: HTMLElement | null;
    /** Toggle switch for weekly summary email/digest feature. */
    weeklyDigestToggle: HTMLInputElement | null;
    /** Toggle switch displaying due review count badge on browser extension icon. */
    badgeToggle: HTMLInputElement | null;
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
 * Manages configuration updates (theme, highlighting visibility), page data backup (import/export),
 * Anki deck exchange utilities, and instantiates visual dashboard components.
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
                launcherToggle: document.getElementById('toggle-algo-launcher') as HTMLInputElement | null,
                devModeToggle: document.getElementById('toggle-dev-mode') as HTMLInputElement | null,
                managePlatformsBtn: document.getElementById('manage-platforms-btn'),
                configureFsrsBtn: document.getElementById('configure-fsrs-btn'),
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
                exportBtn: document.getElementById('export-btn'),
                importFile: document.getElementById('import-file') as HTMLInputElement | null,
                ankiExportBtn: document.getElementById('anki-export-btn'),
                ankiImportFile: document.getElementById('anki-import-file') as HTMLInputElement | null,
                studyplanBtn: document.getElementById('studyplan-btn'),
                pomodoroBtn: document.getElementById('pomodoro-btn'),
                openSummaryPageBtn: document.getElementById('open-summary-page-btn'),
                weeklyDigestToggle: document.getElementById('toggle-weekly-digest') as HTMLInputElement | null,
                badgeToggle: document.getElementById('toggle-badge-due-count') as HTMLInputElement | null,
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
            // Comment: Non-fatal constructor DOM caching error
            this.dom = {} as PopupDOM;
            this.stats = new StatsComponent(this);
            this.heatmap = new HeatmapComponent(this);
            this.notifications = new NotificationsComponent(this);
            this.rating = new RatingComponent(this);
            this.search = new QuickSearchComponent(this);
        }
    }

    /**
     * Refreshes cached DOM element references after root Preact component rendering.
     */
    cacheDom(): void {
        this.dom = {
            themeToggleBtn: document.getElementById('theme-toggle-btn'),
            markerToggle: document.getElementById('toggle-marker-popup') as HTMLInputElement | null,
            chartsToggle: document.getElementById('toggle-show-charts') as HTMLInputElement | null,
            launcherToggle: document.getElementById('toggle-algo-launcher') as HTMLInputElement | null,
            devModeToggle: document.getElementById('toggle-dev-mode') as HTMLInputElement | null,
            managePlatformsBtn: document.getElementById('manage-platforms-btn'),
            configureFsrsBtn: document.getElementById('configure-fsrs-btn'),
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
            exportBtn: document.getElementById('export-btn'),
            importFile: document.getElementById('import-file') as HTMLInputElement | null,
            ankiExportBtn: document.getElementById('anki-export-btn'),
            ankiImportFile: document.getElementById('anki-import-file') as HTMLInputElement | null,
            studyplanBtn: document.getElementById('studyplan-btn'),
            pomodoroBtn: document.getElementById('pomodoro-btn'),
            openSummaryPageBtn: document.getElementById('open-summary-page-btn'),
            weeklyDigestToggle: document.getElementById('toggle-weekly-digest') as HTMLInputElement | null,
            badgeToggle: document.getElementById('toggle-badge-due-count') as HTMLInputElement | null,
            statusMsg: document.getElementById('status-msg'),
            devModeActions: document.getElementById('dev-mode-actions'),
            exportDebugLogsBtn: document.getElementById('export-debug-logs-btn'),
            testNotificationsContainer: document.getElementById('test-notifications-container'),
        };
    }

    /**
     * Initializes the dashboard, binds page event listeners, and boots sub-components.
     */
    async init(): Promise<void> {
        Logger.info('Popup', 'Popup initialized.');
        Logger.time('Popup', 'init');
        try {
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
        } catch (err) {
            UIUtils.catchError('Popup', 'Failed popup initialization', err);
        } finally {
            Logger.timeEnd('Popup', 'init');
        }
    }

    /**
     * Triggers asynchronous state loads across all child panel classes.
     */
    async loadAll(): Promise<void> {
        try {
            await Promise.all([
                this.stats.load(),
                this.heatmap.load(),
                this.notifications.checkPermissions(),
                this.notifications.loadSettings(),
                this.rating.load(),
                this.search.load()
            ]);
        } catch (err) {
            UIUtils.catchError('Popup', 'Error loading child components in loadAll', err);
        }
    }

    /**
     * Binds click and state change event listeners for settings panels, exports, and page routers.
     */
    bindEvents(): void {
        try {
            // Theme Switcher Initialization
            if (this.dom.themeToggleBtn) {
                this.dom.themeToggleBtn.addEventListener('click', async () => {
                    try {
                        const newTheme = await ActionService.toggleTheme();
                        this.showStatus(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                    } catch (error) {
            UIUtils.catchError('Popup', 'Error toggling theme settings', error);
        }
                });
            }

            // Floating Highlighter switch setup
            if (this.dom.markerToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                        if (lastError) {
                            const errorMessage = lastError.message || String(lastError);
                            Logger.error('Popup', `Storage error fetching marker toggle settings: ${errorMessage}`, { error: lastError });
                            return;
                        }
                        if (result.extensionSettings && result.extensionSettings.showMarkerPopup !== undefined && this.dom.markerToggle) {
                            this.dom.markerToggle.checked = result.extensionSettings.showMarkerPopup;
                        }
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error rendering marker toggle setting', err);
        }
                });
                this.dom.markerToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                        const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showMarkerPopup = target.checked;
                        await chrome.storage.local.set({ extensionSettings: settings });
                    } catch (error) {
            UIUtils.catchError('Popup', 'Error setting showMarkerPopup config', error);
        }
                });
            }

            // Visual charts display switch setup
            if (this.dom.chartsToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
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
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error rendering charts toggle setting', err);
        }
                });
                this.dom.chartsToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        target.setAttribute('aria-checked', target.checked.toString());
                        this.updateChartsVisibility(target.checked);
                        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                        const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showCharts = target.checked;
                        await chrome.storage.local.set({ extensionSettings: settings });
                        this.showStatus(`Visual charts ${target.checked ? 'enabled' : 'disabled'}!`);
                    } catch (error) {
            UIUtils.catchError('Popup', 'Error setting showCharts config', error);
        }
                });
            }

            // Problem tracker launcher toggle setup
            if (this.dom.launcherToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
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
                    } catch (err) {
                        UIUtils.catchError('Popup', 'Error rendering launcher toggle setting', err);
                    }
                });
                this.dom.launcherToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        target.setAttribute('aria-checked', target.checked.toString());
                        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                        const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showLauncher = target.checked;
                        await chrome.storage.local.set({ extensionSettings: settings });
                        this.showStatus(`Problem tracker launcher ${target.checked ? 'enabled' : 'disabled'}!`);
                    } catch (error) {
                        UIUtils.catchError('Popup', 'Error setting showLauncher config', error);
                    }
                });
            }

            // Developer mode display switch setup
            if (this.dom.devModeToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
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
                        const devIntervalOption = document.getElementById('dev-interval-option') as HTMLOptionElement | null;
                        if (devIntervalOption) {
                            devIntervalOption.hidden = !devMode;
                            devIntervalOption.disabled = !devMode;
                        }
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error rendering dev mode toggle setting', err);
        }
                });
                this.dom.devModeToggle.addEventListener('change', async (e: Event) => {
                    try {
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
                        const devIntervalOption = document.getElementById('dev-interval-option') as HTMLOptionElement | null;
                        if (devIntervalOption) {
                            devIntervalOption.hidden = !target.checked;
                            devIntervalOption.disabled = !target.checked;
                            const selectEl = document.getElementById('notification-interval') as HTMLSelectElement | null;
                            if (!target.checked && selectEl && selectEl.value === '1') {
                                selectEl.value = '60';
                                selectEl.dispatchEvent(new Event('change'));
                            }
                        }
                        this.showStatus(`Developer mode ${target.checked ? 'enabled' : 'disabled'}!`);
                    } catch (error) {
            UIUtils.catchError('Popup', 'Error setting developerMode config', error);
        }
                });

                // Weekly summary digest switch setup
                if (this.dom.weeklyDigestToggle) {
                    chrome.storage.local.get(['weeklySummaryEnabled'], (result: { weeklySummaryEnabled?: boolean }) => {
                        try {
                            const enabled = result.weeklySummaryEnabled !== false;
                            if (this.dom.weeklyDigestToggle) {
                                this.dom.weeklyDigestToggle.checked = enabled;
                                this.dom.weeklyDigestToggle.setAttribute('aria-checked', enabled.toString());
                            }
                        } catch (err) {
                            UIUtils.catchError('Popup', 'Error rendering weekly digest toggle setting', err);
                        }
                    });
                    this.dom.weeklyDigestToggle.addEventListener('change', async (e: Event) => {
                        try {
                            const target = e.target as HTMLInputElement;
                            target.setAttribute('aria-checked', target.checked.toString());
                            await chrome.storage.local.set({ weeklySummaryEnabled: target.checked });
                            this.showStatus(`Weekly digest ${target.checked ? 'enabled' : 'disabled'}!`);
                        } catch (err) {
                            UIUtils.catchError('Popup', 'Error setting weeklySummaryEnabled config', err);
                        }
                    });
                }

                if (this.dom.exportDebugLogsBtn) {
                    this.dom.exportDebugLogsBtn.addEventListener('click', () => {
                        try {
                            chrome.storage.local.get(['debugLogs'], (result: { debugLogs?: unknown[] }) => {
                                try {
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
                                } catch (innerErr) {
            UIUtils.catchError('Popup', 'Error exporting debug logs from callback', innerErr);
        }
                            });
                        } catch (err) {
            UIUtils.catchError('Popup', 'Error handling export debug logs click', err);
        }
                    });
                }
            }

            // Webpage page redirection setups
            if (this.dom.managePlatformsBtn) {
                this.dom.managePlatformsBtn.addEventListener('click', () => {
                    try {
                        ActionService.executeAction('open-websites-manager');
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to websites.html', err);
        }
                });
            }

            if (this.dom.configureFsrsBtn) {
                this.dom.configureFsrsBtn.addEventListener('click', () => {
                    try {
                        ActionService.executeAction('open-fsrs-config');
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to fsrsConfig.html', err);
        }
                });
            }

            this.dom.helpBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-help');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to help.html', err);
        }
            });
            this.dom.historyBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-history');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to history.html', err);
        }
            });
            this.dom.openHeatmapTabBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-heatmap');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to heatmap.html', err);
        }
            });
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

            addAccessibleClick(this.dom.boxTotal, () => {
                try {
                    ActionService.executeAction('view-all-cards');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to total data view', err);
                }
            });

            addAccessibleClick(this.dom.boxDue, () => {
                try {
                    ActionService.executeAction('view-due-cards');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to due data view', err);
                }
            });

            addAccessibleClick(this.dom.boxRetention, () => {
                try {
                    ActionService.executeAction('view-retention-cards');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to retention data view', err);
                }
            });
            this.dom.manageHighlightsBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-highlights-manager');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to highlights.html', err);
        }
            });
            this.dom.openOptionsBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-highlights-options');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to highlightOptions.html', err);
        }
            });

            const openAnalyticsTab = () => {
                try {
                    ActionService.executeAction('open-analytics');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to analytics.html', err);
        }
            };
            this.dom.analyticsBtn?.addEventListener('click', openAnalyticsTab);
            this.dom.headerAnalyticsBtn?.addEventListener('click', openAnalyticsTab);

            this.dom.forecastBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-forecast');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to forecast.html', err);
        }
            });
            this.dom.studyplanBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-study-plan');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to studyplan.html', err);
        }
            });
            this.dom.pomodoroBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-pomodoro');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to pomodoro.html', err);
        }
            });
            this.dom.openSummaryPageBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-summary');
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to summary.html', err);
        }
            });

            // UA-029: Manual Check Reviews Now trigger
            const checkNowBtn = document.getElementById('check-now-btn');
            if (checkNowBtn) {
                checkNowBtn.addEventListener('click', async () => {
                    try {
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
                    } catch (err) {
                        checkNowBtn.removeAttribute('disabled');
                        UIUtils.catchError('Popup', 'Error checking due cards manually', err);
                    }
                });
            }

            // UA-010: Safari notification capability guard
            if (!BROWSER_CONFIG.supportsNotifications) {
                const notifCard = document.getElementById('notification-settings-card');
                if (notifCard) {
                    notifCard.style.display = 'none';
                }
            }

            // Standard JSON database backup export logic
            if (this.dom.exportBtn) {
                this.dom.exportBtn.addEventListener('click', async () => {
                    this.showStatus("Exporting backup...");
                    try {
                        await BackupManager.exportBackup();
                        this.showStatus("Backup exported successfully!");
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Popup', `Backup export failed: ${errorMessage}`, { err });
                        this.showStatus("Export failed: " + errorMessage, true);
                    }
                });
            }

            // Firefox closes popups when OS file pickers open, silently killing the import script.
            // Intercept clicks on file inputs in Firefox popups and open the dashboard as a full tab.
            const handleFirefoxPopupFileClick = (e: Event) => {
                const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
                const isTab = window.location.search.includes('tab=true');
                if (isFirefox && !isTab) {
                    e.preventDefault();
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/popup/popup.html?tab=true') });
                    window.close();
                }
            };

            const handleLabelKeydown = (e: KeyboardEvent, fileInput: HTMLInputElement | null) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput?.click();
                }
            };
            const importLabel = document.getElementById('import-btn-label');
            importLabel?.addEventListener('keydown', (e: KeyboardEvent) => handleLabelKeydown(e, this.dom.importFile));
            const ankiImportLabel = document.getElementById('anki-import-btn-label');
            ankiImportLabel?.addEventListener('keydown', (e: KeyboardEvent) => handleLabelKeydown(e, this.dom.ankiImportFile));

            // Standard JSON backup import setup
            if (this.dom.importFile) {
                this.dom.importFile.addEventListener('click', handleFirefoxPopupFileClick);
                this.dom.importFile.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const file = target.files?.[0];
                        if (!file) return;

                        this.showStatus("Restoring backup...");
                        await BackupManager.importBackup(file, async (msg: string, isError?: boolean) => {
                            try {
                                this.showStatus(msg, isError);
                                if (!isError && msg.includes("successfully")) {
                                    await this.loadAll();
                                    // Update UI settings toggles in case they changed
                                    chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                                        try {
                                            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                            if (lastError) {
                                                const errorMessage = lastError.message || String(lastError);
                                                Logger.error('Popup', `Storage error fetching extensionSettings after import: ${errorMessage}`, { error: lastError });
                                                return;
                                            }
                                            if (result.extensionSettings) {
                                                if (result.extensionSettings.showMarkerPopup !== undefined && this.dom.markerToggle) {
                                                    this.dom.markerToggle.checked = result.extensionSettings.showMarkerPopup;
                                                }
                                                if (result.extensionSettings.showLauncher !== undefined && this.dom.launcherToggle) {
                                                    this.dom.launcherToggle.checked = result.extensionSettings.showLauncher;
                                                    this.dom.launcherToggle.setAttribute('aria-checked', result.extensionSettings.showLauncher.toString());
                                                }
                                                if (result.extensionSettings.showCharts !== undefined && this.dom.chartsToggle) {
                                                    this.dom.chartsToggle.checked = result.extensionSettings.showCharts;
                                                    this.updateChartsVisibility(result.extensionSettings.showCharts);
                                                }
                                                if (result.extensionSettings.developerMode !== undefined && this.dom.devModeToggle) {
                                                    this.dom.devModeToggle.checked = result.extensionSettings.developerMode;
                                                }
                                            }
                                        } catch (cbErr) {
            UIUtils.catchError('Popup', 'Error updating UI toggles post-import', cbErr);
        }
                                    });
                                }
                            } catch (importCbErr) {
            UIUtils.catchError('Popup', 'Error in import backup callback', importCbErr);
        }
                        });
                        target.value = ''; // Reset file input
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        this.showStatus(`Import failed: ${msg}`, true);
                        UIUtils.catchError('Popup', 'Error in importFile change listener', err);
                    }
                });
            }

            // R9.1: Anki backup export setup
            if (this.dom.ankiExportBtn) {
                this.dom.ankiExportBtn.addEventListener('click', () => {
                    try {
                        chrome.storage.local.get(['fsrsCards'], (result: StorageData) => {
                            try {
                                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                if (lastError) {
                                    const errorMessage = lastError.message || String(lastError);
                                    Logger.error('Popup', `Storage error fetching cards for Anki export: ${errorMessage}`, { error: lastError });
                                    this.showStatus('Error reading cards.', true);
                                    return;
                                }
                                const cards = result.fsrsCards || [];
                                if (cards.length === 0) {
                                    this.showStatus('No cards to export.', true);
                                    return;
                                }
                                const ankiText = this.exportToAnkiText(cards);
                                const blob = new Blob([ankiText], { type: 'text/plain;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const filename = `algorecall_anki_${new Date().toISOString().split('T')[0]}.txt`;

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
                                this.showStatus(`Exported ${cards.length} cards for Anki!`);

                            } catch (innerErr) {
                                const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                                Logger.error('Popup', `Error processing Anki export: ${errorMessage}`, { innerErr });
                                this.showStatus('Error processing Anki export.', true);
                            }
                        });
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error in ankiExportBtn click listener', err);
        }
                });
            }

            // R9.1: Anki deck import setup
            if (this.dom.ankiImportFile) {
                this.dom.ankiImportFile.addEventListener('click', handleFirefoxPopupFileClick);
                this.dom.ankiImportFile.addEventListener('change', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const file = target.files?.[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onload = (event: ProgressEvent<FileReader>) => {
                            try {
                                const text = event.target?.result as string;
                                const newCards = this.importFromAnkiText(text);

                                if (newCards.length === 0) {
                                    this.showStatus('No valid cards found in file.', true);
                                    return;
                                }

                                chrome.storage.local.get(['fsrsCards'], (result: StorageData) => {
                                    try {
                                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                        if (lastError) {
                                            const errorMessage = lastError.message || String(lastError);
                                            Logger.error('Popup', `Storage error reading existing cards for Anki import: ${errorMessage}`, { error: lastError });
                                            this.showStatus('Error accessing card storage.', true);
                                            return;
                                        }
                                        const existing = result.fsrsCards || [];
                                        const existingTitles = new Set(existing.map((c: Card) => c.problemTitle?.toLowerCase()));

                                        // Skip duplicates by title
                                        const unique = newCards.filter(c => !existingTitles.has(c.problemTitle?.toLowerCase()));
                                        const merged = [...existing, ...unique];

                                        chrome.storage.local.set({ fsrsCards: merged }, () => {
                                            try {
                                                const setLastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                                if (setLastError) {
                                                    const errorMessage = setLastError.message || String(setLastError);
                                                    Logger.error('Popup', `Storage error saving imported Anki cards: ${errorMessage}`, { error: setLastError });
                                                    this.showStatus('Error saving imported cards.', true);
                                                    return;
                                                }
                                                this.showStatus(`Imported ${unique.length} cards from Anki! (${newCards.length - unique.length} duplicates skipped)`);
                                                this.stats.load();
                                            } catch (setCbErr) {
            UIUtils.catchError('Popup', 'Error in storage set callback for Anki import', setCbErr);
        }
                                        });
                                    } catch (readCbErr) {
            UIUtils.catchError('Popup', 'Error in storage get callback for Anki import', readCbErr);
        }
                                });
                            } catch (readerErr) {
                                const errorMessage = readerErr instanceof Error ? readerErr.message : String(readerErr);
                                Logger.error('Popup', `Error parsing Anki text file: ${errorMessage}`, { readerErr });
                                this.showStatus('Error reading Anki file.', true);
                            }
                        };
                        reader.readAsText(file);
                        target.value = ''; // Reset file input
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error in ankiImportFile change listener', err);
        }
                });
            }
        } catch (err) {
            UIUtils.catchError('Popup', 'Error binding popup dashboard events', err);
        }
    }

    /**
     * Triggers a status message toast at the top of the popup dashboard.
     * @param {string} msg - Descriptive message string.
     * @param {boolean} [isError=false] - Signals if the status indicates an error.
     */
    showStatus(msg: string, isError: boolean = false): void {
        try {
            const el = this.dom.statusMsg;
            if (!el) return;

            if (this.statusTimeout) {
                clearTimeout(this.statusTimeout);
            }

            const iconHtml = isError
                ? `<svg class="svg-icon" style="stroke: var(--md-danger); width: 14px; height: 14px;" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
                : `<svg class="svg-icon" style="stroke: var(--md-success); width: 14px; height: 14px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

            el.innerHTML = iconHtml + `<span>${msg}</span>`;
            el.className = 'toast show ' + (isError ? 'error' : 'success'); // styled to match base toast

            this.statusTimeout = setTimeout(() => {
                try {
                    el.classList.remove('show');
                } catch (timerErr) {
            UIUtils.catchError('Popup', 'Error hiding status toast', timerErr);
        }
            }, 2500);
        } catch (err) {
            UIUtils.catchError('Popup', 'Error rendering status toast', err, { msg, isError });
        }
    }

    /**
     * Export FSRS cards to Anki-compatible tab-separated text.
     * Format: Front<TAB>Back<TAB>Tags
     * Includes Anki header directives for auto-configuration on import.
     * @param {Card[]} cards - Array of FSRS cards.
     * @returns {string} Anki-compatible text data.
     */
    exportToAnkiText(cards: Card[]): string {
        try {
            return ActionService.formatCardsForAnki(cards);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Popup', `Error formatting cards for Anki export: ${errorMessage}`, { err });
            return '';
        }
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
     * Import Anki tab-separated text into FSRS card objects.
     * Expects: Front<TAB>Back<TAB>Tags (optional)
     * @param {string} text - The raw Anki-formatted text content.
     * @returns {Card[]} Created stub FSRS card objects.
     */
    importFromAnkiText(text: string): Card[] {
        try {
            const lines = text.split('\n');
            const cards: Card[] = [];
            const now = Date.now();

            for (const line of lines) {
                // Skip Anki header directives and empty lines
                if (!line.trim() || line.startsWith('#')) continue;

                const parts = line.split('\t');
                if (parts.length < 2) continue;

                let front = parts[0].trim();
                const back = parts[1].trim();
                const tagsStr = parts[2] ? parts[2].trim() : '';

                if (!front) continue;

                // Extract URL from front if present (format: [URL: ...])
                let problemUrl = '';
                const urlMatch = front.match(/\[URL:\s*(.*?)\]/);
                if (urlMatch) {
                    problemUrl = urlMatch[1].trim();
                    front = front.replace(/\n?\[URL:.*?\]/, '').trim();
                }

                // Parse tags: remove algorecall:: prefix, convert underscores back to spaces
                const tags = tagsStr
                    ? tagsStr.split(/\s+/)
                        .map(t => t.replace(/^algorecall::/, '').replace(/_/g, ' '))
                        .filter(t => t)
                    : [];

                // Create stub FSRS card
                const card: Card = {
                    id: `imported_${now}_${Math.random().toString(36).substr(2, 8)}`,
                    problemTitle: front,
                    problemUrl: problemUrl || `#imported-${encodeURIComponent(front.substring(0, 50))}`,
                    approach: back,
                    tags: tags,
                    due: now, // Due immediately for first review
                    stability: 0,
                    difficulty: 0,
                    elapsed_days: 0,
                    scheduled_days: 0,
                    learning_steps: 0,
                    reps: 0,
                    lapses: 0,
                    state: 0, // New
                    last_review: null,
                    lastRating: undefined,
                    historyLog: [],
                    previousDue: undefined
                };

                cards.push(card);
            }

            return cards;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Popup', `Error parsing Anki cards from text: ${errorMessage}`, { err });
            return [];
        }
    }
}

/**
 * Initializes the popup dashboard controller when the DOM is ready.
 */
function initPopupDashboard(): void {
    try {
        const dashboard = new AlgoRecallDashboard();
        dashboard.init();
    } catch (err) {
            UIUtils.catchError('Popup', 'Initialization failed', err);
        }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopupDashboard);
    } else {
        initPopupDashboard();
    }
}

if (typeof module !== "undefined" && module.exports) {
    (module.exports as any).AlgoRecallDashboard = AlgoRecallDashboard;
    (module.exports as any).PopupHeader = PopupHeader;
    (module.exports as any).PopupNavigationGrid = PopupNavigationGrid;
    (module.exports as any).PopupSettingsToggles = PopupSettingsToggles;
    (module.exports as any).PopupStatusToast = PopupStatusToast;
    (module.exports as any).PopupApp = PopupApp;
    (module.exports as any).initPopupDashboard = initPopupDashboard;
}
