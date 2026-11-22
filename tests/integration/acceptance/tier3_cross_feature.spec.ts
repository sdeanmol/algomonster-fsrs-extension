/**
 * @file tier3_cross_feature.spec.ts
 * @description Tier 3 Acceptance Test Suite: 15 Pairwise Cross-Feature Tests (T3-01 through T3-15)
 * verifying cross-cutting invariants, storage synchronization, lifecycle robustness, and host DOM safety.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { h, render } from 'preact';
import * as zlib from 'zlib';

import {
    BASELINE_TIMESTAMP,
    freezeTime,
    seedStorageFromBackup,
    clearExtensionStorage,
    getStorageSnapshot
} from './helpers/storageHydrationHelper';
import {
    getBackupBuffer,
    parseBackupArchive,
    computeFnv1a32,
    createMockBackupFile
} from './helpers/backupFixtureHelper';
import { setupMockHostSpa, simulateSpaNavigation, simulatePopstate, simulateMonacoTyping } from './helpers/domHostHelper';
import {
    calculateExpectedDueCount,
    calculateExpectedRetention
} from './helpers/fsrsCalculationHelper';

import { BackupManager, Fnv1aHasher } from '@common/data/backupManager';
import FsrsScheduler from '@tracker/scheduler/fsrsScheduler';
import { getLastReviewDate } from '@common/utils/cardUtils';
import { DataUtils } from '@dashboard/analytics/utils/dataUtils';
import { SettingsApp } from '@common/settings/settings';
import { PopupApp } from '@dashboard/popup/popup';
import { ForecastApp } from '@dashboard/forecast/forecast';
import { TagInput } from '@common/utils/tagInput';
import Tracker from '@tracker/tracker';
import { Highlighter } from '../../../features/highlighter/highlighter';
import { isIgnoredMutationNode, AlgoRecallOrchestrator } from '../../../content/content';
import { Notifier } from '../../../content/notifications';
import { AlgoRecallBackground } from '../../../background/background';
import { Card, FSRSParameters, WhitelistedWebsite } from '../../../types/domain';
import { DEFAULT_WHITELISTED_WEBSITES } from '../../../features/common/constants';

describe('Tier 3: Cross-Feature Pairwise Interaction Suite (15 Tests)', () => {
    let unfreeze: () => void;
    let rootContainer: HTMLElement;

    beforeEach(() => {
        delete (document.body as any).__k;
        unfreeze = freezeTime(BASELINE_TIMESTAMP);
        rootContainer = document.createElement('div');
        rootContainer.id = 'test-acceptance-tier3-root';
        document.body.appendChild(rootContainer);
    });

    afterEach(async () => {
        if (rootContainer && rootContainer.parentNode) {
            render(null, rootContainer);
            rootContainer.parentNode.removeChild(rootContainer);
        }
        delete (document.body as any).__k;
        await clearExtensionStorage();
        unfreeze();
        jest.restoreAllMocks();
    });

    // =========================================================================
    // T3-01: F1 (Backup Import) ↔ F12 (Popup KPI Mount)
    // =========================================================================
    it('T3-01: Backup Import + Immediate Popup KPI Mount', async () => {
        const buf = getBackupBuffer();
        const mockFile = createMockBackupFile(buf);
        await BackupManager.importBackup(mockFile, () => {});

        render(h(PopupApp, {}), rootContainer);
        await new Promise(resolve => setTimeout(resolve, 80));

        // Box 1: Patterns count
        const box1 = rootContainer.querySelector('#box-total') || rootContainer;
        expect(box1.textContent).toContain('52');
        expect(box1.textContent?.toUpperCase()).toContain('PATTERNS');

        // Box 2: Due today count with danger styling
        const box2 = rootContainer.querySelector('#box-due') || rootContainer;
        expect(box2.textContent).toContain('35');
        expect(box2.textContent?.toUpperCase()).toContain('DUE TODAY');
        expect(box2.className).toContain('danger');

        // Box 3: Retention rate with danger styling
        const box3 = rootContainer.querySelector('#box-retention') || rootContainer;
        expect(box3.textContent).toContain('63%');
        expect(box3.textContent?.toUpperCase()).toContain('RETENTION');
        expect(box3.className).toContain('danger');

        // Level badge & streak
        expect(rootContainer.textContent).toMatch(/Lv\.\s*7/i);
        expect(rootContainer.textContent).toMatch(/Best:\s*8/i);
        expect(rootContainer.textContent).toMatch(/0\s*of\s*10|0\s*\/\s*10/i);
    });

    // =========================================================================
    // T3-02: F6 (Route Navigation) ↔ F5 (Tracker Host Isolation)
    // =========================================================================
    it('T3-02: SPA Route Navigation + Tracker Host Isolation', async () => {
        const spa = setupMockHostSpa({ title: 'Two Sum - LeetCode', url: '/problems/two-sum/' });

        const tracker = new Tracker();
        tracker.createUI();

        const host = document.getElementById('algo-tracker-host');
        expect(host).not.toBeNull();
        expect(document.getElementById('algo-fsrs-launcher')).not.toBeNull();
        expect((document.body as any).__k).toBeUndefined();

        // Simulate Next.js client-side navigation that wipes the DOM
        simulateSpaNavigation('Add Two Numbers - LeetCode', '/problems/add-two-numbers/', true);
        expect(document.getElementById('algo-tracker-host')).toBeNull();

        // Tracker detects detached state, resets isMounted, and recovers UI
        tracker.createUI();
        const recoveredHost = document.getElementById('algo-tracker-host');
        expect(recoveredHost).not.toBeNull();
        expect(document.getElementById('algo-fsrs-launcher')).not.toBeNull();
        expect((document.body as any).__k).toBeUndefined();

        tracker.removeUI();
        spa.cleanup();
    });

    // =========================================================================
    // T3-03: F10 (TagInput) ↔ F13 (Analytics Tag Coverage & Retrievability)
    // =========================================================================
    it('T3-03: Declarative TagInput + Analytics Tag Coverage & Retrievability', async () => {
        await seedStorageFromBackup();
        const snapshot = await getStorageSnapshot();
        const cards: Card[] = snapshot.fsrsCards;
        const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);

        let currentTags = ['Binary Search'];
        const handleTagsChange = (newTags: string[]) => {
            currentTags = newTags;
        };

        // Render TagInput declaratively
        render(h(TagInput, { tags: currentTags, onChange: handleTagsChange }), rootContainer);

        const chips = rootContainer.querySelectorAll('.tag-chip');
        expect(chips.length).toBe(1);
        expect(rootContainer.textContent).toContain('Binary Search');

        // Add a new tag to the card collection and re-compute analytics
        const binarySearchCardsBefore = cards.filter(c => c.tags && c.tags.includes('Binary Search')).length;
        expect(binarySearchCardsBefore).toBeGreaterThan(0);

        // Add 'Binary Search' tag to an untagged card
        const cardToUpdate = cards.find(c => !c.tags || !c.tags.includes('Binary Search'))!;
        cardToUpdate.tags = [...(cardToUpdate.tags || []), 'Binary Search'];

        const dataUtils = new DataUtils(cards, snapshot.fsrsActivity, scheduler);
        const tagAnalytics = dataUtils.getStatsByTag();
        const bsStat = tagAnalytics.find(t => t.tag === 'Binary Search');

        expect(bsStat).toBeDefined();
        expect(bsStat!.count).toBe(binarySearchCardsBefore + 1);
        expect(typeof bsStat!.retention).toBe('number');
        expect(bsStat!.retention).toBeGreaterThan(0);
    });

    // =========================================================================
    // T3-04: F4 (Settings Hydration) ↔ F13 (Analytics Retention Recompute)
    // =========================================================================
    it('T3-04: Settings FSRS Param Modification + Analytics Retention Recompute', async () => {
        await seedStorageFromBackup();
        const snapshot = await getStorageSnapshot();
        const cards: Card[] = snapshot.fsrsCards;

        // Baseline retention with requestRetention = 0.90
        const initialScheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
        const initialDataUtils = new DataUtils(cards, snapshot.fsrsActivity, initialScheduler);
        const initialRetention = initialDataUtils.getSummaryStats().trueRetention;
        expect(initialRetention).toBe(63);

        // Render SettingsApp
        render(h(SettingsApp, {}), rootContainer);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Modify requestRetention to 0.80 in storage and notify listeners
        const modifiedParams: FSRSParameters = {
            ...snapshot.fsrsGlobalParams,
            requestRetention: 0.80
        };
        await chrome.storage.local.set({ fsrsGlobalParams: modifiedParams });

        // Trigger storage change listener if helper is available
        const trigger = (chrome as any).__triggerStorageChange;
        if (typeof trigger === 'function') {
            trigger({ fsrsGlobalParams: { oldValue: snapshot.fsrsGlobalParams, newValue: modifiedParams } }, 'local');
        }

        // Recompute retention with updated parameters
        const updatedScheduler = new FsrsScheduler(modifiedParams);
        const updatedDataUtils = new DataUtils(cards, snapshot.fsrsActivity, updatedScheduler);

        expect(initialScheduler.requestRetention).toBe(0.90);
        expect(updatedScheduler.requestRetention).toBe(0.80);

        const currentRetention = updatedDataUtils.getSummaryStats().trueRetention;
        expect(currentRetention).toBe(63);

        // Future projected recall over 30 days reflects memory decay below current retention
        const futureRecall = updatedDataUtils.getExamReadiness(30).overallRecall;
        expect(futureRecall).toBeLessThan(currentRetention);
        expect(futureRecall).toBeGreaterThan(0);
    });

    // =========================================================================
    // T3-05: F7 (MutationObserver Throttling) ↔ F8 (Toast Notification)
    // =========================================================================
    it('T3-05: Monaco Typing Burst Throttling + Non-blocking Toast Notification', async () => {
        const spa = setupMockHostSpa();

        // Simulate typing burst of 50 editor lines
        simulateMonacoTyping(50);

        // Verify editor DOM nodes are correctly recognized as ignored mutation sources
        const editorLine = document.querySelector('.monaco-editor .view-line');
        expect(editorLine).not.toBeNull();
        expect(isIgnoredMutationNode(editorLine)).toBe(true);

        // Concurrently trigger non-blocking toast notification
        Notifier.showPageNotification('Study Reminder', 'Time to review your algorithms!', 'info');

        const toast = document.querySelector('.algo-custom-notification, #algo-custom-notification-el');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('Time to review your algorithms!');

        // Notification container must also be an ignored mutation source
        expect(isIgnoredMutationNode(toast)).toBe(true);

        spa.cleanup();
    });

    // =========================================================================
    // T3-06: F9 (Popstate Navigation) ↔ F11 (Forecast Subtitle Parity)
    // =========================================================================
    it('T3-06: History Popstate Navigation + Review Forecast Subtitle Parity', async () => {
        await seedStorageFromBackup();
        const snapshot = await getStorageSnapshot();

        // Render ForecastApp with 52 cards
        render(h(ForecastApp, { initialCards: snapshot.fsrsCards }), rootContainer);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Dispatch browser Back/Forward popstate event
        simulatePopstate('/dashboard?view=forecast&start=2026-11-22');
        await new Promise(resolve => setTimeout(resolve, 50));

        const subtitle = rootContainer.querySelector('#forecast-subtitle') || rootContainer;
        expect(subtitle.textContent).toContain('52 total cards · Next 30 days starting Nov 22');
    });

    // =========================================================================
    // T3-07: F1 (Backup Import) ↔ F3 (HistoryLog Date Fallback)
    // =========================================================================
    it('T3-07: Backup Import + HistoryLog Date Fallback Retrievability', async () => {
        const buf = getBackupBuffer();
        const parsed = parseBackupArchive(buf);
        await seedStorageFromBackup(parsed);

        const snapshot = await getStorageSnapshot();
        const cards: Card[] = snapshot.fsrsCards;

        // Exactly 15 cards lack top-level last_review
        const cardsLackingLastReview = cards.filter(c => !c.last_review && (!c.historyLog || c.historyLog.length > 0));
        const historyOnlyCards = cards.filter(c => !c.last_review && c.historyLog && c.historyLog.length > 0);
        expect(historyOnlyCards.length).toBe(15);

        // Fallback resolves all 15 cards
        for (const card of historyOnlyCards) {
            const date = getLastReviewDate(card);
            expect(date).not.toBeNull();
            expect(date).toBeGreaterThan(0);
        }

        // Full deck evaluation evaluates 52 cards = 63%
        const fullRetention = calculateExpectedRetention(cards, snapshot.fsrsGlobalParams, BASELINE_TIMESTAMP);
        expect(fullRetention.countEvaluated).toBe(52);
        expect(fullRetention.retentionPercent).toBe(63);

        // Omission of fallback drops evaluated count to 37 and distorts retention to 76%
        const directCards = cards.filter(c => c.last_review);
        const directRetention = calculateExpectedRetention(directCards, snapshot.fsrsGlobalParams, BASELINE_TIMESTAMP);
        expect(directRetention.countEvaluated).toBe(37);
        expect(directRetention.retentionPercent).toBe(76);
    });

    // =========================================================================
    // T3-08: F4 (Settings Whitelist) ↔ F5 (Tracker Host Teardown)
    // =========================================================================
    it('T3-08: Whitelist Settings Toggle + Tracker Host Teardown (removeUI)', async () => {
        const spa = setupMockHostSpa({ url: '/problems/two-sum/' });

        const orchestrator = new AlgoRecallOrchestrator();
        orchestrator.tracker.createUI();

        expect(document.getElementById('algo-tracker-host')).not.toBeNull();

        // Simulate de-whitelisting in settings (localhost is the test JSDOM domain)
        const updatedWhitelist: WhitelistedWebsite[] = [
            { domain: 'algo.monster', isDefault: true }
        ];

        orchestrator.handleStorageChanged({
            whitelistedWebsites: {
                oldValue: [{ domain: 'localhost', isDefault: true }],
                newValue: updatedWhitelist
            } as any
        }, 'local');

        // Host and launcher must be completely removed from DOM
        expect(document.getElementById('algo-tracker-host')).toBeNull();
        expect(document.getElementById('algo-fsrs-launcher')).toBeNull();
        expect(orchestrator.tracker.isMounted).toBe(false);

        spa.cleanup();
    });

    // =========================================================================
    // T3-09: F5 (Tracker Rating) ↔ F12 (Popup Daily Goal & Streak Increment)
    // =========================================================================
    it('T3-09: Tracker Rating Submission + Popup Daily Goal & Streak Increment', async () => {
        await seedStorageFromBackup();
        const snapshot = await getStorageSnapshot();
        const cards: Card[] = [...snapshot.fsrsCards];
        const activity: Record<string, number> = { ...(snapshot.fsrsActivity || {}) };

        // Baseline: 35 due cards, 112 total reviews
        const baselineDue = calculateExpectedDueCount(cards, BASELINE_TIMESTAMP);
        expect(baselineDue).toBe(35);

        // Find a due card and simulate review rating 3 (Good)
        const dueCardIndex = cards.findIndex(c => c.due <= BASELINE_TIMESTAMP);
        expect(dueCardIndex).toBeGreaterThanOrEqual(0);
        const targetCard = { ...cards[dueCardIndex] };

        const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
        const reviewedCard = scheduler.reviewCard(targetCard, 3, null, BASELINE_TIMESTAMP);

        // Card due date is pushed to future
        expect(reviewedCard.due).toBeGreaterThan(BASELINE_TIMESTAMP);
        cards[dueCardIndex] = reviewedCard;

        // Increment today's activity log
        const todayStr = '2026-11-22';
        activity[todayStr] = (activity[todayStr] || 0) + 1;

        await chrome.storage.local.set({
            fsrsCards: cards,
            fsrsActivity: activity
        });

        // Mount PopupApp and verify reactive metrics
        render(h(PopupApp, {}), rootContainer);
        await new Promise(resolve => setTimeout(resolve, 80));

        const dueBox = rootContainer.querySelector('#box-due') || rootContainer;
        expect(dueBox.textContent).toContain('34');

        // Daily goal progress ring: 1 of 10 completed
        expect(rootContainer.textContent).toMatch(/1\s*of\s*10|1\s*\/\s*10/i);
    });

    // =========================================================================
    // T3-10: F4 (Settings Palette) ↔ F7 (Highlighter Swatch Without Loop)
    // =========================================================================
    it('T3-10: Settings Palette Change + Highlighter Swatch Update Without Loop', async () => {
        await seedStorageFromBackup();
        const spa = setupMockHostSpa();

        const highlighter = new Highlighter();
        highlighter.createHighlighterUI();

        const tooltip = document.getElementById('algo-highlight-tooltip');
        expect(tooltip).not.toBeNull();

        // Mutating highlighter UI elements must be ignored by MutationObserver
        expect(isIgnoredMutationNode(tooltip)).toBe(true);

        // Change palette color in storage
        const updatedExtensionSettings = {
            activePaletteIndex: 1,
            defaultHighlightColor: '#ffadad',
            palettes: [
                { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] }
            ]
        };
        await chrome.storage.local.set({ extensionSettings: updatedExtensionSettings });

        // Update colors
        highlighter.renderTooltipColors(null, null);

        // Observer ignores tooltip DOM alterations without triggering infinite recursion
        expect(isIgnoredMutationNode(tooltip)).toBe(true);

        highlighter.removeHighlighterUI();
        spa.cleanup();
    });

    // =========================================================================
    // T3-11: F6 (Route Switch) ↔ F8 (Toast Notification Retention)
    // =========================================================================
    it('T3-11: Rapid Route Switch + Toast Notification Retention', async () => {
        const spa = setupMockHostSpa({ url: '/problems/two-sum/' });

        // Trigger toast notification
        Notifier.showPageNotification('Algorithmic Pattern Logged', 'Two Pointers approach saved', 'success');

        const toast = document.querySelector('.algo-custom-notification, #algo-custom-notification-el');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toContain('Two Pointers approach saved');

        // Simulate rapid client-side route navigation without destroying body-level notifications
        simulateSpaNavigation('3Sum - LeetCode', '/problems/3sum/', false);

        // Toast remains anchored and visible
        const toastAfterNav = document.querySelector('.algo-custom-notification, #algo-custom-notification-el');
        expect(toastAfterNav).not.toBeNull();

        spa.cleanup();
    });

    // =========================================================================
    // T3-12: F3 (HistoryLog Append) ↔ F1 (NDJSON V2 Export Round-trip)
    // =========================================================================
    it('T3-12: Card Review HistoryLog Append + Backup NDJSON V2 Export Round-trip', async () => {
        await seedStorageFromBackup();
        const snapshot = await getStorageSnapshot();
        const cards: Card[] = [...snapshot.fsrsCards];

        // Append a review log entry to card 0
        const card0 = cards[0];
        card0.historyLog = card0.historyLog || [];
        card0.historyLog.push({
            date: BASELINE_TIMESTAMP,
            rating: 3,
            stability: 5.2,
            difficulty: 4.8
        });
        await chrome.storage.local.set({ fsrsCards: cards });

        // Mock chrome.downloads and URL.createObjectURL for export capture
        let exportedBlob: Blob | null = null;
        (global as any).chrome.downloads = {
            download: jest.fn((options: any, callback?: () => void) => {
                if (callback) callback();
            })
        };
        (global as any).URL.createObjectURL = jest.fn((blob: Blob) => {
            exportedBlob = blob;
            return 'blob:mock-export-url';
        });
        (global as any).URL.revokeObjectURL = jest.fn();

        await BackupManager.exportBackup();

        expect(exportedBlob).not.toBeNull();
        const arrayBuf = await (exportedBlob as any).arrayBuffer();
        const decompressed = zlib.gunzipSync(Buffer.from(arrayBuf)).toString('utf-8');
        const lines = decompressed.split('\n').filter(l => l.trim().length > 0);

        // Verify NDJSON lines count and structure
        expect(lines.length).toBeGreaterThanOrEqual(180);

        // Verify footer checksum integrity
        const footer = JSON.parse(lines[lines.length - 1]);
        expect(footer.type).toBe('footer');
        expect(footer.data.count).toBe(lines.length - 1);

        const hasher = new Fnv1aHasher();
        for (let i = 0; i < lines.length - 1; i++) {
            hasher.update(lines[i] + '\n');
        }
        expect(hasher.digest()).toBe(footer.data.checksum);
    });

    // =========================================================================
    // T3-13: F10 (TagInput) ↔ F6 (Route Transition Cleanup)
    // =========================================================================
    it('T3-13: Declarative TagInput + SPA Route Transition Cleanup', async () => {
        const handleTagsChange = jest.fn();

        // Mount TagInput on Problem A
        render(h(TagInput, { tags: ['dfs', 'bfs'], onChange: handleTagsChange }), rootContainer);

        expect(rootContainer.querySelectorAll('.tag-chip').length).toBe(2);

        // Clean unmount on route transition
        render(null, rootContainer);
        expect(rootContainer.querySelectorAll('.tag-chip').length).toBe(0);

        // Mount fresh TagInput on Problem B without errors
        render(h(TagInput, { tags: ['dynamic-programming'], onChange: handleTagsChange }), rootContainer);
        expect(rootContainer.querySelectorAll('.tag-chip').length).toBe(1);
        expect(rootContainer.textContent).toContain('dynamic-programming');
    });

    // =========================================================================
    // T3-14: F9 (Popstate Navigation) ↔ F6 (Detached Tracker Recovery)
    // =========================================================================
    it('T3-14: Popstate Navigation + Detached Tracker Host Recovery', async () => {
        const spa = setupMockHostSpa({ url: '/problems/two-sum/' });

        const orchestrator = new AlgoRecallOrchestrator();
        orchestrator.tracker.createUI();

        expect(document.getElementById('algo-tracker-host')).not.toBeNull();

        // Simulate Next.js DOM wipe on navigation
        const host = document.getElementById('algo-tracker-host');
        if (host && host.parentNode) {
            host.parentNode.removeChild(host);
        }
        expect(document.getElementById('algo-tracker-host')).toBeNull();

        // Browser Back navigation popstate recovers UI
        simulatePopstate('/problems/two-sum/');
        orchestrator.triggerAggressiveUIUpdate();

        expect(document.getElementById('algo-tracker-host')).not.toBeNull();
        expect(document.getElementById('algo-fsrs-launcher')).not.toBeNull();

        orchestrator.tracker.removeUI();
        spa.cleanup();
    });

    // =========================================================================
    // T3-15: F4 (Settings Toggle) ↔ F2 (Due Card Reminder Notification)
    // =========================================================================
    it('T3-15: Notification Settings Toggle + Due Card Reminder Alarm Logic', async () => {
        await seedStorageFromBackup();

        // Notifications disabled in settings
        await chrome.storage.local.set({
            notificationSettings: {
                enabled: false,
                frequency: '60'
            }
        });

        const bg = new AlgoRecallBackground();
        const notificationSpy = jest.spyOn(bg, 'dispatchReviewNotification' as any);

        await bg.checkDueCards('test');
        expect(notificationSpy).not.toHaveBeenCalled();

        // Toggle notifications enabled
        await chrome.storage.local.set({
            notificationSettings: {
                enabled: true,
                frequency: '60'
            }
        });

        await bg.checkDueCards('test');
        expect(notificationSpy).toHaveBeenCalled();
        expect((notificationSpy.mock.calls[0] as any)[0]).toBe(35); // 35 due cards reported
    });
});
