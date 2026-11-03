# Analytics Engine Deep Dive

This document details the analytical engine in **AlgoRecall**, explaining the statistical algorithms, memory health metrics, retention calculations, exam readiness model, learning velocity, and future memory simulations implemented in `features/dashboard/analytics/`.

---

## 🔬 Analytics Module Structure

```text
features/dashboard/analytics/
├── analytics.ts                       # Main Analytics UI controller & view tab switcher
├── utils/dataUtils.ts                 # Core DataUtils aggregation class
├── overview/
│   ├── overview.ts                    # High-level metrics dashboard
│   ├── memoryHealth.ts                # Memory Health score calculation
│   ├── learningVelocity.ts            # 7-day / 14-day velocity sparklines
│   └── miniForecast.ts                # 7-day mini workload forecast
├── memory/
│   ├── memory.ts                      # Retention & memory stability tab
│   ├── retentionChart.ts              # Historical vs true retention chart
│   ├── futureMemorySimulation.ts      # Memory decay simulation slider (0-180 days)
│   ├── confidenceBand.ts              # Confidence band estimation
│   └── predictionComparison.ts        # Model prediction accuracy
├── readiness/
│   └── readiness.ts                   # Exam Readiness score per topic/tag
├── tags/
│   ├── tags.ts                        # Tag coverage overview
│   ├── coverageTable.ts               # Tag retention & lapse breakdown table
│   └── retentionBarChart.ts           # Comparative tag retention bar chart
├── performance/
│   ├── performance.ts                 # Lapse & recovery leaderboard
│   ├── recoveryTracking.ts            # Recovered cards tracker (stabilities > threshold)
│   └── reviewStats.ts                 # Total reps & lapse distributions
└── insights/
    ├── insights.ts                    # Time-of-day review efficiency
    └── reviewTimeAnalytics.ts         # Morning/Afternoon/Evening/Night performance
```

```mermaid
graph TD
    subgraph UI_Controller ["UI Controller: analytics.ts"]
        T1["Overview Tab"]
        T2["Memory Tab"]
        T3["Readiness Tab"]
        T4["Tags Tab"]
        T5["Performance Tab"]
        T6["Insights Tab"]
    end

    subgraph Core_Aggregator ["Core Aggregator"]
        DU["DataUtils (dataUtils.ts)"]
        SC["chrome.storage.local (fsrsCards)"]
    end

    subgraph Analytical_Views ["Analytical Views & Charts"]
        O1["Memory Health & Sparkline Velocity"]
        O2["True Retention Chart & Simulation Slider"]
        O3["Exam Readiness & Risk Categorization"]
        O4["Tag Coverage & Retention Bar Chart"]
        O5["Lapse Leaderboard & Recovery Tracker"]
        O6["Time-of-Day Efficiency Matrix"]
    end

    SC --> DU
    DU --> T1
    DU --> T2
    DU --> T3
    DU --> T4
    DU --> T5
    DU --> T6
    T1 --> O1
    T2 --> O2
    T3 --> O3
    T4 --> O4
    T5 --> O5
    T6 --> O6
```

---

## 🧮 Core Analytics Algorithms (`dataUtils.ts`)

### 1. Retention vs. True Retention
* **Observed Retention**:
  $$\text{Retention} = \frac{\text{Total Reps} - \text{Total Lapses}}{\text{Total Reps}} \times 100$$
* **True Retention (Retrievability Weighting)**: Calculates active retrievability $R(t)$ for each card at current timestamp $t$:
  $$\text{True Retention} = \frac{1}{N_{\text{reviewed}}} \sum_{i=1}^{N_{\text{reviewed}}} R_i(t) \times 100$$

```mermaid
flowchart TD
    subgraph Observed_Retention ["Observed Retention"]
        A1["Sum Total Reps across all cards"] --> B1["Count Total Lapses (Rating: Again)"]
        B1 --> C1["Calculate (Reps - Lapses) / Reps"]
        C1 --> D1["Observed % (Static historical ratio)"]
    end

    subgraph True_Retention ["True Retention (Active Decay)"]
        A2["For each reviewed card i at timestamp now"] --> B2["Calculate elapsed days: t = (now - last_review)"]
        B2 --> C2["Compute Retrievability: R_i(t) = (1 + factor * t / S)^(-decay)"]
        C2 --> D2["Compute Arithmetic Mean across N cards"]
        D2 --> E2["True Retention % (Dynamic current recall probability)"]
    end
```

### 2. Learning Velocity & Trends (`learningVelocity.ts`)
Tracks 7-day sliding window counts of new cards created, graduated cards (stability $> 21.0$ days), and total reviews:
$$\text{Trend \%} = \frac{\text{Count}_{\text{this\_week}} - \text{Count}_{\text{last\_week}}}{\text{Count}_{\text{last\_week}}} \times 100$$

### 3. Exam Readiness Model (`readiness.ts`)
Predicts overall expected recall rate across all cards if an exam occurs $N$ days ahead ($N \in [1, 90]$):
1. Evaluates target date $t_{\text{exam}} = t_{\text{now}} + N \times 86400000$.
2. For each card $i$, projects retrievability $R_i(t_{\text{exam}})$.
3. Groups cards by tag/topic and assigns risk classifications:
   * **Ready (Green)**: Projected $R \ge 85\%$
   * **Moderate (Yellow)**: Projected $70\% \le R < 85\%$
   * **At Risk (Red)**: Projected $R < 70\%$

```mermaid
flowchart LR
    A[Target Exam Date: N Days Ahead] --> B[For Each Card: Calculate R_i at t_exam]
    B --> C[Aggregate by Tag / Topic]
    C --> D{Expected Tag Recall R}
    D -- R >= 85% --> E[Status: Ready - Green]
    D -- 70% <= R < 85% --> F[Status: Moderate - Yellow]
    D -- R < 70% --> G[Status: At Risk - Red]
```

---

## 📉 Future Memory Simulation (`futureMemorySimulation.ts`)

Predicts memory retention decay assuming the user stops reviewing altogether:
* Evaluates memory decay at $t \in [0, 15, 30, 45, 60, 90, 120, 150, 180]$ days.
* Computes forgotten card count ($R_i(t) < 0.70$).
* Renders interactive slider allowing custom date predictions.

```mermaid
flowchart LR
    A["User drags Simulation Slider: t in [0, 180] days"] --> B["Compute target timestamp: t_target = now + t"]
    B --> C["For each card: evaluate R_i(t_target) based on stability S_i"]
    C --> D{"Check R_i(t_target)"}
    D -- "R >= 70%" --> E["Classify: Retained Card"]
    D -- "R < 70%" --> F["Classify: Forgotten Card"]
    E --> G["Update Retention Curve Chart & Metrics Bar"]
    F --> G
```

---

## 🔗 Related Documentation
* 📘 [Architecture Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/overview.md)
* 🧮 [FSRS Algorithm Theory](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md)
* 📊 [Dashboard Views](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/dashboard.md)
