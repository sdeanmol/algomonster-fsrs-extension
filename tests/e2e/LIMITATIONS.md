# Browser Test Limitations

## Firefox Integration Testing
Playwright does not natively support loading and testing Firefox WebExtensions using its official APIs (`firefox.launchPersistentContext`).
Because of this limitation, the automated `test:firefox` suite runs the **Firefox artifact** (`dist/firefox`) but loads it inside a headless Chromium instance to verify that:
- Firefox-specific strings and URLs are displayed in the UI correctly.
- Firefox-specific conditional logic behaves as expected.
- Shared core functionalities still work.

**Manual Verification Required:**
To verify actual Firefox APIs and manifest compatibility:
1. Build the extension: `npm run build:firefox`
2. Load it as a temporary add-on in Firefox (`about:debugging`).
3. Manually test Firefox-specific behaviors.

## Safari Integration Testing
Similar to Firefox, Playwright does not support WebKit/Safari extensions. Safari's extension architecture requires Xcode and macOS to package and run extensions.
The automated `test:safari` suite runs the **Safari artifact** (`dist/safari`) within a headless Chromium instance to verify:
- Safari-specific strings and URLs are correctly displayed.
- Safari-specific fallback logic works.
- Safari's lack of `chrome.notifications` and `chrome.downloads` degrades gracefully in the UI.

**Manual Verification Required:**
To verify actual Safari extension functionality:
1. Build the Safari extension: `npm run build:safari`
2. Run the Xcode project or use `xcrun safari-web-extension-packager` to load it in Safari.
3. Manually verify features and ensure the extension works properly on Safari.

*Note: Safari automated tests are limited by Playwright's lack of support for WebKit extensions.*
