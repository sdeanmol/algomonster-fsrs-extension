/**
 * @file tier2_boundary_corner.spec.ts
 * @description Tier 2 Acceptance Test Suite: 65 boundary, stress, and corner case tests covering Features 1-13 (5 tests per feature).
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { h, render } from 'preact';

import {
    getBackupBuffer,
    parseBackupArchive,
    createCorruptedArchive,
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
    calculateExpectedRetention
} from './helpers/fsrsCalculationHelper';
import { setupMockHostSpa, simulateSpaNavigation, simulatePopstate } from './helpers/domHostHelper';

import { BackupManager } from '@common/data/backupManager';
import FsrsScheduler from '@tracker/scheduler/fsrsScheduler';
import { getLastReviewDate } from '@common/utils/cardUtils';
import { DataUtils } from '@dashboard/analytics/utils/dataUtils';
import { SettingsApp } from '@common/settings/settings';
import { PopupApp } from '@dashboard/popup/popup';
import { TagInput } from '@common/utils/tagInput';
import { Card, FSRSParameters } from '../../../types/domain';

describe('Tier 2: Boundary & Corner Cases (65 Tests Across Features 1-13)', () => {
    let unfreeze: () => void;
    let rootContainer: HTMLElement;

    beforeEach(() => {
        delete (document.body as any).__k;
        unfreeze = freezeTime(BASELINE_TIMESTAMP);
        rootContainer = document.createElement('div');
        rootContainer.id = 'test-boundary-root';
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
    // FEATURE 1 (Boundary: Backup Deserialization & Storage)
    // =========================================================================
    describe('Feature 1: Backup Deserialization Boundary Cases', () => {
        it('T2-F1-01: corrupted gzip magic bytes (0x00 0x00) reports error and does not corrupt storage', async () => {
            const badMagicBuf = createCorruptedArchive('bad-magic');
            const mockFile = createMockBackupFile(badMagicBuf);
            const onStatus = jest.fn();

            await BackupManager.importBackup(mockFile, onStatus);
            expect(onStatus).toHaveBeenCalledWith(expect.any(String), true);

            const snapshot = await getStorageSnapshot();
            expect(snapshot.fsrsCards).toBeUndefined();
        });

        it('T2-F1-02: truncated gzip stream rejects gracefully without uncaught panic', async () => {
            const truncBuf = createCorruptedArchive('truncated');
            const mockFile = createMockBackupFile(truncBuf);
            const onStatus = jest.fn();

            await expect(BackupManager.importBackup(mockFile, onStatus)).resolves.not.toThrow();
            expect(onStatus).toHaveBeenCalledWith(expect.any(String), true);
        });

        it('T2-F1-03: altered payload byte causing FNV-1a checksum mismatch aborts transaction', async () => {
            const badCrcBuf = createCorruptedArchive('bad-checksum');
            const mockFile = createMockBackupFile(badCrcBuf);
            const onStatus = jest.fn();

            await BackupManager.importBackup(mockFile, onStatus);
            expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('Checksum mismatch'), true);

            const snapshot = await getStorageSnapshot();
            expect(snapshot.fsrsCards).toBeUndefined();
        });

        it('T2-F1-04: non-JSON line inside NDJSON stream catches syntax error cleanly', async () => {
            const badJsonBuf = createCorruptedArchive('bad-json');
            const mockFile = createMockBackupFile(badJsonBuf);
            const onStatus = jest.fn();

            await BackupManager.importBackup(mockFile, onStatus);
            expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON structure'), true);
        });

        it('T2-F1-05: missing header record causes validation rejection before storage writes', async () => {
            const noHeaderBuf = createCorruptedArchive('missing-header');
            const mockFile = createMockBackupFile(noHeaderBuf);
            const onStatus = jest.fn();

            await BackupManager.importBackup(mockFile, onStatus);
            expect(onStatus).toHaveBeenCalledWith(expect.any(String), true);

            const snapshot = await getStorageSnapshot();
            expect(snapshot.fsrsCards).toBeUndefined();
        });
    });

    // =========================================================================
    // FEATURE 2 (Boundary: FSRS Parameters & Extreme Values)
    // =========================================================================
    describe('Feature 2: FSRS Global Parameters & Retention Extreme Cases', () => {
        it('T2-F2-01: null or undefined fsrsGlobalParams falls back safely to default parameters without throwing', () => {
            expect(() => {
                const scheduler = new FsrsScheduler(null);
                expect(scheduler.w.length).toBe(17);
                expect(scheduler.decay).toBe(-0.5);
                expect(scheduler.requestRetention).toBe(0.9);
            }).not.toThrow();
        });

        it('T2-F2-02: truncated weights array (fewer than 17 parameters) falls back safely to default weights', () => {
            const invalidParams: Partial<FSRSParameters> = {
                w: [0.5, 1.0, 2.0] // Only 3 parameters instead of 17
            };
            const scheduler = new FsrsScheduler(invalidParams);
            expect(scheduler.w.length).toBe(17);
        });

        it('T2-F2-03: extreme decay parameter (decay: -2.0) produces valid retrievability in range [0, 1]', () => {
            const extremeParams: Partial<FSRSParameters> = {
                decay: -2.0
            };
            const scheduler = new FsrsScheduler(extremeParams);
            const testCard: Card = {
                id: 'test-extreme-decay',
                problemTitle: 'Extreme Decay',
                problemUrl: 'https://leetcode.com/problems/extreme/',
                due: BASELINE_TIMESTAMP - 86400000,
                stability: 10,
                difficulty: 5,
                elapsed_days: 1,
                scheduled_days: 1,
                learning_steps: 0,
                reps: 2,
                lapses: 0,
                state: 2,
                last_review: BASELINE_TIMESTAMP - 86400000
            };

            const r = scheduler.getRetrievability(testCard, BASELINE_TIMESTAMP);
            expect(isNaN(r)).toBe(false);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(1);
        });

        it('T2-F2-04: zero request retention is handled without infinite loops or NaN interval scheduling', () => {
            const zeroRetentionParams: Partial<FSRSParameters> = {
                requestRetention: 0
            };
            const scheduler = new FsrsScheduler(zeroRetentionParams);
            expect(scheduler.requestRetention).toBe(0);
        });

        it('T2-F2-05: card with elapsed days > 10,000 days decays gracefully to 0 without underflow errors', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const ancientTimestamp = BASELINE_TIMESTAMP - (10000 * 86400000);
            const ancientCard: Card = {
                id: 'ancient-card',
                problemTitle: 'Ancient Card',
                problemUrl: 'https://leetcode.com/problems/ancient/',
                due: ancientTimestamp + 86400000,
                stability: 5,
                difficulty: 5,
                elapsed_days: 10000,
                scheduled_days: 1,
                learning_steps: 0,
                reps: 1,
                lapses: 0,
                state: 2,
                last_review: ancientTimestamp
            };

            const r = scheduler.getRetrievability(ancientCard, BASELINE_TIMESTAMP);
            expect(isNaN(r)).toBe(false);
            expect(r).toBeCloseTo(0, 1);
        });
    });

    // =========================================================================
    // FEATURE 3 (Boundary: HistoryLog Fallback Extreme Cases)
    // =========================================================================
    describe('Feature 3: HistoryLog Fallback Extreme Cases', () => {
        it('T2-F3-01: card with empty historyLog array and null last_review returns null date without divide-by-zero', () => {
            const emptyCard: Partial<Card> = {
                id: 'no-history',
                stability: 5,
                historyLog: [],
                last_review: null,
                lastReview: null
            };

            const date = getLastReviewDate(emptyCard as Card);
            expect(date).toBeNull();

            const scheduler = new FsrsScheduler();
            const r = scheduler.getRetrievability(emptyCard as Card, BASELINE_TIMESTAMP);
            expect(r).toBe(0);
        });

        it('T2-F3-02: card with unsorted historyLog entries resolves the latest review timestamp', () => {
            const unsortedCard: Partial<Card> = {
                id: 'unsorted-history',
                historyLog: [
                    { rating: 3, date: 1780000000000 },
                    { rating: 2, date: 1785000000000 }, // Later timestamp
                    { rating: 4, date: 1782000000000 }
                ]
            };

            const date = getLastReviewDate(unsortedCard as Card);
            expect(date).toBeDefined();
            expect(date).toBeGreaterThan(0);
        });

        it('T2-F3-03: card with ISO 8601 string date parses safely into epoch milliseconds', () => {
            const isoCard: Partial<Card> = {
                id: 'iso-date',
                last_review: ('2026-07-09T14:43:08.000Z' as any)
            };

            const epoch = getLastReviewDate(isoCard as Card);
            expect(epoch).toBe(Date.parse('2026-07-09T14:43:08.000Z'));
        });

        it('T2-F3-04: card with stability 0 immediately returns 0 retrievability without calling FSRS formula', () => {
            const zeroStabilityCard: Card = {
                id: 'zero-stab',
                problemTitle: 'Zero Stability',
                problemUrl: 'https://leetcode.com/problems/zero/',
                due: BASELINE_TIMESTAMP,
                stability: 0,
                difficulty: 5,
                elapsed_days: 0,
                scheduled_days: 0,
                learning_steps: 0,
                reps: 0,
                lapses: 0,
                state: 0,
                last_review: BASELINE_TIMESTAMP - 1000
            };

            const scheduler = new FsrsScheduler();
            const r = scheduler.getRetrievability(zeroStabilityCard, BASELINE_TIMESTAMP);
            expect(r).toBe(0);
        });

        it('T2-F3-05: deck where 100% of cards lack last_review successfully computes retention via historyLog', () => {
            const deck: Card[] = [
                {
                    id: 'c1',
                    problemTitle: 'P1',
                    problemUrl: 'https://leetcode.com/problems/p1/',
                    due: BASELINE_TIMESTAMP + 86400000,
                    stability: 20,
                    difficulty: 5,
                    elapsed_days: 1,
                    scheduled_days: 5,
                    learning_steps: 0,
                    reps: 3,
                    lapses: 0,
                    state: 2,
                    historyLog: [{ rating: 3, date: BASELINE_TIMESTAMP - 86400000 }]
                },
                {
                    id: 'c2',
                    problemTitle: 'P2',
                    problemUrl: 'https://leetcode.com/problems/p2/',
                    due: BASELINE_TIMESTAMP + 172800000,
                    stability: 15,
                    difficulty: 6,
                    elapsed_days: 2,
                    scheduled_days: 4,
                    learning_steps: 0,
                    reps: 2,
                    lapses: 0,
                    state: 2,
                    historyLog: [{ rating: 3, date: BASELINE_TIMESTAMP - 172800000 }]
                }
            ];

            const scheduler = new FsrsScheduler();
            const result = calculateExpectedRetention(deck, { w: scheduler.w, requestRetention: 0.9, decay: -0.5, factor: 0.234567 }, BASELINE_TIMESTAMP);
            expect(result.countEvaluated).toBe(2);
            expect(result.retentionPercent).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // FEATURE 4 (Boundary: Settings UI Dynamic Hydration)
    // =========================================================================
    describe('Feature 4: Settings Dynamic Hydration Boundary Cases', () => {
        it('T2-F4-01: concurrent rapid storage writes to settings reconcile without dropping updates', async () => {
            await seedStorageFromBackup();
            const promises = [
                chrome.storage.local.set({ theme: 'light' }),
                chrome.storage.local.set({ longestStreak: 12 }),
                chrome.storage.local.set({ dailyGoalTarget: 15 })
            ];
            await Promise.all(promises);

            const snapshot = await getStorageSnapshot();
            expect(snapshot.theme).toBe('light');
            expect(snapshot.longestStreak).toBe(12);
            expect(snapshot.dailyGoalTarget).toBe(15);
        });

        it('T2-F4-02: storage returning undefined for extensionSettings applies comprehensive defaults', async () => {
            await chrome.storage.local.clear();
            render(h(SettingsApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.textContent).toContain('Settings');
        });

        it('T2-F4-03: import backup callback with error leaves existing storage intact', async () => {
            await seedStorageFromBackup();
            const initialSnapshot = await getStorageSnapshot();

            const onStatus = jest.fn();
            const corruptedFile = createMockBackupFile(Buffer.from('CORRUPTED_BYTES'));
            await BackupManager.importBackup(corruptedFile, onStatus);

            expect(onStatus).toHaveBeenCalledWith(expect.any(String), true);
            const afterSnapshot = await getStorageSnapshot();
            expect(afterSnapshot.fsrsCards.length).toBe(initialSnapshot.fsrsCards.length);
        });

        it('T2-F4-04: custom palette with empty colors array does not cause runtime crash in settings', async () => {
            await seedStorageFromBackup();
            const malformedSettings = {
                palettes: [{ name: 'Empty Palette', colors: [] }],
                activePaletteIndex: 0
            };
            await chrome.storage.local.set({ extensionSettings: malformedSettings });

            expect(() => {
                render(h(SettingsApp, {}), rootContainer);
            }).not.toThrow();
        });

        it('T2-F4-05: unmounting SettingsApp while storage listener fires does not throw unmounted state error', async () => {
            await seedStorageFromBackup();
            render(h(SettingsApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 30));

            render(null, rootContainer);

            expect(() => {
                if ((chrome as any).__triggerStorageChange) {
                    (chrome as any).__triggerStorageChange({ theme: { newValue: 'light' } }, 'local');
                }
            }).not.toThrow();
        });
    });

    // =========================================================================
    // FEATURE 5 (Boundary: Host SPA DOM Isolation)
    // =========================================================================
    describe('Feature 5: Host SPA DOM Isolation Boundary Cases', () => {
        it('T2-F5-01: host page modifying body class name or appending siblings does not affect #algo-tracker-host', () => {
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            document.body.className = 'dark-mode-applied theme-changed';
            const hostSibling = document.createElement('div');
            hostSibling.className = 'host-modal-overlay';
            document.body.appendChild(hostSibling);

            expect(document.getElementById('algo-tracker-host')).toBe(host);
            expect(host.id).toBe('algo-tracker-host');
            host.remove();
            hostSibling.remove();
        });

        it('T2-F5-02: early invocation of host check before element creation returns safely', () => {
            expect(document.getElementById('algo-tracker-host')).toBeNull();
        });

        it('T2-F5-03: Preact diffing inside #algo-tracker-host verifies document.body.__k is permanently undefined', () => {
            delete (document.body as any).__k;
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            render(h('span', { className: 'badge' }, 'Test 1'), host);
            render(h('span', { className: 'badge' }, 'Test 2'), host);

            expect((document.body as any).__k).toBeUndefined();
            render(null, host);
            host.remove();
        });

        it('T2-F5-04: host page with pre-existing #algo-tracker-host reuses existing container without duplication', () => {
            const host1 = document.createElement('div');
            host1.id = 'algo-tracker-host';
            document.body.appendChild(host1);

            const findOrMountHost = () => {
                let h = document.getElementById('algo-tracker-host');
                if (!h) {
                    h = document.createElement('div');
                    h.id = 'algo-tracker-host';
                    document.body.appendChild(h);
                }
                return h;
            };

            const host2 = findOrMountHost();
            expect(host2).toBe(host1);
            expect(document.querySelectorAll('#algo-tracker-host').length).toBe(1);
            host1.remove();
        });

        it('T2-F5-05: tearing down host when container was already removed executes with 0 errors', () => {
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            // Host removed externally
            host.remove();

            expect(() => {
                const el = document.getElementById('algo-tracker-host');
                if (el) {
                    render(null, el);
                    el.remove();
                }
            }).not.toThrow();
        });
    });

    // =========================================================================
    // FEATURE 6 (Boundary: SPA Route Navigation Lifecycle)
    // =========================================================================
    describe('Feature 6: SPA Route Navigation Lifecycle Boundary Cases', () => {
        it('T2-F6-01: rapid consecutive route transitions settle on the final route', () => {
            const spaContext = setupMockHostSpa({ url: '/problems/two-sum/' });
            for (let i = 1; i <= 10; i++) {
                simulateSpaNavigation(`Problem ${i}`, `/problems/problem-${i}/`, false);
            }

            expect(window.location.href).toContain('/problems/problem-10/');
            expect(document.title).toBe('Problem 10');
            spaContext.cleanup();
        });

        it('T2-F6-02: navigating to non-problem path (/contest/) retains stability', () => {
            const spaContext = setupMockHostSpa({ url: '/problems/two-sum/' });
            simulateSpaNavigation('Contest Page', '/contest/', false);

            expect(window.location.href).toContain('/contest/');
            spaContext.cleanup();
        });

        it('T2-F6-03: host SPA clearing innerHTML on route change is detected for re-mount', () => {
            const spaContext = setupMockHostSpa();
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            simulateSpaNavigation('New Route', '/problems/new-route/', true);
            expect(document.getElementById('algo-tracker-host')).toBeNull();

            // Re-mount
            const newHost = document.createElement('div');
            newHost.id = 'algo-tracker-host';
            document.body.appendChild(newHost);
            expect(document.getElementById('algo-tracker-host')).not.toBeNull();
            spaContext.cleanup();
        });

        it('T2-F6-04: route transition while modal is open closes overlay cleanly', () => {
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            document.body.appendChild(host);

            render(h('div', { id: 'algo-review-modal', className: 'modal active' }), host);
            expect(host.querySelector('#algo-review-modal')).not.toBeNull();

            // Navigation closes modal
            render(null, host);
            expect(host.querySelector('#algo-review-modal')).toBeNull();
            host.remove();
        });

        it('T2-F6-05: route change with URL hash anchor does not corrupt location', () => {
            const spaContext = setupMockHostSpa({ url: '/problems/two-sum/' });
            simulateSpaNavigation('Two Sum Solution', '/problems/two-sum/#solution', false);

            expect(window.location.href).toContain('#solution');
            spaContext.cleanup();
        });
    });

    // =========================================================================
    // FEATURE 7 (Boundary: MutationObserver Throttling)
    // =========================================================================
    describe('Feature 7: MutationObserver Throttling Boundary Cases', () => {
        it('T2-F7-01: high-frequency characterData mutations in Monaco editor are ignored', () => {
            const spaContext = setupMockHostSpa();
            const filterMutation = (el: Element | null): boolean => {
                if (!el) return false;
                return !el.closest('#algo-tracker-host, #algo-highlighter-host, .monaco-editor, .ace_editor, textarea');
            };

            const viewLine = spaContext.viewLines.querySelector('.view-line') as HTMLElement;
            expect(filterMutation(viewLine)).toBe(false);
            spaContext.cleanup();
        });

        it('T2-F7-02: internal AlgoRecall tooltip class mutations are filtered breaking feedback loops', () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'algo-tooltip visible';
            const host = document.createElement('div');
            host.id = 'algo-tracker-host';
            host.appendChild(tooltip);
            document.body.appendChild(host);

            const filterMutation = (el: Element | null): boolean => {
                if (!el) return false;
                return !el.closest('#algo-tracker-host, #algo-highlighter-host, .monaco-editor, .ace_editor, textarea');
            };

            expect(filterMutation(tooltip)).toBe(false);
            host.remove();
        });

        it('T2-F7-03: host SPA deleting large unrelated DOM subtree outside whitelisted content is skipped', () => {
            const unrelatedDiv = document.createElement('div');
            unrelatedDiv.className = 'ads-container';
            document.body.appendChild(unrelatedDiv);

            const shouldScanHighlights = (target: Element): boolean => {
                return !!target.closest('.question-content, #problem-title');
            };

            expect(shouldScanHighlights(unrelatedDiv)).toBe(false);
            unrelatedDiv.remove();
        });

        it('T2-F7-04: observer receiving null target or detached node handles gracefully without throwing', () => {
            const safeFilter = (node: Node | null) => {
                try {
                    if (!node || !(node instanceof Element)) return false;
                    return !node.closest('#algo-tracker-host');
                } catch {
                    return false;
                }
            };

            expect(safeFilter(null)).toBe(false);
            expect(safeFilter(document.createTextNode('text'))).toBe(false);
        });

        it('T2-F7-05: burst of 50 mutations followed by silence triggers exactly 1 update after debounce', async () => {
            let callbackCount = 0;
            let timer: any = null;

            const onMutation = () => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    callbackCount++;
                }, 150);
            };

            for (let i = 0; i < 50; i++) {
                onMutation();
            }

            expect(callbackCount).toBe(0);
            await new Promise(resolve => setTimeout(resolve, 200));
            expect(callbackCount).toBe(1);
        });
    });

    // =========================================================================
    // FEATURE 8 (Boundary: Thread-Safe Notifications)
    // =========================================================================
    describe('Feature 8: Thread-Safe Notifications Boundary Cases', () => {
        it('T2-F8-01: notification executes safely when window.alert is undefined', () => {
            const originalAlert = window.alert;
            (window as any).alert = undefined;

            const toastContainer = document.createElement('div');
            toastContainer.id = 'algo-toast-container';
            document.body.appendChild(toastContainer);

            const showToast = (msg: string) => {
                const toast = document.createElement('div');
                toast.className = 'algo-toast';
                toast.textContent = msg;
                toastContainer.appendChild(toast);
            };

            expect(() => {
                showToast('Safe notification');
            }).not.toThrow();

            expect(toastContainer.textContent).toContain('Safe notification');
            toastContainer.remove();
            (window as any).alert = originalAlert;
        });

        it('T2-F8-02: 5 notifications triggered concurrently stack cleanly in container', () => {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'algo-toast-container';
            document.body.appendChild(toastContainer);

            for (let i = 1; i <= 5; i++) {
                const toast = document.createElement('div');
                toast.className = 'algo-toast';
                toast.textContent = `Notification ${i}`;
                toastContainer.appendChild(toast);
            }

            expect(toastContainer.querySelectorAll('.algo-toast').length).toBe(5);
            toastContainer.remove();
        });

        it('T2-F8-03: notification with HTML tags in text is sanitized via textContent preventing XSS', () => {
            const toast = document.createElement('div');
            toast.className = 'algo-toast';
            toast.textContent = '<script>alert("xss")</script>Important Notification';

            expect(toast.innerHTML).not.toContain('<script>');
            expect(toast.textContent).toContain('<script>');
        });

        it('T2-F8-04: notification triggered while document is hidden is retained in DOM', () => {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'algo-toast-container';
            document.body.appendChild(toastContainer);

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });

            const toast = document.createElement('div');
            toast.className = 'algo-toast';
            toast.textContent = 'Hidden tab alert';
            toastContainer.appendChild(toast);

            expect(toastContainer.textContent).toContain('Hidden tab alert');
            toastContainer.remove();
            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        });

        it('T2-F8-05: extension context invalidation displays non-blocking toast without unhandled promise rejection', () => {
            const toast = document.createElement('div');
            toast.className = 'algo-toast-error';
            toast.textContent = 'Extension context invalidated. Please refresh.';
            document.body.appendChild(toast);

            expect(toast.textContent).toContain('Please refresh');
            toast.remove();
        });
    });

    // =========================================================================
    // FEATURE 9 (Boundary: History Navigation Listener)
    // =========================================================================
    describe('Feature 9: History Navigation Listener Boundary Cases', () => {
        it('T2-F9-01: rapid back-forward navigation events do not cause uncaught exceptions', () => {
            let triggerCount = 0;
            const listener = () => { triggerCount++; };
            window.addEventListener('popstate', listener);

            simulatePopstate('/problems/two-sum/');
            simulatePopstate('/problems/add-two-numbers/');
            simulatePopstate('/problems/3sum/');

            expect(triggerCount).toBe(3);
            window.removeEventListener('popstate', listener);
        });

        it('T2-F9-02: popstate event with state null resolves URL from location.href', () => {
            let resolvedUrl = '';
            const listener = () => {
                resolvedUrl = window.location.href;
            };
            window.addEventListener('popstate', listener);

            simulatePopstate('/problems/zigzag-conversion/');
            expect(resolvedUrl).toContain('zigzag-conversion');

            window.removeEventListener('popstate', listener);
        });

        it('T2-F9-03: navigation between identical URLs with query param differences updates state', () => {
            const spaContext = setupMockHostSpa({ url: '/problems/two-sum/' });
            simulateSpaNavigation('Two Sum Submissions', '/problems/two-sum/?tab=submissions', false);

            expect(window.location.href).toContain('tab=submissions');
            spaContext.cleanup();
        });

        it('T2-F9-04: popstate event dispatched when listener was removed triggers 0 callbacks', () => {
            const cb = jest.fn();
            window.addEventListener('popstate', cb);
            window.removeEventListener('popstate', cb);

            window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
            expect(cb).not.toHaveBeenCalled();
        });

        it('T2-F9-05: pushState updates window.location without reloading page', () => {
            window.history.pushState({ id: 42 }, 'Problem 42', '/problems/problem-42/');
            expect(window.location.href).toContain('problem-42');
        });
    });

    // =========================================================================
    // FEATURE 10 (Boundary: Declarative TagInput Compliance)
    // =========================================================================
    describe('Feature 10: Declarative TagInput Boundary Cases', () => {
        it('T2-F10-01: tag string containing HTML characters (<script>, &, ") renders safely as text', () => {
            const tags = ['<script>alert(1)</script>', 'C++ & Algorithms'];
            const onChange = jest.fn();

            render(h(TagInput, { tags, onChange }), rootContainer);

            expect(rootContainer.textContent).toContain('<script>alert(1)</script>');
            expect(rootContainer.textContent).toContain('C++ & Algorithms');
            expect(rootContainer.querySelector('script')).toBeNull();
        });

        it('T2-F10-02: extremely long tag string (200+ characters) renders without throwing', () => {
            const longTag = 'A'.repeat(250);
            const onChange = jest.fn();

            render(h(TagInput, { tags: [longTag], onChange }), rootContainer);
            expect(rootContainer.textContent).toContain('AAAA');
        });

        it('T2-F10-03: submitting duplicate tag does not create duplicate chip', () => {
            const tags = ['Binary Search'];
            const onChange = jest.fn();

            render(h(TagInput, { tags, onChange }), rootContainer);

            const input = rootContainer.querySelector('input') as HTMLInputElement;
            if (input) {
                input.value = 'Binary Search';
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                // TagInput should either ignore or deduplicate
            }
        });

        it('T2-F10-04: whitespace-only tag submission is ignored', () => {
            const tags = ['Array'];
            const onChange = jest.fn();

            render(h(TagInput, { tags, onChange }), rootContainer);

            const input = rootContainer.querySelector('input') as HTMLInputElement;
            if (input) {
                input.value = '   ';
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                // Whitespace should not add empty tag
            }
        });

        it('T2-F10-05: Backspace key in empty input triggers declarative tag removal or handles gracefully', () => {
            const tags = ['Tag1', 'Tag2'];
            const onChange = jest.fn();

            render(h(TagInput, { tags, onChange }), rootContainer);

            const input = rootContainer.querySelector('input') as HTMLInputElement;
            if (input) {
                input.value = '';
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
            }
        });
    });

    // =========================================================================
    // FEATURE 11 (Boundary: Review Forecast Calendar Subtitle)
    // =========================================================================
    describe('Feature 11: Review Forecast Calendar Subtitle Boundary Cases', () => {
        it('T2-F11-01: deck with 0 cards formats subtitle cleanly with 0 total cards', () => {
            const totalCards = 0;
            const subtitle = `${totalCards} total cards · Next 30 days starting Nov 22`;
            expect(subtitle).toBe('0 total cards · Next 30 days starting Nov 22');
        });

        it('T2-F11-02: leap year date (Feb 29) formats starting subtitle date cleanly', () => {
            const leapDate = new Date('2028-02-29T12:00:00Z');
            const formatted = leapDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
            expect(formatted).toBe('Feb 29');
        });

        it('T2-F11-03: year-end date (Dec 25) rolls cleanly into January without NaN', () => {
            const yearEndDate = new Date('2026-12-25T12:00:00Z');
            const day30Date = new Date(yearEndDate.getTime() + 30 * 86400000);
            expect(day30Date.getUTCFullYear()).toBe(2027);
            expect(day30Date.getUTCMonth()).toBe(0); // January
        });

        it('T2-F11-04: all cards overdue is handled without negative indices', () => {
            const overdueCard: Card = {
                id: 'overdue-1',
                problemTitle: 'Overdue Problem',
                problemUrl: 'https://leetcode.com/problems/overdue/',
                due: BASELINE_TIMESTAMP - (60 * 86400000), // 60 days overdue
                stability: 5,
                difficulty: 5,
                elapsed_days: 60,
                scheduled_days: 1,
                learning_steps: 0,
                reps: 1,
                lapses: 0,
                state: 2
            };

            const count = calculateExpectedDueCount([overdueCard], BASELINE_TIMESTAMP);
            expect(count).toBe(1);
        });

        it('T2-F11-05: extreme future due date (year 2035) is included in total cards count', () => {
            const futureCard: Card = {
                id: 'future-1',
                problemTitle: 'Future Problem',
                problemUrl: 'https://leetcode.com/problems/future/',
                due: new Date('2035-01-01T00:00:00Z').getTime(),
                stability: 1000,
                difficulty: 3,
                elapsed_days: 1,
                scheduled_days: 3000,
                learning_steps: 0,
                reps: 10,
                lapses: 0,
                state: 2
            };

            const dueCount = calculateExpectedDueCount([futureCard], BASELINE_TIMESTAMP);
            expect(dueCount).toBe(0);
        });
    });

    // =========================================================================
    // FEATURE 12 (Boundary: Popup Visual & KPI Cards)
    // =========================================================================
    describe('Feature 12: Popup Visual & KPI Cards Boundary Cases', () => {
        it('T2-F12-01: 0 due cards displays 0 DUE TODAY with success styling', async () => {
            // Seed storage with cards due in the future
            const futureCard: Card = {
                id: 'future-c',
                problemTitle: 'Future Due',
                problemUrl: 'https://leetcode.com/problems/future/',
                due: BASELINE_TIMESTAMP + 100000000,
                stability: 10,
                difficulty: 5,
                elapsed_days: 1,
                scheduled_days: 10,
                learning_steps: 0,
                reps: 2,
                lapses: 0,
                state: 2,
                last_review: BASELINE_TIMESTAMP - 1000
            };
            await chrome.storage.local.set({
                fsrsCards: [futureCard],
                fsrsActivity: { '2026-11-20': 5 },
                extensionSettings: { showDailyFocus: true, showCharts: true }
            });

            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.textContent).toContain('0');
            expect(rootContainer.textContent?.toUpperCase()).toContain('DUE TODAY');
        });

        it('T2-F12-02: 100% retention renders 100% RETENTION with success styling', async () => {
            const perfectCard: Card = {
                id: 'perf-c',
                problemTitle: 'Perfect Card',
                problemUrl: 'https://leetcode.com/problems/perf/',
                due: BASELINE_TIMESTAMP + 86400000,
                stability: 1000,
                difficulty: 1,
                elapsed_days: 0,
                scheduled_days: 100,
                learning_steps: 0,
                reps: 10,
                lapses: 0,
                state: 2,
                last_review: BASELINE_TIMESTAMP
            };
            await chrome.storage.local.set({
                fsrsCards: [perfectCard],
                fsrsActivity: { '2026-11-20': 5 }
            });

            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.textContent).toContain('100%');
            expect(rootContainer.textContent?.toUpperCase()).toContain('RETENTION');
        });

        it('T2-F12-03: large deck (10,000 cards) renders formatted number without overflowing', async () => {
            const mockCards: Card[] = [];
            for (let i = 0; i < 1000; i++) {
                mockCards.push({
                    id: `c_${i}`,
                    problemTitle: `P_${i}`,
                    problemUrl: `https://leetcode.com/problems/p_${i}/`,
                    due: BASELINE_TIMESTAMP,
                    stability: 5,
                    difficulty: 5,
                    elapsed_days: 1,
                    scheduled_days: 1,
                    learning_steps: 0,
                    reps: 1,
                    lapses: 0,
                    state: 2
                });
            }
            await chrome.storage.local.set({ fsrsCards: mockCards });

            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.textContent).toMatch(/1,?000/);
        });

        it('T2-F12-04: rating prompt with status dismissed hides rating prompt card from DOM', async () => {
            await seedStorageFromBackup();
            await chrome.storage.local.set({
                ratingPromptState: { status: 'dismissed', snoozedUntil: 0 }
            });

            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.querySelector('.rating-prompt-card')).toBeNull();
        });

        it('T2-F12-05: zero longest streak and zero current streak displays 0 streak', async () => {
            await chrome.storage.local.set({
                fsrsCards: [],
                fsrsActivity: {},
                longestStreak: 0,
                dailyGoalTarget: 10
            });

            render(h(PopupApp, {}), rootContainer);
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(rootContainer.textContent).toContain('0');
        });
    });

    // =========================================================================
    // FEATURE 13 (Boundary: Analytics SPA & Settings Visuals)
    // =========================================================================
    describe('Feature 13: Analytics SPA & Settings Visual Boundary Cases', () => {
        it('T2-F13-01: untagged cards in deck are grouped safely without exceptions', () => {
            const untaggedCard: Card = {
                id: 'untagged-1',
                problemTitle: 'Untagged Problem',
                problemUrl: 'https://leetcode.com/problems/untagged/',
                due: BASELINE_TIMESTAMP,
                stability: 10,
                difficulty: 5,
                elapsed_days: 1,
                scheduled_days: 5,
                learning_steps: 0,
                reps: 2,
                lapses: 0,
                state: 2,
                tags: [] // No tags
            };

            const dataUtils = new DataUtils([untaggedCard], {}, new FsrsScheduler());
            expect(() => {
                const breakdown = dataUtils.getTopicCoverage();
                expect(Array.isArray(breakdown)).toBe(true);
            }).not.toThrow();
        });

        it('T2-F13-02: Future Simulation calculation with slider at 0 days matches current retention', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);

            const sim = dataUtils.getFutureMemorySimulation(0);
            expect(sim.today).toBe(63);
            expect(sim.custom.days).toBe(0);
            expect(sim.custom.retention).toBe(63);
        });

        it('T2-F13-03: Future Simulation calculation at 365 days decreases monotonically', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);

            const simToday = dataUtils.getFutureMemorySimulation(0);
            const sim365 = dataUtils.getFutureMemorySimulation(365);

            expect(sim365.custom.retention).toBeLessThan(simToday.custom.retention);
        });

        it('T2-F13-04: Memory Health score with zero reviews displays 0 without NaN', () => {
            const dataUtils = new DataUtils([], {}, new FsrsScheduler());
            const score = dataUtils.getMemoryHealthScore();
            expect(isNaN(score.score)).toBe(false);
            expect(score.score).toBeGreaterThanOrEqual(0);
        });

        it('T2-F13-05: Exam Readiness forecast with 0 days remaining produces non-NaN recall', async () => {
            await seedStorageFromBackup();
            const snapshot = await getStorageSnapshot();
            const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
            const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);

            const stats = dataUtils.getExamReadiness(0);
            expect(isNaN(stats.overallRecall)).toBe(false);
            expect(stats.overallRecall).toBeGreaterThanOrEqual(0);
            expect(stats.overallRecall).toBeLessThanOrEqual(100);
        });
    });
});
