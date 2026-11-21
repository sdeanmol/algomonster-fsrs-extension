# Technical Domain Glossary

This glossary defines core domain terminology, algorithmic concepts, and browser extension concepts used throughout the AlgoRecall codebase and documentation.

---

## 1. Spaced Repetition & FSRS Terminology

* **FSRS (Free Spaced Repetition Scheduler)**: A modern, mathematically rigorous spaced repetition algorithm developed by the Open Spaced Repetition community. Unlike SM-2, FSRS models human memory using three continuous variables: Stability, Difficulty, and Retrievability.
* **Stability ($S$)**: The duration of time (in days) required for the probability of successful recall to drop from 100% to the target request retention (default: 90%). For example, a card with $S = 14$ has a 90% probability of being recalled after 14 days.
* **Difficulty ($D$)**: The inherent conceptual difficulty of a problem, represented on a continuous scale from 1.0 (easiest) to 10.0 (hardest). Governs how quickly stability expands or contracts on future reviews.
* **Retrievability ($R$)**: The estimated mathematical probability ($0.0 \le R \le 1.0$) that the learner will successfully recall the solution at any point in time $t$ since the last review:
  $$R(t, S) = \left(1 + \text{factor} \times \frac{t}{S}\right)^{\text{decay}}$$
* **Request Retention**: The target probability of successful recall chosen by the user at review time (default: 0.90, or 90%). Higher retention increases review frequency; lower retention expands intervals.
* **Lapse**: A study event where the user fails to recall the solution to a previously graduated card (rating `Again` while in `State.Review`), causing the card to transition into `State.Relearning`.
* **Graduation**: The transition of a card from the initial short-term learning phase (`State.Learning`) into the regular spaced repetition cycle (`State.Review`), occurring when stability exceeds the threshold (`GRADUATED_STABILITY_THRESHOLD = 7` days).
* **Rating**: The user's assessment of their recall quality:
  - `Again` (1): Complete blackout; incorrect recall.
  - `Hard` (2): Recalled with significant hesitation or partial recall.
  - `Good` (3): Correct recall after standard thinking time.
  - `Easy` (4): Perfect recall with zero hesitation.
  - `Manual` (0): Card creation event or unrated state.
* **preState Snapshot**: An embedded copy of a card's exact mathematical metrics saved inside each `ReviewLog` entry prior to applying review mutations. Used for instant, zero-corruption rollbacks when ratings are mis-clicked.
* **Algorithmic Debounce**: A 60-second window during which duplicate review ratings are suppressed and rating corrections automatically revert to the `preState` snapshot without corrupting stability calculations.

---

## 2. Browser Extension & Manifest V3 Terminology

* **Manifest V3 (MV3)**: The current Google Chrome extension platform architecture replacing background pages with ephemeral service workers, enforcing declarative network requests, and tightening Content Security Policies.
* **Service Worker**: An event-driven, background worker script running independently of web pages without DOM access. Automatically terminates when idle (~30 seconds).
* **Isolated World**: A private execution sandbox for content scripts where scripts have access to the webpage DOM, but cannot access JavaScript variables or objects defined by the host page's scripts.
* **CSS Custom Highlights API**: A W3C web standard (`CSS.highlights` and `::highlight()`) allowing extensions to style arbitrary text ranges without injecting `<span class="highlight">` elements into the DOM tree.
* **`chrome.storage.local`**: An asynchronous, local key-value storage engine sandboxed within the browser profile. Provides event-driven reactivity via `chrome.storage.onChanged`.
* **`webNavigation`**: A Chrome extension API that listens to browser navigation events, utilized by AlgoRecall to detect client-side SPA route changes on LeetCode/AlgoMonster.
* **`chrome.commands`**: The browser extension API that binds global keyboard shortcuts (e.g. `Alt+Shift+R`) to extension action handlers.

---

## 3. Data & Storage Terminology

* **NDJSON (Newline Delimited JSON)**: A streaming data format where each line is a valid independent JSON object. Enables streaming decompression and line-by-line parsing without loading multi-megabyte archives into memory.
* **FNV-1a Hasher**: A non-cryptographic, 32-bit Fowler–Noll–Vo hash function utilized by `BackupManager` to compute incremental checksums over serialized backup streams for integrity validation.
* **URL Deduplication**: An archive compression technique where canonical webpage URLs are stored once in `page` records, and referenced by numerical `pageId` across cards, bookmarks, and highlights.
