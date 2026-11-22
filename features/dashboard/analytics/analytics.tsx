/**
 * @file features/dashboard/analytics/analytics.tsx
 * @description Master single-page application (SPA) controller for the Analytics Dashboard.
 * Pure declarative Preact functional architecture mounting once at `<div id="root"></div>`.
 * Eliminates all imperative DOM querying, classList toggling, and multi-mount tab sub-trees.
 */

import { h, Fragment, FunctionalComponent, render } from 'preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { RECALL_THRESHOLD_GOOD, RECALL_THRESHOLD_WARNING, DUE_CARDS_THRESHOLD_WARNING } from '@common/constants';
import { DataUtils, SummaryStats } from './utils/dataUtils';
import { OverviewTab } from './overview/overview';
import { MemoryTab } from './memory/memory';
import { TagsTab } from './tags/tags';
import { PerformanceTab } from './performance/performance';
import { InsightsTab } from './insights/insights';
import { ReadinessTab } from './readiness/readiness';
import { SimulationTab } from './memory/futureMemorySimulation';
import { Card, StorageData, FSRSParameters } from '../../../types/domain';
import AbstractScheduler from '../../tracker/scheduler/scheduler';
import FsrsScheduler from '@tracker/scheduler/fsrsScheduler';

/**
 * Valid tab navigation identifiers in the Analytics SPA dashboard.
 */
export type TabKey = 'overview' | 'readiness' | 'memory' | 'simulation' | 'tags' | 'performance' | 'insights';

export const TAB_TITLES: Record<TabKey, string> = {
    overview: 'Overview',
    readiness: 'Exam Readiness Forecast',
    memory: 'Memory Retention',
    simulation: 'Future Memory Simulation',
    tags: 'Tag Analytics',
    performance: 'Performance & Recovery',
    insights: 'Behavioral Insights'
};

export interface AnalyticsTabComponent {
    render(containerId: string): void;
}

export interface AnalyticsGlobalKpiBarProps {
    stats: SummaryStats;
    examRecall: number;
}

export const AnalyticsGlobalKpiBar: FunctionalComponent<AnalyticsGlobalKpiBarProps> = ({ stats, examRecall }) => {
    const dueCount = stats.dueToday !== undefined ? stats.dueToday : (stats.due || 0);
    const retentionVal = stats.trueRetention !== undefined && stats.trueRetention > 0 ? stats.trueRetention : (stats.retention || 0);

    const retentionPillClass = retentionVal >= RECALL_THRESHOLD_GOOD
        ? 'success'
        : (retentionVal >= RECALL_THRESHOLD_WARNING ? 'warning' : 'danger');

    const duePillClass = dueCount === 0
        ? 'success'
        : (dueCount <= DUE_CARDS_THRESHOLD_WARNING ? 'warning' : 'danger');

    const recallPillClass = examRecall >= RECALL_THRESHOLD_GOOD
        ? 'success'
        : (examRecall >= RECALL_THRESHOLD_WARNING ? 'warning' : 'danger');

    return (
        <div class="global-kpi-bar">
            <div class="kpi-pill" id="global-kpi-pill-cards">
                <span class="kpi-val" id="global-kpi-cards">{stats.totalCards || 0}</span>
                <span class="kpi-lbl">Cards</span>
            </div>
            <div class={`kpi-pill ${retentionPillClass}`} id="global-kpi-pill-retention">
                <span class="kpi-val" id="global-kpi-retention">{retentionVal}%</span>
                <span class="kpi-lbl">Retention</span>
            </div>
            <div class={`kpi-pill ${duePillClass}`} id="global-kpi-pill-due">
                <span class="kpi-val" id="global-kpi-due">{dueCount}</span>
                <span class="kpi-lbl">Due Today</span>
            </div>
            <div class={`kpi-pill ${recallPillClass}`} id="global-kpi-pill-readiness">
                <span class="kpi-val" id="global-kpi-readiness">{examRecall}%</span>
                <span class="kpi-lbl">Exam Recall</span>
            </div>
        </div>
    );
};

export interface AnalyticsSidebarProps {
    currentTab: TabKey;
    onSelectTab: (tab: TabKey) => void;
}

export const AnalyticsSidebar: FunctionalComponent<AnalyticsSidebarProps> = ({ currentTab, onSelectTab }) => {
    return (
        <nav class="sidebar">
            <div class="sidebar-header">
                <h2>
                    <svg class="svg-icon logo-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Analytics
                </h2>
            </div>
            <div class="nav-section-title">MAIN DASHBOARD</div>
            <ul class="nav-links">
                <li>
                    <button
                        class={`nav-btn ${currentTab === 'overview' ? 'active' : ''}`}
                        data-tab="overview"
                        onClick={() => onSelectTab('overview')}
                    >
                        <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Overview
                    </button>
                </li>
                <li>
                    <button
                        class={`nav-btn ${currentTab === 'readiness' ? 'active' : ''}`}
                        data-tab="readiness"
                        onClick={() => onSelectTab('readiness')}
                    >
                        <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                            <path d="M6 12v5c3 3 9 3 12 0v-5" />
                        </svg>
                        Exam Readiness
                    </button>
                </li>
            </ul>

            <div class="nav-section-title">MEMORY & SCIENCE</div>
            <ul class="nav-links">
                <li>
                    <button
                        class={`nav-btn ${currentTab === 'memory' ? 'active' : ''}`}
                        data-tab="memory"
                        onClick={() => onSelectTab('memory')}
                    >
                        <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 4.5a2.5 2.5 0 0 0-4.96.44 2.5 2.5 0 0 0-2.96 3.08 3 3 0 0 0-.34 5.58 2.5 2.5 0 0 0 1.32 4.24 2.5 2.5 0 0 0 4.44 2.04" />
                            <path d="M12 4.5a2.5 2.5 0 0 1 4.96.44 2.5 2.5 0 0 1 2.96 3.08 3 3 0 0 1 .34 5.58 2.5 2.5 0 0 1-1.32 4.24 2.5 2.5 0 0 1-4.44 2.04" />
                            <path d="M12 3v18" />
                        </svg>
                        Memory Retention
                    </button>
                </li>
                <li>
                    <button
                        class={`nav-btn ${currentTab === 'simulation' ? 'active' : ''}`}
                        data-tab="simulation"
                        onClick={() => onSelectTab('simulation')}
                    >
                        <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 22h14" />
                            <path d="M5 2h14" />
                            <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                            <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                        </svg>
                        Future Memory Simulation
                    </button>
                </li>
                <li>
                    <button
                        class={`nav-btn ${currentTab === 'tags' ? 'active' : ''}`}
                        data-tab="tags"
                        onClick={() => onSelectTab('tags')}
                    >
                        <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                            <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        Tag Analytics
                    </button>
                </li>
            </ul>

            <div class="nav-section-title">INSIGHTS & EFFICIENCY</div>
            <ul class="nav-links">
                <li>
                    <button
                        class={`nav-btn ${currentTab === 'performance' ? 'active' : ''}`}
                        data-tab="performance"
                        onClick={() => onSelectTab('performance')}
                    >
                        <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Performance
                    </button>
                </li>
                <li>
                    <button
                        class={`nav-btn ${currentTab === 'insights' ? 'active' : ''}`}
                        data-tab="insights"
                        onClick={() => onSelectTab('insights')}
                    >
                        <svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="2" />
                            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
                        </svg>
                        Insights
                    </button>
                </li>
            </ul>
            <div class="sidebar-footer">
                <a href="../../common/data/data.html" class="btn btn-secondary w-full" style="text-align: center; display: flex; align-items: center; justify-content: center;">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="margin-right:6px;" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    View All Patterns
                </a>
            </div>
        </nav>
    );
};

export interface AnalyticsHeaderProps {
    title: string;
    subtitle: string;
    stats: SummaryStats;
    examRecall: number;
}

export const AnalyticsHeader: FunctionalComponent<AnalyticsHeaderProps> = ({ title, subtitle, stats, examRecall }) => {
    return (
        <header class="main-header">
            <div class="main-header-info">
                <div class="algorecall-brand-badge">
                    <svg class="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5-2-5-5.5-6z" />
                        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                        <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                    </svg>
                    <span class="algorecall-brand-name">AlgoRecall</span>
                </div>
                <h1 id="current-tab-title">{title}</h1>
                <p class="subtitle" id="analytics-subtitle">{subtitle}</p>
            </div>
            <div class="header-global-stats">
                <AnalyticsGlobalKpiBar stats={stats} examRecall={examRecall} />
            </div>
        </header>
    );
};

export interface AnalyticsAppProps {
    initialTab?: TabKey;
    cards?: Card[];
    activity?: Record<string, number>;
    spa?: any;
}

export const AnalyticsApp: FunctionalComponent<AnalyticsAppProps> = ({
    initialTab = 'overview',
    cards: propCards,
    activity: propActivity,
    spa
}) => {
    const [currentTab, setCurrentTab] = useState<TabKey>(initialTab);
    const [cards, setCards] = useState<Card[]>(propCards || []);
    const [activity, setActivity] = useState<Record<string, number>>(propActivity || {});
    const [fsrsGlobalParams, setFsrsGlobalParams] = useState<Partial<FSRSParameters> | null>(null);
    const [stats, setStats] = useState<SummaryStats>(() => new DataUtils([], {}, null).getSummaryStats());
    const [examRecall, setExamRecall] = useState<number>(0);
    const [subtitle, setSubtitle] = useState<string>('Loading analytics...');

    const handleSelectTab = useCallback((tab: TabKey) => {
        setCurrentTab(tab);
    }, []);

    const computeAndSetStats = useCallback((c: Card[], a: Record<string, number>, globalParams?: Partial<FSRSParameters> | null) => {
        try {
            const SchedulerClass = (window as unknown as { FsrsScheduler?: new (params?: Partial<FSRSParameters> | null) => AbstractScheduler }).FsrsScheduler || FsrsScheduler;
            const scheduler = typeof SchedulerClass === 'function' ? new SchedulerClass(globalParams || null) : new FsrsScheduler(globalParams || null);
            const utils = new DataUtils(c, a, scheduler);
            const s = utils.getSummaryStats();
            const r = utils.getExamReadinessStats(12).overallRecall || 0;
            setStats(s);
            setExamRecall(r);
            const sub = `${s.totalCards || 0} patterns tracked · ${s.totalActivityReviews || 0} total reviews · ${s.trueRetention || 0}% retention rate`;
            setSubtitle(sub);
        } catch (err) {
            UIUtils.catchError('AnalyticsApp', 'Error computing analytics statistics', err);
        }
    }, []);

    // Load data from storage on mount
    useEffect(() => {
        let isSubscribed = true;

        const loadData = () => {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    chrome.storage.local.get(['fsrsCards', 'fsrsActivity', 'fsrsGlobalParams'], (result: StorageData) => {
                        const lastError = chrome.runtime?.lastError;
                        if (lastError) {
                            Logger.error('AnalyticsApp', `Storage error: ${lastError.message}`, { lastError });
                            return;
                        }

                        if (!isSubscribed) return;

                        const loadedCards = result?.fsrsCards || propCards || [];
                        const loadedActivity = result?.fsrsActivity || propActivity || {};
                        const loadedParams = result?.fsrsGlobalParams || null;
                        setCards(loadedCards);
                        setActivity(loadedActivity);
                        setFsrsGlobalParams(loadedParams);

                        // If FsrsScheduler is loading asynchronously, wait for it
                        const win = window as unknown as { FsrsScheduler?: unknown };
                        if (win.FsrsScheduler === undefined) {
                            let retries = 0;
                            const interval = setInterval(() => {
                                if (win.FsrsScheduler !== undefined || retries > 50) {
                                    clearInterval(interval);
                                    if (isSubscribed) {
                                        computeAndSetStats(loadedCards, loadedActivity, loadedParams);
                                    }
                                }
                                retries++;
                            }, 100);
                        } else {
                            computeAndSetStats(loadedCards, loadedActivity, loadedParams);
                        }
                    });
                } else if (propCards) {
                    computeAndSetStats(propCards, propActivity || {}, fsrsGlobalParams);
                }
            } catch (err) {
                UIUtils.catchError('AnalyticsApp', 'Error loading storage data', err);
            }
        };

        loadData();

        return () => {
            isSubscribed = false;
        };
    }, [propCards, propActivity, computeAndSetStats, fsrsGlobalParams]);

    const title = TAB_TITLES[currentTab] || 'Overview';

    return (
        <div class="dashboard-layout">
            <AnalyticsSidebar currentTab={currentTab} onSelectTab={handleSelectTab} />
            <main class="main-content">
                <AnalyticsHeader
                    title={title}
                    subtitle={subtitle}
                    stats={stats}
                    examRecall={examRecall}
                />
                <div class="tab-content-container">
                    <div id="tab-overview" class={`tab-pane ${currentTab === 'overview' ? 'active' : ''}`}>
                        {currentTab === 'overview' && <OverviewTab cards={cards} activity={activity} />}
                    </div>
                    <div id="tab-readiness" class={`tab-pane ${currentTab === 'readiness' ? 'active' : ''}`}>
                        {currentTab === 'readiness' && <ReadinessTab cards={cards} />}
                    </div>
                    <div id="tab-memory" class={`tab-pane ${currentTab === 'memory' ? 'active' : ''}`}>
                        {currentTab === 'memory' && <MemoryTab cards={cards} />}
                    </div>
                    <div id="tab-simulation" class={`tab-pane ${currentTab === 'simulation' ? 'active' : ''}`}>
                        {currentTab === 'simulation' && <SimulationTab cards={cards} />}
                    </div>
                    <div id="tab-tags" class={`tab-pane ${currentTab === 'tags' ? 'active' : ''}`}>
                        {currentTab === 'tags' && <TagsTab cards={cards} />}
                    </div>
                    <div id="tab-performance" class={`tab-pane ${currentTab === 'performance' ? 'active' : ''}`}>
                        {currentTab === 'performance' && <PerformanceTab cards={cards} />}
                    </div>
                    <div id="tab-insights" class={`tab-pane ${currentTab === 'insights' ? 'active' : ''}`}>
                        {currentTab === 'insights' && <InsightsTab cards={cards} />}
                    </div>
                </div>
            </main>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE MOUNT ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export function initAnalyticsApp(): void {
    try {
        const root = document.getElementById('root') || document.body;
        if (root) {
            render(<AnalyticsApp />, root);
        }
    } catch (err) {
        UIUtils.catchError('AnalyticsApp', 'Failed to initialize Analytics App', err);
    }
}

export class AnalyticsDashboardSPA {
    currentTab: TabKey = 'overview';
    tabTitles = TAB_TITLES;
    async init(): Promise<void> {
        initAnalyticsApp();
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnalyticsApp);
    } else {
        initAnalyticsApp();
    }
}
