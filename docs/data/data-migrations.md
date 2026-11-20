# Data Migrations & Schema Evolution

## 1. Overview & Backward Compatibility Principles

As an extension with an active user base, AlgoRecall must ensure that existing user data is **never corrupted or lost** during updates. The data layer implements defensive schema migration routines that run automatically on startup or during backup import.

---

## 2. In-Memory Card Schema Migrations (`cardUtils.ts`)

Early iterations of the extension stored problem cards without explicit unique `id` fields or with legacy property names (e.g. `elapsedDays` instead of `elapsed_days`).

### The `ensureCardIds()` Routine
Whenever cards are read from storage in [`features/common/utils/cardUtils.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/utils/cardUtils.ts), they pass through `ensureCardIds()`:

```typescript
export function ensureCardIds(cards: Card[]): Card[] {
    if (!Array.isArray(cards)) return [];
    return cards.map((card, index) => {
        if (!card.id) {
            // Generate deterministic ID from URL slug or title hash
            card.id = generateCardId(card.problemUrl || card.problemTitle || String(index));
        }
        // Normalize camelCase legacy fields to snake_case FSRS fields
        const c = card as unknown as Record<string, unknown>;
        if (c.elapsedDays !== undefined && card.elapsed_days === undefined) {
            card.elapsed_days = Number(c.elapsedDays);
        }
        if (c.scheduledDays !== undefined && card.scheduled_days === undefined) {
            card.scheduled_days = Number(c.scheduledDays);
        }
        if (c.learningSteps !== undefined && card.learning_steps === undefined) {
            card.learning_steps = Number(c.learningSteps);
        }
        return card;
    });
}
```

---

## 3. Backup Archive Migration (`backupManager.ts`)

When restoring a backup archive in [`BackupManager.importBackup()`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/data/backupManager.ts), the engine automatically detects the archive format:

```
                            User Uploads Backup File
                                       │
                                       ▼
                         Is Header Record Present?
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
       Yes: Version 2 (NDJSON)                       No: Version 1 (Legacy JSON)
       - Streaming line-by-line parser               - Monolithic JSON object { fsrsCards }
       - Validates discriminated unions              - Runs ensureCardIds() migration
       - Computes 32-bit FNV-1a checksum             - Converts legacy date strings to ms
       - Re-links pageId to canonical URLs           - Ingests cleanly into storage
```

This guarantees that backup archives exported from any version of the extension can be imported seamlessly without manual user intervention.
