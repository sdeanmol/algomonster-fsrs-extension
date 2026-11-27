/**
 * @file Interactive Help Center Single Page Application (Preact)
 * @module features/common/help/help
 * @context Extension Help Page (features/common/help/help.html)
 * @description Controls the in-extension user documentation, FAQ, guide navigation,
 * dynamic browser/store policy branding, URL hash routing (#tab-id), and live keyword search filtering.
 */

import { h, render, JSX } from 'preact';
import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { UIUtils } from '../utils/uiUtils';
import {
    OverviewTabContent,
    FsrsTabContent,
    HighlighterTabContent,
    AnalyticsTabContent,
    GamificationTabContent,
    AdvancedTabContent,
    PrivacyTabContent
} from './helpContent';

export interface HelpTabItem {
    id: string;
    label: string;
}

/**
 * Props for the HelpTabBar component.
 */
export interface HelpTabBarProps {
    /** List of tab descriptor objects */
    tabs: HelpTabItem[];
    /** Identifier of the currently active tab */
    activeTab: string;
    /** Optional set of tab IDs to highlight during active search */
    highlightedTabs?: Set<string>;
    /** Callback invoked when a tab button is clicked */
    onSelect: (tabId: string) => void;
}

/**
 * Preact Component for rendering the accessible Help Center tab bar.
 */
export function HelpTabBar({
    tabs,
    activeTab,
    highlightedTabs,
    onSelect
}: HelpTabBarProps): JSX.Element {
    return (
        <nav className="tabs-container" role="tablist">
            {tabs.map((tab) => {
                const isActive = highlightedTabs ? highlightedTabs.has(tab.id) : tab.id === activeTab;
                return (
                    <button
                        key={tab.id}
                        className={`tab-btn ${isActive ? 'active' : ''}`}
                        data-tab={tab.id}
                        role="tab"
                        aria-selected={isActive ? 'true' : 'false'}
                        onClick={() => onSelect(tab.id)}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </nav>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDARD HELP TABS CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard tab navigation items for the Help Center documentation chapters.
 */
export const DEFAULT_HELP_TABS: HelpTabItem[] = [
    { id: 'overview', label: '🚀 Getting Started & Strategy' },
    { id: 'fsrs', label: '🧠 AlgoRecall Engine' },
    { id: 'highlighter', label: '🖍️ Highlighter & Notes' },
    { id: 'analytics', label: '📊 Analytics & Science' },
    { id: 'gamification', label: '🎮 Gamification & Focus' },
    { id: 'advanced', label: '⚙️ Advanced, Anki & Licensing' },
    { id: 'privacy', label: '🛡️ Privacy & Data Policy' }
];

// ─────────────────────────────────────────────────────────────────────────────
// HELP CENTER HEADLESS CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Headless controller class governing Help Center tabs, search, and navigation.
 * Contains ZERO imperative DOM manipulation.
 */
export class HelpCenterSPA {
    /** Identifier of the currently active documentation tab */
    currentTab: string;
    /** Active search query */
    searchQuery: string = '';
    /** Observer callback notifying root component of tab changes */
    onTabChange?: (tabId: string) => void;
    /** Observer callback notifying root component of search query changes */
    onSearchChange?: (query: string) => void;

    constructor() {
        this.currentTab = 'overview';
    }

    /**
     * Bootstraps Help Center tabs from URL query parameters or hash fragments.
     */
    init(): void {
        try {
            if (typeof window !== 'undefined' && window.location) {
                const urlParams = new URLSearchParams(window.location.search);
                const tabParam = urlParams.get('tab') || this.getTabFromHash();
                if (tabParam) {
                    this.switchTab(tabParam, true);
                }
            }
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error initializing Help Center', err);
        }
    }

    /**
     * Switches the active documentation pane and resets search filter.
     */
    switchTab(tabId: string, shouldScrollTabList: boolean = true): void {
        this.currentTab = tabId;
        this.searchQuery = '';
        if (this.onTabChange) {
            this.onTabChange(tabId);
        }
        if (this.onSearchChange) {
            this.onSearchChange('');
        }
        if (shouldScrollTabList) {
            this.smoothScrollToTab(tabId);
        }
    }

    /**
     * Smoothly scrolls the active tab button into center alignment inside the tab bar container horizontally.
     * @param tabId - Target tab identifier.
     */
    smoothScrollToTab(tabId: string): void {
        try {
            const scrollAction = () => {
                const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`) as HTMLElement | null;
                const tablist = document.querySelector('.tabs-container') as HTMLElement | null;

                if (!targetBtn || !tablist) return;

                const scrollLeft = targetBtn.offsetLeft - (tablist.clientWidth / 2) + (targetBtn.clientWidth / 2);
                if (typeof tablist.scrollTo === 'function') {
                    tablist.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
                } else {
                    tablist.scrollLeft = Math.max(0, scrollLeft);
                }
            };

            scrollAction();
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(() => {
                    scrollAction();
                });
            }
        } catch {
            // ignore scroll errors in test environments
        }
    }

    /**
     * Parses the current window URL hash to find a matching tab ID.
     */
    getTabFromHash(): string | null {
        try {
            if (typeof window === 'undefined' || !window.location || !window.location.hash) return null;
            const hash = window.location.hash.replace(/^#/, '');
            if (!hash) return null;
            return hash.startsWith('tab-') ? hash.substring(4) : hash;
        } catch {
            return null;
        }
    }

    /**
     * Filters help cards and guides matching the search keyword.
     */
    filterContent(query: string): void {
        this.searchQuery = query;
        if (this.onSearchChange) {
            this.onSearchChange(query);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the root HelpApp component.
 */
export interface HelpAppProps {
    /** Optional controller instance passed during testing */
    spa?: HelpCenterSPA;
    /** Optional custom tab list for testing */
    tabs?: HelpTabItem[];
}

/**
 * Root Preact component governing the Help Center Single Page Application.
 */
export function HelpApp({ spa: injectedSpa, tabs = DEFAULT_HELP_TABS }: HelpAppProps): JSX.Element {
    const spa = useMemo(() => injectedSpa || new HelpCenterSPA(), [injectedSpa]);
    const [currentTab, setCurrentTab] = useState<string>(() => {
        try {
            if (typeof window !== 'undefined' && window.location) {
                const urlParams = new URLSearchParams(window.location.search);
                const tabParam = urlParams.get('tab') || spa.getTabFromHash();
                if (tabParam) return tabParam;
            }
        } catch {
            // ignore
        }
        return spa.currentTab || 'overview';
    });
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [matchingTabs, setMatchingTabs] = useState<Set<string> | undefined>(undefined);
    const [hasSearchMatches, setHasSearchMatches] = useState<boolean>(true);
    const contentRef = useRef<HTMLElement>(null);
    const trimmedQuery = searchQuery.toLowerCase().trim();

    useEffect(() => {
        spa.currentTab = currentTab;
        spa.onTabChange = (newTab: string) => {
            setCurrentTab(newTab);
        };
        spa.onSearchChange = (query: string) => {
            setSearchQuery(query);
        };

        const handleHash = () => {
            const tab = spa.getTabFromHash();
            if (tab) {
                setCurrentTab(tab);
                spa.switchTab(tab, true);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('hashchange', handleHash);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('hashchange', handleHash);
            }
        };
    }, [spa, currentTab]);

    useEffect(() => {
        const timer = setTimeout(() => {
            spa.smoothScrollToTab(currentTab);
        }, 50);
        return () => clearTimeout(timer);
    }, [spa, currentTab]);

    useEffect(() => {
        const container = contentRef.current;
        if (!container) return;

        const allCards = container.querySelectorAll('.card, .gamify-card, .strategy-card');
        const tabPanes = container.querySelectorAll('.tab-pane');

        if (!trimmedQuery) {
            allCards.forEach((card) => {
                (card as HTMLElement).style.display = '';
            });
            tabPanes.forEach((pane) => {
                pane.classList.toggle('active', pane.id === `tab-${currentTab}`);
            });
            setMatchingTabs(undefined);
            setHasSearchMatches(true);
            return;
        }

        const nextMatchingTabs = new Set<string>();
        let anyMatch = false;

        tabPanes.forEach((pane) => {
            let paneHasMatch = false;
            const cardsInPane = pane.querySelectorAll('.card, .gamify-card, .strategy-card');
            cardsInPane.forEach((card) => {
                const text = card.textContent?.toLowerCase() || '';
                const isMatch = text.includes(trimmedQuery);
                (card as HTMLElement).style.display = isMatch ? '' : 'none';
                if (isMatch) paneHasMatch = true;
            });
            pane.classList.toggle('active', paneHasMatch);
            if (paneHasMatch) {
                anyMatch = true;
                const tabId = pane.id.startsWith('tab-') ? pane.id.slice(4) : pane.id;
                nextMatchingTabs.add(tabId);
            }
        });

        setMatchingTabs(nextMatchingTabs);
        setHasSearchMatches(anyMatch);
    }, [trimmedQuery, currentTab]);

    const handleSelectTab = useCallback((tabId: string) => {
        setCurrentTab(tabId);
        spa.switchTab(tabId);
    }, [spa]);

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
        spa.filterContent(query);
    }, [spa]);

    const handleClose = useCallback(() => {
        UIUtils.closeCurrentTab();
    }, []);

    return (
        <div className="container">
            {/* Embedded styles for reactive tab pane display and search filtering */}
            <style>{`
                .tab-pane { display: none !important; }
                ${trimmedQuery
                    ? `.tab-pane.active { display: block !important; }`
                    : `#tab-${currentTab} { display: block !important; }`
                }
            `}</style>

            {/* Header: Brand badge, title, live search box, and close button */}
            <header className="header">
                <div className="header-title-container">
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1>Help Center</h1>
                    <p className="subtitle">Complete interactive guide, feature manuals, and optimal study strategies</p>
                </div>
                <div className="header-actions">
                    <div className="search-box">
                        <svg className="svg-icon search-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            id="help-search-input"
                            placeholder="Search any feature (e.g. Anki, FSRS, Simulation)..."
                            aria-label="Search help topics"
                            value={searchQuery}
                            onInput={(e) => handleSearch((e.target as HTMLInputElement).value)}
                        />
                    </div>
                    <button id="close-help-btn" className="btn btn-secondary" onClick={handleClose}>
                        Close Guide
                    </button>
                </div>
            </header>

            {/* Navigation Tabs */}
            <HelpTabBar
                tabs={tabs}
                activeTab={currentTab}
                highlightedTabs={matchingTabs}
                onSelect={handleSelectTab}
            />

            {/* Tab Contents */}
            <main className="tab-content-container" ref={contentRef}>
                <OverviewTabContent />
                <FsrsTabContent />
                <HighlighterTabContent />
                <AnalyticsTabContent />
                <GamificationTabContent />
                <AdvancedTabContent onSwitchTab={handleSelectTab} />
                <PrivacyTabContent />
                {trimmedQuery && !hasSearchMatches && (
                    <div id="help-search-empty" className="empty-state" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--md-text-med)' }}>
                        No help topics found matching &ldquo;{searchQuery.trim()}&rdquo;.
                    </div>
                )}
            </main>
        </div>
    );
}

export function initHelpCenter(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<HelpApp />, root);
        }
    } catch (err) {
        UIUtils.catchError('HelpCenter', 'Initialization failed', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHelpCenter);
    } else {
        initHelpCenter();
    }
}

export default HelpCenterSPA;
