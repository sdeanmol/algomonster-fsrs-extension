Here is the updated **Single-File Exhaustive Exception Handling & Logging Prompt**, modified to strictly enforce importing and using `Logger` from `@common/logger`.

---

### 🤖 Single-File Exhaustive Exception Handling & Logging Prompt

Copy and paste this prompt into your AI agent whenever you open a specific file:

> **Prompt (Exhaustive File-Level Exception Handling & Logging with `@common/logger`):**
> "Perform an exhaustive, file-level exception handling and logging audit on **ONLY the currently open/active file**.
> ---
>
>
> ### **1. Core Logger Import Rule**
>
>
> * **Import Requirement**: Ensure `Logger` is imported specifically from `@common/logger`:
> ```typescript
> import { Logger } from '@common/logger';
>
> ```
>
>
> * Instantiate or reference `Logger` (e.g., `Logger.error`, `Logger.info`, `Logger.warn`, `Logger.debug` or `const logger = Logger;`) consistent with `@common/logger` export patterns.
> * Replace all raw `console.log`, `console.error`, `console.warn`, or `console.debug` statements with calls to `Logger`.
> * **Do NOT Delete Existing Logs**: Retain all existing log messages, updating them to use `Logger` where necessary.
>
>
> ---
>
>
> ### **2. Core Preservation Rule**
>
>
> * **Preserve Valid Error Handling**: If a function already has proper error handling (`try/catch`, `.catch()`, or error checks) and uses `Logger`, **LEAVE IT AS IS**.
> * **Exception**: Only modify existing error handling if it hampers logic (e.g., swallowing critical errors that break downstream execution, missing essential resource cleanup in `finally`, or causing unhandled promise rejections).
>
>
> ---
>
>
> ### **3. Function & Execution Audit**
>
>
> * Audit **every function**, exported method, helper, `async/await` block, Promise chain, and event listener in this file.
> * Add exception handling **ONLY where it is missing or logically flawed**.
>
>
> ---
>
>
> ### **4. Exception Handling Rules (For Missing/Flawed Logic)**
>
>
> 1. **Choose the Right Syntax**:
> * Use `try...catch...finally` for synchronous operations, `async/await` functions, and state-mutating routines.
> * Use `.then().catch().finally()` for non-blocking Promise chains or background fire-and-forget calls.
>
>
> 2. **When to Re-Throw vs. Recover**:
> * **Re-throw (`throw err;`)**: If a caller relies on failure signals to abort, rollback, or invalidate operations, **log the error via `Logger` first, then re-throw it**. Do not swallow critical exceptions.
> * **Recover**: If the function performs non-critical operations (e.g., UI rendering, optional analytics, non-essential storage sync), **log the error via `Logger` and return a safe fallback value** (e.g., `null`, `[]`, or default state).
>
>
> 3. **Resource Cleanup (`finally` / `.finally()`)**:
> * Ensure async or state-locking blocks include a `finally` or `.finally()` block to clean up resources, reset processing flags (e.g., `isProcessing = false`), or invoke Chrome `sendResponse` callbacks.
>
>
>
>
> ---
>
>
> ### **5. Logging Format & Safe Error Handling**
>
>
> * **Structured Context**: Pass descriptive messages and metadata objects to every log:
> ```typescript
> Logger.error('[ModuleName] Failed to complete operation', { paramName, err });
>
> ```
>
>
> * **TypeScript Safe Normalization**: Safely normalize caught errors using type guards:
> ```typescript
> const errorMessage = err instanceof Error ? err.message : String(err);
>
> ```
>
>
>
>
> ---
>
>
> ### **6. Comments**
>
>
> * Add explicit inline comments inside every added or updated `catch` and `finally` block explaining **WHY** the error is being re-thrown or recovered, and **WHAT** the `finally` block cleans up.
>
>
> ---
>
>
> ### **7. Verification**
>
>
> * Verify that `npx tsc --noEmit` passes cleanly for this file with zero type errors."
>
>