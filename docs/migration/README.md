# Migration Documentation: Vanilla TypeScript → Preact Feature Parity

This directory contains the authoritative tracking boards, feature parity matrices, architectural decisions, and validation reports for achieving 100% feature and behavioral parity between the `main` branch (reference) and the `preact` branch (target).

## Documents Index

1. [MIGRATION_BOARD.md](./MIGRATION_BOARD.md) — Live project tracking board with statuses (DISCOVERED, READY, IN PROGRESS, IMPLEMENTED, TESTING, VERIFIED, COMPLETE) and detailed checklists for each feature.
2. [FEATURE_PARITY_MATRIX.md](./FEATURE_PARITY_MATRIX.md) — Exhaustive mapping of all commits on `main` to Preact files, behavioral specifications, and parity status.
3. [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) — Formal Architecture Decision Records (ADRs) defining UI boundaries (Preact vs Vanilla TS content scripts), state management, and decorator usage.
4. [VALIDATION_REPORT.md](./VALIDATION_REPORT.md) — Empirical evidence of compilation, test passes, cross-browser builds, and artifact isolation checks.
