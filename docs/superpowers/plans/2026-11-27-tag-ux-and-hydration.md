# Tag UX, Full-Codebase Tag Hydration & Multi-Select Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Make `.tag-count-badge` in Tag Manager open Data Manager filtered to that tag, (2) hydrate `card.tags` UUIDs to display names across every remaining page/worker in the codebase, and (3) upgrade filter dropdowns to a reusable searchable multi-select component (`MultiSelectControl`) with multi-option filtering.

**Architecture:**
1. **Clickable Badge:** Render `.tag-count-badge` in `features/common/tags/tags.ts` as an `<a>` linking to `../data/data.html?tag=<uuid>`. Update `data.ts` to read `?tag=` into its multi-select tag filter.
2. **Global Tag Hydration:** Wire `TagRegistry.hydrate()` (and `tagRegistry` storage loading) into the 5 remaining places that still read raw `card.tags` UUIDs: Popup Quick Search (`search.ts`), Weekly Summary (`summary.ts` + `summaryGenerator.ts`), Analytics (`analytics.ts` + `dataUtils.ts` + `retentionChart.ts` + `performance.ts` + `recoveryTracking.ts`), and Background Notifications (`background.ts`). Preserve backwards-compatible fallback when unit tests pass plain-string mock cards without a `tagRegistry`.
3. **Searchable Multi-Select (`MultiSelectControl`):** Create `features/common/utils/multiSelect.ts` (following the `TagInputControl.attach()` progressive-enhancement pattern) + shared CSS in `features/common/base.css`. Attach it to filter `<select>` elements in Data Manager (`#tag-select`, `#status-select`, `#platform-select`, `#state-select`), Popup Search (`#popup-tag-filter`), Analytics Performance (`#performance-filter-tag`), and Highlights Manager (`#webpage-select`).

**Tech Stack:** TypeScript, Chrome Extension MV3, Webpack, Jest + jsdom, Material Design 3 CSS variables (`--md-*`).

---

## Global Constraints

- Run `npm run build && npm test` after every code change.
- Never allow raw `.ts` files to be copied into `dist/` by `CopyPlugin`.
- Keep Chrome extension APIs typed with `@types/chrome`.
- Preserve existing unit test compatibility where mock cards use plain-string tags without `tagRegistry` (only hydrate when `tagRegistry` is provided / non-empty or via an explicit `hydrateTags` helper).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `features/common/tags/tags.ts` | Render `.tag-count-badge` as `<a href="../data/data.html?tag=...">` |
| Modify | `features/common/tags/tags.css` | Add interactive hover/focus styles for clickable `.tag-count-badge` |
| Modify | `features/dashboard/popup/search.ts` | Load `tagRegistry`, hydrate tags in dropdown, search matching, and result chips; support multi-tag filter |
| Modify | `features/dashboard/summary/summary.ts` | Load `tagRegistry` and pass to `generateSummaryReport` |
| Modify | `features/dashboard/summary/summaryGenerator.ts` | Accept optional `tagRegistry` and hydrate `card.tags` for `topicStats` |
| Modify | `features/dashboard/analytics/analytics.ts` | Load `tagRegistry` and pass to `DataUtils` |
| Modify | `features/dashboard/analytics/utils/dataUtils.ts` | Store optional `tagRegistry`, add `hydrateTags()`, use in `getStatsByTag()` and `getExamReadinessStats()` |
| Modify | `features/dashboard/analytics/memory/retentionChart.ts` | Hydrate `card.tags` via `this.dataUtils.hydrateTags()` for filtering and grouping |
| Modify | `features/dashboard/analytics/performance/performance.ts` | Hydrate tag filter options and wire `MultiSelectControl` on `#performance-filter-tag` |
| Modify | `features/dashboard/analytics/performance/recoveryTracking.ts` | Support `string[]` tag filter in `setTagFilter()` and `render()` |
| Modify | `background/background.ts` | Load `tagRegistry` in due-card notification check and hydrate `c.tags` before formatting notification text |
| **Create** | `features/common/utils/multiSelect.ts` | Reusable `MultiSelectControl` class wrapping `<select>` with search input, checkboxes, Select All/Clear, and `refreshOptions()` |
| Modify | `features/common/base.css` | Styles for `.multi-select-wrapper`, trigger, search input, checkbox listbox, and dark/light theme tokens |
| Modify | `features/common/data/data.ts` | Convert `selectedTag`, `selectedStatus`, `selectedPlatform`, `selectedState` to `string[]`, attach `MultiSelectControl`, support `?tag=` URL pre-selection |
| Modify | `features/highlighter/manager/highlights.ts` | Attach `MultiSelectControl` to `#webpage-select` and filter across multiple selected pages |
| **Create** | `tests/unit/features/common/utils/multiSelect.test.ts` | Unit tests for `MultiSelectControl` (attach, search filter, multi-selection, clear, `refreshOptions`) |
| Modify | `tests/unit/features/common/data/dataDashboard.test.ts` | Update tests for multi-select filtering and `?tag=` URL pre-selection |
| Modify | `tests/unit/features/dashboard/popup/search.test.ts` | Add tests for tag hydration and multi-tag filtering in `QuickSearchComponent` |

---

## Task 1: Clickable `.tag-count-badge` in Tag Manager

**Files:**
- Modify: `features/common/tags/tags.ts`
- Modify: `features/common/tags/tags.css`

- [ ] **Step 1:** In `features/common/tags/tags.ts`, replace `document.createElement('span')` for `badge` with `document.createElement('a')`:
  - `badge.className = 'tag-count-badge';`
  - `badge.href = \`../data/data.html?tag=\${encodeURIComponent(entry.id)}\`;`
  - `badge.title = \`View \${count} card\${count === 1 ? '' : 's'} with tag "\${entry.name}" in Data Manager\`;`
  - `badge.textContent = \`\${count} card\${count === 1 ? '' : 's'}\`;`
- [ ] **Step 2:** In `features/common/tags/tags.css`, add `text-decoration: none; cursor: pointer; transition: background-color 0.15s ease, transform 0.15s ease;` to `.tag-count-badge`, plus `.tag-count-badge:hover` and `.tag-count-badge:focus-visible` styles.
- [ ] **Step 3:** Run `npm run build && npm test`.

---

## Task 2: Fix Tag ID Display Across Popup, Summary, Analytics & Background

**Files:**
- Modify: `features/dashboard/popup/search.ts`
- Modify: `features/dashboard/summary/summary.ts`
- Modify: `features/dashboard/summary/summaryGenerator.ts`
- Modify: `features/dashboard/analytics/analytics.ts`
- Modify: `features/dashboard/analytics/utils/dataUtils.ts`
- Modify: `features/dashboard/analytics/memory/retentionChart.ts`
- Modify: `features/dashboard/analytics/performance/performance.ts`
- Modify: `features/dashboard/analytics/performance/recoveryTracking.ts`
- Modify: `background/background.ts`
- Modify: `tests/unit/features/dashboard/popup/search.test.ts`

- [ ] **Step 1:** Add `tagRegistry` loading & `TagRegistry.hydrate()` in `features/dashboard/popup/search.ts`:
  - Load `['fsrsCards', 'tagRegistry']` in `load()`.
  - Populate `#popup-tag-filter` using `option.value = entry.id`, `option.textContent = entry.name` (sorted by name) when `tagRegistry` is non-empty, or fallback to unique `card.tags` strings if `tagRegistry` is empty.
  - Hydrate `card.tags` in `renderQuickSearch()` for both `tagMatch` search and `tagsHtml` badge rendering.
- [ ] **Step 2:** Update `features/dashboard/summary/summary.ts` and `summaryGenerator.ts`:
  - `summary.ts` loads `tagRegistry` from `chrome.storage.local` and passes it as an optional parameter to `generateSummaryReport(..., tagRegistry)`.
  - `summaryGenerator.ts` hydrates `card.tags` when `tagRegistry && tagRegistry.length > 0` before incrementing `stats.topicStats[tag]`.
- [ ] **Step 3:** Update Analytics (`analytics.ts`, `dataUtils.ts`, `retentionChart.ts`, `performance.ts`, `recoveryTracking.ts`):
  - `analytics.ts` loads `['fsrsCards', 'tagRegistry', 'fsrsActivity']` and passes `tagRegistry` to `new DataUtils(cards, activity, scheduler, tagRegistry)`.
  - `DataUtils` stores `this.tagRegistry = tagRegistry` and exposes `hydrateTags(tagIds?: string[]): string[]` (returns `TagRegistry.hydrate(tagIds, this.tagRegistry)` if `this.tagRegistry?.length`, else `tagIds || []`).
  - `getStatsByTag()` and `getExamReadinessStats()` in `dataUtils.ts` call `this.hydrateTags(card.tags)` instead of raw `card.tags`.
  - `retentionChart.ts` calls `this.dataUtils.hydrateTags(card.tags)` for both `filterTag` matching and `groupBy === 'tag'`.
  - `performance.ts` populates `#performance-filter-tag` with `{ value: entry.id, textContent: entry.name }` from `this.dataUtils.tagRegistry` (or hydrated tags).
- [ ] **Step 4:** Update `background/background.ts` due-card notification grouping (~L732):
  - Include `'tagRegistry'` in the `chrome.storage.local.get` call and hydrate `c.tags` via `TagRegistry.hydrate(c.tags, tagRegistry)` before building `tagCounts`.
- [ ] **Step 5:** Add/update unit tests in `tests/unit/features/dashboard/popup/search.test.ts` and run `npm run build && npm test`.

---

## Task 3: Create Reusable `MultiSelectControl` Component

**Files:**
- Create: `features/common/utils/multiSelect.ts`
- Modify: `features/common/base.css`
- Create: `tests/unit/features/common/utils/multiSelect.test.ts`

**Interfaces — Produces:**
```ts
export interface MultiSelectOptions {
    placeholder?: string;
    searchPlaceholder?: string;
    allValue?: string; // default 'all'
    onChange?: (selectedValues: string[]) => void;
}

export class MultiSelectControl {
    static attach(targetSelect: HTMLSelectElement, options?: MultiSelectOptions): MultiSelectControl;
    getSelectedValues(): string[];
    setSelectedValues(values: string[], triggerChange?: boolean): void;
    clear(triggerChange?: boolean): void;
    refreshOptions(): void;
}
```

- [ ] **Step 1:** Write failing unit tests in `tests/unit/features/common/utils/multiSelect.test.ts` covering:
  - Attaching to a `<select>` hides the native select and renders `.multi-select-wrapper`.
  - Clicking trigger opens dropdown; typing in `.multi-select-search` filters visible checkboxes case-insensitively.
  - Checking multiple options updates `getSelectedValues()`, updates trigger label (`"2 selected"` or `"Tag A"` for 1), and fires `onChange`.
  - Clicking "Clear" resets selection to `[]` and fires `onChange([])`.
  - `refreshOptions()` rebuilds checkboxes when `<select>` options are dynamically repopulated, preserving still-valid selections.
- [ ] **Step 2:** Implement `MultiSelectControl` in `features/common/utils/multiSelect.ts` and add styles in `features/common/base.css` using `--md-surface`, `--md-bg`, `--md-border`, `--md-primary`, `--md-text-high`, `--md-text-medium`.
- [ ] **Step 3:** Run `npx jest tests/unit/features/common/utils/multiSelect.test.ts` and `npm run build`.

---

## Task 4: Wire `MultiSelectControl` to All Filter Dropdowns

**Files:**
- Modify: `features/common/data/data.ts`
- Modify: `features/dashboard/popup/search.ts`
- Modify: `features/dashboard/analytics/performance/performance.ts`
- Modify: `features/dashboard/analytics/performance/recoveryTracking.ts`
- Modify: `features/highlighter/manager/highlights.ts`
- Modify: `tests/unit/features/common/data/dataDashboard.test.ts`

- [ ] **Step 1:** In `features/common/data/data.ts`:
  - Change `selectedTag`, `selectedStatus`, `selectedPlatform`, `selectedState` from `string` to `string[]` (default `[]`).
  - Attach `MultiSelectControl` to `#tag-select`, `#status-select`, `#platform-select`, `#state-select`.
  - Call `refreshOptions()` after `populateTagsFilter()` and `populatePlatformFilter()`.
  - Parse URL `?tag=` (single or comma-separated) into `this.selectedTags` and call `tagMultiSelect.setSelectedValues(this.selectedTags)`.
  - Update `filterAndRender()` to match `selectedTags.length === 0 || card.tags.some(t => selectedTags.includes(t))` (and similarly for `selectedStatuses`, `selectedPlatforms`, `selectedStates`).
  - Update `clearFilters()` to clear all 4 `MultiSelectControl` instances.
- [ ] **Step 2:** In `features/dashboard/popup/search.ts`:
  - Attach `MultiSelectControl` to `#popup-tag-filter`, call `refreshOptions()` in `load()`, and filter `card.tags` against `selectedTags`.
- [ ] **Step 3:** In `features/dashboard/analytics/performance/performance.ts` & `recoveryTracking.ts`:
  - Attach `MultiSelectControl` to `#performance-filter-tag` and update `RecoveryTracking.setTagFilter(tags: string[])` to filter across selected tag IDs.
- [ ] **Step 4:** In `features/highlighter/manager/highlights.ts`:
  - Attach `MultiSelectControl` to `#webpage-select` and filter highlights across multiple selected URLs.
- [ ] **Step 5:** Update `tests/unit/features/common/data/dataDashboard.test.ts` and run full `npm run build && npm test`.
