# Campaign Lifecycle Trace: Bordeaux Spring Clearance
Campaign ID: camp-001 | Type: Promotion | Status: COMPLETED
**Campaign Trace — Complete**
Traced on: 2026-03-15

---

## 1. Origin

**Trigger:** Overstock alert raised by /check-inventory (inferred — processed request no longer in queue)
**Product:** SKU-042 — Château Fowler Bordeaux Blend 2018, $101/bottle, premium tier
- Stock at trigger: ~480 units | Days of supply: 147 days | Velocity: 3.27 units/day
**Why this mattered:** At 147 days of supply against a healthy threshold of ~60 days, Château Fowler represented a significant capital overhang. With spring approaching, Bordeaux clearance pricing was strategically timed to avoid summer stagnation and free warehouse space for incoming vintages. The two target segments — Price-Sensitive Buyers and Bordeaux Loyalists — were natural fits: one motivated by deals, the other by varietal affinity.

---

## 2. Strategy

**/plan-campaign run:** ~2026-01-23 (brief created_at)
**Decision:** Promotion campaign targeting seg-008 (Price-Sensitive Buyers, 45 customers) and seg-001 (Bordeaux Loyalists, 181 customers) via Email, Paid, and Social channels, with a 15% discount.

**Segment profiles at time of campaign:**

| Segment | Size | Avg CLV | Avg Open Rate |
|---|---|---|---|
| seg-008 — Price-Sensitive Buyers | 45 customers | $280 | 17.2% |
| seg-001 — Bordeaux Loyalists | 181 customers | $1,476 | 41.3% |

**Rationale:** Bordeaux Loyalists (seg-001) represent the highest-value Bordeaux buyers and would need minimal persuasion to purchase at a 15% discount. Price-Sensitive Buyers (seg-008) were added to maximise volume clearance — they respond strongly to deal framing.

**Retrospective learning applied:** Subject line framing adopted a curiosity-led approach rather than generic "sale" language, drawing on accumulated knowledge about DealSeeker personas.

**Brief approved (Gate 1):** 2026-01-24 by human

Changes requested before approval: None recorded (approval records for gate 1 returned no structured data; brief was approved the day after creation).

---

## 2.5. Skill Decision Log

Key decisions and notes recorded in each skill's log files during the campaign lifecycle.
Sourced from `logs/[skill-name]-YYYY-MM-DD.md`.

**Inventory Analyst** (check-inventory, 2026-01-23):
Log not found — no log file exists for the campaign date range (Jan 23 – Feb 11, 2026). Only current-date logs are retained. The overstock alert for SKU-042 (480 units, 147 days of supply) is confirmed via MCP catalog data.

**Campaign Strategist** (plan-campaign, 2026-01-23):
Log not found — no log file for this date. Brief creation inferred from `created_at: 2026-01-23` in the campaign record.

**Copywriter** (generate-content, 2026-01-25):
Log not found — no log file for this date. Content creation inferred from asset `created_at: 2026-01-25` timestamps across all 6 assets.

**Email Marketing Manager** (send-emails, 2026-01-28 / 2026-01-31 / 2026-02-04):
Log not found — no log files for these dates. Send details confirmed via MCP email metrics (3 sends recorded).

**Paid Media Manager** (manage-ads, 2026-01-28):
Log not found — no log file for this date. Paid campaign launches confirmed via MCP paid metrics (Google Shopping and Meta Feed both started 2026-01-28).

**Social Media Manager** (publish-social, 2026-01-28):
Log not found — no log file for this date. Two posts confirmed via MCP social metrics (Instagram post-001, Facebook post-002).

**Marketing Analyst** (performance-report, 2026-02-11):
Log not found — no log file for this date. Retrospective confirmed via MCP retrospective record, completed_at: 2026-02-11.

*Skills with no matching log entries: All — log files are only retained for the current date (2026-03-15). Historical logs for the Jan 28 – Feb 11, 2026 campaign window were not found.*

---

## 3. Content Creation

**/generate-content run:** 2026-01-25 (asset created_at timestamps)

**Email:**
- Subject A: "Save 15% on our best Bordeaux — clearance pricing starts now"
- Subject B: "We have too much Bordeaux. That's your gain." ✓ **Chosen for send — drove 2.1× higher open rate**
- Email body: "Spring is here, and our Bordeaux cellar is overflowing. We're offering 15% off our finest Bordeaux blends — rich, complex, and ready to drink now or cellar for years. These won't last long at this price."
- CTA: "Shop the Bordeaux Clearance"

**Paid:**
- Ad Headline: "Bordeaux Clearance — 15% Off"

**Social:**
- Instagram: "Spring clearance has arrived. Our finest Bordeaux blends, now 15% off. Cassis, cedar, and complexity at a price that shouldn't exist. Link in bio. #BordeauxLovers #WineSale #SpringWine"

**Gate 2 approvals:** 2026-01-26 (all assets approved same day)
- Email: Approved
- Paid: Approved
- Social: Approved

Changes requested: None — all 6 assets were approved without revision on first submission.

---

## 4. Channel Execution

**Email:**
- **Send 1:** 2026-01-28 | 420 recipients | 18 suppressed | 402 delivered
  - Subject A: lower performer (18.5% open rate) | Subject B: winner (33.3% open rate)
  - Overall open rate: 25.9% | CTR: 4.0% | 12 conversions | $4,200 revenue
- **Send 2 (Day-3 follow-up):** 2026-01-31 | 308 recipients | 12 suppressed | 296 delivered
  - Open rate: 27.7% | CTR: 4.7% | 21 conversions | $3,900 revenue
  - Note: Day-3 follow-up drove 34% of total email revenue — highest conversion rate of all three sends (7.1%)
- **Send 3 (Day-7 re-engagement):** 2026-02-04 | 228 recipients | 8 suppressed | 220 delivered
  - Open rate: 24.5% | CTR: 5.0% | 12 conversions | $3,500 revenue
- **Email totals:** 918 delivered across 3 sends | 240 opens | 41 clicks | 45 conversions | $11,600 revenue

**Paid Media:**
- **Google Shopping** launched: 2026-01-28 | Daily budget: $50/day | Total spend: $700
  - 28,400 impressions | 842 clicks | 24 conversions | CPA: $29.20 | Revenue: $4,800 | ROAS: 3.8×
- **Meta (Facebook Feed)** launched: 2026-01-28 | Daily budget: $40/day | Total spend: $560
  - 42,000 impressions | 1,260 clicks | 18 conversions | CPA: $31.10 | Revenue: $3,200 | ROAS: 2.5×
- Gate 3 (creative approval): No structured gate record found — catalog images used for paid creative (standard workflow, gate likely skipped per default rules)
- **Paid totals:** $1,260 total spend | $8,000 revenue | 42 conversions | Blended ROAS: 6.3×

**Social Media:**
- **Instagram** (post-001): Published 2026-01-28 | 8,400 impressions | 6,200 reach | 312 likes | 28 comments | 44 shares | 6.2% engagement rate
- **Facebook** (post-002): Published 2026-01-28 | 4,200 impressions | 3,100 reach | 88 likes | 12 comments | 18 shares | 3.8% engagement rate
- Creative: Catalog image (no custom upload recorded)

---

## 5. Performance

**Duration:** 14 days (2026-01-28 → 2026-02-11)

| Metric | Email | Paid | Social | Total |
|--------|-------|------|--------|-------|
| Revenue | $11,600 | $8,000 | $790.50 | $20,390.50 |
| Orders | 45 | 42 | 9 | 87 (perf. summary) |
| ROAS | 58× | 6.3× | — | 14× blended |
| Spend | $200 | $1,260 | $0 | $1,460 |
| Open/CTR/Engagement | 26.0% open / 4.6% CTR | CPA: $30.00 | 6.2% (IG) / 3.8% (FB) | — |

> **Note on data discrepancy:** The performance summary (MCP) reports $20,390.50 revenue / 87 orders. The retrospective reports $18,420 revenue / 142 orders. This likely reflects different attribution windows or counting methodologies (e.g., last-touch vs. multi-touch, or the retrospective including post-campaign halo orders). Both figures are preserved here for completeness.

**Anomalies during campaign:** None flagged (no anomaly log records found for this campaign period).

---

## 6. Retrospective & Learnings

*Written by /performance-report on 2026-02-11*

**Overall result:** $18,420 revenue | 142 orders | 3.2× overall ROAS across 14 days

**Channel breakdown (retrospective view):**
- Email: $11,600 revenue | 89 orders | 4.2× ROAS | 26% open rate | 3.8% click rate
- Paid: $4,800 revenue | $2,666 spend | 1.8× ROAS | $29.80 CPA
- Social: $2,020 revenue | 12,400 reach | 4.2% engagement rate

**Best performing element:** Email Subject B (curiosity-led) drove 2.1× higher open rate vs Subject A.

**Worst performing element:** Paid media underperformed at 1.8× ROAS vs email's 4.2× — for future promotions, consider email-first before launching paid.

**A/B Test winner:** Subject B — *"We have too much Bordeaux. That's your gain."*

**Learnings:**
1. Email Subject B (curiosity-led) drove 2.1× higher open rate than Subject A for the Deal Seeker segment
2. Day-3 follow-up email drove 34% of total email revenue — this cadence is essential for promotion campaigns
3. Paid ROAS (1.8×) significantly underperformed email (4.2×) for this campaign type
4. Social drove ~11% of total revenue with zero spend — high-efficiency channel for clearance

**Recommendations for next campaign:**
1. For Bordeaux promotions, lead with email-only in first 5 days before launching paid
2. Deal Seeker segment responds to curiosity and value framing — avoid generic "sale" language
3. Day-3 follow-up is non-negotiable for promotion campaigns — do not skip it

---

## 7. Timeline

| Date & Time | Event |
|---|---|
| 2026-01-23 | Overstock alert raised by /check-inventory for SKU-042 (480 units, 147 days supply) |
| 2026-01-23 | /plan-campaign created brief camp-001 (Bordeaux Spring Clearance, 15% off, email + paid + social) |
| 2026-01-24 | Human approved brief (Gate 1) |
| 2026-01-25 | /generate-content produced 6 copy assets across email, paid, and social channels |
| 2026-01-26 | Human approved all content assets (Gate 2) — no revisions requested |
| 2026-01-28 | Email Send 1 deployed — 420 recipients, 18 suppressed; Subject B opened at 33.3% |
| 2026-01-28 | Google Shopping campaign launched — $50/day budget |
| 2026-01-28 | Meta Feed campaign launched — $40/day budget |
| 2026-01-28 | Instagram post published (post-001) — 6.2% engagement rate |
| 2026-01-28 | Facebook post published (post-002) — 3.8% engagement rate |
| 2026-01-31 | Email Send 2 (Day-3 follow-up) — 308 recipients; 7.1% conversion rate (highest of campaign) |
| 2026-02-04 | Email Send 3 (Day-7 re-engagement) — 228 recipients |
| 2026-02-11 | Campaign ended — paid campaigns concluded |
| 2026-02-11 | Retrospective written by /performance-report |

---

*Trace generated by the Campaign Auditor on 2026-03-15. This is a point-in-time snapshot. All data sourced from MCP domains: campaign_content, channel_execution, analytics_attribution, catalog_inventory, customer_data. Skill log files for the Jan 28 – Feb 11, 2026 date range were not found (log retention appears to cover current session only).*
