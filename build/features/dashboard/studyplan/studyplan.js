/**
 * @file features/dashboard/studyplan/studyplan.js
 * @description Exam Countdown Mode controller.
 * Redistributes all FSRS cards evenly across remaining days until exam,
 * prioritizing overdue and low-stability cards. Backs up original due dates
 * for restoration on deactivation.
 */
class StudyPlanController {
    constructor() {
        this.allCards = [];
        this.settings = null;
    }

    init() {
        chrome.storage.local.get(['fsrsCards', 'studyPlanSettings'], (result) => {
            this.allCards = result.fsrsCards || [];
            this.settings = result.studyPlanSettings || null;

            if (this.settings && this.settings.isActive) {
                this.renderActivePanel();
            } else {
                this.renderSetupPanel();
            }

            this.bindEvents();
        });
    }

    bindEvents() {
        const examDateInput = document.getElementById('exam-date-input');
        const dailyLimitInput = document.getElementById('daily-limit-input');
        const activateBtn = document.getElementById('activate-btn');
        const deactivateBtn = document.getElementById('deactivate-btn');

        // Set minimum date to tomorrow
        if (examDateInput) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            examDateInput.min = this.formatDate(tomorrow);

            examDateInput.addEventListener('change', () => {
                this.updatePreview();
            });
        }

        if (dailyLimitInput) {
            dailyLimitInput.addEventListener('input', () => {
                this.updatePreview();
            });
        }

        if (activateBtn) {
            activateBtn.addEventListener('click', () => this.activateExamMode());
        }

        if (deactivateBtn) {
            deactivateBtn.addEventListener('click', () => this.deactivateExamMode());
        }
    }

    formatDate(date) {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    /**
     * Updates the setup preview with calculated stats based on selected date.
     */
    updatePreview() {
        const examDateInput = document.getElementById('exam-date-input');
        const dailyLimitInput = document.getElementById('daily-limit-input');
        const preview = document.getElementById('setup-preview');
        const activateBtn = document.getElementById('activate-btn');

        if (!examDateInput || !examDateInput.value || !preview) return;

        const examDate = new Date(examDateInput.value + 'T23:59:59');
        const now = new Date();
        const daysLeft = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) {
            preview.style.display = 'none';
            if (activateBtn) activateBtn.disabled = true;
            return;
        }

        const totalCards = this.allCards.length;
        const maxDaily = parseInt(dailyLimitInput?.value) || 30;
        const dailyTarget = Math.min(Math.ceil(totalCards / daysLeft), maxDaily);

        document.getElementById('preview-days').textContent = daysLeft;
        document.getElementById('preview-total').textContent = totalCards;
        document.getElementById('preview-daily').textContent = dailyTarget;

        preview.style.display = 'block';
        if (activateBtn) activateBtn.disabled = false;
    }

    /**
     * Activates exam mode: backs up original due dates, redistributes cards evenly.
     */
    activateExamMode() {
        const examDateInput = document.getElementById('exam-date-input');
        const dailyLimitInput = document.getElementById('daily-limit-input');

        if (!examDateInput || !examDateInput.value) return;

        const examDate = examDateInput.value;
        const examTime = new Date(examDate + 'T23:59:59').getTime();
        const now = Date.now();
        const daysLeft = Math.max(1, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
        const maxDaily = parseInt(dailyLimitInput?.value) || 30;

        // Backup original due dates
        this.allCards.forEach(card => {
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
            const dayOffset = Math.floor(index / maxDaily);
            const clampedDay = Math.min(dayOffset, daysLeft - 1);
            
            const dueDate = new Date(startOfToday);
            dueDate.setDate(dueDate.getDate() + clampedDay);
            // Set time to 9:00 AM for a reasonable study start
            dueDate.setHours(9, 0, 0, 0);

            // Find the original card and update its due date
            const originalCard = this.allCards.find(c => c.id === card.id);
            if (originalCard) {
                originalCard.due = dueDate.getTime();
            }
        });

        // Save settings and updated cards
        const settings = {
            isActive: true,
            examDate: examDate,
            dailyTarget: Math.min(Math.ceil(this.allCards.length / daysLeft), maxDaily),
            activatedAt: now
        };

        chrome.storage.local.set({ 
            fsrsCards: this.allCards, 
            studyPlanSettings: settings 
        }, () => {
            this.settings = settings;
            this.renderActivePanel();
        });
    }

    /**
     * Deactivates exam mode: restores original due dates from backup.
     */
    deactivateExamMode() {
        if (!confirm('Deactivate Exam Mode? This will restore all cards to their original FSRS-computed due dates.')) return;

        // Restore original due dates
        this.allCards.forEach(card => {
            if (card.originalDue) {
                card.due = card.originalDue;
                delete card.originalDue;
            }
        });

        chrome.storage.local.set({
            fsrsCards: this.allCards,
            studyPlanSettings: null
        }, () => {
            this.settings = null;
            this.renderSetupPanel();
        });
    }

    /**
     * Shows the setup panel and hides the active panel.
     */
    renderSetupPanel() {
        document.getElementById('setup-panel').style.display = 'block';
        document.getElementById('active-panel').style.display = 'none';
    }

    /**
     * Shows the active countdown panel with ring, stats, and daily schedule.
     */
    renderActivePanel() {
        document.getElementById('setup-panel').style.display = 'none';
        document.getElementById('active-panel').style.display = 'block';

        const now = Date.now();
        const examTime = new Date(this.settings.examDate + 'T23:59:59').getTime();
        const totalDays = Math.ceil((examTime - this.settings.activatedAt) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
        const daysPassed = totalDays - daysLeft;
        const progress = totalDays > 0 ? Math.min(daysPassed / totalDays, 1) : 0;

        // Countdown ring
        const circumference = 2 * Math.PI * 52;
        const ringFill = document.getElementById('countdown-ring-fill');
        if (ringFill) {
            ringFill.setAttribute('stroke-dasharray', circumference);
            ringFill.setAttribute('stroke-dashoffset', circumference - (progress * circumference));
            
            // Urgency colors
            if (daysLeft <= 3) ringFill.classList.add('urgent');
            else if (daysLeft <= 7) ringFill.classList.add('warning');
        }

        document.getElementById('countdown-days').textContent = daysLeft;
        document.getElementById('countdown-title').textContent = daysLeft === 0 ? 'Exam Day!' : 'Exam Countdown';
        document.getElementById('countdown-exam-date').textContent = new Date(this.settings.examDate).toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // Stats
        const completedCards = this.allCards.filter(c => {
            const lastReview = c.historyLog && c.historyLog.length > 0 ? c.historyLog[c.historyLog.length - 1] : 0;
            return lastReview > this.settings.activatedAt;
        }).length;

        document.getElementById('active-total-cards').textContent = this.allCards.length;
        document.getElementById('active-daily-target').textContent = this.settings.dailyTarget;
        document.getElementById('active-completed').textContent = completedCards;

        // Daily Schedule Table
        this.renderScheduleTable(totalDays, daysLeft);
    }

    /**
     * Renders the daily review schedule breakdown table.
     */
    renderScheduleTable(totalDays, daysLeft) {
        const tbody = document.getElementById('schedule-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        // Show up to 30 days of the schedule
        const daysToShow = Math.min(totalDays, 30);

        for (let i = 0; i < daysToShow; i++) {
            const dayDate = new Date(this.settings.activatedAt);
            dayDate.setHours(0, 0, 0, 0);
            dayDate.setDate(dayDate.getDate() + i);
            
            const dayStart = dayDate.getTime();
            const dayEnd = dayStart + 24 * 60 * 60 * 1000;

            const cardsForDay = this.allCards.filter(c => c.due >= dayStart && c.due < dayEnd).length;
            
            const isToday = dayDate.getTime() === todayTime;
            const isPast = dayDate.getTime() < todayTime;

            // Determine status
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
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new StudyPlanController();
    controller.init();
});
