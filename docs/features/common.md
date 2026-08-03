# Common Utilities & Shared Infrastructure

This document describes shared utilities and infrastructure services in `features/common/`, including `BackupManager` (Gzip JSONL streaming parser), FNV-1a checksum engine, domain whitelisting, Firebase integration, theme synchronization, and logging.

---

## 📦 Backup & Restore Manager (`backupManager.ts`)

The `BackupManager` provides zero-memory-leak, high-performance data exports and restorations for AlgoRecall.

### Key Capabilities
* **Gzip Compression**: Uses native Web Stream `CompressionStream('gzip')` and `DecompressionStream('gzip')`.
* **Streaming JSON Lines (JSONL)**: Reads and writes data line-by-line using async generators (`readLines`), avoiding large in-memory string concatenations.
* **URL Deduplication**: Replaces repeated problem URLs across cards, marks, bookmarks, and page contents with integer keys (`u: pageId`), reducing file size by up to 70%.
* **FNV-1a Checksum Integrity**: Computes an 8-character hex 32-bit FNV-1a hash across stream lines to verify backup file integrity before DB hydration.
* **Legacy Format Migration**: Auto-detects legacy JSON backup files (`importLegacy`) and seamlessly converts schemas.

```typescript
export class Fnv1aHasher {
    private hash: number = 0x811c9dc5;

    update(str: string): void {
        for (let i = 0; i < str.length; i++) {
            this.hash ^= str.charCodeAt(i);
            this.hash = (this.hash * 0x01000193) >>> 0;
        }
    }

    digest(): string {
        return this.hash.toString(16).padStart(8, '0');
    }
}
```

---

## 🌐 Website Whitelisting & Domain Routing (`websites.ts`)

AlgoRecall enforces domain whitelisting to restrict content script overlays and highlighters exclusively to approved coding platforms.

### Default Whitelisted Domains
1. `algo.monster`
2. `systemdesignschool.io`
3. `leetcode.com`
4. `codeforces.com`
5. `codechef.com`
6. `atcoder.jp`
7. `hackerrank.com`
8. `hackerearth.com`
9. `codewars.com`
10. `codingame.com`

Users can add custom domains via `features/common/websites/websites.html`.

---

## 🎨 Theme Synchronization & Logger (`theme-sync.ts`, `logger.ts`)

* **Theme Sync (`theme-sync.ts`)**: Watches `chrome.storage.local` theme changes and updates `:root` CSS class (`light-theme` vs dark mode) across all active tabs and extension popups.
* **Structured Logger (`logger.ts`)**: Centralized logger providing environment-aware console logging (`Logger.info`, `Logger.debug`, `Logger.error`, `Logger.time`, `Logger.timeEnd`) with context tagging.

---

## 🔗 Related Documentation
* 🔄 [End-to-End Data Flow](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/data-flow.md)
* 📐 [Global Types & Utilities](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/runtime-core/utils-and-types.md)
* 🛠️ [Customization Guide](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/CUSTOMIZATION.md)
