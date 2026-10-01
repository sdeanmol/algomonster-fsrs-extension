# Manual Verification Suite (Safari & Firefox)

Since Playwright cannot natively load WebExtensions in Firefox and Safari environments with full API support (especially regarding `chrome.*` and `browser.*` extensions APIs), certain features must be manually tested before a major release.

Use this checklist to perform manual verification of browser-specific extensions features.

---

## 🦊 Firefox Verification Checklist

### 1. Extension Permissions & Security
- [ ] **Cross-Origin Requests**: Ensure that API requests to supported platforms (e.g. LeetCode, AlgoMonster) are not blocked by Firefox's strict tracking protection.
- [ ] **Content Script Injection**: Navigate to a Single Page Application (SPA) like LeetCode and verify that the extension injects correctly on soft navigations (without a full page refresh).
- [ ] **Storage Quotas**: Verify that the fallback mechanisms work correctly if Firefox restricts `storage.local` quotas in private browsing modes.

### 2. UI and Keyboard Shortcuts
- [ ] **Keyboard Shortcuts**: Firefox has stricter rules on overriding native shortcuts. Test that the review hotkeys (1, 2, 3, 4, Space) do not conflict with default Firefox behaviors.
- [ ] **Popup Sizing**: Firefox sometimes renders popup HTML with different intrinsic dimensions than Chrome. Open the extension popup and verify that the UI is not cropped or overflowing.
- [ ] **Context Menus**: Test if right-clicking on a supported coding platform correctly displays the AlgoRecall context menus, as `browser.contextMenus` behaves slightly differently in Firefox.

### 3. File Handling
- [ ] **Downloads API**: Export an Anki deck or JSON backup and ensure it downloads correctly using Firefox's `browser.downloads.download` API. 
- [ ] **File Input Dialog**: Verify that importing a JSON or Anki text file successfully triggers the OS file picker and loads data into local storage.

---

## 🧭 Safari Verification Checklist

### 1. WebKit/Safari-Specific Limitations
- [ ] **Notifications API**: Safari extensions lack support for the `chrome.notifications` API. Trigger a scheduled review or a streak milestone, and verify that the extension gracefully falls back to in-page UI banners or degrades without throwing an unhandled exception.
- [ ] **CSS Custom Highlights**: Safari's implementation of the CSS Custom Highlights API (`CSS.highlights`) is newer. Ensure that highlighted text on LeetCode persists and renders with the correct background colors without breaking the page styling.
- [ ] **Downloads API**: Safari extensions do not support `chrome.downloads` natively without a Swift backend. Verify that the extension's fallback mechanism (using Blob URLs and programmatic `<a>` tag clicks) successfully triggers a download on macOS Safari.

### 2. Platform Integration & Xcode
- [ ] **macOS App Container**: Load the extension through Xcode (`xcrun safari-web-extension-packager`) and ensure it initializes successfully without sandbox violations in the Safari background console.
- [ ] **Content Scripts in Safari**: Verify that content scripts load consistently in Safari. Safari sometimes defers content script execution; ensure the dashboard overlay and highlighter tools appear when navigating between LeetCode problems.
- [ ] **Storage Limits**: Test the extension by importing a large dataset (e.g., 500+ cards). Safari's `storage.local` implementation for extensions has different performance characteristics and size caps than Chromium.

---

## 🚦 General Cross-Browser (All Platforms)

- [ ] **Theme Syncing**: Change the browser or OS theme to Dark/Light mode and ensure the extension updates immediately in the Popup and Content Script overlay.
- [ ] **Service Worker Lifecycles**: Let the browser idle for 5 minutes (to allow the background service worker to sleep). Then trigger an action from the content script and ensure the worker wakes up and handles the message correctly.
