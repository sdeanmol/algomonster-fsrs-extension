/**
 * @file Unified Extension Action Dispatcher and Command Service
 * @module features/common/services/actionService
 * @context Shared across Background Service Worker (Keyboard Shortcuts) and Popup UI (Action Clicks)
 * @description Centralized, popup-independent coordinator executing extension actions, navigation routing,
 * theme toggling, feature switches, due card checks, and data export (NDJSON backup and Anki TSV).
 */

import { Logger } from '@common/logger';
import { Card, StorageData } from '../../../types/domain';
import { BROWSER_CONFIG } from '../browserConfig';
import {
    ACTION_URL_MAP,
    DEFAULT_EXTENSION_SETTINGS,
    DEFAULT_NOTIFICATION_SETTINGS,
    DEFAULT_THEME
} from '../constants';
import { BackupManager } from '../data/backupManager';

export { ACTION_URL_MAP };

/**
 * Supported command action identifiers executable from keyboard shortcuts or UI buttons.
 */
export type CommandActionId =
    | 'check-due-reviews'
    | 'view-due-cards'
    | 'open-study-plan'
    | 'toggle-theme'
    | 'open-analytics'
    | 'open-pomodoro'
    | 'view-all-cards'
    | 'view-retention-cards'
    | 'open-forecast'
    | 'open-history'
    | 'open-heatmap'
    | 'toggle-floating-marker'
    | 'open-highlights-manager'
    | 'open-highlights-options'
    | 'toggle-notifications'
    | 'open-summary'
    | 'toggle-algo-launcher'
    | 'open-websites-manager'
    | 'open-fsrs-config'
    | 'export-backup'
    | 'export-anki'
    | 'open-help'
    | 'rate-extension';

/**
 * Execution options passed when invoking command actions.
 */
export interface ActionExecutionOptions {
    /** Optional background worker handlers when called from service worker scope */
    background?: {
        /** Handler to check due cards and optionally schedule notifications */
        checkDueCards?: (reason?: string) => Promise<unknown>;
        /** Handler to recalculate and update the toolbar action badge */
        updateDueCardsBadge?: () => Promise<number>;
    };
    /** Callback receiving user status alerts */
    onStatus?: (message: string, isError?: boolean) => void;
}

/**
 * Standard structured result envelope returned by `ActionService.executeAction`.
 * @template T - Type of the result data payload.
 */
export interface ActionResult<T = unknown> {
    /** True if the action executed successfully */
    success: boolean;
    /** The action identifier that was executed */
    action: CommandActionId;
    /** Result data payload returned by the action handler */
    data?: T;
    /** Error message string if execution failed */
    error?: string;
}

/**
 * Service coordinating extension commands and page navigation.
 */
export class ActionService {
    /**
     * Executes an extension command action by its unique ID.
     * Functions identically in background service worker and popup UI contexts.
     * @param actionId - The unique command action identifier.
     * @param options - Optional runtime execution context and handlers.
     * @returns A promise resolving to an ActionResult object indicating success/payload.
     * @async
     * @example
     * ```ts
     * const res = await ActionService.executeAction('toggle-theme');
     * console.log('New theme:', res.data.theme);
     * ```
     */
    static async executeAction(actionId: CommandActionId, options?: ActionExecutionOptions): Promise<ActionResult> {
        Logger.info('ActionService', `Executing action: ${actionId}`);
        try {
            // 1. Navigation Actions
            if (ACTION_URL_MAP[actionId]) {
                const tab = await ActionService.openExtensionPage(ACTION_URL_MAP[actionId]);
                return { success: true, action: actionId, data: tab };
            }

            // 2. Specific Actions
            switch (actionId) {
                case 'check-due-reviews': {
                    const dueCount = await ActionService.checkDueReviews(options);
                    return { success: true, action: actionId, data: { dueCount } };
                }

                case 'toggle-theme': {
                    const newTheme = await ActionService.toggleTheme();
                    return { success: true, action: actionId, data: { theme: newTheme } };
                }

                case 'toggle-floating-marker': {
                    const enabled = await ActionService.toggleFloatingMarker();
                    return { success: true, action: actionId, data: { enabled } };
                }

                case 'toggle-algo-launcher': {
                    const enabled = await ActionService.toggleAlgoLauncher();
                    return { success: true, action: actionId, data: { enabled } };
                }

                case 'toggle-notifications': {
                    const enabled = await ActionService.toggleNotifications();
                    return { success: true, action: actionId, data: { enabled } };
                }

                case 'rate-extension': {
                    await ActionService.rateExtension();
                    return { success: true, action: actionId };
                }

                case 'export-backup': {
                    await ActionService.exportBackup();
                    return { success: true, action: actionId };
                }

                case 'export-anki': {
                    const count = await ActionService.exportAnki();
                    return { success: true, action: actionId, data: { cardCount: count } };
                }

                default: {
                    const err = `Unknown command action: ${actionId}`;
                    Logger.warn('ActionService', err);
                    return { success: false, action: actionId, error: err };
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ActionService', `Error executing ${actionId}: ${errorMessage}`, { err });
            return { success: false, action: actionId, error: errorMessage };
        }
    }

    /**
     * Opens an internal extension HTML page or external URL in a new or focused browser tab.
     * @param path - Relative extension page path or absolute web URL.
     * @returns Promise resolving to the created Tab object, or null on error.
     */
    static openExtensionPage(path: string): Promise<chrome.tabs.Tab | null> {
        return new Promise((resolve) => {
            try {
                const url = path.startsWith('http://') || path.startsWith('https://')
                    ? path
                    : chrome.runtime.getURL(path);
                chrome.tabs.create({ url }, (tab) => {
                    resolve(tab || null);
                });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('ActionService', `Failed to open page ${path}: ${errorMessage}`, { err });
                resolve(null);
            }
        });
    }

    /**
     * Opens the browser-specific web store review listing page in a new tab.
     * @async
     */
    static async rateExtension(): Promise<void> {
        let url = BROWSER_CONFIG.reviewUrl;
        if (BROWSER_CONFIG.target === 'chrome') {
            const extId = typeof chrome !== 'undefined' ? chrome.runtime?.id : 'unknown';
            url = url.replace('YOUR_EXTENSION_ID', extId || '');
        }
        await ActionService.openExtensionPage(url);
    }

    /**
     * Toggles the UI color theme between 'dark' and 'light' in `chrome.storage.local`.
     * @returns Promise resolving to the newly activated theme name ('dark' | 'light').
     * @async
     * @fires chrome.storage.local.set
     */
    static async toggleTheme(): Promise<'dark' | 'light'> {
        const result = (await chrome.storage.local.get(['theme'])) as StorageData;
        const currentTheme = result.theme || DEFAULT_THEME;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        await chrome.storage.local.set({ theme: newTheme });
        return newTheme;
    }

    /**
     * Toggles the Floating Highlighter Marker Menu visibility preference in `extensionSettings`.
     * @returns Promise resolving to the new enabled state boolean.
     * @async
     * @fires chrome.storage.local.set
     */
    static async toggleFloatingMarker(): Promise<boolean> {
        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
        const settings = result.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
        const currentVal = settings.showMarkerPopup !== undefined
            ? settings.showMarkerPopup
            : (DEFAULT_EXTENSION_SETTINGS.showMarkerPopup ?? true);
        const newValue = !currentVal;
        settings.showMarkerPopup = newValue;
        await chrome.storage.local.set({ extensionSettings: settings });
        return newValue;
    }

    /**
     * Toggles the floating Problem Tracker Launcher button in `extensionSettings`.
     * @returns Promise resolving to the new enabled state boolean.
     * @async
     * @fires chrome.storage.local.set
     */
    static async toggleAlgoLauncher(): Promise<boolean> {
        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
        const settings = result.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
        const currentVal = settings.showLauncher !== undefined
            ? settings.showLauncher
            : (DEFAULT_EXTENSION_SETTINGS.showLauncher ?? true);
        const newValue = !currentVal;
        settings.showLauncher = newValue;
        await chrome.storage.local.set({ extensionSettings: settings });
        return newValue;
    }

    /**
     * Toggles Review Reminder desktop notifications in `notificationSettings`.
     * @returns Promise resolving to the new enabled state boolean.
     * @async
     * @fires chrome.storage.local.set
     */
    static async toggleNotifications(): Promise<boolean> {
        const result = (await chrome.storage.local.get(['notificationSettings'])) as StorageData;
        const settings = result.notificationSettings || { ...DEFAULT_NOTIFICATION_SETTINGS };
        const currentVal = settings.enabled !== undefined
            ? settings.enabled
            : (DEFAULT_NOTIFICATION_SETTINGS.enabled ?? true);
        const newValue = !currentVal;
        settings.enabled = newValue;
        await chrome.storage.local.set({ notificationSettings: settings });
        return newValue;
    }

    /**
     * Triggers an immediate due card review check and badge count recalculation.
     * Dispatches runtime message to background worker if executed from UI contexts.
     * @param options - Execution options containing background handlers if called within service worker.
     * @returns Promise resolving to the number of currently due cards.
     * @async
     * @fires chrome.runtime.sendMessage
     */
    static async checkDueReviews(options?: ActionExecutionOptions): Promise<number> {
        if (options?.background?.checkDueCards && options?.background?.updateDueCardsBadge) {
            await options.background.checkDueCards('manual');
            return await options.background.updateDueCardsBadge();
        }

        return new Promise<number>((resolve, reject) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ action: 'check_due_cards_now' }, (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        return reject(new Error(lastError.message));
                    }
                    const count = response && typeof response.dueCount === 'number' ? response.dueCount : 0;
                    resolve(count);
                });
            } else {
                resolve(0);
            }
        });
    }

    /**
     * Exports a complete data backup archive using `BackupManager`, falling back to opening
     * the data dashboard export page if running in a background context without DOM.
     * @async
     */
    static async exportBackup(): Promise<void> {
        try {
            await BackupManager.exportBackup();
        } catch (err) {
            // If running in a background service worker without DOM and without downloads, open data page
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.warn('ActionService', `Direct backup export fallback: ${errorMessage}`, { err });
            await ActionService.openExtensionPage('features/common/data/data.html?action=export');
        }
    }

    /**
     * Serializes an array of FSRS problem cards into Anki-compatible TSV format.
     * Includes headers for deck name, note type, tab delimiters, and tags.
     * @param cards - Array of card entities to format.
     * @returns Formatted Anki TSV file contents string.
     */
    static formatCardsForAnki(cards: Card[]): string {
        const lines: string[] = [];
        lines.push('#separator:tab');
        lines.push('#html:false');
        lines.push('#tags column:3');
        lines.push('#deck:AlgoRecall');
        lines.push('#notetype:Basic');
        lines.push('');

        cards.forEach((card: Card) => {
            const front = (card.problemTitle || 'Untitled').replace(/\t/g, ' ').replace(/\n/g, ' ');
            const back = (card.approach || '').replace(/\t/g, '    ');
            const tags = (card.tags || []).map((t: string) => `algorecall::${t.replace(/\s+/g, '_')}`).join(' ');
            const frontWithUrl = card.problemUrl ? `${front}\n[URL: ${card.problemUrl}]` : front;
            lines.push(`${frontWithUrl}\t${back}\t${tags}`);
        });

        return lines.join('\n');
    }

    /**
     * Reads all cards from storage, formats them for Anki, and initiates download.
     * @returns Promise resolving to the number of exported cards.
     * @throws Error if no cards exist to export.
     * @async
     */
    static async exportAnki(): Promise<number> {
        const result = (await chrome.storage.local.get(['fsrsCards'])) as StorageData;
        const cards = result.fsrsCards || [];
        if (cards.length === 0) {
            throw new Error('No cards to export.');
        }

        const ankiText = ActionService.formatCardsForAnki(cards);
        const blob = new Blob([ankiText], { type: 'text/plain;charset=utf-8' });
        const filename = `algorecall_anki_${new Date().toISOString().split('T')[0]}.txt`;

        await ActionService.downloadBlobOrFallback(blob, filename, 'features/common/data/data.html?action=export-anki');
        return cards.length;
    }

    /**
     * Initiates a file download from a Blob via `chrome.downloads.download`,
     * falling back to DOM anchor click or navigating to the fallback extension page.
     * @param blob - File data Blob.
     * @param filename - Target download filename.
     * @param fallbackPath - Fallback HTML page path if downloads are restricted.
     * @async
     */
    static async downloadBlobOrFallback(blob: Blob, filename: string, fallbackPath: string): Promise<void> {
        const url = URL.createObjectURL(blob);

        if (BROWSER_CONFIG.supportsDownloads && typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
            return new Promise<void>((resolve, reject) => {
                chrome.downloads.download({ url, filename, saveAs: true }, () => {
                    const lastError = chrome.runtime?.lastError;
                    if (lastError) {
                        Logger.warn('ActionService', `chrome.downloads error: ${lastError.message}`);
                        if (typeof document !== 'undefined') {
                            ActionService.triggerDomDownload(url, filename);
                            resolve();
                        } else {
                            try {
                                URL.revokeObjectURL(url);
                            } catch (e) {
                                Logger.debug('ActionService', 'Blob URL revocation exception', { error: e });
                            }
                            reject(new Error(lastError.message));
                        }
                    } else {
                        setTimeout(() => {
                            try {
                                URL.revokeObjectURL(url);
                            } catch (e) {
                                Logger.debug('ActionService', 'Blob URL revocation exception', { error: e });
                            }
                        }, 5000);
                        resolve();
                    }
                });
            });
        } else if (typeof document !== 'undefined') {
            ActionService.triggerDomDownload(url, filename);
        } else {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                Logger.debug('ActionService', 'Blob URL revocation exception', { error: e });
            }
            await ActionService.openExtensionPage(fallbackPath);
        }
    }

    /**
     * Programmatically creates and clicks a temporary `<a>` anchor tag to download a file URL in DOM contexts.
     * @param url - Object URL or download URL string.
     * @param filename - Target file name.
     */
    static triggerDomDownload(url: string, filename: string): void {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                Logger.debug('ActionService', 'Blob URL revocation exception', { error: e });
            }
        }, 1000);
    }
}
