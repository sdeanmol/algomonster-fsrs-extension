# Tag Registry (Solution C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat `card.tags: string[]` with a UUID-keyed tag registry (`tagRegistry`) so that renaming one tag in a new Tag Manager page instantly propagates to every card, and migrate the **one test backup file** to the new schema.

**Architecture:** A new `tagRegistry` key in `chrome.storage.local` stores `TagEntry[]` (each with a stable `id` UUID and a mutable `name`). Each card's `tags` field becomes `string[]` of those UUIDs. A new standalone page `features/common/tags/tags.html` / `tags.ts` lists all tags and allows inline renaming; a button in `data.html` links to it. The backup system is extended to export/import the `tagRegistry` as a new NDJSON record type `"tagregistry"`. Since the extension has **not been released publicly**, no backward-compatibility migration layer is needed in the import path — only the single test backup file needs a one-time offline migration.

**Tech Stack:** TypeScript, Chrome Extension MV3 (`chrome.storage.local`), Webpack (CopyPlugin handles HTML/CSS; `.ts` files compile via webpack entry), vanilla DOM, existing project patterns (`@CatchAndLog`, `withErrorHandling`, `Logger`).

---

## Global Constraints

- Never copy raw `.ts` files to `dist/` via CopyPlugin — all new `.ts` files must be webpack entry points.
- Run `npm run build && npm test` after every task.
- Chrome API calls must be typed with `@types/chrome`.
- Follow existing module patterns: class-based controllers, `@CatchAndLog` decorators, `Logger.*` for logging.
- Tag UUIDs: use `crypto.randomUUID()` (available in MV3 service workers and extension pages).
- Tag names: trim whitespace, reject empty strings.
- **No legacy migration in runtime code** — the extension is pre-release; all data is assumed to be in the new format after the one-time backup migration in Task 7. The import path does not need a string-tag fallback.

---

## Review Focus

- **Registry/card desync** — a UUID in `card.tags` that is absent from `tagRegistry` must render as `"(deleted)"` without crashing; this guards against manual storage edits only.
- **Rename to existing name** — renaming tag A to the same name as tag B should show an inline error "A tag with that name already exists. Merge?" and optionally call `TagRegistry.merge`.
- **Concurrent saves** — `saveCards()` and `saveTagRegistry()` are separate writes; a failed registry write must not corrupt card data (and vice versa).
- **Empty `tagRegistry` on first install** — a brand-new install with no data has an empty registry; creating the first tag must work.
- **Autocomplete accuracy** — `getDatabaseTags()` must return display names (from registry), not raw UUIDs, for the tag chip input.
- **Anki export fidelity & error handling** — Anki export hydrates UUIDs to tag names, outputs clickable HTML links, HTML-escapes approach content, and surfaces export errors; the Anki import feature is completely removed from UI, logic, and help docs.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `types/domain.ts` | Add `TagEntry`, extend `StorageData.tagRegistry` |
| Modify | `types/backup.ts` | Add `TagRegistryRecord`, extend `BackupRecordType` union |
| Modify | `features/common/constants.ts` | Add `'tagregistry'` to `VALID_BACKUP_RECORD_TYPES` |
| **Create** | `features/common/tags/tagRegistry.ts` | `TagRegistry` service (CRUD, resolve/hydrate) |
| **Create** | `features/common/tags/tags.ts` | `TagManagerPage` controller (UI, rename, delete, merge) — webpack entry |
| **Create** | `features/common/tags/tags.html` | Tag manager standalone page |
| **Create** | `features/common/tags/tags.css` | Tag manager styles |
| Modify | `webpack.config.js` | Add `tags` entry point |
| Modify | `features/common/constants.ts` | Add `'open-tags-manager'` to `ACTION_URL_MAP` |
| Modify | `features/tracker/tracker.ts` | Use `TagRegistry.getOrCreate()` on save, `hydrate()` on display |
| Modify | `features/common/data/data.ts` | Same as tracker; expose registry-based tag helpers |
| Modify | `features/common/data/data.html` | Add "Manage Tags" button in `header-actions` |
| Modify | `features/common/data/backupManager.ts` | Export/import `tagRegistry` as `"tagregistry"` record |
| Modify | `features/common/services/actionService.ts` | Fix `formatCardsForAnki` to hydrate UUIDs → names, `#html:true`, clickable links; fix `exportAnki` to load registry and surface errors |
| Modify | `features/common/settings/settings.html` | Remove the "Import from Anki (TSV / TXT)" block (`#settings-anki-import-label`, `#settings-anki-import-file`) and update section description to Export-only |
| Modify | `features/common/settings/settings.ts` | Remove `ankiImportFile` / `ankiImportLabel` DOM refs and event listeners; keep Anki export error surfacing |
| Modify | `features/common/help/help.html` | Remove "From Anki (.txt / .tsv Import)" documentation and update Anki section to Export-only |
| Modify | `tests/unit/background/commands.test.ts` | Update `formatCardsForAnki` test to pass registry and cover HTML/error cases |
| Modify | `tests/unit/features/common/settings/settings.test.ts` | Remove `ankiImportFile` / `ankiImportLabel` from test DOM fixture and add Anki export error reporting test |
| **Create** | `scripts/migrate-backup.mjs` | One-time Node.js CLI for migrating the test backup file only |
| **Create** | `tests/unit/features/common/tags/tagRegistry.test.ts` | Unit tests for `TagRegistry` service |

---

## Task 1: Type Definitions

**Files:**
- Modify: `types/domain.ts`
- Modify: `types/backup.ts`
- Modify: `features/common/constants.ts`

**Interfaces — Produces:**
```ts
// types/domain.ts
export interface TagEntry {
    id: string;       // crypto.randomUUID() — never changes after creation
    name: string;     // mutable display name
}
// StorageData gains:
tagRegistry?: TagEntry[];
```

```ts
// types/backup.ts
export interface TagRegistryRecord {
    type: 'tagregistry';
    data: TagEntry[];   // full registry array
}
// BackupRecordType union gains 'tagregistry'
// CardRecordData.tags remains string[] (now UUIDs in new format)
```

- [ ] **Step 1:** Add `TagEntry` interface and `tagRegistry?: TagEntry[]` to `StorageData` in `types/domain.ts`.
- [ ] **Step 2:** Add `TagRegistryRecord` interface to `types/backup.ts`; add `'tagregistry'` to `BackupRecordType` union.
- [ ] **Step 3:** Add `'tagregistry'` to `VALID_BACKUP_RECORD_TYPES` set in `features/common/constants.ts`.
- [ ] **Step 4:** Run `npm run build` — expected: compiles with no new type errors.

---

## Task 2: `TagRegistry` Service

**Files:**
- Create: `features/common/tags/tagRegistry.ts`
- Create: `tests/unit/features/common/tags/tagRegistry.test.ts`

**Interfaces — Consumes:** `TagEntry` from `types/domain.ts`, `chrome.storage.local`

**Interfaces — Produces:**
```ts
export class TagRegistry {
    /** Load registry array from chrome.storage.local under key 'tagRegistry'. */
    static async load(): Promise<TagEntry[]>

    /** Persist registry array to chrome.storage.local. */
    static async save(registry: TagEntry[]): Promise<void>

    /**
     * Resolve UUIDs to display names.
     * Unknown UUIDs → "(deleted)". Always safe to call.
     */
    static hydrate(ids: string[], registry: TagEntry[]): string[]

    /**
     * Find existing entry by name (case-insensitive trim) or create a new one.
     * Mutates registry in place and calls save(). Returns the entry id.
     */
    static async getOrCreate(name: string, registry: TagEntry[]): Promise<string>

    /**
     * Rename an entry by id. Returns false if newName already exists (caller shows merge prompt).
     * On success mutates registry in place and calls save(). Returns true.
     */
    static async rename(id: string, newName: string, registry: TagEntry[]): Promise<boolean>

    /**
     * Delete entry by id. Caller is responsible for updating cards.
     * Mutates registry in place and calls save().
     * Returns the ids of cards that referenced the deleted tag (for caller to update).
     */
    static async delete(id: string, registry: TagEntry[], cards: Card[]): Promise<string[]>

    /**
     * Merge srcId into dstId: replace all srcId references in cards.tags with dstId,
     * save cards, delete srcId entry from registry, save registry.
     */
    static async merge(srcId: string, dstId: string, registry: TagEntry[], cards: Card[]): Promise<void>
}
```

- [ ] **Step 1:** Write failing tests in `tests/unit/features/common/tags/tagRegistry.test.ts` covering:
  - `hydrate` returns names for known UUIDs and `"(deleted)"` for unknown UUIDs.
  - `getOrCreate` returns the same `id` on second call with the same name (case-insensitive).
  - `getOrCreate` creates a new entry when name is new; registry length increases by 1.
  - `rename` returns `true` and mutates name in place when new name is unique.
  - `rename` returns `false` when `newName` already exists in registry (no mutation).
  - `delete` removes entry from registry; returned card-id list matches cards that had the tag.
  - `merge` replaces all srcId references in cards with dstId; srcId absent from registry after merge.
- [ ] **Step 2:** Run `npm test -- --testPathPattern=tagRegistry` — expected: FAIL (file not found).
- [ ] **Step 3:** Implement `TagRegistry` class in `features/common/tags/tagRegistry.ts`.
  - UUID detection is not needed (pre-release; all tags go through `getOrCreate`).
  - Name lookup: `registry.find(e => e.name.trim().toLowerCase() === name.trim().toLowerCase())`.
  - `crypto.randomUUID()` for new entries.
  - Storage key: `'tagRegistry'`.
- [ ] **Step 4:** Run `npm test -- --testPathPattern=tagRegistry` — expected: PASS.
- [ ] **Step 5:** Run `npm run build` — expected: clean build.

---

## Task 3: Tag Manager Page

**Files:**
- Create: `features/common/tags/tags.html`
- Create: `features/common/tags/tags.css`
- Create: `features/common/tags/tags.ts` (webpack entry)
- Modify: `webpack.config.js` (add entry `tags: './features/common/tags/tags.ts'`)
- Modify: `features/common/constants.ts` (add to `ACTION_URL_MAP`)

**Interfaces — Consumes:** `TagRegistry.*`, `chrome.storage.local` (`tagRegistry`, `fsrsCards`)

**Page behaviour:**
- On `DOMContentLoaded`: load `tagRegistry` and `fsrsCards` from storage; compute per-tag card counts; render tag list sorted by name.
- **Tag row:** tag name displayed in an inline `<input>`, card count badge (e.g. `15 cards`), **Rename** button, **Delete** button.
- **Rename flow:** user edits the input and clicks Rename (or presses Enter) → call `TagRegistry.rename(id, newName, registry)`.
  - If `true`: re-render row with new name; show brief success state.
  - If `false` (duplicate name): show inline error "A tag with this name already exists." with a **Merge** button that calls `TagRegistry.merge(id, existingId, registry, cards)` after confirmation.
- **Delete flow:** confirm dialog "Delete tag «X»? It will be removed from N card(s)." → `TagRegistry.delete` → update affected cards via `chrome.storage.local.set({ fsrsCards })` → re-render.
- **Empty state:** "No tags yet. Tags will appear here after your first review."
- **Header:** back link `← Data Manager` pointing to `../data/data.html`; page title "Tag Manager".

**Interfaces — Produces:** `features/common/tags/tags.html` standalone page

- [ ] **Step 1:** Create `features/common/tags/tags.html` — extend the shared `../base.css` and `../theme-sync.js` pattern; script tag pointing to `tags.js`.
- [ ] **Step 2:** Create `features/common/tags/tags.css` — table/list rows, inline edit inputs, card-count badge (pill style), error/warning inline message, consistent with `data.css` aesthetic using `--md-*` CSS variables.
- [ ] **Step 3:** Create `features/common/tags/tags.ts` — class `TagManagerPage`; wire `DOMContentLoaded → new TagManagerPage().init()`.
- [ ] **Step 4:** Add entry `tags: './features/common/tags/tags.ts'` to `webpack.config.js` `entry` object.
- [ ] **Step 5:** Add `'open-tags-manager': 'features/common/tags/tags.html'` to `ACTION_URL_MAP` in `features/common/constants.ts`.
- [ ] **Step 6:** Run `npm run build` — verify `dist/tags.js` is emitted and no raw `.ts` is in `dist/features/common/tags/`.
- [ ] **Step 7:** Run `npm test` — expected: existing tests pass.

---

## Task 4: Wire Tracker Overlay to Registry

**Files:**
- Modify: `features/tracker/tracker.ts`

**Interfaces — Consumes:** `TagRegistry.load()`, `TagRegistry.getOrCreate()`, `TagRegistry.hydrate()`, `TagEntry` type

**Changes:**
1. Add `tagRegistry: TagEntry[]` to the tracker's in-memory state (alongside `cards`, `scheduler`, etc.).
2. In tracker `init()`: after loading `fsrsCards`, also load `tagRegistry` via `TagRegistry.load()`.
3. `getDatabaseTags()` (line ~1200): return `this.state.tagRegistry.map(e => e.name).sort()`.
4. All 4 tag-save code paths that do `.split(',').map(t => t.trim()).filter(...)` → replace with:
   - Split/trim/filter the input string to get name strings.
   - For each name call `await TagRegistry.getOrCreate(name, this.state.tagRegistry)` to get a UUID.
   - Set `card.tags` to the array of UUIDs.
5. `tagsHtml` display (~line 1261): `TagRegistry.hydrate(card.tags || [], this.state.tagRegistry).join(', ')`.
6. The 4 tag-save paths are: (a) fullscreen-btn existing card, (b) update-btn, (c) rating-button click (existing card), (d) `saveDraft()` for existing card.

> **Note:** `getAutoTags()` returns plain name strings used only as default text pre-filled into the UI input — they still flow through `getOrCreate` at save time. No change needed to `getAutoTags()`.

- [ ] **Step 1:** Import `TagRegistry`, `TagEntry` at top of `tracker.ts`.
- [ ] **Step 2:** Add `tagRegistry: TagEntry[]` field to in-memory tracker state; initialize to `[]`.
- [ ] **Step 3:** In `init()`, after loading `fsrsCards`, call `TagRegistry.load()` and store result.
- [ ] **Step 4:** Update `getDatabaseTags()`.
- [ ] **Step 5:** Refactor the 4 tag-save code paths to use `getOrCreate` (make methods `async` as needed).
- [ ] **Step 6:** Refactor `tagsHtml` to use `hydrate`.
- [ ] **Step 7:** Run `npm run build && npm test` — expected: clean.

---

## Task 5: Wire Data Dashboard to Registry

**Files:**
- Modify: `features/common/data/data.ts`
- Modify: `features/common/data/data.html`

**Interfaces — Consumes:** `TagRegistry.*`, `TagEntry`

**Changes in `data.ts`:**
1. Add `tagRegistry: TagEntry[]` field on `DataDashboard` class; initialized to `[]`.
2. Extend the initial `chrome.storage.local.get` call to include `'tagRegistry'`; store in `this.tagRegistry` via `TagRegistry.load()`.
3. `getDatabaseTags()` (~line 877): return `this.tagRegistry.map(e => e.name).sort()`.
4. `populateTagsFilter()`: use `this.tagRegistry` to generate `<option>` elements where `option.value = entry.id` and `option.text = entry.name`; first option is `value="all" text="All Tags"`. Filter logic compares `card.tags` (UUIDs) against selected `option.value`.
5. `saveCardEdit()`: parse tag input string → `getOrCreate` per name → UUID array on `card.tags`.
6. `bulkRetag()`: same as above.
7. Tag display in table rows (`tagsHtml` ~line 537): `hydrate(card.tags || [], this.tagRegistry)`.
8. `filterAndRender()` tag matching: `this.selectedTag === 'all' || (card.tags && card.tags.includes(this.selectedTag))` — no change needed if dropdown value is a UUID.

**Changes in `data.html`:**
- In `header-actions`, add a new `<a>` tag before the existing Analytics button:
  ```html
  <a href="../../common/tags/tags.html" class="btn btn-secondary" style="margin-right:8px;">
    <svg class="svg-icon" viewBox="0 0 24 24" style="margin-right:6px;" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
      <line x1="7" y1="7" x2="7.01" y2="7"></line>
    </svg>
    Manage Tags
  </a>
  ```

- [ ] **Step 1:** Import `TagRegistry`, `TagEntry`; add `tagRegistry` field to class.
- [ ] **Step 2:** Extend `chrome.storage.local.get` call; load registry.
- [ ] **Step 3:** Refactor `getDatabaseTags`, `populateTagsFilter`, `saveCardEdit`, `bulkRetag`, tag display, and filter matching.
- [ ] **Step 4:** Add "Manage Tags" `<a>` button to `data.html` `header-actions`.
- [ ] **Step 5:** Run `npm run build && npm test` — expected: clean.

---

## Task 5b: Fix Anki Export & Remove Anki Import

**Files:**
- Modify: `features/common/services/actionService.ts`
- Modify: `features/common/settings/settings.html`
- Modify: `features/common/settings/settings.ts`
- Modify: `features/common/help/help.html`
- Modify: `tests/unit/background/commands.test.ts`
- Modify: `tests/unit/features/common/settings/settings.test.ts`

**Context:**
- **Export (`actionService.ts`)** must be updated for `tagRegistry` (hydrate UUIDs → names), switch to `#html:true` with clickable `<a href>` links and HTML-escaped `approach`, and surface storage/download errors.
- **Import (`settings.html`, `settings.ts`, `help.html`, `settings.test.ts`)** is **removed completely** because Anki TSV files lack `problemUrl`, `historyLog`, and native FSRS state, and importing incompatible Anki files risks corrupting live `chrome.storage.local` data.

**Interfaces — Consumes:** `TagRegistry.hydrate()`, `TagEntry`

**Export fix — `formatCardsForAnki` new signature:**
```ts
static formatCardsForAnki(cards: Card[], registry: TagEntry[]): string
// tag line: TagRegistry.hydrate(card.tags || [], registry)
//           .map(name => `algorecall::${name.replace(/\s+/g, '_')}`).join(' ')
```

**Export fix — `exportAnki` loads registry:**
```ts
const result = await chrome.storage.local.get(['fsrsCards', 'tagRegistry']) as StorageData;
const registry: TagEntry[] = result.tagRegistry || [];
ActionService.formatCardsForAnki(cards, registry);
```

- [ ] **Step 1:** Write failing tests in `tests/unit/background/commands.test.ts` and `tests/unit/features/common/settings/settings.test.ts` covering:
  - `formatCardsForAnki(cards, registry)` outputs human-readable names (not UUIDs) in tag column.
  - `formatCardsForAnki(cards, registry)` with a UUID absent from registry outputs `(deleted)` gracefully (no crash).
  - `formatCardsForAnki(cards, registry)` front field contains `<a href="...">` when `problemUrl` is present.
  - `formatCardsForAnki(cards, registry)` HTML-escapes `<` and `>` in the approach field.
  - `exportAnki()` throws a descriptive error when no cards exist or storage/download fails, and `settings.ts` surfaces `result.error` via `showToast(..., true)`.
- [ ] **Step 2:** Run `npm test -- --testPathPattern="commands|settings"` — expected: FAIL (signature mismatch).
- [ ] **Step 3:** Update `formatCardsForAnki` in `features/common/services/actionService.ts` to:
  - Accept `registry: TagEntry[]`.
  - Change header from `#html:false` to `#html:true`.
  - Replace the `[URL: ...]` plain-text pattern in the front field with an HTML link:
    ```ts
    const urlLink = card.problemUrl
        ? `<br><a href="${card.problemUrl}" style="font-size:11px;color:#888;">Open Problem ↗</a>`
        : '';
    const front = `${escapeHtml(card.problemTitle || 'Untitled')}${urlLink}`;
    ```
  - HTML-escape the approach (back field) so code snippets with `<`/`>` render correctly:
    ```ts
    const back = escapeHtml(card.approach || '');
    ```
  - Hydrate tag UUIDs to names, then format as `algorecall::Name_With_Underscores`.
  - Add a private `escapeHtml(s: string): string` helper (replace `&`, `<`, `>`, `"`) in `actionService.ts`.
- [ ] **Step 4:** Update `exportAnki()` in `features/common/services/actionService.ts` to load `tagRegistry` alongside `fsrsCards`, pass it to `formatCardsForAnki`, and wrap storage/download failures with descriptive `Error` messages (so `ActionService.executeAction('export-anki')` returns `{ success: false, error }` and `settings.ts` surfaces it immediately via `showToast(..., true)`).
- [ ] **Step 5:** Remove "Import from Anki" across the codebase:
  - In `features/common/settings/settings.html`: remove the "Import from Anki (TSV / TXT)" `.action-row` block (`#settings-anki-import-label`, `#settings-anki-import-file`) and update the Anki section description to reference exporting only.
  - In `features/common/settings/settings.ts`: remove `ankiImportFile` and `ankiImportLabel` from the `dom` type/lookup and remove their `change` and `keydown` event listeners.
  - In `features/common/help/help.html`: remove the "From Anki (.txt / .tsv Import)" / "Import from Anki" bullets and update "Bi-Directional Anki Integration" copy to "Anki Export (.txt / .tsv)".
  - In `tests/unit/features/common/settings/settings.test.ts`: remove `#settings-anki-import-label` / `#settings-anki-import-file` from the mock DOM fixture.
- [ ] **Step 6:** Run `npm run build && npm test` — expected: clean.

---

## Task 6: Update Backup Export / Import

**Files:**
- Modify: `features/common/data/backupManager.ts`

**Export changes (`generateLines()`):**
- After the `settings` yield, add:
  ```ts
  if (raw.tagRegistry && raw.tagRegistry.length > 0) {
      yield JSON.stringify({ type: "tagregistry", data: raw.tagRegistry });
  }
  ```
- In header `counts`, add `tagregistry: (raw.tagRegistry?.length ?? 0) > 0 ? 1 : 0`.

**Import changes:**
- Declare `let tagRegistry: TagEntry[] = []` alongside existing accumulators (`cards`, `marks`, etc.).
- In the `switch` parse loop add: `case "tagregistry": tagRegistry = parsed.data; break;`
- Include `tagRegistry` in `storageUpdate`: `tagRegistry: tagRegistry`.
- **No fallback migration** — since the extension is pre-release, an import without a `tagregistry` record is simply loaded with an empty registry (new install flow). The user's data will have come from the migrated backup (Task 7) or from fresh use of the new extension version.

- [ ] **Step 1:** Add `tagregistry` case to the import parse loop; add `tagRegistry` to `storageUpdate`.
- [ ] **Step 2:** Add `tagRegistry` yield to `generateLines()`; update header counts.
- [ ] **Step 3:** Run `npm run build && npm test` — expected: clean.

---

## Task 7: Migrate Test Backup File (One-Time)

**Files:**
- Create: `scripts/migrate-backup.mjs` (Node.js ESM — not part of extension build, dev-only)

**Context:** The only file needing migration is the developer's gzip-compressed test backup:
`algo_pro_backup_2026-11-27.json.gz` (54 cards, 41 unique string tags).
The script reads the gzip stream, converts string tags to UUIDs, injects a `tagregistry` record, recomputes the FNV-1a checksum, and writes a new `.gz` file.

**Algorithm:**
1. Gunzip the input file and read all NDJSON lines.
2. Parse each line; collect `card` records and pass through all other records unchanged.
3. Build `tagRegistry: TagEntry[]` by scanning `card.data.tags`:
   - For each unique tag name string, create `{ id: crypto.randomUUID(), name }`.
   - Build a `name → id` lookup map.
4. Rewrite each `card.data.tags` from `string[]` of names to `string[]` of UUIDs.
5. Reconstruct lines in original order. After the last `settings` record (before the footer placeholder), inject: `{ type: "tagregistry", data: tagRegistry }`.
6. Update header `counts` to include `tagregistry: 1`.
7. Stream all lines through the FNV-1a hasher (same constants as the extension: offset `0x811c9dc5`, prime `0x01000193`, 32-bit unsigned), compute new checksum, write footer.
8. Gzip-compress output and write to `<input-basename>_v3.json.gz`.

**FNV-1a constants** match `features/common/constants.ts`: `FNV_OFFSET_BASIS_32 = 0x811c9dc5`, `FNV_PRIME_32 = 0x01000193`.

**Usage:**
```bash
node scripts/migrate-backup.mjs \
  "/path/to/algo_pro_backup_2026-11-27.json.gz" \
  "/path/to/algo_pro_backup_2026-11-27_v3.json.gz"
```

- [ ] **Step 1:** Create `scripts/migrate-backup.mjs`.
- [ ] **Step 2:** Run the script on `algo_pro_backup_2026-11-27.json.gz`:
  ```bash
  node scripts/migrate-backup.mjs \
    "/Users/anmolrastogi/Downloads/AlgoRecall/algo_pro_backup_2026-11-27.json.gz" \
    "/Users/anmolrastogi/Downloads/AlgoRecall/algo_pro_backup_2026-11-27_v3.json.gz"
  ```
- [ ] **Step 3:** Verify output:
  ```bash
  node -e "
  const zlib=require('zlib'),fs=require('fs');
  const buf=fs.readFileSync(process.argv[1]);
  const txt=zlib.gunzipSync(buf).toString('utf8');
  const lines=txt.trim().split('\n').map(l=>JSON.parse(l));
  const header=lines[0]; const footer=lines.at(-1);
  const tagReg=lines.find(r=>r.type==='tagregistry');
  const cards=lines.filter(r=>r.type==='card');
  console.log('header counts:',header.data.counts);
  console.log('footer checksum:',footer.data.checksum);
  console.log('tagregistry entries:',tagReg?.data?.length);
  console.log('sample card tags:',cards[0]?.data?.tags);
  " "/Users/anmolrastogi/Downloads/AlgoRecall/algo_pro_backup_2026-11-27_v3.json.gz"
  ```
  Expected: `tagregistry` with 41 entries; card tags are UUIDs (36-char strings); footer has a valid checksum.
- [ ] **Step 4:** Final check — `npm run build && npm test` — all passing.
