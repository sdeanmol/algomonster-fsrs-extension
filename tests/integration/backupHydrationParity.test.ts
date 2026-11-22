/**
 * @file tests/integration/backupHydrationParity.test.ts
 * @description Comprehensive Integration and Parity Test Suite for Milestone 1 (R1).
 * Validates Gzip NDJSON V2 backup loading, URL deduplication, storage hydration,
 * FSRS custom parameters hydration, and exact KPI parity at the reference timestamp:
 * 52 cards, 35 due cards, 63% retention rate, best streak 8, and analytics metrics.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { BackupManager, Fnv1aHasher } from '../../features/common/data/backupManager';
import FsrsScheduler from '../../features/tracker/scheduler/fsrsScheduler';
import { DataUtils } from '../../features/dashboard/analytics/utils/dataUtils';
import { getLastReviewDate } from '../../features/common/utils/cardUtils';
import { calculateStreaks } from '../../features/dashboard/popup/stats';
import { PopupApp } from '../../features/dashboard/popup/popup';
import { Card, StorageData } from '../../types/domain';
import { BackupRecord } from '../../types/backup';

describe('Milestone 1: Storage & FSRS Hydration Parity (R1)', () => {
    const REFERENCE_TIMESTAMP = 1795353012606; // 2026-11-22T13:10:12.606Z
    const backupFilePath = path.resolve(__dirname, '../fixtures/algo_pro_backup_2026-11-20.json.gz');

    let rawGzipBuffer: Buffer;
    let uncompressedLines: string[];
    let parsedRecords: BackupRecord[];

    beforeEach(() => {
        rawGzipBuffer = fs.readFileSync(backupFilePath);
        const decompressed = zlib.gunzipSync(rawGzipBuffer).toString('utf-8');
        uncompressedLines = decompressed.split('\n').filter(Boolean);
        parsedRecords = uncompressedLines.map(line => JSON.parse(line));
    });

    describe('1. Backup Archive Structure & Integrity Checksum', () => {
        it('contains exactly 189 NDJSON lines conforming to V2 streaming specification', () => {
            expect(uncompressedLines.length).toBe(189);
        });

        it('verifies exact record counts per discriminated type', () => {
            const counts: Record<string, number> = {};
            parsedRecords.forEach(rec => {
                counts[rec.type] = (counts[rec.type] || 0) + 1;
            });

            expect(counts.header).toBe(1);
            expect(counts.page).toBe(64);
            expect(counts.card).toBe(52);
            expect(counts.mark).toBe(23);
            expect(counts.bookmark).toBe(22);
            expect(counts.pagecontent).toBe(23);
            expect(counts.activity).toBe(1);
            expect(counts.weights).toBe(1);
            expect(counts.settings).toBe(1);
            expect(counts.footer).toBe(1);
        });

        it('validates 32-bit FNV-1a checksum against footer.data.checksum', () => {
            const hasher = new Fnv1aHasher();
            for (let i = 0; i < uncompressedLines.length - 1; i++) {
                hasher.update(uncompressedLines[i] + '\n');
            }
            const computedDigest = hasher.digest();
            const footerRecord = parsedRecords[parsedRecords.length - 1];

            expect(footerRecord.type).toBe('footer');
            if (footerRecord.type === 'footer') {
                expect(computedDigest).toBe(footerRecord.data.checksum);
                expect(footerRecord.data.checksum).toBe('97299100');
                expect(footerRecord.data.count).toBe(188);
            }
        });
    });

    describe('2. Storage Hydration & Deduplication Parity via BackupManager', () => {
        let storageState: Record<string, any>;

        beforeEach(async () => {
            storageState = {};
            (global as any).chrome = {
                storage: {
                    local: {
                        get: jest.fn(async (keys: any) => {
                            if (keys === null) return storageState;
                            if (Array.isArray(keys)) {
                                const res: Record<string, any> = {};
                                keys.forEach(k => { if (k in storageState) res[k] = storageState[k]; });
                                return res;
                            }
                            return storageState;
                        }),
                        set: jest.fn(async (items: Record<string, any>) => {
                            Object.assign(storageState, items);
                        }),
                        remove: jest.fn(async (keys: string | string[]) => {
                            const arr = Array.isArray(keys) ? keys : [keys];
                            arr.forEach(k => delete storageState[k]);
                        })
                    }
                }
            };

            const webStream = require('stream/web');
            (global as any).TransformStream = webStream.TransformStream;
            (window as any).TransformStream = webStream.TransformStream;

            (window as any).DecompressionStream = class MockDecompressionStream {
                readable: any;
                writable: any;
                constructor() {
                    const ts = new webStream.TransformStream({
                        transform(chunk: any, controller: any) {
                            controller.enqueue(chunk);
                        }
                    });
                    this.readable = ts.readable;
                    this.writable = ts.writable;
                }
            };

            // Mock File and stream for BackupManager.importBackup
            const mockFile = {
                name: 'algo_pro_backup_2026-11-20.json.gz',
                size: rawGzipBuffer.length,
                slice: () => ({
                    arrayBuffer: async () => rawGzipBuffer.slice(0, 2).buffer
                }),
                stream: () => {
                    const lines = [...uncompressedLines];
                    let idx = 0;
                    const s = {
                        pipeThrough: () => s,
                        getReader: () => ({
                            read: async () => {
                                if (idx < lines.length) {
                                    return { done: false, value: new TextEncoder().encode(lines[idx++] + '\n') };
                                }
                                return { done: true, value: undefined };
                            },
                            releaseLock: jest.fn()
                        })
                    };
                    return s;
                }
            };

            jest.spyOn(BackupManager, 'validateStream').mockResolvedValue({
                isV2: true,
                counts: { pages: 64, cards: 52, marks: 23, bookmarks: 22, pagecontents: 23 }
            });

            const onStatus = jest.fn();
            await BackupManager.importBackup(mockFile as any, onStatus);
            expect(onStatus).toHaveBeenCalledWith('Backup restored successfully!');
        });

        it('hydrates exactly 52 cards with resolved problem URLs and titles', () => {
            const cards = storageState.fsrsCards;
            expect(Array.isArray(cards)).toBe(true);
            expect(cards.length).toBe(52);

            cards.forEach((card: Card) => {
                expect(card.id).toBeDefined();
                expect(typeof card.id).toBe('string');
                expect(card.problemUrl).toBeDefined();
                expect(typeof card.problemUrl).toBe('string');
                expect(card.problemUrl?.startsWith('http')).toBe(true);
                expect(card.problemTitle).toBeDefined();
                expect(typeof card.problemTitle).toBe('string');
                expect(typeof card.stability).toBe('number');
                expect(typeof card.difficulty).toBe('number');
                expect(typeof card.due).toBe('number');
            });
        });

        it('hydrates marks, bookmarks, pagecontents, and activity logs accurately', () => {
            expect(storageState.marks.length).toBe(23);
            expect(storageState.bookmarks.length).toBe(22);
            expect(storageState.pagecontents.length).toBe(23);

            // Activity log contains 31 dates and 112 reviews
            const activity = storageState.fsrsActivity;
            const dates = Object.keys(activity);
            expect(dates.length).toBe(31);
            const totalReviews = Object.values(activity).reduce((sum: number, c: any) => sum + Number(c), 0);
            expect(totalReviews).toBe(112);
        });

        it('hydrates custom FSRS parameters, streak, rating prompt, and settings', () => {
            const params = storageState.fsrsGlobalParams;
            expect(params).toBeDefined();
            expect(params.decay).toBe(-0.5);
            expect(params.factor).toBe(0.234567);
            expect(params.requestRetention).toBe(0.9);
            expect(params.version).toBe('personalized');
            expect(params.w).toHaveLength(17);
            expect(params.w[0]).toBeCloseTo(0.6664);

            expect(storageState.longestStreak).toBe(8);
            expect(storageState.dailyGoalTarget).toBeNull();
            expect(storageState.ratingPromptState).toEqual({ snoozedUntil: 0, status: 'rated' });
            expect(storageState.theme).toBe('dark');
            expect(storageState.whitelistedWebsites).toHaveLength(10);
        });
    });

    describe('3. KPI Parity & Retrievability Calculation at Reference Timestamp', () => {
        let cards: Card[];
        let activity: Record<string, number>;
        let fsrsGlobalParams: any;

        beforeEach(() => {
            const pages: Record<number, any> = {};
            parsedRecords.filter(r => r.type === 'page').forEach(r => { pages[(r.data as any).id] = r.data; });

            cards = parsedRecords.filter(r => r.type === 'card').map(r => {
                const c = { ...(r.data as any) };
                if (c.u !== undefined && pages[c.u]) {
                    c.problemUrl = pages[c.u].url;
                    c.problemTitle = pages[c.u].title;
                    delete c.u;
                }
                return c as Card;
            });

            activity = (parsedRecords.find(r => r.type === 'activity')?.data as any) || {};
            const settingsData = (parsedRecords.find(r => r.type === 'settings')?.data as any) || {};
            fsrsGlobalParams = settingsData.fsrsGlobalParams;
        });

        it('verifies exactly 52 patterns and 35 due cards at reference timestamp', () => {
            expect(cards.length).toBe(52);

            const dueCards = cards.filter(c => c.due <= REFERENCE_TIMESTAMP);
            expect(dueCards.length).toBe(35);

            // Temporal boundary validation:
            // 32 cards due before 2026-11-21 00:00 UTC
            const dueBefore21st = cards.filter(c => c.due <= 1795157516484).length;
            expect(dueBefore21st).toBe(32);

            // 3 cards due on 2026-11-21
            const dueOn21st = cards.filter(c => c.due > 1795157516484 && c.due <= 1795263395640).length;
            expect(dueOn21st).toBe(3);

            // Card 36 is due on 2026-11-23 15:50:23 UTC (1795429223301)
            const dueOn23rd = cards.filter(c => c.due > REFERENCE_TIMESTAMP && c.due <= 1795429223301).length;
            expect(dueOn23rd).toBe(1);
        });

        it('verifies memory retrievability evaluates to exactly 63% using restored FSRS parameters', () => {
            const scheduler = new FsrsScheduler(fsrsGlobalParams);

            let totalRetrievability = 0;
            let retrievabilityCount = 0;

            cards.forEach(card => {
                if (card.stability > 0) {
                    const lastReview = getLastReviewDate(card);
                    if (lastReview) {
                        const r = scheduler.getRetrievability(card, REFERENCE_TIMESTAMP);
                        totalRetrievability += r;
                        retrievabilityCount++;
                    }
                }
            });

            // All 52 cards are reviewed cards and have stability > 0
            expect(retrievabilityCount).toBe(52);
            const averageRetrievability = totalRetrievability / retrievabilityCount;
            expect(averageRetrievability).toBeCloseTo(0.63407, 3);
            const retentionRate = Math.round(averageRetrievability * 100);
            expect(retentionRate).toBe(63);
        });

        it('confirms contrast: omitting getLastReviewDate falls back to 37 cards and skews retention to 76%', () => {
            const customScheduler = new FsrsScheduler(fsrsGlobalParams);

            let totalExplicitOnly = 0;
            let countExplicitOnly = 0;
            let totalWithFallback = 0;
            let countWithFallback = 0;

            cards.forEach(card => {
                // Without getLastReviewDate fallback (only explicit card.last_review)
                if (card.stability > 0 && card.last_review) {
                    totalExplicitOnly += customScheduler.getRetrievability(card, REFERENCE_TIMESTAMP);
                    countExplicitOnly++;
                }

                // With getLastReviewDate fallback
                const lr = getLastReviewDate(card);
                if (card.stability > 0 && lr) {
                    totalWithFallback += customScheduler.getRetrievability(card, REFERENCE_TIMESTAMP);
                    countWithFallback++;
                }
            });

            expect(countExplicitOnly).toBe(37);
            expect(countWithFallback).toBe(52);

            const explicitOnlyRetention = Math.round((totalExplicitOnly / countExplicitOnly) * 100);
            const fullRetention = Math.round((totalWithFallback / countWithFallback) * 100);

            expect(explicitOnlyRetention).toBe(76);
            expect(fullRetention).toBe(63);
        });

        it('confirms streak calculation yields longest streak of 8', () => {
            const streakData = calculateStreaks(activity);
            expect(streakData.longest).toBe(8);
            expect(Math.max(streakData.longest, 8)).toBe(8);
        });

        it('verifies gamification Level 7 from 112 activity reviews', () => {
            const totalReviews = Object.values(activity).reduce((sum, n) => sum + n, 0);
            expect(totalReviews).toBe(112);
            const level = Math.floor(1 + 0.6 * Math.sqrt(totalReviews));
            expect(level).toBe(7);
        });
    });

    describe('4. Analytics Aggregation Parity via DataUtils', () => {
        let cards: Card[];
        let activity: Record<string, number>;
        let scheduler: FsrsScheduler;
        let dataUtils: DataUtils;

        beforeEach(() => {
            const pages: Record<number, any> = {};
            parsedRecords.filter(r => r.type === 'page').forEach(r => { pages[(r.data as any).id] = r.data; });

            cards = parsedRecords.filter(r => r.type === 'card').map(r => {
                const c = { ...(r.data as any) };
                if (c.u !== undefined && pages[c.u]) {
                    c.problemUrl = pages[c.u].url;
                    c.problemTitle = pages[c.u].title;
                    delete c.u;
                }
                return c as Card;
            });

            activity = (parsedRecords.find(r => r.type === 'activity')?.data as any) || {};
            const settingsData = (parsedRecords.find(r => r.type === 'settings')?.data as any) || {};
            scheduler = new FsrsScheduler(settingsData.fsrsGlobalParams);

            dataUtils = new DataUtils(cards, activity, scheduler);
            dataUtils.today = new Date(REFERENCE_TIMESTAMP);
            dataUtils.todayStart = new Date(dataUtils.today.getFullYear(), dataUtils.today.getMonth(), dataUtils.today.getDate());
        });

        it('produces summary stats matching overview hero card metrics', () => {
            // Temporarily freeze Date.now for getSummaryStats comparison
            const origDateNow = Date.now;
            Date.now = () => REFERENCE_TIMESTAMP;
            try {
                const summary = dataUtils.getSummaryStats();
                expect(summary.totalCards).toBe(52);
                expect(summary.dueToday).toBe(35);
                expect(summary.trueRetention).toBe(63);
                expect(summary.totalActivityReviews).toBe(112);
                expect(summary.totalLapses).toBe(3);
                expect(summary.avgStability).toBeCloseTo(41.8, 1);
            } finally {
                Date.now = origDateNow;
            }
        });

        it('calculates 12-day exam readiness overall expected recall as 59%', () => {
            const readiness = dataUtils.getExamReadinessStats(12);
            expect(readiness.overallRecall).toBe(59);
        });

        it('calculates future memory simulation decay curve matching screenshot', () => {
            const sim = dataUtils.getFutureMemorySimulation(45);
            expect(sim.today).toBe(63);
            expect(sim.d30).toBe(54);
            expect(sim.d90).toBe(47);
            expect(sim.d180).toBe(41);
            expect(sim.custom.retention).toBe(52);
            expect(sim.custom.forgottenCount).toBe(37);
        });

        it('calculates tag analytics with Linked List at 33% and Sorting at 99%', () => {
            const origDateNow = Date.now;
            Date.now = () => REFERENCE_TIMESTAMP;
            try {
                const tagStats = dataUtils.getStatsByTag();
                const linkedList = tagStats.find(t => t.tag === 'Linked List');
                const sorting = tagStats.find(t => t.tag === 'Sorting');

                expect(linkedList).toBeDefined();
                expect(linkedList?.count).toBe(5);
                expect(linkedList?.trueRetention).toBe(33);

                expect(sorting).toBeDefined();
                expect(sorting?.count).toBe(4);
                expect(sorting?.trueRetention).toBe(99);
            } finally {
                Date.now = origDateNow;
            }
        });
    });

    describe('5. Popup UI Hero KPI Parity at Reference Timestamp', () => {
        let container: HTMLElement;
        let cards: Card[];
        let activity: Record<string, number>;
        let settingsData: any;

        beforeEach(() => {
            const pages: Record<number, any> = {};
            parsedRecords.filter(r => r.type === 'page').forEach(r => { pages[(r.data as any).id] = r.data; });

            cards = parsedRecords.filter(r => r.type === 'card').map(r => {
                const c = { ...(r.data as any) };
                if (c.u !== undefined && pages[c.u]) {
                    c.problemUrl = pages[c.u].url;
                    c.problemTitle = pages[c.u].title;
                    delete c.u;
                }
                return c as Card;
            });

            activity = (parsedRecords.find(r => r.type === 'activity')?.data as any) || {};
            settingsData = (parsedRecords.find(r => r.type === 'settings')?.data as any) || {};

            container = document.createElement('div');
            container.id = 'root';
            document.body.appendChild(container);

            (global as any).chrome = {
                storage: {
                    local: {
                        get: jest.fn().mockImplementation(async () => ({
                            extensionSettings: settingsData.extensionSettings || {
                                showMarkerPopup: true,
                                showCharts: true,
                                showLauncher: true,
                                developerMode: false,
                                showDailyFocus: true
                            },
                            fsrsCards: cards,
                            fsrsActivity: activity,
                            ratingPromptState: settingsData.ratingPromptState || { status: 'rated' },
                            dailyGoalTarget: settingsData.dailyGoalTarget ?? null,
                            longestStreak: settingsData.longestStreak || 8,
                            fsrsGlobalParams: settingsData.fsrsGlobalParams || {}
                        })),
                        set: jest.fn().mockImplementation(async () => {})
                    }
                },
                runtime: {
                    getURL: jest.fn((p: any) => `chrome-extension://test/${p}`),
                    lastError: null
                },
                tabs: {
                    create: jest.fn()
                }
            };
        });

        afterEach(() => {
            render(null, container);
            container.remove();
            document.body.innerHTML = '';
        });

        it('renders exact KPI hero cards: 52 PATTERNS, 35 DUE TODAY, 63% RETENTION, Best: 8', async () => {
            const origDateNow = Date.now;
            Date.now = () => REFERENCE_TIMESTAMP;
            try {
                await act(async () => {
                    render(h(PopupApp, {}), container);
                    await new Promise(r => setTimeout(r, 50));
                });

                const totalEl = document.getElementById('total-cards');
                const dueEl = document.getElementById('due-cards');
                const retentionEl = document.getElementById('retention-rate');
                const boxDue = document.getElementById('box-due');
                const boxRetention = document.getElementById('box-retention');

                expect(totalEl?.textContent?.trim()).toBe('52');
                expect(dueEl?.textContent?.trim()).toBe('35');
                expect(retentionEl?.textContent?.trim()).toBe('63%');

                expect(boxDue?.classList.contains('danger')).toBe(true);
                expect(boxRetention?.classList.contains('danger')).toBe(true);

                // Rating state displays 'Thank you for supporting us! ❤️ Edit Rating'
                const ratingBanner = document.getElementById('rating-thanks-state');
                expect(ratingBanner?.textContent).toContain('Thank you for supporting us!');

                // Streak indicators
                const longestStreakEl = document.getElementById('longest-streak');
                expect(longestStreakEl?.textContent).toContain('Best: 8');
            } finally {
                Date.now = origDateNow;
            }
        });
    });
});
