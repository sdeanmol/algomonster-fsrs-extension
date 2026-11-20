# AlgoRecall – Decorator Suitability Analysis

**Executive Role**: Principal TypeScript Architect & Code Auditor  
**Date**: 2026-11-20  
**Compiler Standard**: TypeScript 5.4+ (ECMAScript Stage 3 Decorators + Stage 2 Dual-Compatibility)

## 1. Architectural Philosophy & Evaluation Criteria

In modern TypeScript (v5.0+), decorators are standard ECMAScript language constructs. However, error handling decorators must not be applied indiscriminately. Every candidate function was subjected to a 14-point architectural test:

1. **Repetitiveness**: Is the try-catch block identical to multiple other methods in the same class/subsystem?
2. **Cross-Cutting Nature**: Does the error handling policy represent a systemic concern (e.g. logging and safe UI degradation) rather than domain logic?
3. **Class Method vs Function**: Decorators in TypeScript/ECMAScript can only decorate class declarations, class methods, getters, setters, and fields. Standalone functions, arrow functions, and inline callbacks cannot accept decorators.
4. **Context-Specific Recovery**: Does the catch block perform local state rollbacks, trigger specific user dialogues, or initiate alternate retry paths? If so, it **must remain explicit**.
5. **Contract & Return Typing**: Can the decorator preserve synchronous vs asynchronous return types without introducing runtime `Promise<undefined>` pollution into synchronous call sites?
6. **Preservation of `this`**: Does the decorator preserve method receiver binding across arrow-bound and prototype calls?
7. **Preservation of Arguments & Generics**: Are method parameters and generic type variables preserved with complete type inference?
8. **Error Identity**: When rethrowing (`rethrow: true`), does the decorator rethrow the original error object with untouched stack traces?
9. **Chrome Runtime Protocol Compatibility**: Chrome extension messaging listeners (`chrome.runtime.onMessage`) require returning `true` synchronously to keep the `sendResponse` port open. Wrapping them in decorators that intercept promises can break port closure.
10. **Service Worker Lifecycle**: Background service worker event listeners must not leak unhandled rejections that terminate worker processes.
11. **Cognitive Overhead**: Does replacing the try-catch with a decorator make reading the business logic significantly cleaner?
12. **Debugging Transparency**: Can breakpoints and stack traces clearly identify the failing line within the decorated method?
13. **Performance Overhead**: Does descriptor wrapping introduce negligible invocation overhead (<0.01ms)?
14. **Alternative Abstractions**: For callbacks and functional constructs, is a higher-order utility (`withErrorHandling`, `withFallback`) cleaner than forcing pseudo-classes?

---

## 2. Evaluation Results by Subsystem

### 2.1 Dashboard Controllers (`PomodoroTimer`, `FSRSDataDashboard`, `StatsComponent`)
- **Suitability**: **High**
- **Decision**: **Migrated**
- **Rationale**: Methods like `start()`, `pause()`, `reset()`, `updateDisplay()` in `PomodoroTimer` and DOM population methods in `data.ts` contained 10-15 lines of repetitive `UIUtils.catchError` wrapping. Migrating to `@CatchAndLog` and `@CatchAndReturn` eliminated boilerplate while retaining 100% behavior.

### 2.2 Background Service Worker (`background/background.ts`)
- **Suitability**: **Low / Keep Explicit**
- **Decision**: **Retained Explicit**
- **Rationale**: Background messaging dispatches must synchronously return boolean flags (`return true`) to keep the messaging channel open for asynchronous responses. Decorating these handlers risks altering the messaging protocol and breaking Chrome communication channels.

### 2.3 Content Scripts & Injected Listeners (`content/content.ts`)
- **Suitability**: **Low for Decorators / High for `withErrorHandling`**
- **Decision**: **Retained Explicit / Utility Candidate**
- **Rationale**: Content scripts primarily use inline event listeners and mutation observers attached to DOM elements. Decorators cannot be applied to inline functions.

### 2.4 FSRS Algorithm & Optimizer Core (`features/tracker/scheduler/*`)
- **Suitability**: **Medium for `@MeasureTime` / Low for Error Swallowing**
- **Decision**: **Retained Explicit (Instrumented with Timing)**
- **Rationale**: Algorithmic math calculations should never swallow errors. Errors must propagate immediately to prevent mathematical drift or corrupt card interval calculations.

---

## 3. Reusable Abstractions Specification

### Decorators
- `@CatchAndLog(moduleName: string, messageOrOptions?: string | CatchAndLogOptions)`
- `@CatchAndReturn<T>(fallback: T, moduleName?: string, contextMessage?: string)`
- `@MeasureTime(moduleName: string, timerLabel?: string)`

### Companion Functional Utilities
- `withErrorHandling<T>(fn: T, moduleName: string, messageOrOptions?: string | CatchAndLogOptions)`
- `withFallback<T, F>(fn: T, fallback: F, moduleName?: string, contextMessage?: string)`
