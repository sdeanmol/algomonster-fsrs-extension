# AlgoRecall: Technical Documentation Suite

Welcome to the comprehensive architecture, design, and implementation documentation for **AlgoRecall** (formerly `algomonster-fsrs-extension`), a production-grade, local-first browser extension for algorithmic coding spaced repetition and interactive text highlighting.

This documentation suite serves as the definitive reference for software architects, TypeScript engineers, security auditors, and developers joining or contributing to the project.

---

## 📚 Documentation Index

```text
docs/
├── README.md                                   # Root Documentation Overview & Hub (This file)
├── index.md                                    # Master Technical Topic Sitemap
│
├── architecture/                               # System Architecture & Design
│   ├── overview.md                             # High-Level Architecture Overview
│   ├── system-architecture.md                  # 3-Tier Extension System Design
│   ├── browser-extension-architecture.md       # Manifest V3 Runtime & Multi-Browser Support
│   ├── module-architecture.md                  # Module Decomposition & Dependency Graph
│   ├── data-architecture.md                    # Data Architecture & Entity Modeling
│   ├── state-management.md                     # Distributed State & Storage Reactivity
│   ├── communication-architecture.md           # Message Passing & Command Dispatching
│   └── diagrams/                               # Formal Mermaid Architecture Diagrams
│       ├── system-overview.md                  # System & Module Architecture Diagrams
│       ├── runtime-architecture.md             # Extension Runtime & Lifecycle Diagrams
│       ├── module-dependencies.md              # Cross-Module Dependency Diagram
│       ├── data-flow.md                        # End-to-End Data Flow & State Diagrams
│       └── notification-flow.md                # Background Alarms & Push Notification Flow
│
├── features/                                   # Feature-by-Feature Deep Dives
│   ├── README.md                               # Complete Feature Inventory & Capability Matrix
│   ├── review-system.md                        # In-Page Problem Tracker & Fullscreen Editor
│   ├── spaced-repetition-engine.md             # FSRS-4.5 Engine, Math & WASM Optimizer
│   ├── exam-mode.md                            # Exam Countdown Mode & Workload Redistribution
│   ├── pomodoro.md                             # Persistent Pomodoro Study Timer
│   ├── analytics.md                            # 7-Tab Statistical Analytics SPA
│   ├── highlights.md                           # CSS Custom Highlights & Text Annotation
│   ├── notifications.md                        # Desktop Notifications, Quiet Hours & Digests
│   ├── backup-restore.md                       # Streaming Gzip NDJSON Backup & Checksums
│   ├── anki-integration.md                     # Bi-Directional Anki Deck Interchange
│   ├── dashboard.md                            # Dashboard Views & Popup Architecture
│   ├── common.md                               # Shared Utilities, Help SPA & Settings
│   └── requirements.md                         # Feature Backlog & Requirements Matrix
│
├── data/                                       # Data Models & Storage Subsystem
│   ├── data-models.md                          # Domain Entities & TypeScript Interfaces
│   ├── storage.md                              # chrome.storage.local Architecture & Access
│   └── data-migrations.md                      # Schema Versioning & Backward Compatibility
│
├── development/                                # Engineering & Development Lifecycle
│   ├── getting-started.md                      # Developer Setup & Local Browser Loading
│   ├── project-structure.md                    # Annotated Directory Structure
│   ├── build-process.md                        # Webpack 5, TypeScript & CopyPlugin Pipeline
│   ├── testing.md                              # Jest Unit, Integration & Playwright E2E Tests
│   └── deployment.md                           # Packaging & Multi-Store Release Process
│
├── engineering/                                # Architecture & Quality Review
│   ├── technical-debt.md                       # Technical Debt Findings (P0-P3) & Evidence
│   ├── performance.md                          # Bundle Size, WASM Benchmarks & Profiling
│   └── security-review.md                      # Manifest V3 CSP, DOMPurify & Permissions
│
└── reference/                                  # Reference & Appendices
    ├── glossary.md                             # Domain Glossary (FSRS, MV3, WASI, etc.)
    ├── key-files.md                            # Quick-Reference Guide to Critical Source Files
    └── dependencies.md                         # Dependency Audit & License Verification
```

---

## ⚡ Quick Architecture Summary

AlgoRecall is built on **Manifest V3** with **TypeScript** and **Webpack 5**:

1. **Local-First & Zero Signup**: All problem cards, review logs, highlight annotations, and settings are stored locally in [`chrome.storage.local`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/data/storage.md). No cloud database is required.
2. **Mathematical Spaced Repetition**: Powered by the **Free Spaced Repetition Scheduler (FSRS v4.5)** algorithm implemented via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs), coupled with an optional **WebAssembly/WASI optimizer** (`@open-spaced-repetition/binding`) for personalized parameter training.
3. **Cross-Browser Core**: Supports **Google Chrome**, **Mozilla Firefox**, and **Apple Safari** from a unified TypeScript codebase using compile-time dead-code elimination via Webpack's `DefinePlugin`.
4. **Contexts**:
   - **Background Service Worker** ([`background/background.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts)): Manages alarms, desktop notifications, badge ticking, and command routing.
   - **Content Scripts** ([`content/content.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.ts)): Injected into whitelisted platforms (LeetCode, AlgoMonster, Codeforces, etc.) to render the floating tracker widget, CSS Custom Highlights, and toast notifications.
   - **Extension UI Pages** ([`features/dashboard/`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/) and [`features/common/`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/)): Standalone single-page views for popup controls, full 7-tab analytics, exam countdown redistribution, Pomodoro timers, and data management.

---

## 🎯 Navigating the Documentation

- **For New Developers**: Start with [Getting Started](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/development/getting-started.md) and [System Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/system-architecture.md).
- **For Architects & Reviewers**: Read [Browser Extension Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/browser-extension-architecture.md), [Data Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/data-architecture.md), and [Technical Debt Review](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/engineering/technical-debt.md).
- **For Spaced Repetition Specialists**: Explore [Spaced Repetition Engine](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/spaced-repetition-engine.md) and [FSRS Algorithm Deep Dive](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md).
- **For Diagrams**: Browse the [Architecture Diagrams Catalog](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/diagrams/system-overview.md).
