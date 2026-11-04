# AGENTS.md — Architecture & Agent Rules

## Project Context

- **Extension Name**: AlgoRecall — Coding Interview Spaced Repetition Tracker & Highlighter.
- **Extension Type**: Cross-browser extension (Chrome, Firefox, Safari) — Manifest V3.
- **Framework**: Preact 11 + TypeScript 5 (migration from Vanilla JS → TypeScript → Preact is **complete**).
- **Build Toolchain**: Webpack 5 (`ts-loader`) with per-browser targets (`--env target=chrome|firefox|safari`). Build outputs go to `dist/<browser>/`.
- **Asset Strategy**: `CopyPlugin` copies static assets (HTML, CSS, icons, `marked.min.js`) into `dist/`. Webpack bundles all `.ts`/`.tsx` entry points. `DefinePlugin` injects `__BROWSER_TARGET__`, `__STORE_NAME__`, and `__STORE_REVIEW_URL__` at compile time.
- **Path Aliases**: `@common` → `features/common/`, `@tracker` → `features/tracker/`, `@dashboard` → `features/dashboard/` (mirrored in `tsconfig.json`, `webpack.config.js`, and `jest.config.js`).
- **Cross-Browser Layer**: `features/common/browserConfig.ts` provides build-time feature flags (`supportsNotifications`, `supportsAlarms`, `supportsDownloads`) and store metadata. Per-browser `manifest.json` files live in `browser/<target>/manifest.json`. Chrome uses `service_worker`; Firefox uses `background.scripts`; Safari uses `service_worker` (Safari 15.4+ MV3). Safari excludes `notifications` and `downloads` permissions.
- **Type Safety**: `tsconfig.json` — `strict: true`, `noImplicitAny`, `strictNullChecks`, `jsxImportSource: preact`. Custom ambient types in `types/chrome.d.ts` plus `@types/chrome`.
- **Testing**:
  - **Unit/Integration**: Jest 29 (`ts-jest`, `jsdom`), roots in `tests/unit/` and `tests/integration/`. Coverage thresholds enforced (global ≥ 65%, critical schedulers ≥ 90–95%).
  - **E2E**: Playwright (`tests/e2e/`), per-browser test scripts (`test:chrome`, `test:firefox`, `test:safari`).
- **CI**: GitHub Actions (`.github/workflows/test.yml`) — runs unit tests with coverage, builds all three browser targets, runs artifact isolation audit (`check:isolation`), and runs Playwright E2E.

## Source Layout

```
browser/             # Per-browser manifest.json files (chrome/, firefox/, safari/)
background/          # Service worker / background scripts (TypeScript)
content/             # Content script modules (TypeScript)
features/
  common/            # Shared utilities, browserConfig, UI components, hooks, services
    ui/components/   # Reusable Preact components (Toggle, etc.)
    ui/hooks/        # Shared Preact hooks (useStorage, etc.)
  dashboard/         # Dashboard feature UIs (popup, analytics, heatmap, etc.)
  tracker/           # Problem tracker, FSRS scheduler, config UI
  highlighter/       # Page highlighter feature
types/               # Ambient type declarations (chrome.d.ts, domain.ts, etc.)
scripts/             # Build/CI utility scripts (check-artifact-isolation.js)
tests/
  unit/              # Jest unit tests
  integration/       # Jest integration tests
  e2e/               # Playwright E2E tests
  mocks/             # Test mocks (chromeMock, styleMock, importMetaPlugin)
```

## Strict Rules

1. **Build & Test Gate**: Run `npm run build` AND `npm test` after modifying any source code. Both must pass before a change is considered complete.

2. **CopyPlugin Safety**: Never allow raw `.ts` or `.tsx` files to be copied into `dist/` output folders by `CopyPlugin`. The `ignorePatterns` array in `webpack.config.js` (`['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts', '**/*.tsx']`) must always exclude these. If adding new CopyPlugin patterns, include the same ignore list.

3. **Preact Component Standards**: All UI must be authored as Preact functional components with explicit TypeScript prop interfaces. Do NOT use imperative `document.createElement` / `innerHTML` DOM manipulation for any feature UI. Use `h()` / JSX. Use Preact hooks (`useState`, `useEffect`, `useCallback`, `useRef`) for state and side effects. Content script DOM injection in `content/` is the sole exception where imperative DOM APIs are acceptable.

4. **Cross-Browser API Safety**:
   - Always gate browser-specific API calls behind `BROWSER_CONFIG` feature flags (e.g., `BROWSER_CONFIG.supportsNotifications`, `BROWSER_CONFIG.supportsDownloads`). Never call `chrome.notifications` or `chrome.downloads` without a guard.
   - Use the `chrome.*` namespace uniformly across all targets (Firefox MV3 supports `chrome.*`). Do NOT introduce `browser.*` namespace calls.
   - Keep `@types/chrome` and `types/chrome.d.ts` in sync when extending Chrome API surface usage.

5. **Browser Target Isolation**: Each browser build must contain ONLY its own store-specific strings and manifest fields. Rely on `DefinePlugin` constants (`__BROWSER_TARGET__`, `__STORE_NAME__`, `__STORE_REVIEW_URL__`) — never hardcode store names/URLs in source. Run `npm run check:isolation` (or `check:isolation:all`) to verify after any change to browser-specific strings or manifest files.

6. **Manifest Consistency**: When modifying permissions, commands, or content script declarations, update ALL THREE manifests (`browser/chrome/manifest.json`, `browser/firefox/manifest.json`, `browser/safari/manifest.json`) unless the change is browser-specific. Remember: Safari cannot use `notifications` or `downloads` permissions; Firefox requires `browser_specific_settings.gecko`; Chrome uses `service_worker` while Firefox uses `background.scripts`.

7. **Path Alias Discipline**: Always use `@common/`, `@tracker/`, `@dashboard/` path aliases for cross-feature imports in source code. Keep the alias maps synchronized across `tsconfig.json` `paths`, `webpack.config.js` `resolve.alias`, and `jest.config.js` `moduleNameMapper`.

8. **Shared Hooks & Components**: Before creating new UI patterns, check `features/common/ui/components/` and `features/common/ui/hooks/` for existing reusable components and hooks (e.g., `Toggle`, `useStorage`). Extend the shared library rather than duplicating logic in feature directories.

9. **HTML Entry Points**: Each Webpack-bundled page mounts into a corresponding `.html` file via CopyPlugin. HTML files must reference the compiled `.js` paths (not `.ts`/`.tsx`). When adding a new page: create the HTML entry, add the TSX entry to `webpack.config.js`, and verify the bundle loads correctly in all three browsers.

10. **Type Declarations**: Domain models go in `types/domain.ts`. Chrome API ambient types go in `types/chrome.d.ts`. WASM runtime types go in `types/wasm-runtime.d.ts`. Do not scatter ambient declarations across feature directories.
