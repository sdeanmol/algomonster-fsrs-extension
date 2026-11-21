# Migration Board: Vanilla TS → Preact Parity

Last Updated: 2026-11-21T18:42:00+05:30
Authoritative Reference: `main` (SHA: `41fe481`)
Implementation Target: `preact` (Initial SHA: `b00ed85`)

## Status Board

| ID | Feature | Priority | Owner | Dependencies | Status | Evidence |
|---|---|---|---|---|---|---|
| F-0001 | Settings Hub (`<SettingsApp />`) | High | feat-settings | Core styles, ActionService | VERIFIED | Clean Preact tree with 6 tab panels, settings.html, settings.css, webpack entry, 45/45 tests passing |
| F-0002 | Achievements & Personal Records | High | popup-agent | Domain types, Storage | VERIFIED | `achievements.ts` evaluator, modal & pill rendering, personal records, 32/32 tests passing (`achievements.test.ts`, `stats.test.ts`) |
| F-0003 | Popup Bento UI & Collapsible Details | High | popup-agent | Popup CSS, SVG fix | VERIFIED | `<BentoCommandCenter />`, `<DailyFocusCard />` (flame SVG), `<AchievementsModal />`, Bento styles & responsive layouts (130/130 popup tests passing) |
| F-0004 | History Aggregation & Navigation | Medium | feat-history | Card models | VERIFIED | `allCards` cached, unique pattern aggregation, in-tab nav & a11y verified (50/50 tests passing) |
| F-0005 | Dynamic Favicon Resolution | Medium | feat-favicons | Content utils, Highlighter | VERIFIED | `Utils.getFaviconUrl()`, BackupManager preservation, `<img>` with SVG fallback (19/19 contentUtils tests passing) |
| F-0006 | Error Decorators & UIUtils Helpers | High | feat-core | Logger, UIUtils | VERIFIED | Stage 2/3 decorators (`@CatchAndLog`, `@CatchAndReturn`, `@MeasureTime`), `UIUtils.formatError/trySafe` (40/40 tests passing) |
| F-0007 | Rebranding, Typography & Help Docs | Medium | feat-core | Help content, Base CSS | VERIFIED | Manifests rebranded to AlgoRecall Engine, rating-guide deprecated, helpContent expanded with 8 comprehensive guide sections (22/22 help tests passing) |
| F-0008 | Technical Docs Suite & Audit Script | Low | feat-core | Markdown docs | VERIFIED | Comprehensive technical documentation suite, architecture guides, data flow diagrams, and scripts/generate-audit-docs.js imported from main:ecf1e5b |
| F-0009 | Imperative DOM Decoupling Audit | High | arch-analyst | Preact standards | VERIFIED | ADR 001–008 documented; all 17 entry points Preact; content scripts Vanilla TS |

---

## Detailed Checklists

### F-0001: Consolidated Settings & Preferences Hub
- [x] Main implementation analyzed (`main:6c95e43`).
- [x] Preact component architecture designed (`<SettingsApp />` with 6 panels).
- [x] Entry point added to `webpack.config.js`.
- [x] HTML entry point created (`settings.html`).
- [x] Styles ported (`settings.css`).
- [x] Implementation completed.
- [x] Unit & Preact component tests passing (`settings.test.ts`, `SettingsComponents.test.tsx` 45/45 passing).
- [x] Visual & behavioral parity verified.

### F-0002: Achievements & Personal Records
- [x] Main implementation analyzed (`main:87fcce3`).
- [x] Domain types updated in `types/domain.ts`.
- [x] Milestone evaluator ported (`features/dashboard/popup/achievements.ts`).
- [x] Preact modal & badge components added to `features/dashboard/popup/popup.tsx`.
- [x] Tests passing (`achievements.test.ts`, `stats.test.ts` 32/32 passing).
- [x] Verified unlock logic and streak calculations.

### F-0003: Popup Bento UI & Collapsible Details
- [x] Main implementation analyzed (`main:e9b2493`, `8539f7a`, `0ef995f`).
- [x] Bento grid styles ported to `popup.css`.
- [x] Collapsible `<details>` and streak flame SVG updated in `popup.tsx`.
- [x] Due cards count & action button verified.
- [x] Tests passing (`PopupComponents.test.tsx`, `popup.test.ts` 130/130 passing across 9 suites).

### F-0004: History Aggregation & Navigation
- [x] Main implementation analyzed (`main:ee10c0c`).
- [x] `allCards` cached and unique pattern aggregation added to `history.tsx`.
- [x] Direct navigation to `data.html` with encoded query params verified.
- [x] Keyboard accessibility (`tabindex="0"`, `role="button"`) implemented.
- [x] Tests passing (`history.test.ts`).

### F-0005: Dynamic Favicon Resolution
- [x] Main implementation analyzed (`main:4820368`).
- [x] `Utils.getFaviconUrl()` added to `content/utils.ts`.
- [x] BackupManager preservation of `favIconUrl` ported.
- [x] Bookmark extraction in `highlighter.tsx` ported.
- [x] Favicon `<img>` with SVG fallback ported to `highlights.tsx`.
- [x] Tests passing (`contentUtils.test.ts`).

### F-0006: Method Decorators & Error Handling
- [x] Main implementation analyzed (`main:2a4d545`, `2280604`).
- [x] `decorators/errorDecorators.ts` ported.
- [x] `UIUtils.formatError`, `trySafe`, `trySafeAsync` ported.
- [x] Tests passing (`errorDecorators.test.ts`, `uiUtils.test.ts`).

### F-0007: Rebranding, Typography & Help Docs
- [x] Main implementation analyzed (`main:2e160cf`, `007e0de`, `41fe481`).
- [x] Typography & layout improvements in `data.css`, `forecast.css/html`, `history.css/html` ported.
- [x] Rebranding references updated across UI, manifests, and docs.
- [x] `helpContent.tsx` updated with 8 comprehensive guide sections, popup guide, and AlgoRecall Engine branding.
- [x] Tests passing (`help.test.ts`, `HelpTabBar.test.tsx`).

### F-0008: Technical Documentation Suite
- [x] Main documentation commits analyzed (`main:ecf1e5b`).
- [x] Technical architecture & engineering docs imported.
- [x] `scripts/generate-audit-docs.js` imported.

### F-0009: Imperative DOM Decoupling
- [x] Boundary audit completed: extension-owned UIs strictly Preact, content scripts strictly lightweight vanilla TS.
- [x] Event listeners properly cleaned up in `useEffect`.
- [x] No raw DOM string injections in Preact components.
