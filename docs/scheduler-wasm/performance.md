# Performance, Benchmarks & Memory Handling

This document provides benchmarks, memory safety guidelines, debouncing performance, and main-thread yielding heuristics across the **AlgoRecall** scheduling and WASM optimization engine.

---

## ⚡ Performance Summary & Benchmarks

| Component | Target Latency | Actual Execution Time | Memory Overhead |
| :--- | :---: | :---: | :---: |
| **`FsrsScheduler.reviewCard`** | $< 5\text{ ms}$ | $\sim 0.8\text{ ms}$ | Minimal ($< 1\text{ KB}$) |
| **`FsrsScheduler.getRetrievability`** | $< 2\text{ ms}$ | $\sim 0.3\text{ ms}$ | Minimal ($< 1\text{ KB}$) |
| **`DataUtils.getSummaryStats` (1000 cards)** | $< 15\text{ ms}$ | $\sim 4.2\text{ ms}$ | $\sim 150\text{ KB}$ |
| **`BackupManager.exportBackup` (1000 cards)** | $< 200\text{ ms}$ | $\sim 65\text{ ms}$ | Streaming ($< 2\text{ MB}$) |
| **`FsrsOptimizer.trainWeights` (WASM)** | $< 5000\text{ ms}$ | $\sim 1200\text{ ms}$ | $\sim 45\text{ MB}$ WASI Heap |
| **`FsrsOptimizerFast.trainWeights` (JS)** | $< 100\text{ ms}$ | $\sim 18\text{ ms}$ | Minimal ($< 50\text{ KB}$) |

---

## 🔒 Memory Safety & Capping Heuristics

1. **WASM Training Set Cap (`OPTIMIZER_MAX_TRAINING_CARDS = 1000`)**:
   Training on unbounded review histories can cause WASM memory allocation failures in browser workers. `FsrsOptimizer` caps training items at 1,000 cards.
2. **Algorithmic Debounce Window (`ALGORITHMIC_DEBOUNCE_WINDOW_MS = 60000`)**:
   Repeated clicks within 60 seconds are debounced to prevent array bloat in `historyLog`.
3. **Stream Chunking**: `readLines` yields text lines without accumulating full uncompressed files into RAM.

---

## 🔗 Related Documentation
* 🧮 [FSRS Algorithm & Math](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md)
* ⚡ [WASM Optimizer Runtime](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/optimizer-wasm.md)
* 🛠️ [Common Utilities & Data](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/common.md)
