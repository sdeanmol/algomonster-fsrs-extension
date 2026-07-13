# Chrome Web Store Listing — AlgoRecall: Coding Interview Spaced Repetition

> Last Updated: 2026-07-13

## Store Listing

**Extension Name**
AlgoRecall: Coding Interview Spaced Repetition

**Short Description**
Optimizes coding pattern memory retention on AlgoMonster using the FSRS spaced repetition scheduler and a persistent text highlighter.

**Detailed Description**
Master programming patterns, not just problems.

AlgoRecall integrates the scientific Free Spaced Repetition Scheduler (FSRS) directly into your LeetCode and AlgoMonster study sessions. Instead of memorizing code solutions that fade in a few days, this tool schedules reviews of problem solving patterns at the exact moment of memory decay, ensuring long-term interview readiness.

Key Features:
- Scientific Memory Scheduling: Utilizes Manifest V3 FSRS scheduling routines (Again, Hard, Good, Easy ratings) to optimize review intervals dynamically.
- Persistent Text Highlighter: Visualizes critical concepts by highlighting code approaches on matched documents, serialized to storage, and re-injected automatically.
- Live Context Synchronization: Supports multi-tab status tracking and notification alerts synced across the popup dashboard, sub-pages, and host-page widgets.
- Contribution Activity Heatmap: Audits daily practice consistency via a GitHub-inspired gamified board showing active days and streaks.
- Secure Data Portability: Back up, export, or import progress files locally as structured JSON data with 100% serverless data security.

How to Use:
1. Complete a pattern question on AlgoMonster or System Design School.
2. Highlight core approaches directly on the document.
3. Click the floating brain icon in the bottom-right corner to save study notes, tags, and rate the initial difficulty.
4. Open the popup dashboard to audit upcoming cards or receive automatic due review alerts.

Privacy & Permissions:
All data is stored locally in the extension sandbox. Zero tracking codes, no external servers, and zero data leaves your local device.

**Category**
Developer Tools

**Single Purpose**
Saves and schedules coding pattern reviews using spaced repetition on AlgoMonster.

**Primary Language**
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `icons/icon.png` |
| Screenshot 1 (Hero dashboard) | 1280×800 | ⬜ Not created | |
| Screenshot 2 (Widget rating) | 1280×800 | ⬜ Not created | |
| Screenshot 3 (Highlighter flow) | 1280×800 | ⬜ Not created | |

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Preserves FSRS stats, serializations, color parameters, and custom topic weights locally. |
| `activeTab` | permissions | Accesses the active tab context when clicked by the user to execute script context. |
| `tabs` | permissions | Queries the active tab URL in background scripts to route due review notifications in-page. |
| `notifications` | permissions | Dispatches background system notification popups when study cards fall due. |
| `alarms` | permissions | Runs periodic background checks to verify if any reviews are due without draining battery. |
| `downloads` | permissions | Downloads the user's statistics backup files as structured JSON locally. |
| `webNavigation` | permissions | Tracks client-side SPA history modifications to automatically load widgets on page transitions. |
| `*://*.algo.monster/*` | host_permissions | Restricts document highlights and widget injection exclusively to the AlgoMonster domain. |
| `*://*.systemdesignschool.io/*` | host_permissions | Restricts highlights and widget injection to the System Design School domain. |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No.

### Data Use Certification
- [x] Data is NOT sold to third parties.
- [x] Data is NOT used for purposes unrelated to the extension's core functionality.
- [x] Data is NOT used for creditworthiness or lending purposes.

---

## Privacy Policy
100% local extension. No user tracking is implemented. Privacy Policy can be hosted on a public GitHub pages repository if needed.

---

## Distribution
- **Visibility**: Public
- **Regions**: All regions
- **Pricing**: Free

---

## Developer Info

**Contact Email**
developer-support@algomonster-fsrs.example.com

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 3.0 | 2026-07-13 | Upgraded to MV3 base theme toggling and inline SVGs. | Draft |
