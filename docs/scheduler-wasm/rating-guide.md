# FSRS State Transitions & Rating Guide

This guide explains how the **Free Spaced Repetition Scheduler (FSRS)** algorithm manages card states, how state transitions occur, and how to accurately select ratings (`Again`, `Hard`, `Good`, `Easy`) when reviewing coding problems and flashcards.

---

## 1. Overview of FSRS Card States

FSRS categorizes cards into four distinct states (`State` enum: `0` to `3`):

| State | Enum Value | Description |
| :--- | :---: | :--- |
| **New** | `0` | A newly created card that has never been reviewed by the user. |
| **Learning** | `1` | A card undergoing short-term acquisition steps before graduating into long-term memory. |
| **Review** | `2` | A graduated card in long-term memory maintenance under active spaced repetition. |
| **Relearning** | `3` | A card previously in `Review` that was forgotten (`Again`) and is undergoing recovery steps. |

---

## 2. Comprehensive State Transition Matrix

The `ts-fsrs` engine automatically evaluates the card's current state and the user's rating (`Again`, `Hard`, `Good`, `Easy`) to compute the next state, stability ($S$), difficulty ($D$), and next due interval ($I$).

```
                       [ Rating: Easy (4) ]
             +---------------------------------------+
             |                                       v
[ New (0) ] --+--> [ Learning (1) ] ------> [ Review (2) ] <----+
 (Creation)     [ Again / Hard / Good ]   (Steps complete) |      |
                                                           |      | Relearning
                                            Rating: Again  |      | steps complete
                                              (Lapse)      v      |
                                                   [ Relearning (3) ]
```

### Detailed Transition Rules

| Current State | User Rating | Next State | Stability ($S$) / Difficulty ($D$) Impact | Next Due Interval |
| :--- | :--- | :--- | :--- | :--- |
| **`New (0)`** | `Again (1)` | `Learning (1)` | Initial $S$ set low ($w_0$); $D$ set high ($w_4$). | First learning step (e.g., 1 min / 5 min). |
| **`New (0)`** | `Hard (2)` | `Learning (1)` | Initial $S$ set medium ($w_1$). | First learning step (e.g., 5 min / 10 min). |
| **`New (0)`** | `Good (3)` | `Learning (1)`* | Initial $S$ set higher ($w_2$). | Next learning step (e.g., 10 min / 1 day). |
| **`New (0)`** | `Easy (4)` | `Review (2)` | Initial $S$ set highest ($w_3$); $D$ set lowest. | Immediately graduates with long interval (e.g., 4+ days). |
| **`Learning (1)`** | `Again (1)` | `Learning (1)` | $S$ stays low; $D$ increases. | Resets to 1st learning step. |
| **`Learning (1)`** | `Hard (2)` | `Learning (1)` | $S$ grows slowly. | Repeats or advances learning step. |
| **`Learning (1)`** | `Good (3)` | `Review (2)`* | $S$ grows to target retention level. | Graduates to long-term review interval. |
| **`Learning (1)`** | `Easy (4)` | `Review (2)` | $S$ leaps significantly. | Graduates immediately to long-term review interval. |
| **`Review (2)`** | `Good (3)` | `Review (2)` | $S$ expands based on target retention ($\sim 90\%$). | Scheduled interval expands exponentially. |
| **`Review (2)`** | `Hard (2)` | `Review (2)` | $S$ grows at reduced rate; $D$ increases. | Interval expands conservatively. |
| **`Review (2)`** | `Easy (4)` | `Review (2)` | $S$ grows at accelerated rate; $D$ decreases. | Interval expands aggressively (e.g., $1.5\times - 2.5\times$). |
| **`Review (2)`** | `Again (1)` | **`Relearning (3)`** | **Lapse occurs.** $S$ drops sharply; $D$ increases; `lapses` incremented. | Drops into 1st relearning step. |
| **`Relearning (3)`**| `Again (1)` | `Relearning (3)`| $S$ stays low. | Resets relearning steps. |
| **`Relearning (3)`**| `Good` / `Easy`| `Review (2)` | $S$ recovers; card re-graduates. | Returns to long-term review schedule. |

*\*Note: If short-term learning steps are disabled in configuration (`enable_short_term = false`), `New` cards transition directly to `Review (2)` on `Good` or `Hard`.*

---

## 3. Rating Selection Criteria: When to Press What

Choosing the correct rating ensures FSRS builds an accurate mathematical model of your memory retention.

### 🔴 `Again` (Rating 1)
* **Definition**: Complete failure or unacceptable partial recall.
* **When to select**:
  * You had a total blackout and could not recall the core approach or algorithm.
  * You derived an incorrect algorithm (e.g., $O(N^2)$ brute force instead of required $O(N)$ sliding window).
  * You forgot a **critical core component** necessary to solve the problem (e.g., forgot base cases, key pointer updates, or heap invariants).
  * You looked at the solution or notes to complete the review.

### 🟡 `Hard` (Rating 2)
* **Definition**: Successful recall, but required significant effort, hesitation, or mental strain.
* **When to select**:
  * You successfully solved the problem and recalled the correct approach, but it took much longer than expected.
  * You had to pause for a long time to reconstruct key steps from scratch.
  * You remembered the complete algorithmic idea, but stumbled on minor implementation syntax or non-critical edge cases before self-correcting.

### 🟢 `Good` (Rating 3)
* **Definition**: Successful recall with standard effort. **(This should be your most frequent rating ~70–80% of the time).**
* **When to select**:
  * You recalled the core approach and key code logic smoothly within expected time.
  * The recall felt normal—neither surprisingly hard nor trivially easy.
  * You solved the problem correctly without needing hints or looking at solution notes.

### 2.1 `Easy` (Rating 4)
* **Definition**: Trivial, instantaneous recall with zero mental effort.
* **When to select**:
  * The solution felt completely obvious or intuitive.
  * You solved the problem effortlessly in your head without needing scratchpad work.
  * **Caution**: Avoid overusing `Easy` on complex problems, as it aggressively pushes out the next review date.

---

## 4. Handling Partial Memory (Partial Recall)

A common dilemma during spaced repetition reviews is: **"What if I remembered SOME parts of the card, but not ALL of it?"**

### The Core Principle of Technical & Coding Flashcards
In technical subjects (Data Structures, Algorithms, System Design), flashcards test functional mastery. **Partial recall must be evaluated based on algorithmic criticality.**

### Decision Flowchart for Partial Recall

```
Did you remember the CORE ALGORITHMIC LOGIC & PATTERN?
  |
  +---> NO  --> [ Press AGAIN (1) ]
  |             (Reason: Missing the core logic means you would fail the interview/test)
  |
  +---> YES --> Did you stumble on minor implementation / non-critical details?
                  |
                  +---> YES --> [ Press HARD (2) ]
                  |             (Reason: You retained the main concept, but recall wasn't smooth)
                  |
                  +---> NO  --> [ Press GOOD (3) ]
```

---

## 5. Summary Cheat Sheet

| Situation | Recommended Rating |
| :--- | :---: |
| Blanked out / Needed hints / Core logic failed | **`Again` (1)** |
| Critical part of algorithm forgotten | **`Again` (1)** |
| Solved correctly, but required high mental effort / delay | **`Hard` (2)** |
| Minor syntax hesitation, core logic solid | **`Hard` (2)** |
| Solved smoothly with normal effort | **`Good` (3)** |
| Effortless / Obvious / Trivial | **`Easy` (4)** |

---

## 🔗 Related Documentation
* 🧮 [FSRS Algorithm & Math Formulas](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md)
* ⚡ [WASM Parameter Optimizer Runtime](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/optimizer-wasm.md)
* 🎯 [Tracker Overlay Feature](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/tracker.md)
* ⚙️ [Developer & Customization Guide](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/customization.md)
