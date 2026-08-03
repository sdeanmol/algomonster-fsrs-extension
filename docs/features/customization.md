# AlgoRecall — Extension Customization & Developer Guide

Welcome to the **AlgoRecall Developer & Customization Guide**. This document maps the architecture, database storage layout, features, and key code entry points, making it simple to understand, maintain, and customize any capability.

---

## 1. Architectural Overview

AlgoRecall is built on Chrome Manifest V3 (MV3) using a decoupled, modular design pattern:

- **Background Service Worker** ([background/background.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts)): Handles background alarms, global service updates, and schedules check-in push notifications. See [Background Service Worker Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/runtime-core/background-service.md).
- **Content Script Orchestrator** ([content/content.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.ts)): Hooks page loads, detects solved button states on LeetCode/AlgoMonster, and injects widgets. See [Content Scripts Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/runtime-core/content-scripts.md).
- **Review Widget** ([features/tracker/tracker.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts)): Renders the on-page floating spaced-repetition cards, handles active review sessions, and filters tags. See [Tracker & Editor Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/tracker.md).
- **Scheduling Engine** ([features/tracker/scheduler/fsrsScheduler.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsScheduler.ts)): Standard FSRS scheduler implementation. Computes next review intervals based on difficulty and stability parameters. See [FSRS Algorithm Theory](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md).
- **Text Highlighter** ([features/highlighter/highlighter.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.ts)): Handles pointerup selections, inserts HTML range highlights, renders annotation inputs, and binds hover tooltips. See [Highlighter Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/highlighter.md).
- **Popup Dashboard** ([features/dashboard/popup/popup.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.ts)): Renders stats counters, daily review goals donut charts, daily streaks, quick searches, and configuration toggles.
- **Forecast View** ([features/dashboard/forecast/forecast.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/forecast/forecast.ts)): Houses workload bar charts and 30-day forecast calendar grids.
- **History Map** ([features/dashboard/history/history.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/history/history.ts)): Displays year-to-day timeline bar charts and card navigation list indices. See [Dashboard Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/dashboard.md).
- **Data Manager & Backup** ([features/common/data/backupManager.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/data/backupManager.ts)): Imports/exports Gzip-compressed JSONL backups. See [Common Utilities Documentation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/common.md).

---

## 2. Storage Database Schema (`chrome.storage.local`)

All data remains local to the user's browser, respecting the **Privacy First** design philosophy. The storage schema contains the primary keys defined in `StorageData` ([types/domain.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts)):

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
      "elapsedDays": 1,
      "scheduledDays": 2,
      "reps": 3,
      "lapses": 0,
      "state": 2,
      "lastReview": 1720950346000,
      "historyLog": [1720950346000]
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
        "startMeta": { "path": "body/div[1]/p", "offset": 12 },
        "endMeta": { "path": "body/div[1]/p", "offset": 52 }
      }
    }
  ],
  "chromeSettings": {
    "defaultHighlightColor": "#f1c40f",
    "recentColors": ["#f1c40f", "#e74c3c", "#3498db"],
    "showMarkerPopup": true,
    "showCharts": true,
    "activePaletteIndex": 0,
    "palettes": [
      { "name": "Classic", "colors": ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6"] }
    ]
  },
  "dailyGoalTarget": 10,
  "longestStreak": 14,
  "theme": "dark"
}
```

---

## 3. How to Customize Features

### Recipe A: Modifying Highlighter Color Palettes
To add or change color swatches in the text highlighter popup:
1. Open [highlighter.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.ts).
2. Locate `renderTooltipColors()`.
3. Find the fallback palette:
   ```typescript
   const activePalette = ... || { colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] };
   ```
4. Adjust the list of hex codes.
5. In [highlights.css](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/manager/highlights.css) or [style.css](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/style.css), ensure target color rules are defined if they require specialized backgrounds.

---

### Recipe B: Adjusting the FSRS Spaced-Repetition Formula
The FSRS scheduling algorithms are implemented in [fsrsScheduler.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsScheduler.ts).
To customize interval weights:
1. Open [fsrsScheduler.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsScheduler.ts).
2. Locate the default parameter weights in [constants.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/constants.ts):
   ```typescript
   export const DEFAULT_FSRS_W = [0.40255, 1.18385, 3.173, ...];
   ```
3. To alter the speed at which intervals grow or shrink:
   - Adjust `w[2]` (stability multiplier for reviews rated "Good").
   - Adjust `w[4]` (stability decay factor for reviews rated "Again").
4. Or customize FSRS settings directly inside [fsrsConfig.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/config/fsrsConfig.ts) to configure requests via UI.

---

### Recipe C: Registering Support for New Coding Websites
By default, AlgoRecall runs on `leetcode.com`, `algo.monster`, `codeforces.com`, etc. To add another platform:
1. Open [manifest.json](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/manifest.json).
2. Find `"content_scripts"` matches and `"host_permissions"`:
   ```json
   "matches": [
     "*://*.algo.monster/*",
     "*://*.leetcode.com/*",
     "*://*.yournewsite.com/*"
   ]
   ```
3. Update [content.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.ts) & [websites.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/websites/websites.ts) whitelisting definitions.
4. Update the content DOM title scanner inside [utils.ts](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/utils.ts) to scan the platform's header elements and extract problem titles.

---

### Recipe D: Modifying Global CSS Variables & Themes
The entire dashboard uses a shared tokens design system.
1. Open [base.css](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/base.css).
2. Locate the color variables defined in `:root`:
   ```css
   :root {
       --md-primary: #a8c7fa;
       --md-bg: #0f1115;
       --md-surface: #1e2128;
       --md-border: #2f343f;
   }
   ```
3. Edit hex codes under `:root` for dark mode theme, or `:root.light-theme` for light mode configurations. Changes reflect immediately across all tabs.

---

## 🔗 Related Documentation
* 📘 [Architecture Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/overview.md)
* 🎯 [Tracker Feature](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/tracker.md)
* 🖍️ [Highlighter Feature](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/highlighter.md)
* 📖 [FSRS Rating Guide](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/rating-guide.md)
* 📋 [Feature Enhancements Requirements](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/requirements.md)
