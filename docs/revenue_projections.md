# Revenue Projection Model
## AlgoRecall: Coding Interview Spaced Repetition

> **Document Version:** 1.0 · **Date:** August 2026
> **Status:** Financial Analysis

---

## 1. Market Context & Assumptions

Based on 2026 market data, we build our projections on the following assumptions:

### The Funnel
1. **Total Market:** LeetCode has ~25M monthly visits and ~15M registered users.
2. **Addressable Market:** ~10% of users actively preparing for interviews at any given time (~1.5M users).
3. **Store Discovery & Installs:** Chrome extensions typically face a "discovery gap." We assume organic growth supplemented by Reddit/community marketing.
4. **Active Users (MAU):** We assume 40% of installs remain actively engaged past the first week.
5. **Conversion Rate (Free-to-Paid):** Industry average for Chrome extensions is **0.5% - 2.0%**. We will model 1% (Conservative) and 2% (Optimistic).

### Pricing & Blended ARPU
We offer multiple tiers ($5.99/mo, $49.99/yr, $29.99/yr student). 
- **Assumption:** 60% of paid users opt for the Student Annual ($29.99/yr), 30% opt for Standard Annual ($49.99/yr), and 10% opt for Monthly ($5.99/mo).
- **Blended Annual Revenue Per Paid User (ARPU):** ~$35/year.
- **Monthly Equivalent ARPU:** ~$2.90/month.

---

## 2. Year 1 Projections: The Bootstrap Phase

In Year 1, growth is primarily organic (Chrome Web Store SEO, Reddit, GitHub, word of mouth). 

| Metric | Conservative (Base) | Optimistic (Hit) |
|--------|---------------------|------------------|
| **New Installs / Month** | 1,000 | 5,000 |
| **Total Installs (EOY 1)** | 12,000 | 60,000 |
| **Active Users (40%)** | 4,800 | 24,000 |
| **Conversion Rate** | 1.0% | 2.0% |
| **Total Paid Users** | 48 | 480 |
| **Blended ARPU (Annual)**| $35 | $35 |
| **Monthly Recurring Rev (MRR) at EOY 1** | **~$140 / mo** | **~$1,400 / mo** |
| **Total Year 1 Gross Revenue** | **~$1,680** | **~$16,800** |

> [!NOTE]
> **Year 1 Reality Check:** Most developer tools in the Chrome Web Store fall into the conservative bucket unless they go viral on platforms like HackerNews or are aggressively marketed via coding bootcamps. 

---

## 3. Year 2 Projections: The Growth Phase

In Year 2, we assume product-market fit is established. Marketing efforts expand to sponsorships (e.g., coding YouTubers, NeetCode integration, bootcamp partnerships). The product adds highly requested features (e.g., Cloud Sync, advanced Analytics).

| Metric | Conservative (Base) | Optimistic (Hit) |
|--------|---------------------|------------------|
| **Total Installs (Cumulative)**| 35,000 | 150,000 |
| **Active Users (40%)** | 14,000 | 60,000 |
| **Conversion Rate** | 1.2% | 2.5% |
| **Total Paid Users** | 168 | 1,500 |
| **Blended ARPU (Annual)**| $35 | $40 (Price optimization) |
| **Monthly Recurring Rev (MRR) at EOY 2** | **~$490 / mo** | **~$5,000 / mo** |
| **Total Year 2 Gross Revenue** | **~$5,880** | **~$60,000** |

---

## 4. Year 3 Projections: The Scale Phase

By Year 3, AlgoRecall shifts from a simple extension to a comprehensive platform (introducing mobile companions, team plans, and pre-built decks). Churn is stabilized.

| Metric | Conservative (Base) | Optimistic (Hit) |
|--------|---------------------|------------------|
| **Total Installs (Cumulative)**| 75,000 | 400,000 |
| **Active Users (40%)** | 30,000 | 160,000 |
| **Conversion Rate** | 1.5% | 3.0% |
| **Total Paid Users** | 450 | 4,800 |
| **Blended ARPU (Annual)**| $35 | $45 (Pro+AI features) |
| **Monthly Recurring Rev (MRR) at EOY 3** | **~$1,312 / mo** | **~$18,000 / mo** |
| **Total Year 3 Gross Revenue** | **~$15,750** | **~$216,000** |

---

## 5. Cost Structure & Profit Margin

Chrome extension micro-SaaS businesses enjoy incredibly high profit margins (typically 80-90%).

**Estimated Monthly Costs (at 50,000 active users):**
- **Firebase/GCP (Cloud Sync & Auth):** $50 - $150 / month
- **Payment Processing (Stripe/ExtensionPay):** ~5-8% of gross revenue
- **Domain/Hosting (Landing Page):** $20 / month
- **Marketing/Sponsorships (Optional):** Variable
- **Gross Margin:** **~85% - 90%**

---

## 6. Strategic Takeaways & How to Hit "Optimistic"

To reach the **$200k+/year (Optimistic)** trajectory rather than the **$15k/year (Conservative)** trajectory, the following levers must be pulled:

1. **B2B / Bootcamp Partnerships (The "Cheat Code"):**
   Selling directly to B2C students is a grind. If you partner with coding bootcamps (e.g., App Academy, Hack Reactor) to bundle AlgoRecall Pro into their curriculum for $20/student/cohort, you bypass the Chrome Web Store discovery gap entirely. 10 bootcamps × 500 students = 5,000 paid users instantly.

2. **The "NeetCode" Integration:**
   The audience overlap with NeetCode.io is nearly 100%. If you can establish a partnership (or build a highly specialized integration) where NeetCode recommends the tool for tracking retention of the "NeetCode 150", your install volume will shift from 1,000/mo to 20,000/mo.

3. **Pre-built Deck Marketplace:**
   Many users will abandon the free tier because *making cards takes time*. Selling a one-time "Premium Blind 75 Deck" for $9.99 will dramatically increase your Year 1 ARPU because it removes the friction of card creation.

### Conclusion

AlgoRecall is a **Micro-SaaS cash-flow business**, not a venture-scale unicorn. 
- If run passively as a side project (Conservative), it can reliably generate **$5,000 - $15,000/year** in high-margin passive income.
- If treated as a primary business with aggressive B2B sales and influencer marketing (Optimistic), it has a clear path to **$100,000 - $250,000/year** in ARR within 3 years.
