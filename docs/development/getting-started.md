# Developer Getting Started Guide

## 1. Prerequisites

To build, develop, and test AlgoRecall, ensure your local environment satisfies:
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **npm**: v9.0.0 or higher.
- **Git**: For version control.
- **Browsers for Testing**:
  - Google Chrome (Chromium v105+ for CSS Custom Highlights API).
  - Mozilla Firefox (v109+ with MV3 support).
  - Apple Safari (macOS Safari 14+ with Safari Web Extension tools).

---

## 2. Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/algomonster-fsrs-extension.git
   cd algomonster-fsrs-extension
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Verify the environment**:
   Run the test suite to confirm all unit and integration tests pass:
   ```bash
   npm test
   ```

---

## 3. Build & Development Commands

### 3.1 Production Builds
Compile TypeScript, bundle Webpack entry points, and package release ZIP archives:
- **Chrome Build**:
  ```bash
  npm run build:chrome
  ```
  *Output*: Bundles into `dist/chrome/` and packages `release/chrome/extension-chrome.zip`.
- **Firefox Build**:
  ```bash
  npm run build:firefox
  ```
  *Output*: Bundles into `dist/firefox/` and packages `release/firefox/extension-firefox.zip`.
- **Safari Build**:
  ```bash
  npm run build:safari
  ```
  *Output*: Bundles into `dist/safari/`.

### 3.2 Live Development (Watch Mode)
Starts Webpack in development mode with incremental source-map rebuilding on file save:
```bash
npm run dev:chrome
npm run dev:firefox
npm run dev:safari
```

---

## 4. Loading the Extension Locally

### Google Chrome / Brave / Edge
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable the **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the build output directory: `<project_root>/dist/chrome/`.
5. The AlgoRecall icon will appear in your extensions toolbar.

### Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the manifest file: `<project_root>/dist/firefox/manifest.json`.

### Apple Safari
1. Enable the **Develop** menu in Safari Preferences $\to$ Advanced $\to$ "Show Develop menu in menu bar".
2. In Develop menu, enable **"Allow Unsigned Extensions"**.
3. Package the extension for Xcode:
   ```bash
   npm run release:safari
   ```
4. Open the generated Xcode project in `release/safari/AlgoRecallSafari` and run it in Safari.
