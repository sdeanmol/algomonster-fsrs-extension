/**
 * @file tier4_real_world_scenarios.spec.ts
 * @description Tier 4 Acceptance Test Suite: 5 End-to-End Real-World Scenarios (T4-SC-01 through T4-SC-05)
 * verifying end-to-end user workflows, lifecycle recovery, export/import round-trip integrity,
 * and multi-browser manifest isolation.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { h, render } from 'preact';
import * as path from 'path';
import * as fs from 'fs';
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
import { setupMockHostSpa, simulateSpaNavigation, simulatePopstate } from './helpers/domHostHelper';
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
import { OverviewTabComponent } from '@dashboard/analytics/overview/overview';
import { ReadinessTabComponent } from '@dashboard/analytics/readiness/readiness';
import Tracker from '@tracker/tracker';
import { AlgoRecallOrchestrator } from '../../../content/content';
import { Card, FSRSParameters, WhitelistedWebsite } from '../../../types/domain';

describe('Tier 4: Real-World Acceptance Scenarios Suite (5 Scenarios)', () => {
    let unfreeze: () => void;
    let rootContainer: HTMLElement;

    beforeEach(() => {
        delete (document.body as any).__k;
        unfreeze = freezeTime(BASELINE_TIMESTAMP);
        rootContainer = document.createElement('div');
        rootContainer.id = 'test-acceptance-tier4-root';
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
    // SCENARIO 1: Full End-to-End Backup Restore and Complete KPI Parity
    // =========================================================================
    it('T4-SC-01: Full End-to-End Backup Restore and Complete KPI Parity', async () => {
        // 1. Ingest real reference backup archive
        const buf = getBackupBuffer();
        const mockFile = createMockBackupFile(buf);
        await BackupManager.importBackup(mockFile, () => {});

        // 2. Validate storage hydration contents
        const snapshot = await getStorageSnapshot();
        expect(snapshot.fsrsCards.length).toBe(52);
        expect(snapshot.bookmarks.length).toBe(22);
        expect(snapshot.marks.length).toBe(23);
        expect(snapshot.pagecontents.length).toBe(23);
        expect(Object.keys(snapshot.fsrsActivity || {}).length).toBe(31);
        expect(snapshot.longestStreak).toBe(8);
        expect(snapshot.ratingPromptState.status).toBe('rated');

        // 3. Mount PopupApp and verify full visual and KPI parity
        render(h(PopupApp, {}), rootContainer);
        await new Promise(resolve => setTimeout(resolve, 80));

        // KPI Box 1: Patterns count
        const box1 = rootContainer.querySelector('#box-total') || rootContainer;
        expect(box1.textContent).toContain('52');
        expect(box1.textContent?.toUpperCase()).toContain('PATTERNS');

        // KPI Box 2: 35 Due today with danger styling
        const box2 = rootContainer.querySelector('#box-due') || rootContainer;
        expect(box2.textContent).toContain('35');
        expect(box2.textContent?.toUpperCase()).toContain('DUE TODAY');
        expect(box2.className).toContain('danger');

        // KPI Box 3: 63% Retention with danger styling
        const box3 = rootContainer.querySelector('#box-retention') || rootContainer;
        expect(box3.textContent).toContain('63%');
        expect(box3.textContent?.toUpperCase()).toContain('RETENTION');
        expect(box3.className).toContain('danger');

        // Header level badge & rating button
        expect(rootContainer.textContent).toMatch(/Lv\.\s*7/i);
        expect(rootContainer.textContent).toContain('Edit Rating');

        // Daily focus ring & streak status
        expect(rootContainer.textContent).toMatch(/0\s*of\s*10|0\s*\/\s*10/i);
        expect(rootContainer.textContent).toContain('Best: 8');

        // Milestones badge: 5 of 8 unlocked
        expect(rootContainer.textContent).toMatch(/5\s*\/\s*8|5\s*of\s*8/i);

        // 4. Mount Analytics OverviewTabComponent
        render(null, rootContainer);
        const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
        const dataUtils = new DataUtils(snapshot.fsrsCards, snapshot.fsrsActivity, scheduler);

        render(h(OverviewTabComponent, {
            cards: snapshot.fsrsCards,
            activity: snapshot.fsrsActivity,
            dataUtils
        }), rootContainer);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(rootContainer.textContent).toContain('63');
        expect(rootContainer.textContent).toContain('/ 100');
        expect(rootContainer.textContent).toMatch(/Review Due Cards|Needs Attention|Due/i);

        // 5. Mount Analytics ReadinessTabComponent
        render(null, rootContainer);
        render(h(ReadinessTabComponent, {
            cards: snapshot.fsrsCards,
            dataUtils
        }), rootContainer);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Overall expected recall 59% & 26 at-risk topics
        expect(rootContainer.textContent).toContain('59%');
        expect(rootContainer.textContent).toContain('26');
    });

    // =========================================================================
    // SCENARIO 2: Host SPA Route Transition Resilience on LeetCode/AlgoMonster
    // =========================================================================
    it('T4-SC-02: Host SPA Route Transition Resilience on LeetCode/AlgoMonster', async () => {
        const spa = setupMockHostSpa({ title: 'Two Sum - LeetCode', url: '/problems/two-sum/' });

        // Initialize content script orchestrator
        const orchestrator = new AlgoRecallOrchestrator();
        orchestrator.tracker.createUI();

        // Tracker host and floating launcher must exist
        expect(document.getElementById('algo-tracker-host')).not.toBeNull();
        expect(document.getElementById('algo-fsrs-launcher')).not.toBeNull();
        expect((document.body as any).__k).toBeUndefined();

        // 1. Simulate Next.js client-side route navigation to problem 2 wiping DOM
        simulateSpaNavigation('Add Two Numbers - LeetCode', '/problems/add-two-numbers/', true);
        window.dispatchEvent(new CustomEvent('algo_spa_navigation', { detail: { url: '/problems/add-two-numbers/' } }));
        simulatePopstate('/problems/add-two-numbers/');

        // Host is detached, orchestrator recovers UI
        orchestrator.triggerAggressiveUIUpdate();
        expect(document.getElementById('algo-tracker-host')).not.toBeNull();
        expect(document.getElementById('algo-fsrs-launcher')).not.toBeNull();
        expect((document.body as any).__k).toBeUndefined();

        // 2. Simulate second navigation to problem 3
        simulateSpaNavigation('Longest Substring - LeetCode', '/problems/longest-substring-without-repeating-characters/', true);
        window.dispatchEvent(new CustomEvent('algo_spa_navigation', { detail: { url: '/problems/longest-substring-without-repeating-characters/' } }));
        simulatePopstate('/problems/longest-substring-without-repeating-characters/');

        orchestrator.triggerAggressiveUIUpdate();
        expect(document.getElementById('algo-tracker-host')).not.toBeNull();
        expect(document.getElementById('algo-fsrs-launcher')).not.toBeNull();
        expect((document.body as any).__k).toBeUndefined();

        orchestrator.tracker.removeUI();
        spa.cleanup();
    });

    // =========================================================================
    // SCENARIO 3: Settings Modification and V2 Backup Export Round-trip Integrity
    // =========================================================================
    it('T4-SC-03: Settings Modification and V2 Backup Export Round-trip Integrity', async () => {
        await seedStorageFromBackup();
        const initialSnapshot = await getStorageSnapshot();

        // 1. Modify settings in storage
        const updatedWhitelists: WhitelistedWebsite[] = [
            ...(initialSnapshot.whitelistedWebsites || []),
            { domain: 'neetcode.io', isDefault: false }
        ];
        const updatedExtensionSettings = {
            ...(initialSnapshot.extensionSettings || {}),
            defaultHighlightColor: '#FF5722'
        };
        const updatedFsrsParams: FSRSParameters = {
            ...initialSnapshot.fsrsGlobalParams,
            requestRetention: 0.85
        };

        await chrome.storage.local.set({
            whitelistedWebsites: updatedWhitelists,
            theme: 'light',
            extensionSettings: updatedExtensionSettings,
            fsrsGlobalParams: updatedFsrsParams
        });

        // 2. Mock downloads and URL APIs for export capture
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

        // 3. Decompress and parse exported NDJSON stream
        const arrayBuf = await (exportedBlob as any).arrayBuffer();
        const decompressed = zlib.gunzipSync(Buffer.from(arrayBuf)).toString('utf-8');
        const lines = decompressed.split('\n').filter(l => l.trim().length > 0);

        expect(lines.length).toBeGreaterThanOrEqual(180);
        const header = JSON.parse(lines[0]);
        expect(header.type).toBe('header');
        expect(header.data.version).toBe(2);

        const footer = JSON.parse(lines[lines.length - 1]);
        expect(footer.type).toBe('footer');
        expect(footer.data.count).toBe(lines.length - 1);

        // 4. Verify 32-bit FNV-1a checksum of records 0..N-2 matches footer checksum
        const hasher = new Fnv1aHasher();
        for (let i = 0; i < lines.length - 1; i++) {
            hasher.update(lines[i] + '\n');
        }
        expect(hasher.digest()).toBe(footer.data.checksum);

        // 5. Clear storage completely and re-import exported archive
        await clearExtensionStorage();
        const emptySnapshot = await getStorageSnapshot();
        expect(emptySnapshot.fsrsCards).toBeUndefined();

        const reimportFile = createMockBackupFile(Buffer.from(arrayBuf));
        await BackupManager.importBackup(reimportFile, () => {});

        // 6. Assert all modified settings and full entity inventory are restored losslessly
        const restoredSnapshot = await getStorageSnapshot();
        expect(restoredSnapshot.fsrsCards.length).toBe(52);
        expect(restoredSnapshot.bookmarks.length).toBe(22);
        expect(restoredSnapshot.marks.length).toBe(23);
        expect(restoredSnapshot.pagecontents.length).toBe(23);

        expect(restoredSnapshot.whitelistedWebsites.some((w: any) => w.domain === 'neetcode.io')).toBe(true);
        expect(restoredSnapshot.theme).toBe('light');
        expect(restoredSnapshot.extensionSettings.defaultHighlightColor).toBe('#FF5722');
        expect(restoredSnapshot.fsrsGlobalParams.requestRetention).toBe(0.85);
    });

    // =========================================================================
    // SCENARIO 4: Real-World Review Workflow Completion Lifecycle
    // =========================================================================
    it('T4-SC-04: Real-World Review Workflow Completion Lifecycle', async () => {
        await seedStorageFromBackup();
        const snapshot = await getStorageSnapshot();
        const cards: Card[] = [...snapshot.fsrsCards];
        const activity: Record<string, number> = { ...(snapshot.fsrsActivity || {}) };

        // Baseline: 35 due cards, 112 reviews, 63% retention
        expect(calculateExpectedDueCount(cards, BASELINE_TIMESTAMP)).toBe(35);
        let totalReviewsBefore = 0;
        Object.values(activity).forEach(cnt => totalReviewsBefore += cnt);
        expect(totalReviewsBefore).toBe(112);

        // User reviews first due card
        const dueIdx = cards.findIndex(c => c.due <= BASELINE_TIMESTAMP);
        expect(dueIdx).toBeGreaterThanOrEqual(0);
        const cardToReview = { ...cards[dueIdx] };

        const scheduler = new FsrsScheduler(snapshot.fsrsGlobalParams);
        const updatedCard = scheduler.reviewCard(cardToReview, 3, null, BASELINE_TIMESTAMP);

        // Due timestamp moves into future
        expect(updatedCard.due).toBeGreaterThan(BASELINE_TIMESTAMP);
        cards[dueIdx] = updatedCard;

        // Increment today's review activity
        const todayStr = '2026-11-22';
        activity[todayStr] = (activity[todayStr] || 0) + 1;

        await chrome.storage.local.set({
            fsrsCards: cards,
            fsrsActivity: activity
        });

        // Due cards count decrements to 34
        expect(calculateExpectedDueCount(cards, BASELINE_TIMESTAMP)).toBe(34);

        // Re-mount PopupApp and verify reactive KPIs
        render(h(PopupApp, {}), rootContainer);
        await new Promise(resolve => setTimeout(resolve, 80));

        const dueBox = rootContainer.querySelector('#box-due') || rootContainer;
        expect(dueBox.textContent).toContain('34');

        // Daily focus ring progress: 1 of 10
        expect(rootContainer.textContent).toMatch(/1\s*of\s*10|1\s*\/\s*10/i);

        // Total reviews increments to 113
        let totalReviewsAfter = 0;
        Object.values(activity).forEach(cnt => totalReviewsAfter += cnt);
        expect(totalReviewsAfter).toBe(113);

        // Card history log contains new review record
        expect(updatedCard.historyLog && updatedCard.historyLog.length > 0).toBe(true);
    });

    // =========================================================================
    // SCENARIO 5: Multi-Browser Build Artifact and Manifest Isolation Compliance
    // =========================================================================
    it('T4-SC-05: Multi-Browser Build Artifact and Manifest Isolation Compliance', () => {
        const rootDir = path.resolve(__dirname, '../../..');
        const chromeManifestPath = path.join(rootDir, 'browser', 'chrome', 'manifest.json');
        const firefoxManifestPath = path.join(rootDir, 'browser', 'firefox', 'manifest.json');
        const safariManifestPath = path.join(rootDir, 'browser', 'safari', 'manifest.json');

        expect(fs.existsSync(chromeManifestPath)).toBe(true);
        expect(fs.existsSync(firefoxManifestPath)).toBe(true);
        expect(fs.existsSync(safariManifestPath)).toBe(true);

        const chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf8'));
        const firefoxManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));
        const safariManifest = JSON.parse(fs.readFileSync(safariManifestPath, 'utf8'));

        // 1. Chrome Manifest checks
        expect(chromeManifest.manifest_version).toBe(3);
        expect(chromeManifest.background?.service_worker).toBeDefined();
        expect(chromeManifest.permissions).toContain('notifications');
        expect(chromeManifest.permissions).toContain('downloads');
        expect(chromeManifest.browser_specific_settings).toBeUndefined();

        // 2. Firefox Manifest checks
        expect(firefoxManifest.manifest_version).toBe(3);
        expect(firefoxManifest.background?.scripts).toBeDefined();
        expect(firefoxManifest.browser_specific_settings?.gecko?.id).toBeDefined();
        expect(firefoxManifest.cross_origin_embedder_policy).toBeUndefined();

        // 3. Safari Manifest checks
        expect(safariManifest.manifest_version).toBe(3);
        expect(safariManifest.background?.service_worker).toBeDefined();
        expect(safariManifest.permissions).not.toContain('notifications');
        expect(safariManifest.permissions).not.toContain('downloads');
        expect(safariManifest.browser_specific_settings).toBeUndefined();

        // 4. Store isolation definitions
        const CHROME_STORE_URL = 'chromewebstore.google.com';
        const FIREFOX_STORE_URL = 'addons.mozilla.org';
        const SAFARI_STORE_URL = 'apps.apple.com';

        // Browser store config verification in webpack build definition
        const webpackConfigPath = path.join(rootDir, 'webpack.config.js');
        expect(fs.existsSync(webpackConfigPath)).toBe(true);
        const webpackConfigContent = fs.readFileSync(webpackConfigPath, 'utf8');

        expect(webpackConfigContent).toContain(CHROME_STORE_URL);
        expect(webpackConfigContent).toContain(FIREFOX_STORE_URL);
        expect(webpackConfigContent).toContain(SAFARI_STORE_URL);

        // Browser config files verification
        const browserConfigPath = path.join(rootDir, 'features', 'common', 'browserConfig.ts');
        expect(fs.existsSync(browserConfigPath)).toBe(true);
        const browserConfigContent = fs.readFileSync(browserConfigPath, 'utf8');

        expect(browserConfigContent).toContain('Rate us 5 stars on Chrome Web Store');
        expect(browserConfigContent).toContain('Rate us 5 stars on Firefox Add-ons');
        expect(browserConfigContent).toContain('Rate us 5 stars on the App Store');

        // Verification of scripts/check-artifact-isolation.js exists and is executable
        const isolationScriptPath = path.join(rootDir, 'scripts', 'check-artifact-isolation.js');
        expect(fs.existsSync(isolationScriptPath)).toBe(true);
    });
});
