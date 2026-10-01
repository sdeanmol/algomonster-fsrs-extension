/**
 * @file features/common/browserConfig.ts
 * @description Build-time browser configuration injected at bundle time via webpack DefinePlugin.
 * Provides browser-specific strings (store names, review URLs) without any runtime browser detection.
 *
 * The values of __BROWSER_TARGET__, __STORE_NAME__, __STORE_REVIEW_URL__ are replaced at build
 * time by webpack DefinePlugin using the TARGET_BROWSER env var (build:chrome / build:firefox /
 * build:safari).
 *
 * Do NOT add runtime browser detection here. All values must be statically determinable at build time.
 *
 * Safari-specific notes:
 *   - Safari Web Extensions do not support chrome.notifications, chrome.alarms, or chrome.downloads.
 *   - The review URL points to the Mac App Store page where the containing app is listed.
 *   - Graceful degradation guards live in background.ts / popup.ts / highlights.ts / backupManager.ts.
 */

declare const __BROWSER_TARGET__: string;
declare const __STORE_REVIEW_URL__: string;
declare const __STORE_NAME__: string;

export type BrowserTarget = 'chrome' | 'firefox' | 'safari';

export interface BrowserConfig {
    /** The build target browser identifier */
    target: BrowserTarget;
    /** Human-readable browser name */
    displayName: string;
    /** Browser extension store name */
    storeName: string;
    /** URL to the extension's review/rating page on the store */
    reviewUrl: string;
    /** Store-specific rating prompt text */
    ratingPromptText: string;
    /** Store-specific rating button label */
    ratingButtonLabel: string;
    /**
     * Whether chrome.notifications is supported in this build target.
     * false for Safari — use this flag to guard notification calls.
     */
    supportsNotifications: boolean;
    /**
     * Whether chrome.alarms is supported in this build target.
     * false for Safari — use this flag to guard alarm calls.
     */
    supportsAlarms: boolean;
    /**
     * Whether chrome.downloads is supported in this build target.
     * false for Safari — use this flag to guard download calls.
     */
    supportsDownloads: boolean;
}

/**
 * Browser configuration resolved at build time.
 * All string values are injected by webpack DefinePlugin — no runtime branching.
 */
export const BROWSER_CONFIG: BrowserConfig = {
    target: __BROWSER_TARGET__ as BrowserTarget,
    displayName: __BROWSER_TARGET__ === 'firefox' ? 'Firefox'
        : __BROWSER_TARGET__ === 'safari' ? 'Safari'
        : 'Chrome',
    storeName: __STORE_NAME__,
    reviewUrl: __STORE_REVIEW_URL__,
    ratingPromptText: __BROWSER_TARGET__ === 'firefox'
        ? 'Rate us 5 stars on Firefox Add-ons to help us grow!'
        : __BROWSER_TARGET__ === 'safari'
        ? 'Rate us 5 stars on the App Store to help us grow!'
        : 'Rate us 5 stars on Chrome Web Store to help us grow!',
    ratingButtonLabel: __BROWSER_TARGET__ === 'firefox'
        ? 'Rate on Firefox Add-ons'
        : __BROWSER_TARGET__ === 'safari'
        ? 'Rate on the App Store'
        : 'Rate on Chrome Web Store',
    // Safari does not expose chrome.notifications, chrome.alarms, or chrome.downloads.
    // These flags are injected at build time so guards are eliminated during tree-shaking
    // in Chrome/Firefox builds (dead code elimination on `false &&`).
    supportsNotifications: __BROWSER_TARGET__ !== 'safari',
    supportsAlarms: __BROWSER_TARGET__ !== 'safari',
    supportsDownloads: __BROWSER_TARGET__ !== 'safari',
};

export default BROWSER_CONFIG;
