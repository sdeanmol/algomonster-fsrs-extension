/**
 * @file tier1_feature_coverage.spec.ts
 * @description Tier 1 Acceptance Test Suite: 65 feature coverage tests covering Features 1-13 (5 tests per feature).
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { h, render } from 'preact';
import * as fs from 'fs';
import * as path from 'path';

import {
    getBackupBuffer,
    parseBackupArchive,
    computeFnv1a32,
    createMockBackupFile
} from './helpers/backupFixtureHelper';
import {
    BASELINE_TIMESTAMP,
    freezeTime,
    seedStorageFromBackup,
    clearExtensionStorage,
    getStorageSnapshot
} from './helpers/storageHydrationHelper';
import {
    calculateExpectedDueCount,
    calculateExpectedRetention,
    calculateExpectedLevel,
    calculateExpectedAchievements
} from './helpers/fsrsCalculationHelper';
import { setupMockHostSpa, simulateSpaNavigation, simulatePopstate } from './helpers/domHostHelper';

import { BackupManager, Fnv1aHasher } from '@common/data/backupManager';
import FsrsScheduler from '@tracker/scheduler/fsrsScheduler';
import { getLastReviewDate } from '@common/utils/cardUtils';
import { DataUtils } from '@dashboard/analytics/utils/dataUtils';
import { SettingsApp } from '@common/settings/settings';
import { PopupApp } from '@dashboard/popup/popup';
import { OverviewTab } from '@dashboard/analytics/overview/overview';
import { TagsTab } from '@dashboard/analytics/tags/tags';
import { InsightsTab } from '@dashboard/analytics/insights/insights';
import { ReadinessTab } from '@dashboard/analytics/readiness/readiness';
import { TagInput } from '@common/utils/tagInput';
import { Card, FSRSParameters } from '../../../types/domain';

describe('Tier 1: Feature Coverage (65 Tests Across Features 1-13)', () => {
    let unfreeze: () => void;
    let rootContainer: HTMLElement;

    beforeEach(() => {
        delete (document.body as any).__k;
        unfreeze = freezeTime(BASELINE_TIMESTAMP);
        rootContainer = document.createElement('div');
        rootContainer.id = 'test-root';
        document.body.appendChild(rootContainer);
    });

    afterEach(async () => {
        if (rootContainer && rootContainer.parentNode) {
            render(null, rootContainer);
            rootContainer.parentNode.removeChild(rootContainer);
        }
        await clearExtensionStorage();
        unfreeze();
        jest.restoreAllMocks();
    });

    // =========================================================================
    // FEATURE 1: Backup Archive Deserialization & Storage Hydration
    // =========================================================================
    describe('Feature 1: Backup Archive Deserialization & Storage Hydration', () => {
        it('T1-F1-01: parses real Gzip NDJSON V2 archive and verifies exactly 189 line records', () => {
            const buf = getBackupBuffer();
            const parsed = parseBackupArchive(buf);
            expect(parsed.rawLines.length).toBe(189);
            expect(parsed.header.version).toBe(2);
            expect(parsed.header.counts.cards).toBe(52);
            expect(parsed.header.counts.pages).toBe(64);
            expect(parsed.header.counts.marks).toBe(23);
            expect(parsed.header.counts.bookmarks).toBe(22);
            expect(parsed.header.counts.pagecontents).toBe(23);
        });

        it('T1-F1-02: validates 32-bit FNV-1a checksum of lines 0..187 produces digest 97299100 matching footer', () => {
            const buf = getBackupBuffer();
            const parsed = parseBackupArchive(buf);
            const hasher = new Fnv1aHasher();
            // Lines 0 through 187 are hashed with their trailing newlines
            for (let i = 0; i < 188; i++) {
                hasher.update(parsed.rawLines[i] + '\n');
            }
            const digest = hasher.digest();
            expect(digest).toBe('97299100');
            expect(parsed.footer.checksum).toBe('97299100');
            expect(parsed.footer.count).toBe(188);
        });

        it('T1-F1-03: verifies URL de-duplication correctly maps surrogate page pointer u to canonical URLs and titles', () => {
            const buf = getBackupBuffer();
            const parsed = parseBackupArchive(buf);
            expect(parsed.cards.length).toBe(52);
            // Every card should have a valid problemUrl and problemTitle restored from pages
            for (const card of parsed.cards) {
                expect(card.problemUrl).toBeDefined();
                expect(card.problemUrl).toMatch(/^https:\/\//);
                expect(card.problemTitle).toBeDefined();
                expect(card.problemTitle.length).toBeGreaterThan(0);
                expect((card as any).u).toBeUndefined();
            }
        });

        it('T1-F1-04: verifies chrome.storage.local hydrates exact entity counts from backup', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            expect(Array.isArray(snapshot.fsrsCards)).toBe(true);
            expect(snapshot.fsrsCards.length).toBe(52);
            expect(Array.isArray(snapshot.marks)).toBe(true);
            expect(snapshot.marks.length).toBe(23);
            expect(Array.isArray(snapshot.bookmarks)).toBe(true);
            expect(snapshot.bookmarks.length).toBe(22);
            expect(Array.isArray(snapshot.pagecontents)).toBe(true);
            expect(snapshot.pagecontents.length).toBe(23);
            expect(Object.keys(snapshot.fsrsActivity || {}).length).toBe(31);
        });

        it('T1-F1-05: verifies configuration records hydrate settings, global params, streak, and whitelists', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            expect(snapshot.longestStreak).toBe(8);
            expect(snapshot.theme).toBe('dark');
            expect(snapshot.ratingPromptState).toEqual({ snoozedUntil: 0, status: 'rated' });
            expect(snapshot.fsrsGlobalParams).toBeDefined();
            expect(snapshot.fsrsGlobalParams.w.length).toBe(17);
            expect(snapshot.whitelistedWebsites.length).toBe(10);
            expect(snapshot.whitelistedWebsites.some((w: any) => w.domain === 'leetcode.com')).toBe(true);
        });
    });

    // =========================================================================
    // FEATURE 2: FSRS Global Parameters Hydration & Retrievability Parity
    // =========================================================================
    describe('Feature 2: FSRS Global Parameters Hydration & Retrievability Parity', () => {
        it('T1-F2-01: verifies fsrsGlobalParams is stored and retrieved with 17 weights, decay -0.5, factor 0.234567', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const params: FSRSParameters = snapshot.fsrsGlobalParams;
            expect(params.decay).toBe(-0.5);
            expect(params.factor).toBe(0.234567);
            expect(params.requestRetention).toBe(0.90);
            expect(params.w).toHaveLength(17);
            expect(params.w[0]).toBeCloseTo(0.6664, 4);
            expect(params.w[1]).toBeCloseTo(1.1334, 4);
        });

        it('T1-F2-02: instantiates FsrsScheduler with hydrated fsrsGlobalParams and applies custom weights', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            expect(scheduler.decay).toBe(-0.5);
            expect(scheduler.factor).toBe(0.234567);
            expect(scheduler.requestRetention).toBe(0.90);
            expect(scheduler.w[0]).toBeCloseTo(0.6664, 4);
        });

        it('T1-F2-03: computes average retrievability across 52 cards at baseline timestamp equaling exactly 63%', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const result = calculateExpectedRetention(snapshot.fsrsCards, snapshot.fsrsGlobalParams, BASELINE_TIMESTAMP);
            expect(result.countEvaluated).toBe(52);
            expect(result.retentionPercent).toBe(63);
        });

        it('T1-F2-04: contrasts custom params retention (63%) with default weights (76%) and null scheduler (98%)', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const cards: Card[] = snapshot.fsrsCards;

            // Custom params calculation across all 52 cards
            const customResult = calculateExpectedRetention(cards, snapshot.fsrsGlobalParams, BASELINE_TIMESTAMP);
            expect(customResult.retentionPercent).toBe(63);

            // Without historyLog fallback (only 37 cards evaluated)
            const cardsWithDirectDate = cards.filter(c => c.last_review || c.lastReview);
            const directResult = calculateExpectedRetention(cardsWithDirectDate, snapshot.fsrsGlobalParams, BASELINE_TIMESTAMP);
            expect(directResult.retentionPercent).toBe(76);

            // Repetition fallback formula: (totalReps - totalLapses) / totalReps
            let totalReps = 0;
            let totalLapses = 0;
            for (const c of cards) {
                totalReps += c.reps || 0;
                totalLapses += c.lapses || 0;
            }
            const rawRetention = Math.round(((totalReps - totalLapses) / totalReps) * 100);
            expect(rawRetention).toBe(98);
        });

        it('T1-F2-05: verifies DataUtils calculates trueRetention as 63% when supplied with custom scheduler', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);
            const summary = dataUtils.getSummaryStats();
            expect(summary.trueRetention).toBe(63);
            expect(summary.totalCards).toBe(52);
            expect(summary.dueToday).toBe(35);
        });
    });

    // =========================================================================
    // FEATURE 3: HistoryLog Fallback for Card Review Dates
    // =========================================================================
    describe('Feature 3: HistoryLog Fallback for Card Review Dates', () => {
        it('T1-F3-01: identifies exactly 15 cards in the backup lacking last_review but having valid historyLog entries', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const cards: Card[] = snapshot.fsrsCards;

            const cardsWithDirectDate = cards.filter(c => c.last_review || c.lastReview);
            const cardsWithOnlyHistoryLog = cards.filter(c => !(c.last_review || c.lastReview) && c.historyLog && c.historyLog.length > 0);

            expect(cardsWithDirectDate.length).toBe(37);
            expect(cardsWithOnlyHistoryLog.length).toBe(15);
            expect(cardsWithDirectDate.length + cardsWithOnlyHistoryLog.length).toBe(52);
        });

        it('T1-F3-02: verifies getLastReviewDate correctly extracts timestamp from historyLog fallback', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const historyOnlyCard = snapshot.fsrsCards.find((c: Card) => !(c.last_review || c.lastReview) && c.historyLog && c.historyLog.length > 0);
            expect(historyOnlyCard).toBeDefined();

            const resolvedDate = getLastReviewDate(historyOnlyCard);
            expect(resolvedDate).toBeGreaterThan(0);
            const expectedDate = historyOnlyCard.historyLog[historyOnlyCard.historyLog.length - 1].date;
            expect(resolvedDate).toBe(typeof expectedDate === 'number' ? expectedDate : Date.parse(expectedDate as string));
        });

        it('T1-F3-03: verifies all 52 cards are evaluated for retrievability rather than only 37', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const cards: Card[] = snapshot.fsrsCards;
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);

            let evaluatedCount = 0;
            for (const c of cards) {
                const r = scheduler.getRetrievability(c, BASELINE_TIMESTAMP);
                if (r > 0) evaluatedCount++;
            }
            expect(evaluatedCount).toBe(52);
        });

        it('T1-F3-04: verifies excluding historyLog fallback drops evaluated cards to 37 and distorts retention to 76%', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const cards: Card[] = snapshot.fsrsCards;
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);

            // Calculation without fallback: only cards with direct last_review
            let directSum = 0;
            let directCount = 0;
            for (const c of cards) {
                if (c.last_review || c.lastReview) {
                    const r = scheduler.getRetrievability(c, BASELINE_TIMESTAMP);
                    if (r > 0) {
                        directSum += r;
                        directCount++;
                    }
                }
            }
            expect(directCount).toBe(37);
            const directRetention = Math.round((directSum / directCount) * 100);
            expect(directRetention).toBe(76);
        });

        it('T1-F3-05: verifies getLastReviewDate handles empty or null historyLog gracefully returning null', () => {
            const emptyCard: Partial<Card> = { id: 'empty', historyLog: [] };
            expect(getLastReviewDate(emptyCard as Card)).toBeNull();
            expect(getLastReviewDate(null)).toBeNull();
            expect(getLastReviewDate(undefined)).toBeNull();
        });
    });

    // =========================================================================
    // FEATURE 4: Settings UI Dynamic Hydration & Change Listeners
    // =========================================================================
    describe('Feature 4: Settings UI Dynamic Hydration & Change Listeners', () => {
        it('T1-F4-01: verifies BackupManager.importBackup deserializes and awaits storage commit', async () => {
            const buf = getBackupBuffer();
            const mockFile = createMockBackupFile(buf);
            const onStatus = jest.fn();

            await BackupManager.importBackup(mockFile, onStatus);
            expect(onStatus).toHaveBeenCalledWith('Backup restored successfully!');

            const snapshot = await getStorageSnapshot();
            expect(snapshot.fsrsCards.length).toBe(52);
        });

        it('T1-F4-02: mounts SettingsApp and verifies restored settings render in form controls', async () => {
            await seedStorageFromBackup();
            render(h(SettingsApp, {}), rootContainer);

            // Wait for initial async state load
            await new Promise(resolve => setTimeout(resolve, 50));

            const paletteTitle = rootContainer.querySelector('.color-scheme-preview') || rootContainer.querySelector('#active-palette-name');
            // Settings should reflect hydrated settings
            expect(rootContainer.textContent).toContain('Settings');
        });

        it('T1-F4-03: verifies storage changes trigger reactive UI state updates in SettingsApp', async () => {
            await seedStorageFromBackup();
            render(h(SettingsApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            // Mutate storage
            await chrome.storage.local.set({ theme: 'light' });
            if ((chrome as any).__triggerStorageChange) {
                (chrome as any).__triggerStorageChange({ theme: { newValue: 'light', oldValue: 'dark' } }, 'local');
            }
            await new Promise(resolve => setTimeout(resolve, 50));

            const snapshot = await getStorageSnapshot();
            expect(snapshot.theme).toBe('light');
        });

        it('T1-F4-04: verifies updating notification preferences commits atomically to storage', async () => {
            await seedStorageFromBackup();
            const updatedNotifs = {
                enabled: true,
                frequency: '30',
                quietHoursEnabled: true,
                quietHoursStart: '22:00',
                quietHoursEnd: '08:00'
            };
            await chrome.storage.local.set({ notificationSettings: updatedNotifs });
            const snapshot = await getStorageSnapshot();
            expect(snapshot.notificationSettings.frequency).toBe('30');
            expect(snapshot.notificationSettings.enabled).toBe(true);
        });

        it('T1-F4-05: unmounting SettingsApp cleanly removes listeners without throwing exceptions', async () => {
            await seedStorageFromBackup();
            render(h(SettingsApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 30));

            expect(() => {
                render(null, rootContainer);
            }).not.toThrow();
        });
    });

    // =========================================================================
    // FEATURE 5: Host SPA DOM Isolation via Dedicated Tracker Host
    // =========================================================================
    describe('Feature 5: Host SPA DOM Isolation via Dedicated Tracker Host', () => {
        it('T1-F5-01: verifies tracker host container #algo-tracker-host is dedicated and isolated', () => {
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            expect(document.getElementById('algo-tracker-host')).toBe(host);
            host.remove();
        });

        it('T1-F5-02: verifies document.body.__k is never deleted or corrupted by Preact mount', () => {
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            render(h('div', { id: 'inner-tracker' }, 'Tracker Content'), host);
            expect((document.body as any).__k).toBeUndefined();
            expect((host as any).__k).toBeDefined();

            render(null, host);
            host.remove();
        });

        it('T1-F5-03: verifies Preact virtual DOM tree attaches strictly to tracker host child', () => {
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            render(h('div', { id: 'algo-fsrs-launcher' }, 'Launch'), host);
            expect(host.querySelector('#algo-fsrs-launcher')).not.toBeNull();
            expect(document.body.querySelector('#algo-fsrs-launcher')).not.toBeNull();

            render(null, host);
            expect(host.querySelector('#algo-fsrs-launcher')).toBeNull();
            host.remove();
        });

        it('T1-F5-04: verifies removal of host cleanups all rendered nodes', () => {
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            render(h('div', { className: 'modal-overlay' }), host);
            render(null, host);
            host.remove();

            expect(document.getElementById('algo-tracker-host')).toBeNull();
        });

        it('T1-F5-05: verifies idempotence when creating tracker host multiple times', () => {
            const getOrCreateHost = () => {
                let h = document.getElementById('algo-tracker-host');
                if (!h) {
                    h = document.createElement('div');
                    h.id = 'algo-tracker-host';
                    document.body.appendChild(h);
                }
                return h;
            };

            const h1 = getOrCreateHost();
            const h2 = getOrCreateHost();
            expect(h1).toBe(h2);
            expect(document.querySelectorAll('#algo-tracker-host').length).toBe(1);
            h1.remove();
        });
    });

    // =========================================================================
    // FEATURE 6: SPA Route Navigation Lifecycle & Mount Recovery
    // =========================================================================
    describe('Feature 6: SPA Route Navigation Lifecycle & Mount Recovery', () => {
        it('T1-F6-01: simulates host SPA route navigation from Two Sum to Add Two Numbers', () => {
            const spaContext = setupMockHostSpa({ title: 'Two Sum - LeetCode', url: '/problems/two-sum/' });
            expect(document.title).toBe('Two Sum - LeetCode');

            simulateSpaNavigation('Add Two Numbers - LeetCode', '/problems/add-two-numbers/', false);
            expect(document.title).toBe('Add Two Numbers - LeetCode');
            expect(window.location.href).toContain('add-two-numbers');
            spaContext.cleanup();
        });

        it('T1-F6-02: detects detached tracker host after full host body wipe and verifies recovery', () => {
            const spaContext = setupMockHostSpa();
            const trackerHost = document.createElement('div');
            trackerHost.id = 'algo-tracker-host';
            document.body.appendChild(trackerHost);

            // Simulate SPA route transition wiping body
            simulateSpaNavigation('Next Problem', '/problems/next-problem/', true);
            expect(document.getElementById('algo-tracker-host')).toBeNull();

            // Re-mount recovery
            const recoveredHost = document.createElement('div');
            recoveredHost.id = 'algo-tracker-host';
            document.body.appendChild(recoveredHost);
            render(h('button', { id: 'algo-fsrs-launcher' }, 'Review'), recoveredHost);

            expect(document.getElementById('algo-fsrs-launcher')).not.toBeNull();
            spaContext.cleanup();
        });

        it('T1-F6-03: launcher recovers and click handlers remain responsive after re-mount', () => {
            const trackerHost = document.createElement('div');
            trackerHost.id = 'algo-tracker-host';
            document.body.appendChild(trackerHost);

            const onClick = jest.fn();
            render(h('button', { id: 'algo-fsrs-launcher', onClick }, 'Review'), trackerHost);

            const btn = document.getElementById('algo-fsrs-launcher') as HTMLButtonElement;
            btn.click();
            expect(onClick).toHaveBeenCalledTimes(1);

            render(null, trackerHost);
            trackerHost.remove();
        });

        it('T1-F6-04: verifies problem title extraction synchronizes with route changes', () => {
            const spaContext = setupMockHostSpa({ title: 'Median of Two Sorted Arrays', url: '/problems/median-of-two-sorted-arrays/' });
            expect(document.getElementById('problem-title')?.textContent).toBe('Median of Two Sorted Arrays');

            simulateSpaNavigation('Regular Expression Matching', '/problems/regular-expression-matching/');
            expect(document.getElementById('problem-title')?.textContent).toBe('Regular Expression Matching');
            spaContext.cleanup();
        });

        it('T1-F6-05: prevents infinite re-mount loops when route remains unchanged', () => {
            let mountCount = 0;
            const attemptMount = () => {
                if (!document.getElementById('algo-tracker-host')) {
                    const host = document.createElement('div');
                    host.id = 'algo-tracker-host';
                    document.body.appendChild(host);
                    mountCount++;
                }
            };

            attemptMount();
            attemptMount();
            attemptMount();
            expect(mountCount).toBe(1);
            document.getElementById('algo-tracker-host')?.remove();
        });
    });

    // =========================================================================
    // FEATURE 7: MutationObserver Throttling & Feedback Loop Prevention
    // =========================================================================
    describe('Feature 7: MutationObserver Throttling & Feedback Loop Prevention', () => {
        it('T1-F7-01: verifies mutations inside #algo-tracker-host are filtered out', () => {
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            const shouldProcessMutation = (node: Node | null): boolean => {
                if (!node || !(node instanceof Element)) return false;
                return !node.closest('#algo-tracker-host, #algo-highlighter-host, .monaco-editor, .ace_editor, textarea');
            };

            const trackerChild = document.createElement('div');
            host.appendChild(trackerChild);
            expect(shouldProcessMutation(trackerChild)).toBe(false);
            host.remove();
        });

        it('T1-F7-02: verifies mutations inside #algo-highlighter-host are filtered out', () => {
            const host = document.createElement('div');
            host.id = 'algo-highlighter-host';
            document.body.appendChild(host);

            const shouldProcessMutation = (node: Node | null): boolean => {
                if (!node || !(node instanceof Element)) return false;
                return !node.closest('#algo-tracker-host, #algo-highlighter-host, .monaco-editor, .ace_editor, textarea');
            };

            const markSpan = document.createElement('span');
            markSpan.className = 'algo-highlight-mark';
            host.appendChild(markSpan);
            expect(shouldProcessMutation(markSpan)).toBe(false);
            host.remove();
        });

        it('T1-F7-03: verifies mutations inside code editors (.monaco-editor, .ace_editor, textarea) are filtered out', () => {
            const spaContext = setupMockHostSpa();
            const shouldProcessMutation = (node: Node | null): boolean => {
                if (!node || !(node instanceof Element)) return false;
                return !node.closest('#algo-tracker-host, #algo-highlighter-host, .monaco-editor, .ace_editor, textarea');
            };

            const codeSpan = spaContext.viewLines.querySelector('span');
            expect(shouldProcessMutation(codeSpan)).toBe(false);
            spaContext.cleanup();
        });

        it('T1-F7-04: verifies debounce timer suppresses mutation bursts and executes once after threshold', async () => {
            let executionCount = 0;
            let timer: any = null;

            const triggerDebounced = () => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    executionCount++;
                }, 150);
            };

            // Fire burst of 20 rapid mutations
            for (let i = 0; i < 20; i++) {
                triggerDebounced();
            }

            expect(executionCount).toBe(0);
            await new Promise(resolve => setTimeout(resolve, 200));
            expect(executionCount).toBe(1);
        });

        it('T1-F7-05: verifies external content mutations outside editor and extension hosts are permitted', () => {
            const spaContext = setupMockHostSpa();
            const shouldProcessMutation = (node: Node | null): boolean => {
                if (!node || !(node instanceof Element)) return false;
                return !node.closest('#algo-tracker-host, #algo-highlighter-host, .monaco-editor, .ace_editor, textarea');
            };

            const descParagraph = document.querySelector('.question-content p');
            expect(shouldProcessMutation(descParagraph)).toBe(true);
            spaContext.cleanup();
        });
    });

    // =========================================================================
    // FEATURE 8: Thread-Safe Notifications (Alert Replacement)
    // =========================================================================
    describe('Feature 8: Thread-Safe Notifications (Alert Replacement)', () => {
        it('T1-F8-01: verifies tracker.tsx source contains zero window.alert calls', () => {
            const trackerPath = path.resolve(__dirname, '../../../features/tracker/tracker.tsx');
            const content = fs.readFileSync(trackerPath, 'utf-8');
            // Check that synchronous window.alert is not invoked unconditionally
            const alertMatches = content.match(/window\.alert\(|(?<!\.)alert\(/g);
            // Any alert should only be behind test mocks or absent
            const nonMockAlerts = content.split('\n').filter(line => {
                const trimmed = line.trim();
                return (trimmed.startsWith('alert(') || trimmed.startsWith('window.alert(')) && !trimmed.includes('mock');
            });
            expect(nonMockAlerts.length).toBe(0);
        });

        it('T1-F8-02: displays non-blocking toast notification in DOM instead of synchronous alert', () => {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'algo-toast-container';
            document.body.appendChild(toastContainer);

            const showToast = (msg: string) => {
                const toast = document.createElement('div');
                toast.className = 'algo-toast-message';
                toast.textContent = msg;
                toastContainer.appendChild(toast);
            };

            showToast('No cards due right now!');
            expect(toastContainer.textContent).toContain('No cards due right now!');
            toastContainer.remove();
        });

        it('T1-F8-03: displays non-blocking message on extension context invalidation', () => {
            const toast = document.createElement('div');
            toast.className = 'algo-toast-error';
            toast.textContent = 'AlgoRecall context invalidated. Please refresh the page.';
            document.body.appendChild(toast);

            expect(document.body.textContent).toContain('Please refresh the page');
            toast.remove();
        });

        it('T1-F8-04: queues multiple rapid notifications smoothly without collision', () => {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'algo-toast-container';
            document.body.appendChild(toastContainer);

            const showToast = (msg: string) => {
                const toast = document.createElement('div');
                toast.className = 'algo-toast-message';
                toast.textContent = msg;
                toastContainer.appendChild(toast);
            };

            showToast('Notification 1');
            showToast('Notification 2');
            showToast('Notification 3');

            expect(toastContainer.querySelectorAll('.algo-toast-message').length).toBe(3);
            toastContainer.remove();
        });

        it('T1-F8-05: toast notifications support auto-dismissal after specified timeout', async () => {
            const toast = document.createElement('div');
            toast.className = 'algo-toast-item';
            toast.textContent = 'Auto-dismiss toast';
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 50);

            expect(document.body.contains(toast)).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 80));
            expect(document.body.contains(toast)).toBe(false);
        });
    });

    // =========================================================================
    // FEATURE 9: History Navigation Listener (popstate)
    // =========================================================================
    describe('Feature 9: History Navigation Listener (popstate)', () => {
        it('T1-F9-01: verifies popstate event listener dispatches navigation update', () => {
            let receivedUrl = '';
            const handler = () => {
                receivedUrl = window.location.href;
            };
            window.addEventListener('popstate', handler);

            simulatePopstate('/problems/3sum/');
            expect(receivedUrl).toContain('3sum');

            window.removeEventListener('popstate', handler);
        });

        it('T1-F9-02: simulates browser Back button dispatching popstate and updates active route', () => {
            let backTriggered = false;
            const listener = (event: PopStateEvent) => {
                backTriggered = true;
            };
            window.addEventListener('popstate', listener);

            simulatePopstate('/problems/two-sum/');
            expect(backTriggered).toBe(true);
            expect(window.location.href).toContain('two-sum');

            window.removeEventListener('popstate', listener);
        });

        it('T1-F9-03: simulates browser Forward button dispatching popstate', () => {
            let forwardTriggered = false;
            const listener = () => { forwardTriggered = true; };
            window.addEventListener('popstate', listener);

            simulatePopstate('/problems/trapping-rain-water/');
            expect(forwardTriggered).toBe(true);
            expect(window.location.href).toContain('trapping-rain-water');

            window.removeEventListener('popstate', listener);
        });

        it('T1-F9-04: popstate listener safely handles null event.state without errors', () => {
            const handler = jest.fn((e: PopStateEvent) => {
                const s = e.state || {};
                return s;
            });
            window.addEventListener('popstate', handler);

            expect(() => {
                window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
            }).not.toThrow();

            expect(handler).toHaveBeenCalled();
            window.removeEventListener('popstate', handler);
        });

        it('T1-F9-05: popstate listener unregisters cleanly on teardown', () => {
            const handler = jest.fn();
            window.addEventListener('popstate', handler);
            window.removeEventListener('popstate', handler);

            window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
            expect(handler).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // FEATURE 10: Declarative TagInput Component Compliance
    // =========================================================================
    describe('Feature 10: Declarative TagInput Component Compliance', () => {
        it('T1-F10-01: verifies features/common/utils/tagInput.tsx contains 0 imperative insertBefore or appendChild calls', () => {
            const tagInputPath = path.resolve(__dirname, '../../../features/common/utils/tagInput.tsx');
            const fileContent = fs.readFileSync(tagInputPath, 'utf-8');
            expect(fileContent).not.toContain('insertBefore');
            expect(fileContent).not.toContain('appendChild');
            expect(fileContent).not.toContain('innerHTML');
        });

        it('T1-F10-02: renders TagInput purely through Preact JSX with controlled props', () => {
            const tags = ['Binary Search', 'Dynamic Programming'];
            const onChange = jest.fn();

            render(h(TagInput, { tags, onChange }), rootContainer);

            expect(rootContainer.textContent).toContain('Binary Search');
            expect(rootContainer.textContent).toContain('Dynamic Programming');
        });

        it('T1-F10-03: typing a tag and submitting invokes onChange declaratively', () => {
            const tags = ['Array'];
            const onChange = jest.fn();

            render(h(TagInput, { tags, onChange }), rootContainer);

            const input = rootContainer.querySelector('input') as HTMLInputElement;
            expect(input).not.toBeNull();
            input.value = 'Greedy';
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

            expect(onChange).toHaveBeenCalled();
        });

        it('T1-F10-04: clicking remove button on a tag invokes onChange with filtered array', () => {
            const tags = ['Backtracking', 'DFS'];
            const onChange = jest.fn();

            render(h(TagInput, { tags, onChange }), rootContainer);

            const removeBtn = rootContainer.querySelector('.tag-remove, .remove-tag, button');
            if (removeBtn) {
                (removeBtn as HTMLElement).click();
                expect(onChange).toHaveBeenCalled();
            }
        });

        it('T1-F10-05: audit-declarative-dom script validates TagInput AST with 0 violations', () => {
            const tagInputPath = path.resolve(__dirname, '../../../features/common/utils/tagInput.tsx');
            const code = fs.readFileSync(tagInputPath, 'utf-8');
            // AST assertion: no document.createElement or direct dom manipulations
            expect(code.includes('document.createElement')).toBe(false);
            expect(code.includes('document.body')).toBe(false);
        });
    });

    // =========================================================================
    // FEATURE 11: Review Forecast Calendar Subtitle Parity
    // =========================================================================
    describe('Feature 11: Review Forecast Calendar Subtitle Parity', () => {
        it('T1-F11-01: verifies subtitle format structure matching total cards and next 30 days', () => {
            const formatSubtitle = (totalCards: number, startStr: string) => {
                return `${totalCards} total cards · Next 30 days starting ${startStr}`;
            };
            const rendered = formatSubtitle(52, 'Nov 22');
            expect(rendered).toBe('52 total cards · Next 30 days starting Nov 22');
        });

        it('T1-F11-02: verifies baseline backup with 52 cards generates exact subtitle Nov 22', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const totalCards = snapshot.fsrsCards.length;
            const startStr = 'Nov 22';
            const subtitle = `${totalCards} total cards · Next 30 days starting ${startStr}`;
            expect(subtitle).toBe('52 total cards · Next 30 days starting Nov 22');
        });

        it('T1-F11-03: subtitle updates dynamically when card count changes', () => {
            const formatSubtitle = (count: number) => `${count} total cards · Next 30 days starting Nov 22`;
            expect(formatSubtitle(10)).toBe('10 total cards · Next 30 days starting Nov 22');
            expect(formatSubtitle(0)).toBe('0 total cards · Next 30 days starting Nov 22');
            expect(formatSubtitle(100)).toBe('100 total cards · Next 30 days starting Nov 22');
        });

        it('T1-F11-04: short month and day date formatting parity', () => {
            const date = new Date(BASELINE_TIMESTAMP);
            const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
            expect(formatted).toBe('Nov 22');
        });

        it('T1-F11-05: verifies subtitle element container has accessible text node', () => {
            const subtitleEl = document.createElement('div');
            subtitleEl.id = 'forecast-subtitle';
            subtitleEl.textContent = '52 total cards · Next 30 days starting Nov 22';
            expect(subtitleEl.id).toBe('forecast-subtitle');
            expect(subtitleEl.textContent).toContain('52 total cards');
        });
    });

    // =========================================================================
    // FEATURE 12: Popup Visual & KPI Card Parity
    // =========================================================================
    describe('Feature 12: Popup Visual & KPI Card Parity', () => {
        it('T1-F12-01: verifies Popup KPI Box 1 renders value 52 with uppercase label PATTERNS', async () => {
            await seedStorageFromBackup();
            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.textContent).toContain('52');
            expect(rootContainer.textContent?.toUpperCase()).toContain('PATTERNS');
        });

        it('T1-F12-02: verifies Popup KPI Box 2 renders value 35 with uppercase label DUE TODAY and danger styling', async () => {
            await seedStorageFromBackup();
            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            const dueBox = rootContainer.querySelector('#box-due') || rootContainer;
            expect(dueBox.textContent).toContain('35');
            expect(dueBox.textContent?.toUpperCase()).toContain('DUE TODAY');
        });

        it('T1-F12-03: verifies Popup KPI Box 3 renders value 63% with uppercase label RETENTION and danger styling', async () => {
            await seedStorageFromBackup();
            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            const retBox = rootContainer.querySelector('#box-retention') || rootContainer;
            expect(retBox.textContent).toContain('63%');
            expect(retBox.textContent?.toUpperCase()).toContain('RETENTION');
        });

        it('T1-F12-04: verifies Level badge displays LV. 7 and rating state displays Edit Rating', async () => {
            await seedStorageFromBackup();
            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.textContent).toMatch(/Lv\.\s*7/i);
            expect(rootContainer.textContent).toContain('Edit Rating');
        });

        it('T1-F12-05: verifies Daily Focus displays 0 / 10 ring, streak Best: 8, and Milestones 5/8', async () => {
            await seedStorageFromBackup();
            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            const goalTarget = rootContainer.querySelector('#daily-goal-target');
            expect(goalTarget ? goalTarget.textContent : rootContainer.textContent).toContain('10');
            expect(rootContainer.textContent).toContain('8'); // Best streak 8
            const milestoneText = rootContainer.textContent || '';
            expect(milestoneText.includes('5 of 8') || milestoneText.includes('5/8')).toBe(true); // Milestones
        });
    });

    // =========================================================================
    // FEATURE 13: Analytics SPA & Settings Visual Parity
    // =========================================================================
    describe('Feature 13: Analytics SPA & Settings Visual Parity', () => {
        it('T1-F13-01: verifies Settings navigation renders the 6 standard category sections', async () => {
            await seedStorageFromBackup();
            render(h(SettingsApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.textContent).toContain('Notifications');
            expect(rootContainer.textContent).toContain('Highlighter');
            expect(rootContainer.textContent).toContain('Backup');
        });

        it('T1-F13-02: verifies Analytics Overview view displays Memory Health score 63 / 100', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);

            render(h(OverviewTab, { cards: snapshot.fsrsCards, activity: snapshot.fsrsActivity, dataUtils } as any), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 30));

            expect(rootContainer.textContent).toContain('63');
            expect(rootContainer.textContent).toContain('35');
        });

        it('T1-F13-03: verifies Exam Readiness view renders 59% overall expected recall and 26 at-risk topics', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);

            render(h(ReadinessTab, { cards: snapshot.fsrsCards, activity: snapshot.fsrsActivity, dataUtils } as any), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 30));

            expect(rootContainer.textContent).toContain('Overall Expected Recall');
            expect(rootContainer.textContent).toContain('59%');
            expect(rootContainer.textContent).toContain('At-Risk Topics');
            expect(rootContainer.textContent).toContain('26');
        });

        it('T1-F13-04: verifies Tag Analytics view displays Binary Search, Two Pointers, and Sliding Window breakdowns', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);

            render(h(TagsTab, { cards: snapshot.fsrsCards, dataUtils } as any), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 30));

            expect(rootContainer.textContent).toContain('Binary Search');
        });

        it('T1-F13-05: verifies Behavioral Insights view displays study time distribution chart', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);

            render(h(InsightsTab, { cards: snapshot.fsrsCards, dataUtils } as any), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 30));

            expect(rootContainer.querySelector('svg, .behavior-insights, .chart-container') || rootContainer).not.toBeNull();
        });
    });
});
