# Security, Permissions & CSP Review

## 1. Security Architecture & Threat Model

Browser extensions operate with elevated privileges compared to regular web applications. AlgoRecall's security architecture focuses on:
1. Preventing Cross-Site Scripting (XSS) from user-entered markdown notes.
2. Isolating extension contexts from third-party host scripts on competitive programming platforms.
3. Restricting extension network access and maintaining local-first data privacy.

---

## 2. Content Security Policy (CSP)

Defined in [`browser/chrome/manifest.json`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/browser/chrome/manifest.json):

```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
}
```

### 2.1 Justification of `'wasm-unsafe-eval'`
- In Manifest V3, `'unsafe-eval'` (evaluating dynamic JavaScript strings) is strictly prohibited.
- AlgoRecall uses **`'wasm-unsafe-eval'`** solely to instantiate WebAssembly modules (`fsrs-binding.wasm32-wasi.wasm`) for personalized FSRS weight training via `WebAssembly.instantiate()`.
- No dynamic JavaScript string evaluation (`eval()`, `new Function()`) exists anywhere in application source code.

### 2.2 Cross-Origin Isolation Headers
For Chrome builds, `manifest.json` specifies:
```json
"cross_origin_embedder_policy": { "value": "require-corp" },
"cross_origin_opener_policy": { "value": "same-origin" }
```
This enables high-resolution performance timers (`performance.now()`) and `SharedArrayBuffer` support where necessary for WebAssembly worker execution.

---

## 3. Content Script Isolation & Sanitization

### 3.1 Host Script Isolation
Content scripts run in **Isolated Worlds**. Even if a malicious script on a third-party webpage attempts to tamper with `window.AlgoRecall` or intercept DOM events, it cannot access extension storage (`chrome.storage`), service worker messaging, or Chrome APIs.

### 3.2 DOMPurify Markdown Sanitization
Users frequently copy/paste problem descriptions, code snippets, and mathematical notes from external websites into problem cards. If rendered naively via `element.innerHTML = marked.parse(input)`, malicious payloads (e.g. `<img src=x onerror=alert(1)>`) could execute scripts inside extension pages.

AlgoRecall prevents XSS by routing **100% of rendered markdown** through [`DOMPurify`](https://github.com/cure53/DOMPurify) in [`features/common/markdown.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/markdown.ts):

```typescript
import DOMPurify from 'dompurify';

export function renderMarkdown(content: string): string {
    const rawHtml = marked.parse(content || '');
    return DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3',
            'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'table',
            'tr', 'td', 'th', 'span', 'hr'
        ],
        ALLOWED_ATTR: ['href', 'target', 'class', 'style']
    });
}
```
All script tags, iframe embeds, object tags, and inline event handlers (`onerror`, `onclick`) are stripped before insertion into the DOM.

---

## 4. Permissions Justifications Matrix

| Permission | Manifest Level | Architectural Justification |
|---|---|---|
| `storage` | Required | Local persistence of flashcard problems, review logs, highlight marks, and settings in `chrome.storage.local`. |
| `activeTab` & `tabs` | Required | Detect active problem URLs on supported platforms and query active tabs to route in-page notifications. |
| `webNavigation` | Required | Listen to `onHistoryStateUpdated` to detect client-side SPA route changes on LeetCode/AlgoMonster without full page reloads. |
| `alarms` | Required | Schedule background review checks, daily streak nudges, and Monday weekly summary digests. |
| `notifications` | Required (Chrome / Firefox) | Trigger native system desktop alerts when reviews are due. |
| `downloads` | Required (Chrome / Firefox) | Export JSON/NDJSON backup archives and Anki TSV decks to the user's downloads folder. |
| `scripting` | Required | Programmatic fallback injection for dynamically whitelisted custom platforms. |
