# Annotated Project Structure

## 1. Directory Tree Overview

This document presents the architecturally meaningful files and directories across the AlgoRecall repository. Generated directories (`dist/`, `node_modules/`, `coverage/`) are omitted for clarity.

```text
algomonster-fsrs-extension/
├── background/                                 # Manifest V3 Background Service Worker
│   └── background.ts                           # Central event coordinator, alarms, badge ticking, push notifs
│
├── browser/                                    # Target-specific browser manifest configurations
│   ├── chrome/manifest.json                    # Google Chrome Manifest V3
│   ├── firefox/manifest.json                   # Mozilla Firefox Gecko Manifest V3
│   └── safari/manifest.json                    # Apple Safari WebKit Manifest V3
│
├── content/                                    # Injected content scripts
│   ├── content.ts                              # Orchestrator, DOM MutationObserver, SPA navigation handler
│   ├── notifications.ts                        # In-page DOM alert banner (#algo-in-page-alert)
│   ├── state.ts                                # Shared in-memory window global state container
│   └── utils.ts                                # DOM problem title extraction & tag parsers
│
├── features/                                   # Feature modules and views
│   ├── common/                                 # Shared components, utilities, and hubs
│   │   ├── base.css                            # Common CSS variables and reset rules
│   │   ├── browserConfig.ts                    # Build-time compile feature flags (__BROWSER_TARGET__)
│   │   ├── constants.ts                        # Domain defaults, 17 FSRS weights, time constants
│   │   ├── firebase.ts                         # Firebase Client SDK stub (Offline fallback)
│   │   ├── logger.ts                           # Diagnostic logging singleton & performance timers
│   │   ├── markdown.ts                         # DOMPurify sanitized markdown parser wrapper
│   │   ├── marked.min.js                       # Bundled marked.js parser library
│   │   ├── theme-sync.ts                       # Theme synchronizer (dark/light/system)
│   │   ├── data/                               # Database table and streaming backup manager
│   │   │   ├── backupManager.ts                # Streaming Gzip NDJSON backup & 32-bit FNV-1a hasher
│   │   │   ├── data.html, data.css, data.ts    # Full problem database table & bulk action UI
│   │   ├── help/                               # Help Center SPA & Privacy Hub
│   │   │   └── help.html, help.css, help.ts    # 6-tab interactive guide & Privacy Policy
│   │   ├── services/                           # Cross-context services
│   │   │   └── actionService.ts                # Universal 24-command dispatcher
│   │   ├── settings/                           # Extension configuration hub
│   │   │   └── settings.html, settings.ts      # Settings UI, Anki interchange, theme preferences
│   │   ├── utils/                              # Pure utility modules
│   │   │   ├── cardUtils.ts                    # Card ID generator, URL cleaners, ensureCardIds()
│   │   │   ├── tagInput.ts                     # Dynamic chip tag editor control
│   │   │   └── uiUtils.ts                      # DOM helpers, toast banners, safe error catchers
│   │   ├── websites/                           # Domain whitelist manager
│   │   │   └── websites.html, websites.ts      # Active platforms whitelist manager
│   │   └── welcome/                            # Onboarding walkthrough
│   │       └── welcome.html, welcome.ts        # First-run welcome carousel
│   │
│   ├── dashboard/                              # Dashboard views & standalone extension pages
│   │   ├── analytics/                          # 7-tab Statistical Analytics SPA
│   │   │   ├── analytics.html, analytics.ts    # Master SPA coordinator & tab router
│   │   │   ├── insights/                       # Behavioral insights & time-of-day analytics
│   │   │   ├── memory/                         # Retention curves, confidence bands, future simulation
│   │   │   ├── overview/                       # Health metrics, learning velocity sparklines
│   │   │   ├── performance/                    # Lapsed/recovered tracking, review stats
│   │   │   ├── readiness/                      # Target date exam readiness forecast
│   │   │   ├── tags/                           # Tag mastery & coverage breakdown
│   │   │   └── utils/dataUtils.ts              # Core statistical modeling & aggregation engine
│   │   ├── forecast/                           # 30-day upcoming review forecast
│   │   │   └── forecast.html, forecast.ts      # Review workload bar chart
│   │   ├── heatmap/                            # Full-screen contribution heatmap
│   │   │   ├── heatmap.html, heatmap.ts        # Yearly activity grid & day drawer
│   │   │   └── heatmap-stats.ts                # Activity streak & frequency calculators
│   │   ├── history/                            # Historical review logs viewer
│   │   │   └── history.html, history.ts        # Paginated study log table & modal
│   │   ├── pomodoro/                           # Pomodoro study timer
│   │   │   └── pomodoro.html, pomodoro.ts      # SVG animated countdown ring & phase machine
│   │   ├── popup/                              # Action popup window
│   │   │   ├── popup.html, popup.ts            # Popup coordinator & cached DOM blocks
│   │   │   ├── DashboardComponent.ts           # Abstract base component
│   │   │   ├── achievements.ts                 # Milestone achievements & records modal
│   │   │   ├── heatmap.ts                      # Mini-heatmap renderer
│   │   │   ├── notifications.ts                # Popup notification permissions & testing
│   │   │   ├── rating.ts                       # Quick in-popup card review ratings
│   │   │   ├── search.ts                       # Instant problem lookup search bar
│   │   │   └── stats.ts                        # Due/total/retention KPI counters
│   │   ├── studyplan/                          # Exam Countdown Mode
│   │   │   └── studyplan.html, studyplan.ts    # Workload redistribution controller
│   │   └── summary/                            # Weekly & monthly digest summary
│   │       ├── summary.html, summary.ts        # Summary page controller
│   │       └── summaryGenerator.ts             # Review velocity & trend generator
│   │
│   ├── highlighter/                            # In-page text selection highlighter
│   │   ├── highlighter.ts                      # CSS Custom Highlights API & tooltip swatches
│   │   ├── style.css                           # Overlay styling rules
│   │   ├── manager/                            # Highlights management page
│   │   │   └── highlights.html, highlights.ts  # Filterable annotations table
│   │   └── options/                            # Highlighter options
│   │       └── highlightOptions.html           # Palette & symbol customization
│   │
│   └── tracker/                                # Spaced repetition review system
│       ├── tracker.ts                          # Floating in-page widget (#algo-fsrs-tracker)
│       ├── config/                             # FSRS parameter configuration
│       │   └── fsrsConfig.html, fsrsConfig.ts  # 17-weight parameter tuner & auto-training
│       ├── editor/                             # Fullscreen card editor
│       │   └── editor.html, editor.ts          # Markdown problem note editor & live preview
│       └── scheduler/                          # FSRS algorithm implementations
│           ├── scheduler.ts                    # AbstractScheduler base contract
│           ├── fsrsScheduler.ts                # FSRS v4.5 engine, ts-fsrs integration, debouncing
│           ├── fsrsOptimizer.ts                # WASI WebAssembly parameter optimizer
│           └── fsrsOptimizerFast.ts            # Pure JS heuristic SGD fallback optimizer
│
├── scripts/                                    # CI & Verification scripts
│   └── check-artifact-isolation.js             # Validates strict browser string/URL artifact isolation
│
├── tests/                                      # Test suite infrastructure
│   ├── e2e/                                    # Playwright End-to-End browser specs
│   ├── integration/                            # Multi-component integration tests
│   ├── mocks/                                  # Chrome API mock environment (chromeMock.js)
│   └── unit/                                   # Jest unit test suites (71 suites, 1057 tests)
│
├── types/                                      # TypeScript domain contracts
│   ├── backup.ts                               # Discriminated union types for streaming NDJSON
│   ├── chrome.d.ts                             # Chrome extension API typing extensions
│   ├── domain.ts                               # Primary entity models (Card, FSRSCardState, Settings)
│   ├── fsrs.d.ts                               # FSRS parameter definitions
│   └── wasm-runtime.d.ts                       # WASI worker type declarations
│
├── package.json                                # Project dependencies, scripts, and build targets
├── tsconfig.json                               # TypeScript compiler configuration
└── webpack.config.js                           # Webpack 5 partial bundling & CopyPlugin configuration
```
