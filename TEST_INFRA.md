# E2E Test Infra: AlgoRecall Acceptance Suite

## Test Philosophy
- **Requirement-Driven & Opaque-Box**: Derived strictly from user specifications and acceptance criteria in `ORIGINAL_REQUEST.md` (R1–R4) and reference evidence (NDJSON backup archive `algo_pro_backup_2026-11-20.json.gz` and 13 UI reference screenshots).
- **Zero Internal Coupling**: Verifies externally observable behavior, storage hydration, mathematical FSRS scheduling invariants, declarative DOM isolation, and host SPA stability.
- **Systematic 4-Tier Test Design Methodology**:
  - **Tier 1 — Feature Coverage**: Equivalence partition coverage with >=5 tests per core feature across all 13 features (65 tests).
  - **Tier 2 — Boundary & Corner Cases**: Edge, boundary, corruption, and extreme load cases with >=5 tests per feature (65 tests).
  - **Tier 3 — Cross-Feature Combinations**: Pairwise interaction tests systematically exercising interconnected features (15 tests).
  - **Tier 4 — Real-World Application Scenarios**: Multi-step realistic acceptance workflows validating end-to-end user journeys (5 comprehensive scenarios).

---

## Feature Inventory & Test Mapping

| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------|:------:|:------:|:------:|:------:|
| 1 | Backup Archive Deserialization & Storage Hydration | R1 (line 19) | 5 | 5 | T3-01, T3-07, T3-12 | T4-SC-01, T4-SC-03 |
| 2 | FSRS Global Parameters Hydration & Retrievability Parity | R1 (line 20) | 5 | 5 | T3-04, T3-15 | T4-SC-01, T4-SC-04 |
| 3 | HistoryLog Fallback for Card Review Dates | R1 (line 20) | 5 | 5 | T3-07, T3-12 | T4-SC-01, T4-SC-04 |
| 4 | Settings UI Dynamic Hydration & Change Listeners | R2 (line 23) | 5 | 5 | T3-04, T3-08, T3-10, T3-15 | T4-SC-01, T4-SC-03 |
| 5 | Host SPA DOM Isolation via Dedicated Tracker Host | R3 (line 26) | 5 | 5 | T3-02, T3-08, T3-09 | T4-SC-02 |
| 6 | SPA Route Navigation Lifecycle & Mount Recovery | R3 (line 26) | 5 | 5 | T3-02, T3-11, T3-13, T3-14 | T4-SC-02 |
| 7 | MutationObserver Throttling & Feedback Loop Prevention | R3 (line 26) | 5 | 5 | T3-05, T3-10 | T4-SC-02 |
| 8 | Thread-Safe Notifications (Alert Replacement) | R3 (line 26) | 5 | 5 | T3-05, T3-11 | T4-SC-02 |
| 9 | History Navigation Listener (`popstate`) | R3 (line 26) | 5 | 5 | T3-06, T3-14 | T4-SC-02 |
| 10 | Declarative TagInput Component Compliance | R4 (line 29) | 5 | 5 | T3-03, T3-13 | T4-SC-01 |
| 11 | Review Forecast Calendar Subtitle Parity | R2 (line 23) | 5 | 5 | T3-06 | T4-SC-01 |
| 12 | Popup Visual & KPI Card Parity | R1, R2 | 5 | 5 | T3-01, T3-09 | T4-SC-01, T4-SC-04 |
| 13 | Analytics SPA & Settings Visual Parity | R2 (line 23) | 5 | 5 | T3-03, T3-04 | T4-SC-01 |

---

## Test Architecture

### Location & Invocation
- **Directory**: `tests/integration/acceptance/`
- **Runner**: Jest 29 with `ts-jest` and `jsdom` test environment.
- **Full Acceptance Suite Command**:
  ```bash
  npx jest tests/integration/acceptance/ --no-cache
  ```
- **Whole Repository Verification Command**:
  ```bash
  npm test
  ```
- **Type Safety Gate**:
  ```bash
  npx tsc --noEmit
  ```
- **Artifact & Declarative Audits**:
  ```bash
  node scripts/check-artifact-isolation.js
  node scripts/audit-declarative-dom.js
  ```

### Directory Layout
```
tests/integration/acceptance/
├── helpers/
│   ├── backupFixtureHelper.ts      # NDJSON Gzip V2 parsing, FNV-1a checksums, corruption generators
│   ├── storageHydrationHelper.ts   # Time freezing (1795353012606), storage seeding, WHATWG polyfills
│   ├── fsrsCalculationHelper.ts    # Mathematical oracles for due counts, retrievability, streaks, levels
│   └── domHostHelper.ts            # Host SPA DOM environment, route transitions, popstate simulation
├── tier1_feature_coverage.spec.ts  # Tier 1: 65 feature coverage tests (5 per feature)
├── tier2_boundary_corner.spec.ts   # Tier 2: 65 boundary and stress tests (5 per feature)
├── tier3_cross_feature.spec.ts     # Tier 3: 15 pairwise interaction tests
└── tier4_real_world_scenarios.spec.ts # Tier 4: 5 comprehensive acceptance scenarios
```

### Determinism & Invariants
- **Baseline Timestamp**: Sunday 2026-11-22T13:10:12.606Z (`1795353012606`).
- **Mathematical Oracle Constants**:
  - Cards Count: `52`
  - Due Cards Count: `35`
  - Retention Rate: `63%` (`63.407%` rounded to nearest integer)
  - Level: `Lv. 7` ($\lfloor 1 + 0.6 \times \sqrt{112} \rfloor$)
  - Best Streak: `8`
  - Unlocked Achievements: `5/8` (`first_review`, `streak_3`, `streak_7`, `cards_25`, `reviews_100`)
- **DOM Isolation Guarantee**:
  - `#algo-tracker-host` strictly isolated; `document.body.__k` is never created or deleted.
  - Content script ignores mutations in `.monaco-editor`, `.ace_editor`, and `textarea` with 150ms debounce.

---

## Real-World Application Scenarios (Tier 4)

| # | Scenario | Features Exercised | Description |
|---|----------|--------------------|-------------|
| 1 | Full Backup Restore & Complete KPI Parity (`T4-SC-01`) | F1, F2, F3, F4, F10, F11, F12, F13 | Complete restore of `algo_pro_backup_2026-11-20.json.gz`, verifying all 52 cards, 35 due cards, 63% retention, best streak 8, Lv. 7, 5/8 achievements, Popup summary cards, Settings, and Analytics SPA views. |
| 2 | Host SPA Route Transition Resilience (`T4-SC-02`) | F5, F6, F7, F8, F9 | Simulates LeetCode Next.js multi-problem SPA navigation, verifying tracker host unmounting, container re-creation, launcher recovery, MutationObserver throttling, and zero host DOM pollution. |
| 3 | Settings Modification & Backup Export Round-Trip (`T4-SC-03`) | F1, F4 | Customizes settings (whitelist, theme, highlight color, FSRS parameters), exports Gzip NDJSON V2 backup, verifies 32-bit FNV-1a checksum and record count, and re-imports into empty storage with 100% fidelity. |
| 4 | End-to-End Review Workflow Completion (`T4-SC-04`) | F1, F2, F3, F12 | Completes review on a due card with rating 'Good', verifying FSRS stability/difficulty updates, review date recording, due count decrement from 35 to 34, activity count increment, and daily goal progress. |
| 5 | Multi-Browser Build & Manifest Isolation Compliance (`T4-SC-05`) | F1–F13, Manifest V3 | Audits Chrome, Firefox, and Safari Manifest V3 configs, permissions (`notifications`/`downloads` absent on Safari), and verifies zero cross-browser store URL contamination across all compiled bundles. |

---

## Coverage Thresholds & Target Metrics
- **Tier 1**: 65 tests (5 tests × 13 features) — Target: 100% Pass
- **Tier 2**: 65 tests (5 tests × 13 features) — Target: 100% Pass
- **Tier 3**: 15 tests (major pairwise combinations) — Target: 100% Pass
- **Tier 4**: 5 realistic application scenarios — Target: 100% Pass
- **Total Acceptance Test Count**: **150 tests** — Required: 100% Pass Rate
