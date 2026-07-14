# AlgoRecall — Extension Customization & Developer Guide

Welcome to the **AlgoRecall Developer & Customization Guide**. This document maps the architecture, database storage layout, features, and key code entry points, making it simple to understand, maintain, and customize any capability.

---

## 1. Architectural Overview

AlgoRecall is built on Chrome Manifest V3 (MV3) using a decoupled, modular design pattern:

- **Background Service Worker** (`background/background.js`): Handles background alarms, global service updates, and schedules check-in push notifications.
- **Content Script Loader** (`content/content.js`): Hooks page loads, detects solved button states on LeetCode/AlgoMonster, and injects widgets.
- **Review Widget** (`features/tracker/tracker.js`): Renders the on-page floating spaced-repetition cards, handles active review sessions, filters tags, and plays review audio cues.
- **Scheduling Engine** (`features/tracker/fsrs.js`): Standard FSRS scheduler implementation. Computes next review intervals based on difficulty and stability parameters.
- **Text Highlighter** (`features/highlighter/highlighter.js`): Handles pointerup selections, inserts HTML range highlights, renders annotation inputs, and binds hover tooltips.
- **Popup Dashboard** (`features/dashboard/popup/`): Renders stats counters, daily review goals donut charts, daily streaks, quick searches, and configuration toggles.
- **Forecast View** (`features/dashboard/forecast/`): Houses workload bar charts and 30-day forecast calendar grids.
- **History Map** (`features/dashboard/history/`): Displays year-to-day timeline bar charts and card navigation list indices.
- **Data Manager** (`features/common/data/`): Shows the tabular list of saved cards, displays progress rings/top tags, and imports/exports backups or Anki text decks.

---

## 2. Storage Database Schema (`chrome.storage.local`)

All data remains local to the user's browser, respecting the **Privacy First** design philosophy. The storage schema contains the following primary keys:

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
1. Open [highlighter.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.js).
2. Locate `renderTooltipColors()` (around line 115).
3. Find the fallback palette:
   ```javascript
   const activePalette = ... || { colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] };
   ```
4. Adjust the list of hex codes.
5. In [highlights.css](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/manager/highlights.css) or [style.css](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/style.css), ensure target color rules are defined if they require specialized backgrounds.

---

### Recipe B: Adjusting the FSRS Spaced-Repetition Formula
The FSRS scheduling algorithms are fully implemented in [fsrs.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/fsrs.js).
To customize interval weights:
1. Open [fsrs.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/fsrs.js).
2. Locate the default parameter weights:
   ```javascript
   const DEFAULT_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.26, 2.05];
   ```
3. To alter the speed at which intervals grow or shrink:
   - Adjust `DEFAULT_W[2]` (stability multiplier for reviews rated "Good").
   - Adjust `DEFAULT_W[4]` (stability decay factor for reviews rated "Again").
4. Or customize FSRS settings directly inside [fsrsConfig.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/config/fsrsConfig.js) to configure requests via UI.

---

### Recipe C: Registering Support for New Coding Websites
By default, AlgoRecall runs on `leetcode.com`, `algomonster.com` (and `.cn` / `problems/` subdomains). To add another platform:
1. Open [manifest.json](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/manifest.json).
2. Find `"content_scripts"` matches:
   ```json
   "matches": [
     "https://leetcode.com/*",
     "https://leetcode.cn/*",
     "https://algo.monster/*"
   ]
   ```
3. Append your new platform's glob pattern (e.g. `"https://binarysearch.com/*"`).
4. Update the content DOM title scanner inside [utils.js](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/utils.js) to scan the platform's header elements and extract the problem titles.

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
3. Edit the hex codes under `:root` for dark mode theme, or `:root.light-theme` for light mode configurations. Changes reflect immediately across all tabs.
