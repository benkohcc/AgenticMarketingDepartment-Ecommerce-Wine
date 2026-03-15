# Spring Clearance — Bordeaux, Cab & Syrah

**Skills used:** `/plan-campaign` → `/generate-content` → `/send-emails`

A walkthrough of a clearance campaign from a single prompt to emails in inboxes — three skills, two approval gates, one human decision at each.

---

## Step 1 — `/plan-campaign`: Finding the Opportunity

The session starts with a single open-ended prompt. No inventory alert queued, no brief prepped — just a goal.

<img src="Screenshot%202026-03-15%20at%202.36.01%E2%80%AFAM.png" width="288" alt="The prompt and proactive scan summary">

> *"/wine-marketing:plan-campaign help me find the opportunities to grow sales. Sales have been slow in Q1 of this year. It is currently March 15."*

The skill runs a proactive scan — pulling retrospectives, the product catalog, and segment data — and opens with a Q1 diagnosis:

> **$54K revenue across 192 orders (avg AOV $355). Volume is the problem — not spend efficiency. Email ROAS is a stellar 192×, paid is 6.4×. The path to growing Q1 sales is more sends to the right people, not more ad spend.**

Three opportunities surface: a **Spring Clearance** (seasonal window opens today + critical overstock), a **Winback** for 566 lapsed customers, and a **Natural Wine Explorer Bundle** to lift AOV. All three briefs are drafted in parallel before Gate 1.

---

## Gate 1 — Campaign 1 of 3: Spring Clearance

<img src="Screenshot%202026-03-15%20at%202.36.27%E2%80%AFAM.png" width="288" alt="Brief for camp-101 — Spring Clearance">

**camp-101 · Promotion · 487 customers · 18% off · $1,500 budget · Mar 16–30**

Four Bordeaux, Cab, and Syrah SKUs are at 65–147 days supply — critical overstock. The Spring Clearance seasonal window opens today. Three segments are selected: Cart Abandoners (261), Price-Sensitive Buyers (45), Bordeaux Loyalists (181).

The channel sequence and creative direction come directly from camp-001, a near-identical Bordeaux promo from Feb 2026 that generated $18,420 / 142 orders:

- Email-only for the first 5 days, then launch paid on day 6
- Curiosity-led subject lines outperformed benefit-led 2.1× (*"We have too much Bordeaux. That's your gain."*)
- Day-3 non-opener follow-up drove 34% of total email revenue

---

## Gate 1 — Campaign 2 of 3: Q1 Winback

<img src="Screenshot%202026-03-15%20at%202.36.44%E2%80%AFAM.png" width="288" alt="Brief for camp-102 — Winback">

**camp-102 · Winback · 566 customers · 10% soft offer · $60 budget · Mar 16–30**

305 customers have churn scores above 0.7. Combined with 261 Cart Abandoners (lifecycle = lapsed), there are 566 addressable customers — the single biggest untapped pool in the database. No prior winback retrospective exists, so the skill falls back to persona defaults: low-pressure tone, entry-priced SKUs from $18, single email send per winback rules. Even at 5% reactivation, that's ~$10K revenue from a near-zero-cost campaign.

---

## Gate 1 — Campaign 3 of 3: Natural Wine Explorer Bundle

<img src="Screenshot%202026-03-15%20at%202.37.02%E2%80%AFAM.png" width="288" alt="Brief for camp-103 — Bundle">

**camp-103 · Bundle · 299 customers · 15% bundle discount · $300 budget · Mar 17–31**

Three Natural/Biodynamic SKUs at 63–84 days supply are curated into a trio spanning entry ($20), mid ($44), and mid-premium ($55) — bundle price ~$86, saving $15 vs. individual. Target: Natural Wine Explorers (avg CLV $531) and High-Intent Browsers (avg CLV $755, upsell propensity >0.65). Framing: *"we put these together for a reason."*

---

## The Human Decision

<img src="Screenshot%202026-03-15%20at%202.37.32%E2%80%AFAM.png" width="288" alt="Priority recommendation and human approval">

The skill closes Gate 1 with a prioritised recommendation: start with camp-101 (time-sensitive seasonal window, proven retrospective), then camp-102 (near-zero cost revenue recovery), then camp-103 (AOV lift).

The human makes a single focused call:

> *"approve camp-101. Reject the rest"*

The skill processes all three responses simultaneously: camp-101 moves to ACTIVE with approval record `appr-1773559965593`, camp-102 and camp-103 are CANCELLED. Output files and run log are written. The session closes with a clear handoff:

> **Ready for the next step:** Run `/generate-content` to produce email, paid, and social copy for camp-101. Given the retrospective learnings, the copy team will need curiosity-led subject lines and a Day-3 non-opener follow-up baked in.

---

## Step 2 — `/generate-content`: Building the Copy Package

<img src="Screenshot%202026-03-15%20at%202.46.46%E2%80%AFAM.png" width="288" alt="/generate-content loading">

`/generate-content` picks up the approved campaign via `get_approval_records(gate: 1, decision: "approved")`. It confirms camp-101 is active, then pulls SKU details for all four wines — Bordeaux Blend, Cabernet, and Syrah lines in parallel — before generating 12 assets across email, paid, and social simultaneously.

---

### Gate 2 — Email Copy

<img src="Screenshot%202026-03-15%20at%202.47.06%E2%80%AFAM.png" width="288" alt="Gate 2 — email copy">

Two subject lines are presented for A/B testing — the skill applies the retrospective learning directly:

| | Subject |
|---|---|
| **Subject A** *(benefit-led)* | Your cellar will thank you: 18% off Bordeaux, Cab & Syrah |
| **Subject B** *(curiosity-led — mirrors the retro winner)* | We have too much Bordeaux. That's your gain. |

The email body is written in the curiosity-first voice: *"Here's what happened: we overshot on winter reds. We're heading into spring with more Bordeaux, Cabernet, and Syrah than we need. The sensible thing to do is pass the savings directly to you — before the weather warms up and everyone wants rosé."* Each of the four SKUs gets a tasting note and price callout.

---

### Gate 2 — Paid Copy

<img src="Screenshot%202026-03-15%20at%202.47.20%E2%80%AFAM.png" width="288" alt="Gate 2 — paid copy">

Google Shopping and Meta assets are generated using the same voice — direct, self-aware, urgency without hype:

- **Meta Primary Text:** *"We have too much Bordeaux — and that's your problem to solve. 18% off premium reds through March 30."*
- **Google Shopping Title:** Spring Clearance: Bordeaux Blend & Cab Sauv 2018 — 18% Off
- Three Google headlines + two descriptions covering the offer, the SKUs, and the end date

---

### Gate 2 — Social Copy

<img src="Screenshot%202026-03-15%20at%202.47.40%E2%80%AFAM.png" width="288" alt="Gate 2 — social copy">

Four platform-native posts generated:

- **Instagram (story-driven):** Transparent, conversational — *"Spring is almost here, which means our cellar has more Bordeaux, Cabernet Sauvignon, and Syrah than we need right now."* Tasting notes per bottle, link in bio CTA, full hashtag set.
- **Facebook:** Short and direct — overshoot acknowledged, four bottles called out by price, link in bio.
- **Pinterest:** Discovery-focused — varietal and food pairing angle, price callouts, charcuterie board mention.
- **TikTok Hook (first 3 seconds):** *"We have way too much Bordeaux right now. That's your problem to solve. 18% off..."*

---

### Gate 2 — Actions

<img src="Screenshot%202026-03-15%20at%202.47.57%E2%80%AFAM.png" width="288" alt="Gate 2 approval actions">

The skill presents per-channel approval options:

```
approve camp-101 email     — approve all email assets
approve camp-101 paid      — approve all paid assets
approve camp-101 social    — approve all social assets
approve camp-101 all       — approve all channels at once
edit camp-101 [channel] [asset]: [instruction]   — request a revision
reject camp-101 [channel]  — exclude a channel
```

---

### All Channels Approved

<img src="Screenshot%202026-03-15%20at%202.49.04%E2%80%AFAM.png" width="288" alt="All three channels approved">

> *"approve all"*

All three Gate 2 approval records are written simultaneously:

| Channel | Status | Approval Record |
|---|---|---|
| Email | Approved | appr-1773560897904 |
| Paid | Approved | appr-1773560898962 |
| Social | Approved | appr-1773560900010 |

**camp-101 is fully cleared for execution.** The copy package is saved to `camp-101-copy.md`. The three execution skills — `/send-emails`, `/manage-ads`, `/publish-social` — are ready to run in any order.

---

## Step 3 — `/send-emails`: Launching to 454 Inboxes

<img src="Screenshot%202026-03-15%20at%202.54.17%E2%80%AFAM.png" width="288" alt="/send-emails run log">

`/send-emails` confirms Gate 1 and Gate 2 email approvals via MCP, then resolves all three target segments simultaneously. Deduplication across Cart Abandoners, Price-Sensitive Buyers, and Bordeaux Loyalists collapses 487 addresses to **473 unique customers**. After 19 suppressions (global unsubscribe + 3-day fatigue guard), **454 emails are delivered**.

The send fires with a 50/50 A/B split — Subject A (benefit-led) vs Subject B (curiosity-led, the retrospective winner). The skill then checks the behavioral trigger queue: 50 cart abandoners and 50 browse abandoners are waiting. It prioritises by CLV, gives cart_abandon precedence for the 4 customers who appear in both lists, and fires 10 cart abandonment triggers with 45-minute delays and 5 browse abandon triggers for top-CLV repeated-PDP viewers.

---

### Email & Lifecycle Run Summary

<img src="Screenshot%202026-03-15%20at%202.54.31%E2%80%AFAM.png" width="288" alt="Send summary">

```
Email & Lifecycle Run — 2026-03-15T07:50Z
Campaign: camp-101 — Spring Clearance
Send ID:  send-10001

Audience:    473 unique customers (487 across 3 segments, 14 deduped)
Suppressed:  19 (global unsubscribe + 3-day fatigue guard)
Delivered:   454
A/B split:   50/50 — Subject A (benefit) vs Subject B (curiosity)

Behavioral triggers fired: 15
  cart_abandon:   10 (top CLV customers — remaining 40 batch-queued by platform)
  browse_abandon:  5 (top CLV repeated-PDP viewers — remaining 41 batch-queued)

Follow-ups: Day-3 non-opener follow-up scheduled for 2026-03-19 — non-converters only
Errors: None
```

The Day-3 non-opener follow-up is locked in for March 19 — the mechanic that drove 34% of email revenue in the retrospective campaign it was modelled on.

---

## Why This Architecture Made It Work

### MCP as a shared memory layer

Every decision in this session — the channel sequence, the subject line test, the Day-3 follow-up — traces back to data that lives in the MCP. The retrospective from camp-001 was stored as a structured record with explicit fields for `best_performing_element`, `ab_test_winner`, and `recommendations_for_next_campaign`. When `/plan-campaign` called `get_campaign_retrospectives(campaign_type: "promotion", limit: 5)`, those learnings came back as data the skill could reason over directly, not as a document to summarise.

That's a meaningful difference. A skill that reads a structured retrospective can apply specific rules: *use curiosity-led subjects, launch paid on day 6, always schedule the Day-3 follow-up*. A skill reading prose would have to re-interpret and might skip or misapply them. The MCP turns past campaign performance into a queryable institutional memory.

The same pattern applies across the whole session. `/generate-content` didn't need to rediscover the target segments or the offer — it called `get_campaign_brief(camp-101)` and got the exact segments, SKUs, discount, and channel split already decided. `/send-emails` didn't need to know campaign logic — it called `get_approval_records(gate: 2)` and confirmed clearance, then called `get_segment_members(seg-004)` to retrieve the actual audience. Each skill does one job and reads exactly what it needs from the MCP. Nothing is passed through conversation context or hardcoded.

### The data model surfaced opportunities a human would have missed

The proactive scan found three distinct opportunities from a single prompt because the data model was built to support that kind of cross-domain reasoning. The `days_of_supply` field on every SKU made overstock immediately detectable. The `churn_risk_score` on every customer made the winback pool queryable in one call. The `upsell_propensity` and `varietal_affinities` fields on customer records made the bundle segment obvious. None of this required manual analysis — the fields existed, the skill queried them, and the opportunities surfaced automatically.

The Q1 diagnosis — *"email ROAS is 192×, paid is 6.4×, the problem is volume not spend efficiency"* — came from `get_campaign_performance_summary()` returning structured channel-level ROAS data. A human looking at a dashboard might reach the same conclusion eventually. The skill reached it in a single MCP call, before drafting a single brief.

### Approval gates kept humans in control without creating friction

Gate 1 and Gate 2 were the only moments requiring human input across the entire session — two decisions, one line each. Everything else was autonomous. That ratio matters: the gates were placed at the two decisions where human judgment genuinely adds value (which campaigns to run, whether the copy is on-brand), not at every step.

The gate design also made the approval fast. Each Gate 1 brief included a structured `Rationale` section — inventory trigger, retrospective match, segment fit — so the human had the context to make a confident decision without reading the underlying data. Approving all content at once with `approve all` instead of channel by channel was a deliberate option in Gate 2 for sessions where trust in the output is high.

Critically, the approval records are stored in MCP — not in a file, not in conversation context. When `/send-emails` ran, it confirmed Gate 2 email approval with `get_approval_records(campaign_id: "camp-101", gate: 2)` before doing anything. The gate is enforced at execution time by the skill itself, not by the operator remembering to check. That's what makes the system safe to run autonomously at scale.

### Skills are narrow by design

Each skill in this session had a tightly scoped job. `/plan-campaign` creates briefs and owns Gate 1. It doesn't write copy. `/generate-content` writes copy and owns Gate 2. It doesn't send emails. `/send-emails` executes the send. It doesn't touch the campaign brief.

That narrowness is what made parallelism possible throughout. `/plan-campaign` drafted all three briefs concurrently because they were independent. `/generate-content` pulled SKU details for all four wines simultaneously. `/send-emails` resolved all three segments in parallel before deduplicating. None of this required coordination between steps — each call to the MCP was independent, and the results composed naturally.

The boundary between skills is also what makes the system auditable. The full trail — request raised, brief created, Gate 1 approved, content generated, Gate 2 approved, send executed — is a sequence of MCP writes. `/trace-campaign` can reconstruct the entire decision history from those records after the fact, without relying on logs or conversation history.

---

## What This Illustrates

- **Proactive opportunity scanning** — a vague goal ("grow Q1 sales") is enough to trigger a full scan; the skill surfaces the opportunities rather than waiting for a queue item
- **Retrospective-driven execution** — channel sequence, A/B subject line choice, Day-3 follow-up, and even the creative voice all trace back to a single prior campaign (camp-001, Feb 2026)
- **Three briefs, one session** — `/plan-campaign` surfaces and presents multiple opportunities simultaneously; the human picks which to activate
- **Gate 1 in practice** — approving one and rejecting two is a single line; cancelled campaigns are logged cleanly
- **Gate 2 per channel** — content approval is granular; a human could approve email, reject paid, and request a social revision independently
- **Deduplication and suppression** — 487 segment addresses → 473 unique → 454 delivered; the system handles overlap and fatigue rules without manual intervention
- **Behavioral triggers** — cart and browse abandon triggers fire in the same run as the batch send, prioritised by CLV
- **Skill handoff** — each skill ends by naming the next one; the human doesn't need to know the pipeline sequence
