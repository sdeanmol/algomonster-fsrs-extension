/**
 * @file features/common/websites/websites.ts
 * @description Manages whitelist configurations for sites where the extension content scripts are active.
 * Integrates dynamic permissions requests for custom domains, and registers content scripts
 * programmatically using the Chrome Extension Scripting API.
 */

import { Logger } from '@common/logger';

export interface WhitelistedSite {
    domain: string;
    isDefault: boolean;
}

export class WhitelistedWebsitesManager {
    defaultSitesList: WhitelistedSite[];

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
    init(): void {
        try {
            // Initial Render
            this.loadAndRenderSites();

            // Register static event listeners
            this.bindEvents();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('WhitelistedWebsites', `Error initializing WhitelistedWebsitesManager: ${errorMessage}`, { err });
            // Comment: Non-fatal whitelist manager setup catch
        }
    }

    /**
     * Registers control listeners for inputs and configuration triggers.
     */
    bindEvents(): void {
        try {
            // Close button
            document.getElementById('back-to-popup-btn')?.addEventListener('click', () => {
                try {
                    window.close();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('WhitelistedWebsites', `Error closing window: ${errorMessage}`, { err });
                }
            });

            // Add website domain
            document.getElementById('add-domain-btn')?.addEventListener('click', () => {
                try {
                    this.handleAddWebsite();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('WhitelistedWebsites', `Error in add domain button handler: ${errorMessage}`, { err });
                }
            });
            
            // Allow pressing Enter key in text input
            document.getElementById('domain-input')?.addEventListener('keypress', (e: KeyboardEvent) => {
                try {
                    if (e.key === 'Enter') this.handleAddWebsite();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('WhitelistedWebsites', `Error in domain input keypress handler: ${errorMessage}`, { err });
                }
            });

            // Restore Defaults button
            document.getElementById('restore-defaults-btn')?.addEventListener('click', () => {
                try {
                    this.restoreDefaults();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('WhitelistedWebsites', `Error in restore defaults button handler: ${errorMessage}`, { err });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('WhitelistedWebsites', `Error binding events: ${errorMessage}`, { err });
            // Comment: Catch event binding failure gracefully
        }
    }

    /**
     * Loads authorized website structures from storage and builds whitelist list rows.
     */
    loadAndRenderSites(): void {
        try {
            const list = document.getElementById('whitelisted-sites-list');
            if (!list) return;

            chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('WhitelistedWebsites', `Storage error loading websites: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    let sites: WhitelistedSite[] = result.whitelistedWebsites || [];
                    if (!result.whitelistedWebsites) {
                        // First time: initialize storage with default list
                        sites = [...this.defaultSitesList.map(s => ({ ...s }))];
                        chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('WhitelistedWebsites', `Error saving default websites to storage: ${errorMessage}`, { error: chrome.runtime.lastError });
                            }
                        });
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
                                    <button class="delete-site-btn" data-site="${site.domain}" title="Delete platform whitelisting" aria-label="Delete platform whitelisting">
                                        <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                </div>
                            </li>
                        `;
                    }).join('');

                    // Link delete buttons
                    document.querySelectorAll('.delete-site-btn').forEach(btn => {
                        btn.addEventListener('click', (e: Event) => {
                            try {
                                const button = e.currentTarget as HTMLElement;
                                const siteDomain = button.getAttribute('data-site');
                                if (siteDomain) {
                                    this.handleDeleteWebsite(siteDomain);
                                }
                            } catch (err) {
                                const errorMessage = err instanceof Error ? err.message : String(err);
                                Logger.error('WhitelistedWebsites', `Error in delete site button click: ${errorMessage}`, { err });
                            }
                        });
                    });
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('WhitelistedWebsites', `Error rendering whitelisted sites: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('WhitelistedWebsites', `Error loading whitelisted sites: ${errorMessage}`, { err });
            // Comment: Non-fatal rendering catch
        }
    }

    /**
     * Validates domain input strings, requests host permission rules,
     * and dynamically registers associated content script matches.
     */
    handleAddWebsite(): void {
        const input = document.getElementById('domain-input') as HTMLInputElement | null;
        if (!input) return;
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

            chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('WhitelistedWebsites', `Storage error fetching whitelistedWebsites: ${errorMessage}`, { error: chrome.runtime.lastError });
                        this.showToast("Error checking website status.");
                        return;
                    }
                    const sites: WhitelistedSite[] = result.whitelistedWebsites || [...this.defaultSitesList.map(s => ({ ...s }))];
                    if (sites.some(s => s.domain === hostname)) {
                        this.showToast("Website is already whitelisted.");
                        return;
                    }

                    // Request host permission
                    const originPattern = `*://*.${hostname}/*`;

                    chrome.permissions.request({
                        origins: [originPattern]
                    }, (granted: boolean) => {
                        try {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('WhitelistedWebsites', `Permission request error: ${errorMessage}`, { hostname, error: chrome.runtime.lastError });
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
                                    try {
                                        if (chrome.runtime.lastError) {
                                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                            Logger.error('WhitelistedWebsites', `Script registration error: ${errorMessage}`, { hostname, error: chrome.runtime.lastError });
                                        }

                                        // Save to storage
                                        sites.push({ domain: hostname, isDefault: false });
                                        chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                                            try {
                                                if (chrome.runtime.lastError) {
                                                    const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                                    Logger.error('WhitelistedWebsites', `Storage set error after script registration: ${errorMessage}`, { hostname, error: chrome.runtime.lastError });
                                                    return;
                                                }
                                                input.value = '';
                                                this.loadAndRenderSites();
                                                this.showToast(`Authorized & Whitelisted: ${hostname}`);
                                            } catch (saveErr) {
                                                const errorMessage = saveErr instanceof Error ? saveErr.message : String(saveErr);
                                                Logger.error('WhitelistedWebsites', `Error saving whitelisted website to storage: ${errorMessage}`, { saveErr });
                                            }
                                        });
                                    } catch (regErr) {
                                        const errorMessage = regErr instanceof Error ? regErr.message : String(regErr);
                                        Logger.error('WhitelistedWebsites', `Error in script registration callback: ${errorMessage}`, { regErr });
                                    }
                                });
                            } else {
                                this.showToast("Permission request was declined.");
                            }
                        } catch (permErr) {
                            const errorMessage = permErr instanceof Error ? permErr.message : String(permErr);
                            Logger.error('WhitelistedWebsites', `Error in permissions request callback: ${errorMessage}`, { permErr });
                        }
                    });
                } catch (getErr) {
                    const errorMessage = getErr instanceof Error ? getErr.message : String(getErr);
                    Logger.error('WhitelistedWebsites', `Error in storage get callback for add website: ${errorMessage}`, { getErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('WhitelistedWebsites', `Failed to parse domain input: ${errorMessage}`, { value, err });
            this.showToast("Please enter a valid URL or domain.");
        }
    }

    /**
     * Revokes host origin permissions and dynamic scripts, then updates storage list.
     */
    handleDeleteWebsite(siteDomain: string): void {
        try {
            chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('WhitelistedWebsites', `Storage error reading websites for delete: ${errorMessage}`, { siteDomain, error: chrome.runtime.lastError });
                        return;
                    }
                    let sites: WhitelistedSite[] = result.whitelistedWebsites || [...this.defaultSitesList.map(s => ({ ...s }))];
                    const site = sites.find(s => s.domain === siteDomain);
                    if (!site) return;

                    const performStorageDelete = () => {
                        try {
                            sites = sites.filter(s => s.domain !== siteDomain);
                            chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                                try {
                                    if (chrome.runtime.lastError) {
                                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                        Logger.error('WhitelistedWebsites', `Storage set error during website delete: ${errorMessage}`, { siteDomain, error: chrome.runtime.lastError });
                                        return;
                                    }
                                    this.loadAndRenderSites();
                                    this.showToast(`Removed access for: ${siteDomain}`);
                                } catch (setErr) {
                                    const errorMessage = setErr instanceof Error ? setErr.message : String(setErr);
                                    Logger.error('WhitelistedWebsites', `Error in storage set callback for delete website: ${errorMessage}`, { setErr });
                                }
                            });
                        } catch (deleteErr) {
                            const errorMessage = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
                            Logger.error('WhitelistedWebsites', `Error performing storage delete: ${errorMessage}`, { deleteErr });
                        }
                    };

                    if (site.isDefault) {
                        performStorageDelete();
                    } else {
                        const originPattern = `*://*.${siteDomain}/*`;
                        const scriptId = `site-${siteDomain.replace(/[^a-z0-9]/g, '-')}`;

                        chrome.scripting.unregisterContentScripts({
                            ids: [scriptId]
                        }, () => {
                            try {
                                if (chrome.runtime.lastError) {
                                    const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                    Logger.warn('WhitelistedWebsites', `Script unregister warning: ${errorMessage}`, { siteDomain, error: chrome.runtime.lastError });
                                }

                                chrome.permissions.remove({
                                    origins: [originPattern]
                                }, () => {
                                    try {
                                        if (chrome.runtime.lastError) {
                                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                            Logger.warn('WhitelistedWebsites', `Permission remove warning: ${errorMessage}`, { siteDomain, error: chrome.runtime.lastError });
                                        }
                                        performStorageDelete();
                                    } catch (permRemoveErr) {
                                        const errorMessage = permRemoveErr instanceof Error ? permRemoveErr.message : String(permRemoveErr);
                                        Logger.error('WhitelistedWebsites', `Error in permissions remove callback: ${errorMessage}`, { permRemoveErr });
                                    }
                                });
                            } catch (unregErr) {
                                const errorMessage = unregErr instanceof Error ? unregErr.message : String(unregErr);
                                Logger.error('WhitelistedWebsites', `Error in script unregister callback: ${errorMessage}`, { unregErr });
                            }
                        });
                    }
                } catch (getErr) {
                    const errorMessage = getErr instanceof Error ? getErr.message : String(getErr);
                    Logger.error('WhitelistedWebsites', `Error in storage get callback for delete website: ${errorMessage}`, { getErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('WhitelistedWebsites', `Error deleting website '${siteDomain}': ${errorMessage}`, { siteDomain, err });
        }
    }

    /**
     * Restores initial hardcoded whitelisted platforms.
     */
    restoreDefaults(): void {
        try {
            chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('WhitelistedWebsites', `Storage error fetching websites for restore defaults: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    const currentSites: WhitelistedSite[] = result.whitelistedWebsites || [];
                    
                    const customSites = currentSites.filter(s => !s.isDefault);
                    const restoredList = [...this.defaultSitesList.map(s => ({ ...s })), ...customSites];
                    
                    chrome.storage.local.set({ whitelistedWebsites: restoredList }, () => {
                        try {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('WhitelistedWebsites', `Storage error saving restored defaults: ${errorMessage}`, { error: chrome.runtime.lastError });
                                return;
                            }
                            this.loadAndRenderSites();
                            this.showToast("Default platforms restored!");
                        } catch (setErr) {
                            const errorMessage = setErr instanceof Error ? setErr.message : String(setErr);
                            Logger.error('WhitelistedWebsites', `Error in storage set callback for restore defaults: ${errorMessage}`, { setErr });
                        }
                    });
                } catch (getErr) {
                    const errorMessage = getErr instanceof Error ? getErr.message : String(getErr);
                    Logger.error('WhitelistedWebsites', `Error in storage get callback for restore defaults: ${errorMessage}`, { getErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('WhitelistedWebsites', `Error restoring default platforms: ${errorMessage}`, { err });
        }
    }

    /**
     * Shows temporary toast alerts.
     */
    showToast(msg: string): void {
        try {
            const toast = document.getElementById('status-toast');
            if (!toast) return;
            toast.textContent = msg;
            toast.className = 'toast show';
            setTimeout(() => {
                try {
                    toast.className = 'toast';
                } catch (animErr) {
                    const errorMessage = animErr instanceof Error ? animErr.message : String(animErr);
                    Logger.error('WhitelistedWebsites', `Error hiding toast animation: ${errorMessage}`, { animErr });
                }
            }, 2500);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('WhitelistedWebsites', `Error showing toast message '${msg}': ${errorMessage}`, { msg, err });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        const manager = new WhitelistedWebsitesManager();
        manager.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('WhitelistedWebsites', `Error instantiating WhitelistedWebsitesManager on DOMContentLoaded: ${errorMessage}`, { err });
    }
});

export default WhitelistedWebsitesManager;

try {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WhitelistedWebsitesManager;
    } else if (typeof window !== 'undefined') {
        (window as unknown as { WhitelistedWebsitesManager?: typeof WhitelistedWebsitesManager }).WhitelistedWebsitesManager = WhitelistedWebsitesManager;
    }
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('WhitelistedWebsites', `Error exporting WhitelistedWebsitesManager: ${errorMessage}`, { err });
}
