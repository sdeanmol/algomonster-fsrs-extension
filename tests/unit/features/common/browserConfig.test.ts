import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('BROWSER_CONFIG', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should have the correct defaults for chrome', () => {
    (global as any).__BROWSER_TARGET__ = 'chrome';
    (global as any).__STORE_NAME__ = 'Chrome Web Store';
    (global as any).__STORE_REVIEW_URL__ = 'https://chromewebstore.google.com/detail/YOUR_EXTENSION_ID/reviews';
    
    const BROWSER_CONFIG = require('../../../../features/common/browserConfig').default;
    
    expect(BROWSER_CONFIG.target).toBe('chrome');
    expect(BROWSER_CONFIG.displayName).toBe('Chrome');
    expect(BROWSER_CONFIG.storeName).toBe('Chrome Web Store');
    expect(BROWSER_CONFIG.reviewUrl).toBe('https://chromewebstore.google.com/detail/YOUR_EXTENSION_ID/reviews');
    expect(BROWSER_CONFIG.ratingPromptText).toBe('Rate us 5 stars on Chrome Web Store to help us grow!');
    expect(BROWSER_CONFIG.ratingButtonLabel).toBe('Rate on Chrome Web Store');
    expect(BROWSER_CONFIG.supportsNotifications).toBe(true);
    expect(BROWSER_CONFIG.supportsAlarms).toBe(true);
    expect(BROWSER_CONFIG.supportsDownloads).toBe(true);
  });

  it('should have the correct defaults for firefox', () => {
    (global as any).__BROWSER_TARGET__ = 'firefox';
    (global as any).__STORE_NAME__ = 'Firefox Add-ons';
    (global as any).__STORE_REVIEW_URL__ = 'https://addons.mozilla.org/firefox/addon/algorecall/reviews/';
    
    const BROWSER_CONFIG = require('../../../../features/common/browserConfig').default;
    
    expect(BROWSER_CONFIG.target).toBe('firefox');
    expect(BROWSER_CONFIG.displayName).toBe('Firefox');
    expect(BROWSER_CONFIG.storeName).toBe('Firefox Add-ons');
    expect(BROWSER_CONFIG.reviewUrl).toContain('addons.mozilla.org');
    expect(BROWSER_CONFIG.ratingPromptText).toBe('Rate us 5 stars on Firefox Add-ons to help us grow!');
    expect(BROWSER_CONFIG.ratingButtonLabel).toBe('Rate on Firefox Add-ons');
    expect(BROWSER_CONFIG.supportsNotifications).toBe(true);
    expect(BROWSER_CONFIG.supportsAlarms).toBe(true);
    expect(BROWSER_CONFIG.supportsDownloads).toBe(true);
  });

  it('should have the correct defaults for safari', () => {
    (global as any).__BROWSER_TARGET__ = 'safari';
    (global as any).__STORE_NAME__ = 'App Store';
    (global as any).__STORE_REVIEW_URL__ = 'https://apps.apple.com/app/algorecall/idYOUR_APP_ID';
    
    const BROWSER_CONFIG = require('../../../../features/common/browserConfig').default;
    
    expect(BROWSER_CONFIG.target).toBe('safari');
    expect(BROWSER_CONFIG.displayName).toBe('Safari');
    expect(BROWSER_CONFIG.storeName).toBe('App Store');
    expect(BROWSER_CONFIG.reviewUrl).toContain('apps.apple.com');
    expect(BROWSER_CONFIG.ratingPromptText).toBe('Rate us 5 stars on the App Store to help us grow!');
    expect(BROWSER_CONFIG.ratingButtonLabel).toBe('Rate on the App Store');
    expect(BROWSER_CONFIG.supportsNotifications).toBe(false);
    expect(BROWSER_CONFIG.supportsAlarms).toBe(true);
    expect(BROWSER_CONFIG.supportsDownloads).toBe(false);
  });
});
