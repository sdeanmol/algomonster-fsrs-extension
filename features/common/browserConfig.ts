/**
 * @file Static Build-Time Browser Configuration
 * @module features/common/browserConfig
 * @context Shared across Background, Content Scripts, Popup UI, and Dashboard
 * @description Provides build-time injected configuration parameters distinguishing Chrome,
 * Firefox, and Safari extension targets (via Webpack DefinePlugin). Allows dead code elimination
 * for browser-specific feature gates (e.g. notifications, alarms, and downloads) without runtime branching.
 */

declare const __BROWSER_TARGET__: string;
declare const __STORE_REVIEW_URL__: string;
declare const __STORE_NAME__: string;

/** Supported browser distribution targets */
export type BrowserTarget = 'chrome' | 'firefox' | 'safari';

/**
 * Interface detailing browser metadata, store URLs, and feature support capabilities.
 */
export interface BrowserConfig {
    /** The build target browser identifier ('chrome' | 'firefox' | 'safari') */
    target: BrowserTarget;
    /** Human-readable browser brand name (e.g. "Chrome", "Firefox", "Safari") */
    displayName: string;
    /** Extension web store / marketplace name */
    storeName: string;
    /** URL to the extension's review/rating listing page */
    reviewUrl: string;
    /** Store-specific call-to-action text requesting user review */
    ratingPromptText: string;
    /** Store-specific button label for review actions */
    ratingButtonLabel: string;
    /**
     * Whether `chrome.notifications` is supported in this build target.
     * Evaluates to false for Safari builds.
     */
    supportsNotifications: boolean;
    /**
     * Whether `chrome.alarms` is supported in this build target.
     * True across Chrome, Firefox, and Safari (Safari 14+).
     */
    supportsAlarms: boolean;
    /**
     * Whether `chrome.downloads` is supported in this build target.
     * Evaluates to false for Safari builds.
     */
    supportsDownloads: boolean;
}

/**
 * Immutable browser configuration resolved statically at build time.
 * Injected at compile time by Webpack DefinePlugin using `TARGET_BROWSER`.
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
    // Safari does not expose chrome.notifications or chrome.downloads.
    // However, chrome.alarms IS fully supported on Safari 14+.
    // These flags are injected at build time so guards are eliminated during tree-shaking
    // in Chrome/Firefox builds (dead code elimination on `false &&`).
    supportsNotifications: __BROWSER_TARGET__ !== 'safari',
    supportsAlarms: true, // Supported across Chrome, Firefox, and Safari
    supportsDownloads: __BROWSER_TARGET__ !== 'safari',
};

export default BROWSER_CONFIG;
