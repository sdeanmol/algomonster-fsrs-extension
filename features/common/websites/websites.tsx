/**
 * @file Dynamic Whitelisted Websites Configuration Manager (Preact)
 * @module features/common/websites/websites
 * @context Options / Whitelist Management Page (features/common/websites/websites.html)
 * @description Manages whitelist configurations for sites where the extension content scripts are active.
 * Integrates dynamic permissions requests for custom domains, and registers content scripts
 * programmatically using the Chrome Extension Scripting API.
 */

import { h, render, Fragment, JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';
import { DEFAULT_WHITELISTED_WEBSITES } from '../constants';

/**
 * Record representing a whitelisted website domain and its default status.
 */
export interface WhitelistedSite {
    /** Target hostname or domain string (e.g. "leetcode.com") */
    domain: string;
    /** True if this website is part of the factory default whitelist */
    isDefault: boolean;
}

/**
 * Preact Component for rendering the whitelisted sites list.
 */
export function WhitelistedSitesList({
    sites,
    onDelete
}: {
    sites: WhitelistedSite[];
    onDelete: (domain: string) => void;
}): JSX.Element {
    if (sites.length === 0) {
        return (
            <li style={{ justifyContent: 'center', color: 'var(--md-text-low)', fontStyle: 'italic' }}>
                No whitelisted websites. Add one to get started!
            </li>
        );
    }

    return (
        <Fragment>
            {sites.map((site) => {
                const monogram = site.domain.substring(0, 1).toUpperCase();
                return (
                    <li key={site.domain}>
                        <div className="site-name-wrapper">
                            <div
                                className="site-icon-fallback"
                                style={
                                    site.isDefault
                                        ? undefined
                                        : { color: 'var(--md-success)', borderColor: 'rgba(30, 142, 62, 0.15)' }
                                }
                            >
                                {monogram}
                            </div>
                            <span>{site.domain}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {site.isDefault && (
                                <span className="site-badge protected" style={{ marginRight: '8px' }}>
                                    Default
                                </span>
                            )}
                            <button
                                className="delete-site-btn"
                                data-site={site.domain}
                                title="Delete platform whitelisting"
                                aria-label="Delete platform whitelisting"
                                onClick={() => onDelete(site.domain)}
                            >
                                <svg className="svg-icon" viewBox="0 0 24 24">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>
                        </div>
                    </li>
                );
            })}
        </Fragment>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface WebsitesAppProps {
    manager?: WhitelistedWebsitesManager;
}

export function WebsitesApp({ manager: initialManager }: WebsitesAppProps): JSX.Element {
    const [manager] = useState(() => initialManager || new WhitelistedWebsitesManager());
    const [sites, setSites] = useState<WhitelistedSite[]>([]);
    const [domainInput, setDomainInput] = useState<string>('');
    const [, setRenderTrigger] = useState(0);

    const forceUpdate = () => setRenderTrigger(c => c + 1);

    useEffect(() => {
        manager.onUpdate = (newSites) => {
            setSites([...newSites]);
            forceUpdate();
        };

        chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
            let loadedSites = result.whitelistedWebsites;
            if (!loadedSites) {
                loadedSites = [...manager.defaultSitesList.map(s => ({ ...s }))];
                chrome.storage.local.set({ whitelistedWebsites: loadedSites });
            }
            setSites(loadedSites);
        });
    }, [manager]);

    const handleAdd = () => {
        manager.handleAddWebsite();
        setDomainInput('');
    };

    const handleDelete = (domain: string) => {
        manager.handleDeleteWebsite(domain);
    };

    const handleRestoreDefaults = () => {
        manager.restoreDefaults();
    };

    const handleClose = () => {
        UIUtils.closeCurrentTab();
    };

    return (
        <div className="container">
            {/* Header: Brand badge, title, and page close button */}
            <div className="header">
                <div className="header-main">
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1 id="page-title">Active Platforms</h1>
                    <p id="page-subtitle" className="subtitle">Add or manage websites where AlgoRecall is authorized to run.</p>
                </div>
                <div className="header-actions">
                    <button id="back-to-popup-btn" className="btn btn-secondary" onClick={handleClose}>
                        Close Manager
                    </button>
                </div>
            </div>

            <div className="grid-2">
                {/* Add Custom Website Card */}
                <div className="card">
                    <h2>🔌 Add Custom Website</h2>
                    <p className="section-intro">
                        Enable AlgoRecall highlights and spaced repetition reviews on any custom coding platform or documentation website.
                    </p>
                    <div className="form-group" style={{ marginTop: '16px' }}>
                        <label htmlFor="domain-input">Website Domain or URL</label>
                        <div className="input-row">
                            <input
                                type="text"
                                id="domain-input"
                                className="input-field"
                                placeholder="e.g. github.com or https://mycode.io/"
                                value={domainInput}
                                onInput={(e) => setDomainInput((e.target as HTMLInputElement).value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') handleAdd();
                                }}
                            />
                            <button id="add-domain-btn" className="btn btn-primary" onClick={handleAdd}>
                                Authorize & Add
                            </button>
                        </div>
                        <span className="input-hint">We will request domain permission dynamically for your privacy.</span>
                    </div>
                </div>

                {/* Manage Websites List Card */}
                <div className="card">
                    <h2>📋 Whitelisted Platforms</h2>
                    <div className="whitelist-container">
                        <ul id="whitelisted-sites-list" className="sites-list">
                            <WhitelistedSitesList sites={sites} onDelete={handleDelete} />
                        </ul>
                        <button
                            id="restore-defaults-btn"
                            className="btn btn-secondary"
                            style={{ marginTop: '20px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            onClick={handleRestoreDefaults}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                            Restore Default Platforms
                        </button>
                    </div>
                </div>
            </div>

            {/* Status message toast */}
            <div id="status-toast" className="toast" />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBSITES MANAGER CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller class managing the Whitelisted Websites options page.
 */
export class WhitelistedWebsitesManager {
    /** Factory default website records */
    defaultSitesList: WhitelistedSite[];
    /** State update callback */
    onUpdate?: (sites: WhitelistedSite[]) => void;

    /**
     * Initializes default platforms list from constants.
     */
    constructor() {
        this.defaultSitesList = DEFAULT_WHITELISTED_WEBSITES.map(s => ({ ...s, isDefault: true }));
    }

    /**
     * Initializes whitelist displays and registers default clicks.
     * @fires chrome.storage.local.get
     */
    init(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<WebsitesApp manager={this} />, root);
                return;
            }

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
                    UIUtils.closeCurrentTab();
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
     * Loads authorized website structures from storage and renders via Preact.
     * @fires chrome.storage.local.get
     * @fires chrome.storage.local.set
     */
    loadAndRenderSites(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<WebsitesApp manager={this} />, root);
                return;
            }

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

                    // Render through Preact
                    render(
                        <WhitelistedSitesList
                            sites={sites}
                            onDelete={(domain) => this.handleDeleteWebsite(domain)}
                        />,
                        list
                    );

                    if (this.onUpdate) this.onUpdate(sites);
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
     * @fires chrome.permissions.request
     * @fires chrome.scripting.registerContentScripts
     * @fires chrome.storage.local.set
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

                    // Request host permission with clear user notice
                    const originPattern = `*://*.${hostname}/*`;
                    UIUtils.showToast(`Requesting permission to run on ${hostname}...`);

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
                                        js: [
                                            "features/common/marked.min.js",
                                            "dist/fsrsScheduler.bundle.js",
                                            "content/content.js"
                                        ],
                                        css: ["features/highlighter/style.css"],
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
                                                if (this.onUpdate) this.onUpdate(sites);
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
     * @param siteDomain - Target domain to delete.
     * @fires chrome.scripting.unregisterContentScripts
     * @fires chrome.permissions.remove
     * @fires chrome.storage.local.set
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
                                    if (this.onUpdate) this.onUpdate(sites);
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
     * @fires chrome.storage.local.get
     * @fires chrome.storage.local.set
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
                            if (this.onUpdate) this.onUpdate(restoredList);
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

export function initWebsitesManager(): void {
    try {
        const root = document.getElementById('root');
        const manager = new WhitelistedWebsitesManager();
        if (root) {
            render(<WebsitesApp manager={manager} />, root);
        } else {
            manager.init();
        }
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
        (module.exports as any).default = WhitelistedWebsitesManager;
        (module.exports as any).WhitelistedWebsitesManager = WhitelistedWebsitesManager;
        (module.exports as any).WhitelistedSitesList = WhitelistedSitesList;
        (module.exports as any).WebsitesApp = WebsitesApp;
        (module.exports as any).initWebsitesManager = initWebsitesManager;
    } else if (typeof window !== 'undefined') {
        (window as unknown as { WhitelistedWebsitesManager?: typeof WhitelistedWebsitesManager }).WhitelistedWebsitesManager = WhitelistedWebsitesManager;
    }
} catch (err) {
    UIUtils.catchError('WhitelistedWebsites', 'Error exporting WhitelistedWebsitesManager', err);
}
