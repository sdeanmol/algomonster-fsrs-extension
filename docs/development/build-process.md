# Build Process & Tooling Architecture

## 1. Overview of the Build Pipeline

The AlgoRecall build pipeline is orchestrated by **Webpack 5** and **TypeScript** (`tsc`), defined in [`webpack.config.js`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/webpack.config.js).

The pipeline supports three distinct browser build targets: `chrome`, `firefox`, and `safari`.

---

## 2. Build and Deployment Pipeline Diagram (Diagram 11)

```mermaid
graph TD
    subgraph SourceCode["Source Code & Assets"]
        TS_SRC["TypeScript Source Files (*.ts)"]
        STATIC_ASSETS["Static HTML, CSS, Icons, marked.min.js"]
        MANIFESTS["browser/{target}/manifest.json"]
        WASM_BIN["WASM Binaries (@open-spaced-repetition)"]
    end

    subgraph BuildPipeline["Build Pipeline (npm run build:{target})"]
        TSC["TypeScript Type Checker<br/>(npx tsc --noEmit)"]
        CLEAN["Clean Output Directory<br/>(rm -rf dist/{target})"]
        
        subgraph WebpackExecution["Webpack 5 Compilation (webpack --env target={target})"]
            DEFINE_PLUG["DefinePlugin:<br/>Injects __BROWSER_TARGET__, __STORE_NAME__, __STORE_REVIEW_URL__"]
            TS_LOADER["ts-loader:<br/>Compiles 21 TypeScript Entry Points into JS"]
            WASM_RULE["asset/resource Rule:<br/>Emits WASM binaries into dist/"]
            COPY_PLUG["CopyPlugin:<br/>Copies manifest.json, icons/, HTML, and CSS<br/>(Ignores *.ts, *.test.js, *.md)"]
        end

        ISOLATION_CHECK["Artifact Isolation Audit<br/>(scripts/check-artifact-isolation.js)"]
        PACKAGE_ZIP["ZIP Packaging Archive<br/>(zip -r release/{target}/extension-{target}.zip .)"]
        SAFARI_PACKAGER["Safari Packager Tool<br/>(xcrun safari-web-extension-packager)"]
    end

    subgraph OutputArtifacts["Distribution Artifacts"]
        DIST_DIR["dist/{target}/<br/>(Unpacked extension for testing)"]
        ZIP_CHROME["release/chrome/extension-chrome.zip<br/>(Chrome Web Store upload)"]
        ZIP_FIREFOX["release/firefox/extension-firefox.zip<br/>(Firefox AMO upload)"]
        XCODE_SAFARI["release/safari/AlgoRecallSafari/<br/>(Xcode Project for Mac App Store)"]
    end

    %% Execution Connections
    TS_SRC --> TSC
    TSC --> CLEAN
    CLEAN --> DEFINE_PLUG
    DEFINE_PLUG --> TS_LOADER
    TS_LOADER --> DIST_DIR
    WASM_BIN --> WASM_RULE
    WASM_RULE --> DIST_DIR
    STATIC_ASSETS --> COPY_PLUG
    MANIFESTS --> COPY_PLUG
    COPY_PLUG --> DIST_DIR

    DIST_DIR --> ISOLATION_CHECK
    ISOLATION_CHECK --> PACKAGE_ZIP
    ISOLATION_CHECK --> SAFARI_PACKAGER

    PACKAGE_ZIP --> ZIP_CHROME
    PACKAGE_ZIP --> ZIP_FIREFOX
    SAFARI_PACKAGER --> XCODE_SAFARI
```

---

## 3. Webpack Configuration Details

### 3.1 21 Separate Entry Points
Rather than emitting a single monolithic bundle, Webpack compiles each UI page and background script independently:
- `config`: `features/tracker/config/fsrsConfig.ts` $\to$ `dist/config.bundle.js`
- `fsrsScheduler`: `features/tracker/scheduler/fsrsScheduler.ts` $\to$ `dist/fsrsScheduler.bundle.js`
- `background/background`: `background/background.ts` $\to$ `background/background.js`
- `content/content`: `content/content.ts` $\to$ `content/content.js`
- Plus 17 individual UI page entries.

### 3.2 Strict `CopyPlugin` Ignore Rules
To prevent raw `.ts` source files or test scripts from leaking into production distributions:
```javascript
const ignorePatterns = ['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts'];

new CopyPlugin({
    patterns: [
        { from: `browser/${targetBrowser}/manifest.json`, to: 'manifest.json' },
        { from: 'icons', to: 'icons', noErrorOnMissing: true },
        { from: 'background', to: 'background', noErrorOnMissing: true, globOptions: { ignore: ignorePatterns } },
        { from: 'content', to: 'content', noErrorOnMissing: true, globOptions: { ignore: ignorePatterns } },
        { from: 'features', to: 'features', noErrorOnMissing: true, globOptions: { ignore: ignorePatterns } }
    ]
})
```

### 3.3 Compile-Time Constant Injection (`DefinePlugin`)
Store-specific URLs and browser target names are resolved at compile time:
```javascript
new webpack.DefinePlugin({
    '__BROWSER_TARGET__': JSON.stringify(targetBrowser),
    '__STORE_NAME__': JSON.stringify(storeConfig.storeName),
    '__STORE_REVIEW_URL__': JSON.stringify(storeConfig.reviewUrl),
})
```
This enables dead-code elimination in tree-shaking for platform-specific branches.
