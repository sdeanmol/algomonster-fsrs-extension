/**
 * @file features/dashboard/analytics/analytics.tsx
 * @description Master single-page application (SPA) controller for the Analytics Dashboard.
 * Coordinates tabbed sub-views (Overview, Readiness, Memory, Simulation, Tags, Performance, Insights),
 * manages asynchronous scheduler data bootstrapping, and updates top-level global KPI cards.
 *
 * Architecture Role: Analytics SPA Master Controller and View Router.
 * Context: Extension Standalone Tab (`features/dashboard/analytics/analytics.html`).
 * Key Exports:
 * - {@link TabKey}: Valid navigation tab identifiers.
 * - {@link AnalyticsTabComponent}: Common render contract for child tab view controllers.
 */

import { h, Fragment, FunctionalComponent, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { RECALL_THRESHOLD_GOOD, RECALL_THRESHOLD_WARNING, DUE_CARDS_THRESHOLD_WARNING } from '@common/constants';
import { DataUtils, SummaryStats } from './utils/dataUtils';
import { OverviewTab } from './overview/overview';
import { MemoryTab } from './memory/memory';
import { TagsTab } from './tags/tags';
import { PerformanceTab } from './performance/performance';
import { InsightsTab } from './insights/insights';
import { ReadinessTab } from './readiness/readiness';
import { FutureMemorySimulation } from './memory/futureMemorySimulation';
import { Card, StorageData } from '../../../types/domain';
import AbstractScheduler from '../../tracker/scheduler/scheduler';

/**
 * Valid tab navigation identifiers in the Analytics SPA dashboard.
 */
export type TabKey = 'overview' | 'readiness' | 'memory' | 'simulation' | 'tags' | 'performance' | 'insights';

/**
 * Common lifecycle render contract implemented by individual analytics sub-tab views.
 */
export interface AnalyticsTabComponent {
    /**
     * Renders or mounts the sub-view into the specified container element.
     * @param containerId - ID of the container element in the DOM.
     */
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
                        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
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

export const AnalyticsApp: FunctionalComponent<{ spa: AnalyticsDashboardSPA }> = ({ spa }) => {
    const [currentTab, setCurrentTab] = useState<TabKey>(spa.currentTab);
    const [stats, setStats] = useState<SummaryStats>(() => (spa.dataUtils?.getSummaryStats() || { totalCards: 0, dueToday: 0, trueRetention: 0 }) as SummaryStats);
    const [examRecall, setExamRecall] = useState<number>(() => (spa.dataUtils ? spa.dataUtils.getExamReadinessStats(12).overallRecall || 0 : 0));
    const [subtitle, setSubtitle] = useState<string>('Loading analytics...');

    useEffect(() => {
        const updateState = () => {
            if (spa.dataUtils) {
                const s = spa.dataUtils.getSummaryStats();
                setStats(s);
                const r = spa.dataUtils.getExamReadinessStats(12).overallRecall || 0;
                setExamRecall(r);
                setSubtitle(`${s.totalCards || 0} patterns tracked · ${s.totalActivityReviews || 0} total reviews · ${s.trueRetention || 0}% retention rate`);
            }
        };

        (spa as any).onStateChange = () => {
            updateState();
            setCurrentTab(spa.currentTab);
        };

        updateState();
        if (spa.dataUtils) {
            spa.switchTab(spa.currentTab);
        }
    }, [spa]);

    const handleSelectTab = (tab: TabKey) => {
        setCurrentTab(tab);
        spa.switchTab(tab);
    };

    return (
        <div class="dashboard-layout">
            <AnalyticsSidebar currentTab={currentTab} onSelectTab={handleSelectTab} />
            <main class="main-content">
                <AnalyticsHeader
                    title={spa.tabTitles[currentTab] || 'Overview'}
                    subtitle={subtitle}
                    stats={stats}
                    examRecall={examRecall}
                />
                <div class="tab-content-container">
                    <div id="tab-overview" class={`tab-pane ${currentTab === 'overview' ? 'active' : ''}`} />
                    <div id="tab-readiness" class={`tab-pane ${currentTab === 'readiness' ? 'active' : ''}`} />
                    <div id="tab-memory" class={`tab-pane ${currentTab === 'memory' ? 'active' : ''}`} />
                    <div id="tab-simulation" class={`tab-pane ${currentTab === 'simulation' ? 'active' : ''}`} />
                    <div id="tab-tags" class={`tab-pane ${currentTab === 'tags' ? 'active' : ''}`} />
                    <div id="tab-performance" class={`tab-pane ${currentTab === 'performance' ? 'active' : ''}`} />
                    <div id="tab-insights" class={`tab-pane ${currentTab === 'insights' ? 'active' : ''}`} />
                </div>
            </main>
        </div>
    );
};

/**
 * Central coordinator and tab router for the Analytics Dashboard SPA.
 */
export class AnalyticsDashboardSPA {
    /** Shared statistical calculation engine instance, or null before initialization. */
    dataUtils: DataUtils | null;
    /** Currently active tab identifier. */
    currentTab: TabKey;
    /** Map of tab identifiers to instantiated tab view controllers. */
    tabs: Record<TabKey, AnalyticsTabComponent | null>;
    /** Human-readable display titles for each tab. */
    tabTitles: Record<TabKey, string>;

    /**
     * Initializes default SPA state, configuring tabs and title mapping.
     */
    constructor() {
        this.dataUtils = null;
        this.currentTab = 'overview';
        
        // Tab Controllers
        this.tabs = {
            overview: null,
            readiness: null,
            memory: null,
            simulation: null,
            tags: null,
            performance: null,
            insights: null
        };
        
        this.tabTitles = {
            overview: 'Overview',
            readiness: 'Exam Readiness Forecast',
            memory: 'Memory Retention',
            simulation: 'Future Memory Simulation',
            tags: 'Tag Analytics',
            performance: 'Performance & Recovery',
            insights: 'Behavioral Insights'
        };
    }

    /**
     * Initializes the Analytics Dashboard SPA by reading cards and activity logs from storage,
     * instantiating {@link DataUtils} and sub-tab controllers, and binding UI navigation.
     * @listens chrome.storage.local
     */
    init(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<AnalyticsApp spa={this} />, root);
            }

            chrome.storage.local.get(['fsrsCards', 'fsrsActivity'], (result: StorageData) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('AnalyticsDashboardSPA', `Storage error fetching cards and activity: ${errorMessage}`, { error: lastError });
                        return;
                    }

                    const cards: Card[] = result.fsrsCards || [];
                    const activity: Record<string, number> = result.fsrsActivity || {};
                    
                    const initializeDataUtils = () => {
                        try {
                            const SchedulerClass = (window as unknown as { FsrsScheduler?: new () => AbstractScheduler }).FsrsScheduler;
                            const scheduler = typeof SchedulerClass === 'function' ? new SchedulerClass() : null;
                            this.dataUtils = new DataUtils(cards, activity, scheduler);
                            
                            // Initialize tab controllers
                            this.tabs.overview = new OverviewTab(this.dataUtils);
                            this.tabs.readiness = new ReadinessTab(this.dataUtils);
                            this.tabs.memory = new MemoryTab(this.dataUtils);
                            this.tabs.simulation = new FutureMemorySimulation(this.dataUtils);
                            this.tabs.tags = new TagsTab(this.dataUtils);
                            this.tabs.performance = new PerformanceTab(this.dataUtils);
                            this.tabs.insights = new InsightsTab(this.dataUtils);

                            // Set up subtitle and global header KPIs
                            const stats = this.dataUtils.getSummaryStats();
                            const subtitleElem = document.getElementById('analytics-subtitle');
                            if (subtitleElem) {
                                subtitleElem.innerHTML = `${stats.totalCards} patterns tracked &middot; ${stats.totalActivityReviews} total reviews &middot; ${stats.trueRetention}% retention rate`;
                            }

                            this.updateGlobalKPIs(stats);
                            this.bindNavigation();
                            if ((this as any).onStateChange) {
                                (this as any).onStateChange();
                            }
                            
                            // Render initial tab
                            this.switchTab('overview');
                        } catch (utilsErr) {
                            const errorMessage = utilsErr instanceof Error ? utilsErr.message : String(utilsErr);
                            Logger.error('AnalyticsDashboardSPA', `Error initializing DataUtils and Tab controllers: ${errorMessage}`, { utilsErr });
                        }
                    };

                    // If FsrsScheduler is bundled with WASM and loaded asynchronously, we wait for it
                    const win = window as unknown as { FsrsScheduler?: unknown };
                    if (win.FsrsScheduler === undefined) {
                        let retries = 0;
                        const interval = setInterval(() => {
                            try {
                                if (win.FsrsScheduler !== undefined || retries > 50) { // 5 seconds max
                                    clearInterval(interval);
                                    initializeDataUtils();
                                }
                                retries++;
                            } catch (timerErr) {
                                clearInterval(interval);
                                const errorMessage = timerErr instanceof Error ? timerErr.message : String(timerErr);
                                Logger.error('AnalyticsDashboardSPA', `Error during FsrsScheduler waiting interval: ${errorMessage}`, { timerErr });
                            }
                        }, 100);
                    } else {
                        initializeDataUtils();
                    }
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('AnalyticsDashboardSPA', `Error during Analytics SPA init storage callback: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('AnalyticsDashboardSPA', `Failed storage get in Analytics init: ${errorMessage}`, { err });
        }
    }

    /**
     * Binds click events to the sidebar tab navigation buttons.
     */
    bindNavigation(): void {
        try {
            const navBtns = document.querySelectorAll('.nav-btn');
            navBtns.forEach(btn => {
                btn.addEventListener('click', (e: Event) => {
                    try {
                        const currentTarget = e.currentTarget as HTMLElement;
                        const targetTab = currentTarget.dataset.tab as TabKey;
                        
                        // Update UI state
                        navBtns.forEach(b => b.classList.remove('active'));
                        currentTarget.classList.add('active');
                        
                        if (targetTab) {
                            this.switchTab(targetTab);
                        }
                    } catch (navErr) {
                        const errorMessage = navErr instanceof Error ? navErr.message : String(navErr);
                        Logger.error('AnalyticsDashboardSPA', `Error in navigation button click handler: ${errorMessage}`, { navErr });
                    }
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('AnalyticsDashboardSPA', `Error binding analytics navigation listeners: ${errorMessage}`, { err });
        }
    }

    /**
     * Updates top-level global KPI cards (Total Cards, Retention Rate, Due Today, Exam Recall).
     * @param stats - Computed summary statistics object.
     */
    updateGlobalKPIs(stats: SummaryStats): void {
        try {
            if (!stats || !this.dataUtils) return;

            const cardsElem = document.getElementById('global-kpi-cards');
            const retentionElem = document.getElementById('global-kpi-retention');
            const dueElem = document.getElementById('global-kpi-due');
            const readinessElem = document.getElementById('global-kpi-readiness');

            const pillRetention = document.getElementById('global-kpi-pill-retention');
            const pillDue = document.getElementById('global-kpi-pill-due');
            const pillReadiness = document.getElementById('global-kpi-pill-readiness');

            const dueCount = stats.dueToday !== undefined ? stats.dueToday : (stats.due || 0);

            if (cardsElem) cardsElem.textContent = String(stats.totalCards || 0);

            // 1. Retention Rate KPI Pill
            const retentionVal = stats.trueRetention !== undefined && stats.trueRetention > 0 ? stats.trueRetention : (stats.retention || 0);
            if (retentionElem) retentionElem.textContent = `${retentionVal}%`;
            if (pillRetention) {
                pillRetention.classList.remove('success', 'warning', 'danger');
                if (retentionVal >= RECALL_THRESHOLD_GOOD) {
                    pillRetention.classList.add('success');
                } else if (retentionVal >= RECALL_THRESHOLD_WARNING) {
                    pillRetention.classList.add('warning');
                } else {
                    pillRetention.classList.add('danger');
                }
            }

            // 2. Due Today Count KPI Pill
            if (dueElem) dueElem.textContent = String(dueCount);
            if (pillDue) {
                pillDue.classList.remove('success', 'warning', 'danger');
                if (dueCount === 0) {
                    pillDue.classList.add('success');
                } else if (dueCount <= DUE_CARDS_THRESHOLD_WARNING) {
                    pillDue.classList.add('warning');
                } else {
                    pillDue.classList.add('danger');
                }
            }

            // 3. Exam Recall / Overall Expected Recall KPI Pill
            if (readinessElem) {
                const readinessData = this.dataUtils.getExamReadinessStats(12);
                const recallVal = readinessData.overallRecall || 0;
                readinessElem.textContent = `${recallVal}%`;

                if (pillReadiness) {
                    pillReadiness.classList.remove('success', 'warning', 'danger');
                    if (recallVal >= RECALL_THRESHOLD_GOOD) {
                        pillReadiness.classList.add('success');
                    } else if (recallVal >= RECALL_THRESHOLD_WARNING) {
                        pillReadiness.classList.add('warning');
                    } else {
                        pillReadiness.classList.add('danger');
                    }
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('AnalyticsDashboardSPA', `Error updating global KPIs: ${errorMessage}`, { stats, err });
        }
    }

    /**
     * Switches the active tab view, updating the header title and lazy-rendering the sub-tab view.
     * @param tabId - Identifier of the tab to activate.
     */
    switchTab(tabId: TabKey): void {
        try {
            this.currentTab = tabId;
            if ((this as any).onStateChange) {
                (this as any).onStateChange();
            }
            
            // Update Title
            const titleEl = document.getElementById('current-tab-title');
            if (titleEl) {
                titleEl.textContent = this.tabTitles[tabId] || '';
            }
            
            // Hide all panes
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            
            // Show target pane
            const targetPane = document.getElementById(`tab-${tabId}`);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            
            // Lazy-render content with graceful fallback
            if (this.tabs[tabId]) {
                try {
                    this.tabs[tabId]!.render(`tab-${tabId}`);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('AnalyticsDashboardSPA', `Failed to render tab '${tabId}': ${errorMessage}`, { tabId, err });
                    
                    const container = document.getElementById(`tab-${tabId}`);
                    if (container) {
                        container.innerHTML = `<div class="error-card p-6 bg-red-900/20 border border-red-500/30 rounded-xl text-red-300">
                            <h4 class="font-bold text-lg mb-2">Failed to render ${this.tabTitles[tabId] || tabId}</h4>
                            <p class="text-sm opacity-80 mb-4">${errorMessage}</p>
                            <button onclick="window.location.reload()" class="px-4 py-2 bg-red-600/40 hover:bg-red-600/60 text-white text-xs font-semibold rounded-lg transition-colors">Reload Page</button>
                        </div>`;
                    }
                }
            }
        } catch (tabErr) {
            const errorMessage = tabErr instanceof Error ? tabErr.message : String(tabErr);
            Logger.error('AnalyticsDashboardSPA', `Error switching tab to '${tabId}': ${errorMessage}`, { tabId, tabErr });
        }
    }
}

/**
 * Bootstraps the Analytics Dashboard SPA on document load.
 */
function initSPA(): void {
    try {
        const spa = new AnalyticsDashboardSPA();
        spa.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('AnalyticsDashboardSPA', `Failed to initialize Analytics SPA: ${errorMessage}`, { err });
    }
}

try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSPA);
    } else {
        initSPA();
    }
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('AnalyticsDashboardSPA', `Error setting up DOM readiness listener: ${errorMessage}`, { err });
}

