# AlgoRecall — Feature Enhancement Requirements

> **Scope**: New capabilities to make the extension indispensable for **students**, **software engineers**, **competitive programmers**, and **lifelong learners**.
>
> **Baseline**: Current v3.0 ships FSRS scheduling, text highlighting, a popup dashboard with heatmap/stats, notification alerts, JSON import/export, and whitelisted multi-platform support (LeetCode, Codeforces, AlgoMonster, CodeChef, AtCoder, HackerRank, HackerEarth, Codewars, CodinGame).

---

## 1. Smarter Review Experience

These enhancements target the core FSRS review loop in [tracker.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.js) and [fsrs.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/fsrs.js).

### 1.1 Filtered & Prioritised Review Sessions
| ID | Requirement | Persona |
|----|-------------|---------|
| R1.1 | Allow users to start a review filtered by **tag** (e.g. only "Binary Search" or "System Design") | Students, SWEs |
| R1.2 | Allow users to start a review filtered by **platform** (e.g. only LeetCode cards) | Competitive Programmers |
| R1.3 | Sort due cards by **overdue factor** (most overdue first) instead of raw `due` timestamp | All |
| R1.4 | Add a "Review Queue Preview" showing count-by-tag before starting a session | All |

### 1.2 Richer Card Content
| ID | Requirement | Persona |
|----|-------------|---------|
| R1.5 | Support **Markdown rendering** in the approach textarea (headings, bold, code blocks, lists) — currently plaintext only | SWEs, Students |
| R1.6 | Add **syntax-highlighted code snippets** inside approach notes (language-auto-detected or selectable) | SWEs |
| R1.7 | Support **image paste / drag-and-drop** into approach notes (stored as Base64 in `chrome.storage.local`) | Students, Researchers |
| R1.8 | Add a **"Complexity" field** (Time/Space) attached to each card, displayed during review | SWEs, CP |

### 1.3 Review Session UX
| ID | Requirement | Persona |
|----|-------------|---------|
| R1.9 | Show a **progress bar** during review sessions (e.g. "3 of 12 cards reviewed") | All |
| R1.10 | Add **keyboard shortcuts** for rating during review (1 = Again, 2 = Hard, 3 = Good, 4 = Easy) — currently only works in the save view | All |
| R1.11 | Show the **predicted next review date** for each rating choice before the user clicks | SWEs, Students |
| R1.12 | Add an **"Undo Last Rating"** button in case of misclick during rapid reviews | All |

---

## 2. Dashboard & Analytics Enhancements

Extends the popup dashboard ([popup.html](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.html), [stats.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/stats.js), [heatmap.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/heatmap.js)).

### 2.1 Advanced Analytics
| ID | Requirement | Persona |
|----|-------------|---------|
| R2.1 | **Retention curve graph**: Plot predicted retention % over time per card or per tag, derived from FSRS `stability` and `difficulty` values | Students, Researchers |
| R2.2 | **Review forecast**: Calendar-style view showing how many cards are due on each future day (next 30 days) | Students |
| R2.3 | **Tag breakdown pie chart**: Visual split of cards by tag to identify topic gaps | Students, SWEs |
| R2.4 | **Lapse leaderboard**: Surface the cards with the highest `lapses` count as "trouble spots" needing extra attention | All |
| R2.5 | **Daily/weekly/monthly review stats**: Track total reviews completed, average rating, and streak length | All |

### 2.2 Card Management
| ID | Requirement | Persona |
|----|-------------|---------|
| R2.6 | **Search & filter** the card list in the dashboard by title, tag, platform, or state (new/learning/review/relearning) | All |
| R2.7 | **Bulk actions**: Select multiple cards to bulk-delete, bulk-retag, or bulk-reschedule | SWEs |
| R2.8 | **Sort cards** by due date, difficulty, stability, lapse count, or date created | All |
| R2.9 | **Inline card editing** from the dashboard without navigating to the problem page | All |

---

## 3. Study Planning & Goal Setting — *Student-Centric*

### 3.1 Daily Goals & Streaks
| ID | Requirement | Persona |
|----|-------------|---------|
| R3.1 | Set a **daily review target** (e.g. "review 20 cards/day") with a progress ring in the popup | Students |
| R3.2 | Track and display **current streak** and **longest streak** using existing `fsrsActivity` data | Students |
| R3.3 | Celebrate streak milestones with **micro-animations** (confetti, badge unlock) in the popup | Students |

### 3.2 Study Planner
| ID | Requirement | Persona |
|----|-------------|---------|
| R3.4 | **Exam countdown mode**: Enter an exam date; the extension redistributes all due cards to ensure everything is reviewed before the deadline | Students |
| R3.5 | **Study session timer**: Optional Pomodoro-style timer integrated into the review flow (25 min focus / 5 min break) | Students |
| R3.6 | **Weekly summary notification**: Push a digest notification summarising cards reviewed, upcoming load, and streak status | Students |

---

## 4. Software Engineer Power Features

### 4.1 Pattern & Concept Mapping
| ID | Requirement | Persona |
|----|-------------|---------|
| R4.1 | **Concept/pattern linking**: Allow cards to declare dependencies (e.g. "Dijkstra's" depends on "Priority Queue"). Show a dependency graph in the dashboard | SWEs |
| R4.2 | **Auto-tag enrichment**: Detect common patterns from the problem URL/title (e.g. LeetCode problem number → auto-fetch difficulty tier and topic tags from metadata) | SWEs, CP |
| R4.3 | **Similar card suggestions**: When saving a new card, surface existing cards with overlapping tags to reinforce connections | SWEs |

### 4.2 Code-Aware Notes
| ID | Requirement | Persona |
|----|-------------|---------|
| R4.4 | **Multi-language code blocks** in approach notes with selectable language (Python, Java, C++, JS, Go, Rust) and syntax highlighting | SWEs |
| R4.5 | **Diff view**: When editing an approach, show a before/after diff of what changed | SWEs |
| R4.6 | **Template approaches**: Pre-built approach templates for common patterns (sliding window, two pointer, BFS/DFS, DP, etc.) that can be inserted with one click | SWEs, Students |

### 4.3 Developer Workflow Integration
| ID | Requirement | Persona |
|----|-------------|---------|
| R4.7 | **GitHub Gist export**: One-click export of a card's approach + metadata as a GitHub Gist for portfolio/interview prep sharing | SWEs |
| R4.8 | **Keyboard-first workflow**: Global hotkey (configurable) to open the tracker widget without clicking the launcher | SWEs |
| R4.9 | **VS Code companion** (future): Publish a VS Code extension that can push code snippets from the editor into AlgoRecall as new cards | SWEs |

---

## 5. Competitive Programming Features

| ID | Requirement | Persona |
|----|-------------|---------|
| R5.1 | **Contest calendar integration**: Show upcoming contests from Codeforces/LeetCode/AtCoder in the dashboard sidebar | CP |
| R5.2 | **Rating-aware scheduling**: Optionally factor in the problem's difficulty rating (e.g. Codeforces rating, LeetCode difficulty) to weight FSRS parameters via [topicWeights](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.js#L321-L329) | CP |
| R5.3 | **Virtual contest review mode**: After a virtual contest, batch-import all attempted problems as cards in one click | CP |
| R5.4 | **Problem difficulty badge**: Show the difficulty level (Easy/Medium/Hard or Codeforces rating) as a visual badge on each card | CP, SWEs |

---

## 6. Collaboration & Sharing

| ID | Requirement | Persona |
|----|-------------|---------|
| R6.1 | **Deck export as shareable JSON bundle**: Export a filtered set of cards (by tag/platform) as a standalone file that others can import | Students, SWEs |
| R6.2 | **Public deck library** (web page): A curated community page where users can share and download pre-built decks (e.g. "Blind 75", "Neetcode 150", "System Design Patterns") | All |
| R6.3 | **Study group links**: Generate a read-only link of selected cards that opens a temporary web view — no extension install required for viewers | Students |

---

## 7. Highlighter Enhancements

Extends [highlighter.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.js) and [style.css](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/style.css).

| ID | Requirement | Persona |
|----|-------------|---------|
| R7.1 | **Annotation notes on highlights**: Attach a short note to each highlight (displayed as a tooltip on hover) | Students, Researchers |
| R7.2 | **Highlight categories**: Beyond colour, assign semantic categories (Key Insight, Gotcha, Edge Case, Pattern) | SWEs |
| R7.3 | **Highlight → Card auto-link**: Option to automatically link a highlight to the FSRS card for the same page | All |
| R7.4 | **Export highlights** as a formatted summary (Markdown or PDF) for offline reference | Students |
| R7.5 | **Cross-page highlight search**: Search across all saved highlights from the dashboard | All |

---

## 8. Notification & Engagement

Extends [notifications.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/notifications.js) and [background.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.js).

| ID | Requirement | Persona |
|----|-------------|---------|
| R8.1 | **Smart notification scheduling**: Use learning from `fsrsActivity` to notify at the user's most active study times instead of fixed intervals | All |
| R8.2 | **Notification grouping**: "You have 5 Binary Search and 3 DP cards due" instead of a generic count | SWEs, Students |
| R8.3 | **Quiet hours**: Let users set a time range (e.g. 11pm–7am) during which no notifications fire | All |
| R8.4 | **Motivational nudges**: When streak is about to break or daily goal is unmet, send an encouraging push | Students |

---

## 9. Data, Privacy & Portability

Extends the existing JSON import/export in [popup.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.js).

| ID | Requirement | Persona |
|----|-------------|---------|
| R9.1 | **Anki APKG import/export**: Convert cards to/from Anki format for users migrating from Anki | Students, Researchers |
| R9.2 | **CSV export**: Export card data as CSV for analysis in Excel/Google Sheets/Python | SWEs, Researchers |
| R9.3 | **Automatic local backups**: Periodically (configurable) auto-save a backup JSON to `chrome.storage.local` with versioning (keep last N backups) | All |
| R9.4 | **Optional encrypted cloud sync** (opt-in): Sync cards across devices using Google Drive or a self-hosted endpoint, with end-to-end encryption | All |
| R9.5 | **Data wipe & GDPR controls**: One-click "delete all my data" with confirmation, plus data inventory summary | All |

---

## 10. Platform & Accessibility

| ID | Requirement | Persona |
|----|-------------|---------|
| R10.1 | **Firefox & Safari ports**: Extend browser support beyond Chromium using WebExtension polyfills | All |
| R10.2 | **Side panel mode** (Chrome): Offer the dashboard as a [Chrome Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) for persistent, always-visible access alongside coding problems | SWEs |
| R10.3 | **Screen-reader accessibility**: Add ARIA labels, roles, and keyboard focus management to all injected UI elements | All |
| R10.4 | **Reduced-motion mode**: Respect `prefers-reduced-motion` media query for all animations | All |
| R10.5 | **Internationalisation (i18n)**: Externalise all user-facing strings via Chrome's `_locales` system for future translation | All |
| R10.6 | **Responsive popup**: Adapt the popup layout for narrow widths (pinned popup mode) and wide widths (full-tab mode) | All |

---

## 11. Gamification & Motivation

| ID | Requirement | Persona |
|----|-------------|---------|
| R11.1 | **Achievement badges**: Unlock badges for milestones (first card, 100 reviews, 30-day streak, all tags covered, etc.) | Students |
| R11.2 | **XP & levelling system**: Earn XP per review, with level-ups that unlock cosmetic themes for the widget | Students |
| R11.3 | **Habitica integration**: Sync review completions as Habitica tasks (score "To-Dos" or "Dailies") for users who use Habitica for habit tracking | Students |
| R11.4 | **Leaderboard** (opt-in): Anonymous weekly leaderboard showing review counts among opted-in users | Students, CP |

> [!NOTE]
> The user currently has Habitica open in their browser, making R11.3 particularly relevant as a cross-platform motivation bridge.

---

## 12. Extensibility & Plugin Architecture

| ID | Requirement | Persona |
|----|-------------|---------|
| R12.1 | **Plugin API**: Define a lightweight API allowing third-party scripts to register card generators (e.g. a NeetCode importer, a System Design quiz generator) | SWEs |
| R12.2 | **Custom website adapters**: Formalise the whitelisting system in [content.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.js#L5-L16) into a pluggable adapter model, so adding support for a new site requires only a config + title-extractor function | SWEs |
| R12.3 | **Webhook / event hooks**: Emit events (card_created, card_reviewed, streak_broken) that external automation tools (Zapier, n8n) can consume | SWEs |

---

## Priority Matrix

| Priority | Feature Area | Key IDs |
|----------|-------------|---------|
| 🔴 **P0 — Ship Next** | Markdown notes, keyboard shortcuts, filtered reviews, search/filter dashboard | R1.5, R1.10, R1.1, R2.6 |
| 🟠 **P1 — High Impact** | Review forecast, daily goals, streak tracking, highlight annotations, Anki import | R2.2, R3.1, R3.2, R7.1, R9.1 |
| 🟡 **P2 — Differentiators** | Concept graph, code highlighting, exam mode, Side Panel, gamification | R4.1, R4.4, R3.4, R10.2, R11.1–R11.3 |
| 🟢 **P3 — Long-term Vision** | Cloud sync, plugin API, Firefox/Safari, community deck library, Habitica integration | R9.4, R12.1, R10.1, R6.2, R11.3 |

---

## Open Questions

> [!IMPORTANT]
> **Q1**: Should Markdown rendering use a lightweight library (e.g. `marked` or `markdown-it`) bundled into the extension, or a custom minimal parser to avoid the bundle-size cost?

> [!IMPORTANT]
> **Q2**: For gamification (Section 11), should badges/XP be purely cosmetic, or should they unlock functional features (e.g. advanced analytics)?

> [!WARNING]
> **Q3**: Optional cloud sync (R9.4) introduces significant complexity. Should this be deferred until user demand is validated, or prototyped early using Google Drive API?

> **Q4**: The Habitica integration (R11.3) would require the `identity` permission for OAuth. Is the permission-cost acceptable given privacy positioning?

> **Q5**: For the Side Panel (R10.2), should the extension support both popup and side panel simultaneously, or should users choose one mode?

---

*This is a living document. Please review the priority matrix, resolve the open questions, and indicate which sections to begin implementing.*
