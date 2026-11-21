# Chrome Extension Monetization & Product Strategy
## AlgoRecall: Coding Interview Spaced Repetition

> **Document Version:** 1.0 · **Date:** August 2026
> **Status:** Strategy Proposal — Requires Founder Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Extension Analysis](#2-extension-analysis)
3. [Product Value Proposition](#3-product-value-proposition)
4. [Target Users](#4-target-users)
5. [User Personas](#5-user-personas)
6. [Competitive Landscape](#6-competitive-landscape)
7. [Chrome Extension Monetization Research](#7-chrome-extension-monetization-research)
8. [Monetization Model Comparison](#8-monetization-model-comparison)
9. [Creative Monetization Opportunities](#9-creative-monetization-opportunities)
10. [Recommended Free vs Pro Structure](#10-recommended-free-vs-pro-structure)
11. [Pricing Strategy](#11-pricing-strategy)
12. [Conversion Funnel](#12-conversion-funnel)
13. [Upgrade Moments](#13-upgrade-moments)
14. [User-Facing Messaging](#14-user-facing-messaging)
15. [Competitor Analysis](#15-competitor-analysis)
16. [Recommended Monetization Strategy](#16-recommended-monetization-strategy)
17. [Monetization Roadmap](#17-monetization-roadmap)
18. [Monetization Experiments](#18-monetization-experiments)
19. [Metrics & KPIs](#19-metrics--kpis)
20. [Risks & Ethical Considerations](#20-risks--ethical-considerations)
21. [Final Recommendations](#21-final-recommendations)
22. [Sources & References](#22-sources--references)

---

## 1. Executive Summary

**AlgoRecall** is a feature-rich, local-first Chrome Extension (Manifest V3) that uses the **FSRS-4.5 spaced repetition algorithm** to help software engineers, students, and competitive programmers retain coding interview patterns across LeetCode, Codeforces, AlgoMonster, and 7 other major platforms. The extension is currently **100% free** with no existing payment infrastructure.

### Key Findings

- **Product-Market Fit Signal:** The extension solves a real, urgent problem — coding interview pattern decay — that directly impacts career outcomes (salary, job offers). This creates strong willingness-to-pay among the target audience.
- **Feature Richness:** The codebase reveals 20+ implemented features far beyond basic spaced repetition, including a 7-tab analytics dashboard, Pomodoro timer, exam countdown mode, WASM-powered parameter optimization, text highlighting, weekly digests, gamification (levels, XP, streaks, confetti celebrations), and full backup/restore. This is already a premium product being given away for free.
- **Ideal Monetization Model:** **Freemium + Subscription** with a strong free tier preserving the core review loop. Cloud Sync (Firebase infrastructure already scaffolded) is the natural premium anchor.
- **Revenue Opportunity:** The interview prep market (LeetCode Premium at $35/mo, NeetCode Pro at ~$12/mo, AlgoExpert at ~$8/mo) establishes strong price anchoring. AlgoRecall can credibly charge **$5–8/month** or **$49–69/year** for Pro features.
- **Existing Infrastructure:** Firebase Auth + Firestore are already integrated in the codebase ([firebase.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/firebase.ts)), and the privacy policy in [CHROMEWEBSTORE.md](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/CHROMEWEBSTORE.md) already mentions a "Pro tier with Cloud Sync." This means the product is architecturally ready for monetization.

### Recommended Launch Pricing

```
Free Tier:     $0     (Core FSRS + 50 cards + local-only storage)
Pro Monthly:   $5.99  (Unlimited cards + Cloud Sync + Advanced Analytics)
Pro Annual:    $49.99  (Save 30% — $4.17/mo equivalent)
Student:       $29.99/year  (40% off with .edu verification)
Lifetime:      $149    (Limited-time launch offer)
```

---

## 2. Extension Analysis

### 2.1 Complete Feature Inventory

Based on full codebase inspection of ~500KB+ of TypeScript source code across 40+ files:

#### Core FSRS Engine
| Feature | Files | Status |
|---------|-------|--------|
| FSRS-4.5 scheduling algorithm (Again/Hard/Good/Easy) | [fsrsScheduler.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsScheduler.ts) | ✅ Implemented |
| WASM-powered parameter optimizer | [fsrsOptimizer.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsOptimizer.ts), [fsrsOptimizerFast.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsOptimizerFast.ts) | ✅ Implemented |
| Topic-weighted FSRS parameters | [domain.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts) `fsrsTopicWeights` | ✅ Implemented |
| Retrievability calculation per card | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) | ✅ Implemented |
| Configurable FSRS parameters (w, decay, factor, requestRetention) | [constants.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/constants.ts) | ✅ Implemented |

#### In-Page Tracker Widget
| Feature | Files | Status |
|---------|-------|--------|
| Floating brain icon widget on coding sites | [tracker.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts) (73KB) | ✅ Implemented |
| Approach/notes text area with Markdown rendering | [markdown.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/markdown.ts), [marked.min.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/marked.min.js) | ✅ Implemented |
| Tag input with auto-suggestions | [tracker.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts) | ✅ Implemented |
| Time/Space complexity fields | [domain.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts) `Card.timeComplexity/spaceComplexity` | ✅ Implemented |
| Full-screen card editor | [editor/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/editor/) | ✅ Implemented |
| Filtered review sessions (tag/platform) | [tracker.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts) `activeReviewFilter` | ✅ Implemented |
| Keyboard shortcuts for rating (1-4) | [tracker.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts) | ✅ Implemented |
| Rating debounce protection | [constants.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/constants.ts) `RATING_UI_DEBOUNCE_MS` | ✅ Implemented |
| Drag positioning for widget | [tracker.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts) | ✅ Implemented |

#### Text Highlighter
| Feature | Files | Status |
|---------|-------|--------|
| Multi-color text highlighting on pages | [highlighter.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.ts) (45KB) | ✅ Implemented |
| CSS Custom Highlights API | [style.css](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/style.css) (24KB) | ✅ Implemented |
| 5 pre-built color palettes | [content.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.ts) | ✅ Implemented |
| Highlight annotation notes | [domain.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts) `HighlightMark.note` | ✅ Implemented |
| Highlight category labels | [domain.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts) `HighlightMark.category` | ✅ Implemented |
| Highlight manager (view all snippets) | [highlights.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/manager/highlights.ts) (28KB) | ✅ Implemented |
| Highlight options/color customization | [highlightOptions.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/options/highlightOptions.ts) (25KB) | ✅ Implemented |
| DOM metadata range recovery | [domain.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts) `DOMMeta` | ✅ Implemented |

#### Dashboard & Analytics
| Feature | Files | Status |
|---------|-------|--------|
| Popup dashboard with stats overview | [popup.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.ts) (46KB), [popup.html](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.html) (30KB) | ✅ Implemented |
| 7-tab full-page Analytics SPA | [analytics.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/analytics.ts) | ✅ Implemented |
| — Overview tab | [overview/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/overview/) | ✅ Implemented |
| — Exam Readiness forecast | [readiness/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/readiness/) | ✅ Implemented |
| — Memory Retention curves | [memory/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/memory/) | ✅ Implemented |
| — Future Memory Simulation | [memory/futureMemorySimulation.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/memory/) | ✅ Implemented |
| — Tag Analytics | [tags/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/tags/) | ✅ Implemented |
| — Performance & Recovery | [performance/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/performance/) | ✅ Implemented |
| — Behavioral Insights | [insights/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/insights/) | ✅ Implemented |
| GitHub-style contribution heatmap | [heatmap/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/heatmap/) | ✅ Implemented |
| Review forecast calendar | [forecast/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/forecast/) | ✅ Implemented |
| Full review history log | [history/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/history/) (30KB) | ✅ Implemented |
| Quick search with tag filtering | [search.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/search.ts) | ✅ Implemented |

#### Gamification
| Feature | Files | Status |
|---------|-------|--------|
| Level & XP progression system | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) L139-165 | ✅ Implemented |
| Level titles (Novice → Grandmaster) | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) L154-158 | ✅ Implemented |
| XP progress bar in header | [popup.html](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.html) L68-70 | ✅ Implemented |
| Daily review goal with progress ring | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) | ✅ Implemented |
| Adjustable daily goal target | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) L274-310 | ✅ Implemented |
| Current streak & longest streak tracking | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) L167-173 | ✅ Implemented |
| Milestone celebrations (confetti + toast) | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) L227-262 | ✅ Implemented |
| Streak milestones: 7, 14, 30, 50, 100, 365 days | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) L228 | ✅ Implemented |
| Review milestones: 50, 100, 250, 500, 1K, 5K | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) L229 | ✅ Implemented |

#### Study Tools
| Feature | Files | Status |
|---------|-------|--------|
| Pomodoro timer (focus/short break/long break) | [pomodoro/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/pomodoro/) | ✅ Implemented |
| Pomodoro background tick with badge countdown | [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) L1060-1101 | ✅ Implemented |
| Exam countdown mode (study plan) | [studyplan/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/studyplan/) | ✅ Implemented |
| Exam countdown pill in dashboard | [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) L210-222 | ✅ Implemented |
| Weekly/Monthly summary report generator | [summaryGenerator.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/summary/summaryGenerator.ts) | ✅ Implemented |

#### Notifications & Engagement
| Feature | Files | Status |
|---------|-------|--------|
| Periodic due-card review notifications | [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) L590-706 | ✅ Implemented |
| In-page DOM notification alerts | [notifications.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/notifications.ts) | ✅ Implemented |
| Smart scheduling (daily at 5 PM) | [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) L239-247 | ✅ Implemented |
| Notification grouping by tags | [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) L674-692 | ✅ Implemented |
| Quiet hours support | [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) L640-667 | ✅ Implemented |
| Streak-aware daily nudges (8 PM) | [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) L918-973 | ✅ Implemented |
| Weekly summary digest | [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) L818-912 | ✅ Implemented |
| Snooze functionality | [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) L397-408 | ✅ Implemented |
| Configurable check interval | [popup.html](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.html) L300-310 | ✅ Implemented |

#### Data & Configuration
| Feature | Files | Status |
|---------|-------|--------|
| JSON backup/restore with gzip + FNV-1a checksum | [backupManager.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/data/backupManager.ts) (31KB) | ✅ Implemented |
| Anki import/export | [popup.html](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.html) L465-486 | ✅ Implemented |
| Data management page | [data.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/data/data.ts) (56KB) | ✅ Implemented |
| Configurable website whitelist | [websites/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/websites/) | ✅ Implemented |
| Dynamic content script injection | manifest.json `scripting` permission | ✅ Implemented |
| FSRS algorithm parameter tuning UI | Referenced in popup.html | ✅ Implemented |
| Dark/Light theme with sync | [theme-sync.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/theme-sync.ts) | ✅ Implemented |
| Developer mode with debug log export | [logger.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/logger.ts) (10KB) | ✅ Implemented |

#### Onboarding
| Feature | Files | Status |
|---------|-------|--------|
| 3-step welcome page (Theme → Highlight → Notifications) | [welcome/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/welcome/) | ✅ Implemented |
| Comprehensive help documentation | [help/](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/help/) (51KB HTML) | ✅ Implemented |
| Chrome Web Store rating prompt with snooze | [rating.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/rating.ts) | ✅ Implemented |

#### Backend/Cloud (Scaffolded, Not Active)
| Feature | Files | Status |
|---------|-------|--------|
| Firebase App initialization | [firebase.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/firebase.ts) | ⚠️ Scaffolded (placeholder config) |
| Firebase Auth (Google OAuth) | [firebase.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/firebase.ts) | ⚠️ Scaffolded |
| Firestore database | [firebase.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/firebase.ts), [firestore.rules](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/firestore.rules) | ⚠️ Scaffolded |

#### Platform Support
10 coding platforms are supported out of the box:
LeetCode · Codeforces · AlgoMonster · CodeChef · AtCoder · HackerRank · HackerEarth · Codewars · CodinGame · System Design School

Plus support for user-added custom domains via the website management UI.

### 2.2 Key Technical Observations

> [!IMPORTANT]
> The privacy policy in [CHROMEWEBSTORE.md](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/CHROMEWEBSTORE.md#L98) already explicitly references **"an optional Pro tier with Cloud Sync"** and describes Firebase Auth + Firestore backup for Pro users. This means the product vision already includes a paid tier — it just hasn't been built yet.

- **No AI/LLM features exist.** There are no API calls to any AI service. All computation is local (FSRS math + WASM optimizer).
- **No existing paywall or premium feature flags.** The entire product is currently free.
- **Firebase is dependency-ready** (`firebase` v10.12 is in `package.json`). The auth, Firestore, and security rules infrastructure is scaffolded but uses placeholder credentials.
- **The extension is MV3 compliant** and uses the current Manifest V3 service worker architecture.

---

## 3. Product Value Proposition

### Why would someone install this extension?

> **"I keep solving LeetCode problems but forgetting the patterns within days. I need a scientifically-backed system that tells me exactly when to review which patterns."**

AlgoRecall embeds directly into the LeetCode/Codeforces workflow — no context switching to a separate app. The user highlights key approaches, rates difficulty, and the FSRS algorithm handles the rest.

### Why would someone continue using it after one week?

1. **Habit loop is strong.** Streaks + daily goals + XP progression + notifications create a behavioral feedback loop.
2. **Sunk cost grows.** Each saved card represents invested study time. The card library becomes personally valuable.
3. **Tangible feedback.** The retention percentage, heatmap, and level badges provide visible proof of progress.
4. **Passive value.** Notifications remind users to review even when they're not actively studying — the extension does the thinking about *what* to review and *when*.

### Why would someone eventually pay for it?

1. **Data portability risk.** Local-only storage means one browser reinstall can erase months of progress. Cloud Sync removes this anxiety.
2. **Cross-device usage.** Students study on laptops, desktops, and sometimes library computers. Sync is essential.
3. **Advanced analytics.** The 7-tab analytics dashboard (memory simulation, exam readiness, tag analysis) could be a premium differentiator.
4. **Time-sensitivity.** Interview prep has deadlines. Exam countdown mode and advanced forecasting help users optimize the limited time they have.

### The "Aha Moment"

The strongest "aha moment" occurs when a user:
1. Saves their first 5-10 cards on LeetCode problems
2. Gets their first notification that a pattern is due for review
3. Reviews the card and realizes they had indeed started to forget the approach
4. Sees their retention rate climb after completing the review

This moment proves the product works — the algorithm correctly predicted memory decay.

### Feature Classification

| Category | Features |
|----------|----------|
| **Nice-to-have** | Theme customization, color palettes, developer mode, debug log export |
| **Useful** | Pomodoro timer, Anki import/export, bookmark tracking, highlight categories |
| **Habit-forming** | Streaks, daily goals, XP/levels, heatmap, milestone celebrations, daily nudges |
| **High-value** | FSRS scheduling, filtered reviews, exam countdown mode, weekly summary |
| **Can justify payment** | Cloud Sync, cross-device access, advanced analytics (7 tabs), future memory simulation, exam readiness forecast, WASM-optimized parameters |

---

## 4. Target Users

### User Segment Ranking

| Rank | Segment | Problem Strength | Usage Frequency | Willingness to Pay | Retention Potential | Lifetime Value | Competitive Alternatives | Score |
|------|---------|-------------------|-----------------|--------------------|--------------------|----------------|-------------------------|-------|
| **1** | **Technical Interview Candidates** | 🔴 Critical | Daily (prep season) | High ($35/mo for LC Premium) | Medium (seasonal) | Medium-High | Moderate | **9/10** |
| **2** | **Computer Science Students** | 🟠 High | 3-5x/week | Medium (price-sensitive) | Very High (4+ years) | High | Low | **8.5/10** |
| **3** | **Software Engineers (continuous learning)** | 🟡 Moderate | 2-3x/week | High (employed) | High | Very High | Low | **8/10** |
| **4** | **Competitive Programmers** | 🟠 High | Daily | Low-Medium | High | Medium | Moderate | **7/10** |
| **5** | **Researchers/Knowledge Workers** | 🟡 Moderate | Variable | Medium | Medium | Medium | High (Anki, Obsidian) | **5/10** |

### Primary Target: Interview Candidates + CS Students

These two segments share the most urgent pain point (career-impacting forgetting) and the strongest existing product fit. The extension is literally built around coding interview patterns.

### Secondary Target: Working Software Engineers

They have the highest willingness to pay and the longest potential LTV but have less acute urgency compared to active interview candidates.

---

## 5. User Personas

### Persona 1: "Interview Isha" — Active Interview Candidate

- **Demographics:** 24, CS grad, 2 years experience, applying to FAANG
- **Pain point:** Solved 200+ LeetCode problems but can't remember sliding window patterns she studied 3 weeks ago
- **Budget:** Already paying $35/mo for LeetCode Premium — willing to add $5-8/mo for a tool that makes her prep more effective
- **Usage pattern:** Daily, intensive, 2-3 month sprint
- **"Aha" moment:** "I reviewed a binary search pattern today that I would have completely forgotten by my Amazon interview next week"
- **Would pay for:** Cloud sync (studies on laptop + desktop), exam countdown mode, advanced analytics

### Persona 2: "Student Sam" — CS Undergrad

- **Demographics:** 20, junior year CS major, preparing for summer internship
- **Pain point:** Takes courses in algorithms but can't retain patterns across semesters
- **Budget:** Very price-sensitive — free is ideal, but would pay student pricing for clear value
- **Usage pattern:** Moderate, consistent across academic year
- **"Aha" moment:** "My streak is at 14 days and my retention is 92% — I'm actually learning these patterns permanently"
- **Would pay for:** Student plan with cloud sync, unlimited cards

### Persona 3: "Engineer Emir" — Senior SWE

- **Demographics:** 32, senior engineer at a mid-size company, casually exploring opportunities
- **Pain point:** Wants to keep interview skills sharp without dedicated prep sprints
- **Budget:** High disposable income — subscription fatigue is the barrier, not cost
- **Usage pattern:** Light, 2-3x/week, long-term
- **"Aha" moment:** "The weekly summary showed me I've maintained 88% retention on 150 patterns over 6 months — I'm always interview-ready"
- **Would pay for:** Annual plan (set-and-forget), advanced memory analytics, WASM optimizer

### Persona 4: "CP Coder" — Competitive Programmer

- **Demographics:** 22, active on Codeforces (rating 1800+), preparing for ICPC
- **Pain point:** Needs to recall hundreds of algorithmic techniques across contests
- **Budget:** Lower willingness to pay for extensions
- **Usage pattern:** High frequency, focused around contest prep cycles
- **Would pay for:** Platform-specific features, bulk card operations

---

## 6. Competitive Landscape

### Direct Competitors

| Product | Type | Target | Free? | Paid | Price | Key Strengths | Key Weaknesses | What AlgoRecall Can Learn |
|---------|------|--------|-------|------|-------|---------------|----------------|--------------------------|
| **Anki** | Desktop/Mobile App | General learners | Yes (desktop) | $24.99 iOS one-time | $0-$25 | Mature ecosystem, FSRS support, huge community | Steep learning curve, no browser integration | Keep UX simple; don't require separate app |
| **LeetCode** (built-in progress) | Web Platform | Interview candidates | Partial | Premium | $35/mo, $159/yr | Company question lists, built-in | Not SRS-based, no spaced repetition | Complement LC, don't compete with it |
| **NeetCode Pro** | Web Platform | Interview candidates | Partial | Pro | ~$12/mo, ~$119/yr | Structured roadmaps, free YouTube | No SRS, no browser extension | AlgoRecall adds the memory layer NeetCode lacks |
| **Quizlet Plus** | Web/Mobile App | Students | Partial | Plus | $7.99/mo, $35.99/yr | Polished UX, AI features, mainstream | Not coding-focused, weak SRS | Price anchor: $36-96/yr is the student sweet spot |
| **RemNote** | Web/Desktop App | Students | Yes | Pro | $10/mo, Pro+AI $20/mo | Built-in SRS + notes | Not coding-specific, requires adoption of new app | Premium AI features are high-value differentiator |
| **Brainscape** | Web/Mobile App | Students | Partial | Pro | $7.99/mo, $199 lifetime | Polished, expert-curated decks | Not coding-specific | Lifetime pricing is strong for students |
| **Mochi** | Desktop App | Power users | Yes | Pro | $5/mo | Markdown-based, developer-friendly | Niche, no browser integration | $5/mo is a good reference for indie tools |

### Indirect Competitors

| Product | Relationship to AlgoRecall |
|---------|---------------------------|
| **AlgoExpert** ($99/yr) | Interview prep platform — AlgoRecall could be a complement |
| **Obsidian** (free + $4-8/mo sync) | Knowledge base with SRS plugin — different use case |
| **Notion** ($10/mo+) | General productivity — overkill for SRS |
| **Todoist** ($7/mo Pro) | Price anchor for productivity subscriptions |

### Key Competitive Insight

> [!TIP]
> **AlgoRecall occupies a unique niche:** It is the only product that combines FSRS-grade spaced repetition with direct browser integration on coding platforms. Anki has better SRS but no browser integration. LeetCode has the platform but no SRS. AlgoRecall bridges this gap.

---

## 7. Chrome Extension Monetization Research

### Market Context (2025-2026)

Based on web research of the current Chrome extension ecosystem:

**Research finding:** The Chrome Web Store no longer provides native payment processing. All monetization must use third-party billing (ExtensionPay, Stripe, custom backend). Source: Multiple developer forums and ExtensionPay documentation.

**Research finding:** Typical free-to-paid conversion rates for Chrome extensions are **0.5%–2%**. Source: Chrome extension monetization guides (2025-2026).

**Research finding:** Successful Chrome extension revenue examples include GoFullPage (~$10K/mo at 4M users), Eightify (~$45K/mo at 100K users), and CSS Scan ($100K+ one-time at $69). Source: Market research reports.

### Successful Extension Monetization Patterns

| Extension | Model | Revenue | Key Lesson |
|-----------|-------|---------|------------|
| GoFullPage | Freemium | ~$10K/mo | Massive free user base, small % convert |
| Eightify (AI YouTube summaries) | Freemium + credits | ~$45K/mo | AI features justify credit-based pricing |
| Night Eye (dark mode) | Subscription | ~$3.1K/mo ($9/mo) | Even utility tools can sustain subscriptions |
| CSS Scan | One-time license | $100K+ total ($69) | Developer tools work well with one-time pricing |
| Grammarly | Freemium + subscription | $200M+ ARR | The gold standard for extension monetization |

### Payment Infrastructure Options

**My recommendation:** Start with **ExtensionPay** for rapid launch, then migrate to custom Stripe + Firebase backend as scale grows. ExtensionPay handles license keys, user accounts, and Stripe payments with minimal setup — perfect for a first monetization experiment.

---

## 8. Monetization Model Comparison

| Model | User Appeal | Revenue Potential | Conversion Potential | Retention | Impl. Complexity | AI/API Cost Fit | Recommended? |
|-------|-----------|-------------------|---------------------|-----------|-------------------|----------------|-------------|
| **Freemium + Subscription** | ⭐⭐⭐⭐ High — free core builds trust | ⭐⭐⭐⭐⭐ Recurring, scalable | ⭐⭐⭐⭐ Good — clear value step-up | ⭐⭐⭐⭐ Strong retention loop | ⭐⭐⭐ Medium — needs billing | ✅ N/A (no AI costs currently) | **✅ Yes — Primary** |
| **Usage Credits** | ⭐⭐ Moderate — complexity concerns | ⭐⭐⭐ Medium | ⭐⭐ Low for this product | ⭐⭐⭐ Medium | ⭐⭐ Medium-High | ⚠️ Only if AI added later | **❌ Not yet** |
| **One-Time License** | ⭐⭐⭐⭐⭐ Very high — no subscription fatigue | ⭐⭐ Lower LTV | ⭐⭐⭐⭐ High — low commitment | ⭐⭐ Lower (no renewal motivation) | ⭐⭐⭐⭐ Simple | ⚠️ Risky if server costs grow | **⚠️ As addon (lifetime)** |
| **Team/Org Plans** | ⭐⭐⭐ Niche | ⭐⭐⭐⭐ High per-deal | ⭐⭐ Low (small market) | ⭐⭐⭐⭐⭐ Very high | ⭐⭐ Complex (admin features) | N/A | **⚠️ Future (Phase 3+)** |
| **Student Discount** | ⭐⭐⭐⭐⭐ Essential for this market | ⭐⭐⭐ Medium | ⭐⭐⭐⭐⭐ Very high for students | ⭐⭐⭐⭐ High (4-year window) | ⭐⭐⭐⭐ Simple | N/A | **✅ Yes — Secondary** |
| **Advertising** | ⭐ Very low — damages trust | ⭐⭐ Low (small audience) | ⭐ Negative impact | ⭐ Hurts retention | ⭐⭐⭐⭐ Simple | N/A | **❌ No — Trust killer** |
| **Affiliate/Referral** | ⭐⭐⭐ Moderate | ⭐⭐ Low-Medium | ⭐⭐⭐ Moderate | ⭐⭐⭐ Neutral | ⭐⭐⭐ Low | N/A | **⚠️ Minor supplement** |

### Reasoning

- **Freemium + Subscription is the clear winner** because: (a) the product has a natural free/paid split (local vs. cloud), (b) the target audience already pays for subscriptions (LC Premium, NeetCode Pro), (c) server costs scale with paid users only, and (d) recurring revenue enables sustainable development.
- **Usage credits don't make sense now** because there are no AI/API operations. If AI features are added later, credits could be layered on.
- **One-time lifetime license works as a complementary option** (common in the SRS space — Brainscape offers $199 lifetime), but should not be the primary model due to lower LTV.
- **Advertising is explicitly not recommended.** The product's trust proposition is "100% private, local-first" — ads would fundamentally contradict this.

---

## 9. Creative Monetization Opportunities

Beyond the standard freemium model, here are 10+ creative opportunities specifically tailored to AlgoRecall:

### 1. 🎓 Semester Pass (Student-Focused)
**Concept:** A semester-length subscription ($14.99 for 5 months) that covers an entire interview prep season. Automatically expires, no cancellation needed.
**Why it works:** Students hate recurring subscriptions. A fixed, predictable cost aligned to their semester removes the biggest friction.

### 2. 🏆 Interview Sprint Pack
**Concept:** A one-time $19.99 "30-Day Interview Sprint" unlock with exam countdown mode, advanced analytics, and priority review scheduling.
**Why it works:** Interview prep is time-bounded. Many candidates would pay for a month of premium features right before their interviews rather than committing to a subscription.

### 3. 📦 Pre-Built Pattern Decks (Marketplace)
**Concept:** Sell curated card decks: "Blind 75 Deck" ($4.99), "System Design Patterns" ($6.99), "Google Top 50" ($4.99). Users get ready-made cards with approaches, tags, and complexity annotations.
**Why it works:** Creating cards takes time. Pre-built decks accelerate the user's setup and provide immediate value. Could evolve into a community marketplace.

### 4. ☁️ Cloud Sync as the Primary Premium Anchor
**Concept:** Core FSRS remains free forever, but Cloud Sync (Firebase backup, cross-device access, account login) requires Pro.
**Why it works:** This is the most natural upgrade path. The free product proves value; sync protects it. Users who've invested 100+ hours building a card library will pay to protect that investment.

### 5. 📊 "Brain Score" — Premium Analytics Dashboard
**Concept:** Gate the 7-tab analytics dashboard behind Pro. Free users see the basic popup stats (total/due/retention). Pro users get the full analytics SPA with memory simulation, exam readiness, tag analytics, performance metrics, and behavioral insights.
**Why it works:** The analytics dashboard is already built and is genuinely impressive. It provides value that clearly exceeds the basic dashboard.

### 6. 🔬 WASM Optimizer Pro
**Concept:** The WASM-powered FSRS parameter optimizer personalizes the algorithm based on the user's review history. This is computationally interesting and intellectually satisfying — make it a Pro feature.
**Why it works:** Power users will value personalized FSRS parameters. It's a "smart" feature that justifies paying for a "smarter" product.

### 7. 🎯 Smart Review Paths
**Concept (Future):** AI-powered review session planning that considers tag dependencies, weakness patterns, and upcoming interview dates to create optimal daily review schedules.
**Why it works:** This would be a genuine step-up in value. Requires AI investment but could be the killer feature that separates AlgoRecall from Anki.

### 8. 📱 Mobile Companion (Future)
**Concept:** A progressive web app or mobile app for reviewing cards on-the-go, synced via Firebase.
**Why it works:** Students review on buses, in queues, before bed. Mobile access is natural demand that arises once users have a card library.

### 9. 🏫 University Site License
**Concept:** Bulk licensing for CS departments. $2/student/semester when purchased for 50+ students. Department gets an admin dashboard showing aggregate analytics (anonymized).
**Why it works:** Universities already buy software licenses. A CS professor who uses spaced repetition could champion adoption across their algorithm courses.

### 10. 🤝 "Study Buddy" Social Features (Future)
**Concept:** Share decks with friends, view each other's streak status, lightweight competition (weekly review leaderboard among a study group).
**Why it works:** Social accountability is a proven driver for habit formation. Study groups already exist informally — give them a tool.

### 11. 📤 Export Upgrades
**Concept:** Free users get basic JSON export. Pro gets: formatted Markdown export, PDF summary export, Notion-compatible export, and highlight compilation export.
**Why it works:** Users who want to use their study data outside the extension will pay for better export formats.

### 12. 🎨 Premium Themes & Customization
**Concept:** Additional visual themes, custom highlight palettes, custom widget skins. Purely cosmetic, low development cost.
**Why it works:** Low value individually, but can be included in Pro as a "cherry on top" to increase perceived value.

---

## 10. Recommended Free vs Pro Structure

### Free Tier — "Always Useful"

**Target:** Everyone. The free tier must be genuinely useful so users understand and trust the product.

| Feature | Limit |
|---------|-------|
| FSRS scheduling (Again/Hard/Good/Easy) | ✅ Unlimited |
| In-page tracker widget | ✅ Full access |
| Text highlighting (all colors/palettes) | ✅ Full access |
| Rating keyboard shortcuts | ✅ Full access |
| Card creation with approach notes, tags, complexity | ✅ Up to **50 active cards** |
| Popup dashboard (basic stats: total, due, retention) | ✅ Full access |
| Contribution heatmap | ✅ Full access |
| Daily goals & streaks | ✅ Full access |
| Level/XP progression | ✅ Full access |
| Review notifications | ✅ Full access |
| Quiet hours | ✅ Full access |
| Daily nudges | ✅ Full access |
| Pomodoro timer | ✅ Full access |
| Onboarding & help docs | ✅ Full access |
| JSON backup/restore (local) | ✅ Full access |
| Dark/Light theme | ✅ Both themes |
| Platform support | ✅ All 10 platforms |
| Custom domains | ✅ Up to 3 custom domains |

> [!IMPORTANT]
> **The 50-card limit is the primary conversion lever.** The average serious interview candidate tracks 75-150+ problems. At 50 cards, the user has proven the product works and invested enough time that they won't want to switch. The limit should be clear and non-punitive — the extension shows a friendly message when the user approaches it.

### Pro Tier — "Your Full Study System" ($5.99/mo or $49.99/yr)

**Target:** Interview candidates, committed students, working engineers.

| Feature | Details |
|---------|---------|
| Unlimited active cards | No cap |
| ☁️ Cloud Sync (Firebase) | Cross-device sync, backup protection, account login |
| 📊 Full Analytics Dashboard | All 7 tabs: Overview, Exam Readiness, Memory Retention, Future Memory Simulation, Tag Analytics, Performance, Behavioral Insights |
| 📅 Exam Countdown Mode | Full study plan redistribution |
| 🔬 WASM Parameter Optimizer | Personalized FSRS parameters |
| 📖 Full Review History | Unlimited history browsing |
| 🔍 Review Forecast Calendar | 30-day forecast view |
| 📝 Weekly/Monthly Summary Reports | Full summary generator with trend comparison |
| 🎨 Premium Themes | Additional visual themes |
| 🌐 Unlimited Custom Domains | Beyond the free 3 |
| 📤 Anki Import/Export | Full Anki deck exchange |
| 🏷️ Filtered Reviews | Filter by tag, platform, state |
| 🎯 Priority email support | Faster response times |

### Student Tier — "Pro for Students" ($29.99/yr)

**Target:** Students with a verifiable .edu email address.

- All Pro features
- 40% discount on annual pricing
- No monthly option (annual only to reduce churn)
- Verified via .edu email domain or student email verification service

### Lifetime Tier — "One-Time, Forever" ($149)

**Target:** Users who hate subscriptions. Engineers who want to "buy it and forget it."

- All current Pro features
- Does not guarantee future Pro+ features
- Available as limited-time launch offer
- Price increases over time as features grow

### Teams / Organizations (Future — Phase 3+)

**Target:** Bootcamps, CS departments, study groups.

- Admin dashboard with aggregate analytics
- Shared deck library
- Bulk user management
- $3-5/user/month (minimum 10 seats)

---

## 11. Pricing Strategy

### Recommended Launch Pricing

| Tier | Monthly | Annual | Savings | Justification |
|------|---------|--------|---------|---------------|
| **Free** | $0 | $0 | — | Core product, proves value |
| **Pro** | $5.99 | $49.99 | 30% vs monthly | Below LeetCode Premium ($35/mo), competitive with Mochi ($5/mo) and Quizlet ($7.99/mo) |
| **Student** | — | $29.99 | 40% off Pro Annual | Price-sensitive segment, long LTV. Competitive with Quizlet ($36/yr) |
| **Lifetime** | — | $149 (one-time) | — | Brainscape charges $199. Launch at $149, increase to $199 after 6 months |

### Pricing Rationale

**Research-backed justifications:**

1. **$5.99/mo sits in the "impulse purchase" zone** for developers. Most developers won't think twice about $6/mo for a tool they use daily. It's the cost of a coffee.

2. **$49.99/yr provides a clear annual discount** (30% off monthly). Annual plans reduce churn dramatically because users don't see monthly charges. The $49.99 price point is psychologically below $50.

3. **$29.99/yr for students** is competitive with Quizlet Plus ($35.99/yr) and significantly cheaper than LeetCode Premium ($159/yr). Students are the most price-sensitive segment but also have the longest potential usage window (4+ years of undergrad + grad school + job changes).

4. **$149 lifetime** is positioned below Brainscape's $199 lifetime option. It appeals to subscription-fatigued engineers and serves as a strong launch promotion.

### Localization Considerations

- **India:** Consider regional pricing at ~₹299/mo (~$3.50) or ₹1,999/yr (~$24). India has the largest LeetCode user base by country but dramatically lower willingness to pay at US prices. Stripe supports INR payments.
- **Other emerging markets:** Consider PPP-adjusted pricing for countries where $50/yr is a significant expense.

### Alternative Pricing Experiments

| Experiment | Variant A | Variant B | Decision Metric |
|------------|-----------|-----------|-----------------|
| Monthly price | $4.99/mo | $7.99/mo | Revenue per user |
| Annual price | $39.99/yr | $59.99/yr | Annual conversion rate |
| Free card limit | 50 cards | 100 cards | Free-to-paid conversion |
| Lifetime availability | Always available | Limited-time only | Lifetime purchase rate |
| Student pricing | $29.99/yr | $19.99/yr | Student conversion rate |

---

## 12. Conversion Funnel

### Stage-by-Stage Design

```
Chrome Web Store Discovery
        ↓
Installation
        ↓
Onboarding (Welcome Page)
        ↓
First Card Saved
        ↓
First Review Notification
        ↓
First Review Completed
        ↓
Habit Formation (7-day streak)
        ↓
Card Limit Approached (40/50)
        ↓
Premium Feature Discovery
        ↓
Upgrade Prompt
        ↓
Purchase
        ↓
Retention & Advocacy
```

### Stage Details

#### 1. Chrome Web Store Discovery
- **UX:** Compelling store listing with screenshots of the dashboard, heatmap, and in-page widget
- **Messaging:** "Master coding patterns, not just problems. Free FSRS spaced repetition for LeetCode & Codeforces."
- **Trigger:** User searches for "leetcode spaced repetition" or "coding interview memory"
- **CTA:** "Add to Chrome — Free"
- **Friction:** Store listing lacks screenshots currently (per [CHROMEWEBSTORE.md](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/CHROMEWEBSTORE.md))
- **Optimization:** Create 3 compelling screenshots showing the tracker widget, analytics dashboard, and heatmap

#### 2. Installation
- **UX:** Standard Chrome extension install flow
- **Messaging:** N/A (Chrome handles this)
- **Trigger:** User clicks "Add to Chrome"
- **Friction:** Permission warnings (9 permissions)
- **Optimization:** Ensure permission justifications are clear in the store listing

#### 3. Onboarding (Welcome Page)
- **UX:** The existing 3-step welcome page: Theme → Highlight/Rate → Notifications
- **Messaging:** "Your FSRS spaced repetition and text highlighter is active!"
- **Trigger:** Automatic on install (already implemented)
- **Friction:** Users may skip onboarding
- **Optimization:** Add a "Save your first pattern" CTA that links directly to LeetCode

#### 4. First Card Saved
- **UX:** User visits LeetCode, sees the brain icon, opens the tracker, fills in approach notes, rates difficulty
- **Messaging:** In-widget: "Pattern saved! You'll be reminded to review this at the optimal time."
- **Trigger:** User clicks a rating button (Again/Hard/Good/Easy) for the first time
- **CTA:** Toast notification confirming the card was saved with the next review date
- **Friction:** User might not understand what to write in "Approach"
- **Optimization:** Add placeholder text: "e.g., 'Use sliding window with left/right pointers...'"

#### 5. First Review Notification
- **UX:** User receives a push notification: "🧠 You have 1 Binary Search pattern ready for review"
- **Messaging:** "5 minutes of review now will save you hours of re-studying later"
- **Trigger:** FSRS due date reached, background alarm fires
- **Friction:** User might dismiss or not have notifications enabled
- **Optimization:** The existing permission warning banner handles this well

#### 6. First Review Completed
- **UX:** User returns to the problem page, opens tracker, rates their recall
- **Messaging:** "Great recall! Next review in 4 days. Your retention: 95%"
- **Trigger:** User completes rating
- **Friction:** User might not remember where the problem page was
- **Optimization:** Add deep-link from notification directly to the problem URL

#### 7. Habit Formation (7-Day Streak)
- **UX:** Streak counter increments, heatmap shows activity, XP bar fills
- **Messaging:** Milestone toast: "🔥 7-Day Streak!" with confetti
- **Trigger:** 7 consecutive days with at least one review
- **Friction:** Breaking the streak
- **Optimization:** The existing streak-aware nudge system handles this (8 PM daily)

#### 8. Card Limit Approached (40/50 Free Cards)
- **UX:** Subtle banner in the tracker widget: "40 of 50 free cards used"
- **Messaging:** "You're making great progress! Upgrade to Pro for unlimited patterns."
- **Trigger:** User creates their 40th card
- **CTA:** "Learn about Pro" link in the tracker
- **Friction:** User might feel forced
- **Optimization:** Frame as "unlock more" not "you've been restricted"

#### 9. Premium Feature Discovery
- **UX:** When user tries to access Analytics Dashboard, show a preview with a soft gate
- **Messaging:** "Preview: See your Memory Retention Curve. Unlock full analytics with Pro."
- **Trigger:** User clicks "Analytics" button in popup
- **CTA:** "Unlock Analytics — Pro"
- **Friction:** User might feel deceived if feature appears free
- **Optimization:** Show a blurred/teaser view of the analytics with real data, not a blank paywall

#### 10. Purchase
- **UX:** Clean pricing modal or page with Free/Pro comparison
- **Messaging:** See Section 14 (User-Facing Messaging)
- **Trigger:** User clicks upgrade CTA
- **CTA:** "Start Pro — $5.99/mo" and "Best Value: $49.99/yr (Save 30%)"
- **Friction:** Payment setup, trust concerns
- **Optimization:** Use ExtensionPay or similar trusted payment provider. Show trust badges.

#### 11. Retention & Advocacy
- **UX:** Continued usage with full Pro features, cloud sync providing peace of mind
- **Messaging:** Monthly digest: "This month: 87 reviews, 93% retention, Lv.12"
- **Trigger:** Ongoing usage
- **CTA:** Rating prompt (already implemented), referral codes (future)
- **Optimization:** The existing weekly summary and milestone system drives long-term engagement

---

## 13. Upgrade Moments

### Best Moments to Present Upgrade

| Moment | Trigger | Why It Works | Message Tone |
|--------|---------|--------------|-------------|
| **Card limit reached** | User creates card #51 | User has invested time and proven value | Helpful: "You've built an impressive library..." |
| **Analytics button clicked** | User taps "Analytics" in popup | User is curious about their data — high intent | Informative: "See your full memory science..." |
| **Exam date set** | User enters exam date in Study Plan | Time pressure creates urgency | Urgent-helpful: "Optimize every day until your exam..." |
| **7-day streak achieved** | 7th consecutive activity day | User is engaged and habituated | Celebratory: "You're on a roll! Pro helps you go further..." |
| **Weekly summary received** | Monday 9 AM weekly digest | User is reflecting on progress | Reflective: "Want deeper insights? Unlock analytics..." |
| **Browser/device switch** | User installs on second device | Cloud sync is immediately relevant | Practical: "Sync your 83 patterns to this device..." |
| **Milestone celebration** | 100 reviews, 30-day streak, etc. | User is in a positive emotional state | Celebratory: "You've earned it! Try Pro free for 7 days..." |
| **WASM optimizer available** | User has 100+ review logs | Personalization becomes possible | Technical: "Your review data can now train a personal FSRS model..." |

### Moments to NEVER Upgrade-Prompt

| Moment | Why Not |
|--------|---------|
| During an active review session | Interrupts core value delivery |
| When user is studying a problem | Disrupts focus |
| On first use (before first card) | No value demonstrated yet |
| More than once per session | Notification fatigue |
| After a failed/Again rating | User is frustrated — wrong time |

---

## 14. User-Facing Messaging

### Popup Upgrade Modal

```
┌─────────────────────────────────────────┐
│   🧠 AlgoRecall Pro                    │
│                                         │
│   Remember every pattern. Forever.      │
│                                         │
│   Free:                                 │
│   ✓ FSRS spaced repetition             │
│   ✓ Up to 50 cards                     │
│   ✓ Text highlighting                  │
│   ✓ Streaks & daily goals              │
│   ✓ Local backup/restore               │
│                                         │
│   Pro:                                  │
│   ✓ Unlimited cards                    │
│   ✓ Cloud Sync across devices          │
│   ✓ Full Analytics Dashboard (7 tabs)  │
│   ✓ Exam Countdown Mode               │
│   ✓ WASM Algorithm Optimizer           │
│   ✓ Review Forecast Calendar           │
│   ✓ Summary Reports                    │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  Upgrade to Pro — $5.99/month  │   │
│   └─────────────────────────────────┘   │
│   Best value: $49.99/year (save 30%)    │
│   Student? Get 40% off →               │
│                                         │
│   [Maybe later]                         │
└─────────────────────────────────────────┘
```

### Premium Feature Prompt (Analytics Gate)

```
┌─────────────────────────────────────────┐
│  📊 Analytics Dashboard                │
│                                         │
│  Your study data tells a story.         │
│                                         │
│  Overview · Exam Readiness · Memory     │
│  Retention · Future Simulation · Tags   │
│  Performance · Behavioral Insights      │
│                                         │
│  [████████████░░] Preview               │
│  43 patterns · 89% retention · Lv.7     │
│                                         │
│  Unlock full analytics with Pro         │
│  to understand your memory science.     │
│                                         │
│  [Unlock Analytics — Pro]               │
│  [Continue with Free]                   │
└─────────────────────────────────────────┘
```

### Usage Limit Prompt (50 Cards)

```
┌─────────────────────────────────────────┐
│  You've saved 50 patterns! 🎉          │
│                                         │
│  That's seriously impressive.           │
│  You're clearly committed to mastering  │
│  these patterns.                        │
│                                         │
│  Upgrade to Pro for unlimited cards     │
│  and never worry about losing your      │
│  progress with Cloud Sync.             │
│                                         │
│  [Upgrade to Pro — $5.99/month]        │
│  [Continue with 50 cards]              │
└─────────────────────────────────────────┘
```

### Chrome Web Store Description (Optimized)

```
Master coding patterns, not just problems.

AlgoRecall uses the FSRS-4.5 algorithm to schedule reviews of your
coding patterns at the exact moment of memory decay. Stop re-studying
problems you've already solved.

🧠 Scientific Memory Scheduling
Rate difficulty (Again/Hard/Good/Easy) and FSRS calculates the optimal
next review date — from 1 day to 3 months.

🖍️ Persistent Text Highlighting
Highlight key approaches directly on LeetCode, Codeforces, and 8 more
platforms. Highlights persist across visits.

📊 Analytics Dashboard
Track retention rates, memory curves, exam readiness, and tag-level
performance across 7 dedicated analytics views.

🔥 Streaks, Levels, & Goals
Stay motivated with daily goals, XP progression (Novice → Grandmaster),
streak tracking, and milestone celebrations.

⏱️ Built-In Study Tools
Pomodoro timer, exam countdown mode, review forecasting, and weekly
summary digests keep you on track.

💾 100% Private & Local-First
All data stays on your device. No tracking, no servers, no signup required.

Free forever. Pro available for unlimited cards, cloud sync, and
advanced analytics.

Works on: LeetCode · Codeforces · AlgoMonster · CodeChef · AtCoder ·
HackerRank · HackerEarth · Codewars · CodinGame + custom domains.
```

### Student-Focused Message

```
🎓 Student Pro — $29.99/year

Build interview-ready memory throughout your degree.

As a CS student, you'll solve hundreds of problems across courses,
contests, and interview prep. AlgoRecall ensures you remember every
pattern when it counts — from freshman algorithms to senior year
interviews.

✓ Unlimited cards for 4+ years of study
✓ Cloud sync between laptop and library computers
✓ Exam countdown mode for finals and interviews
✓ Full analytics to track your growth

Verify with your .edu email to unlock 40% off.
```

### Engineer-Focused Message

```
⚡ Stay Interview-Ready. Always.

You don't have time for 3-month prep sprints.
AlgoRecall keeps your pattern library sharp with
15 minutes/week of scientifically-optimized review.

Pro engineers maintain 150+ patterns at 90%+ retention
— ready for any opportunity that comes up.
```

### Annual Plan Message

```
📅 Save 30% with Annual

Monthly: $5.99/mo = $71.88/year
Annual:  $49.99/year = $4.17/month

That's less than one coffee per month for permanent
coding pattern mastery.
```

### Lifetime Plan Message

```
⭐ Lifetime Pro — $149 (Launch Price)

One payment. Pro forever. No subscriptions.

• Pay once, use forever
• All current Pro features included
• Regular price increases to $199 in 6 months

Best for engineers who want to own their tools.
```

---

## 15. Competitor Analysis

| Competitor | Target | Main Value | Free Model | Paid Model | Pricing | Key Premium Features | Strengths | Weaknesses | What AlgoRecall Can Learn |
|-----------|--------|-----------|------------|------------|---------|---------------------|-----------|------------|--------------------------|
| **Anki** | General learners | Mature SRS | Full desktop free | $24.99 iOS | Free–$25 | N/A (all features free) | Huge community, FSRS support, add-ons | No browser integration, intimidating UX | Keep UX polished; differentiate via browser integration |
| **LeetCode Premium** | Interview candidates | Company question lists | Basic problem access | Premium subscription | $35/mo, $159/yr | Company lists, editorial solutions, AI debugger | Dominant platform, network effects | Not SRS-based, expensive | Position as complement ("use LC for problems, AlgoRecall for memory") |
| **NeetCode Pro** | Interview candidates | Structured roadmaps | YouTube + roadmap free | Pro | ~$12/mo, ~$119/yr | Structured courses, IDE | Excellent free content, strong brand | No SRS, no browser extension | AlgoRecall adds the retention layer |
| **Quizlet Plus** | Students | Flashcard simplicity | Limited flashcards | Plus subscription | $7.99/mo, $35.99/yr | AI features, ad-free, offline | Mass market UX | Not coding-specific, weak SRS | Price anchor for student subscriptions |
| **RemNote Pro** | Students/Researchers | Integrated SRS + notes | Core features free | Pro / Pro+AI | $10/mo, $20/mo+AI | AI study tools, advanced PDF | Built-in SRS, all-in-one | Not coding-specific, complex | AI features are high-value differentiators |
| **Brainscape Pro** | Students | Confidence-based SRS | Basic free | Pro subscription + lifetime | $7.99/mo, $199 lifetime | Expert decks, unlimited AI cards | Polished, lifetime option | Not coding-specific | Lifetime pricing is a viable option |
| **AlgoExpert** | Interview candidates | Curated problems + videos | Very limited | Annual license | ~$99/yr | 160+ curated problems, video explanations | High quality, focused | No SRS, no browser integration | Further validates the $50-100/yr price range for interview tools |

### Competitive Differentiation

> [!TIP]
> **AlgoRecall's unique differentiator is the combination of three elements no competitor offers together:**
> 1. **Real FSRS-4.5 algorithm** (not simplified "spaced repetition")
> 2. **Direct browser integration** on 10 coding platforms (no context switching)
> 3. **Rich gamification** (streaks, XP, levels, milestones) specifically for coding practice
>
> No single competitor combines all three. Anki has #1 but not #2 or #3. LeetCode has partial #2 but not #1 or #3. Quizlet has #3 but not #1 or #2.

---

## 16. Recommended Monetization Strategy

### Primary Model: Freemium + Subscription

```
Free Tier (Core Product — Always Free)
├── FSRS scheduling engine
├── In-page tracker widget
├── Text highlighting
├── Gamification (streaks, XP, levels)
├── Notifications & nudges
├── Pomodoro timer
├── Local backup/restore
└── 50 card limit

Pro Tier ($5.99/mo or $49.99/yr)
├── Unlimited cards
├── ☁️ Cloud Sync (Firebase)
├── Full Analytics Dashboard (7 tabs)
├── Exam Countdown Mode
├── WASM Optimizer
├── Review Forecast
├── Summary Reports
└── Priority support
```

**Why this is the strongest model:**
- **Natural split:** Local vs. cloud, basic vs. advanced analytics
- **Proven in adjacent markets:** Quizlet, RemNote, Mochi all use this model
- **Firebase already scaffolded:** Reduces implementation time significantly
- **Recurring revenue:** Sustainable business model

### Secondary Model: Student Discount + Lifetime Option

- **Student Annual:** $29.99/yr (40% off, .edu verification)
- **Lifetime:** $149 (launch price, increases to $199)

**Why these complement the primary model:**
- Students are the largest segment but most price-sensitive — discounting captures them
- Lifetime option captures subscription-averse engineers and provides upfront cash flow

### Future Model (Phase 3+): Team Plans + Pre-Built Decks

- **Team Plans:** $3-5/user/month for bootcamps and CS departments
- **Deck Marketplace:** Curated pattern decks for $3.99-$6.99 each

---

## 17. Monetization Roadmap

### Phase 1 — Launch (Months 1-3)

| Priority | Action | Effort | Expected Impact |
|----------|--------|--------|-----------------|
| 🔴 P0 | Implement 50-card limit for free tier | Low | Creates conversion pressure |
| 🔴 P0 | Activate Firebase Auth + Firestore Cloud Sync | Medium | Core premium feature |
| 🔴 P0 | Integrate ExtensionPay for billing | Medium | Enables payments |
| 🔴 P0 | Build upgrade modal in popup | Low | Conversion UI |
| 🟡 P1 | Gate Analytics Dashboard behind Pro | Low | Feature differentiation |
| 🟡 P1 | Gate Exam Countdown Mode behind Pro | Low | Feature differentiation |
| 🟡 P1 | Create Chrome Web Store screenshots | Low | Improves discovery |
| 🟡 P1 | Add analytics event tracking | Medium | Enables optimization |
| 🟢 P2 | Student verification flow (.edu email) | Medium | Student segment |
| 🟢 P2 | Lifetime purchase option | Low | Captures subscription-averse users |

### Phase 2 — Optimization (Months 4-8)

| Priority | Action | Effort | Expected Impact |
|----------|--------|--------|-----------------|
| 🔴 P0 | A/B test pricing ($4.99 vs $5.99 vs $7.99) | Low | Revenue optimization |
| 🔴 P0 | Optimize upgrade prompts (timing, messaging) | Low | Conversion optimization |
| 🟡 P1 | Add 7-day free trial for Pro | Low | Reduces purchase friction |
| 🟡 P1 | Implement referral system ("Give Pro, Get Pro") | Medium | Organic growth |
| 🟡 P1 | Regional pricing (India, Brazil, etc.) | Low | Market expansion |
| 🟢 P2 | Email onboarding sequence | Medium | Activation improvement |
| 🟢 P2 | Churn reduction emails (before renewal) | Medium | Retention improvement |

### Phase 3 — Expansion (Months 9-14)

| Priority | Action | Effort | Expected Impact |
|----------|--------|--------|-----------------|
| 🟡 P1 | Pre-built deck marketplace (Blind 75, etc.) | Medium | Additional revenue stream |
| 🟡 P1 | Interview Sprint Pack (30-day unlock) | Low | New pricing option |
| 🟡 P1 | Semester Pass for students | Low | Student-optimized pricing |
| 🟢 P2 | Team/Organization plans | High | B2B revenue |
| 🟢 P2 | University site licensing | High | Institutional sales |
| 🟢 P2 | Social features (deck sharing, study groups) | High | Retention & growth |

### Phase 4 — Scale (Months 15+)

| Priority | Action | Effort | Expected Impact |
|----------|--------|--------|-----------------|
| 🟡 P1 | AI-powered features (smart review paths, AI approach suggestions) | Very High | Premium differentiation |
| 🟡 P1 | Mobile companion app (PWA) | High | New platform, new revenue |
| 🟢 P2 | API access for developers | Medium | Developer ecosystem |
| 🟢 P2 | Enterprise licensing (bootcamps, companies) | Medium | B2B enterprise revenue |
| 🟢 P2 | VS Code companion extension | High | Platform expansion |

---

## 18. Monetization Experiments

### Experiment 1: Card Limit Threshold

| Field | Value |
|-------|-------|
| **Hypothesis** | A 50-card limit will drive higher conversion than a 100-card limit without significantly increasing churn |
| **Target users** | All free users |
| **Variant A** | 50 free cards |
| **Variant B** | 100 free cards |
| **Metric** | Free-to-paid conversion rate at 30 days |
| **Expected result** | 50-card variant converts 1.5-2x higher |
| **Implementation complexity** | Low |
| **Decision criteria** | Choose the variant with highest conversion rate, provided Day-7 retention doesn't drop more than 10% |

### Experiment 2: Monthly Price Point

| Field | Value |
|-------|-------|
| **Hypothesis** | $5.99/mo is the optimal price balancing conversion rate and revenue |
| **Target users** | Users who reach the upgrade modal |
| **Variant A** | $4.99/mo |
| **Variant B** | $5.99/mo |
| **Variant C** | $7.99/mo |
| **Metric** | Revenue per exposed user |
| **Expected result** | $5.99 achieves highest revenue/user (moderate conversion × moderate price) |
| **Implementation complexity** | Low |
| **Decision criteria** | Choose variant with highest revenue per exposed user |

### Experiment 3: Free Trial vs No Trial

| Field | Value |
|-------|-------|
| **Hypothesis** | A 7-day free trial increases conversion by 40%+ by letting users experience Cloud Sync and Analytics |
| **Target users** | Users reaching 40+ cards |
| **Variant A** | Direct purchase (no trial) |
| **Variant B** | 7-day free trial, then billing begins |
| **Metric** | 30-day paid retention rate |
| **Expected result** | Trial variant has higher initial conversion but must verify similar 30-day retention |
| **Implementation complexity** | Medium (requires trial tracking) |
| **Decision criteria** | Choose trial if 30-day paid retention is within 15% of no-trial variant |

### Experiment 4: Upgrade Timing

| Field | Value |
|-------|-------|
| **Hypothesis** | Showing the upgrade prompt after a 7-day streak milestone converts better than at card limit #50 |
| **Target users** | Users approaching conversion touchpoints |
| **Variant A** | Upgrade prompt at card #50 |
| **Variant B** | Upgrade prompt at 7-day streak |
| **Metric** | Click-through rate on upgrade CTA |
| **Expected result** | Streak milestone timing is 20%+ higher CTR due to positive emotional state |
| **Implementation complexity** | Low |
| **Decision criteria** | Choose variant with highest CTR, implement both if CTR difference is < 10% |

### Experiment 5: Annual vs Monthly Emphasis

| Field | Value |
|-------|-------|
| **Hypothesis** | Emphasizing annual pricing (showing it first/larger) increases ARPU by 50%+ |
| **Target users** | Users viewing the pricing modal |
| **Variant A** | Monthly price emphasized, annual shown as alternative |
| **Variant B** | Annual price emphasized ("Best Value"), monthly shown as alternative |
| **Metric** | Average revenue per converting user |
| **Expected result** | Annual-emphasized variant has 40-60% higher ARPU |
| **Implementation complexity** | Low |
| **Decision criteria** | Choose variant with highest 90-day ARPU |

### Experiment 6: Student Pricing Discovery

| Field | Value |
|-------|-------|
| **Hypothesis** | Proactively showing student pricing to users with .edu-like email addresses increases student conversion by 2x |
| **Target users** | Users with .edu email domains |
| **Variant A** | Standard pricing, student discount available on pricing page |
| **Variant B** | Auto-detected .edu email triggers student pricing overlay |
| **Metric** | Student segment conversion rate |
| **Expected result** | Auto-detection variant doubles student conversion |
| **Implementation complexity** | Medium |
| **Decision criteria** | Implement if student conversion rate exceeds 3% |

---

## 19. Metrics & KPIs

### Tier 1 — Must Track (Launch)

| Metric | Definition | Target | Why It Matters |
|--------|-----------|--------|----------------|
| **Installations** | New Chrome Web Store installs | 500+/month | Top of funnel |
| **Activation Rate** | % of installers who save their first card within 7 days | >40% | Measures onboarding effectiveness |
| **Day-7 Retention** | % of activated users who return on day 7 | >30% | Habit formation indicator |
| **Free-to-Paid Conversion** | % of free users who purchase Pro (lifetime basis) | 1-2% | Primary revenue driver |
| **MRR (Monthly Recurring Revenue)** | Total monthly subscription revenue | $500+ by month 6 | Business health |
| **Upgrade Modal CTR** | % of users who click upgrade CTA when shown | >5% | Conversion UI effectiveness |

### Tier 2 — Track Once Monetized

| Metric | Definition | Target | Why It Matters |
|--------|-----------|--------|----------------|
| **Day-30 Retention** | % of activated users returning at 30 days | >20% | Long-term product-market fit |
| **DAU/MAU Ratio** | Daily active / Monthly active users | >25% | Engagement depth |
| **Trial-to-Paid Conversion** | % of free trial users who convert | >30% | Trial effectiveness |
| **ARPU** | Average revenue per user (all users) | $0.50-1.00 | Revenue efficiency |
| **Churn Rate** | Monthly % of subscribers who cancel | <5% | Retention health |
| **CLV** | Customer lifetime value (ARPU × 1/churn) | >$60 | Unit economics |
| **Annual Plan %** | % of subscribers on annual vs monthly | >50% | Revenue predictability |

### Tier 3 — Track for Optimization

| Metric | Definition | Target |
|--------|-----------|--------|
| Feature usage per feature | Which Pro features are actually used | — |
| Cards per user | Average card library size | — |
| Reviews per day per user | Daily engagement depth | — |
| Streak length distribution | How sticky is the habit loop | — |
| Firebase storage cost per user | Cloud sync unit economics | <$0.10/user/mo |
| Support ticket volume | Customer service load | — |

### Most Important Initial Metrics

> [!IMPORTANT]
> **At launch, focus exclusively on three metrics:**
> 1. **Activation Rate** (are people understanding the product?)
> 2. **Day-7 Retention** (is the product sticky?)
> 3. **Free-to-Paid Conversion** (will people pay?)
>
> Everything else is noise until these three are healthy.

---

## 20. Risks & Ethical Considerations

### Risk Matrix

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| **Over-monetization damages trust** | Medium | High | Keep core FSRS free forever. Never paywall essential review functionality. |
| **50-card limit frustrates users** | Medium | Medium | Show clear card count, give generous warning (at 40), make the upgrade path frictionless |
| **Subscription fatigue** | High | Medium | Offer annual and lifetime options. Student pricing. Never auto-upgrade without consent. |
| **Firebase costs exceed revenue** | Low (initially) | High (at scale) | Monitor cost-per-user. Implement efficient Firestore reads. Set storage quotas per user. |
| **Privacy concerns with Cloud Sync** | Low | High | Optional feature. Clear privacy policy. Data encrypted in transit. Delete-on-request. |
| **Chrome Web Store policy violation** | Low | Critical | Review Chrome Web Store Developer Program Policies. No external payments for CWS-listed features (use ExtensionPay which is compliant). |
| **Competitor copies features** | Medium | Medium | Move fast, build brand loyalty, focus on UX quality |
| **Student affordability** | High | Medium | Maintain generous free tier. $29.99/yr student pricing. Consider regional pricing. |
| **Dark pattern perception** | Medium | High | Never use: fake scarcity, hidden charges, forced subscriptions, misleading "free" claims, deceptive UI patterns |
| **Notification spam** | Low | Medium | Quiet hours already implemented. Upgrade prompts limited to natural touchpoints. |

### Ethical Guidelines

> [!CAUTION]
> **Non-Negotiable Principles:**
>
> 1. **The free product must be genuinely useful.** A user who never pays should still get real value from AlgoRecall. The core FSRS review loop must never be paywalled.
>
> 2. **No data hostage tactics.** Users must always be able to export all their data (cards, highlights, activity) in standard formats, regardless of subscription status.
>
> 3. **No deceptive upgrade patterns.** Upgrade prompts must be clearly dismissible. "Maybe later" must always be available. No countdown timers. No "you'll lose your data" threats.
>
> 4. **Transparent pricing.** Show the full price upfront. No hidden fees. No automatic upgrades. Clear cancellation flow.
>
> 5. **Student-first affordability.** The primary audience is students. Pricing must reflect that the product exists to help them succeed, not to extract maximum revenue.
>
> 6. **Privacy is sacred.** Cloud Sync is optional. Local-first remains the default. No analytics data leaves the user's device without explicit consent. No tracking pixels, no ad SDKs.

### Anti-Patterns to Explicitly Avoid

| Pattern | Example | Why It's Wrong |
|---------|---------|----------------|
| Feature regression | "We moved highlighting to Pro" | Breaks trust with existing free users |
| Nagware | Upgrade popup every time the extension opens | Drives uninstalls |
| Usage throttling | "You've reviewed 10 cards today, wait 24 hours" | Punishes the most engaged users |
| Data lock-in | "Export requires Pro" | Hostage tactic |
| Misleading free | "Free!" but practically unusable without paying | Deceptive |
| Forced signup | "Create an account to use the extension" | Contradicts "no signup" promise |

---

## 21. Final Recommendations

### Immediate Actions (Next 30 Days)

1. **Activate Firebase Cloud Sync** — The infrastructure is already scaffolded. This is the #1 premium feature.
2. **Implement 50-card limit** — A single number change that creates the primary conversion pressure.
3. **Integrate ExtensionPay** — Fastest path to accepting payments. Can migrate to custom Stripe later.
4. **Build the upgrade modal** — Clean, honest comparison of Free vs Pro.
5. **Create Chrome Web Store screenshots** — The store listing currently has no screenshots. This is the biggest CWS optimization opportunity.

### Strategic Priorities (Next 6 Months)

1. **Nail the conversion funnel.** Get to 1% free-to-paid conversion before adding new features.
2. **Optimize for annual plans.** Annual subscribers have 3-5x higher LTV than monthly.
3. **Invest in student segment.** Students are the growth engine — they become engineers who continue paying.
4. **Run pricing experiments.** Don't guess — test $4.99 vs $5.99 vs $7.99 with real users.
5. **Build a referral loop.** "Give your study buddy 30 days of Pro" — interview prep is inherently social.

### Long-Term Vision

```
Year 1: Freemium + Subscription → $5-10K MRR
Year 2: + Student plans + Deck marketplace → $20-50K MRR
Year 3: + AI features + Team plans + Mobile → $100K+ MRR
```

### The North Star

> **AlgoRecall should feel like a tool that genuinely wants you to succeed in your interviews.**
>
> The free version should be good enough that you tell friends about it.
> The Pro version should be valuable enough that you happily pay for it.
> The upgrade experience should feel like unlocking more of something great — not removing artificial barriers.

---

## 22. Sources & References

### Research Sources

| Source | Type | Used For |
|--------|------|---------|
| Chrome extension monetization guides (2025-2026 ecosystem) | Web research | Monetization models, conversion rates, payment processing |
| ExtensionPay documentation | Official product page | Payment infrastructure options |
| LeetCode Premium pricing page | Official pricing | Competitor pricing, price anchoring |
| NeetCode.io pricing | Official product | Competitor pricing |
| AlgoExpert pricing | Official product | Competitor pricing |
| Quizlet Plus pricing | Official pricing | Student subscription reference |
| RemNote pricing | Official pricing | SRS subscription reference |
| Brainscape pricing (Apple App Store) | Official listing | Lifetime pricing reference |
| Mochi Cards pricing | Official pricing | Indie SRS pricing reference |
| Anki FAQ / AnkiWeb documentation | Official docs | Open-source SRS model reference |
| Chrome Web Store Developer Policies | Official Google docs | Compliance requirements |

### Codebase Analysis Sources

All feature inventory data is derived from direct inspection of the [algomonster-fsrs-extension](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/) codebase, including:
- [manifest.json](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/manifest.json) (permissions, platform scope)
- [background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) (1211 lines — all background logic)
- [content.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.ts) (527 lines — orchestrator)
- [tracker.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts) (1311 lines — review widget)
- [highlighter.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.ts) (45KB — highlighting engine)
- [popup.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.ts) (832 lines — dashboard)
- [stats.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.ts) (673 lines — gamification)
- [analytics.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/analytics.ts) (298 lines — analytics SPA)
- [domain.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts) (259 lines — type definitions)
- [requirements.md](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/requirements.md) (233 lines — feature backlog)
- [CHROMEWEBSTORE.md](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/CHROMEWEBSTORE.md) (125 lines — store listing)
- [firebase.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/firebase.ts) (35 lines — Firebase config)

### Disclaimer

> [!NOTE]
> - All competitor pricing data was collected from web searches conducted in August 2026. Prices may have changed since research was conducted.
> - Revenue estimates for Chrome extensions (GoFullPage, Eightify, etc.) are from market reports and are approximate.
> - The pricing recommendations in this document are the author's strategic suggestions based on market research and competitive analysis. They should be validated through experiments with real users before commitment.
> - No code was modified during this analysis. All recommendations are strategic and documentary in nature.
