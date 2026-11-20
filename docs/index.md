# AlgoRecall Architecture & Technical Documentation Index

Welcome to the authoritative technical documentation for **AlgoRecall: Coding Interview Spaced Repetition Extension**. This documentation suite provides an exhaustive analysis of the codebase, Manifest V3 architecture, FSRS-4.5 scheduling engine, WASM optimization runtime, content injection pipelines, state management, and test suites.

---

## 🏛️ Documentation Layout

```text
docs/
├── README.md                                   # Root Documentation Overview & Hub
├── index.md                                    # Master Technical Topic Sitemap (This file)
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

## 📑 Complete Table of Contents

### 1. Architecture & System Design
* 📘 [Architecture Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/overview.md) — High-level MV3 Chrome Extension architecture, background service worker lifecycle, and runtime message routing.
* 🏗️ [System Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/system-architecture.md) — Detailed 3-tier extension architecture, host page content injection, service worker orchestration, and standalone extension views.
* 🌐 [Browser Extension Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/browser-extension-architecture.md) — Manifest V3 implementation, Chrome vs Firefox vs Safari cross-browser nuances, CSP declarations, permissions, and service worker lifecycles.
* 🧩 [Module Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/module-architecture.md) — Module hierarchy, entry points, dependency couplings, and architectural boundaries.
* 💾 [Data Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/data-architecture.md) — Core entities, relational models, local persistence strategy, and storage indexing.
* 🔄 [End-to-End Data Flow](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/data-flow.md) — Data pipelines connecting Chrome Storage, Background Service Worker, Content Scripts, and WASM runtime.
* 📦 [State Management](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/state-management.md) — Distributed state architecture, `StorageData` schema, and reactive `chrome.storage.onChanged` synchronization.
* 📡 [Communication Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/communication-architecture.md) — Cross-context message passing, `MessageType` action routing, and `chrome.commands` shortcut dispatching.

### 2. Architecture Diagrams
* 🗺️ [System Overview Diagrams](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/diagrams/system-overview.md) — High-level system architecture and repository module decomposition diagrams.
* ⚙️ [Runtime Architecture Diagrams](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/diagrams/runtime-architecture.md) — Runtime lifecycles, contexts, and review sequence flows.
* 🔗 [Module Dependency Diagram](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/diagrams/module-dependencies.md) — Detailed cross-module dependency visualization.
* 🔁 [Data Flow Diagrams](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/diagrams/data-flow.md) — Storage architecture and state propagation flows.
* 🔔 [Notification Flow Diagram](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/diagrams/notification-flow.md) — Background alarm scheduling, quiet hours evaluation, and desktop push routing.

### 3. Feature Deep Dives
* 📋 [Feature Inventory & Matrix](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/README.md) — Comprehensive inventory of all 18+ application features with technical attributes.
* 🎯 [Review System & Tracker](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/review-system.md) — In-page overlay widget, fullscreen card editor, rating controls, debounced submission, and preState rollbacks.
* 🧮 [Spaced Repetition Engine](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/spaced-repetition-engine.md) — FSRS-4.5 mathematics, ts-fsrs integration, WASM optimizer, and heuristic SGD fallback.
* 📅 [Exam Countdown Mode](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/exam-mode.md) — Target date workload redistribution algorithm, SVG countdown ring, and non-destructive schedule backup/restore.
* ⏱️ [Pomodoro Study Timer](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/pomodoro.md) — Work/break cycle state machine, toolbar badge ticking, background alarm resilience, and productivity metrics.
* 📈 [Analytics Engine](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/analytics.md) — 7-tab SPA dashboard: retention curves, velocity sparklines, exam readiness forecasting, and time-of-day insights.
* 🖍️ [Highlighter & Annotations](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/highlights.md) — CSS Custom Highlights API integration, DOM metadata range serialization, and card approach linking.
* 🔔 [Notifications & Reminders](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/notifications.md) — Due card alerts, smart study hour (17:00), daily streak nudge (20:00), quiet hours, and weekly summaries.
* 💾 [Backup & Restore](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/backup-restore.md) — Streaming Gzip NDJSON export/import, 32-bit FNV-1a checksums, URL deduplication, and legacy JSON migration.
* 📦 [Anki Integration](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/anki-integration.md) — Bi-directional TSV/TXT deck export and import with header directives and tag mapping.
* 📊 [Dashboard Views](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/dashboard.md) — Popup dashboard, full-screen contribution heatmap, 30-day review forecast, and review history.
* 🛠️ [Common Utilities & Help Hub](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/common.md) — Centralized constants, DOMPurify markdown sanitization, whitelist management, and Help Center SPA.

### 4. Data Subsystem
* 🗂️ [Data Models](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/data/data-models.md) — Full TypeScript entity specifications (`Card`, `ReviewLog`, `FSRSCardState`, `PomodoroState`, `StorageData`).
* 💽 [Storage Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/data/storage.md) — `chrome.storage.local` schema, access patterns, serialization limits, and concurrency control.
* 🧬 [Data Migrations](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/data/data-migrations.md) — Backward compatibility strategies, legacy record migrations, and backup archive evolution.

### 5. Engineering & Development Lifecycle
* 🚀 [Getting Started](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/development/getting-started.md) — Environment setup, package installation, and browser developer mode loading.
* 📂 [Project Structure](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/development/project-structure.md) — Complete annotated directory tree of all meaningful codebase files.
* 🛠️ [Build Process](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/development/build-process.md) — Webpack 5 pipeline, TypeScript compilation, CopyPlugin rules, and release packaging.
* 🧪 [Testing Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/development/testing.md) — Jest unit & integration testing, mock Chrome APIs, and Playwright E2E browser tests.
* 🚢 [Deployment & Packaging](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/development/deployment.md) — Multi-browser builds, zip packaging, store submission guides, and isolation checks.

### 6. Architecture & Technical Debt Review
* 🔍 [Technical Debt Analysis](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/engineering/technical-debt.md) — Categorized audit of architectural debt, DOM boilerplate, unused dependencies, and risks.
* ⚡ [Performance Analysis](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/engineering/performance.md) — Bundle size analysis, memory footprint, WASM execution benchmarks, and debounce metrics.
* 🔒 [Security & Permissions Review](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/engineering/security-review.md) — Content Security Policy (`'wasm-unsafe-eval'`), DOMPurify sanitization, and permission justifications.

### 7. Reference & Appendices
* 📖 [Glossary](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/reference/glossary.md) — Definition of key terms (FSRS, Stability, Retrievability, Difficulty, MV3, NDJSON, etc.).
* 🔑 [Key Files Directory](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/reference/key-files.md) — Directory of the 25 most critical source files and their responsibilities.
* 📦 [Dependencies Audit](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/reference/dependencies.md) — Direct and development dependency audit with licensing compliance.
