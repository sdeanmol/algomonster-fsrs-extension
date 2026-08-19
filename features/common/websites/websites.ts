/**
 * @file features/common/websites/websites.ts
 * @description Manages whitelist configurations for sites where the extension content scripts are active.
 * Integrates dynamic permissions requests for custom domains, and registers content scripts
 * programmatically using the Chrome Extension Scripting API.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';
import { DEFAULT_WHITELISTED_WEBSITES } from '../constants';

export interface WhitelistedSite {
    domain: string;
    isDefault: boolean;
}

export class WhitelistedWebsitesManager {
    defaultSitesList: WhitelistedSite[];

    constructor() {
        this.defaultSitesList = DEFAULT_WHITELISTED_WEBSITES.map(s => ({ ...s, isDefault: true }));
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
            UIUtils.catchError('WhitelistedWebsites', 'Error initializing WhitelistedWebsitesManager', err);
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
                    UIUtils.catchError('WhitelistedWebsites', 'Error closing window', err);
                }
            });

            // Add website domain
            document.getElementById('add-domain-btn')?.addEventListener('click', () => {
                try {
                    this.handleAddWebsite();
                } catch (err) {
                    UIUtils.catchError('WhitelistedWebsites', 'Error in add domain button handler', err);
                }
            });
            
            // Allow pressing Enter key in text input
            document.getElementById('domain-input')?.addEventListener('keypress', (e: KeyboardEvent) => {
                try {
                    if (e.key === 'Enter') this.handleAddWebsite();
                } catch (err) {
                    UIUtils.catchError('WhitelistedWebsites', 'Error in domain input keypress handler', err);
                }
            });

            // Restore Defaults button
            document.getElementById('restore-defaults-btn')?.addEventListener('click', () => {
                try {
                    this.restoreDefaults();
                } catch (err) {
                    UIUtils.catchError('WhitelistedWebsites', 'Error in restore defaults button handler', err);
                }
            });
        } catch (err) {
            UIUtils.catchError('WhitelistedWebsites', 'Error binding events', err);
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
                    if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error loading websites')) return;
                    let sites: WhitelistedSite[] = result.whitelistedWebsites || [];
                    if (!result.whitelistedWebsites) {
                        // First time: initialize storage with default list
                        sites = [...this.defaultSitesList.map(s => ({ ...s }))];
                        chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                            UIUtils.checkStorageError('WhitelistedWebsites', 'Error saving default websites to storage');
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
                                UIUtils.catchError('WhitelistedWebsites', 'Error in delete site button click', err);
                            }
                        });
                    });
                } catch (innerErr) {
                    UIUtils.catchError('WhitelistedWebsites', 'Error rendering whitelisted sites', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('WhitelistedWebsites', 'Error loading whitelisted sites', err);
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
                UIUtils.showToast("Invalid domain name.");
                return;
            }

            chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
                try {
                    if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error fetching whitelistedWebsites')) {
                        UIUtils.showToast("Error checking website status.");
                        return;
                    }
                    const sites: WhitelistedSite[] = result.whitelistedWebsites || [...this.defaultSitesList.map(s => ({ ...s }))];
                    if (sites.some(s => s.domain === hostname)) {
                        UIUtils.showToast("Website is already whitelisted.");
                        return;
                    }

                    // Request host permission
                    const originPattern = `*://*.${hostname}/*`;

                    chrome.permissions.request({
                        origins: [originPattern]
                    }, (granted: boolean) => {
                        try {
                            if (UIUtils.checkStorageError('WhitelistedWebsites', 'Permission request error', { hostname })) {
                                UIUtils.showToast("Error requesting domain permission.");
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
                                        UIUtils.checkStorageError('WhitelistedWebsites', 'Script registration error', { hostname });

                                        // Save to storage
                                        sites.push({ domain: hostname, isDefault: false });
                                        chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                                            try {
                                                if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage set error after script registration', { hostname })) return;
                                                input.value = '';
                                                this.loadAndRenderSites();
                                                UIUtils.showToast(`Authorized & Whitelisted: ${hostname}`);
                                            } catch (saveErr) {
                                                UIUtils.catchError('WhitelistedWebsites', 'Error saving whitelisted website to storage', saveErr);
                                            }
                                        });
                                    } catch (regErr) {
                                        UIUtils.catchError('WhitelistedWebsites', 'Error in script registration callback', regErr);
                                    }
                                });
                            } else {
                                UIUtils.showToast("Permission request was declined.");
                            }
                        } catch (permErr) {
                            UIUtils.catchError('WhitelistedWebsites', 'Error in permissions request callback', permErr);
                        }
                    });
                } catch (getErr) {
                    UIUtils.catchError('WhitelistedWebsites', 'Error in storage get callback for add website', getErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('WhitelistedWebsites', 'Failed to parse domain input', err, { value });
            UIUtils.showToast("Please enter a valid URL or domain.");
        }
    }

    /**
     * Revokes host origin permissions and dynamic scripts, then updates storage list.
     */
    handleDeleteWebsite(siteDomain: string): void {
        try {
            chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
                try {
                    if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error reading websites for delete', { siteDomain })) return;
                    let sites: WhitelistedSite[] = result.whitelistedWebsites || [...this.defaultSitesList.map(s => ({ ...s }))];
                    const site = sites.find(s => s.domain === siteDomain);
                    if (!site) return;

                    const performStorageDelete = () => {
                        try {
                            sites = sites.filter(s => s.domain !== siteDomain);
                            chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                                try {
                                    if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage set error during website delete', { siteDomain })) return;
                                    this.loadAndRenderSites();
                                    UIUtils.showToast(`Removed access for: ${siteDomain}`);
                                } catch (setErr) {
                                    UIUtils.catchError('WhitelistedWebsites', 'Error in storage set callback for delete website', setErr);
                                }
                            });
                        } catch (deleteErr) {
                            UIUtils.catchError('WhitelistedWebsites', 'Error performing storage delete', deleteErr);
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
                                UIUtils.checkStorageError('WhitelistedWebsites', 'Script unregister warning', { siteDomain });

                                chrome.permissions.remove({
                                    origins: [originPattern]
                                }, () => {
                                    try {
                                        UIUtils.checkStorageError('WhitelistedWebsites', 'Permission remove warning', { siteDomain });
                                        performStorageDelete();
                                    } catch (permRemoveErr) {
                                        UIUtils.catchError('WhitelistedWebsites', 'Error in permissions remove callback', permRemoveErr);
                                    }
                                });
                            } catch (unregErr) {
                                UIUtils.catchError('WhitelistedWebsites', 'Error in script unregister callback', unregErr);
                            }
                        });
                    }
                } catch (getErr) {
                    UIUtils.catchError('WhitelistedWebsites', 'Error in storage get callback for delete website', getErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('WhitelistedWebsites', `Error deleting website '${siteDomain}'`, err, { siteDomain });
        }
    }

    /**
     * Restores initial hardcoded whitelisted platforms.
     */
    restoreDefaults(): void {
        try {
            chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
                try {
                    if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error fetching websites for restore defaults')) return;
                    const currentSites: WhitelistedSite[] = result.whitelistedWebsites || [];
                    
                    const customSites = currentSites.filter(s => !s.isDefault);
                    const restoredList = [...this.defaultSitesList.map(s => ({ ...s })), ...customSites];
                    
                    chrome.storage.local.set({ whitelistedWebsites: restoredList }, () => {
                        try {
                            if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error saving restored defaults')) return;
                            this.loadAndRenderSites();
                            UIUtils.showToast("Default platforms restored!");
                        } catch (setErr) {
                            UIUtils.catchError('WhitelistedWebsites', 'Error in storage set callback for restore defaults', setErr);
                        }
                    });
                } catch (getErr) {
                    UIUtils.catchError('WhitelistedWebsites', 'Error in storage get callback for restore defaults', getErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('WhitelistedWebsites', 'Error restoring default platforms', err);
        }
    }
}

function initWebsitesManager(): void {
    try {
        const manager = new WhitelistedWebsitesManager();
        manager.init();
    } catch (err) {
        UIUtils.catchError('WhitelistedWebsites', 'Initialization failed', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWebsitesManager);
    } else {
        initWebsitesManager();
    }
}

export default WhitelistedWebsitesManager;

try {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WhitelistedWebsitesManager;
    } else if (typeof window !== 'undefined') {
        (window as unknown as { WhitelistedWebsitesManager?: typeof WhitelistedWebsitesManager }).WhitelistedWebsitesManager = WhitelistedWebsitesManager;
    }
} catch (err) {
    UIUtils.catchError('WhitelistedWebsites', 'Error exporting WhitelistedWebsitesManager', err);
}
