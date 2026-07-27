import { DataUtils } from './utils/dataUtils';
import { OverviewTab } from './overview/overview';
import { MemoryTab } from './memory/memory';
import { TagsTab } from './tags/tags';
import { PerformanceTab } from './performance/performance';
import { InsightsTab } from './insights/insights';
import { ReadinessTab } from './readiness/readiness';
import { FutureMemorySimulation } from './memory/futureMemorySimulation';

export type TabKey = 'overview' | 'readiness' | 'memory' | 'simulation' | 'tags' | 'performance' | 'insights';

class AnalyticsDashboardSPA {
    dataUtils: DataUtils | null;
    currentTab: TabKey;
    tabs: Record<TabKey, any>;
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
        chrome.storage.local.get(['fsrsCards', 'fsrsActivity'], (result: { [key: string]: any }) => {
            const cards = result.fsrsCards || [];
            const activity = result.fsrsActivity || {};
            
            const initializeDataUtils = () => {
                const scheduler = typeof window !== 'undefined' && (window as any).FsrsScheduler ? new (window as any).FsrsScheduler() : null;
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
            };

            // If FsrsScheduler is bundled with WASM and loaded asynchronously, we wait for it
            if (typeof window !== 'undefined' && (window as any).FsrsScheduler === undefined) {
                let retries = 0;
                const interval = setInterval(() => {
                    if ((window as any).FsrsScheduler !== undefined || retries > 50) { // 5 seconds max
                        clearInterval(interval);
                        initializeDataUtils();
                    }
                    retries++;
                }, 100);
            } else {
                initializeDataUtils();
            }
        });
    }

    bindNavigation(): void {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', (e: Event) => {
                const currentTarget = e.currentTarget as HTMLElement;
                const targetTab = currentTarget.dataset.tab as TabKey;
                
                // Update UI state
                navBtns.forEach(b => b.classList.remove('active'));
                currentTarget.classList.add('active');
                
                if (targetTab) {
                    this.switchTab(targetTab);
                }
            });
        });
    }

    updateGlobalKPIs(stats: any): void {
        if (!stats || !this.dataUtils) return;

        const cardsElem = document.getElementById('global-kpi-cards');
        const retentionElem = document.getElementById('global-kpi-retention');
        const dueElem = document.getElementById('global-kpi-due');
        const readinessElem = document.getElementById('global-kpi-readiness');

        const dueCount = stats.dueToday !== undefined ? stats.dueToday : (stats.due || 0);

        if (cardsElem) cardsElem.textContent = String(stats.totalCards || 0);
        if (retentionElem) retentionElem.textContent = `${stats.trueRetention || 0}%`;
        if (dueElem) dueElem.textContent = String(dueCount);

        if (readinessElem) {
            const readinessData = this.dataUtils.getExamReadinessStats(12) as any;
            readinessElem.textContent = `${readinessData.overallRecall || 0}%`;
        }
    }

    switchTab(tabId: TabKey): void {
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
        
        // Lazy-render content
        if (this.tabs[tabId]) {
            this.tabs[tabId].render(`tab-${tabId}`);
        }
    }
}

function initSPA(): void {
    const spa = new AnalyticsDashboardSPA();
    spa.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSPA);
} else {
    initSPA();
}
