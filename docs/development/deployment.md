# Packaging, Distribution & Deployment

## 1. Multi-Browser Distribution Overview

AlgoRecall is deployed across three primary extension marketplaces:
1. **Google Chrome**: Chrome Web Store (Chromium MV3).
2. **Mozilla Firefox**: Firefox Add-ons / AMO (Gecko MV3).
3. **Apple Safari**: Mac App Store (Safari Web Extension).

---

## 2. Packaging Workflows

The release process is codified in `package.json`:

### 2.1 Chrome Web Store Release
```bash
npm run release:chrome
```
1. Type-checks source code via `tsc`.
2. Cleans `dist/chrome/`.
3. Runs Webpack in `production` mode with `--env target=chrome`.
4. Compresses all files in `dist/chrome/` into `release/chrome/extension-chrome.zip`.
5. Upload the resulting ZIP to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devcenter).

### 2.2 Firefox Add-ons Release
```bash
npm run release:firefox
```
1. Cleans `dist/firefox/`.
2. Runs Webpack in `production` mode with `--env target=firefox`.
3. Validates Gecko ID (`algorecall@algomonster.com`).
4. Compresses output into `release/firefox/extension-firefox.zip`.
5. Submit to [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/).

### 2.3 Apple Safari Release
```bash
npm run release:safari
```
1. Compiles Safari build to `dist/safari/`.
2. Invokes Apple's native extension packaging CLI:
   ```bash
   xcrun safari-web-extension-packager dist/safari --project-location release/safari/AlgoRecallSafari --force
   ```
3. Generates a native macOS/iOS Xcode project containing the Safari Web Extension wrapper.
4. Archive and notarize the app in Xcode for Mac App Store submission.

---

## 3. Automated Artifact Isolation Verification

Before releasing any build, the repository enforces an **Automated Artifact Isolation Audit** ([`scripts/check-artifact-isolation.js`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/scripts/check-artifact-isolation.js)):

```bash
npm run check:isolation:all
```

This script scans every compiled JavaScript bundle in `dist/` and verifies:
- Chrome builds contain **zero** Firefox or Safari store URLs.
- Firefox builds contain **zero** Chrome Web Store URLs or Safari-only strings.
- Safari builds contain **zero** unsupported permissions (`notifications`, `downloads`) and zero Firefox/Chrome strings.
- Exits with non-zero code if any cross-browser contamination is detected.
