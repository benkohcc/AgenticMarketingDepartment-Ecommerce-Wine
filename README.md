# Agentic Marketing Department — Wine E-Commerce

![Wine Store](docs/wine-store.png)

## The Concept

Most AI in marketing gets bolted on. An AI writing assistant here, an AI analytics layer there — each one slotted into an existing process designed for humans. This project takes a different starting point: **what if we threw away existing marketing practices entirely and asked AI to design the function from scratch?**

The question driving every decision was: what does a marketing department actually need to do, and what would it look like if AI designed it with no legacy constraints? The premise was that there is no human marketing team — AI replaces it entirely. AI was asked what capabilities it would need to run a marketing operation end to end — from detecting overstock in a warehouse to writing campaign copy, launching ads, personalising recommendations, and writing retrospectives. Critically, everything designed here — the MCP functions, the data schemas, the skill prompts — is an interface for AI to consume, not for humans. Then those answers became the spec.

The result is 13 AI skills running the full marketing lifecycle for a wine e-commerce store: strategy, content, email, paid media, social, SEO, personalisation, analytics, and customer intelligence. Each skill is autonomous, runs on a schedule or on demand, and interacts with everything else through a shared data layer rather than direct communication. A human operator maintains a small number of approval gates — the places where judgment matters most — but owns no day-to-day marketing execution.

---

## The Architectural Bet: MCP as a Vertical Standard

The more interesting idea this project is exploring is whether the **MCP (Model Context Protocol) server** could become a *standardized interface* for marketing AI in a given vertical.

Right now, when you add AI to a marketing stack, the AI and the tooling are coupled together. Every deployment is bespoke. This project hypothesises that there's a better structure: define a canonical MCP schema for what a marketing AI in wine e-commerce needs — the data it reads, the tools it calls, the domains it writes to — and then let both sides of that interface be optimized independently.

That separation enables two things that aren't available when AI and tools are tightly coupled:

**1. AI optimized for the vertical.** A model or skill set that's been trained and tuned specifically for wine e-commerce marketing can trust that the MCP contract is stable. It doesn't need to hedge for tool inconsistency. It can be deeply specialized — knowing the right suppression rules for a seasonal campaign, the right tone for a collector persona, the right KPIs for a winback — and apply that knowledge reliably.

**2. Independent optimization of the data and tools layer.** The MCP abstraction means the underlying implementation can change — better data quality, faster queries, richer behavioral signals, a different ESP — without touching the AI. The interface remains the same. The two sides can improve at different rates and for different reasons.

This repo is the concrete implementation of that idea: 14 skills, a 7-domain MCP server with 84 typed functions, and synthetic seed data to run the full system.

---

## Skills in Action

Walkthroughs showing each skill running end-to-end — the prompt, the MCP calls, the Gate decisions, and the output files.

- [Spring Clearance — Bordeaux, Cab & Syrah](docs/examples/clearance-campaign/clearance-campaign.md) — `/plan-campaign` → `/generate-content` → `/send-emails`
- [Campaign Trace & Retrospective — Bordeaux Spring Clearance](docs/examples/trace-campaign/trace-campaign.md) — `/trace-campaign` + `/performance-report`
- [Customer Insights — Segment Analysis](docs/examples/insights/insights.md) — `/analyze-segments`

---

## The MCP Functions

84 typed functions across 7 domains. Listed below by marketing purpose, with the wine-specific rationale for why each group exists.

**Catalog & Inventory Intelligence**

Wine has unusual inventory dynamics: vintages sell out permanently, overstock at a fixed price point ties up cash, and a single high-intent SKU can convert 30%+ of viewers to cart. These tools expose the signals the AI needs to detect all three conditions and act on them without waiting for a human to notice.

- `get_product_catalog` — full catalog with pricing, margin, stock, and behavioral metrics
- `get_inventory_status` — real-time stock levels and days-of-supply per SKU
- `get_overstock_skus` — SKUs exceeding a days-of-supply threshold, with optional behavioral interest bundled
- `get_high_intent_low_stock_skus` — high browse-intent SKUs with depleting stock — limited allocation candidates
- `update_product_metadata` — update tasting notes, SEO description, and pairing suggestions
- `watch_inventory_alerts` — webhook subscription for stock status changes

---

**Customer Intelligence & Segmentation**

Wine buyers segment sharply by persona. An Explorer choosing by region responds to completely different copy than a Collector choosing by producer or a Gifter choosing by occasion. These tools give the AI the RFM scores, CLV estimates, churn risk signals, and varietal affinity data it needs to target the right person with the right message — and suppress the wrong one.

- `get_customer_segments` — all defined segments with membership counts, avg CLV, and rules
- `get_customers_in_segment` — paginated customer list for a segment with CLV and propensity fields
- `get_customer_profile` — full 360° profile: purchase history, email engagement, affinities, segment memberships
- `get_rfm_scores` — Recency / Frequency / Monetary scores (1–5 scale) with segment label
- `get_clv_estimates` — 12-month and lifetime CLV projections at customer or segment level
- `get_churn_risk_list` — customers ranked by churn probability with recommended action
- `get_product_affinity` — top SKU affinities for a customer based on purchase and browse history
- `get_high_intent_customers` — customers showing a specific behavioral signal in a rolling window
- `create_segment` — define a new dynamic segment from a rule set
- `add_to_suppression_list` — suppress a customer globally or for a specific campaign
- `remove_from_suppression_list` — lift a suppression record
- `is_suppressed` — check suppression status before any send

---

**Campaign Strategy & Content**

The full lifecycle from brief to copy to human approval. Brand guidelines, seasonal calendar, persona definitions, and campaign type defaults are all MCP-accessible so every campaign starts from a consistent foundation. Retrospectives close the loop: the AI reads past campaign learnings before writing the next brief.

- `get_campaign_briefs` — briefs filtered by status, type, or channel
- `create_campaign_brief` — create a new brief in DRAFT status
- `update_campaign_brief` — update fields before or during a campaign
- `update_campaign_status` — state transitions; DRAFT→ACTIVE requires human `approved_by`
- `get_content_assets` — copy assets for a campaign, filtered by channel or status
- `publish_content_asset` — store a generated content asset pending review
- `approve_content_asset` — mark an asset approved for downstream execution
- `get_content_approval_queue` — assets currently awaiting human review
- `get_creative_assets` — approved image/video assets for a campaign
- `upload_creative_asset` — ingest a creative asset URL
- `get_brand_guidelines` — voice, tone, style rules, and prohibited patterns
- `get_seasonal_calendar` — key wine marketing windows with recommended campaign types and lead times
- `get_personas` — all 5 persona definitions with tone guidance and campaign type fit
- `get_campaign_type_defaults` — default channels, budgets, KPIs, cadence, and suppression rules per campaign type
- `get_suppression_rules` — fatigue guard, post-purchase suppression, winback cooldown, and per-type overrides
- `create_campaign_request` — write an inter-skill alert (inventory, segment insight, behavioral signal) to the queue
- `get_campaign_requests` — read pending requests from the inter-skill queue, filtered by status
- `update_campaign_request` — mark a request as processed or rejected after plan-campaign acts on it
- `create_approval_record` — record a human gate decision (Gate 1–4) so downstream skills can proceed
- `get_approval_records` — check approval status for a campaign before executing a channel
- `create_campaign_retrospective` — store post-campaign metrics and learnings
- `get_campaign_retrospective` — retrieve retrospectives for planning the next campaign

---

**Channel Execution**

The write-side of execution: sending emails, publishing posts, launching paid campaigns. Pause and cancel tools are equally important — when a SKU sells out mid-campaign, the AI can stop all ads and suppress further sends immediately, without waiting for human intervention.

- `send_email_campaign` — bulk send with A/B subject line splitting
- `trigger_behavioral_email` — single transactional send (cart abandon, winback, browse abandon)
- `get_email_metrics` — open rate, CTR, conversion, and revenue attributed per send
- `publish_social_post` — schedule or immediately publish to Instagram, Facebook, or Pinterest
- `get_social_metrics` — engagement metrics by platform and campaign
- `create_paid_campaign` — launch a paid campaign on Google, Meta, or Pinterest
- `sync_product_feed_to_ad_platforms` — push current catalog prices and availability to ad platforms
- `create_behavioral_audience` — push a customer segment to an ad platform as a custom audience
- `get_paid_metrics` — ROAS, CPA, CTR, and spend by campaign or platform
- `pause_ads_for_sku` — halt all active ads featuring a specific SKU (typically: out of stock)
- `pause_campaign_channel` — pause one channel in a campaign without affecting others
- `cancel_email_send` — cancel a scheduled send before it fires

---

**Analytics & Attribution**

Cross-channel attribution is the hard problem in wine marketing: a customer reads an email, clicks a social post two days later, and converts via paid search. These tools support multiple attribution models and cohort retention analysis — so the AI can tell whether last month's winback campaign actually brought customers back for a second purchase.

- `get_performance_summary` — cross-channel revenue, orders, and ROAS snapshot
- `get_attribution_report` — revenue attribution by model (first touch, last touch, linear, time decay)
- `get_conversion_funnel` — step-by-step funnel with drop-off rates by device or traffic source
- `detect_anomalies` — flag metric anomalies within a lookback window, scoped to campaign or segment
- `get_product_performance` — SKU-level revenue, units, margin, and behavioral metrics
- `get_cohort_retention` — customer retention by acquisition cohort and channel
- `get_content_conversion_attribution` — what blog and editorial content drove PDP visits and purchases

---

**Personalization & Merchandising**

Recommendation scores and campaign boosts ensure that what's being promoted in email also surfaces prominently on the homepage and collection pages. Wine has particularly strong co-purchase patterns — Burgundy buyers buying Champagne for gifting, natural wine explorers crossing into pét-nat — making `get_frequently_bought_together` a meaningful signal for bundle and cross-sell campaigns.

- `get_recommendations` — real-time personalized SKU recommendations for a customer in a given context
- `get_segment_recommendations` — top SKUs for a segment (for batch email personalization)
- `get_trending_products` — products with accelerating velocity by views, purchases, or cart adds
- `get_frequently_bought_together` — co-purchase pairs with lift scores
- `get_collection_page_sort_order` — personalized sort order respecting merchandising rules and campaign boosts
- `set_campaign_boost` — elevate featured SKUs in recommendations during a campaign flight
- `remove_campaign_boost` — remove boost on campaign completion or pause
- `log_recommendation_feedback` — record customer interactions with recommendations

---

**Behavioral Events & On-Site Intelligence**

The real-time signal layer. Search queries reveal demand gaps — customers searching for a varietal you don't carry, or a region you carry but haven't promoted. `get_demand_gap_report` is purpose-built to turn zero-result and low-result search data into campaign and content briefs. A/B tests run at the skill level, with statistical significance gating before any variant is promoted.

- `log_session_event` — record a behavioral event from the site tracking SDK
- `get_session_summary` — session events with derived intent signals
- `get_customer_session_history` — chronological session history for a customer
- `get_search_query_report` — top queries, zero-result queries, and search-to-purchase rate
- `get_demand_gap_report` — queries with no or few results — catalog and content gap signals
- `get_funnel_drop_off_report` — step-by-step drop-off by device or traffic source
- `get_page_engagement_metrics` — scroll depth, dwell time, and bounce rate by page type
- `get_sku_behavioral_metrics` — pdp views, view-to-cart rate, and repeat viewer count per SKU
- `create_ab_test` — define a new A/B test for a page element or campaign variant
- `get_ab_test_results` — results with statistical significance and lift data
- `list_ab_tests` — all tests filtered by status, page type, campaign, or SKU
- `update_merchandising_rules` — pin, boost, bury, or exclude SKUs in a collection
- `get_merchandising_rules` — active rules for a collection
- `trigger_onsite_intervention` — fire a UI intervention for a session (exit intent, low-stock urgency, cross-sell)
- `watch_behavioral_triggers` — webhook subscription for behavioral patterns (cart abandon, exit intent)

---

## The Data Model

The MCP server is backed by synthetic seed data across 27 JSON files in `mcp-server/data/`. The core entities:

- **120 products** — each with `varietal`, `varietal_family`, `region`, `vintage`, `price_tier`, `margin_pct`, `stock_units`, `days_of_supply`, `velocity_units_per_day`, `pdp_views_7d`, `view_to_cart_rate`, and `cart_to_purchase_rate`. Stock depletion signals (`days_of_supply`, `velocity_units_per_day`) are first-class fields, not computed at query time.

- **1,000 customers** — each with `persona` (Explorer / Gifter / Loyalist / DealSeeker / Collector), pre-computed `rfm` scores (R/F/M on a 1–5 scale), `clv_12m`, `clv_lifetime`, `churn_risk_score`, `varietal_affinities` (varietal → affinity score pairs), `upsell_propensity`, `preferred_varietal`, and `preferred_region`. A human analyst would derive most of these manually and keep them in a spreadsheet. Here they're first-class, queryable, available to every skill.

- **12 segments** — named behaviorally: Bordeaux Loyalists, Natural Wine Explorers, Holiday Gifters, Cart Abandoners, Champions, Lapsed Loyalists, High-Intent Browsers, Price-Sensitive Buyers, New Customers, High CLV Potential, Pre-Order Eligible, Churn Risk. Each segment carries pre-computed `avg_clv` and `avg_open_rate`.

- **500 sessions** — each with `intent_score`, `funnel_stage_reached`, `sku_ids_engaged`, `search_queries_used`, and a nested `events` array. Intent scoring is applied at session creation time, not derived at query time.

- **Reference data** — 5 persona definitions with tone guidance and campaign type fit; 8 campaign type defaults with channel mix, budget range, KPIs, and suppression rules per type; suppression rule logic encoding the fatigue guard, post-purchase windows, and winback cooldowns.

The AI-specific fields — `churn_risk_score`, `varietal_affinities`, `intent_score`, `upsell_propensity`, `days_of_supply`, campaign type defaults with suppression baked in — are the design signal. A standard marketing database has order history, email sends, and a product catalog. This one is pre-computed for decision-making: the AI reads signals and acts on them, rather than deriving them.

---

## Repository Layout

```
.
├── cowork-plugin/                  # The installable Cowork plugin
│   ├── .claude-plugin/
│   │   └── plugin.json             # Plugin manifest
│   ├── .mcp.json                   # MCP connector URL (auto-updated by start-mcp.sh)
│   └── skills/                     # 14 skill directories, each with a SKILL.md
│       ├── plan-campaign/
│       ├── generate-content/
│       └── ...
├── mcp-server/                     # Node.js/TypeScript MCP server
│   ├── src/                        # Server source
│   ├── dist/                       # Compiled output (after npm run build)
│   ├── data/                       # Seeded data (customers, products, segments)
│   └── package.json
├── wine-marketing-plugin.zip       # Pre-built plugin zip (ready to install)
├── start-mcp.sh                    # Start the MCP server and expose it via Cloudflare tunnel
├── wine-marketing-complete-spec.md # Full system specification (MCP functions, skill logic, schemas)
└── wine-marketing-sample-data-plan.md
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Claude Desktop** (paid plan) | macOS or Windows. Cowork must be enabled. |
| **Node.js** v18+ | For running the MCP server |
| **cloudflared** | Exposes the local MCP server to Cowork via a public HTTPS URL. Install: `brew install cloudflared` |
| **mkcert** | Used to generate the local HTTPS certificate the server uses. Install: `brew install mkcert` |

The `mcp-server/` directory already contains a pre-generated cert pair (`localhost+1.pem` / `localhost+1-key.pem`). If these expire or you need to regenerate them: `mkcert localhost 127.0.0.1` inside `mcp-server/`.

---

## Getting Started

**1. Build the MCP server**

```bash
cd mcp-server
npm install
npm run build
```

**2. Start the server and tunnel**

```bash
cd ..
./start-mcp.sh
```

This starts the MCP server on port 3101, opens a Cloudflare tunnel, writes the tunnel URL into `cowork-plugin/.mcp.json`, and rebuilds `wine-marketing-plugin.zip`. Keep the terminal open while using Cowork.

**3. Install the plugin**

In Claude Desktop → Cowork, install `wine-marketing-plugin.zip` and add the MCP connector URL printed by `start-mcp.sh`.

> **Note:** `cowork-plugin/.mcp.json` is gitignored — it contains a session-specific tunnel URL that changes on every run. `start-mcp.sh` writes it automatically. See [`cowork-plugin/.mcp.json.example`](cowork-plugin/.mcp.json.example) for the format.

---

## Working Folder

Create a local working folder anywhere on your machine. This is where all skills read and write files. Configure it in Claude Desktop → Cowork → Project Settings.

```
<your-working-folder>/
├── outputs/
│   ├── campaigns/                  # Campaign briefs
│   ├── content/                    # Generated copy packages
│   ├── reports/                    # Performance dashboards
│   ├── retrospectives/             # Post-campaign retrospectives
│   └── traces/                     # Campaign audit traces
├── context/
│   └── active-campaigns.json       # Live campaign state (read by all execution skills)
└── logs/                           # Per-skill execution logs (one file per skill per day)
```

Campaign request queues and approval gate records are managed via MCP (`create_campaign_request`, `get_campaign_requests`, `create_approval_record`, `get_approval_records`) — no local queue files required.

Initialise before first run:

```bash
echo "[]" > context/active-campaigns.json
```

---

## How to Run

### 1. Build the MCP server

```bash
cd mcp-server
npm install
npm run build
```

### 2. Start the MCP server and tunnel

```bash
# From the project root
./start-mcp.sh
```

This script:
- Starts the MCP server on port 3101 (HTTPS)
- Opens a Cloudflare tunnel and captures the public URL
- Updates `cowork-plugin/.mcp.json` with the live tunnel URL
- Rebuilds `wine-marketing-plugin.zip`

Keep this terminal open. The tunnel URL changes every time you restart the script.

### 3. Install the plugin in Claude Desktop

1. Open Claude Desktop → Cowork tab
2. Click **Customize** in the left sidebar
3. Select **Browse plugins**
4. Click **Upload custom plugin files** → select the `cowork-plugin/` folder, or upload `wine-marketing-plugin.zip`
5. Reinstall after every `./start-mcp.sh` restart (the MCP URL changes)

### 4. Invoke skills

All 14 skills are now available in Cowork. You can:
- **Invoke manually:** type `/plan-campaign`, `/check-inventory`, `/inspect-customer cust-0042`, etc.
- **Let scheduled runs fire:** skills with cron schedules run automatically at their configured times
- **Request ad hoc campaigns:** use `/campaign-request` to describe what you want in plain language

---

## Skill Workflow

![Skill Workflow](docs/Skill-Workflow.png)

---

## The 14 Skills

| Skill | Schedule | Description |
|---|---|---|
| `/campaign-request` | On demand | Human entry point — translates plain-language campaign requests into structured queue entries |
| `/plan-campaign` | Mon 09:00 + on demand | Reads inventory alerts and campaign requests, creates campaign briefs, owns Gate 1 approval |
| `/generate-content` | After Gate 1 | Writes all copy assets (email, paid, social) for approved briefs, owns Gate 2 approval |
| `/send-emails` | Daily 10:00 | Sends campaign emails, manages suppression lists, handles day-3 follow-ups |
| `/manage-ads` | Daily 09:30 | Launches and monitors Google Shopping and Meta campaigns, participates in Gate 3 |
| `/publish-social` | Daily 09:30 | Publishes to Instagram, Facebook, and Pinterest, participates in Gate 3 |
| `/performance-report` | Daily 18:00 | Reports campaign KPIs, detects anomalies, writes retrospectives, marks campaigns complete |
| `/check-inventory` | Every 4 hours | Scans stock levels, raises overstock/stockout/high-intent alerts to the queue |
| `/analyze-segments` | Mon 05:00 | Refreshes RFM scores, CLV estimates, churn risk, and segment membership |
| `/update-personalization` | Daily 06:00 | Refreshes recommendation scores, applies campaign boosts, owns Gate 4 (A/B test winners) |
| `/review-behavior` | Daily 07:00 | Monitors funnel health, manages A/B tests, updates merchandising rules, flags demand gaps |
| `/seo-audit` | Mon 08:00 | Audits organic search demand gaps, creates SEO content briefs |
| `/trace-campaign` | On demand | Produces a full narrative audit document for a given campaign ID |
| `/inspect-customer` | On demand | Produces a 360° customer brief with RFM, CLV, affinity, session history, and next-best-action |

---

## Human Approval Gates

The system will pause and ask for your sign-off at five points:

1. **Gate 1 — Campaign Brief** (`/plan-campaign`): Approve the campaign strategy, target segment, channels, and budget before any content is created
2. **Gate 2 — Content Assets** (`/generate-content`): Approve or request revisions to email copy, ad copy, and social captions before anything is sent or published
3. **Gate 3 — Creative Upload** (`/manage-ads`, `/publish-social`): Approve custom creative before it goes live on paid or social channels
4. **Gate 4 — A/B Test Winner** (`/update-personalization`): Approve promoting a winning A/B test variant to 100% of traffic
5. **Campaign Activation** (any skill): No skill may call `update_campaign_status("active")` without explicit confirmation in the current session

---

## Full Documentation

See [`wine-marketing-complete-spec.md`](wine-marketing-complete-spec.md) for the complete system specification: all 53 MCP functions across 7 domains, full skill decision logic, JSON schemas, the inter-skill communication model, and the external services architecture.
