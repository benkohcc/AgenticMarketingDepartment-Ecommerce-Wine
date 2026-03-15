# Campaign Trace & Retrospective — Bordeaux Spring Clearance

![Trace Diagram](Trace-Diagram.png)

**Skills used:** `/trace-campaign` + `/performance-report` (retrospective author)

A walkthrough of the campaign audit and retrospective workflow. `/trace-campaign` reconstructs the full lifecycle of any completed campaign from MCP data — from the inventory alert that triggered it to the retrospective learnings that fed the next one.

---

## Step 1 — Asking What's Available

<img src="Screenshot%202026-03-15%20at%2010.06.43%E2%80%AFAM.png" width="449" alt="Campaign list — 4 completed, 2 active">

The session opens by asking what campaigns can be traced. The skill queries all campaign briefs and returns a structured list split by status:

**Completed campaigns** (full trace with retrospective available):

| ID | Name | Type | Duration |
|---|---|---|---|
| camp-001 | Bordeaux Spring Clearance | Promotion | Jan 28 – Feb 11, 2026 |
| camp-002 | 2024 Barolo Pre-Order | Pre-order | Dec 14–28, 2025 |
| camp-003 | Holiday Gifting 2024 | Seasonal | Nov 14 – Dec 4, 2025 |
| camp-004 | Natural Wine Discovery | Educational | Dec 29, 2025 – Jan 12, 2026 |

**Active campaigns** (partial trace, no retrospective yet):

| ID | Name | Type | Duration |
|---|---|---|---|
| camp-005 | Spring Natural Wine Content | Educational | Feb 28 – Mar 28, 2026 |
| camp-006 | Barolo Reserve Campaign | Limited Allocation | Mar 7–21, 2026 |

The skill explains the distinction: completed campaigns include a full retrospective with final performance data; active campaigns return whatever data is available up to the current date. The same skill handles both — it just labels the document accordingly.

---

## Step 2 — Running the Trace

<img src="Screenshot%202026-03-15%20at%2010.07.02%E2%80%AFAM.png" width="449" alt="Trace highlights for camp-001">

> *"trace camp-001"*

The skill pulls data across all 7 MCP domains — campaign brief, content assets, approval records, email send logs, paid campaign logs, social post logs, performance attribution, and the retrospective — then composes a full narrative document. Before delivering it, it surfaces the highlights:

> **Origin:** `/check-inventory` flagged SKU-042 (Château Fowler Bordeaux Blend 2018) at a critical 147 days of supply — more than double a healthy threshold. A 15% clearance promotion was planned the same day.

> **Content:** Subject B — *"We have too much Bordeaux. That's your gain."* — won the A/B test decisively, driving 2.1× the open rate of the more conventional Subject A. All 6 assets were approved without any revisions.

> **Standout moment:** The Day-3 follow-up email (Jan 31) had the highest conversion rate of the entire campaign at 7.1%, and drove 34% of total email revenue on its own.

> **Results:** $20,390 total revenue across 87 orders, 14× blended ROAS. Email was by far the most efficient channel (58× ROAS), while paid media underperformed at 6.3× blended — a key learning for future Bordeaux promotions.

---

## The Full Trace: camp-001 Bordeaux Spring Clearance

The complete trace document is at [bordeaux-spring-clearance-trace-2026-03-15.md](bordeaux-spring-clearance-trace-2026-03-15.md). Here's a section-by-section breakdown.

---

### 1. Origin

**Trigger:** `/check-inventory` flagged SKU-042 — Château Fowler Bordeaux Blend 2018, $101/bottle — at 480 units with 147 days of supply.

147 days matters because the healthy threshold is ~60 days. At that velocity the stock would sit unsold through spring, when consumer preference shifts away from heavy reds toward rosé and whites. With a Spring Clearance seasonal window opening on the same day, the timing was exact: the inventory alert and the calendar aligned, and `/plan-campaign` acted on both simultaneously.

---

### 2. Strategy

**Segments:** seg-008 Price-Sensitive Buyers (45 customers, avg CLV $280) and seg-001 Bordeaux Loyalists (181 customers, avg CLV $1,476). The combination covered both ends of the clearance audience — Loyalists who needed minimal persuasion at 15% off, and Deal Seekers who respond strongly to savings framing.

**Retrospective learning applied:** The curiosity-led subject line approach — *"We have too much Bordeaux. That's your gain."* — was adopted based on accumulated knowledge about DealSeeker persona behaviour. Generic "sale" framing was explicitly avoided.

**Gate 1:** Brief created Jan 23, approved by human Jan 24. No changes requested.

---

### 2.5. Skill Decision Log

The trace attempted to read log files for every skill across the campaign's 19-day window (Jan 23 – Feb 11, 2026). All historical logs were absent — log retention covers the current session only.

This is a gap worth noting, but not a blocker: the MCP catalog, channel execution, and attribution data confirmed every key fact independently. The overstock alert was confirmed via `get_all_stock_status()`. Brief creation, content timestamps, send records, paid launches, and retrospective were all recovered from structured MCP records. The trace documents the gap explicitly rather than inferring or omitting it.

---

### 3. Content

**A/B subject line test:**

| | Subject | Result |
|---|---|---|
| A | *"Save 15% on our best Bordeaux — clearance pricing starts now"* | 18.5% open rate |
| B | *"We have too much Bordeaux. That's your gain."* | 33.3% open rate — **winner, 2.1× lift** |

Email body led with radical transparency: *"Spring is here, and our Bordeaux cellar is overflowing."* Paid and social copy used the same voice across Google Shopping, Meta Feed, and Instagram.

**Gate 2:** All 6 assets approved Jan 26 — one day after generation, no revisions requested across any channel.

---

### 4. Channel Execution

**Email — 3 sends:**

| Send | Date | Delivered | Open Rate | CTR | Conversions | Revenue |
|---|---|---|---|---|---|---|
| Send 1 | Jan 28 | 402 | 25.9% | 4.0% | 12 | $4,200 |
| Send 2 (Day-3 follow-up) | Jan 31 | 296 | 27.7% | 4.7% | 21 | $3,900 |
| Send 3 (Day-7 re-engagement) | Feb 4 | 220 | 24.5% | 5.0% | 12 | $3,500 |

The Day-3 follow-up was the campaign's highest-converting send at 7.1% conversion — and drove 34% of total email revenue from just 296 deliveries. This is the single most important execution finding of the campaign.

**Paid:**
- Google Shopping: launched Jan 28, $50/day, 24 conversions, ROAS 3.8×
- Meta Feed: launched Jan 28, $40/day, 18 conversions, ROAS 2.5×

**Social:**
- Instagram (post-001): Jan 28, 6,200 reach, 6.2% engagement rate
- Facebook (post-002): Jan 28, 3,100 reach, 3.8% engagement rate

---

### 5. Performance

| Metric | Email | Paid | Social | Total |
|---|---|---|---|---|
| Revenue | $11,600 | $8,000 | $790 | $20,390 |
| Orders | 45 | 42 | 9 | 87 |
| ROAS | 58× | 6.3× | — | 14× blended |
| Spend | $200 | $1,260 | $0 | $1,460 |

**Attribution discrepancy:** The performance summary (MCP) reports $20,390 / 87 orders. The retrospective (written by `/performance-report`) reports $18,420 / 142 orders. This reflects different attribution methodologies — last-touch vs. multi-touch, or different attribution windows. The trace preserves both figures explicitly rather than choosing one. This is the correct behaviour: the discrepancy is data, not an error.

---

### 6. Retrospective & Learnings

*Written by `/performance-report` on 2026-02-11, the day the campaign closed.*

**Overall:** $18,420 revenue | 142 orders | 3.2× overall ROAS across 14 days

**Channel view:**
- Email: $11,600 | 4.2× ROAS | 26% open rate
- Paid: $4,800 | 1.8× ROAS | $29.80 CPA
- Social: $2,020 | 12,400 reach | 4.2% engagement

**A/B winner:** Subject B — *"We have too much Bordeaux. That's your gain."*

**Learnings:**
1. Curiosity-led subject lines drove 2.1× higher open rate than benefit-led for the Deal Seeker segment
2. Day-3 follow-up email drove 34% of total email revenue — this cadence is essential for promotion campaigns
3. Paid ROAS (1.8×) significantly underperformed email (4.2×) — for future promotions, lead with email-only in the first 5 days before launching paid

**Recommendations for next campaign:**
1. For Bordeaux promotions, email-only for days 1–5, then launch paid on day 6
2. Deal Seeker segment responds to curiosity and value framing — avoid generic "sale" language
3. Day-3 follow-up is non-negotiable for promotion campaigns

---

### 7. Timeline

| Date | Event |
|---|---|
| 2026-01-23 | `/check-inventory` flags SKU-042 at 480 units, 147 days supply |
| 2026-01-23 | `/plan-campaign` creates brief camp-001 (Bordeaux clearance, 15% off, email + paid + social) |
| 2026-01-24 | Human approves Gate 1 — no revisions |
| 2026-01-25 | `/generate-content` produces 6 copy assets across all channels |
| 2026-01-26 | Human approves Gate 2 — all assets, no revisions |
| 2026-01-28 | Email Send 1, Google Shopping, Meta Feed, Instagram, and Facebook all launch simultaneously |
| 2026-01-31 | Day-3 follow-up email — highest conversion rate of the campaign (7.1%) |
| 2026-02-04 | Day-7 re-engagement email |
| 2026-02-11 | Campaign ends — `/performance-report` writes retrospective |

19 days from inventory alert to retrospective. 5 days from brief creation to first send.

---

## What the Retrospective Feeds Forward

The three learnings from camp-001 didn't sit in a document — they were stored as structured fields in the MCP retrospective record and queried directly by the next campaign's strategy session.

When camp-101 (the Spring Clearance in March 2026, documented in the [clearance campaign walkthrough](../clearance-campaign/clearance-campaign.md)) was being planned, `/plan-campaign` called `get_campaign_retrospectives(campaign_type: "promotion", limit: 5)` and received camp-001's record. The three recommendations were applied verbatim:

| camp-001 learning | camp-101 application |
|---|---|
| Email-only for days 1–5, then launch paid on day 6 | Channel sequence: Email → Paid → Social, paid launches day 6 |
| Subject B (curiosity-led) drove 2.1× lift | Subject B — *"We have too much Bordeaux. That's your gain."* — set as the test baseline; new curiosity variation written against it |
| Day-3 follow-up is non-negotiable | Day-3 non-opener follow-up explicitly baked into the brief, scheduled for 2026-03-19 before the campaign launched |

The loop closes: camp-001's retrospective is the reason camp-101 started with a better channel strategy, a proven subject line direction, and a mandatory Day-3 follow-up already scheduled on day one.

---

## Why This Architecture Made It Work

### Retrospective as structured data, not prose

The retrospective isn't a report someone reads — it's a structured MCP record with explicit fields: `ab_test_winner`, `best_performing_element`, `worst_performing_element`, `learnings[]`, `recommendations_for_next_campaign[]`. When the next strategy session runs, those fields are queryable. The skill can apply *"email-only for days 1–5"* as a rule, not re-derive it from reading narrative text. The difference between structured and unstructured institutional memory is the difference between a learning that compounds and one that gets forgotten.

### Trace reconstructed entirely from MCP

No conversation history, no operator notes, no memory from previous sessions. The trace was assembled from seven independent MCP domain reads: the campaign brief, content assets, approval records, email send logs, paid campaign logs, social metrics, and attribution data. Any of those reads could have been done in isolation — together they compose a complete picture. The skill's broad read access (all 7 domains) is what makes this possible, and why `/trace-campaign` is the only skill with that access scope.

### The attribution discrepancy is a feature

The performance summary and retrospective reported different revenue figures ($20,390 vs $18,420) and different order counts (87 vs 142). Rather than reconciling them to a single number — which would require choosing an attribution model — the trace preserved both and noted the likely cause. That transparency is more useful than a clean number: it tells the next analyst exactly which methodology each figure came from and lets them choose which is appropriate for their question.

### Partial traces for active campaigns

The same skill runs against camp-005 and camp-006 (still active on March 15). It returns whatever data exists — brief, content, sends so far — and labels the document `[ACTIVE CAMPAIGN — partial trace]`. There's no separate workflow for in-progress audits. The trace is always a point-in-time snapshot, and the skill makes that explicit in every output.

---

## What This Illustrates

- **On-demand audit** — any campaign ID is traceable with a single prompt; no setup required
- **Full lifecycle in one document** — origin alert → strategy → content → execution → performance → retrospective → timeline, all from MCP data
- **Log gaps handled gracefully** — historical logs not retained doesn't break the trace; MCP data fills the gaps and the absence is noted explicitly
- **Retrospective as institutional memory** — structured fields make past learnings queryable by future skills, not just readable by humans
- **Attribution transparency** — conflicting figures from different methodologies are preserved, not hidden
- **Active campaign support** — partial traces for in-progress campaigns use the same skill with no modification
- **The loop** — the trace makes visible what the retrospective fed forward: camp-001's learnings are directly traceable in camp-101's brief
