# Global Types & Domain Definitions

This document details the central TypeScript type declarations, domain models, storage interfaces, and type definitions across the codebase (`types/domain.ts`, `types/backup.ts`, `types/fsrs.d.ts`, and `types/wasm-runtime.d.ts`).

---

## 🗂️ Core Domain Models (`types/domain.ts`)

### `Card` Entity
Represents a problem flashcard stored in extension storage:

```typescript
export interface FSRSCardState {
    due: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    learning_steps: number;
    reps: number;
    lapses: number;
    state: State;
    last_review?: number | null;
}

export interface Card extends FSRSCardState {
    id: string;
    problemTitle: string;
    problemUrl: string;
    textRead?: string;
    approach?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    tags?: string[];
    historyLog?: ReviewLog[];
    previousDue?: number;
    lastRating?: number;
    [key: string]: unknown;
}
```

### `HighlightMark` & `DOMMeta`
Represents an in-page text annotation:

```typescript
export interface DOMMeta {
    path?: string;
    offset?: number;
    textSnippet?: string;
}

export interface HighlightMark {
    id: string;
    url: string;
    text: string;
    color: string;
    type?: string;
    createdAt: number;
    note?: string;
    category?: string;
    highlightSource?: {
        startMeta?: DOMMeta;
        endMeta?: DOMMeta;
    };
}
```

---

## 📦 Backup Records (`types/backup.ts`)

Defines discriminated union types for Gzip JSONL streaming backup records:

```typescript
export type BackupRecordType = 
    | 'header'
    | 'page'
    | 'card'
    | 'mark'
    | 'bookmark'
    | 'pagecontent'
    | 'activity'
    | 'weights'
    | 'settings'
    | 'footer';

export interface BackupHeaderRecord {
    type: 'header';
    data: {
        version: number;
        timestamp: number;
        counts: { [key: string]: number };
    };
}

export interface FooterRecord {
    type: 'footer';
    data: {
        checksum: string;
        count: number;
    };
}
```

---

## ⚙️ User Settings & Preferences (`types/domain.ts`)

Represents the user's customized runtime preferences:

```typescript
export interface NotificationSettings {
    enabled?: boolean;
    frequency?: string;
    priority?: string;
    requireInteraction?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    badgeEnabled?: boolean;       // Controls whether extension action icon displays due card badge
    showDueBadge?: boolean;
}

export interface ExtensionSettings {
    activePaletteIndex?: number;
    defaultHighlightColor?: string;
    defaultSymbolChar?: string;
    defaultSymbolColor?: string;
    developerMode?: boolean;
    palettes?: Palette[];
    recentColors?: string[];
    showCharts?: boolean;
    showMarkerPopup?: boolean;
    showLauncher?: boolean;       // Controls floating in-page problem tracker launcher visibility
}

export interface UserSettings {
    theme?: string;
    notificationSettings?: NotificationSettings;
    extensionSettings?: ExtensionSettings;
    fsrsGlobalParams?: FSRSParameters | Partial<FSRSParameters> | Record<string, unknown>;
    whitelistedWebsites?: WhitelistedWebsite[];
}
```

> [!NOTE]
> All default values, fallbacks, and action keys for these models are defined centrally in [`features/common/constants.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/constants.ts) (such as `DEFAULT_EXTENSION_SETTINGS`, `DEFAULT_NOTIFICATION_SETTINGS`, and `DEFAULT_FSRS_PARAMETERS`).

---

## 🔗 Related Documentation
* 📐 [Centralized Constants (`constants.ts`)](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/common.md#centralized-domain-constants-constantsts)
* 📦 [State Management](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/state-management.md)
* 🧮 [FSRS Algorithm Theory](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md)
* ⚡ [WASM Optimizer Runtime](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/optimizer-wasm.md)
* 🛠️ [Backup Manager Details](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/common.md)
