/**
 * @file features/common/websites/websites.js
 * @description Manages whitelist configurations for sites where the extension content scripts are active.
 * Integrates dynamic permissions requests for custom domains, and registers content scripts
 * programmatically using the Chrome Extension Scripting API.
 */
class WhitelistedWebsitesManager {
    constructor() {
        this.defaultSitesList = [
            { domain: "algo.monster", isDefault: true },
            { domain: "systemdesignschool.io", isDefault: true },
            { domain: "codeforces.com", isDefault: true },
            { domain: "leetcode.com", isDefault: true },
            { domain: "codechef.com", isDefault: true },
            { domain: "atcoder.jp", isDefault: true },
            { domain: "hackerrank.com", isDefault: true },
            { domain: "hackerearth.com", isDefault: true },
            { domain: "codewars.com", isDefault: true },
            { domain: "codingame.com", isDefault: true }
        ];
    }

    /**
     * Initializes whitelist displays and registers default clicks.
     */
    init() {
        // Initial Render
        this.loadAndRenderSites();

        // Register static event listeners
        this.bindEvents();
    }

    /**
     * Registers control listeners for inputs and configuration triggers.
     */
    bindEvents() {
        // Close button
        document.getElementById('back-to-popup-btn').addEventListener('click', () => {
            window.close();
        });

        // Add website domain
        document.getElementById('add-domain-btn').addEventListener('click', () => this.handleAddWebsite());
        
        // Allow pressing Enter key in text input
        document.getElementById('domain-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddWebsite();
        });

        // Restore Defaults button
        document.getElementById('restore-defaults-btn').addEventListener('click', () => this.restoreDefaults());
    }

    /**
     * Loads authorized website structures from storage and builds whitelist list rows.
     */
    loadAndRenderSites() {
        const list = document.getElementById('whitelisted-sites-list');
        if (!list) return;

        chrome.storage.local.get(['whitelistedWebsites'], (result) => {
            let sites = result.whitelistedWebsites;
            if (!sites) {
                // First time: initialize storage with default list
                sites = [...this.defaultSitesList.map(s => ({ ...s }))];
                chrome.storage.local.set({ whitelistedWebsites: sites });
            }

            if (sites.length === 0) {
                list.innerHTML = `<li style="justify-content: center; color: var(--md-text-low); font-style: italic;">No whitelisted websites. Add one to get started!</li>`;
                return;
            }

            list.innerHTML = sites.map(site => {
                const monogram = site.domain.substring(0, 1).toUpperCase();
                const badge = site.isDefault 
                    ? `<span class="site-badge protected" style="margin-right: 8px;">Default</span>` 
                    : ``;
                const colorClass = site.isDefault ? '' : 'style="color: var(--md-success); border-color: rgba(30, 142, 62, 0.15);"';
                return `
                    <li>
                        <div class="site-name-wrapper">
                            <div class="site-icon-fallback" ${colorClass}>${monogram}</div>
                            <span>${site.domain}</span>
                        </div>
                        <div style="display: flex; align-items: center;">
                            ${badge}
                            <button class="delete-site-btn" data-site="${site.domain}" title="Delete platform whitelisting">
                                <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </li>
                `;
            }).join('');

            // Link delete buttons
            document.querySelectorAll('.delete-site-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const button = e.currentTarget;
                    const siteDomain = button.getAttribute('data-site');
                    this.handleDeleteWebsite(siteDomain);
                });
            });
        });
    }

    /**
     * Validates domain input strings, requests host permission rules,
     * and dynamically registers associated content script matches.
     */
    handleAddWebsite() {
        const input = document.getElementById('domain-input');
        let value = input.value.trim().toLowerCase();
        if (!value) return;

        try {
            if (!value.startsWith('http://') && !value.startsWith('https://')) {
                value = 'https://' + value;
            }
            const url = new URL(value);
            let hostname = url.hostname;
            if (hostname.startsWith('www.')) {
                hostname = hostname.substring(4);
            }

            if (!hostname) {
                this.showToast("Invalid domain name.");
                return;
            }

            chrome.storage.local.get(['whitelistedWebsites'], (result) => {
                const sites = result.whitelistedWebsites || [...this.defaultSitesList.map(s => ({ ...s }))];
                if (sites.some(s => s.domain === hostname)) {
                    this.showToast("Website is already whitelisted.");
                    return;
                }

                // Request host permission
                const originPattern = `*://*.${hostname}/*`;

                chrome.permissions.request({
                    origins: [originPattern]
                }, (granted) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                        this.showToast("Error requesting domain permission.");
                        return;
                    }

                    if (granted) {
                        // Register content script dynamically
                        chrome.scripting.registerContentScripts([
                            {
                                id: `site-${hostname.replace(/[^a-z0-9]/g, '-')}`,
                                matches: [originPattern],
                                js: ["content/fsrs.js", "content/content.js"],
                                css: ["content/style.css"],
                                runAt: "document_idle",
                                allFrames: true
                            }
                        ], () => {
                            if (chrome.runtime.lastError) {
                                console.error("Script registration error:", chrome.runtime.lastError.message);
                            }

                            // Save to storage
                            sites.push({ domain: hostname, isDefault: false });
                            chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                                input.value = '';
                                this.loadAndRenderSites();
                                this.showToast(`Authorized & Whitelisted: ${hostname}`);
                            });
                        });
                    } else {
                        this.showToast("Permission request was declined.");
                    }
                });
            });
        } catch (e) {
            this.showToast("Please enter a valid URL or domain.");
        }
    }

    /**
     * Revokes host origin permissions and dynamic scripts, then updates storage list.
     * @param {string} siteDomain - Normalized domain name.
     */
    handleDeleteWebsite(siteDomain) {
        chrome.storage.local.get(['whitelistedWebsites'], (result) => {
            let sites = result.whitelistedWebsites || [...this.defaultSitesList.map(s => ({ ...s }))];
            const site = sites.find(s => s.domain === siteDomain);
            if (!site) return;

            const performStorageDelete = () => {
                sites = sites.filter(s => s.domain !== siteDomain);
                chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                    this.loadAndRenderSites();
                    this.showToast(`Removed access for: ${siteDomain}`);
                });
            };

            if (site.isDefault) {
                // For default sites, we don't need to unregister script/permissions
                // Just delete from whitelistedWebsites storage!
                performStorageDelete();
            } else {
                // For custom sites, revoke dynamic permission and unregister script
                const originPattern = `*://*.${siteDomain}/*`;
                const scriptId = `site-${siteDomain.replace(/[^a-z0-9]/g, '-')}`;

                chrome.scripting.unregisterContentScripts({
                    ids: [scriptId]
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn("Script unregister warning:", chrome.runtime.lastError.message);
                    }

                    chrome.permissions.remove({
                        origins: [originPattern]
                    }, (removed) => {
                        if (chrome.runtime.lastError) {
                            console.warn("Permission remove warning:", chrome.runtime.lastError.message);
                        }
                        performStorageDelete();
                    });
                });
            }
        });
    }

    /**
     * Restores initial hardcoded whitelisted platforms.
     */
    restoreDefaults() {
        chrome.storage.local.get(['whitelistedWebsites'], (result) => {
            let currentSites = result.whitelistedWebsites || [];
            
            // Find custom sites that we want to keep
            const customSites = currentSites.filter(s => !s.isDefault);
            
            // Merge default list and user's custom sites
            const restoredList = [...this.defaultSitesList.map(s => ({ ...s })), ...customSites];
            
            chrome.storage.local.set({ whitelistedWebsites: restoredList }, () => {
                this.loadAndRenderSites();
                this.showToast("Default platforms restored!");
            });
        });
    }

    /**
     * Shows temporary toast alerts.
     * @param {string} msg - Message payload.
     */
    showToast(msg) {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.className = 'toast show';
        setTimeout(() => {
            toast.className = 'toast';
        }, 2500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const manager = new WhitelistedWebsitesManager();
    manager.init();
});
