/**
 * @file features/dashboard/analytics/analytics.js
 * @description Main controller for the full-tab Analytics SPA.
 */

import { DataUtils } from './utils/dataUtils.js';
import { OverviewTab } from './overview/overview.js';
import { MemoryTab } from './memory/memory.js';
import { TagsTab } from './tags/tags.js';
import { PerformanceTab } from './performance/performance.js';
import { InsightsTab } from './insights/insights.js';
import { ReadinessTab } from './readiness/readiness.js';

class AnalyticsDashboardSPA {
    constructor() {
        this.dataUtils = null;
        this.currentTab = 'overview';
        
        // Tab Controllers
        this.tabs = {
            overview: null,
            memory: null,
            tags: null,
            performance: null,
            insights: null,
            readiness: null
        };
        
        this.tabTitles = {
            overview: 'Overview',
            memory: 'Memory Retention',
            tags: 'Tag Analytics',
            performance: 'Performance & Recovery',
            insights: 'Behavioral Insights',
            readiness: 'Exam Readiness Forecast'
        };
    }

    init() {
        chrome.storage.local.get(['fsrsCards', 'fsrsActivity'], (result) => {
            const cards = result.fsrsCards || [];
            const activity = result.fsrsActivity || {};
            
            const initializeDataUtils = () => {
                const scheduler = typeof window !== 'undefined' && window.FsrsScheduler ? new window.FsrsScheduler() : null;
                this.dataUtils = new DataUtils(cards, activity, scheduler);
                
                // Initialize tab controllers
                this.tabs.overview = new OverviewTab(this.dataUtils);
                this.tabs.memory = new MemoryTab(this.dataUtils);
                this.tabs.tags = new TagsTab(this.dataUtils);
                this.tabs.performance = new PerformanceTab(this.dataUtils);
                this.tabs.insights = new InsightsTab(this.dataUtils);
                this.tabs.readiness = new ReadinessTab(this.dataUtils);

                // Set up subtitle
                const stats = this.dataUtils.getSummaryStats();
                const subtitleElem = document.getElementById('analytics-subtitle');
                if (subtitleElem) {
                    subtitleElem.innerHTML = `${stats.totalCards} patterns tracked &middot; ${stats.totalActivityReviews} total reviews &middot; ${stats.trueRetention}% retention rate`;
                }

                this.bindNavigation();
                
                // Render initial tab
                this.switchTab('overview');
            };

            // If FsrsScheduler is bundled with WASM and loaded asynchronously, we wait for it
            if (typeof window !== 'undefined' && window.FsrsScheduler === undefined) {
                let retries = 0;
                const interval = setInterval(() => {
                    if (window.FsrsScheduler !== undefined || retries > 50) { // 5 seconds max
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

    bindNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.dataset.tab;
                
                // Update UI state
                navBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        
        // Update Title
        document.getElementById('current-tab-title').textContent = this.tabTitles[tabId];
        
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

function initSPA() {
    const spa = new AnalyticsDashboardSPA();
    spa.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSPA);
} else {
    initSPA();
}
