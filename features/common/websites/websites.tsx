/**
 * @file Dynamic Whitelisted Websites Configuration Manager (Preact)
 * @module features/common/websites/websites
 * @context Options / Whitelist Management Page (features/common/websites/websites.html)
 * @description Manages whitelist configurations for sites where the extension content scripts are active.
 * Integrates dynamic permissions requests for custom domains, and registers content scripts
 * programmatically using the Chrome Extension Scripting API.
 */

import { h, render, Fragment, JSX } from 'preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { UIUtils } from '../utils/uiUtils';
import { Toast } from '../ui/components/Toast';
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
 * Props for the WhitelistedSitesList component.
 */
export interface WhitelistedSitesListProps {
    /** Array of active whitelisted domain items */
    sites: WhitelistedSite[];
    /** Callback invoked when user clicks delete on a domain row */
    onDelete: (domain: string) => void;
}

/**
 * Preact Component for rendering the whitelisted sites list.
 */
export function WhitelistedSitesList({
    sites,
    onDelete
}: WhitelistedSitesListProps): JSX.Element {
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
// WEBSITES MANAGER HEADLESS SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Headless service class managing whitelisted website storage and chrome permissions.
 * Contains ZERO imperative DOM manipulation.
 */
export class WhitelistedWebsitesManager {
    /** Factory default website records */
    defaultSitesList: WhitelistedSite[];
    /** State update callback */
    onUpdate?: (sites: WhitelistedSite[]) => void;

    constructor() {
        this.defaultSitesList = DEFAULT_WHITELISTED_WEBSITES.map((s) => ({ ...s, isDefault: true }));
    }

    /**
     * Loads authorized website structures from storage.
     */
    loadAndRenderSites(callback?: (sites: WhitelistedSite[]) => void): void {
        chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
            let sites: WhitelistedSite[] = result.whitelistedWebsites || [];
            if (!result.whitelistedWebsites) {
                sites = [...this.defaultSitesList.map((s) => ({ ...s }))];
                chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                    UIUtils.checkStorageError('WhitelistedWebsites', 'Error saving default websites to storage');
                });
            }
            if (this.onUpdate) this.onUpdate(sites);
            if (callback) callback(sites);
        });
    }

    /**
     * Validates domain input strings, requests host permission rules,
     * and dynamically registers associated content script matches.
     */
    handleAddWebsite(domainInput: string = '', callback?: (success: boolean) => void): void {
        let value = domainInput.trim().toLowerCase();
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
                UIUtils.showToast('Invalid domain name.');
                callback?.(false);
                return;
            }

            chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
                if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error fetching whitelistedWebsites')) {
                    UIUtils.showToast('Error checking website status.');
                    callback?.(false);
                    return;
                }
                const sites: WhitelistedSite[] = result.whitelistedWebsites || [...this.defaultSitesList.map((s) => ({ ...s }))];
                if (sites.some((s) => s.domain === hostname)) {
                    UIUtils.showToast('Website is already whitelisted.');
                    callback?.(false);
                    return;
                }

                const originPattern = `*://*.${hostname}/*`;
                UIUtils.showToast(`Requesting permission to run on ${hostname}...`);

                chrome.permissions.request(
                    {
                        origins: [originPattern]
                    },
                    (granted: boolean) => {
                        if (UIUtils.checkStorageError('WhitelistedWebsites', 'Permission request error', { hostname })) {
                            UIUtils.showToast('Error requesting domain permission.');
                            callback?.(false);
                            return;
                        }
                        if (granted) {
                            chrome.scripting.registerContentScripts(
                                [
                                    {
                                        id: `site-${hostname.replace(/[^a-z0-9]/g, '-')}`,
                                        matches: [originPattern],
                                        js: [
                                            'features/common/marked.min.js',
                                            'dist/fsrsScheduler.bundle.js',
                                            'content/content.js'
                                        ],
                                        css: ['features/highlighter/style.css'],
                                        runAt: 'document_idle',
                                        allFrames: true
                                    }
                                ],
                                () => {
                                    UIUtils.checkStorageError('WhitelistedWebsites', 'Script registration error', { hostname });
                                    sites.push({ domain: hostname, isDefault: false });
                                    chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                                        if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage set error after script registration', { hostname })) {
                                            callback?.(false);
                                            return;
                                        }
                                        if (this.onUpdate) this.onUpdate(sites);
                                        UIUtils.showToast(`Authorized & Whitelisted: ${hostname}`);
                                        callback?.(true);
                                    });
                                }
                            );
                        } else {
                            UIUtils.showToast('Permission request was declined.');
                            callback?.(false);
                        }
                    }
                );
            });
        } catch (err) {
            UIUtils.catchError('WhitelistedWebsites', 'Failed to parse domain input', err, { value });
            UIUtils.showToast('Please enter a valid URL or domain.');
            callback?.(false);
        }
    }

    /**
     * Revokes host origin permissions and dynamic scripts, then updates storage list.
     */
    handleDeleteWebsite(siteDomain: string, callback?: () => void): void {
        chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
            if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error reading websites for delete', { siteDomain })) return;
            let sites: WhitelistedSite[] = result.whitelistedWebsites || [...this.defaultSitesList.map((s) => ({ ...s }))];
            const site = sites.find((s) => s.domain === siteDomain);
            if (!site) return;

            const performStorageDelete = () => {
                sites = sites.filter((s) => s.domain !== siteDomain);
                chrome.storage.local.set({ whitelistedWebsites: sites }, () => {
                    if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage set error during website delete', { siteDomain })) return;
                    if (this.onUpdate) this.onUpdate(sites);
                    UIUtils.showToast(`Removed access for: ${siteDomain}`);
                    callback?.();
                });
            };

            if (site.isDefault) {
                performStorageDelete();
            } else {
                const originPattern = `*://*.${siteDomain}/*`;
                const scriptId = `site-${siteDomain.replace(/[^a-z0-9]/g, '-')}`;

                chrome.scripting.unregisterContentScripts({ ids: [scriptId] }, () => {
                    UIUtils.checkStorageError('WhitelistedWebsites', 'Script unregister warning', { siteDomain });
                    chrome.permissions.remove({ origins: [originPattern] }, () => {
                        UIUtils.checkStorageError('WhitelistedWebsites', 'Permission remove warning', { siteDomain });
                        performStorageDelete();
                    });
                });
            }
        });
    }

    /**
     * Restores initial hardcoded whitelisted platforms.
     */
    restoreDefaults(callback?: () => void): void {
        chrome.storage.local.get(['whitelistedWebsites'], (result: { whitelistedWebsites?: WhitelistedSite[] }) => {
            if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error fetching websites for restore defaults')) return;
            const currentSites: WhitelistedSite[] = result.whitelistedWebsites || [];
            const customSites = currentSites.filter((s) => !s.isDefault);
            const restoredList = [...this.defaultSitesList.map((s) => ({ ...s })), ...customSites];

            chrome.storage.local.set({ whitelistedWebsites: restoredList }, () => {
                if (UIUtils.checkStorageError('WhitelistedWebsites', 'Storage error saving restored defaults')) return;
                if (this.onUpdate) this.onUpdate(restoredList);
                UIUtils.showToast('Default platforms restored!');
                callback?.();
            });
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the root WebsitesApp component.
 */
export interface WebsitesAppProps {
    /** Optional manager service passed during testing */
    manager?: WhitelistedWebsitesManager;
}

/**
 * Root Preact component for managing whitelisted coding platform domains.
 */
export function WebsitesApp({ manager: injectedManager }: WebsitesAppProps): JSX.Element {
    const manager = useMemo(() => injectedManager || new WhitelistedWebsitesManager(), [injectedManager]);
    const [sites, setSites] = useState<WhitelistedSite[]>([]);
    const [domainInput, setDomainInput] = useState<string>('');

    useEffect(() => {
        manager.onUpdate = (updatedSites) => {
            setSites([...updatedSites]);
        };
        manager.loadAndRenderSites((loadedSites) => {
            setSites(loadedSites);
        });
    }, [manager]);

    const handleAdd = useCallback(() => {
        manager.handleAddWebsite(domainInput, (success) => {
            if (success) setDomainInput('');
        });
    }, [manager, domainInput]);

    const handleDelete = useCallback((domain: string) => {
        manager.handleDeleteWebsite(domain);
    }, [manager]);

    const handleRestoreDefaults = useCallback(() => {
        manager.restoreDefaults();
    }, [manager]);

    const handleClose = useCallback(() => {
        UIUtils.closeCurrentTab();
    }, []);

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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAdd();
                                }}
                            />
                            <button id="add-domain-btn" className="btn btn-primary" onClick={handleAdd}>
                                Authorize &amp; Add
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
            <Toast id="status-toast" />
        </div>
    );
}

export function initWebsitesManager(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<WebsitesApp />, root);
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
