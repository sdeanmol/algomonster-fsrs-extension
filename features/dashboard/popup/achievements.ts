/**
 * @file features/dashboard/popup/achievements.ts
 * @description Lightweight achievements and personal records engine.
 * Evaluates real learning milestones, computes personal records (longest streak, best single day, total reviews),
 * manages duplicate-free unlocks in chrome.storage.local, and renders accessible popup modal interfaces.
 *
 * Architecture Role: Popup Sub-View Component (Lightweight Gamification & Personal Records).
 * Context: Extension Action Popup (`features/dashboard/popup/popup.html`).
 */

import { Card, Achievement, PersonalRecords } from '../../../types/domain';
import { Logger } from '@common/logger';

/**
 * Definition template for an achievable milestone.
 */
export interface AchievementDefinition {
    id: string;
    title: string;
    description: string;
    icon: string;
    check: (params: AchievementCheckParams) => boolean;
    getProgress: (params: AchievementCheckParams) => { progress: string; progressPercent: number };
}

/**
 * Evaluation context passed to achievement condition check functions.
 */
export interface AchievementCheckParams {
    totalReviews: number;
    currentStreak: number;
    longestStreak: number;
    totalCards: number;
    completedToday: number;
    dailyGoalTarget: number;
}

/**
 * Curated list of 8 meaningful learning milestones.
 * Strictly focused on consistency, habit formation, and genuine knowledge retention.
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
    {
        id: 'first_review',
        title: 'First Step',
        description: 'Complete your first pattern review',
        icon: '🚀',
        check: (p) => p.totalReviews >= 1,
        getProgress: (p) => ({
            progress: `${Math.min(p.totalReviews, 1)} / 1 review`,
            progressPercent: p.totalReviews >= 1 ? 100 : 0
        })
    },
    {
        id: 'streak_3',
        title: 'Getting Consistent',
        description: 'Maintain a 3-day study streak',
        icon: '⚡',
        check: (p) => Math.max(p.currentStreak, p.longestStreak) >= 3,
        getProgress: (p) => {
            const best = Math.max(p.currentStreak, p.longestStreak);
            return {
                progress: `${Math.min(best, 3)} / 3 days`,
                progressPercent: Math.min(100, Math.round((best / 3) * 100))
            };
        }
    },
    {
        id: 'streak_7',
        title: 'One Week Strong',
        description: 'Maintain a 7-day study streak',
        icon: '🔥',
        check: (p) => Math.max(p.currentStreak, p.longestStreak) >= 7,
        getProgress: (p) => {
            const best = Math.max(p.currentStreak, p.longestStreak);
            return {
                progress: `${Math.min(best, 7)} / 7 days`,
                progressPercent: Math.min(100, Math.round((best / 7) * 100))
            };
        }
    },
    {
        id: 'streak_30',
        title: 'Habit Master',
        description: 'Maintain a 30-day study streak',
        icon: '🌟',
        check: (p) => Math.max(p.currentStreak, p.longestStreak) >= 30,
        getProgress: (p) => {
            const best = Math.max(p.currentStreak, p.longestStreak);
            return {
                progress: `${Math.min(best, 30)} / 30 days`,
                progressPercent: Math.min(100, Math.round((best / 30) * 100))
            };
        }
    },
    {
        id: 'cards_25',
        title: 'Knowledge Builder',
        description: 'Save and track 25 coding patterns',
        icon: '📚',
        check: (p) => p.totalCards >= 25,
        getProgress: (p) => ({
            progress: `${Math.min(p.totalCards, 25)} / 25 cards`,
            progressPercent: Math.min(100, Math.round((p.totalCards / 25) * 100))
        })
    },
    {
        id: 'reviews_100',
        title: 'Century Club',
        description: 'Complete 100 card reviews',
        icon: '💯',
        check: (p) => p.totalReviews >= 100,
        getProgress: (p) => ({
            progress: `${Math.min(p.totalReviews, 100)} / 100 reviews`,
            progressPercent: Math.min(100, Math.round((p.totalReviews / 100) * 100))
        })
    },
    {
        id: 'reviews_500',
        title: 'Review Master',
        description: 'Complete 500 card reviews',
        icon: '🎓',
        check: (p) => p.totalReviews >= 500,
        getProgress: (p) => ({
            progress: `${Math.min(p.totalReviews, 500)} / 500 reviews`,
            progressPercent: Math.min(100, Math.round((p.totalReviews / 500) * 100))
        })
    },
    {
        id: 'goal_reached',
        title: 'Goal Crusher',
        description: 'Complete your daily review goal for today',
        icon: '🎯',
        check: (p) => p.completedToday >= p.dailyGoalTarget && p.completedToday > 0,
        getProgress: (p) => ({
            progress: `${Math.min(p.completedToday, p.dailyGoalTarget)} / ${p.dailyGoalTarget} cards`,
            progressPercent: p.dailyGoalTarget > 0 ? Math.min(100, Math.round((p.completedToday / p.dailyGoalTarget) * 100)) : 0
        })
    }
];

/**
 * Calculates user's personal all-time records from actual activity and card data.
 */
export function calculatePersonalRecords(
    activity: Record<string, number>,
    cards: Card[],
    currentStreak: number,
    longestStreak: number
): PersonalRecords {
    let totalReviews = 0;
    let maxDailyReviews = 0;

    Object.values(activity).forEach(count => {
        if (typeof count === 'number' && count > 0) {
            totalReviews += count;
            if (count > maxDailyReviews) {
                maxDailyReviews = count;
            }
        }
    });

    // Fallback: if activity was reset but cards retain reps
    if (totalReviews === 0 && cards.length > 0) {
        cards.forEach(card => {
            totalReviews += card.reps || 0;
        });
    }

    return {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        maxDailyReviews,
        totalReviews,
        totalCards: cards.length
    };
}

/**
 * Evaluates achievements status against current user metrics and previously unlocked IDs.
 */
export function evaluateAchievements(params: {
    cards: Card[];
    activity: Record<string, number>;
    dailyGoalTarget: number;
    currentStreak: number;
    longestStreak: number;
    completedToday: number;
    unlockedIds: string[];
}): {
    achievements: Achievement[];
    newUnlocks: Achievement[];
    allUnlockedIds: string[];
    records: PersonalRecords;
} {
    const records = calculatePersonalRecords(
        params.activity,
        params.cards,
        params.currentStreak,
        params.longestStreak
    );

    const checkParams: AchievementCheckParams = {
        totalReviews: records.totalReviews,
        currentStreak: params.currentStreak,
        longestStreak: records.longestStreak,
        totalCards: records.totalCards,
        completedToday: params.completedToday,
        dailyGoalTarget: params.dailyGoalTarget
    };

    const unlockedSet = new Set(params.unlockedIds || []);
    const achievements: Achievement[] = [];
    const newUnlocks: Achievement[] = [];

    for (const def of ACHIEVEMENT_DEFINITIONS) {
        const isPreviouslyUnlocked = unlockedSet.has(def.id);
        const qualifiesNow = def.check(checkParams);
        const unlocked = isPreviouslyUnlocked || qualifiesNow;

        const progressInfo = def.getProgress(checkParams);

        const item: Achievement = {
            id: def.id,
            title: def.title,
            description: def.description,
            icon: def.icon,
            unlocked,
            progress: progressInfo.progress,
            progressPercent: unlocked ? 100 : progressInfo.progressPercent
        };

        if (!isPreviouslyUnlocked && qualifiesNow) {
            newUnlocks.push(item);
            unlockedSet.add(def.id);
        }

        achievements.push(item);
    }

    return {
        achievements,
        newUnlocks,
        allUnlockedIds: Array.from(unlockedSet),
        records
    };
}

/**
 * Renders the Personal Records 4-item grid template.
 */
export function renderPersonalRecords(records: PersonalRecords): string {
    return `
        <div class="records-card">
            <h4 class="records-card-title">
                <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: var(--md-primary); width: 15px; height: 15px; margin-right: 6px;">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                Personal Records
            </h4>
            <div class="records-grid">
                <div class="record-stat-box">
                    <span class="record-stat-label">Active Streak</span>
                    <span class="record-stat-value" style="color: ${records.currentStreak > 0 ? 'var(--md-warning)' : 'var(--md-text-med)'};">
                        🔥 ${records.currentStreak}d
                    </span>
                </div>
                <div class="record-stat-box">
                    <span class="record-stat-label">Longest Streak</span>
                    <span class="record-stat-value">
                        🏆 ${records.longestStreak}d
                    </span>
                </div>
                <div class="record-stat-box">
                    <span class="record-stat-label">Most in 1 Day</span>
                    <span class="record-stat-value" style="color: var(--md-success);">
                        ⚡ ${records.maxDailyReviews}
                    </span>
                </div>
                <div class="record-stat-box">
                    <span class="record-stat-label">Total Reviews</span>
                    <span class="record-stat-value">
                        📚 ${records.totalReviews}
                    </span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the achievements item list template.
 */
export function renderAchievementsList(achievements: Achievement[]): string {
    const unlockedCount = achievements.filter(a => a.unlocked).length;

    const itemsHtml = achievements.map(a => {
        const statusBadge = a.unlocked
            ? `<span class="achievement-badge unlocked">✓ Unlocked</span>`
            : `<span class="achievement-badge in-progress">${a.progress || 'In progress'}</span>`;

        return `
            <div class="achievement-row ${a.unlocked ? 'is-unlocked' : 'is-locked'}">
                <div class="achievement-icon-wrap" aria-hidden="true">
                    <span class="achievement-icon">${a.icon}</span>
                </div>
                <div class="achievement-details">
                    <div class="achievement-header-row">
                        <span class="achievement-title">${a.title}</span>
                        ${statusBadge}
                    </div>
                    <p class="achievement-desc">${a.description}</p>
                    ${!a.unlocked && a.progressPercent !== undefined ? `
                        <div class="achievement-progress-bar" role="progressbar" aria-valuenow="${a.progressPercent}" aria-valuemin="0" aria-valuemax="100">
                            <div class="achievement-progress-fill" style="width: ${a.progressPercent}%;"></div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="achievements-section">
            <div class="achievements-section-header">
                <h4 class="achievements-section-title">Milestones (${unlockedCount} of ${achievements.length} Unlocked)</h4>
            </div>
            <div class="achievements-list">
                ${itemsHtml}
            </div>
        </div>
    `;
}

/**
 * Renders the complete HTML body for the Achievements & Records modal.
 */
export function renderAchievementsModalContent(
    achievements: Achievement[],
    records: PersonalRecords
): string {
    return `
        ${renderPersonalRecords(records)}
        ${renderAchievementsList(achievements)}
    `;
}
