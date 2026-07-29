/**
 * @file features/dashboard/studyplan/studyplan.ts
 * @description Exam Countdown Mode controller.
 * Redistributes all FSRS cards evenly across remaining days until exam,
 * prioritizing overdue and low-stability cards. Backs up original due dates
 * for restoration on deactivation.
 */

import { Logger } from '@common/logger';
import { getLastReviewDate } from '../../common/utils/cardUtils';
import { Card, StorageData } from '../../../types/domain';

export interface StudyPlanSettings {
    isActive: boolean;
    examDate: string;
    dailyTarget: number;
    activatedAt: number;
}

export class StudyPlanController {
    allCards: Card[];
    settings: StudyPlanSettings | null;

    constructor() {
        this.allCards = [];
        this.settings = null;
    }

    init(): void {
        try {
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

                    this.bindEvents();
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('StudyPlan', `Error initializing study plan UI from storage: ${errorMessage}`, { innerErr });
                    // Comment: Non-fatal study plan initialization catch
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error initiating storage get for StudyPlanController: ${errorMessage}`, { err });
        }
    }

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

                examDateInput.addEventListener('change', () => {
                    try {
                        this.updatePreview();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('StudyPlan', `Error in exam date input listener: ${errorMessage}`, { err });
                    }
                });
            }

            if (dailyLimitInput) {
                dailyLimitInput.addEventListener('input', () => {
                    try {
                        this.updatePreview();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('StudyPlan', `Error in daily limit input listener: ${errorMessage}`, { err });
                    }
                });
            }

            if (activateBtn) {
                activateBtn.addEventListener('click', () => {
                    try {
                        this.activateExamMode();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('StudyPlan', `Error in activate button listener: ${errorMessage}`, { err });
                    }
                });
            }

            if (deactivateBtn) {
                deactivateBtn.addEventListener('click', () => {
                    try {
                        this.deactivateExamMode();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('StudyPlan', `Error in deactivate button listener: ${errorMessage}`, { err });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error binding study plan events: ${errorMessage}`, { err });
            // Comment: Non-fatal event binding catch
        }
    }

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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error updating setup preview: ${errorMessage}`, { err });
            // Comment: Non-fatal preview rendering catch
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
                } catch (cbErr) {
                    const errorMessage = cbErr instanceof Error ? cbErr.message : String(cbErr);
                    Logger.error('StudyPlan', `Error in storage set callback for activateExamMode: ${errorMessage}`, { cbErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error activating exam mode: ${errorMessage}`, { err });
            // Comment: Non-fatal exam mode activation error
        }
    }

    /**
     * Deactivates exam mode: restores original due dates from backup.
     */
    deactivateExamMode(): void {
        try {
            if (!confirm('Deactivate Exam Mode? This will restore all cards to their original FSRS-computed due dates.')) return;

            this.allCards.forEach((card: Card & { originalDue?: number }) => {
                if (card.originalDue) {
                    card.due = card.originalDue;
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
                } catch (cbErr) {
                    const errorMessage = cbErr instanceof Error ? cbErr.message : String(cbErr);
                    Logger.error('StudyPlan', `Error in storage set callback for deactivateExamMode: ${errorMessage}`, { cbErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error deactivating exam mode: ${errorMessage}`, { err });
            // Comment: Non-fatal exam mode deactivation error
        }
    }

    /**
     * Shows the setup panel and hides the active panel.
     */
    renderSetupPanel(): void {
        try {
            const setupPanel = document.getElementById('setup-panel');
            const activePanel = document.getElementById('active-panel');
            if (setupPanel) setupPanel.style.display = 'block';
            if (activePanel) activePanel.style.display = 'none';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error rendering setup panel: ${errorMessage}`, { err });
        }
    }

    /**
     * Shows the active countdown panel with ring, stats, and daily schedule.
     */
    renderActivePanel(): void {
        try {
            if (!this.settings) return;
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error rendering active panel: ${errorMessage}`, { err });
            // Comment: Non-fatal active panel rendering error
        }
    }

    /**
     * Renders the daily review schedule breakdown table.
     */
    renderScheduleTable(totalDays: number, daysLeft: number): void {
        try {
            if (!this.settings) return;
            const tbody = document.getElementById('schedule-body');
            if (!tbody) return;
            tbody.innerHTML = '';

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

                let statusBadge = '';
                if (isPast) {
                    statusBadge = '<span class="badge badge-complete">Done</span>';
                } else if (isToday) {
                    statusBadge = '<span class="badge badge-today">Today</span>';
                } else {
                    statusBadge = '<span class="badge badge-upcoming">Upcoming</span>';
                }

                const rowClass = isToday ? 'today-row' : (isPast ? 'past-row' : '');

                const tr = document.createElement('tr');
                tr.className = rowClass;
                tr.innerHTML = `
                    <td>Day ${i + 1}</td>
                    <td>${dayDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    <td>${cardsForDay}</td>
                    <td>${statusBadge}</td>
                `;
                tbody.appendChild(tr);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StudyPlan', `Error rendering schedule table: ${errorMessage}`, { totalDays, daysLeft, err });
            // Comment: Non-fatal schedule table rendering error
        }
    }
}

function initStudyPlan(): void {
    try {
        const controller = new StudyPlanController();
        controller.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('StudyPlan', `Initialization failed: ${errorMessage}`, { err });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStudyPlan);
    } else {
        initStudyPlan();
    }
}
