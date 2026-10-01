/**
 * @file features/common/browserConfig.ts
 * @description Build-time browser configuration injected at bundle time via webpack DefinePlugin.
 * Provides browser-specific strings (store names, review URLs) without any runtime browser detection.
 *
 * The values of BROWSER_TARGET and EXTENSION_STORE_URL are replaced at build time by webpack
 * DefinePlugin using the TARGET_BROWSER environment variable (set by build:chrome / build:firefox).
 *
 * Do NOT add runtime browser detection here. All values must be statically determinable at build time.
 */

declare const __BROWSER_TARGET__: string;
declare const __STORE_REVIEW_URL__: string;
declare const __STORE_NAME__: string;

export type BrowserTarget = 'chrome' | 'firefox';

export interface BrowserConfig {
    /** The build target browser identifier, e.g. 'chrome' | 'firefox' */
    target: BrowserTarget;
    /** Human-readable browser name, e.g. 'Chrome' | 'Firefox' */
    displayName: string;
    /** Browser extension store name, e.g. 'Chrome Web Store' | 'Firefox Add-ons' */
    storeName: string;
    /** URL to the extension's review/rating page on the store */
    reviewUrl: string;
    /** Store-specific rating prompt text */
    ratingPromptText: string;
    /** Store-specific rating button label */
    ratingButtonLabel: string;
}

/**
 * Browser configuration resolved at build time.
 * All string values are injected by webpack DefinePlugin — no runtime branching.
 */
export const BROWSER_CONFIG: BrowserConfig = {
    target: __BROWSER_TARGET__ as BrowserTarget,
    displayName: __BROWSER_TARGET__ === 'firefox' ? 'Firefox' : 'Chrome',
    storeName: __STORE_NAME__,
    reviewUrl: __STORE_REVIEW_URL__,
    ratingPromptText: __BROWSER_TARGET__ === 'firefox'
        ? 'Rate us 5 stars on Firefox Add-ons to help us grow!'
        : 'Rate us 5 stars on Chrome Web Store to help us grow!',
    ratingButtonLabel: __BROWSER_TARGET__ === 'firefox'
        ? 'Rate on Firefox Add-ons'
        : 'Rate on Chrome Web Store',
};

export default BROWSER_CONFIG;
