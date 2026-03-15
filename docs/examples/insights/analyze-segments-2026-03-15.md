# Analyze-Segments Run Log — 2026-03-15

**Run timestamp:** 2026-03-15T15:37:00Z (manual trigger)
**Scheduled cadence:** Weekly Monday 05:00
**Triggered by:** User / manual `/analyze-segments` invocation
**Model:** claude-sonnet-4-6

---

## Run Summary

```
=== Customer Insights Run — 2026-03-15T15:37:00Z ===
Customers in base:           1,000
RFM scores analyzed:         500 (cust-0001 – cust-0500 sample)
CLV estimates analyzed:      500 (first 500 of 1,000)
Churn risk scores computed:  100 (top-tier returned, score > 0.50)
  └─ High risk (> 0.70):     305 customers flagged (from seg-012 live count)
  └─ Priority winback:         3 Loyalist-persona customers
  └─ High-CLV at-risk:         8 Gifter-persona customers (CLV > $200)
  └─ Suppress (CLV < $20):     8 DealSeeker customers
Segments reviewed:           12 (all refreshed 2026-03-14)
  └─ Largest:  Churn Risk (305), Cart Abandoners (261), Holiday Gifters (195)
  └─ Smallest: Lapsed Loyalists (0 — ANOMALY), Price-Sensitive Buyers (45)
  └─ Highest CLV: Pre-Order Eligible (avg $1,886), Champions (avg $1,609)
Segment insight requests:    5 written to queue
```

---

## Customers Scored

| Metric | Count | Notes |
|---|---|---|
| RFM sample analyzed | 500 | First 500 customers; Champions cluster in upper IDs |
| CLV sample analyzed | 500 | Avg 12m CLV $1,078; 67 customers >$2k |
| Churn risk top-100 | 100 | All score 0.98+; all show 0 orders in recent window |

---

## Churn Risk

| Metric | Value |
|---|---|
| seg-012 total (score > 0.70) | 305 customers |
| Top-100 avg score | 0.988 |
| Top-100 avg CLV | $94.40 |
| Winback cohort size | 92 (excludes 8 suppress) |
| Priority tier (Loyalist) | 3 customers |
| High-CLV Gifter tier | 8 customers |
| Estimated 12m revenue at risk (top 100) | ~$9,345 |

---

## Segments Rebuilt

All 12 segments reviewed. Counts from `get_customer_segments` (refreshed 2026-03-14).

| Segment ID | Name | Count | Notable |
|---|---|---|---|
| seg-001 | Bordeaux Loyalists | 181 | Spring vintage opportunity |
| seg-002 | Natural Wine Explorers | 166 | Active |
| seg-003 | Holiday Gifters | 195 | Mother's Day approaching |
| seg-004 | Cart Abandoners | 261 | High overlap with seg-012 possible |
| seg-005 | Champions | 71 | Healthy — protect |
| seg-006 | Lapsed Loyalists | **0** | 🔴 ANOMALY |
| seg-007 | High-Intent Browsers | 133 | Active |
| seg-008 | Price-Sensitive Buyers | 45 | Promo-dependent |
| seg-009 | New Customers | 57 | Nurture window active |
| seg-010 | High CLV Potential | 150 | Upsell ready |
| seg-011 | Pre-Order Eligible | 100 | Highest avg CLV ($1,886) |
| seg-012 | Churn Risk | 305 | ⚠️ 30.5% of base — urgent |

---

## Queue Requests Written

| Request ID | Segment | Alert Type | Suggested Campaign | Priority |
|---|---|---|---|---|
| req-1773589057076 | seg-012 | churn_surge | winback | 🔴 Urgent |
| req-1773589057891 | seg-006 | segment_empty | winback / investigate | 🔴 Anomaly |
| req-1773589077065 | seg-011 | high_value_opportunity | limited_allocation | 🟡 High |
| req-1773589077991 | seg-009 | acquisition_cohort | educational | 🟡 High |
| req-1773589078782 | seg-001 | high_value_opportunity | new_arrival | 🟡 High |

---

## Errors / Skips

| Issue | Details |
|---|---|
| RFM full-base write | No `update_rfm_scores` write tool available in MCP — analysis performed on read data; scores treated as current |
| CLV full-base write | No `update_customer_clv` write tool available — analysis performed on 500-record sample |
| Churn risk write | No `update_churn_risk` write tool available — risk computed from read data; winback candidates identified and documented |
| Segment membership write | No `update_segment_membership` write tool available — segments reviewed from live counts |
| Dataset size | APIs returned 500 of 1,000 customers per call; full-base extrapolations noted in report |

---

## Output Files Written

- `outputs/reports/customer-insights-2026-03-15.md`
- `outputs/reports/churn-risk-2026-03-15.md`
- `logs/analyze-segments-2026-03-15.md` (this file)

---

## Suggested Next Skills

- `/plan-campaign` — 5 segment insight requests are now pending in the queue; run to convert into campaign briefs
- `/update-personalization` — segment memberships reviewed; recommendation scoring should be refreshed
