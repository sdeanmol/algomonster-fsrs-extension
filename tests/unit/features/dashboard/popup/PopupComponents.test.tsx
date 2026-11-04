/**
 * @file tests/unit/features/dashboard/popup/PopupComponents.test.tsx
 * @description Unit tests for Preact components across the Main Popup UI & Sub-Components.
 */

import { h, render } from 'preact';
import {
    PopupHeader,
    PopupNavigationGrid,
    PopupSettingsToggles,
    PopupStatusToast
} from '../../../../../features/dashboard/popup/popup';
import {
    PopupHeatmapCell,
    PopupHeatmapGrid
} from '../../../../../features/dashboard/popup/heatmap';
import {
    PopupSearchResultItem,
    PopupSearchResultsList
} from '../../../../../features/dashboard/popup/search';
import {
    PopupRatingPromptCard
} from '../../../../../features/dashboard/popup/rating';
import {
    PopupStatsOverview,
    PopupDailyGoalRing,
    PopupStreakBadge,
    PopupLevelBadge
} from '../../../../../features/dashboard/popup/stats';
import {
    PopupPermissionWarningBanner,
    PopupNotificationSettings
} from '../../../../../features/dashboard/popup/notifications';

describe('Popup Preact Components', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        document.body.innerHTML = '';
    });

    describe('PopupHeader & NavigationGrid', () => {
        it('renders PopupHeader and responds to theme and analytics clicks', () => {
            const onTheme = jest.fn();
            const onAnalytics = jest.fn();

            render(<PopupHeader onToggleTheme={onTheme} onOpenAnalytics={onAnalytics} />, container);

            expect(container.querySelector('.brand-name')?.textContent).toBe('AlgoRecall');

            (container.querySelector('#theme-toggle-btn') as HTMLElement).click();
            expect(onTheme).toHaveBeenCalled();

            (container.querySelector('#header-analytics-btn') as HTMLElement).click();
            expect(onAnalytics).toHaveBeenCalled();
        });

        it('renders PopupNavigationGrid buttons and handles callbacks', () => {
            const onHeatmap = jest.fn();
            const onHelp = jest.fn();

            render(
                <PopupNavigationGrid
                    onOpenHeatmap={onHeatmap}
                    onOpenHelp={onHelp}
                />,
                container
            );

            const heatmapBtn = container.querySelector('#open-heatmap-tab-btn') as HTMLElement;
            const helpBtn = container.querySelector('#help-btn') as HTMLElement;

            heatmapBtn.click();
            expect(onHeatmap).toHaveBeenCalled();

            helpBtn.click();
            expect(onHelp).toHaveBeenCalled();
        });
    });

    describe('PopupSettingsToggles & Toast', () => {
        it('renders toggle checkboxes and handles changes', () => {
            const onMarker = jest.fn();

            render(
                <PopupSettingsToggles
                    markerEnabled={true}
                    chartsEnabled={false}
                    launcherEnabled={true}
                    devModeEnabled={false}
                    onToggleMarker={onMarker}
                />,
                container
            );

            const markerInput = container.querySelector('#toggle-text-marker') as HTMLInputElement;
            expect(markerInput.checked).toBe(true);

            markerInput.checked = false;
            markerInput.dispatchEvent(new Event('change'));
            expect(onMarker).toHaveBeenCalledWith(false);
        });

        it('renders PopupStatusToast when message is provided', () => {
            render(<PopupStatusToast message="Settings Saved!" />, container);
            expect(container.querySelector('#status-msg')?.textContent).toBe('Settings Saved!');
        });
    });

    describe('PopupHeatmapCell & Grid', () => {
        it('renders heatmap cell with role and title', () => {
            render(<PopupHeatmapCell dateString="2026-08-01" count={3} level={2} />, container);

            const cell = container.querySelector('.heatmap-cell') as HTMLElement;
            expect(cell.classList.contains('level-2')).toBe(true);
            expect(cell.getAttribute('aria-label')).toBe('3 reviews on 2026-08-01');
        });

        it('renders PopupHeatmapGrid with lifetime toggle', () => {
            const onToggle = jest.fn();
            const cells = [
                { dateString: '2026-08-01', count: 1, level: 1 as const }
            ];

            render(<PopupHeatmapGrid cells={cells} isLifetime={false} onToggleLifetime={onToggle} />, container);

            const btn = container.querySelector('#toggle-lifetime-btn') as HTMLElement;
            expect(btn.textContent).toBe('Show Lifetime');

            btn.click();
            expect(onToggle).toHaveBeenCalled();
        });
    });

    describe('PopupSearchResultItem & List', () => {
        it('renders search item with title, tags, and status badge', () => {
            render(
                <PopupSearchResultItem
                    problemTitle="Two Sum"
                    problemUrl="https://leetcode.com/problems/two-sum"
                    isDue={true}
                    tags={['Array', 'Hash Table']}
                />,
                container
            );

            expect(container.querySelector('.popup-search-title')?.textContent).toBe('Two Sum');
            expect(container.querySelector('.popup-badge-due')?.textContent).toBe('Due');
            expect(container.querySelectorAll('.popup-tag').length).toBe(2);
        });

        it('renders empty search state when no results match', () => {
            render(<PopupSearchResultsList cards={[]} totalMatches={0} />, container);
            expect(container.querySelector('.popup-search-empty')?.textContent).toContain('No matching patterns found');
        });
    });

    describe('PopupRatingPromptCard', () => {
        it('renders prompt card and thanks states', () => {
            const onSnooze = jest.fn();
            const onAlready = jest.fn();

            render(
                <PopupRatingPromptCard
                    status="unrated"
                    promptText="Enjoying AlgoRecall?"
                    buttonLabel="Rate Extension"
                    reviewUrl="https://store.url"
                    onSnooze={onSnooze}
                    onAlreadyRated={onAlready}
                    onEdit={jest.fn()}
                />,
                container
            );

            expect(container.querySelector('#rating-prompt-text')?.textContent).toBe('Enjoying AlgoRecall?');
            (container.querySelector('#snooze-rate-btn') as HTMLElement).click();
            expect(onSnooze).toHaveBeenCalled();
        });
    });

    describe('Stats, Goal Ring, & XP Badges', () => {
        it('renders PopupStatsOverview numbers', () => {
            render(<PopupStatsOverview totalCards={45} dueCards={10} retentionRate={92} />, container);

            expect(container.querySelector('#total-cards')?.textContent).toBe('45');
            expect(container.querySelector('#due-cards')?.textContent).toBe('10');
            expect(container.querySelector('#retention-rate')?.textContent).toBe('92%');
        });

        it('renders PopupDailyGoalRing and progress status', () => {
            render(<PopupDailyGoalRing todayReviewed={5} dailyGoal={10} progress={0.5} isGoalMet={false} />, container);

            expect(container.querySelector('#daily-goal-count')?.textContent).toBe('5');
            expect(container.querySelector('#daily-goal-target')?.textContent).toBe('10');
            expect(container.querySelector('#daily-goal-status')?.textContent).toContain('5 more to reach goal');
        });

        it('renders PopupStreakBadge', () => {
            render(<PopupStreakBadge currentStreak={7} longestStreak={14} />, container);

            expect(container.querySelector('#streak-days')?.textContent).toBe('7 Days');
            expect(container.querySelector('#longest-streak-days')?.textContent).toBe('14');
        });

        it('renders PopupLevelBadge', () => {
            render(<PopupLevelBadge level={3} levelTitle="Specialist" currentXP={350} nextLevelXP={500} progress={70} />, container);

            expect(container.querySelector('#user-level')?.textContent).toBe('Level 3');
            expect(container.querySelector('#user-title')?.textContent).toBe('Specialist');
            expect(container.querySelector('#user-current-xp')?.textContent).toBe('350');
        });
    });

    describe('PopupNotificationSettings & Warning Banner', () => {
        it('renders warning banner when permission is not granted', () => {
            const onEnable = jest.fn();
            render(<PopupPermissionWarningBanner permission="default" onEnable={onEnable} />, container);

            expect(container.querySelector('#permission-warning-banner')).not.toBeNull();
            (container.querySelector('#enable-notifications-btn') as HTMLElement).click();
            expect(onEnable).toHaveBeenCalled();
        });

        it('renders PopupNotificationSettings options', () => {
            const onToggle = jest.fn();
            render(
                <PopupNotificationSettings
                    enabled={true}
                    interval={120}
                    requireInteraction={false}
                    quietHoursEnabled={true}
                    quietStart="22:00"
                    quietEnd="08:00"
                    badgeEnabled={true}
                    weeklyDigestEnabled={false}
                    onToggleNotifications={onToggle}
                />,
                container
            );

            const notifInput = container.querySelector('#toggle-notifications') as HTMLInputElement;
            expect(notifInput.checked).toBe(true);
        });
    });
});

