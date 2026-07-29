/**
 * @file features/dashboard/popup/stats.ts
 * @description Manages progress tracking, daily goals, gamification elements, and streaking metrics inside the options popup.
 */

import { Logger } from '@common/logger';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { getLastReviewDate } from '../../common/utils/cardUtils';
import { Card, StorageData } from '../../../types/domain';
import AbstractScheduler from '../../tracker/scheduler/scheduler';

export interface StreakResult {
    current: number;
    longest: number;
}

interface ConfettiParticle {
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
    shape: 'rect' | 'circle';
}

export class StatsComponent extends DashboardComponent {
    dailyGoalTarget: number;
    longestStreak: number;

    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
        this.dailyGoalTarget = 10;
        this.longestStreak = 0;
    }

    /**
     * Loads FSRS card data and activity logs, computes overall stats,
     * and renders both the level progression badge and the daily goal progress ring.
     */
    async load(): Promise<void> {
        try {
            const result = (await chrome.storage.local.get(['fsrsCards', 'fsrsActivity', 'dailyGoalTarget', 'longestStreak', 'lastCelebratedMilestone', 'studyPlanSettings'])) as StorageData & {
                lastCelebratedMilestone?: number;
                studyPlanSettings?: { isActive?: boolean; examDate?: string };
            };
            const cards: Card[] = result.fsrsCards || [];
            const activity: Record<string, number> = result.fsrsActivity || {};
            this.dailyGoalTarget = typeof result.dailyGoalTarget === 'number' ? result.dailyGoalTarget : 10;
            const storedLongestStreak = typeof result.longestStreak === 'number' ? result.longestStreak : 0;
            const lastCelebratedMilestone = typeof result.lastCelebratedMilestone === 'number' ? result.lastCelebratedMilestone : 0;
            const studyPlanSettings = result.studyPlanSettings || null;
            const now = new Date().getTime();
            
            // DOM targets
            const totalEl = document.getElementById('total-cards');
            const dueEl = document.getElementById('due-cards');
            const retentionEl = document.getElementById('retention-rate');

            // Filter cards scheduled for today or earlier
            const dueToday = cards.filter((c: Card) => c.due <= now).length;

            if (totalEl) totalEl.innerText = String(cards.length);
            if (dueEl) dueEl.innerText = String(dueToday);
            
            // Calculate memory retention rate: True FSRS Retrievability
            let totalRetrievability = 0;
            let retrievabilityCount = 0;
            const SchedulerClass = (window as unknown as { FsrsScheduler?: new () => AbstractScheduler }).FsrsScheduler;
            const scheduler = typeof SchedulerClass === 'function' ? new SchedulerClass() : null;
            const currentTime = Date.now();
            
            let totalActivityReviews = 0; // Pre-calc for later
            let totalReps = 0;
            let totalLapses = 0;
            
            cards.forEach((card: Card) => {
                totalReps += card.reps || 0;
                totalLapses += card.lapses || 0;
                
                if (card.stability > 0 && scheduler) {
                    const lastReview = getLastReviewDate(card);
                    if (lastReview) {
                        const r = scheduler.getRetrievability(card, currentTime);
                        totalRetrievability += r;
                        retrievabilityCount++;
                    }
                }
            });

            // Sum up activity
            Object.values(activity).forEach(count => {
                totalActivityReviews += count;
            });

            if (retentionEl) {
                let retentionStr = "0%";
                if (retrievabilityCount > 0) {
                    const trueRetention = (totalRetrievability / retrievabilityCount) * 100;
                    retentionStr = Math.round(trueRetention) + "%";
                } else if (totalReps > 0) {
                    // Fallback to historic if no FSRS data
                    const rate = ((totalReps - totalLapses) / totalReps) * 100;
                    retentionStr = Math.round(rate) + "%";
                }
                retentionEl.innerText = retentionStr;
            }

            // 1. Level & XP Progression Logic
            const level = Math.floor(1 + 0.6 * Math.sqrt(totalActivityReviews));
            
            const currentLevelReviews = Math.pow((level - 1) / 0.6, 2);
            const nextLevelReviews = Math.pow(level / 0.6, 2);
            
            const progressRange = nextLevelReviews - currentLevelReviews;
            const progressMade = totalActivityReviews - currentLevelReviews;
            const currentLevelProgress = progressRange > 0 ? Math.max(0, Math.min(100, (progressMade / progressRange) * 100)) : 0;
            
            const levelBadge = document.getElementById('user-level-badge');
            const xpBarFill = document.getElementById('xp-bar-fill');
            
            if (levelBadge) {
                levelBadge.innerText = `Lv. ${level}`;
                let levelTitle = "Novice";
                if (level >= 35) levelTitle = "Grandmaster";
                else if (level >= 20) levelTitle = "Expert";
                else if (level >= 10) levelTitle = "Specialist";
                else if (level >= 5) levelTitle = "Apprentice";
                
                const reviewsToNext = Math.ceil(nextLevelReviews - totalActivityReviews);
                levelBadge.title = `${levelTitle} (${totalActivityReviews} Total Reviews) - ${reviewsToNext} until Lv. ${level + 1}`;
            }
            if (xpBarFill) {
                xpBarFill.style.width = `${currentLevelProgress}%`;
            }

            // 2. Daily Streak Calculation
            const streakData = this.calculateStreaks(activity);
            this.longestStreak = Math.max(streakData.longest, storedLongestStreak);
            
            if (this.longestStreak > storedLongestStreak) {
                await chrome.storage.local.set({ longestStreak: this.longestStreak });
            }

            // 3. Daily Goals Progress Summary
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            const todayEndTime = todayEnd.getTime();
            
            let completedToday = 0;
            cards.forEach((card: Card) => {
                const lastReview = getLastReviewDate(card);
                
                const isReviewedToday = lastReview ? new Date(lastReview).toDateString() === new Date().toDateString() : false;
                const wasDueTodayOrEarlier = !card.previousDue || card.previousDue <= todayEndTime;
                
                if (isReviewedToday && wasDueTodayOrEarlier) {
                    completedToday++;
                }
            });
            
            const gamificationPanel = document.getElementById('gamification-panel');
            if (gamificationPanel) {
                if (cards.length === 0) {
                    gamificationPanel.innerHTML = `
                        <div class="achievement-state">
                            <div class="achievement-title" style="color: var(--md-text-low);">
                                <svg class="svg-icon" style="stroke: var(--md-text-low); margin-right: 4px;" viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                Welcome to Spaced Repetitions!
                            </div>
                            <div class="achievement-subtitle">Highlight text or open FSRS widget on problems to save your first pattern.</div>
                        </div>
                    `;
                } else if (dueToday === 0 && completedToday >= this.dailyGoalTarget) {
                    gamificationPanel.innerHTML = this.renderGoalComplete(completedToday, this.dailyGoalTarget, streakData.current, this.longestStreak);
                } else {
                    gamificationPanel.innerHTML = this.renderGoalProgress(completedToday, this.dailyGoalTarget, dueToday, streakData.current, this.longestStreak);
                }

                if (studyPlanSettings && studyPlanSettings.isActive && studyPlanSettings.examDate) {
                    const examTime = new Date(studyPlanSettings.examDate + 'T23:59:59').getTime();
                    const daysLeft = Math.max(0, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
                    const pillClass = daysLeft <= 3 ? '' : 'safe';
                    const goalInfo = gamificationPanel.querySelector('.goal-info') || gamificationPanel;
                    const pillHtml = document.createElement('div');
                    pillHtml.className = `exam-countdown-pill ${pillClass}`;
                    pillHtml.innerHTML = `
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        ${daysLeft === 0 ? 'Exam is today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until exam`}
                    `;
                    goalInfo.appendChild(pillHtml);
                }

                this.bindEditorEvents(gamificationPanel);
            }

            // Milestone Detection & Celebration
            const streakMilestones = [7, 14, 30, 50, 100, 365];
            const reviewMilestones = [50, 100, 250, 500, 1000, 5000];

            let newMilestone: { type: string; value: number } | null = null;
            for (const milestone of streakMilestones) {
                if (streakData.current >= milestone && lastCelebratedMilestone < milestone) {
                    newMilestone = { type: 'streak', value: milestone };
                }
            }

            if (!newMilestone) {
                for (const milestone of reviewMilestones) {
                    if (totalActivityReviews >= milestone && lastCelebratedMilestone < milestone) {
                        newMilestone = { type: 'reviews', value: milestone };
                    }
                }
            }

            if (newMilestone) {
                const milestoneKey = newMilestone.value;
                await chrome.storage.local.set({ lastCelebratedMilestone: milestoneKey });

                setTimeout(() => {
                    try {
                        const label = newMilestone!.type === 'streak'
                            ? `🔥 ${milestoneKey}-Day Streak!`
                            : `⭐ ${milestoneKey} Reviews!`;
                        this.showMilestoneToast(label);
                        this.showConfetti();
                    } catch (mErr) {
                        const errorMessage = mErr instanceof Error ? mErr.message : String(mErr);
                        Logger.error('StatsComponent', `Error in milestone celebration callback: ${errorMessage}`, { mErr });
                    }
                }, 300);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.error('StatsComponent', `Error loading stats: ${errorMessage}`, { error });
            // Comment: Non-fatal stats load catch
        }
    }

    /**
     * Binds event listeners for daily goal input adjustments inside the gamification container.
     */
    bindEditorEvents(gamificationPanel: HTMLElement): void {
        try {
            const goalEditBtn = gamificationPanel.querySelector('#goal-edit-btn');
            const goalEditor = gamificationPanel.querySelector('#goal-editor') as HTMLElement | null;
            const goalInput = gamificationPanel.querySelector('#goal-input') as HTMLInputElement | null;
            const goalSaveBtn = gamificationPanel.querySelector('#goal-save-btn');

            if (goalEditBtn && goalEditor && goalInput) {
                goalEditBtn.addEventListener('click', () => {
                    try {
                        goalEditor.style.display = goalEditor.style.display === 'none' ? 'flex' : 'none';
                        if (goalEditor.style.display === 'flex') goalInput.focus();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('StatsComponent', `Error toggling goal editor visibility: ${errorMessage}`, { err });
                    }
                });

                const saveGoal = async () => {
                    const val = parseInt(goalInput.value, 10);
                    if (val && val > 0 && val <= 999) {
                        try {
                            await chrome.storage.local.set({ dailyGoalTarget: val });
                            goalEditor.style.display = 'none';
                            await this.load();
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            Logger.error('StatsComponent', `Error saving daily goal target: ${errorMessage}`, { val, error });
                        }
                    }
                };

                if (goalSaveBtn) {
                    goalSaveBtn.addEventListener('click', () => {
                        saveGoal().catch(err => {
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            Logger.error('StatsComponent', `Error in saveGoal callback on click: ${errorMessage}`, { err });
                        });
                    });
                }
                goalInput.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        saveGoal().catch(err => {
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            Logger.error('StatsComponent', `Error in saveGoal callback on keydown: ${errorMessage}`, { err });
                        });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error binding goal editor events: ${errorMessage}`, { err });
            // Comment: Non-fatal goal editor event binding catch
        }
    }

    /**
     * Binds event listeners for interactive stats elements.
     */
    bindEvents(): void {
        try {
            // Events are bound during load or UI interactions
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error binding stats events: ${errorMessage}`, { err });
        }
    }

    /**
     * Calculates current and longest streaks based on calendar days reviewed.
     */
    calculateStreaks(activity: { [key: string]: number }): StreakResult {
        try {
            const sortedDates = Object.keys(activity).filter(k => activity[k] > 0).sort();
            if (sortedDates.length === 0) return { current: 0, longest: 0 };

            let currentStreak = 0;
            const today = new Date();
            const checkDate = new Date(today);
            
            for (let i = 0; i < 365; i++) {
                const dateStr = this.formatDateKey(checkDate);
                if (activity[dateStr] && activity[dateStr] > 0) {
                    currentStreak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    if (i === 0) {
                        checkDate.setDate(checkDate.getDate() - 1);
                        continue;
                    }
                    break;
                }
            }

            let longestStreak = 0;
            let tempStreak = 0;
            let prevDate: Date | null = null;

            for (const dateStr of sortedDates) {
                const parts = dateStr.split('-');
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

                if (prevDate) {
                    const diffDays = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) {
                        tempStreak++;
                    } else {
                        tempStreak = 1;
                    }
                } else {
                    tempStreak = 1;
                }

                if (tempStreak > longestStreak) longestStreak = tempStreak;
                prevDate = d;
            }

            return { current: currentStreak, longest: longestStreak };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error calculating streaks: ${errorMessage}`, { err });
            return { current: 0, longest: 0 };
        }
    }

    /**
     * Generates local timezone date key string (YYYY-MM-DD).
     */
    formatDateKey(date: Date): string {
        try {
            return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error formatting date key: ${errorMessage}`, { date, err });
            return new Date().toISOString().split('T')[0];
        }
    }

    /**
     * Renders the goal progress template including the SVG progress ring circle indicator.
     */
    renderGoalProgress(completed: number, target: number, dueRemaining: number, currentStreak: number, longestStreak: number): string {
        try {
            const pct = Math.min(Math.round((completed / target) * 100), 100);
            const circumference = 2 * Math.PI * 42;
            const offset = circumference - (pct / 100) * circumference;

            const streakHtml = this.renderStreakBadge(currentStreak, longestStreak);

            let motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-primary); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Start your daily streak today!`;
            if (completed > 0 && completed < target) {
                motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Keep going! ${target - completed} more to hit your goal!`;
            } else if (completed >= target) {
                motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Daily goal reached! ${dueRemaining > 0 ? `${dueRemaining} more patterns due.` : 'All caught up!'}`;
            }

            return `
                <div class="goal-ring-container">
                    <div class="goal-ring-wrap">
                        <svg class="goal-ring-svg" viewBox="0 0 100 100">
                            <circle class="goal-ring-bg" cx="50" cy="50" r="42" />
                            <circle class="goal-ring-fill" cx="50" cy="50" r="42"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${offset}" />
                        </svg>
                        <div class="goal-ring-text">
                            <span class="goal-ring-count">${completed}</span>
                            <span class="goal-ring-label">of ${target}</span>
                        </div>
                    </div>
                    <div class="goal-info">
                        <div class="gamification-header">
                            <span class="gamification-title">
                                <svg class="svg-icon" style="stroke: var(--md-warning); margin-right: 3px;" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                                Daily Goal
                            </span>
                            <button id="goal-edit-btn" class="goal-edit-btn" title="Change daily goal" aria-label="Change daily goal">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            </button>
                        </div>
                        <div id="goal-editor" class="goal-editor" style="display: none;">
                            <input type="number" id="goal-input" class="goal-input" value="${target}" min="1" max="999" />
                            <button id="goal-save-btn" class="goal-save-btn">Set</button>
                        </div>
                        ${streakHtml}
                        <div class="gamification-msg">${motivationMsg}</div>
                    </div>
                </div>
            `;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error rendering goal progress: ${errorMessage}`, { completed, target, err });
            return '';
        }
    }

    /**
     * Renders the goal complete success template with checkmark indicator.
     */
    renderGoalComplete(completed: number, target: number, currentStreak: number, longestStreak: number): string {
        try {
            const circumference = 2 * Math.PI * 42;
            const streakHtml = this.renderStreakBadge(currentStreak, longestStreak);

            return `
                <div class="goal-ring-container">
                    <div class="goal-ring-wrap goal-ring-complete">
                        <svg class="goal-ring-svg" viewBox="0 0 100 100">
                            <circle class="goal-ring-bg" cx="50" cy="50" r="42" />
                            <circle class="goal-ring-fill goal-ring-fill-complete" cx="50" cy="50" r="42"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="0" />
                        </svg>
                        <div class="goal-ring-text">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width: 22px; height: 22px; stroke: var(--md-success);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                    </div>
                    <div class="goal-info">
                        <div class="gamification-header">
                            <span class="gamification-title" style="color: var(--md-success);">
                                <svg class="svg-icon" style="stroke: var(--md-success); margin-right: 3px;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                Goal Complete!
                            </span>
                            <button id="goal-edit-btn" class="goal-edit-btn" title="Change daily goal" aria-label="Change daily goal">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            </button>
                        </div>
                        <div id="goal-editor" class="goal-editor" style="display: none;">
                            <input type="number" id="goal-input" class="goal-input" value="${target}" min="1" max="999" />
                            <button id="goal-save-btn" class="goal-save-btn">Set</button>
                        </div>
                        ${streakHtml}
                        <div class="gamification-msg">
                            <svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            All ${completed} reviews done! Inbox Zero achieved!
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error rendering goal complete: ${errorMessage}`, { completed, target, err });
            return '';
        }
    }

    /**
     * Helper to render the streak pill badge containing fire icons.
     */
    renderStreakBadge(current: number, longest: number): string {
        try {
            if (current === 0 && longest === 0) return '';
            
            const fireColor = current > 0 ? 'var(--md-warning)' : 'var(--md-text-low)';
            const streakText = current > 0 ? `${current}-day streak` : 'No active streak';
            const bestText = longest > 0 ? `Best: ${longest}` : '';

            return `
                <div class="streak-badge">
                    <svg class="svg-icon streak-fire" style="stroke: ${fireColor}; fill: ${current > 0 ? 'rgba(249,171,0,0.2)' : 'none'};" viewBox="0 0 24 24">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                    </svg>
                    <span class="streak-text">${streakText}</span>
                    ${bestText ? `<span class="streak-best">${bestText}</span>` : ''}
                </div>
            `;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error rendering streak badge: ${errorMessage}`, { current, longest, err });
            return '';
        }
    }

    /**
     * Displays a milestone toast notification at the top of the popup.
     */
    showMilestoneToast(message: string): void {
        try {
            const toast = document.getElementById('milestone-toast');
            const toastText = document.getElementById('milestone-toast-text');
            if (!toast || !toastText) return;

            toastText.textContent = message;
            toast.classList.add('show');

            setTimeout(() => {
                try {
                    toast.classList.remove('show');
                } catch (timerErr) {
                    const errorMessage = timerErr instanceof Error ? timerErr.message : String(timerErr);
                    Logger.error('StatsComponent', `Error hiding milestone toast: ${errorMessage}`, { timerErr });
                }
            }, 3500);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error showing milestone toast: ${errorMessage}`, { message, err });
        }
    }

    /**
     * Renders a canvas-based confetti particle animation.
     */
    showConfetti(): void {
        try {
            const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement | null;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;

            const colors = [
                '#a8c7fa',
                '#f9ab00',
                '#81c995',
                '#f28b82',
                '#c58af9',
                '#4ecdc4',
                '#ff6b6b',
                '#ffe66d',
            ];

            const particles: ConfettiParticle[] = [];
            const particleCount = 60;

            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: canvas.width * Math.random(),
                    y: canvas.height * -0.1 * Math.random(),
                    w: 4 + Math.random() * 6,
                    h: 3 + Math.random() * 4,
                    vx: (Math.random() - 0.5) * 4,
                    vy: 1 + Math.random() * 3,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    rotation: Math.random() * 360,
                    rotationSpeed: (Math.random() - 0.5) * 10,
                    opacity: 1,
                    shape: Math.random() > 0.5 ? 'rect' : 'circle',
                });
            }

            let frame = 0;
            const maxFrames = 150;

            const animate = () => {
                try {
                    frame++;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    if (frame > maxFrames) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        return;
                    }

                    const fadeStart = maxFrames * 0.7;

                    particles.forEach(p => {
                        p.x += p.vx;
                        p.vy += 0.05;
                        p.y += p.vy;
                        p.rotation += p.rotationSpeed;

                        if (frame > fadeStart) {
                            p.opacity = Math.max(0, 1 - (frame - fadeStart) / (maxFrames - fadeStart));
                        }

                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate((p.rotation * Math.PI) / 180);
                        ctx.globalAlpha = p.opacity;
                        ctx.fillStyle = p.color;

                        if (p.shape === 'rect') {
                            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                        } else {
                            ctx.beginPath();
                            ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                            ctx.fill();
                        }

                        ctx.restore();
                    });

                    requestAnimationFrame(animate);
                } catch (animErr) {
                    const errorMessage = animErr instanceof Error ? animErr.message : String(animErr);
                    Logger.error('StatsComponent', `Error in confetti animation loop: ${errorMessage}`, { animErr });
                }
            };

            requestAnimationFrame(animate);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('StatsComponent', `Error initializing confetti animation: ${errorMessage}`, { err });
        }
    }
}
