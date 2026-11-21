/**
 * @file features/common/settings/settings.tsx
 * @context Standalone Options & Dedicated Settings Hub Tab (Preact)
 * @description Controller and Preact functional UI components for the AlgoRecall Settings Hub.
 * Manages notification schedules, in-page overlay switches, JSON backup/restore,
 * Anki deck exchange, developer diagnostics, and browser theme preferences.
 */

import { h, render, JSX, VNode } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { Logger } from '@common/logger';
import { Toast } from '../ui/components/Toast';
import { UIUtils } from '../utils/uiUtils';
import { CatchAndLog, withErrorHandling } from '../../../decorators';
import { StorageData, NotificationSettings, ExtensionSettings, Card } from '../../../types/domain';
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_EXTENSION_SETTINGS } from '../constants';
import { BROWSER_CONFIG } from '../browserConfig';
import { BackupManager } from '../data/backupManager';
import { ActionService } from '../services/actionService';

/**
 * Extended notification preferences including legacy and UI convenience keys.
 */
export interface FullNotificationSettings extends NotificationSettings {
    sticky?: boolean;
    weeklyDigest?: boolean;
    badgeDueCount?: boolean;
    customInterval?: number;
}

/**
 * Extended extension settings including UI customization flags.
 */
export interface FullExtensionSettings extends ExtensionSettings {
    showDailyFocus?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for SettingsHeader component.
 */
export interface SettingsHeaderProps {
    /** Callback triggered when the theme toggle button is clicked */
    onToggleTheme?: () => void;
}

/**
 * SettingsHeader Preact component rendering top app bar and theme switcher.
 */
export function SettingsHeader({ onToggleTheme }: SettingsHeaderProps): JSX.Element {
    return (
        <header className="settings-header">
            <div className="header-brand">
                <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                    <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                </svg>
                <div className="brand-text">
                    <h1 className="brand-title">
                        AlgoRecall <span className="badge-sub">Settings</span>
                    </h1>
                    <p className="brand-subtitle">Spaced Repetition &amp; Pattern Memory System</p>
                </div>
            </div>
            <div className="header-actions">
                <button
                    id="theme-toggle-btn"
                    className="icon-btn theme-toggle-btn"
                    title="Toggle Theme"
                    aria-label="Toggle Theme"
                    onClick={onToggleTheme}
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
            </div>
        </header>
    );
}

/**
 * Props for SettingsNav component.
 */
export interface SettingsNavProps {
    /** Currently active tab identifier */
    activeTab: string;
    /** Callback to switch active tab */
    onSelectTab: (tabId: string) => void;
}

/**
 * SettingsNav Preact component rendering sidebar tabs and privacy pill.
 */
export function SettingsNav({ activeTab, onSelectTab }: SettingsNavProps): JSX.Element {
    const tabs = [
        {
            id: 'notifications',
            label: 'Notifications & Reminders',
            icon: (
                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
            )
        },
        {
            id: 'highlighter',
            label: 'Highlighter & Overlays',
            icon: (
                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
            )
        },
        {
            id: 'data',
            label: 'Data, Backup & Anki',
            icon: (
                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                </svg>
            )
        },
        {
            id: 'integrations',
            label: 'Websites & Engine',
            icon: (
                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
            )
        },
        {
            id: 'developer',
            label: 'General Settings',
            icon: (
                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                </svg>
            )
        },
        {
            id: 'about',
            label: 'About & Privacy',
            icon: (
                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            )
        }
    ];

    return (
        <nav className="settings-sidebar" aria-label="Settings Categories">
            <ul className="nav-tabs" role="tablist">
                {tabs.map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                        <li key={tab.id} role="presentation">
                            <button
                                className={`nav-tab ${isSelected ? 'active' : ''}`}
                                data-tab={tab.id}
                                role="tab"
                                id={`tab-btn-${tab.id}`}
                                aria-selected={isSelected ? 'true' : 'false'}
                                aria-controls={`panel-${tab.id}`}
                                onClick={() => onSelectTab(tab.id)}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="sidebar-footer">
                <div className="privacy-pill">
                    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>100% Local &amp; Private</span>
                </div>
            </div>
        </nav>
    );
}

/**
 * Props for NotificationsPanel component.
 */
export interface NotificationsPanelProps {
    /** Whether this tab panel is currently active/visible */
    isActive: boolean;
    /** Current notification settings state */
    settings?: FullNotificationSettings;
    /** Current state of weekly digest setting */
    weeklySummaryEnabled?: boolean;
    /** Whether developer mode is active (enabling 1-min interval) */
    developerMode?: boolean;
    /** Callback to update notification preferences */
    onUpdate?: (updates: Partial<FullNotificationSettings>, weeklyDigest?: boolean) => void | Promise<void>;
    /** Optional toast feedback function */
    showToast?: (message: string, isError?: boolean) => void;
}

/**
 * NotificationsPanel Preact component configuring reminder intervals, quiet hours, and badges.
 */
export function NotificationsPanel({
    isActive,
    settings = {},
    weeklySummaryEnabled = true,
    developerMode = false,
    onUpdate
}: NotificationsPanelProps): JSX.Element {
    const isEnabled = settings.enabled !== false;
    const isSticky = settings.requireInteraction !== false && settings.sticky !== false;
    const isQuiet = settings.quietHoursEnabled === true;
    const qStart = settings.quietHoursStart || '23:00';
    const qEnd = settings.quietHoursEnd || '07:00';
    const isWeekly = weeklySummaryEnabled && settings.weeklyDigest !== false;
    const isBadge = settings.badgeEnabled !== false && settings.showDueBadge !== false && settings.badgeDueCount !== false;

    const rawFreq = String(settings.frequency || '60');
    const standardOptions = ['1', '15', '30', '60', '120', '360', '720', '1440'];
    const isCustom = !standardOptions.includes(rawFreq) || rawFreq === 'custom';
    const selectedFreq = isCustom ? 'custom' : rawFreq;
    const customValue = settings.customInterval ? String(settings.customInterval) : (isCustom && rawFreq !== 'custom' ? rawFreq : '60');

    const handleToggleEnabled = (e: Event) => {
        const checked = (e.target as HTMLInputElement).checked;
        if (checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
        onUpdate?.({ enabled: checked });
    };

    const handleIntervalChange = (e: Event) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === 'custom') {
            const parsed = parseInt(customValue, 10) || 60;
            onUpdate?.({ frequency: String(parsed), customInterval: parsed });
        } else {
            const parsed = parseInt(val, 10) || 60;
            onUpdate?.({ frequency: val, customInterval: parsed });
        }
    };

    const handleCustomIntervalChange = (e: Event) => {
        const val = (e.target as HTMLInputElement).value;
        const parsed = parseInt(val, 10);
        const validVal = !isNaN(parsed) && parsed > 0 ? parsed : 60;
        onUpdate?.({ frequency: String(validVal), customInterval: validVal });
    };

    return (
        <section
            id="panel-notifications"
            className={`tab-panel ${isActive ? 'active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-btn-notifications"
        >
            <div className="panel-header">
                <h2>Notifications &amp; Review Reminders</h2>
                <p className="panel-desc">
                    Configure spaced repetition alarms, reminder frequencies, quiet hours, and toolbar badges.
                </p>
            </div>

            {/* Master Switch Card */}
            <div className="settings-card highlight-card">
                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-notifications" className="setting-title">Review Reminders</label>
                        <p className="setting-subtitle">
                            Receive browser notifications when coding interview patterns are due for spaced repetition.
                        </p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-notifications"
                            role="switch"
                            checked={isEnabled}
                            aria-checked={isEnabled ? 'true' : 'false'}
                            onChange={handleToggleEnabled}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            {/* Schedule & Timing Card */}
            <div className="settings-card">
                <h3 className="card-section-title">Schedule &amp; Timing</h3>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="notification-interval" className="setting-title">Check Interval</label>
                        <p className="setting-subtitle">
                            How frequently AlgoRecall checks your deck for due patterns in the background.
                        </p>
                    </div>
                    <div className="control-wrapper">
                        <select
                            id="notification-interval"
                            className="modern-select"
                            value={selectedFreq}
                            onChange={handleIntervalChange}
                        >
                            <option
                                value="1"
                                id="dev-interval-option"
                                hidden={!developerMode}
                                disabled={!developerMode}
                            >
                                1 min (Dev Mode)
                            </option>
                            <option value="15">Every 15 minutes</option>
                            <option value="30">Every 30 minutes</option>
                            <option value="60">Every 1 hour (Recommended)</option>
                            <option value="120">Every 2 hours</option>
                            <option value="360">Every 6 hours</option>
                            <option value="720">Every 12 hours</option>
                            <option value="1440">Daily</option>
                            <option value="custom">Custom interval...</option>
                        </select>
                    </div>
                </div>

                <div id="custom-interval-container" className={`setting-item ${isCustom ? '' : 'hide-panel'}`}>
                    <div className="setting-text">
                        <label htmlFor="custom-interval-input" className="setting-title">Custom Minute Interval</label>
                        <p className="setting-subtitle">Specify reminder period between 1 and 1440 minutes.</p>
                    </div>
                    <div className="control-wrapper">
                        <input
                            type="number"
                            id="custom-interval-input"
                            className="modern-input short-input"
                            min="1"
                            max="1440"
                            placeholder="60"
                            value={customValue}
                            onChange={handleCustomIntervalChange}
                            onInput={handleCustomIntervalChange}
                        />
                    </div>
                </div>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-sticky-notification" className="setting-title">Sticky Notifications</label>
                        <p className="setting-subtitle">
                            Keep reminder notifications visible until explicitly clicked or dismissed.
                        </p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-sticky-notification"
                            role="switch"
                            checked={isSticky}
                            aria-checked={isSticky ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ requireInteraction: c, sticky: c });
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            {/* Quiet Hours Card */}
            <div className="settings-card">
                <h3 className="card-section-title">Quiet Hours</h3>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-quiet-hours" className="setting-title">Enable Quiet Hours</label>
                        <p className="setting-subtitle">Silently suppress all reminders during sleep or focus windows.</p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-quiet-hours"
                            role="switch"
                            checked={isQuiet}
                            aria-checked={isQuiet ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ quietHoursEnabled: c });
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>

                <div id="quiet-hours-container" className={`setting-item ${isQuiet ? '' : 'hide-panel'}`}>
                    <div className="setting-text">
                        <span className="setting-title">Quiet Time Window</span>
                        <p className="setting-subtitle">Start and end times for daily notification silence.</p>
                    </div>
                    <div className="time-range-group">
                        <input
                            type="time"
                            id="quiet-hours-start"
                            className="modern-input time-input"
                            value={qStart}
                            aria-label="Quiet hours start"
                            onChange={(e) => onUpdate?.({ quietHoursStart: (e.target as HTMLInputElement).value })}
                            onInput={(e) => onUpdate?.({ quietHoursStart: (e.target as HTMLInputElement).value })}
                        />
                        <span className="time-separator">to</span>
                        <input
                            type="time"
                            id="quiet-hours-end"
                            className="modern-input time-input"
                            value={qEnd}
                            aria-label="Quiet hours end"
                            onChange={(e) => onUpdate?.({ quietHoursEnd: (e.target as HTMLInputElement).value })}
                            onInput={(e) => onUpdate?.({ quietHoursEnd: (e.target as HTMLInputElement).value })}
                        />
                    </div>
                </div>
            </div>

            {/* Digests & Toolbar Badge Card */}
            <div className="settings-card">
                <h3 className="card-section-title">Digests &amp; Visual Badges</h3>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-weekly-digest" className="setting-title">Weekly Digest Notification</label>
                        <p className="setting-subtitle">Receive an automated review momentum and retention digest every Monday.</p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-weekly-digest"
                            role="switch"
                            checked={isWeekly}
                            aria-checked={isWeekly ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ weeklyDigest: c }, c);
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-badge-due-count" className="setting-title">Toolbar Icon Due Count Badge</label>
                        <p className="setting-subtitle">
                            Display the real-time number of cards due for review directly on the extension icon.
                        </p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-badge-due-count"
                            role="switch"
                            checked={isBadge}
                            aria-checked={isBadge ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ badgeEnabled: c, showDueBadge: c, badgeDueCount: c });
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>
        </section>
    );
}

/**
 * Props for HighlighterPanel component.
 */
export interface HighlighterPanelProps {
    /** Whether this tab panel is currently active/visible */
    isActive: boolean;
    /** Current extension settings state */
    settings?: FullExtensionSettings;
    /** Callback to update extension settings */
    onUpdate?: (updates: Partial<FullExtensionSettings>) => void | Promise<void>;
    /** Optional toast feedback function */
    showToast?: (message: string, isError?: boolean) => void;
}

/**
 * HighlighterPanel Preact component configuring floating marker and problem tracker launchers.
 */
export function HighlighterPanel({
    isActive,
    settings = {},
    onUpdate
}: HighlighterPanelProps): JSX.Element {
    const isMarker = settings.showMarkerPopup !== false;
    const isLauncher = settings.showLauncher !== false;

    return (
        <section
            id="panel-highlighter"
            className={`tab-panel ${isActive ? 'active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-btn-highlighter"
        >
            <div className="panel-header">
                <h2>Highlighter &amp; In-Page Overlays</h2>
                <p className="panel-desc">
                    Customize text selection highlighters, floating markers, and problem tracker launcher overlays.
                </p>
            </div>

            <div className="settings-card">
                <h3 className="card-section-title">In-Page Assistive Menus</h3>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-marker-popup" className="setting-title">Floating Marker Menu</label>
                        <p className="setting-subtitle">
                            Display a quick highlight color popup whenever you select text on supported problem sites.
                        </p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-marker-popup"
                            role="switch"
                            checked={isMarker}
                            aria-checked={isMarker ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ showMarkerPopup: c });
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-algo-launcher" className="setting-title">Problem Tracker Launcher</label>
                        <p className="setting-subtitle">
                            Inject floating side launcher button on LeetCode, Codeforces, and AlgoMonster problem pages.
                        </p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-algo-launcher"
                            role="switch"
                            checked={isLauncher}
                            aria-checked={isLauncher ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ showLauncher: c });
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="settings-card">
                <h3 className="card-section-title">Highlights Management &amp; Palettes</h3>
                <p className="section-desc">
                    Manage highlighted code snippets, organize saved solution notes, and customize highlighter colors.
                </p>

                <div className="feature-launcher-grid">
                    <div className="feature-card">
                        <div className="feature-card-header">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-warning)' }} aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            <h4>Customize Highlighter Colors</h4>
                        </div>
                        <p>Create custom color themes, adjust marker opacity, and organize highlight categories.</p>
                        <a href="../../highlighter/options/highlightOptions.html" className="btn btn-secondary btn-sm">
                            Open Color Options &rarr;
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

/**
 * Props for DataPanel component.
 */
export interface DataPanelProps {
    /** Whether this tab panel is currently active/visible */
    isActive: boolean;
    /** Callback to export JSON/GZIP backup */
    onExportBackup?: () => void | Promise<void>;
    /** Callback to restore JSON/GZIP backup */
    onImportBackup?: (file: File) => void | Promise<void>;
    /** Callback to export Anki TSV deck */
    onExportAnki?: () => void | Promise<void>;
    /** Callback to import Anki TSV/TXT file */
    onImportAnki?: (file: File) => void | Promise<void>;
    /** Optional toast feedback function */
    showToast?: (message: string, isError?: boolean) => void;
}

/**
 * DataPanel Preact component providing local backup/restore and Anki TSV exchange.
 */
export function DataPanel({
    isActive,
    onExportBackup,
    onImportBackup,
    onExportAnki,
    onImportAnki
}: DataPanelProps): JSX.Element {
    const importFileRef = useRef<HTMLInputElement>(null);
    const ankiImportFileRef = useRef<HTMLInputElement>(null);

    const handleImportFileChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0] && onImportBackup) {
            onImportBackup(input.files[0]);
            input.value = '';
        }
    };

    const handleAnkiImportFileChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0] && onImportAnki) {
            onImportAnki(input.files[0]);
            input.value = '';
        }
    };

    return (
        <section
            id="panel-data"
            className={`tab-panel ${isActive ? 'active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-btn-data"
        >
            <div className="panel-header">
                <h2>Data Management, Backup &amp; Anki Sync</h2>
                <p className="panel-desc">
                    Export and restore full JSON backups or synchronize flashcard patterns with Anki desktop.
                </p>
            </div>

            <div className="settings-card">
                <h3 className="card-section-title">Local Backup &amp; Restore</h3>
                <p className="section-desc">
                    AlgoRecall stores all patterns and review history locally in your browser. Back up regularly to protect your spaced repetition progress.
                </p>

                <div className="data-actions-flex">
                    <div className="data-action-box">
                        <div className="action-info">
                            <h4 className="action-title">Export All Data (JSON)</h4>
                            <p className="action-desc">
                                Download a full snapshot of your problem cards, review schedules, highlighter annotations, and notes.
                            </p>
                        </div>
                        <button id="settings-export-btn" className="btn btn-success" onClick={onExportBackup}>
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                            </svg>
                            Export Full Backup
                        </button>
                    </div>

                    <div className="data-action-box">
                        <div className="action-info">
                            <h4 className="action-title">Restore from Backup</h4>
                            <p className="action-desc">
                                Restore your cards and review streaks from a previously saved JSON or GZIP file.
                            </p>
                        </div>
                        <label
                            id="settings-import-label"
                            className="btn btn-danger"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    importFileRef.current?.click();
                                }
                            }}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            Restore Backup File
                            <input
                                ref={importFileRef}
                                type="file"
                                id="settings-import-file"
                                accept=".json,.gz,.json.gz"
                                style={{ display: 'none' }}
                                onChange={handleImportFileChange}
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="settings-card">
                <h3 className="card-section-title">Anki Desktop Interchange</h3>
                <p className="section-desc">
                    Seamlessly move your algorithm flashcard patterns into or out of Anki using tab-separated format (TSV).
                </p>

                <div className="data-actions-flex">
                    <div className="data-action-box">
                        <div className="action-info">
                            <h4 className="action-title">Export to Anki (TSV)</h4>
                            <p className="action-desc">
                                Export cards with problem titles, URLs, tags, and approach notes formatted for direct Anki deck import.
                            </p>
                        </div>
                        <button id="settings-anki-export-btn" className="btn btn-primary" onClick={onExportAnki}>
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            Export Anki Deck
                        </button>
                    </div>

                    <div className="data-action-box">
                        <div className="action-info">
                            <h4 className="action-title">Import from Anki (TSV / TXT)</h4>
                            <p className="action-desc">
                                Import text/TSV files exported from Anki into your AlgoRecall spaced repetition queue.
                            </p>
                        </div>
                        <label
                            id="settings-anki-import-label"
                            className="btn btn-secondary"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    ankiImportFileRef.current?.click();
                                }
                            }}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Import Anki File
                            <input
                                ref={ankiImportFileRef}
                                type="file"
                                id="settings-anki-import-file"
                                accept=".txt,.tsv"
                                style={{ display: 'none' }}
                                onChange={handleAnkiImportFileChange}
                            />
                        </label>
                    </div>
                </div>
            </div>
        </section>
    );
}

/**
 * Props for IntegrationsPanel component.
 */
export interface IntegrationsPanelProps {
    /** Whether this tab panel is currently active/visible */
    isActive: boolean;
}

/**
 * IntegrationsPanel Preact component linking to whitelist management and AlgoRecall Engine configuration.
 */
export function IntegrationsPanel({ isActive }: IntegrationsPanelProps): JSX.Element {
    return (
        <section
            id="panel-integrations"
            className={`tab-panel ${isActive ? 'active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-btn-integrations"
        >
            <div className="panel-header">
                <h2>Websites &amp; Spaced Repetition Engine</h2>
                <p className="panel-desc">Manage whitelisted practice platforms and tune the AlgoRecall Engine scheduling.</p>
            </div>

            <div className="settings-card">
                <div className="card-header-icon-group">
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-primary)' }} aria-hidden="true">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <div>
                        <h3 className="card-section-title">Active Problem Websites</h3>
                        <p className="section-desc">
                            Control where AlgoRecall automatically mounts the problem tracking widget and text highlighter.
                        </p>
                    </div>
                </div>
                <p className="card-subtext">
                    Currently supporting LeetCode, AlgoMonster, Codeforces, HackerRank, CodeChef, AtCoder, SystemDesignSchool, and custom domains.
                </p>
                <div className="mt-3">
                    <a href="../websites/websites.html" className="btn btn-secondary">
                        Manage Active Websites &rarr;
                    </a>
                </div>
            </div>

            <div className="settings-card">
                <div className="card-header-icon-group">
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-warning)' }} aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <div>
                        <h3 className="card-section-title">Configure AlgoRecall Engine</h3>
                        <p className="section-desc">
                            Tune the 17-parameter AlgoRecall Engine weight vector, adjust target retention (70% - 95%), or run Nelder-Mead weight optimization.
                        </p>
                    </div>
                </div>
                <p className="card-subtext">
                    The AlgoRecall Engine provides superior memory stability compared to legacy SM-2 algorithms.
                </p>
                <div className="mt-3">
                    <a href="../../tracker/config/fsrsConfig.html" className="btn btn-secondary">
                        Open Engine Configuration &rarr;
                    </a>
                </div>
            </div>
        </section>
    );
}

/**
 * Props for DeveloperPanel component.
 */
export interface DeveloperPanelProps {
    /** Whether this tab panel is currently active/visible */
    isActive: boolean;
    /** Current extension settings state */
    settings?: FullExtensionSettings;
    /** Callback to update extension settings */
    onUpdate?: (updates: Partial<FullExtensionSettings>) => void | Promise<void>;
    /** Callback to trigger a test reminder alert */
    onTestNotification?: () => void;
    /** Callback to trigger a test summary notification */
    onTestSummary?: () => void;
    /** Callback to export diagnostic logs as JSON */
    onExportDebugLogs?: () => void | Promise<void>;
    /** Optional toast feedback function */
    showToast?: (message: string, isError?: boolean) => void;
}

/**
 * DeveloperPanel Preact component configuring developer tools, test notifications, and diagnostic logs.
 */
export function DeveloperPanel({
    isActive,
    settings = {},
    onUpdate,
    onTestNotification,
    onTestSummary,
    onExportDebugLogs
}: DeveloperPanelProps): JSX.Element {
    const isCharts = settings.showCharts !== false;
    const isDailyFocus = settings.showDailyFocus !== false;
    const isDev = settings.developerMode ?? false;

    return (
        <section
            id="panel-developer"
            className={`tab-panel ${isActive ? 'active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-btn-developer"
        >
            <div className="panel-header">
                <h2>General Preferences</h2>
                <p className="panel-desc">Advanced debugging utilities, popup customization, and log inspection.</p>
            </div>

            <div className="settings-card">
                <h3 className="card-section-title">Interface &amp; Appearance</h3>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-show-charts" className="setting-title">Show Activity &amp; Charts in Popup</label>
                        <p className="setting-subtitle">
                            Display the daily streak momentum and mini activity heatmap inside the browser popup window.
                        </p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-show-charts"
                            role="switch"
                            checked={isCharts}
                            aria-checked={isCharts ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ showCharts: c });
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-daily-focus" className="setting-title">Show Daily Focus &amp; Momentum in Popup</label>
                        <p className="setting-subtitle">
                            Display the daily goal progress ring, streak count, and momentum inside the browser popup window.
                        </p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-daily-focus"
                            role="switch"
                            checked={isDailyFocus}
                            aria-checked={isDailyFocus ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ showDailyFocus: c });
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="settings-card">
                <h3 className="card-section-title">Developer &amp; Diagnostic Tools</h3>

                <div className="setting-item">
                    <div className="setting-text">
                        <label htmlFor="toggle-dev-mode" className="setting-title">Developer Mode</label>
                        <p className="setting-subtitle">
                            Exposes 1-minute reminder alarms, diagnostic test triggers, and verbose console telemetry.
                        </p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="toggle-dev-mode"
                            role="switch"
                            checked={isDev}
                            aria-checked={isDev ? 'true' : 'false'}
                            onChange={(e) => {
                                const c = (e.target as HTMLInputElement).checked;
                                onUpdate?.({ developerMode: c });
                            }}
                        />
                        <span className="slider"></span>
                    </label>
                </div>

                <div id="dev-actions-container" className={`mt-3 ${isDev ? '' : 'hide-panel'}`}>
                    <div className="dev-box">
                        <h4 className="dev-title">Diagnostic Test Alerts</h4>
                        <p className="dev-desc">Trigger test notifications through Chrome/WebExtension background worker.</p>
                        <div className="card-actions-row">
                            <button id="settings-test-notification-btn" className="btn btn-secondary btn-sm" onClick={onTestNotification}>
                                Send Test Notification
                            </button>
                            <button id="settings-test-summary-notification-btn" className="btn btn-secondary btn-sm" onClick={onTestSummary}>
                                Send Test Summary
                            </button>
                        </div>
                    </div>

                    <div className="dev-box mt-3">
                        <h4 className="dev-title">Debug Logs Export</h4>
                        <p className="dev-desc">Export extension event traces and storage logs for troubleshooting.</p>
                        <button id="settings-export-debug-logs-btn" className="btn btn-secondary btn-sm" onClick={onExportDebugLogs}>
                            Export Debug Logs (JSON)
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

/**
 * Props for AboutPanel component.
 */
export interface AboutPanelProps {
    /** Whether this tab panel is currently active/visible */
    isActive: boolean;
}

/**
 * AboutPanel Preact component presenting version info, privacy statement, and rating links.
 */
export function AboutPanel({ isActive }: AboutPanelProps): JSX.Element {
    return (
        <section
            id="panel-about"
            className={`tab-panel ${isActive ? 'active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-btn-about"
        >
            <div className="panel-header">
                <h2>About AlgoRecall</h2>
                <p className="panel-desc">Version information, privacy guarantee, and community feedback.</p>
            </div>

            <div className="settings-card">
                <div className="about-hero">
                    <div className="about-badge">
                        <svg className="svg-icon logo-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                    </div>
                    <div className="about-info">
                        <h3>AlgoRecall Browser Extension</h3>
                        <p className="version-text">Version 3.1 &bull; Local-First Spaced Repetition for LeetCode &amp; Coding Interviews</p>
                    </div>
                </div>

                <div className="privacy-callout">
                    <svg className="svg-icon callout-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <div>
                        <h4>100% Private, Local-First Architecture</h4>
                        <p>
                            AlgoRecall never tracks you, never uploads your cards to an external cloud without your permission, and requires zero user account creation. All cards, review logs, and highlights reside securely inside your local browser storage.
                        </p>
                    </div>
                </div>

                <div className="card-actions-row mt-4">
                    <a href="../help/help.html" className="btn btn-secondary">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        User Guide &amp; FAQ
                    </a>
                    <a href="../help/help.html?tab=privacy" className="btn btn-secondary">
                        Privacy Policy
                    </a>
                    <a
                        href={BROWSER_CONFIG.reviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        id="about-rate-store-btn"
                        className="btn btn-primary"
                        title={`Rate AlgoRecall on ${BROWSER_CONFIG.storeName}`}
                    >
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Rate on Web Store
                    </a>
                </div>
            </div>
        </section>
    );
}

/**
 * Props for SettingsApp root component.
 */
export interface SettingsAppProps {
    /** Initial tab to open (defaults to URL hash or 'notifications') */
    initialTab?: string;
}

/**
 * SettingsApp Preact root functional component orchestrating state, sub-components, and storage sync.
 */
export function SettingsApp({ initialTab }: SettingsAppProps): JSX.Element {
    const getHashTab = () => {
        if (typeof window !== 'undefined' && window.location.hash) {
            return window.location.hash.replace('#', '');
        }
        return initialTab || 'notifications';
    };

    const [activeTab, setActiveTabState] = useState<string>(getHashTab);
    const [notifSettings, setNotifSettings] = useState<FullNotificationSettings>({ ...DEFAULT_NOTIFICATION_SETTINGS });
    const [extSettings, setExtSettings] = useState<FullExtensionSettings>({ ...DEFAULT_EXTENSION_SETTINGS });
    const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState<boolean>(true);
    const [toast, setToast] = useState<{ message: string; isError: boolean; visible: boolean }>({
        message: '',
        isError: false,
        visible: false
    });
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((message: string, isError: boolean = false) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({ message, isError, visible: true });
        toastTimeoutRef.current = setTimeout(() => {
            setToast((prev) => ({ ...prev, visible: false }));
        }, 3000);
    }, []);

    const setActiveTab = useCallback((tabId: string) => {
        setActiveTabState(tabId);
        if (typeof window !== 'undefined' && window.location.hash !== `#${tabId}`) {
            window.location.hash = tabId;
        }
    }, []);

    // Load initial settings from chrome.storage.local
    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

        chrome.storage.local.get(
            ['extensionSettings', 'notificationSettings', 'weeklySummaryEnabled'],
            (result: StorageData & { notificationSettings?: NotificationSettings & FullNotificationSettings; weeklySummaryEnabled?: boolean }) => {
                if (result.extensionSettings) {
                    setExtSettings(result.extensionSettings);
                }
                if (result.notificationSettings) {
                    setNotifSettings(result.notificationSettings);
                }
                if (result.weeklySummaryEnabled !== undefined) {
                    setWeeklySummaryEnabled(result.weeklySummaryEnabled !== false);
                }
            }
        );

        const handleHashChange = () => {
            const h = window.location.hash.replace('#', '');
            if (h) setActiveTabState(h);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const handleToggleTheme = useCallback(async () => {
        try {
            await ActionService.toggleTheme();
        } catch (err) {
            Logger.error('SettingsApp', 'Error toggling theme', { err });
        }
    }, []);

    const handleUpdateNotifications = useCallback(
        async (updates: Partial<FullNotificationSettings>, weeklyDigest?: boolean) => {
            try {
                const merged: FullNotificationSettings = { ...notifSettings, ...updates };
                setNotifSettings(merged);

                const storagePayload: Record<string, unknown> = {
                    notificationSettings: merged
                };

                if (weeklyDigest !== undefined) {
                    setWeeklySummaryEnabled(weeklyDigest);
                    storagePayload.weeklySummaryEnabled = weeklyDigest;

                    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                        try {
                            chrome.runtime.sendMessage({ action: 'toggle_weekly_summary', enabled: weeklyDigest }, () => {
                                if (chrome.runtime?.lastError) { /* ignore */ }
                            });
                        } catch {
                            // ignore messaging errors
                        }
                    }
                }

                await chrome.storage.local.set(storagePayload);
                showToast('Notification settings saved');
            } catch (err) {
                Logger.error('SettingsApp', 'Error saving notification settings', { err });
                showToast('Failed to save notification settings', true);
            }
        },
        [notifSettings, showToast]
    );

    const handleUpdateExtensionSettings = useCallback(
        async (updates: Partial<FullExtensionSettings>) => {
            try {
                const merged: FullExtensionSettings = { ...extSettings, ...updates };
                setExtSettings(merged);
                await chrome.storage.local.set({ extensionSettings: merged });

                if (updates.showMarkerPopup !== undefined) {
                    showToast(`Floating marker ${updates.showMarkerPopup ? 'enabled' : 'disabled'}`);
                } else if (updates.showLauncher !== undefined) {
                    showToast(`Problem tracker launcher ${updates.showLauncher ? 'enabled' : 'disabled'}`);
                } else if (updates.showCharts !== undefined) {
                    showToast(`Popup activity charts ${updates.showCharts ? 'enabled' : 'hidden'}`);
                } else if (updates.showDailyFocus !== undefined) {
                    showToast(`Popup daily focus ${updates.showDailyFocus ? 'enabled' : 'hidden'}`);
                } else if (updates.developerMode !== undefined) {
                    showToast(`Developer mode ${updates.developerMode ? 'enabled' : 'disabled'}`);
                } else {
                    showToast('Settings updated');
                }
            } catch (err) {
                Logger.error('SettingsApp', 'Error updating extension settings', { err });
                showToast('Failed to update settings', true);
            }
        },
        [extSettings, showToast]
    );

    const handleExportBackup = useCallback(async () => {
        try {
            await BackupManager.exportBackup();
            showToast('Backup export initiated');
        } catch {
            showToast('Failed to export backup', true);
        }
    }, [showToast]);

    const handleImportBackup = useCallback(
        (file: File) => {
            BackupManager.importBackup(file, (msg: string, isError?: boolean) => {
                showToast(msg, isError ?? false);
            });
        },
        [showToast]
    );

    const handleExportAnki = useCallback(async () => {
        try {
            const result = await ActionService.executeAction('export-anki');
            if (result.success) {
                showToast('Anki deck exported successfully');
            } else {
                showToast(result.error || 'No cards to export', true);
            }
        } catch {
            showToast('Failed to export Anki deck', true);
        }
    }, [showToast]);

    const handleImportAnki = useCallback(
        async (file: File) => {
            try {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
                if (lines.length === 0) {
                    showToast('Import file is empty', true);
                    return;
                }

                const res = (await chrome.storage.local.get(['fsrsCards'])) as StorageData;
                const existingCards: Card[] = res.fsrsCards || [];
                let importedCount = 0;

                for (const line of lines) {
                    const parts = line.split('\t');
                    if (parts.length >= 2) {
                        const title = parts[0].trim();
                        const approach = parts[1].trim();
                        const tags = parts[2] ? parts[2].split(',').map((t) => t.trim()) : ['Anki'];

                        const newCard: Card = {
                            id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                            problemTitle: title,
                            problemUrl: '',
                            approach: approach,
                            tags: tags,
                            due: Date.now(),
                            stability: 1,
                            difficulty: 5,
                            elapsed_days: 0,
                            scheduled_days: 0,
                            learning_steps: 0,
                            reps: 0,
                            lapses: 0,
                            state: 0,
                            historyLog: []
                        };
                        existingCards.push(newCard);
                        importedCount++;
                    }
                }

                if (importedCount > 0) {
                    await chrome.storage.local.set({ fsrsCards: existingCards });
                    showToast(`Imported ${importedCount} card(s) from Anki`);
                } else {
                    showToast('No valid tab-separated cards found in file', true);
                }
            } catch {
                showToast('Failed to import Anki cards', true);
            }
        },
        [showToast]
    );

    const handleTestNotification = useCallback(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'send_test_notification' });
            showToast('Test notification dispatched');
        }
    }, [showToast]);

    const handleTestSummary = useCallback(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'send_test_summary_notification' });
            showToast('Test summary notification dispatched');
        }
    }, [showToast]);

    const handleExportDebugLogs = useCallback(async () => {
        try {
            const result = (await chrome.storage.local.get(['debugLogs'])) as StorageData;
            const logs = result.debugLogs || [];
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const filename = `algorecall-debug-logs-${new Date().toISOString().split('T')[0]}.json`;
            await ActionService.downloadBlobOrFallback(blob, filename, 'features/common/settings/settings.html');
            showToast('Debug logs exported');
        } catch {
            showToast('Failed to export debug logs', true);
        }
    }, [showToast]);

    return (
        <div className="settings-layout">
            <SettingsHeader onToggleTheme={handleToggleTheme} />
            <div className="settings-body">
                <SettingsNav activeTab={activeTab} onSelectTab={setActiveTab} />
                <main className="settings-content">
                    <NotificationsPanel
                        isActive={activeTab === 'notifications'}
                        settings={notifSettings}
                        weeklySummaryEnabled={weeklySummaryEnabled}
                        developerMode={extSettings.developerMode}
                        onUpdate={handleUpdateNotifications}
                        showToast={showToast}
                    />
                    <HighlighterPanel
                        isActive={activeTab === 'highlighter'}
                        settings={extSettings}
                        onUpdate={handleUpdateExtensionSettings}
                        showToast={showToast}
                    />
                    <DataPanel
                        isActive={activeTab === 'data'}
                        onExportBackup={handleExportBackup}
                        onImportBackup={handleImportBackup}
                        onExportAnki={handleExportAnki}
                        onImportAnki={handleImportAnki}
                        showToast={showToast}
                    />
                    <IntegrationsPanel
                        isActive={activeTab === 'integrations'}
                    />
                    <DeveloperPanel
                        isActive={activeTab === 'developer'}
                        settings={extSettings}
                        onUpdate={handleUpdateExtensionSettings}
                        onTestNotification={handleTestNotification}
                        onTestSummary={handleTestSummary}
                        onExportDebugLogs={handleExportDebugLogs}
                        showToast={showToast}
                    />
                    <AboutPanel
                        isActive={activeTab === 'about'}
                    />
                </main>
            </div>
            <Toast
                id="status-toast"
                className="toast modern-toast"
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bootstrap entry function creating and initializing the settings view on DOM readiness.
 */
export function initSettings(): void {
    withErrorHandling(() => {
        const root = document.getElementById('root');
        if (root) {
            render(<SettingsApp />, root);
        }
    }, 'SettingsApp', 'Error instantiating Settings UI')();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettings);
    } else {
        initSettings();
    }
}

export default SettingsApp;
