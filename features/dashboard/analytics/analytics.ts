/**
 * @file features/dashboard/analytics/analytics.ts
 * @description Controller for the Analytics Dashboard Single Page Application (SPA).
 */

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

export type TabKey = 'overview' | 'readiness' | 'memory' | 'simulation' | 'tags' | 'performance' | 'insights';

export interface AnalyticsTabComponent {
    render(containerId: string): void;
}

class AnalyticsDashboardSPA {
    dataUtils: DataUtils | null;
    currentTab: TabKey;
    tabs: Record<TabKey, AnalyticsTabComponent | null>;
    tabTitles: Record<TabKey, string>;

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

    init(): void {
        try {
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

    switchTab(tabId: TabKey): void {
        try {
            this.currentTab = tabId;
            
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
                    // Comment: Catch UI rendering failure gracefully to keep remainder of Analytics SPA intact
                }
            }
        } catch (tabErr) {
            const errorMessage = tabErr instanceof Error ? tabErr.message : String(tabErr);
            Logger.error('AnalyticsDashboardSPA', `Error switching tab to '${tabId}': ${errorMessage}`, { tabId, tabErr });
        }
    }
}

function initSPA(): void {
    try {
        const spa = new AnalyticsDashboardSPA();
        spa.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('AnalyticsDashboardSPA', `Failed to initialize Analytics SPA: ${errorMessage}`, { err });
        // Comment: Non-fatal global initialization catch
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
