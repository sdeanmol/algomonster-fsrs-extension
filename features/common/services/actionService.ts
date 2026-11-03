/**
 * @file features/common/services/actionService.ts
 * @description Centralized, popup-independent action service coordinating all user-facing
 * commands across both popup UI event listeners and background keyboard shortcuts.
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

export interface ActionExecutionOptions {
    background?: {
        checkDueCards?: (reason?: string) => Promise<unknown>;
        updateDueCardsBadge?: () => Promise<number>;
    };
    onStatus?: (message: string, isError?: boolean) => void;
}

export interface ActionResult<T = unknown> {
    success: boolean;
    action: CommandActionId;
    data?: T;
    error?: string;
}



export class ActionService {
    /**
     * Executes an extension command action by ID.
     * Works consistently in both background service worker and popup UI contexts.
     * @param {CommandActionId} actionId - The unique command action identifier.
     * @param {ActionExecutionOptions} [options] - Optional runtime execution context.
     * @returns {Promise<ActionResult>} Result object indicating success and any payload or error.
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
     * Navigates to an internal extension HTML page or external URL in a browser tab.
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
     * Opens the browser-specific store review page.
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
     * Toggles theme setting between 'dark' and 'light'.
     */
    static async toggleTheme(): Promise<'dark' | 'light'> {
        const result = (await chrome.storage.local.get(['theme'])) as StorageData;
        const currentTheme = result.theme || DEFAULT_THEME;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        await chrome.storage.local.set({ theme: newTheme });
        return newTheme;
    }

    /**
     * Toggles Floating Highlighter Marker Menu in extensionSettings.
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
     * Toggles Problem Tracker Launcher in extensionSettings.
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
     * Toggles Review Reminder Notifications in notificationSettings.
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
     * Triggers an immediate review check and badge update.
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
     * Exports full data backup using BackupManager or opens the data dashboard export view.
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
     * Formats FSRS cards into Anki-compatible TSV text.
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
     * Exports cards to Anki format and downloads the file.
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
     * Downloads a blob via chrome.downloads, falling back to DOM anchor click or opening data page.
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
                            try { URL.revokeObjectURL(url); } catch (e) {}
                            reject(new Error(lastError.message));
                        }
                    } else {
                        setTimeout(() => {
                            try { URL.revokeObjectURL(url); } catch (e) {}
                        }, 5000);
                        resolve();
                    }
                });
            });
        } else if (typeof document !== 'undefined') {
            ActionService.triggerDomDownload(url, filename);
        } else {
            try { URL.revokeObjectURL(url); } catch (e) {}
            await ActionService.openExtensionPage(fallbackPath);
        }
    }

    /**
     * Helper to perform a DOM anchor download in an active page context.
     */
    static triggerDomDownload(url: string, filename: string): void {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
            try { URL.revokeObjectURL(url); } catch (e) {}
        }, 1000);
    }
}

