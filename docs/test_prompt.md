Here is a reusable, targeted prompt template designed for your AI coding agent. You can easily edit the list of target files in the `[TARGET FILES]` section whenever you want to run it for specific modules.

---

```markdown
# Instructions for AI Agent: Targeted Unit Test Suite Generation (>90% Coverage)

## Objective
Generate complete, modular, and robust unit tests specifically for the files listed below. The output test suite must achieve **over 90% code coverage across all metrics**:
- **Statements:** >90%
- **Branches:** >90%
- **Functions:** >90%
- **Lines:** >90%

---

## 🎯 Target Files to Test
<!-- Edit this list whenever you run the prompt for different files -->
- `path/to/file1.ts`
- `path/to/file2.ts`
- `path/to/file3.ts`

---

## Technical Rules & Execution Guidelines

### 1. No Code Alteration (Preserve Production Logic)
Do **NOT** alter production code simply to make tests pass or to simplify test setups. 
* **Exception:** If a test catches a genuine software defect (e.g., unhandled `null`/`undefined`, invalid boundary condition, uncaught promise rejection), document the flaw, apply the minimal fix to the target file, and write a test confirming the fix.

### 2. Full Mocking & Isolation
* Standardize on standard Jest unit tests (`describe`, `it`/`test`, `beforeEach`, `afterEach`).
* Stub and mock all external dependencies, side effects, filesystem operations, and Chrome Extension APIs (`chrome.storage`, `chrome.runtime`, `chrome.tabs`).
* Ensure test isolation so no state leaks between individual tests.

### 3. Exhaustive Branch & Cyclomatic Coverage
To exceed the 90% branch threshold, you must explicitly test:
* **All Conditional Paths:** Every `if`, `else`, ternary operator (`? :`), and `switch` case (including `default`).
* **Error & Exception Paths:** Every `try/catch` block, thrown error, rejected promise, and fallback flow.
* **Boundary & Edge Cases:** `null`, `undefined`, empty string `""`, empty array `[]`, `NaN`, zero `0`, negative numbers, extreme values, and corrupted data payloads.

---

## Required Deliverables

1. **Complete Test File(s):** Provide fully runnable unit tests containing all necessary imports, mocks, and setup steps.
2. **Coverage Verification Plan:** Briefly highlight which complex branches, edge cases, or exception handlers were specifically targeted to guarantee >90% coverage.

```