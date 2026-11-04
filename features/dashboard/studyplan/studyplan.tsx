/**
 * @file features/dashboard/studyplan/studyplan.tsx
 * @description Exam Countdown Mode and study planner controller and Preact components.
 * Redistributes all FSRS cards evenly across remaining calendar days until the target exam date,
 * prioritizing overdue and low-stability cards. Preserves original computed due dates as a backup
 * so spaced repetition schedules can be restored when exam mode is deactivated.
 * Migrated to Preact with TypeScript for modular setup and countdown panels.
 *
 * Architecture Role: Exam Study Plan Standalone Page Controller and Preact Root Component.
 * Context: Extension Standalone Tab (`features/dashboard/studyplan/studyplan.html`).
 * Key Exports:
 * - `StudyPlanSettings`: Configuration schema for active exam countdown deadlines.
 * - `StudyPlanSetupPanel`: Preact component for date selection and preview.
 * - `StudyPlanCountdownRing`: Preact component rendering circular deadline dial.
 * - `StudyPlanActivePanel`: Preact component for active countdown metrics and controls.
 * - `StudyPlanScheduleTable`: Preact component rendering daily schedule breakdown.
 * - `StudyPlanApp`: Root Preact component for the Exam Countdown Mode.
 * - `StudyPlanController`: Controller class managing redistribution logic, previews, and countdown display.
 */

import { h, VNode, render, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { getLastReviewDate } from '../../common/utils/cardUtils';
import { Card, StorageData } from '../../../types/domain';

/**
 * Persistent configuration settings for active Exam Countdown Mode.
 */
export interface StudyPlanSettings {
    /** Whether exam countdown redistribution is currently active. */
    isActive: boolean;
    /** Target exam date string in ISO format (`YYYY-MM-DD`). */
    examDate: string;
    /** Calculated or user-constrained daily review quota. */
    dailyTarget: number;
    /** Epoch timestamp in milliseconds when exam mode was activated. */
    activatedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface StudyPlanSetupPanelProps {
    examDateMin: string;
    daysLeft: number;
    totalCards: number;
    dailyTarget: number;
    showPreview: boolean;
    onExamDateChange: (e: Event) => void;
    onDailyLimitChange: (e: Event) => void;
    onActivate: () => void;
}

/**
 * Preact component for configuring exam deadline date and daily study quota.
 */
export function StudyPlanSetupPanel({
    examDateMin,
    daysLeft,
    totalCards,
    dailyTarget,
    showPreview,
    onExamDateChange,
    onDailyLimitChange,
    onActivate
}: StudyPlanSetupPanelProps): VNode {
    return (
        <div id="setup-panel" className="panel setup-panel">
            <h2 className="panel-title-lg">Set Your Exam Date</h2>
            <p className="panel-description">
                All pattern cards will be redistributed evenly across the remaining days until your exam, prioritizing the most difficult and overdue patterns first.
            </p>

            <div className="setup-form">
                <div className="form-group input-group">
                    <label htmlFor="exam-date-input">Exam Date</label>
                    <input
                        type="date"
                        id="exam-date-input"
                        className="input-field date-input"
                        min={examDateMin}
                        onChange={onExamDateChange}
                        onInput={onExamDateChange}
                    />
                </div>
                <div className="form-group input-group">
                    <label htmlFor="daily-limit-input">Max Patterns per Day (optional)</label>
                    <input
                        type="number"
                        id="daily-limit-input"
                        className="input-field"
                        placeholder="Auto-calculated"
                        min={1}
                        max={200}
                        onInput={onDailyLimitChange}
                    />
                </div>
            </div>

            <div
                id="setup-preview"
                className="setup-preview"
                style={{ display: showPreview ? 'block' : 'none' }}
            >
                <div className="preview-stats">
                    <div className="preview-stat">
                        <div className="preview-stat-value" id="preview-days">{daysLeft}</div>
                        <div className="preview-stat-label">Days Left</div>
                    </div>
                    <div className="preview-stat">
                        <div className="preview-stat-value" id="preview-total">{totalCards}</div>
                        <div className="preview-stat-label">Total Patterns</div>
                    </div>
                    <div className="preview-stat">
                        <div className="preview-stat-value" id="preview-daily">{dailyTarget}</div>
                        <div className="preview-stat-label">Patterns/Day</div>
                    </div>
                </div>
            </div>

            <button
                id="activate-btn"
                className="btn btn-primary btn-lg btn-block"
                disabled={!showPreview}
                onClick={onActivate}
            >
                <svg className="svg-icon" viewBox="0 0 24 24" style={{ marginRight: '6px' }} aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Activate Exam Mode
            </button>
        </div>
    );
}

export interface StudyPlanCountdownRingProps {
    daysLeft: number;
    progress: number;
    title: string;
    examDateFormatted: string;
}

/**
 * Preact component rendering SVG countdown ring and deadline label.
 */
export function StudyPlanCountdownRing({
    daysLeft,
    progress,
    title,
    examDateFormatted
}: StudyPlanCountdownRingProps): VNode {
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (progress * circumference);
    const ringClass = daysLeft <= 3 ? 'urgent' : (daysLeft <= 7 ? 'warning' : '');

    return (
        <div className="countdown-ring-wrap countdown-ring-container">
            <svg className="countdown-ring countdown-ring-svg" viewBox="0 0 120 120">
                <circle className="countdown-ring-bg ring-bg" cx="60" cy="60" r="52" />
                <circle
                    id="countdown-ring-fill"
                    className={`countdown-ring-fill ring-fill ${ringClass}`}
                    cx="60"
                    cy="60"
                    r="52"
                    strokeDasharray={String(circumference)}
                    strokeDashoffset={String(offset)}
                />
            </svg>
            <div className="countdown-ring-text countdown-text">
                <span id="countdown-days" className="countdown-days countdown-number">{daysLeft}</span>
                <span className="countdown-label" id="countdown-title">{title}</span>
                <span className="countdown-date" id="countdown-exam-date">{examDateFormatted}</span>
            </div>
        </div>
    );
}

export interface StudyPlanScheduleRow {
    dayIndex: number;
    dateFormatted: string;
    cardsCount: number;
    status: 'Done' | 'Today' | 'Upcoming';
    isToday: boolean;
    isPast: boolean;
}

export interface StudyPlanScheduleTableProps {
    rows: StudyPlanScheduleRow[];
}

/**
 * Preact component rendering schedule table rows for upcoming review quotas.
 */
export function StudyPlanScheduleTable({ rows }: StudyPlanScheduleTableProps): VNode {
    return (
        <table id="schedule-table" className="schedule-table">
            <thead>
                <tr>
                    <th>Day</th>
                    <th>Date</th>
                    <th>Patterns Due</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody id="schedule-body">
                {rows.map((row) => (
                    <tr
                        key={row.dayIndex}
                        className={row.isToday ? 'today-row' : (row.isPast ? 'past-row' : '')}
                    >
                        <td>Day {row.dayIndex}</td>
                        <td>{row.dateFormatted}</td>
                        <td>{row.cardsCount}</td>
                        <td>
                            <span
                                className={`badge badge-${
                                    row.status === 'Done' ? 'complete' : (row.status === 'Today' ? 'today' : 'upcoming')
                                }`}
                            >
                                {row.status}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export interface StudyPlanActivePanelProps {
    totalCards: number;
    dailyTarget: number;
    completedCards: number;
    daysLeft: number;
    progress: number;
    title: string;
    examDateFormatted: string;
    rows?: StudyPlanScheduleRow[];
    onDeactivate: () => void;
}

/**
 * Preact component rendering active exam mode dashboard and metrics.
 */
export function StudyPlanActivePanel({
    totalCards,
    dailyTarget,
    completedCards,
    daysLeft,
    progress,
    title,
    examDateFormatted,
    rows = [],
    onDeactivate
}: StudyPlanActivePanelProps): VNode {
    return (
        <div id="active-panel" className="panel active-panel">
            <div className="countdown-section">
                <StudyPlanCountdownRing
                    daysLeft={daysLeft}
                    progress={progress}
                    title={title}
                    examDateFormatted={examDateFormatted}
                />
                <div className="countdown-info">
                    <h2 className="countdown-title">{title}</h2>
                    <div className="countdown-meta">
                        <span>{examDateFormatted}</span>
                    </div>
                    <div className="countdown-stats-row active-stats-grid">
                        <div className="countdown-stat stat-card">
                            <span id="active-total-cards" className="countdown-stat-value stat-value">{totalCards}</span>
                            <span className="countdown-stat-label stat-label">Total Patterns</span>
                        </div>
                        <div className="countdown-stat stat-card">
                            <span id="active-daily-target" className="countdown-stat-value stat-value">{dailyTarget}</span>
                            <span className="countdown-stat-label stat-label">Patterns/Day</span>
                        </div>
                        <div className="countdown-stat stat-card">
                            <span id="active-completed" className="countdown-stat-value stat-value">{completedCards}</span>
                            <span className="countdown-stat-label stat-label">Completed</span>
                        </div>
                    </div>
                </div>
            </div>

            {rows.length > 0 && (
                <div>
                    <h3 className="section-title">Daily Review Schedule</h3>
                    <div className="schedule-table-wrap">
                        <StudyPlanScheduleTable rows={rows} />
                    </div>
                </div>
            )}

            <div className="active-actions">
                <button
                    id="deactivate-btn"
                    className="btn btn-danger btn-secondary btn-block"
                    onClick={onDeactivate}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ marginRight: '6px', width: '14px', height: '14px' }} aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Deactivate Exam Mode
                </button>
                <p className="deactivate-note">
                    Deactivating will restore all patterns to their original FSRS-computed due dates.
                </p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface StudyPlanAppProps {
    controller?: StudyPlanController;
}

export function StudyPlanApp({ controller: initialController }: StudyPlanAppProps): VNode {
    const [controller] = useState(() => initialController || new StudyPlanController());
    const [isActive, setIsActive] = useState<boolean>(controller.settings?.isActive ?? false);
    const [settings, setSettings] = useState<StudyPlanSettings | null>(controller.settings);
    const [allCards, setAllCards] = useState<Card[]>(controller.allCards);
    const [previewDays, setPreviewDays] = useState<number>(0);
    const [previewTotal, setPreviewTotal] = useState<number>(0);
    const [previewDaily, setPreviewDaily] = useState<number>(0);
    const [showPreview, setShowPreview] = useState<boolean>(false);
    const [, setRenderTrigger] = useState(0);

    const forceUpdate = () => setRenderTrigger(c => c + 1);

    useEffect(() => {
        controller.onUpdate = () => {
            setIsActive(controller.settings?.isActive ?? false);
            setSettings(controller.settings ? { ...controller.settings } : null);
            setAllCards([...controller.allCards]);
            forceUpdate();
        };

        if (controller.allCards.length === 0 && !controller.settings) {
            controller.init();
        }
    }, [controller]);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const examDateMin = controller.formatDate(tomorrow);

    const handleDateOrLimitChange = () => {
        controller.updatePreview();
        const prevDaysEl = document.getElementById('preview-days');
        const prevTotalEl = document.getElementById('preview-total');
        const prevDailyEl = document.getElementById('preview-daily');
        const prevContainer = document.getElementById('setup-preview');

        if (prevDaysEl && prevTotalEl && prevDailyEl && prevContainer) {
            setPreviewDays(parseInt(prevDaysEl.textContent || '0', 10));
            setPreviewTotal(parseInt(prevTotalEl.textContent || '0', 10));
            setPreviewDaily(parseInt(prevDailyEl.textContent || '0', 10));
            setShowPreview(prevContainer.style.display !== 'none');
        }
    };

    const handleActivate = () => {
        controller.activateExamMode();
    };

    const handleDeactivate = () => {
        controller.deactivateExamMode();
    };

    // Calculate active metrics
    let daysLeft = 0;
    let progress = 0;
    let title = 'Exam Countdown';
    let examDateFormatted = '';
    let completedCards = 0;
    let scheduleRows: StudyPlanScheduleRow[] = [];

    if (settings && isActive) {
        const now = Date.now();
        const examTime = new Date(settings.examDate + 'T23:59:59').getTime();
        const totalDays = Math.ceil((examTime - settings.activatedAt) / (1000 * 60 * 60 * 24));
        daysLeft = Math.max(0, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
        const daysPassed = totalDays - daysLeft;
        progress = totalDays > 0 ? Math.min(daysPassed / totalDays, 1) : 0;
        title = daysLeft === 0 ? 'Exam Day!' : 'Exam Countdown';
        examDateFormatted = new Date(settings.examDate).toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        completedCards = allCards.filter(c => {
            const lastReview = getLastReviewDate(c);
            return lastReview && lastReview > settings.activatedAt;
        }).length;

        scheduleRows = controller.computeScheduleRows(totalDays);
    }

    return (
        <div className="container">
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
                    <h1>
                        <svg className="svg-icon header-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Exam Countdown Mode
                    </h1>
                    <p className="subtitle">Redistribute your reviews to guarantee full coverage before your exam date.</p>
                </div>
            </div>

            {!isActive ? (
                <StudyPlanSetupPanel
                    examDateMin={examDateMin}
                    daysLeft={previewDays}
                    totalCards={previewTotal}
                    dailyTarget={previewDaily}
                    showPreview={showPreview}
                    onExamDateChange={handleDateOrLimitChange}
                    onDailyLimitChange={handleDateOrLimitChange}
                    onActivate={handleActivate}
                />
            ) : (
                <StudyPlanActivePanel
                    totalCards={allCards.length}
                    dailyTarget={settings?.dailyTarget || 0}
                    completedCards={completedCards}
                    daysLeft={daysLeft}
                    progress={progress}
                    title={title}
                    examDateFormatted={examDateFormatted}
                    rows={scheduleRows}
                    onDeactivate={handleDeactivate}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDY PLAN CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for Exam Countdown Mode, enabling students to compress
 * and evenly redistribute their entire card inventory ahead of an interview or exam.
 */
export class StudyPlanController {
    /** Complete in-memory card collection loaded from extension storage. */
    allCards: Card[];
    /** Active exam plan settings, or null if exam mode is inactive. */
    settings: StudyPlanSettings | null;
    /** State change observer callback. */
    onUpdate?: () => void;

    /**
     * Initializes the controller with empty cards array and null settings.
     */
    constructor() {
        this.allCards = [];
        this.settings = null;
    }

    /**
     * Bootstraps study plan UI by registering event listeners and loading cards
     * and plan settings from local storage.
     * @listens chrome.storage.local
     */
    init(): void {
        try {
            this.bindEvents();

            chrome.storage.local.get(['fsrsCards', 'studyPlanSettings'], (result: StorageData & { studyPlanSettings?: StudyPlanSettings }) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('StudyPlan', `Storage error fetching cards/settings: ${errorMessage}`, { error: lastError });
                        return;
                    }

                    this.allCards = result.fsrsCards || [];
                    this.settings = result.studyPlanSettings || null;

                    if (this.settings && this.settings.isActive) {
                        this.renderActivePanel();
                    } else {
                        this.renderSetupPanel();
                    }

                    if (this.onUpdate) this.onUpdate();
                } catch (innerErr) {
                    UIUtils.catchError('StudyPlan', 'Error initializing study plan UI from storage', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('StudyPlan', 'Error initiating storage get for StudyPlanController', err);
        }
    }

    /**
     * Binds input change and click listeners for the exam configuration form and activation buttons.
     */
    bindEvents(): void {
        try {
            const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement | null;
            const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement | null;
            const activateBtn = document.getElementById('activate-btn') as HTMLButtonElement | null;
            const deactivateBtn = document.getElementById('deactivate-btn') as HTMLButtonElement | null;

            if (examDateInput) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                examDateInput.min = this.formatDate(tomorrow);

                const handleDateUpdate = () => {
                    try {
                        this.updatePreview();
                    } catch (err) {
                        UIUtils.catchError('StudyPlan', 'Error in exam date input listener', err);
                    }
                };

                examDateInput.addEventListener('change', handleDateUpdate);
                examDateInput.addEventListener('input', handleDateUpdate);
            }

            if (dailyLimitInput) {
                dailyLimitInput.addEventListener('input', () => {
                    try {
                        this.updatePreview();
                    } catch (err) {
                        UIUtils.catchError('StudyPlan', 'Error in daily limit input listener', err);
                    }
                });
            }

            if (activateBtn) {
                activateBtn.addEventListener('click', () => {
                    try {
                        this.activateExamMode();
                    } catch (err) {
                        UIUtils.catchError('StudyPlan', 'Error in activate button listener', err);
                    }
                });
            }

            if (deactivateBtn) {
                deactivateBtn.addEventListener('click', () => {
                    try {
                        this.deactivateExamMode();
                    } catch (err) {
                        UIUtils.catchError('StudyPlan', 'Error in deactivate button listener', err);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('StudyPlan', 'Error binding study plan events', err);
        }
    }

    /**
     * Formats a Date object into an ISO date string (`YYYY-MM-DD`) in local time.
     * @param date - Date to convert.
     * @returns Formatted ISO date string.
     */
    formatDate(date: Date): string {
        try {
            return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error formatting date: ${errorMessage}`, { date, err });
            return new Date().toISOString().split('T')[0];
        }
    }

    /**
     * Updates the setup preview with calculated stats based on selected date.
     */
    updatePreview(): void {
        try {
            const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement | null;
            const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement | null;
            const preview = document.getElementById('setup-preview');
            const activateBtn = document.getElementById('activate-btn') as HTMLButtonElement | null;

            if (!examDateInput || !examDateInput.value || !preview) return;

            const examDate = new Date(examDateInput.value + 'T23:59:59');
            const now = new Date();
            const daysLeft = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysLeft <= 0) {
                preview.style.display = 'none';
                if (activateBtn) activateBtn.disabled = true;
                return;
            }

            const totalCards = this.allCards.length;
            const limitVal = parseInt(dailyLimitInput?.value || '', 10);

            let dailyTarget = Math.ceil(totalCards / daysLeft);
            let willFinish = true;

            if (!isNaN(limitVal) && limitVal > 0 && limitVal < dailyTarget) {
                dailyTarget = limitVal;
                willFinish = false;
            }

            const prevDaysEl = document.getElementById('preview-days');
            const prevTotalEl = document.getElementById('preview-total');
            const prevDailyEl = document.getElementById('preview-daily');

            if (prevDaysEl) prevDaysEl.textContent = String(daysLeft);
            if (prevTotalEl) prevTotalEl.textContent = String(willFinish ? totalCards : (dailyTarget * daysLeft));
            if (prevDailyEl) prevDailyEl.textContent = String(dailyTarget);

            preview.style.display = 'block';
            if (activateBtn) activateBtn.disabled = false;
        } catch (err) {
            UIUtils.catchError('StudyPlan', 'Error updating setup preview', err);
        }
    }

    /**
     * Activates exam mode: backs up original due dates, redistributes cards evenly.
     */
    activateExamMode(): void {
        try {
            const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement | null;
            const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement | null;

            if (!examDateInput || !examDateInput.value) return;

            const examDate = examDateInput.value;
            const examTime = new Date(examDate + 'T23:59:59').getTime();
            const now = Date.now();
            const daysLeft = Math.max(1, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
            const limitVal = parseInt(dailyLimitInput?.value || '', 10);
            let cardsPerDay = Math.ceil(this.allCards.length / daysLeft);

            if (!isNaN(limitVal) && limitVal > 0 && limitVal < cardsPerDay) {
                cardsPerDay = limitVal;
            }

            // Backup original due dates
            this.allCards.forEach((card: Card & { originalDue?: number }) => {
                if (!card.originalDue) {
                    card.originalDue = card.due;
                }
            });

            // Sort cards by priority: overdue first, then by stability (lowest first), then difficulty (highest first)
            const sortedCards = [...this.allCards].sort((a, b) => {
                const aOverdue = a.due <= now ? 1 : 0;
                const bOverdue = b.due <= now ? 1 : 0;
                if (aOverdue !== bOverdue) return bOverdue - aOverdue;
                if ((a.stability || 0) !== (b.stability || 0)) return (a.stability || 0) - (b.stability || 0);
                return (b.difficulty || 0) - (a.difficulty || 0);
            });

            // Distribute cards across days
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            sortedCards.forEach((card, index) => {
                const dayOffset = Math.floor(index / cardsPerDay);

                if (dayOffset >= daysLeft) return;

                const dueDate = new Date(startOfToday);
                dueDate.setDate(dueDate.getDate() + dayOffset);
                dueDate.setHours(9, 0, 0, 0);

                const originalCard = this.allCards.find(c => c.id === card.id);
                if (originalCard) {
                    originalCard.due = dueDate.getTime();
                }
            });

            const settings: StudyPlanSettings = {
                isActive: true,
                examDate: examDate,
                dailyTarget: cardsPerDay,
                activatedAt: now
            };

            chrome.storage.local.set({
                fsrsCards: this.allCards,
                studyPlanSettings: settings
            }, () => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('StudyPlan', `Storage error saving active exam mode settings: ${errorMessage}`, { error: lastError });
                        return;
                    }
                    this.settings = settings;
                    this.renderActivePanel();
                    if (this.onUpdate) this.onUpdate();
                } catch (cbErr) {
                    UIUtils.catchError('StudyPlan', 'Error in storage set callback for activateExamMode', cbErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('StudyPlan', 'Error activating exam mode', err);
        }
    }

    /**
     * Deactivates exam mode: restores original due dates from backup.
     */
    deactivateExamMode(): void {
        try {
            if (!confirm('Deactivate Exam Mode? This will restore all cards to their original FSRS-computed due dates.')) return;

            const activatedAt = this.settings?.activatedAt || 0;
            this.allCards.forEach((card: Card & { originalDue?: number; lastReview?: number }) => {
                if (card.originalDue) {
                    const lastReviewTime = typeof card.lastReview === 'number' ? card.lastReview : (typeof card.last_review === 'number' ? card.last_review : 0);
                    const wasReviewedDuringExam = !!(lastReviewTime && activatedAt > 0 && lastReviewTime >= activatedAt);
                    if (!wasReviewedDuringExam) {
                        card.due = card.originalDue;
                    }
                    delete card.originalDue;
                }
            });

            chrome.storage.local.set({
                fsrsCards: this.allCards,
                studyPlanSettings: null
            }, () => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('StudyPlan', `Storage error deactivating exam mode settings: ${errorMessage}`, { error: lastError });
                        return;
                    }
                    this.settings = null;
                    this.renderSetupPanel();
                    if (this.onUpdate) this.onUpdate();
                } catch (cbErr) {
                    UIUtils.catchError('StudyPlan', 'Error in storage set callback for deactivateExamMode', cbErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('StudyPlan', 'Error deactivating exam mode', err);
        }
    }

    /**
     * Shows the setup panel and hides the active panel.
     */
    renderSetupPanel(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<StudyPlanApp controller={this} />, root);
                return;
            }

            const setupPanel = document.getElementById('setup-panel');
            const activePanel = document.getElementById('active-panel');
            if (setupPanel) setupPanel.style.display = 'block';
            if (activePanel) activePanel.style.display = 'none';

            this.updatePreview();
        } catch (err) {
            UIUtils.catchError('StudyPlan', 'Error rendering setup panel', err);
        }
    }

    /**
     * Shows the active countdown panel with ring, stats, and daily schedule.
     */
    renderActivePanel(): void {
        try {
            if (!this.settings) return;

            const root = document.getElementById('root');
            if (root) {
                render(<StudyPlanApp controller={this} />, root);
                return;
            }

            const setupPanel = document.getElementById('setup-panel');
            const activePanel = document.getElementById('active-panel');
            if (setupPanel) setupPanel.style.display = 'none';
            if (activePanel) activePanel.style.display = 'block';

            const now = Date.now();
            const examTime = new Date(this.settings.examDate + 'T23:59:59').getTime();
            const totalDays = Math.ceil((examTime - this.settings.activatedAt) / (1000 * 60 * 60 * 24));
            const daysLeft = Math.max(0, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
            const daysPassed = totalDays - daysLeft;
            const progress = totalDays > 0 ? Math.min(daysPassed / totalDays, 1) : 0;

            const circumference = 2 * Math.PI * 52;
            const ringFill = document.getElementById('countdown-ring-fill');
            if (ringFill) {
                ringFill.setAttribute('stroke-dasharray', String(circumference));
                ringFill.setAttribute('stroke-dashoffset', String(circumference - (progress * circumference)));

                if (daysLeft <= 3) ringFill.classList.add('urgent');
                else if (daysLeft <= 7) ringFill.classList.add('warning');
            }

            const countDaysEl = document.getElementById('countdown-days');
            const countTitleEl = document.getElementById('countdown-title');
            const countExamDateEl = document.getElementById('countdown-exam-date');

            if (countDaysEl) countDaysEl.textContent = String(daysLeft);
            if (countTitleEl) countTitleEl.textContent = daysLeft === 0 ? 'Exam Day!' : 'Exam Countdown';
            if (countExamDateEl) {
                countExamDateEl.textContent = new Date(this.settings.examDate).toLocaleDateString(undefined, {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
            }

            const activatedAt = this.settings.activatedAt;
            const completedCards = this.allCards.filter(c => {
                const lastReview = getLastReviewDate(c);
                return lastReview && lastReview > activatedAt;
            }).length;

            const actTotalEl = document.getElementById('active-total-cards');
            const actDailyEl = document.getElementById('active-daily-target');
            const actCompEl = document.getElementById('active-completed');

            if (actTotalEl) actTotalEl.textContent = String(this.allCards.length);
            if (actDailyEl) actDailyEl.textContent = String(this.settings.dailyTarget);
            if (actCompEl) actCompEl.textContent = String(completedCards);

            this.renderScheduleTable(totalDays, daysLeft);
        } catch (err) {
            UIUtils.catchError('StudyPlan', 'Error rendering active panel', err);
        }
    }

    /**
     * Computes schedule row data objects for the daily review schedule table.
     */
    computeScheduleRows(totalDays: number): StudyPlanScheduleRow[] {
        if (!this.settings) return [];
        const rows: StudyPlanScheduleRow[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        const daysToShow = Math.min(totalDays, 30);

        for (let i = 0; i < daysToShow; i++) {
            const dayDate = new Date(this.settings.activatedAt);
            dayDate.setHours(0, 0, 0, 0);
            dayDate.setDate(dayDate.getDate() + i);

            const dayStart = dayDate.getTime();
            const nextDay = new Date(dayDate);
            nextDay.setDate(nextDay.getDate() + 1);
            const dayEnd = nextDay.getTime();

            const cardsForDay = this.allCards.filter(c => c.due >= dayStart && c.due < dayEnd).length;
            const isToday = dayDate.getTime() === todayTime;
            const isPast = dayDate.getTime() < todayTime;
            const status: 'Done' | 'Today' | 'Upcoming' = isPast ? 'Done' : (isToday ? 'Today' : 'Upcoming');

            rows.push({
                dayIndex: i + 1,
                dateFormatted: dayDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
                cardsCount: cardsForDay,
                status,
                isToday,
                isPast
            });
        }
        return rows;
    }

    /**
     * Renders the daily review schedule breakdown table.
     */
    renderScheduleTable(totalDays: number, daysLeft: number): void {
        try {
            if (!this.settings) return;
            const tbody = document.getElementById('schedule-body');
            if (!tbody) return;

            const rows = this.computeScheduleRows(totalDays);
            render(
                <Fragment>
                    {rows.map(row => (
                        <tr
                            key={row.dayIndex}
                            className={row.isToday ? 'today-row' : (row.isPast ? 'past-row' : '')}
                        >
                            <td>Day {row.dayIndex}</td>
                            <td>{row.dateFormatted}</td>
                            <td>{row.cardsCount}</td>
                            <td>
                                <span
                                    className={`badge badge-${
                                        row.status === 'Done' ? 'complete' : (row.status === 'Today' ? 'today' : 'upcoming')
                                    }`}
                                >
                                    {row.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </Fragment>,
                tbody
            );
        } catch (err) {
            UIUtils.catchError('StudyPlan', 'Error rendering schedule table', err, { totalDays, daysLeft });
        }
    }
}

/**
 * Initializes the study plan controller on DOM load.
 */
export function initStudyPlan(): void {
    try {
        const root = document.getElementById('root');
        const controller = new StudyPlanController();
        if (root) {
            render(<StudyPlanApp controller={controller} />, root);
        } else {
            controller.init();
        }
    } catch (err) {
        UIUtils.catchError('StudyPlan', 'Initialization failed', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStudyPlan);
    } else {
        initStudyPlan();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).StudyPlanController = StudyPlanController;
    (module.exports as any).StudyPlanSetupPanel = StudyPlanSetupPanel;
    (module.exports as any).StudyPlanCountdownRing = StudyPlanCountdownRing;
    (module.exports as any).StudyPlanActivePanel = StudyPlanActivePanel;
    (module.exports as any).StudyPlanScheduleTable = StudyPlanScheduleTable;
    (module.exports as any).StudyPlanApp = StudyPlanApp;
    (module.exports as any).initStudyPlan = initStudyPlan;
}
