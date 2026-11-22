# E2E Test Suite Ready

## Test Runner
- **Command**: `npx jest tests/integration/acceptance/ --no-cache`
- **Expected**: All 4 test suites pass, 150/150 tests pass with exit code 0
- **TypeScript Gate**: `npx tsc --noEmit` (passes with exit code 0)
- **Artifact Isolation Gate**: `node scripts/check-artifact-isolation.js` (passes 37/37 checks)
- **Declarative DOM Gate**: `node scripts/audit-declarative-dom.js` (passes with 0 violations)

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 65 | 5 tests per feature covering all 13 core features (Features 1–13) |
| 2. Boundary & Corner Cases | 65 | 5 tests per feature covering boundary, extreme, and corruption conditions |
| 3. Cross-Feature Combinations | 15 | Pairwise cross-feature interaction tests (Features 1–13 matrix) |
| 4. Real-World Application Scenarios | 5 | Multi-step acceptance workflows: Full backup restore (52 cards/35 due/63% retention/best streak 8/Lv. 7), LeetCode Next.js SPA problem route transition resilience, settings modification and Gzip NDJSON V2 export round-trip with FNV-1a checksums, review workflow completion with card transition, and multi-browser build/manifest isolation |
| **Total** | **150** | **100% Pass Rate Across All 4 Tiers** |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---------|:------:|:------:|:------:|:------:|
| F1: Backup Deserialization & Storage Hydration | 5 | 5 | ✓ | ✓ |
| F2: FSRS Global Parameters Hydration & Retention | 5 | 5 | ✓ | ✓ |
| F3: HistoryLog Fallback for Card Review Dates | 5 | 5 | ✓ | ✓ |
| F4: Settings UI Dynamic Hydration & Change Listeners | 5 | 5 | ✓ | ✓ |
| F5: Host SPA DOM Isolation via Dedicated Host | 5 | 5 | ✓ | ✓ |
| F6: SPA Route Navigation Lifecycle & Mount Recovery | 5 | 5 | ✓ | ✓ |
| F7: MutationObserver Throttling & Feedback Loop Prevention | 5 | 5 | ✓ | ✓ |
| F8: Thread-Safe Notifications (Alert Replacement) | 5 | 5 | ✓ | ✓ |
| F9: History Navigation Listener (`popstate`) | 5 | 5 | ✓ | ✓ |
| F10: Declarative TagInput Component Compliance | 5 | 5 | ✓ | ✓ |
| F11: Review Forecast Calendar Subtitle Parity | 5 | 5 | ✓ | ✓ |
| F12: Popup Visual & KPI Card Parity | 5 | 5 | ✓ | ✓ |
| F13: Analytics SPA & Settings Visual Parity | 5 | 5 | ✓ | ✓ |

## Test Verification Artifacts
- Tier 1 Suite: `tests/integration/acceptance/tier1_feature_coverage.spec.ts` (65 tests)
- Tier 2 Suite: `tests/integration/acceptance/tier2_boundary_corner.spec.ts` (65 tests)
- Tier 3 Suite: `tests/integration/acceptance/tier3_cross_feature.spec.ts` (15 tests)
- Tier 4 Suite: `tests/integration/acceptance/tier4_real_world_scenarios.spec.ts` (5 scenarios)
- Shared Test Helpers: `tests/integration/acceptance/helpers/` (`backupFixtureHelper.ts`, `storageHydrationHelper.ts`, `fsrsCalculationHelper.ts`, `domHostHelper.ts`)
- Fixture Tracked in Git: `tests/fixtures/algo_pro_backup_2026-11-20.json.gz` (verified unignored via `!tests/fixtures/*.gz`)
