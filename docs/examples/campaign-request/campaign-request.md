# A Houston Rodeo Campaign

**Skills used:** `/campaign-request`, `/plan-campaign`

The `/campaign-request` skill is the human operator's direct entry point into the marketing system — for moments when you have an idea and want to get it into the queue without writing a brief yourself. This walkthrough shows how a seasonal campaign goes from a half-formed idea to an approved, active campaign brief. It also illustrates something that looks routine but isn't: the system generating hyper-local Houston intelligence that no general-purpose marketing tool would produce without significant manual research.

---

## Step 1 — The Request

<img src="Screenshot 2026-03-15 at 1.05.02%E2%80%AFPM.png" width="449" alt="Entering /campaign-request">

The operator invokes `/campaign-request` with no specific campaign in mind — just an intent to do something for the season. The skill doesn't ask for a brief. It asks what the operator is thinking about.

---

## Local Intelligence

<img src="Screenshot 2026-03-15 at 1.05.21%E2%80%AFPM.png" width="449" alt="Houston-specific campaign angles surfaced by the skill">

Before the operator has named a campaign type, the skill surfaces a list of Houston-specific angles: the Houston Livestock Show and Rodeo, BBQ season pairings, Texas pride hooks, demographic plays around the city's wine culture, and scarcity opportunities tied to local events.

This is the moment that wouldn't scale without AI.

A human marketer running campaigns across multiple cities would need to research each market independently — local events calendar, food culture, seasonal occasions, demographic composition. For Houston alone that's a non-trivial research task. For five cities it's a part-time job. The skill does it in seconds, drawing on its training to produce a market-aware set of angles before the operator has specified a single parameter.

The implication is broader than one campaign: the same `/campaign-request` invocation in Dallas would surface different hooks (State Fair, Cowboys season, Fort Worth Stockyards), in New Orleans different ones again (Jazz Fest, crawfish season, Mardi Gras). City-level personalization at this granularity is only scalable with automation.

---

## Choosing the Campaign

<img src="Screenshot 2026-03-15 at 1.05.32%E2%80%AFPM.png" width="449" alt="Operator picks Wine and Western — Rodeo season">

The operator picks the "Wine & Western" angle for Rodeo season. The skill identifies this as a `seasonal` campaign type and asks the right clarifying questions for that type: which wines to feature, any offer, audience, channels, timing. It doesn't ask about discount codes (not relevant), pre-order mechanics (not relevant), or winback lapse windows (not relevant). The question set is shaped by type.

---

## Confirmation

<img src="Screenshot 2026-03-15 at 1.06.01%E2%80%AFPM.png" width="449" alt="Confirmation summary — SKUs, offer, audience, channels">

The skill presents a structured summary before writing anything to the queue:

- **SKUs:** Three Texas-appropriate reds — Domaine Mayo Syrah 2020 ($58), Domaine Gonzalez Cabernet Sauvignon 2021 ($100), Tenuta Rhodes Cabernet Sauvignon 2019 ($185). The range anchors the offer at approachable, mid-tier, and premium price points with food pairings already mapped to BBQ and grilled meats.
- **Offer:** Free shipping — no percentage discount. For the high-CLV audience being targeted, a discount would anchor price expectations on wines that sell on quality. Free shipping lowers friction without sending the wrong signal.
- **Audience:** Existing customers — Champions, Bordeaux Loyalists, High CLV Potential.
- **Channels:** Email + social organic. No paid spend.
- **Timing:** Launch immediately through March 28.

<img src="Screenshot 2026-03-15 at 1.06.25%E2%80%AFPM.png" width="449" alt="Confirmation and progress">

The operator reviews the summary. Nothing is written until they confirm.

---

## Queued

<img src="Screenshot 2026-03-15 at 1.06.51%E2%80%AFPM.png" width="449" alt="Campaign request queued — req-1773597775398">

One word: "yes." The skill writes the structured campaign request to the MCP queue — `req-1773597775398`, status `pending` — and confirms it's in the queue for `/plan-campaign` to pick up. The operator didn't write a brief. They described an idea, confirmed a summary, and typed a word.

---

## Gate 1 — Campaign Brief

<img src="Screenshot 2026-03-15 at 1.09.50%E2%80%AFPM.png" width="449" alt="Gate 1 — approve camp-101">

`/plan-campaign` reads the pending request and produces a full campaign brief: `camp-101`, Wine & Western — Houston Rodeo 2026.

The brief targets three segments totalling ~370 customers:

| Segment | Size | Avg CLV | Open Rate |
|---|---|---|---|
| Champions | 71 | $1,609 | 42% |
| Bordeaux Loyalists | 181 | $1,476 | 41% |
| High CLV Potential | 150 | $1,081 | 35% |

Messaging direction: bold, BBQ-friendly Texas reds. Hook: "Big wines for a big Texas tradition." Free shipping framed as a friction reducer, not a discount.

One detail worth noting: the brief cites a retrospective learning applied automatically — email delivered 3.6× ROAS in Holiday 2024, so the channel mix leads with email and keeps paid at zero. The operator didn't instruct this. `/plan-campaign` pulled the retrospective record and applied it.

The operator types `approve camp-101`. Status sets to ACTIVE. Brief saved to outputs. Campaign enters the execution pipeline.

---

## What This Illustrates

- **Localization at scale** — the system generated Houston-specific event, cultural, and demographic hooks without any market briefing. The same skill in a different city produces different hooks. This is not achievable at scale through manual research.
- **Idea to queue without writing a brief** — the operator's input was a vague seasonal interest, a campaign angle selection, and one confirmation. `/plan-campaign` produced the brief.
- **Question sets shaped by campaign type** — seasonal questions differ from winback questions differ from limited allocation questions. The skill doesn't ask everything; it asks what the type requires.
- **Retrospective learning applied automatically** — the email ROAS finding from Holiday 2024 was in the MCP; `/plan-campaign` used it to justify the channel mix without being told to.
- **Gate 1 as a one-word decision** — `approve camp-101`. The operator reviews a complete brief and makes a binary call. No writing, no formatting, no channel instructions.

---

## Why This Architecture Made It Work

### The campaign type taxonomy is the interface

`/campaign-request` maps every request to one of eight campaign types — `seasonal`, `new_arrival`, `promotion`, `winback`, `limited_allocation`, `educational`, `bundle`, `pre_order` — and routes clarifying questions accordingly. This is what keeps the conversation focused. A `seasonal` campaign needs occasion, SKUs, and timing. A `winback` campaign needs lapse window and re-engagement offer. The operator isn't filling in a form; they're having a typed conversation with a system that knows which questions matter.

### The queue is the handoff

`/campaign-request` writes one structured object to the MCP queue. `/plan-campaign` reads that object and builds the brief. The two skills never need to run in the same session — the queue is persistent, the schema is typed, and the handoff is clean. The operator can submit a request in the evening and find the brief waiting on Monday morning's scheduled run, or invoke `/plan-campaign` immediately to get it now.

### Free shipping vs. discount is a data-informed decision

The choice to use free shipping rather than a percentage discount wasn't the operator's instruction — it was the skill's default for high-CLV seasonal audiences, grounded in the principle that discounting anchors price expectations on premium products. The retrospective record confirming email as the highest-ROAS channel reinforced the $0 paid spend decision. The brief is shaped by what the system knows about this customer base, not just by what the operator asked for.
