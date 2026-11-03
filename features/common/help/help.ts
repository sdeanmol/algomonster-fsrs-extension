/**
 * @file Interactive Help Center Single Page Application
 * @module features/common/help/help
 * @context Extension Help Page (features/common/help/help.html)
 * @description Controls the in-extension user documentation, FAQ, guide navigation,
 * dynamic browser/store policy branding, URL hash routing (#tab-id), and live keyword search filtering.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';
import { BROWSER_CONFIG } from '@common/browserConfig';

/**
 * Controller class governing Help Center tabs, search, and browser-specific branding.
 */
export class HelpCenterSPA {
    /** Identifier of the currently active documentation tab (e.g. 'overview', 'shortcuts') */
    currentTab: string;

    /**
     * Initializes default tab selection to 'overview'.
     */
    constructor() {
        this.currentTab = 'overview';
    }

    /**
     * Bootstraps Help Center tabs from URL query parameters or hash fragments,
     * binds event handlers, and renders browser-specific policy text.
     */
    init(): void {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab') || this.getTabFromHash();
            if (tabParam) {
                this.switchTab(tabParam, true);
                this.smoothScrollToTab(tabParam);
            }
            this.bindTabNavigation();
            this.bindSearchFilter();
            this.bindCloseButton();
            this.bindHashNavigation();
            this.renderBrowserSpecificContent();
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error initializing Help Center', err);
        }
    }

    /**
     * Dynamically injects browser and marketplace brand names (Chrome Web Store, Firefox Add-ons, App Store)
     * into store policy labels based on `BROWSER_CONFIG`.
     */
    renderBrowserSpecificContent(): void {
        try {
            const storePolicyEl = document.getElementById('help-store-policy-name');
            if (storePolicyEl) {
                storePolicyEl.textContent = `${BROWSER_CONFIG.storeName} (${BROWSER_CONFIG.displayName})`;
            }
            const dataCertTitleEl = document.getElementById('help-data-certification-title');
            if (dataCertTitleEl) {
                dataCertTitleEl.textContent = `📜 ${BROWSER_CONFIG.storeName} Data Use Certification`;
            }
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error rendering browser-specific content in Help Center', err);
        }
    }

    /**
     * Attaches click handlers to tab navigation buttons (`.tab-btn`) and internal cross-tab links (`[data-switch-tab]`).
     */
    bindTabNavigation(): void {
        try {
            const tabButtons = document.querySelectorAll('.tab-btn');

            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    try {
                        const targetTab = button.getAttribute('data-tab');
                        if (targetTab) {
                            this.switchTab(targetTab);
                        }
                    } catch (err) {
                        UIUtils.catchError('HelpCenter', 'Error handling tab button click', err);
                    }
                });
            });

            const switchTabLinks = document.querySelectorAll('[data-switch-tab]');
            switchTabLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    try {
                        e.preventDefault();
                        const targetTab = link.getAttribute('data-switch-tab');
                        if (targetTab) {
                            this.switchTab(targetTab);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    } catch (err) {
                        UIUtils.catchError('HelpCenter', 'Error handling switch tab link click', err);
                    }
                });
            });
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error binding tab navigation', err);
        }
    }

    /**
     * Switches the active documentation pane, resetting inline searches and updating ARIA attributes.
     * @param tabId - Target tab identifier string.
     * @param shouldScrollTabList - Whether to scroll the active tab button into view within the tab bar.
     */
    switchTab(tabId: string, shouldScrollTabList: boolean = true): void {
        try {
            this.currentTab = tabId;
            const tabButtons = document.querySelectorAll('.tab-btn');
            const tabPanes = document.querySelectorAll('.tab-pane');
            const allCards = document.querySelectorAll('.card, .gamify-card, .strategy-card');

            // Reset card inline displays
            allCards.forEach((card: Element) => (card as HTMLElement).style.display = '');

            const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
            if (searchInput) {
                searchInput.value = '';
            }

            tabButtons.forEach(btn => {
                const isTarget = btn.getAttribute('data-tab') === tabId;
                btn.classList.toggle('active', isTarget);
                btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
            });

            tabPanes.forEach(pane => {
                pane.classList.toggle('active', pane.id === `tab-${tabId}`);
            });

            if (shouldScrollTabList) {
                this.smoothScrollToTab(tabId);
            }
        } catch (err) {
            UIUtils.catchError('HelpCenter', `Error switching tab to '${tabId}'`, err, { tabId });
        }
    }

    /**
     * Smoothly scrolls the active tab button into center alignment inside the tab bar container.
     * @param tabId - Target tab identifier.
     */
    smoothScrollToTab(tabId: string): void {
        try {
            const scrollAction = () => {
                const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`) as HTMLElement | null;
                const tablist = document.querySelector('.tabs-container[role="tablist"], [role="tablist"]') as HTMLElement | null;

                if (!targetBtn) return;

                if (typeof targetBtn.scrollIntoView === 'function') {
                    try {
                        targetBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    } catch {
                        targetBtn.scrollIntoView(false);
                    }
                }

                if (tablist && typeof tablist.scrollTo === 'function') {
                    const scrollLeft = targetBtn.offsetLeft - (tablist.clientWidth / 2) + (targetBtn.clientWidth / 2);
                    tablist.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
                }
            };

            scrollAction();
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(() => {
                    setTimeout(scrollAction, 100);
                });
            }
        } catch (err) {
            UIUtils.catchError('HelpCenter', `Error smooth scrolling to tab '${tabId}'`, err);
        }
    }

    /**
     * Parses the current window URL hash (e.g. `#shortcuts` or `#tab-shortcuts`) to find a matching tab ID.
     * @returns Extracted tab ID string or null if absent/invalid.
     */
    getTabFromHash(): string | null {
        try {
            if (typeof window === 'undefined' || !window.location || !window.location.hash) return null;
            const hash = window.location.hash.replace(/^#/, '');
            if (!hash) return null;
            const cleanHash = hash.startsWith('tab-') ? hash.substring(4) : hash;
            const targetBtn = document.querySelector(`.tab-btn[data-tab="${cleanHash}"]`);
            return targetBtn ? cleanHash : null;
        } catch {
            return null;
        }
    }

    /**
     * Listens for `hashchange` browser events and triggers tab switching.
     */
    bindHashNavigation(): void {
        try {
            if (typeof window === 'undefined') return;
            window.addEventListener('hashchange', () => {
                const tab = this.getTabFromHash();
                if (tab) {
                    this.switchTab(tab, true);
                }
            });
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error binding hash navigation', err);
        }
    }

    /**
     * Binds input event listeners to `#help-search-input` for real-time document filtering.
     */
    bindSearchFilter(): void {
        try {
            const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
            if (!searchInput) return;

            searchInput.addEventListener('input', (e: Event) => {
                try {
                    const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
                    this.filterContent(query);
                } catch (err) {
                    UIUtils.catchError('HelpCenter', 'Error in help search input handler', err);
                }
            });
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error binding search filter', err);
        }
    }

    /**
     * Filters help cards and guides across all panes matching the search keyword,
     * highlighting matching tab headers and revealing panes containing matches.
     * @param query - Search keyword substring.
     */
    filterContent(query: string): void {
        try {
            const allCards = document.querySelectorAll('.card, .gamify-card, .strategy-card');
            const tabPanes = document.querySelectorAll('.tab-pane');
            const tabButtons = document.querySelectorAll('.tab-btn');

            if (!query) {
                // Restore normal tab mode
                allCards.forEach((card: Element) => (card as HTMLElement).style.display = '');
                tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === `tab-${this.currentTab}`));
                tabButtons.forEach(btn => {
                    const isTarget = btn.getAttribute('data-tab') === this.currentTab;
                    btn.classList.toggle('active', isTarget);
                    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
                });
                return;
            }

            // Search mode: show matching cards and reveal their tab panes
            let matchFound = false;

            tabPanes.forEach(pane => {
                let paneHasMatch = false;
                const cardsInPane = pane.querySelectorAll('.card, .gamify-card, .strategy-card');

                cardsInPane.forEach((card: Element) => {
                    const text = card.textContent?.toLowerCase() || '';
                    const isMatch = text.includes(query);
                    (card as HTMLElement).style.display = isMatch ? '' : 'none';
                    if (isMatch) paneHasMatch = true;
                });

                pane.classList.toggle('active', paneHasMatch);
                if (paneHasMatch) matchFound = true;
            });

            // Highlight tabs containing matches
            tabButtons.forEach(btn => {
                const tabId = btn.getAttribute('data-tab');
                const targetPane = document.getElementById(`tab-${tabId}`);
                const hasMatch = targetPane && targetPane.querySelectorAll('.card:not([style*="display: none"]), .gamify-card:not([style*="display: none"]), .strategy-card:not([style*="display: none"])').length > 0;
                btn.classList.toggle('active', !!hasMatch);
            });
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error filtering help content', err, { query });
        }
    }

    /**
     * Binds click listener to close the Help Center tab via `chrome.tabs.remove` or `window.close`.
     */
    bindCloseButton(): void {
        try {
            const closeBtn = document.getElementById('close-help-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    try {
                        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.getCurrent) {
                            chrome.tabs.getCurrent((tab) => {
                                if (tab && tab.id) {
                                    chrome.tabs.remove(tab.id);
                                } else {
                                    window.close();
                                }
                            });
                        } else {
                            window.close();
                        }
                    } catch (err) {
                        UIUtils.catchError('HelpCenter', 'Error closing Help Center window', err);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error binding close button', err);
        }
    }
}

/**
 * Bootstrap entry function initializing `HelpCenterSPA` upon DOM readiness.
 */
function initHelpCenter(): void {
    try {
        const helpCenter = new HelpCenterSPA();
        helpCenter.init();
    } catch (err) {
        UIUtils.catchError('HelpCenter', 'Error instantiating HelpCenterSPA', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHelpCenter);
    } else {
        initHelpCenter();
    }
}
