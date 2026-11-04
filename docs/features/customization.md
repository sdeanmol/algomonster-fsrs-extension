# AlgoRecall — Extension Customization & Developer Guide

Welcome to the **AlgoRecall Developer & Customization Guide**. This document maps the architecture, storage database schema, Preact component entry points, and practical developer recipes, making it simple to understand, maintain, and customize any capability.

---

## 1. Architectural Overview & Key Entry Points

AlgoRecall is built on Manifest V3 using **Preact 11** and **TypeScript 5**:

- **Background Service Worker** ([`background/background.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts)): Handles background alarms, global service updates, Pomodoro ticking, and schedules push notifications. See [Background Service Worker Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/runtime-core/background-service.md).
- **Content Script Orchestrator** ([`content/content.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.ts)): Hooks page loads, detects solved button states on LeetCode/AlgoMonster, and injects widgets. See [Content Scripts Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/runtime-core/content-scripts.md).
- **Review Widget** ([`features/tracker/tracker.tsx`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.tsx)): Renders the on-page floating spaced-repetition card, rating bar (`TrackerRatingBar`), and topic tags. See [Tracker & Editor Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/tracker.md).
- **Scheduling Engine** ([`features/tracker/scheduler/fsrsScheduler.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsScheduler.ts)): Standard FSRS scheduler implementation. Computes next review intervals based on difficulty and stability parameters. See [FSRS Algorithm Theory](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md).
- **Text Highlighter** ([`features/highlighter/highlighter.tsx`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.tsx)): Handles pointerup selections, inserts CSS Custom Highlights, renders Preact tooltip (`HighlighterTooltipView`), and saves annotations. See [Highlighter Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/highlighter.md).
- **Popup Dashboard** ([`features/dashboard/popup/popup.tsx`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.tsx)): Preact SPA rendering stats counters, daily goal SVG ring, quick search, and configuration toggles.
- **Forecast View** ([`features/dashboard/forecast/forecast.tsx`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/forecast/forecast.tsx)): Workload bar charts and 30-day forecast calendar grids.
- **History View** ([`features/dashboard/history/history.tsx`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/history/history.tsx)): Displays timeline bar charts and card navigation drill-down views. See [Dashboard Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/dashboard.md).
- **Data Manager & Backup** ([`features/common/data/backupManager.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/data/backupManager.ts)): Imports/exports Gzip-compressed JSONL backups. See [Common Utilities Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/common.md).

---

## 2. Storage Database Schema (`chrome.storage.local`)

All data remains local to the user's browser, respecting the **Privacy First** design philosophy. The storage schema contains the primary keys defined in `StorageData` ([`types/domain.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts)):

```json
{
  "fsrsCards": [
    {
      "id": "card_1720950346000",
      "problemTitle": "Two Sum",
      "problemUrl": "https://leetcode.com/problems/two-sum/",
      "approach": "**Use a Hash Map** to store complements...",
      "tags": ["Hash Map", "Arrays"],
      "due": 1720990346000,
      "stability": 2.4,
      "difficulty": 4.1,
      "elapsed_days": 1,
      "scheduled_days": 2,
      "reps": 3,
      "lapses": 0,
      "state": 2,
      "last_review": 1720950346000,
      "historyLog": [
        {
          "rating": 3,
          "duration": 45000,
          "review": 1720950346000,
          "preState": { "stability": 1.2, "difficulty": 4.5, "state": 1 }
        }
      ]
    }
  ],
  "fsrsActivity": {
    "2026-07-14": 15,
    "2026-07-13": 8
  },
  "marks": [
    {
      "id": "mark_1720950348000_abcde",
      "createdAt": 1720950348000,
      "url": "https://leetcode.com/problems/two-sum/",
      "text": "return new int[]{map.get(complement), i};",
      "color": "#f1c40f",
      "note": "Java return statement template snippet",
      "highlightSource": {
        "startMeta": { "parentTagName": "p", "parentIndex": 1, "textOffset": 12, "parentDomPath": [0, 1] },
        "endMeta": { "parentTagName": "p", "parentIndex": 1, "textOffset": 52, "parentDomPath": [0, 1] }
      }
    }
  ],
  "extensionSettings": {
    "defaultHighlightColor": "#f1c40f",
    "recentColors": ["#f1c40f", "#e74c3c", "#3498db"],
    "showMarkerPopup": true,
    "showLauncher": true,
    "activePaletteIndex": 0,
    "palettes": [
      { "name": "Classic", "colors": ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6"] }
    ]
  },
  "theme": "dark"
}
```

---

## 3. How to Customize Features

### Recipe A: Modifying Highlighter Color Palettes
To add or change color swatches in the text highlighter:
1. Open [`features/common/constants.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/constants.ts).
2. Locate `DEFAULT_PALETTES`:
   ```typescript
   export const DEFAULT_PALETTES: Palette[] = [
       { name: 'Classic', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
       { name: 'Neon', colors: ['#ff007f', '#00f0ff', '#39ff14', '#ffe600', '#b026ff'] },
       { name: 'Pastel', colors: ['#ffb3ba', '#bae1ff', '#baffc9', '#ffffba', '#e8baff'] },
       { name: 'Warm', colors: ['#ff7675', '#fab1a0', '#ffeaa7', '#fdcb6e', '#e17055'] },
       { name: 'Cool', colors: ['#74b9ff', '#0984e3', '#81ecec', '#00cec9', '#a29bfe'] }
   ];
   ```
3. Custom palettes can also be created dynamically via the `<HighlightOptionsApp />` settings page (`highlightOptions.html`).

---

### Recipe B: Adjusting the FSRS Spaced-Repetition Formula
The FSRS scheduling algorithms are implemented in [`features/tracker/scheduler/fsrsScheduler.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsScheduler.ts).
To customize interval weights:
1. Open [`features/common/constants.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/constants.ts).
2. Locate the default parameter weights:
   ```typescript
   export const DEFAULT_FSRS_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, ...];
   ```
3. To alter the speed at which intervals grow or shrink:
   - Adjust `w[2]` (stability multiplier for reviews rated "Good").
   - Adjust `w[4]` (stability decay factor for reviews rated "Again").
4. Or customize FSRS settings directly inside [`features/tracker/config/fsrsConfig.tsx`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/config/fsrsConfig.tsx) via the `<FSRSConfigApp />` UI.

---

### Recipe C: Registering Support for New Coding Websites
By default, AlgoRecall runs on `leetcode.com`, `algo.monster`, `codeforces.com`, etc. To add another platform:
1. Update manifest matches in all 3 browser manifests (`browser/chrome/manifest.json`, `browser/firefox/manifest.json`, `browser/safari/manifest.json`).
2. Add the platform domain to `DEFAULT_WHITELISTED_WEBSITES` in [`features/common/constants.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/constants.ts).
3. Update the content DOM title scanner inside [`content/utils.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/utils.ts) to scan the platform's header elements and extract problem titles.
4. Platforms can also be added dynamically via the `<WebsitesApp />` settings page (`websites.html`).

---

### Recipe D: Modifying Global CSS Variables & Themes
The entire dashboard uses Material Design 3 tokens.
1. Open [`features/common/base.css`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/base.css).
2. Locate the color variables defined in `:root`:
   ```css
   :root {
       --md-primary: #a8c7fa;
       --md-bg: #0e0e11;
       --md-surface: #17181c;
       --md-border: #2d2f39;
   }
   ```
3. Edit hex codes under `:root` for dark theme, or `:root.light-theme` for light theme. Changes reflect immediately across all tabs and components.

---

## 🔗 Related Documentation
* 📘 [Architecture Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/overview.md)
* 🎯 [Tracker Feature](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/tracker.md)
* 🖍️ [Highlighter Feature](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/highlighter.md)
* 📖 [FSRS Rating Guide](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/rating-guide.md)
* 📋 [Feature Enhancements Requirements](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/requirements.md)
