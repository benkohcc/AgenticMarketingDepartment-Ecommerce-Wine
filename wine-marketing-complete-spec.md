# Wine E-Commerce Agentic Marketing Department
*A complete specification for an autonomous AI marketing fleet built on Claude Cowork and a unified MCP server*

---

## Introduction

### What This Is

This document specifies a fully agentic marketing department for a wine e-commerce store, built to run on **Claude Cowork** — Anthropic's desktop agentic execution environment. Rather than a team of human marketers supported by software tools, this system is a fleet of 13 autonomous AI commands that collectively own the full marketing lifecycle: from detecting an overstock opportunity in the warehouse, to writing the campaign copy, launching the ads, personalizing the on-site experience, monitoring performance in real time, and storing the retrospective for the next campaign to learn from.

Each command runs as a **Cowork task** — a named, prompt-driven task that Claude executes on a schedule or on demand. Commands share a single **MCP (Model Context Protocol) server** as their common data layer and integration bus. Everything the commands read, write, or act on passes through the MCP. The human operator maintains five explicit approval gates where Cowork surfaces a plan and waits for sign-off before proceeding.

This is a single, self-contained specification. It covers the command roles, their inputs and outputs, the Cowork task configuration for each, the folder structure and inter-command communication model, the external services that Cowork cannot replace, the human-in-the-loop workflow, and the full MCP server function reference. A person or AI agent reading this document should be able to implement the system without reference to any other document.

### Why Wine E-Commerce

The wine e-commerce context drives several specific design choices worth understanding upfront.

**Inventory is time-sensitive.** A Bordeaux at peak drinking window today is a missed sale in six months. The commands need to detect sell-through risk and launch promotions faster than any weekly planning cycle allows. The `/check-inventory` command runs every four hours precisely because of this.

**The product catalog is rich and complex.** Varietal, region, vintage, winemaker, tasting profile, food pairing, and occasion all affect which customer a wine is right for. Matching the right wine to the right customer at the right moment requires continuous personalization that does not scale with a human team.

**Customer education drives conversion.** Wine buyers often need context — region guides, food pairings, drinking windows — before they purchase. Content production needs to be high-volume, SEO-aware, and tightly coupled to what customers are actually searching for on-site and externally.

**Seasonality is extreme.** Valentine's Day, harvest season, holiday gifting, and Beaujolais Nouveau release create sharp demand spikes that require campaigns to be planned, launched, and wound down on precise timelines.

### Why Claude Cowork

Cowork is the right execution environment for this system at the stage most wine e-commerce businesses are at. It provides agentic task execution, MCP connector support, parallel workstream coordination, a built-in plan-and-confirm approval model, and scheduled task execution — all without requiring engineering infrastructure to deploy and operate.

Cowork runs as a desktop application (macOS or Windows, paid Claude plan required). You grant it access to a local working folder, connect it to the wine marketing MCP server via the connector settings, install the 13 command plugins, and schedule their runs. Cowork handles the rest: it reads prompt templates, calls MCP functions, writes outputs to your local files, and surfaces approval decisions to you in plain language before taking action.

The trade-off relative to a fully distributed multi-agent system is deliberate. Cowork does not support persistent background webhook listeners or sub-minute event response. Two lightweight external services — described in Part 4 — handle the pieces that require always-on server processes: behavioral event ingestion from the website SDK, and real-time cart-abandon triggers. Everything else runs within Cowork.

### Why a Single MCP Server

All 13 commands connect to a single MCP server rather than each maintaining their own database connections or API integrations. The MCP server is the most important architectural element in this system, and the rationale for centralizing through it is worth stating clearly.

**Single source of truth.** Without a shared data layer, commands maintain their own copies of product data, customer segments, and campaign state — and those copies diverge. The `/send-emails` command might send a campaign for a product the `/check-inventory` command knows is out of stock. The MCP server ensures every command reads the same state.

**Clean inter-command handoffs.** When `/check-inventory` detects an overstock and needs `/plan-campaign` to act, it writes a campaign request to a shared queue file that the `/plan-campaign` task reads at the start of every run. All command-to-command communication is structured and auditable — no command calls another directly.

**Scope enforcement.** Each Cowork task declares which MCP domains it is permitted to use. The `/publish-social` command can read creative assets and publish posts; it cannot access customer profiles or send emails. This declaration is enforced at the prompt level, and for higher security in production can be backed by MCP-side domain-level read/write flags per API key.

**Human-in-the-loop enforcement at the data layer.** The five approval gates in this system are not just suggestions — certain MCP write operations structurally require a human-supplied `approved_by` field. A command cannot transition a campaign brief from draft to active without it.

**Observability.** Every command call to the MCP is a structured, logged event. The full history of what happened in any campaign — which command called what, when, with what parameters — is reconstructable without any additional instrumentation.

**Reduced integration surface.** Without a shared MCP server, each of the 13 commands would need its own integrations to the ESP, ad platforms, product database, CDP, and so on. The MCP absorbs all of those integrations in one place.

The MCP server is organized into **7 capability domains** — Catalog & Inventory, Customer Data & Segmentation, Campaign & Content Management, Channel Execution, Analytics & Attribution, Personalization & Recommendations, and Behavioral Events — and exposes **53 fully typed functions** covering every operation the 13 commands need to run a campaign from detection to retrospective.

---

### Design Principles

Ten principles govern how the commands behave, how data flows, and where humans remain in control:

1. **Single source of truth.** All commands read and write through the MCP server. No direct database connections, no sidecar APIs. If two commands disagree on a fact, the MCP is always right.

2. **Behavior is upstream of everything.** The Behavioral Events domain — capturing every click, scroll, search, and cart event on the website — is the foundational data layer. Personalization, email triggers, paid retargeting audiences, and SEO strategy all derive from this stream. No other domain produces higher-signal data about customer intent.

3. **Schedule-driven with event-aware exceptions.** Cowork commands run on schedules, not persistent webhooks. Two external services handle the genuinely real-time needs (event ingestion and cart-abandon triggers). Everything else tolerates a scheduled polling cadence.

4. **Anonymous-first, identity-resolved later.** Behavioral events are captured with an `anonymous_id` from the first page view. Identity resolution happens at login or purchase, and session history is retroactively merged. All intervention functions accept `anonymous_id` as a first-class identifier.

5. **Campaign-scoped everywhere.** Every channel execution function accepts a `campaign_id` tag. Every analytics query function accepts a `campaign_id` filter. Without this, concurrent campaigns pollute each other's performance data and retrospectives become meaningless.

6. **Skill scope declared in the skill file.** Each Cowork skill file explicitly declares which MCP domains it may read from and write to. Scope is a first-class concern in every skill's configuration, not an afterthought.

7. **Inter-skill tasking via MCP queue.** When one skill needs another to act — `/check-inventory` requesting a campaign, `/seo-audit` requesting a blog post — it calls `create_campaign_request()` on the MCP server. `/plan-campaign` calls `get_campaign_requests(status: "pending")` at the start of each run and calls `update_campaign_request()` after processing each item. Approval gate records (Gate 1–4) are written and read via `create_approval_record()` and `get_approval_records()`. All queue and approval state is managed through MCP, not the local filesystem.

8. **Suppression is explicit, not implied.** Post-purchase suppression uses dedicated MCP functions (`add_to_suppression_list`, `is_suppressed`) rather than segment membership. Campaign-scoped suppression prevents a customer who just bought a Bordeaux from receiving three more emails about it.

9. **Idempotency on all writes.** Every write operation is idempotent by its ID. Retrying a failed task produces the same result rather than a duplicate send or double-logged event.

10. **Human-in-the-loop at the five critical gates.** Campaign brief activation, content asset approval, creative asset approval, A/B test winner promotion, and campaign cancellation all require explicit human confirmation in Cowork before the system proceeds.

---

### Command Workflow

The 13 commands are organized into five tiers plus three human-facing utility commands. Work flows top to bottom through the MCP server. No command calls another directly.

```
HUMAN INITIATION (on-demand only)
  Campaign Request (Command 0)  →  translates plain-language request into queue entry

DETECTION TIER
  /review-behavior   →  behavioral signals, search trends, A/B test management
  /check-inventory   →  stock monitoring, overstock and depletion alerts

        ↓ both call create_campaign_request() via MCP

STRATEGY TIER
  /plan-campaign     →  reads queue + MCP data → creates campaign briefs
                        applies campaign_type defaults and persona targeting
        ↓
        ★ HUMAN GATE 1: approve campaign brief before status → "active"

PRODUCTION TIER  (all read the active brief from MCP)
  /generate-content       →  type-aware copy, product descriptions, creative assets
  /seo-audit              →  keywords, content gap requests
  /analyze-segments       →  segments, CLV, RFM scores
  /update-personalization →  type-aware recommendation boosts, segment recs
        ↓
        ★ HUMAN GATE 2: approve content + creative assets

EXECUTION TIER  (all read approved assets from MCP)
  /send-emails    →  type-aware sends, cadence, suppression
  /manage-ads     →  type-aware paid activation (skips for winback, educational, etc.)
  /publish-social →  type-aware posts and cadence

MEASUREMENT TIER
  /performance-report  →  type-aware KPI dashboards, attribution, retrospectives
        ↓
        writes retrospective back to MCP
        /plan-campaign reads it on the next planning run

Human gates 3–5:
  ★ GATE 3: approve A/B test winner before promoting to production
  ★ GATE 4: confirm any campaign cancellation (human-only action)
  ★ GATE 5: approve creative asset uploads before they become available to commands

OBSERVATION (on-demand, human-initiated)
  /trace-campaign    →  synthesises the full decision chain for any campaign
                        into a single narrative document; runs during or after campaign
  /inspect-customer  →  on-demand 360° customer brief: persona, RFM, CLV, churn risk,
                        session history, product affinity, recommendations, suppression
                        status, and suggested next actions — read-only, no writes
```

---

## Customer Personas

The five personas below are the US market archetypes this system is designed for. They are referenced by name in command task prompts — `/generate-content` uses them to calibrate copy tone and framing, `/plan-campaign` uses them to select target segments, and `/analyze-segments` uses them to discover new micro-segments from behavioral data.

The full persona definitions are stored in the MCP server (`mcp-server/data/personas.json`) and exposed via `get_personas()`. Skills that need persona context call this MCP function at run start rather than reading a flat file. The definitions below are the authoritative source.

---

### Persona 1: The Explorer

**Who they are:** Adults 28–42, urban or suburban, mid-to-high income ($75k–$150k). Buys wine for personal discovery, dinner parties, and impressing people they want to like them. Follows food and travel content. Considers themselves interested in wine but not an expert — and is actively trying to close that gap.

**Purchase behavior:** Buys 1–3 bottles at a time, 6–10 times per year. Average order value $35–75. Attracted to new regions, unusual varietals, and producer stories. Likely to try a wine they've never heard of if the story is compelling.

**What they respond to:** Region storytelling, winemaker profiles, food pairing guidance, "what to try next" framing. Educational content converts well — they want to feel like they learned something. Subject lines that promise knowledge ("The definitive guide to Burgundy's hidden appellations") perform better than offer-led lines.

**Acquisition channels:** Social (Instagram, Pinterest), organic search (recipe + wine pairing queries), email from sign-up after consuming content.

**Campaign type fit:** New arrival (discovery angle), educational (direct fit), seasonal (if occasion-framed with a learning element).

**Segment signal in MCP:** High `pdp_view` count relative to purchase count, frequent `blog_view` events, search queries using varietal and region terms, `filter_applied` events (exploring by region or grape).

---

### Persona 2: The Gifter

**Who they are:** Broad age range (30–65), buys wine as a gift rather than for personal consumption. Does not identify as a wine enthusiast. Shops under time pressure (usually for an upcoming occasion). Values looking like they made a thoughtful, quality choice without having to become an expert.

**Purchase behavior:** Buys 3–6 times per year, strongly concentrated around occasions (Valentine's Day, Mother's Day, Thanksgiving, Christmas, host gifts). Average order value $50–120 — willing to spend more because it's a gift. Often buys single bottles or sets.

**What they respond to:** Occasion framing above all else ("Perfect for Mother's Day"), gift-readiness cues (gift wrapping, presentation), reassurance that this is a safe and impressive choice ("What sommeliers actually give as gifts"), price-to-impressiveness framing. Does not need or want deep wine knowledge in the copy.

**Acquisition channels:** Paid search (high intent around occasions: "wine gift for her", "best wine gift under $75"), social (gift guides, occasion content), email around key dates.

**Campaign type fit:** Seasonal (primary audience for all occasion campaigns), promotion (if offer includes gift packaging), bundle (gift sets).

**Segment signal in MCP:** Purchase history clustering around holidays, low session count between purchases, `search_query` events with gift-related terms, high add-to-cart rate on sessions entering from paid search.

---

### Persona 3: The Loyalist

**Who they are:** Adults 35–60, household income $120k+. Has a clear and settled wine preference — a specific varietal, region, or producer style they return to. Has purchased multiple times and considers this store a trusted source for their preference. Not interested in being educated; interested in getting more of what they already love, and being the first to know when something exceptional is available.

**Purchase behavior:** Buys 4–8 times per year, often in multiples (3–6 bottles per order). Highest average order value ($80–200+). Low price sensitivity within their category of preference. High CLV. Retains well if treated as an insider rather than a prospect.

**What they respond to:** New arrival announcements in their preferred category, limited allocation early access, producer updates ("the 2022 vintage is exceptional — here's why"), direct and knowledgeable copy that respects their expertise. Does not need or want promotional messaging — discounts feel inappropriate and can cheapen the relationship.

**Acquisition channels:** Already a customer. Primarily email. Social only peripherally.

**Campaign type fit:** New arrival (primary audience), limited allocation (primary audience — gets first access), pre-order (primary audience for futures).

**Segment signal in MCP:** High purchase frequency in a specific varietal or region, high CLV, high email open rate, `pdp_view` events concentrated in their preference category, low discount code usage history.

---

### Persona 4: The Deal Seeker

**Who they are:** Price-conscious buyer across all ages. Buys wine when there's a reason to — a promotion, a flash sale, a good deal spotted on a deal aggregator or through a search. Wine quality matters but value matters more. Comparatively lower CLV but high volume conversion on promotional offers.

**Purchase behavior:** Buys primarily during promotions, 2–5 times per year. Average order value $25–55. High cart abandon rate when there's no discount present. Responds quickly to urgency and time-limited offers. Does not engage with educational or storytelling content.

**What they respond to:** Discount percentage prominent in subject line, urgency ("48 hours only"), free shipping thresholds, countdown copy. Offer clarity above all else — do not bury the deal in wine prose.

**Acquisition channels:** Paid search (deal-seeking queries), email (high open rate on promotional sends, low on editorial).

**Campaign type fit:** Promotion (primary audience), seasonal (if offer-included), bundle (if price-framed as saving).

**Segment signal in MCP:** Purchase history correlates with discount code usage, high `search_query` count for price-related terms, low blog engagement, high email open rate on promotional subject lines, low open rate on editorial sends.

**Note for commands:** Do not conflate Deal Seekers with low-value customers. A repeat Deal Seeker who buys 5 times per year during promotions can have meaningful LTV. The system should avoid over-suppressing them post-purchase — they will buy again at the next good offer.

---

### Persona 5: The Collector

**Who they are:** Serious wine enthusiast, typically 40–65, high income ($200k+). Buys wine as an investment in future enjoyment — bottles go into a cellar, not onto the dinner table tonight. Deep knowledge of producers, vintages, and regions. Follows wine press and scores. Relationship with the store is as a trusted source for allocation access and futures, not a place to browse.

**Purchase behavior:** Lower purchase frequency (2–4 times per year) but very high AOV ($200–1000+ per order, often buying a case at a time). Pre-orders and futures are the highest-value transaction type. Long customer lifetime — does not churn easily if treated with appropriate expertise and exclusivity.

**What they respond to:** Vintage quality assessments, producer background, drinking window guidance, early allocation access framed as exclusive. Subject lines that signal insider access ("Your allocation of the 2022 Barolo is ready"). Scores and press mentions resonate. Discounts do not — and can damage the relationship.

**Acquisition channels:** Email (primary), organic search (producer and vintage-specific queries), limited paid (only for very specific high-value keywords).

**Campaign type fit:** Pre-order (primary audience), limited allocation (primary audience), new arrival (for significant releases).

**Segment signal in MCP:** High AOV, low purchase frequency, `pdp_view` events concentrated on high-price SKUs, long session dwell time on PDP tasting notes, `search_query` events using producer and vintage-specific terms, high email open rate, zero discount code history.

---

### Persona Reference Data (`get_personas`)

Persona definitions are stored in the MCP server and loaded at startup from `mcp-server/data/personas.json`. Skills that need persona context call `get_personas()` (optionally filtered by `persona_id`) rather than reading a flat file.

When `/generate-content` reads a campaign brief, it calls `get_personas()` to load all definitions, then maps the target segment to the closest persona archetype to apply copy guidance. `/plan-campaign` calls `get_personas()` to inform segment selection — Loyalists for new arrivals and limited allocations, Gifters for seasonal campaigns, and so on.

`/analyze-segments` uses persona definitions to label new micro-segments with their parent persona archetype in the segment description, so downstream skills know how to communicate with them.

---

## Part 1: Cowork Setup

### Prerequisites

- Claude Desktop (macOS or Windows) with a paid plan (Pro, Max, Team, or Enterprise)
- Cowork mode enabled in the desktop app
- The wine marketing MCP server running and accessible (self-hosted or hosted)
- A dedicated working folder on your local machine (name it whatever you like — e.g. `~/wine-marketing/`)

### Working Folder Structure

Create this structure before running any tasks. All commands read from and write to this folder. The MCP server handles all external integrations.

> **Folder name:** The name of this folder doesn't matter. Commands use relative paths (`queue/`, `logs/`, etc.) which Cowork resolves against whichever folder you configure as the working folder in project settings. Nothing is hardcoded.

> **Command files:** Command prompt files are **not** stored here. They live inside the installed `wine-marketing` plugin (see Plugin Installation below). Install the plugin once and all 13 commands are available across Cowork sessions.

```
<your-working-folder>/
├── outputs/
│   ├── campaigns/                   # Campaign briefs and send records
│   ├── content/                     # Generated copy packages and social calendars
│   ├── reports/                     # Daily, weekly, monthly dashboards
│   ├── retrospectives/              # Post-campaign retrospective documents
│   └── traces/                      # Campaign execution trace documents
├── context/
│   └── active-campaigns.json        # IDs, SKUs, channels, and type of currently active campaigns
│                                    # Schema: [{ campaign_id, campaign_type, sku_ids, channels, start_date, end_date }]
│                                    # Updated by /plan-campaign after each brief activation.
│                                    # /check-inventory, /performance-report, and all execution skills read
│                                    # this to know what campaigns are running, which channels
│                                    # each uses, and what type each is.
└── logs/                            # Per-run execution logs (one file per skill per day)
    ├── check-inventory-[YYYY-MM-DD].md         # Stock scan results, alerts raised, dedup skips
    ├── plan-campaign-[YYYY-MM-DD].md           # Briefs created/rejected, queue items processed
    ├── generate-content-[YYYY-MM-DD].md        # Channels generated/rejected, asset IDs
    ├── send-emails-[YYYY-MM-DD].md             # Sends executed, suppressions, skips
    ├── manage-ads-[YYYY-MM-DD].md              # Ad campaigns launched/monitored, Gate 3 outcomes
    ├── publish-social-[YYYY-MM-DD].md          # Posts published, skips with reason
    ├── update-personalization-[YYYY-MM-DD].md  # Scores refreshed, rules updated, A/B tests
    ├── performance-report-[YYYY-MM-DD].md      # KPIs checked, campaigns closed
    ├── anomaly-alerts-[YYYY-MM-DD].md          # Anomalies flagged (written by /performance-report)
    ├── analyze-segments-[YYYY-MM-DD].md        # Segments refreshed, RFM updates, churn cohorts
    ├── seo-audit-[YYYY-MM-DD].md              # Keywords audited, briefs created, gaps identified
    └── review-behavior-[YYYY-MM-DD].md         # A/B tests evaluated, rules updated, signals flagged
```

### MCP Connector Registration

In Claude Desktop → Settings → Connectors, register the wine marketing MCP server:

```
Connector name:  wine-marketing-mcp
Server URL:      [your MCP server URL or local socket path]
Auth:            Single shared API key
                 (per-command scope is enforced at the prompt level;
                  for production, configure domain-level read/write flags
                  per key at the MCP server layer)
```

### Installing the Plugin in Cowork

In Cowork, the 13 commands are packaged as a single **plugin** that bundles all command definitions and the MCP connector. Install it once and all commands are available in every Cowork session.

**Plugin structure** (in `cowork-plugin/`):
```
cowork-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest (name, version, description)
├── skills/                  # One directory per skill (13 total)
│   ├── check-inventory/
│   │   └── SKILL.md
│   ├── plan-campaign/
│   │   └── SKILL.md
│   └── ...
└── .mcp.json                # Wires up the wine-marketing-mcp connector
```

**To install:**
1. Open Claude Desktop → Cowork tab
2. Click "Customize" in the left sidebar
3. Select "Browse plugins"
4. Click "Upload custom plugin files" and select the `cowork-plugin/` folder (or upload `wine-marketing-plugin.zip`)
5. Once installed, all 13 skills are available in the Cowork interface

**How skills are invoked:**
- Claude automatically delegates to a skill when the task matches its `description` field
- You can also invoke skills manually: type `/plan-campaign`, `/check-inventory`, etc.
- Scheduled skills (`/check-inventory`, `/performance-report`, etc.) run on their configured cron schedule

**Updating skills:** If you edit a `SKILL.md` file, reload with `/reload-plugins` in Cowork or reinstall from the updated folder.

### Global Operating Rules (Per-Skill, Not Global Settings)

> **Note:** Cowork's "Global Instructions" setting (`Settings → Cowork → Global Instructions`) applies to every project in the app — not just wine marketing. Do not use it for project-specific rules.

Instead, each skill file includes a **Global Operating Rules** section in its system prompt. These rules are automatically applied every time a skill runs:

- Always show planned actions before executing writes
- Always call `get_campaign_requests(status: "pending")` at the start of each task run (for skills that consume the queue)
- Always log outputs and key decisions to `logs/` with a timestamp
- Never execute a channel send without confirming the campaign brief status is "active"
- Never call `update_campaign_status()` to "active" without explicit human confirmation

The rules live directly in each `skills/[name]/SKILL.md` file — project-specific, version-controllable, and enforced on every run.

---

## Part 2: Skill Reference, Inputs, and Cowork Task Templates

Each skill is defined by its role, its inputs (with MCP function references), its functions, its outputs, and the skill file that governs its behavior when run. The skill file is stored in `cowork-plugin/skills/[name]/SKILL.md` and installed into Cowork as part of the `wine-marketing` plugin. When a skill runs, Cowork uses this file, connects to the wine-marketing-mcp connector, and executes the run sequence against your working folder.

---

### Skill 0: Campaign Request *(human-facing)*

**Role:** The human entry point for ad hoc campaigns. This is the command you invoke when you want to launch a specific campaign — a new wine arrival, a flash promotion, a seasonal push — rather than waiting for `/plan-campaign` to detect the opportunity autonomously. It takes your plain-language description, asks the right clarifying questions for the stated campaign type, and calls `create_campaign_request()` via MCP. `/plan-campaign` picks it up via `get_campaign_requests(status: 'pending')` on its next run (or you can trigger `/plan-campaign` immediately after).

This skill has no MCP write access and makes no autonomous decisions. Its only job is to translate human intent into a structured request that the rest of the system can act on.

**When to use:**
- You have a new wine arriving and want to announce it
- You want to run a promotion, flash sale, or bundle offer
- You want to target a specific segment with a seasonal message
- You want to re-engage lapsed customers
- You want a content/SEO campaign around a specific varietal or region
- Any time you want a campaign to happen that the system hasn't proposed itself

**Cowork task schedule:** On-demand only. Invoke by opening the Campaign Request task and describing what you want.

**Skill file (`skills/campaign-request/SKILL.md`):**
```
You are the Campaign Request command for a wine e-commerce store. You are the
human operator's direct interface to the marketing system. Your job is to
take a plain-language campaign request, ask the right clarifying questions
for the campaign type, and call `create_campaign_request()` via MCP
that /plan-campaign will act on.

You do not create campaigns yourself. You do not call MCP functions.
You call `create_campaign_request()` via MCP and nothing else.

STEP 1 — IDENTIFY CAMPAIGN TYPE
Listen to the human's request and identify which campaign type it is:

  new_arrival      — "We're getting a new wine in", "I want to announce a new bottle"
  promotion        — "I want to run a sale", "15% off this weekend", "discount campaign"
  limited_allocation — "We only have 30 cases", "exclusive allocation", "first come first served"
  seasonal         — "Valentine's Day", "harvest season", "Thanksgiving", "Christmas"
  winback          — "Re-engage lapsed customers", "people who haven't bought in a while"
  educational      — "Content about Barolo", "region guide", "varietal explainer"
  bundle           — "Buy two get one", "pairing offer", "bundle deal"
  pre_order        — "Wine arriving in 3 months", "futures", "reserve your allocation"

STEP 2 — ASK CLARIFYING QUESTIONS BY TYPE
Once you've identified the type, ask only the questions you need. Do not ask
for information that has a sensible default. Group questions together — do not
ask one question at a time.

  new_arrival:
    - Which wine(s)? (name, varietal, region if known)
    - When does it arrive?
    - Do you want a teaser before arrival, a launch send on arrival day, or both?
    - Any introductory price or offer?
    - Who should receive it? (everyone, Burgundy lovers, high-CLV customers, etc.)
    - Budget and channels? (default: email + social, no paid, ~$300)

  promotion:
    - Which wine(s) or category?
    - Discount amount or type (%, free shipping, BOGO)?
    - Discount code (or should the system generate a suggestion)?
    - How long does the offer run?
    - Who is the target audience?
    - Budget and channels? (default: email + paid + social)

  limited_allocation:
    - Which wine? How many bottles/cases available?
    - Who gets first access? (highest CLV, Burgundy loyalists, everyone?)
    - Is there a price premium, or is scarcity the only mechanism?
    - When do you want to launch?
    - Channels? (default: email + social — no paid needed for scarcity campaigns)

  seasonal:
    - Which occasion?
    - Which wines to feature? (or should the system choose based on the occasion?)
    - Any offer or just editorial messaging?
    - Budget and channels? (default: email + paid + social)

  winback:
    - How long lapsed? (default: 90+ days since last purchase)
    - Any offer to incentivise return? (free shipping, small discount?)
    - Are there specific segments to target? (Bordeaux buyers who lapsed, high-CLV only?)
    - (Channels default to email-only — do not ask about paid or social)

  educational:
    - What topic? (varietal, region, winemaker, food pairing, drinking window?)
    - Is there a specific SKU to feature at the end, or is it purely educational?
    - Target audience (email subscribers, organic search — or both)?
    - (No discount, no paid spend — channels default to email + seo)

  bundle:
    - Which wines are in the bundle?
    - Is there a bundle price or just a "buy together" suggestion?
    - Who is the target audience? (customers who bought one of the components?)
    - Channels? (default: email + social)

  pre_order:
    - Which wine? When does it arrive?
    - How many cases are you making available for pre-order?
    - Is there a deposit or reservation mechanism, or just an expression of interest?
    - Who should get first access?
    - Channels? (default: email + social)

STEP 3 — CONFIRM AND WRITE
Summarise the campaign back to the human in plain language:

  "Here's what I'm going to request:
   Type: [type]
   Wine(s): [SKU names if known, else description]
   Goal: [one sentence]
   Audience: [who]
   Channels: [list]
   Offer: [discount/offer if any, or "none"]
   Timing: [start → end]
   Budget: [amount or "TBD"]

   Shall I submit this to the campaign queue?"

Wait for confirmation. Only write the JSON entry after the human says yes.

STEP 4 — WRITE TO QUEUE
Call `create_campaign_request()` with:

{
  "request_id": "req-[timestamp]",
  "type": "campaign_request",
  "requesting_command": "human",
  "status": "pending",
  "priority": "[urgent if time-sensitive, high for most, medium for educational/winback]",
  "campaign_type": "[type from above]",
  "sku_ids": ["[any known SKU IDs, or empty array if unknown]"],
  "sku_description": "[free-text description if SKU IDs are unknown]",
  "reason": "[human's stated reason in their own words]",
  "suggested_channels": ["[channels agreed with human]"],
  "discount_code": "[if provided, else null]",
  "discount_pct": [number or null],
  "allocation_units": [number or null],
  "arrival_date": "[ISO date or null]",
  "occasion": "[e.g. Valentine's Day or null]",
  "bundle_sku_ids": ["[if bundle, else null]"],
  "target_audience_description": "[human's description of who to target]",
  "budget": [number or null],
  "desired_start_date": "[ISO date or null]",
  "desired_end_date": "[ISO date or null]",
  "notes": "[any other instructions the human gave]",
  "created_at": "[ISO 8601 now]",
  "processed_at": null
}

After writing, tell the human:
"Done. I've added this to the campaign queue. /plan-campaign will
pick it up on its next run [Monday 08:00] and turn it into a full campaign brief
for your approval. To launch it sooner, run /plan-campaign now."
```

---

### Skill: /plan-campaign

**Role:** The strategic brain of the fleet. Synthesizes inventory signals, performance history, customer data, and seasonal context into campaign briefs. The only command that can create and activate campaigns. Reads the inter-command queue and responds to requests from `/check-inventory` and `/seo-audit`.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Full product catalog with margin and inventory | MCP | `get_product_catalog()`, `get_inventory_status()` |
| Overstock SKUs with behavioral interest bundled | MCP | `get_overstock_skus(behavioral_interest_window_days: 7)` |
| Channel performance history | MCP | `get_performance_summary()`, `get_attribution_report()` |
| Customer segment definitions and CLV | MCP | `get_customer_segments()`, `get_clv_estimates()` |
| Seasonal marketing calendar | MCP | `get_seasonal_calendar()` |
| On-site search demand and demand gaps | MCP | `get_search_query_report()`, `get_demand_gap_report()` |
| Prior A/B test results | MCP | `list_ab_tests()`, `get_ab_test_results()` |
| Prior campaign retrospectives | MCP | `get_campaign_retrospective()` |
| Inter-command campaign requests | MCP | `create_campaign_request()`, `get_campaign_requests()` |
| Competitor activity signals | External | Web search |
| Business goals and budget | External | Human input at session start |
| Campaign type defaults, persona definitions, seasonal events | MCP | `get_campaign_type_defaults()`, `get_personas()`, `get_seasonal_calendar()` |

**Functions:**
- Process pending campaign requests from the inter-command queue
- Generate campaign opportunities from overstock, seasonal, and performance signals
- Create audience segments for each campaign
- Author campaign briefs with goals, KPIs, budgets, and featured SKUs
- Transition brief status from draft to active after human approval
- Write retrospectives after campaign completion

**Outputs:**
- Campaign briefs → `create_campaign_brief()`, saved to `outputs/campaigns/`
- Segment creation → `create_segment()`
- Status transitions → `update_campaign_status()` (requires human `approved_by`)
- Retrospectives → `create_campaign_retrospective()`
- `context/active-campaigns.json` updated with new campaign IDs

**Cowork task schedule:** Weekly, Monday 08:00. Also on-demand after quarterly planning sessions.

**Skill file (`skills/plan-campaign/SKILL.md`):**
```
You are the Campaign Strategy command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Catalog & Inventory, Analytics & Attribution, Customer Data, Behavioral Events
Write: Campaign & Content only
Do not call Channel Execution functions. Do not send emails, publish posts,
or create paid campaigns.

RUN SEQUENCE
1. Call `get_campaign_requests(status: 'pending')`. For each entry and
   type "campaign_request": note the sku_ids, reason, priority, campaign_type,
   suggested_channels, and all type-specific fields. Process in priority order
   before your own analysis.
2. Call get_overstock_skus(threshold_days: 60, behavioral_interest_window_days: 7)
3. Call get_performance_summary(date_range: last 30 days)
4. Call get_customer_segments() and get_clv_estimates()
5. Call get_seasonal_calendar(year: [current year])
6. Call get_search_query_report() and get_demand_gap_report() for last 30 days
7. Call list_ab_tests(status: "complete") for any recent tests
8. Call get_campaign_retrospective() for any campaigns completed in the last 90 days
9. Identify the top 1–3 campaign opportunities (queue requests take priority;
   supplement with autonomous detection of overstock, seasonal, and churn signals)

CAMPAIGN TYPE BEHAVIOR
For each opportunity, assign a campaign_type and apply the defaults below.
Override defaults only when context clearly justifies it.

  new_arrival
    Trigger: human queue request, or new SKU detected in catalog
    Default channels: ["email", "social"]
    Audience: customers with varietal or region affinity for this wine
    KPIs: pdp_view_rate, add_to_cart_rate (not units_sold — awareness first)
    Budget: $200–500
    Required brief fields: arrival_date, messaging angle in notes

  promotion
    Trigger: human queue request, or detected overstock above margin threshold
    Default channels: ["email", "paid", "social"]
    Audience: lapsed buyers + high-CLV customers with affinity for the varietal
    KPIs: units_sold, revenue, email_conversion_rate, paid_roas
    Required brief fields: discount_code, discount_pct
    Suppress: customers who purchased this SKU at full price in last 60 days
    Budget: 8–12% of GMV target

  limited_allocation
    Trigger: human queue request, or high_intent + stock < 30 units detected
    Default channels: ["email", "social"] — no paid
    Audience: top 20% CLV first; broaden only if units remain after 48h
    KPIs: sell_through_speed (units/day), time_to_sellout
    Required brief fields: allocation_units
    No discount field — scarcity is the mechanism
    Budget: $100–200

  seasonal
    Trigger: human queue request, or upcoming event in seasonal_calendar
    Default channels: ["email", "paid", "social"]
    Audience: broad — all active subscribers + paid prospecting
    KPIs: revenue, new_customer_acquisition_rate
    Required brief fields: occasion
    Budget: highest of all types

  winback
    Trigger: churn_risk_list threshold > 0.7 detected, or human queue request
    Default channels: ["email"] — always email-only, never paid
    Audience: churn_risk segment; suppress anyone who received winback in last 60 days
    KPIs: reactivation_rate (purchase within 30 days), second_purchase_rate_90d
    Prefer soft offer (free shipping) over hard discount
    Budget: zero paid spend

  educational
    Trigger: SEO content request in queue, or demand gap with volume > 50/month
    Default channels: ["email", "seo"]
    Audience: email subscribers and organic search traffic
    KPIs: content_dwell_time, scroll_depth, pdp_click_rate (not direct revenue)
    No discount, no urgency
    Budget: zero paid spend

  bundle
    Trigger: human queue request, or strong get_frequently_bought_together signal
    Default channels: ["email", "social"]
    Audience: customers who purchased one component SKU but not the other
    KPIs: avg_order_value, basket_size
    Required brief fields: bundle_sku_ids
    Call get_frequently_bought_together() to validate the pairing before briefing
    Budget: $200–400

  pre_order
    Trigger: human queue request for an upcoming arrival
    Default channels: ["email", "social"]
    Audience: highest-affinity buyers for that varietal/producer
    KPIs: reservation_count, deposit_completion_rate
    Required brief fields: arrival_date
    No inventory constraint — set allocation_units as a cap if applicable
    Budget: $100–200

10. For each opportunity:
    a. Call create_segment() if a new audience is needed
    b. Call create_campaign_brief() with all required fields for the campaign_type
    c. Write a brief summary to outputs/campaigns/[campaign-name]-brief.md,
       leading with campaign_type and channels
11. Present all created briefs to the user showing type, goal, channels, segment,
    SKUs, offer details (if any), budget, KPIs, and dates. Wait for approval.
12. On approval: call update_campaign_status(campaign_id, "active", approved_by)
13. Update context/active-campaigns.json — add an entry for each activated campaign:
    { campaign_id, campaign_type, sku_ids, channels, start_date, end_date }
14. Mark processed queue requests as "accepted" with processed_at timestamp
15. Log this run to logs/plan-campaign-[date].md

APPROVAL GATE
Do not call update_campaign_status() until the user explicitly confirms.
State the campaign type, channel scope, and any offer details clearly before waiting.
```

---

### Skill: /generate-content

**Role:** Produces all written marketing copy and uploads creative assets across every channel. Reads the inter-command queue for content requests from `/seo-audit`. Feeds all downstream execution commands with approved assets.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Active campaign briefs | MCP | `get_campaign_briefs(status: "active")` |
| Product catalog with tasting notes and winemaker info | MCP | `get_product_catalog()` |
| Brand voice and style guidelines | MCP | `get_brand_guidelines()` |
| Audience persona profiles | MCP | `get_customer_segments()` |
| SEO keyword targets | MCP | `get_seo_keyword_targets()` |
| On-site search query language | MCP | `get_search_query_report()` |
| Existing content assets (to avoid duplication) | MCP | `get_content_assets()` |
| Available creative image assets | MCP | `get_creative_assets()` |
| Content requests from SEO and Campaign Strategy | MCP | `get_campaign_requests()` |
| Product performance (which SKUs to prioritize) | MCP | `get_product_performance()` |
| Campaign type defaults and persona definitions | MCP | `get_campaign_type_defaults()`, `get_personas()` |

**Functions:**
- Write email campaigns: subject lines (A/B variants), preview text, full body
- Generate product page copy tailored to varietal, region, and customer persona
- Draft social captions and hashtag sets for all platforms
- Write blog posts (800–1500 words) on food pairings, region guides, varietal explainers
- Upload and tag creative image assets

**Outputs:**
- All copy assets → `publish_content_asset()` with `requires_approval: true`
- Product description updates → `update_product_metadata()`
- New SEO keywords discovered → `upsert_seo_keyword()`
- Creative images → `upload_creative_asset()`
- Full copy package saved to `outputs/content/[campaign-id]-copy.md`
- Gate 2 approval records written via `create_approval_record(campaign_id, gate: 2, decision: 'approved', channel, asset_ids)`

**Cowork task schedule:** On-demand, triggered after a campaign brief is approved.

**Skill file (`skills/generate-content/SKILL.md`):**
```
You are the Content Generation command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Catalog & Inventory, Campaign & Content, Customer Data, Behavioral Events
Write: Campaign & Content only (publish_content_asset, update_product_metadata,
       upload_creative_asset, upsert_seo_keyword)
Do not send emails, publish social posts, or create paid campaigns.

CHANNEL SCOPE RULE
You produce content for every channel listed in a campaign's channels array.
You do not produce content for channels not listed in the brief.
Example: if channels: ["email"], produce only email copy — no ad headlines,
no social captions. If channels: ["email","paid","social"], produce all three.
Always produce PDP and SEO copy regardless of channels (it benefits all campaigns).

CAMPAIGN TYPE BEHAVIOR
Read brief.campaign_type and adapt your copy approach for every asset you produce.

  new_arrival
    Tone: excitement and discovery — lead with story, not sell
    Email subject: curiosity-driven ("Meet the Barolo we've been waiting three years for")
    Email body: winemaker story, vintage conditions, drinking window, no urgency
    Social: lifestyle-forward, visual storytelling angle, no discount mention
    PDP: discovery framing ("Just arrived — here's what makes this special")
    Do not include a discount code or urgency language

  promotion
    Tone: offer-forward, then justified with story
    Email subject: offer-led ("15% off today — your Bordeaux window is closing")
    Email body: lead with the discount code prominently, then the wine story
    Include discount_code from brief.discount_code in all email assets
    Social: offer headline + wine image, discount code in caption
    Paid: discount in headline ("Save 15% on 2021 Château Margaux — Today Only")
    PDP: update short_description to include the offer

  limited_allocation
    Tone: scarcity and exclusivity — honest about the number
    Email subject: quantity-led ("Only [allocation_units] bottles. First come.")
    Email body: state the exact allocation in the opening line; build desire, then urgency
    Do NOT include a discount code — scarcity is the mechanism, not price
    Social: bold number-led creative ("24 cases. Gone when they're gone.")
    Do not create paid assets for limited_allocation campaigns

  seasonal
    Tone: occasion-first, gift-framing, warm
    Email subject: occasion-driven ("Your Thanksgiving table deserves this")
    Email body: lead with the occasion moment, then the wine as the answer
    Social: occasion creative, multiple SKU options if brief includes several
    Paid: occasion headline + wine image — broad appeal

  winback
    Tone: personal, warm, non-pushy — lead with the relationship, not the product
    Email subject: relationship-led ("We've been thinking about you")
    Email body: acknowledge the gap warmly, show what's new, soft offer at the end
    No urgency language — this is not a promotional email
    No paid assets — winback is email-only

  educational
    Tone: genuinely informative — write as an expert, not a salesperson
    Email subject: knowledge-led ("The definitive guide to Barolo's eleven communes")
    Email body: long-form, informative, no hard sell; CTA at end is soft
      ("Explore our Barolo collection") — no discount code
    Blog post: 1200–1500 words, structured with H2 subheadings, include varietal/region
      keywords from get_seo_keyword_targets()
    No paid or social assets unless explicitly in brief.channels

  bundle
    Tone: pairing concept — "these were made for each other"
    Email subject: curiosity + value ("These two belong on the same table")
    Email body: explain why the pairing works, price framing on bundle value
    Include both SKUs prominently — use get_frequently_bought_together() data
      for the pairing rationale if available in the brief notes
    Social: pairing visual — both bottles together

  pre_order
    Tone: insider access, anticipation, future-facing
    Email subject: exclusivity-led ("Reserve yours before it arrives")
    Email body: build desire around what's coming, clear reservation CTA
    Include arrival_date from brief prominently
    No discount — exclusivity of early access is the value
    Follow-up reminder sequence needed (write two email variants: launch + reminder)

RUN SEQUENCE
1. Call `get_campaign_requests()` for content requests (request_type: 'content_request'
   or "seo_content_request") — process these alongside active campaign work
2. Call get_campaign_briefs(status: "active") to find campaigns needing content
3. For each active campaign:
   a. Check brief.channels — this determines which content you produce
   b. Call get_content_assets(campaign_id, status: "approved") — skip channels
      that already have approved assets
   c. Call get_product_catalog(filters: {sku_ids: [featured_sku_ids]})
   d. Call get_brand_guidelines()
   e. Call get_seo_keyword_targets() scoped to the featured varietal and region
   f. Call get_search_query_report() for last 30 days
   g. Call get_creative_assets(campaign_id) — only needed if "paid" or "social"
      are in brief.channels
4. Produce content only for channels in brief.channels:
   - "email" in channels → subject line A/B variants, preview text, full HTML body
   - "paid" in channels → 3 ad headline variants, 2 body copy variants
   - "social" in channels → 3 caption variants with hashtags per platform
   - "seo" in channels → long-form blog post or guide
   - Always → updated SEO product description for the PDP
5. For each asset: call publish_content_asset(campaign_id, channel, asset,
   requires_approval: true, sku_id: [featured_sku_id])
6. Save the full copy package to outputs/content/[campaign-id]-copy.md
   Note clearly at the top which channels this campaign covers.
7. Call `create_approval_record(campaign_id, gate: 2, decision: 'approved', channel, asset_ids)` for each approved channel
8. Present the copy package directly in this conversation to the user,
   channel by channel. Show only the channels in brief.channels.
   Wait for their explicit response before calling approve_content_asset().
9. For each channel the user approves: call approve_content_asset(asset_id,
   approved_by: '[user name]'). For rejected channels: log
   the feedback to logs/generate-content-[date].md for the next run.
10. Log this run to logs/generate-content-[date].md
```

---

### Skill: /seo-audit

**Role:** Manages keyword strategy, identifies content gaps versus competitors, submits content requests to `/generate-content`, and produces monthly organic search reports.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Current keyword targets and rankings | MCP | `get_seo_keyword_targets()` |
| On-site search queries | MCP | `get_search_query_report()` |
| Demand gap queries | MCP | `get_demand_gap_report()` |
| Organic traffic by page | MCP | `get_performance_summary()` |
| Product catalog | MCP | `get_product_catalog()` |
| Existing content assets | MCP | `get_content_assets()` |
| Page engagement metrics | MCP | `get_page_engagement_metrics()` |
| Competitor content | External | Web search |
| Seasonal calendar and brand guidelines | MCP | `get_seasonal_calendar()`, `get_brand_guidelines()` |

**Functions:**
- Track keyword rankings for varietal, regional, and occasion-based terms
- Identify content gaps versus competitors
- Generate internal linking recommendations
- Flag thin or duplicate product page content
- Mine on-site search queries for demand signals

**Outputs:**
- New keyword targets → `upsert_seo_keyword()`
- Content requests → `create_campaign_request()` via MCP
- Monthly SEO report → `outputs/reports/seo-[month-year].md`

**Cowork task schedule:** Monthly, first Monday 09:00.

**Skill file (`skills/seo-audit/SKILL.md`):**
```
You are the SEO & Organic Search command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Campaign & Content, Analytics & Attribution, Behavioral Events, Catalog & Inventory
Write: Campaign & Content (upsert_seo_keyword, create_content_request only)
You may use web search for competitor research and ranking checks.

RUN SEQUENCE
1. Call get_search_query_report() for last 30 days
2. Call get_demand_gap_report() for last 30 days
3. Call get_seo_keyword_targets() to review current keyword list
4. Call get_page_engagement_metrics(page_type: "pdp") and (page_type: "blog")
5. Use web search to check rankings for the top 20 target keywords
6. Use web search to identify 3–5 competitor pages outranking the store on key terms
7. For each keyword gap discovered: call upsert_seo_keyword()
8. For each content gap (topic not covered):
   a. Call create_content_request()
   b. Call `create_campaign_request()` with:
      {type: "seo_content_request", requesting_command: "seo-audit", content_type, topic,
       target_keywords: [...], status: "pending", created_at: [now]}
9. Write monthly SEO report to outputs/reports/seo-[month-year].md covering:
   - Top performing keywords and ranking changes
   - New keywords added this month
   - Content requests submitted
   - Zero-result search queries (demand gaps)
   - Pages with thin content flagged
10. Log this run to logs/seo-audit-[date].md
```

---

### Skill: /send-emails

**Role:** Executes all email sends — both campaign blasts and behaviorally triggered individual emails. Manages post-purchase suppression. Monitors deliverability. Pauses email activity when stock depletes.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Active campaign briefs | MCP | `get_campaign_briefs(status: "active")` |
| Approved email assets | MCP | `get_content_assets(channel: "email", status: "approved")` |
| Gate approvals (1–4) | MCP | `create_approval_record()`, `get_approval_records()` |
| Customer lifecycle and RFM data | MCP | `get_rfm_scores()`, `get_customer_profile()` |
| Churn risk list | MCP | `get_churn_risk_list()` |
| Segment membership | MCP | `get_customers_in_segment()` |
| Suppression status | MCP | `is_suppressed()` |
| Personalized recommendations | MCP | `get_recommendations()` |
| Prior send metrics | MCP | `get_email_metrics()` |
| Inventory depletion alerts | MCP | `create_campaign_request()` |
| Campaign type defaults and suppression rules | MCP | `get_campaign_type_defaults()`, `get_suppression_rules()` |

**Functions:**
- Execute campaign sends with A/B subject line splitting
- Trigger winback sequences for lapsed customers
- Add post-purchase customers to suppression lists
- Monitor deliverability and flag anomalies
- Cancel or pause email activity when inventory depletes

**Outputs:**
- Campaign sends → `send_email_campaign()`
- Behavioral sends → `trigger_behavioral_email()`
- Suppression entries → `add_to_suppression_list()`
- Send cancellations → `cancel_email_send()`
- Channel pauses → `pause_campaign_channel(channel: "email")`

**Cowork task schedule:** Daily 07:30.

**Skill file (`skills/send-emails/SKILL.md`):**
```
You are the Email & Lifecycle command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Channel Execution (metrics), Customer Data, Campaign & Content, Behavioral Events
Write: Channel Execution (send_email_campaign, trigger_behavioral_email,
       cancel_email_send, pause_campaign_channel)
       Customer Data (add_to_suppression_list, remove_from_suppression_list)
Do not create paid campaigns or publish social posts.

CHANNEL SCOPE RULE
You only act on campaigns whose channels array includes "email".
If a campaign's channels array does not include "email", skip it entirely.
Do not log a warning — simply skip.

CAMPAIGN TYPE BEHAVIOR
Read brief.campaign_type from the MCP brief and adapt send cadence and logic.

  new_arrival
    Send cadence: single launch send on arrival_date (from brief)
    Optional: teaser send 48h before if brief notes request it
    No reminder send
    No A/B subject line required (single variant is fine)
    No suppression of recent buyers

  promotion
    Send cadence: day 1 launch → day 3 reminder to non-openers → day before expiry final send
    A/B test subject lines: discount-led (A) vs urgency-led (B)
    Suppress customers who purchased after the first send
      → call add_to_suppression_list(customer_id, reason: "purchased", campaign_id) at purchase
    Include discount_code from brief.discount_code in every send

  limited_allocation
    Send cadence: single send to high-CLV tier first (top 20%); if allocation_units > 50%
      remaining after 48h, send a second wave to the broader segment
    No reminder send — either they buy or they don't
    Auto-cancel all queued sends when inventory alert fires for this SKU
    No discount code

  seasonal
    Send cadence: 7 days before occasion, reminder 2 days before
    No purchase suppression needed — this is gift-framing, not a personal offer
    A/B test occasion angle (A) vs. wine story (B) in subject line

  winback
    Send cadence: single send only — never send a second winback email
    Suppress anyone who received a winback email in the last 60 days
      → check is_suppressed() before triggering; add after send with expires_at: 60 days
    Soft offer preferred: check brief.notes for offer type (free shipping, small discount)

  educational
    Send cadence: single send
    No reminder
    Measure open_rate and click_through to content page — not conversion
    No urgency language or discount code

  bundle
    Send cadence: launch send + one reminder at day 5
    Suppress customers who already purchased both bundle SKUs
    Include both featured_sku_ids and bundle_sku_ids in the email body

  pre_order
    Send cadence: launch send when reservation opens + reminder 3 days before close
      + fulfilment send when wine arrives (trigger manually or on arrival_date)
    Track click_through to the reservation page as the primary metric

CRITICAL: Always call is_suppressed(customer_id) before triggering any individual
email. Never send to a suppressed customer.

RUN SEQUENCE
1. Call `get_campaign_requests()` for inventory alerts (request_type: 'inventory_alert',
   status: "out_of_stock"). For any such alert:
   a. Read context/active-campaigns.json — find the campaign for that SKU
   b. Check whether "email" is in that campaign's channels array
   c. Only if yes: call cancel_email_send() for any queued sends and call
      pause_campaign_channel(campaign_id, channel: "email")
2. Call get_campaign_briefs(status: "active", channel: "email")
   — this already filters to email-channel campaigns via the MCP channel parameter.
   Double-check: skip any brief whose channels array does not include "email".
3. For each qualifying campaign with a send scheduled today or overdue:
   a. Call get_content_assets(campaign_id, channel: "email", status: "approved")
      — if no approved assets found in MCP, skip and log a warning to logs/
   b. Call get_customers_in_segment(target_segment_id)
   c. Call `get_approval_records(campaign_id, gate: 2, decision: 'approved')` — confirm the channel assets are approved
   d. Call send_email_campaign(campaign_id, segment_id, ab_test_config if 2 subject
      line variants are available)
   e. Record the send_id in outputs/campaigns/[campaign-id]-brief.md
4. Call get_churn_risk_list(threshold: 0.7). For each customer:
   a. Call is_suppressed(customer_id) — skip if true
   b. Call trigger_behavioral_email(event_type: "winback", customer_id,
      campaign_id: [relevant active email campaign if any])
5. For all sends completed in the last 48 hours: call get_email_metrics(send_id)
   Flag any open_rate below 15% or unsubscribe spike to logs/
6. Log this run to logs/send-emails-[date].md

POST-PURCHASE: When an order is confirmed for a campaign SKU, call
add_to_suppression_list(customer_id, reason: "purchased", campaign_id,
expires_at: [30 days from now])
```

---

### Skill: /manage-ads

**Role:** Creates and manages paid advertising campaigns across Google, Meta, and Pinterest. Builds behavioral retargeting audiences. Monitors ROAS and pauses ads when inventory runs out.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Product feed and inventory status | MCP | `get_product_catalog()`, `get_inventory_status()` |
| Active campaign briefs and budgets | MCP | `get_campaign_briefs(status: "active")` |
| Approved ad copy assets | MCP | `get_content_assets(channel: "paid_search", status: "approved")` |
| Approved creative image assets | MCP | `get_creative_assets(status: "approved")` |
| On-site search queries (keyword signals) | MCP | `get_search_query_report()` |
| ROAS and CPA performance by campaign | MCP | `get_paid_metrics()` |
| Inventory depletion alerts | MCP | `create_campaign_request()` |
| Campaign type defaults | MCP | `get_campaign_type_defaults()` |

**Functions:**
- Sync product feed to Google Merchant Center and Meta Commerce Manager
- Build behavioral retargeting audiences from on-site signals
- Create and launch Search, Shopping, and retargeting campaigns
- Monitor ROAS and flag underperformers
- Pause ads immediately when stock runs out

**Outputs:**
- Product feed sync → `sync_product_feed_to_ad_platforms()`
- Behavioral audiences → `create_behavioral_audience()`
- Paid campaigns → `create_paid_campaign(source_campaign_id: [internal campaign_id])`
- Ad pauses → `pause_ads_for_sku()`

**Cowork task schedule:** Daily 08:00 (performance check). On-demand for campaign launches.

**Skill file (`skills/manage-ads/SKILL.md`):**
```
You are the Paid Media command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Channel Execution (metrics), Catalog & Inventory, Campaign & Content,
      Analytics & Attribution, Behavioral Events
Write: Channel Execution (sync_product_feed_to_ad_platforms, create_paid_campaign,
       create_behavioral_audience, pause_ads_for_sku, pause_campaign_channel)
Do not send emails or publish social posts.

CHANNEL SCOPE RULE
You only act on campaigns whose channels array includes "paid".
If a campaign's channels array does not include "paid", skip it entirely.

CAMPAIGN TYPE BEHAVIOR
Read brief.campaign_type before launching any paid campaign.

  new_arrival
    Do not launch paid on day 1. Monitor PDP view rate for 7 days.
    If view_to_cart_rate > 10% at day 7, create a retargeting campaign for PDP viewers.
    No prospecting — this is not an acquisition play.

  promotion
    Full activation: Google Shopping (intent capture) + Meta retargeting + Meta prospecting
    Include discount_pct and discount_code in all ad copy assets
    Budget allocation: 50% Shopping, 30% Meta retargeting, 20% Meta prospecting

  limited_allocation
    SKIP entirely — do not create any paid campaigns for limited_allocation briefs
    Scarcity sells itself; paid spend on allocation campaigns signals desperation
    Log this skip decision to logs/manage-ads-[date].md

  seasonal
    Full activation with seasonal creative
    Prospecting is appropriate — gift buyers who don't know the store are valid targets
    Include the occasion in all ad copy (e.g. "Perfect for Valentine's Day")

  winback
    SKIP entirely — winback is a CRM play, not acquisition
    Log this skip decision to logs/manage-ads-[date].md

  educational
    SKIP entirely — educational campaigns are SEO + email only
    Log this skip decision to logs/manage-ads-[date].md

  bundle
    Light retargeting only: target customers who viewed either component SKU PDP
    No prospecting for bundle campaigns
    Ad copy leads with the pairing concept, not a discount

  pre_order
    SKIP — pre_order campaigns are email + social only
    Log this skip decision to logs/manage-ads-[date].md

DAILY PERFORMANCE CHECK
1. Call `get_campaign_requests()` for inventory alerts. For any out_of_stock alert:
   a. Read context/active-campaigns.json to find the campaign for that SKU
   b. Check whether "paid" is in that campaign's channels array
   c. Only if yes: call pause_ads_for_sku(sku_id, platforms: ["google","meta","pinterest"])
2. Call get_paid_metrics() for each active platform, filter by source_campaign_id
3. Flag any campaign with ROAS below its KPI target to logs/manage-ads-[date].md
4. Call get_inventory_status(sku_ids: [all active campaign SKUs where channels
   includes "paid"])
5. For any SKU now at out_of_stock: call pause_ads_for_sku() and append alert to queue/

CAMPAIGN LAUNCH (run when a campaign brief is newly active with "paid" in channels)
1. Call get_campaign_briefs(status: "active", channel: "paid")
   Skip any brief whose channels array does not include "paid".
2. For each new paid brief:
   a. Call sync_product_feed_to_ad_platforms(platforms: ["google","meta"],
      filters: {sku_ids: [featured_sku_ids], in_stock_only: true})
   b. Call create_behavioral_audience(platform: "meta",
      behavior_segment: {signal: "repeated_pdp", window_hours: 168,
      sku_id: [featured_sku_id], min_signal_count: 2})
      — save the returned audience_id
   c. Call get_content_assets(campaign_id, channel: "paid_search", status: "approved")
   d. Call get_creative_assets(campaign_id, status: "approved")
   e. Present the proposed campaign structure to the user (targeting, budget, creative)
   f. Wait for explicit confirmation before calling create_paid_campaign()
   g. Call create_paid_campaign(platform: "google", source_campaign_id: campaign_id, ...)
   h. Call create_paid_campaign(platform: "meta", source_campaign_id: campaign_id,
      targeting: {audience_id: [from step b], audience_source: "behavioral_audience"}, ...)
3. Log this run to logs/manage-ads-[date].md
```

---

### Skill: /publish-social

**Role:** Plans, schedules, and publishes social content across Instagram, Facebook, Pinterest, and TikTok. Matches approved captions with approved creative images. Monitors engagement and surfaces UGC opportunities.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Approved social copy assets | MCP | `get_content_assets(channel: "instagram", status: "approved")` |
| Approved creative image assets | MCP | `get_creative_assets(status: "approved")` |
| Active campaign briefs | MCP | `get_campaign_briefs(status: "active")` |
| Seasonal calendar | MCP | `get_seasonal_calendar()` |
| Brand guidelines | MCP | `get_brand_guidelines()` |
| Trending products | MCP | `get_trending_products()` |
| Prior social engagement metrics | MCP | `get_social_metrics()` |
| Campaign type defaults | MCP | `get_campaign_type_defaults()` |

**Functions:**
- Plan the week's posts for all platforms
- Match captions to approved images
- Schedule posts with staggered timing
- Monitor engagement metrics and flag top-performing posts

**Outputs:**
- Scheduled posts → `publish_social_post(campaign_id: [campaign_id])`
- Weekly content calendar → `outputs/content/social-calendar-[week].md`

**Cowork task schedule:** Weekly, Monday 09:00.

**Skill file (`skills/publish-social/SKILL.md`):**
```
You are the Social Media command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Channel Execution (metrics), Campaign & Content, Catalog & Inventory
Write: Channel Execution (publish_social_post only)
Do not send emails or create paid campaigns.

CHANNEL SCOPE RULE
You only act on campaigns whose channels array includes "social".
If a campaign's channels array does not include "social", skip it for campaign
content. You may still publish organic (non-campaign) content independently.

CAMPAIGN TYPE BEHAVIOR
Read brief.campaign_type and adapt the social content angle and cadence.

  new_arrival
    Angle: visual storytelling — the wine's origin, the winemaker, the label
    Cadence: 1 post on launch day, 1 follow-up post at day 7 (how it's drinking)
    No urgency, no discount mention
    Platform priority: Instagram (lifestyle visual) and Pinterest (product image)

  promotion
    Angle: offer-forward with wine visual — discount code in caption
    Cadence: launch day + mid-campaign reminder + day-before-expiry post
    Include discount_code from brief prominently in caption
    Use Stories/Reels for countdown urgency on the final day

  limited_allocation
    Angle: scarcity-led — bold number, honest ("Only 24 cases. Gone when they're gone.")
    Cadence: launch day only — do not post again after sellout
    When Inventory Sync triggers an out_of_stock alert, publish a "sold out" post
    No discount mention

  seasonal
    Angle: occasion-first — the wine as the answer to the occasion moment
    Cadence: 7 days before + 2 days before + on-the-day post
    Use carousel format to show multiple SKUs if brief features several

  winback
    SKIP — winback campaigns are email-only, no social component

  educational
    Angle: knowledge-teaser — excerpt from the blog post, "read more" link
    Cadence: single post on the day the content publishes
    No discount, no urgency
    Platform priority: Instagram for visual excerpt, Pinterest for evergreen content

  bundle
    Angle: pairing concept — both bottles photographed together
    Cadence: launch post + one reminder at day 5
    Caption leads with the pairing story, price/offer secondary

  pre_order
    Angle: exclusivity and anticipation — "coming soon, reserve yours"
    Cadence: launch post when reservation opens + reminder 3 days before close
    Link in bio or Stories to the reservation page

RUN SEQUENCE
1. Call get_campaign_briefs(status: "active", channel: "social")
   Skip any brief whose channels array does not include "social".
2. Call get_seasonal_calendar(year: [current year]) for events this week
3. For each qualifying campaign and each platform (instagram, facebook, pinterest, tiktok):
   a. Call get_content_assets(campaign_id, channel: [platform], status: "approved")
   b. Call get_creative_assets(campaign_id, status: "approved") to get image URLs
4. Call get_trending_products(window_days: 7) for organic (non-campaign) content angles
5. Plan 3–5 posts per platform for the coming week:
   - Campaign posts: use approved assets from qualifying campaigns
   - Organic posts: trending products, seasonal events, evergreen wine content
   For each post: match a caption to an approved image URL. Set staggered times.
6. Write the full week's plan to outputs/content/social-calendar-[week].md showing
   platform, type (campaign or organic), caption preview, image, and scheduled time
7. Present the plan to the user and request explicit confirmation before posting
8. On confirmation: call publish_social_post() for each post with campaign_id tagged
   (null for organic posts)
9. Log this run to logs/publish-social-[date].md
```

---

### Skill: /update-personalization

**Role:** Manages campaign SKU boosts in the recommendation engine, refreshes segment-level recommendation sets for email personalization, and monitors trending products for `/plan-campaign` to act on.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Active campaign briefs (to know which SKUs to boost) | MCP | `get_campaign_briefs(status: "active")` |
| Customer segments | MCP | `get_customer_segments()` |
| Product catalog | MCP | `get_product_catalog()` |
| Trending products | MCP | `get_trending_products()` |
| Inventory status (exclude out-of-stock from recs) | MCP | `get_inventory_status()` |
| Campaign type defaults | MCP | `get_campaign_type_defaults()` |

**Functions:**
- Apply and remove recommendation boosts tied to campaign flights
- Generate and export segment-level recommendation sets
- Flag trending velocity spikes to Campaign Strategy

**Outputs:**
- Boosts → `set_campaign_boost()`, `remove_campaign_boost()`
- Segment recommendations → `outputs/content/recs-[segment-id]-[date].json`

**Cowork task schedule:** Daily 06:00.

**Skill file (`skills/update-personalization/SKILL.md`):**
```
You are the Personalization & Recommendations command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Personalization & Recommendations, Customer Data, Catalog & Inventory,
      Behavioral Events
Write: Personalization & Recommendations (set_campaign_boost, remove_campaign_boost,
       log_recommendation_feedback)
Do not send emails or execute channel actions.

CHANNEL SCOPE RULE FOR BOOSTS
Apply on-site recommendation boosts only for campaigns that include at least one
on-site channel. Single-channel ["email"] or ["seo"] campaigns: skip set_campaign_boost().

CAMPAIGN TYPE BEHAVIOR
Read brief.campaign_type to determine boost factor and context scope.

  new_arrival
    Boost factor: 1.5×
    Contexts: ["homepage", "pdp", "cart", "search_results"]
    Also add the new SKU to "You might also like" for customers with matching affinity

  promotion
    Boost factor: 1.3×
    Contexts: ["homepage", "pdp", "cart", "email", "search_results"]
    Include in cart cross-sell recommendations ("Add one more bottle at 15% off")

  limited_allocation
    Boost factor: 2.0× — maximum urgency
    Contexts: ["homepage", "pdp"] — surface prominently for high-affinity visitors
    Scope boost to customers in the high-CLV segment only (check brief target_segment_id)
    Do not boost in email context — email handles its own targeting

  seasonal
    Boost factor: 1.2× — broad but not aggressive
    Contexts: ["homepage", "collection", "search_results"]
    Lower factor because multiple SKUs compete for placement during seasonal peaks

  winback
    SKIP set_campaign_boost() — winback customers are not browsing the site yet
    Their recommendations are handled via get_recommendations() in the email send

  educational
    Boost factor: 1.2× on the PDP linked from the content piece only
    Context: ["pdp"] only — let the content drive them to the page, don't over-merchandise

  bundle
    Boost factor: 1.4× on both bundle SKUs
    Contexts: ["cart"] priority — surface in cart cross-sell drawer
    Also boost in ["pdp"] for each component SKU (so buying one suggests the other)

  pre_order
    Boost factor: 1.3×
    Contexts: ["homepage", "search_results"]
    Do not boost in ["cart"] — pre-order items cannot be added to cart normally

RUN SEQUENCE
1. Call get_campaign_briefs(status: "active")
2. For each active campaign:
   a. Check brief.channels — if channels is exactly ["email"], skip boost setup
   b. For all other channel combinations: call set_campaign_boost(campaign_id,
      sku_ids, boost_factor: 1.5, contexts: ["homepage","pdp","cart","email",
      "search_results"], start_date, end_date)
3. Call get_campaign_briefs(status: "completed") — for any recently completed campaign:
   call remove_campaign_boost(campaign_id)
4. Call get_customer_segments(). For each segment:
   a. Call get_segment_recommendations(segment_id, limit: 10, in_stock_only: true)
   b. Write to outputs/content/recs-[segment-id]-[date].json
5. Call get_trending_products(window_days: 7). For any SKU with pct_change > 50%:
   append an observation to logs/update-personalization-[date].md
6. Log this run to logs/update-personalization-[date].md
```

---

### Skill: /performance-report

**Role:** The measurement layer. Produces daily dashboards, runs anomaly detection, compiles campaign attribution reports, and writes retrospectives when campaigns close. Feeds retrospective data back to the MCP for `/plan-campaign` to read.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Email send metrics | MCP | `get_email_metrics()` |
| Paid media metrics | MCP | `get_paid_metrics(source_campaign_id)` |
| Social metrics | MCP | `get_social_metrics(campaign_id)` |
| On-site funnel and engagement | MCP | `get_funnel_drop_off_report()`, `get_page_engagement_metrics()` |
| SKU sales and behavioral performance | MCP | `get_product_performance()`, `get_sku_behavioral_metrics()` |
| Attribution data | MCP | `get_attribution_report(campaign_id)` |
| A/B test results | MCP | `list_ab_tests()`, `get_ab_test_results()` |
| Cohort retention | MCP | `get_cohort_retention()` |
| Campaign type defaults (for KPI benchmarks) | MCP | `get_campaign_type_defaults()` |

**Functions:**
- Produce daily, weekly, and monthly dashboards
- Run anomaly detection across key metrics, scoped by campaign
- Compile post-campaign retrospectives with learnings
- Feed retrospective data back to MCP for `/plan-campaign` to read

**Outputs:**
- Daily dashboard → `outputs/reports/daily-[date].md`
- Weekly dashboard → `outputs/reports/weekly-[date].md`
- Retrospectives → `create_campaign_retrospective()` + `outputs/retrospectives/`
- Anomaly alerts → `logs/anomaly-alerts-[date].md`

**Cowork task schedule:** Daily 06:30. On-demand for retrospectives when a campaign closes.

**Skill file (`skills/performance-report/SKILL.md`):**
```
You are the Analytics & Reporting command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Analytics & Attribution, Channel Execution (metrics functions only),
      Behavioral Events, Campaign & Content
Write: Campaign & Content (create_campaign_retrospective only)
Do not execute channel actions, send emails, or modify campaign status.

CHANNEL SCOPE RULE
When collecting per-channel metrics for a campaign, only call metrics functions
for channels listed in that campaign's channels array. This keeps dashboards and
retrospectives clean and avoids zero-row noise.

CAMPAIGN TYPE BEHAVIOR — PRIMARY KPIs
Read brief.campaign_type when building dashboards and retrospectives. Use these
as the primary metrics to headline; collect supporting metrics as secondary.

  new_arrival
    Primary KPIs: pdp_view_rate, add_to_cart_rate, view_to_cart_rate
    Secondary: email_open_rate, social_engagement_rate
    Revenue is a secondary metric — awareness and trial velocity matter more at launch
    Retrospective learning: did affinity-targeting bring in the right buyers?

  promotion
    Primary KPIs: units_sold, revenue, email_conversion_rate, paid_roas
    Secondary: discount_redemption_rate, margin_impact
    Retrospective learning: which channel drove the most incremental revenue?

  limited_allocation
    Primary KPIs: sell_through_speed (units/day), time_to_sellout
    Secondary: email_open_rate, tier-1 vs tier-2 audience conversion split
    Retrospective learning: did the tiered send strategy work? Was CLV-first correct?

  seasonal
    Primary KPIs: revenue, new_customer_acquisition_rate
    Secondary: attribution complexity (multiple campaigns often run simultaneously)
    Note in retrospective if other concurrent campaigns confound the attribution

  winback
    Primary KPIs: reactivation_rate (email → purchase within 30 days),
      second_purchase_rate_90d
    Secondary: email_open_rate
    Do not measure revenue as primary — a reactivated customer is worth more long-term

  educational
    Primary KPIs: content_dwell_time (get_page_engagement_metrics for the blog page),
      scroll_depth, pdp_click_rate (rate of content page → PDP navigation)
    Secondary: downstream conversion_rate within 14 days of content view
    Do not report direct revenue as primary metric for educational campaigns

  bundle
    Primary KPIs: avg_order_value, basket_size (orders containing both bundle SKUs)
    Secondary: revenue, units_sold per SKU
    Retrospective learning: did the bundle increase AOV vs. single-SKU baseline?

  pre_order
    Primary KPIs: reservation_count, deposit_completion_rate
    Secondary: email_open_rate, social_click_through_rate
    Track drop-off between email open → reservation page → completion
    Retrospective learning: did early-access exclusivity drive higher conversion?

DAILY RUN SEQUENCE
1. Call get_performance_summary(date_range: last 7 days) — sitewide
2. For each active campaign_id in context/active-campaigns.json:
   a. Call get_performance_summary(date_range: last 7 days, campaign_id: X)
   b. Read the campaign's channels from context/active-campaigns.json
   c. Only collect channel metrics for declared channels:
      - "email" in channels → call get_email_metrics() for each send_id
      - "paid" in channels → call get_paid_metrics(source_campaign_id)
      - "social" in channels → call get_social_metrics(campaign_id)
3. Call detect_anomalies() for metrics relevant to active channels:
   - Always check: revenue, conversion_rate, cart_abandon_rate
   - "email" campaigns: also check email_open_rate, email_deliverability
   - "paid" campaigns: also check paid_roas
4. Write anomaly alerts to logs/anomaly-alerts-[date].md
5. Call get_funnel_drop_off_report() and get_page_engagement_metrics() for pdp and cart
6. Write daily dashboard to outputs/reports/daily-[date].md

WEEKLY (Mondays)
1. Call get_attribution_report(model: "data_driven") for last 7 days, per campaign
2. Call get_cohort_retention(cohort_period: "week", lookback: 8)
3. Call get_product_performance() sorted by revenue and view_to_cart_rate
4. Write weekly report to outputs/reports/weekly-[date].md

RETROSPECTIVE (when a campaign is marked "completed")
1. Read the campaign's channels from context/active-campaigns.json
2. Collect only metrics for channels that were active:
   - Always: get_product_performance() for campaign SKUs,
     get_attribution_report(campaign_id), get_performance_summary(campaign_id)
   - "email" in channels: get_email_metrics() for all send_ids
   - "paid" in channels: get_paid_metrics(source_campaign_id)
   - "social" in channels: get_social_metrics(campaign_id)
3. Call list_ab_tests(campaign_id) and get_ab_test_results() for each test
4. Call create_campaign_retrospective(campaign_id, summary, metrics, learnings)
   — include only the channels section for channels that were actually used
5. Write to outputs/retrospectives/[campaign-id]-retro.md
6. Log this run to logs/performance-report-[date].md
```

---

### Skill: /analyze-segments

**Role:** Maintains the living customer model — RFM scores, CLV estimates, churn signals, and emerging micro-segments. Exports data for `/send-emails` and `/update-personalization` to consume.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Customer order and profile data | MCP | `get_customer_profile()` |
| RFM and CLV inputs | MCP | `get_rfm_scores()`, `get_clv_estimates()` |
| On-site session history | MCP | `get_customer_session_history()` |
| Email engagement | MCP | `get_email_metrics()`, `get_customer_profile()` |
| Product affinity signals | MCP | `get_sku_behavioral_metrics()` |
| Persona definitions | MCP | `get_personas()` |

**Functions:**
- Refresh RFM and CLV scores
- Identify churn-risk customers and surface them to `/send-emails`
- Discover and create emerging micro-segments
- Export scored customer lists for downstream command use

**Outputs:**
- Segment creation → `create_segment()`
- Suppression management → `add_to_suppression_list()`, `remove_from_suppression_list()`
- RFM export → `outputs/reports/rfm-[date].xlsx`
- CLV export → `outputs/reports/clv-[date].xlsx`
- Churn risk report → `outputs/reports/churn-risk-[date].md`

**Cowork task schedule:** Weekly, Sunday 23:00.

**Skill file (`skills/analyze-segments/SKILL.md`):**
```
You are the Customer Insights & Segmentation command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Customer Data, Analytics & Attribution, Behavioral Events
Write: Customer Data (create_segment, add_to_suppression_list,
       remove_from_suppression_list)
Do not execute channel actions.

RUN SEQUENCE
1. Call get_rfm_scores() — export to outputs/reports/rfm-[date].xlsx
2. Call get_clv_estimates() — export to outputs/reports/clv-[date].xlsx
3. Call get_churn_risk_list(threshold: 0.65) — write top 100 to
   outputs/reports/churn-risk-[date].md
4. Sample get_customer_session_history() for high-CLV customers who have not
   purchased in 60+ days — look for behavioral patterns worth segmenting
5. Review existing segments via get_customer_segments()
6. If an emerging micro-segment is identifiable (e.g. "natural wine explorers"
   from session history patterns), call create_segment() with behavioural rules
7. Append any new segment IDs to context/active-campaigns.json
8. Write a customer model summary to outputs/reports/customer-insights-[date].md
9. Log this run to logs/analyze-segments-[date].md
```

---

### Skill: /check-inventory

**Role:** Monitors inventory continuously. Detects overstock and out-of-stock conditions. Submits campaign requests for overstocked SKUs. Immediately pauses ads and email when stock hits zero.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| Real-time inventory counts | MCP | `get_inventory_status()` |
| Overstock SKUs with behavioral interest | MCP | `get_overstock_skus(behavioral_interest_window_days: 7)` |
| High-intent / low-stock SKUs | MCP | `get_high_intent_low_stock_skus()` |
| Active campaign SKUs | File | `context/active-campaigns.json` |
| Current active ads | MCP | `get_paid_metrics()` |
| Seasonal calendar | MCP | `get_seasonal_calendar()` |

**Functions:**
- Poll inventory every 4 hours
- Pause all paid and email activity instantly on out-of-stock detection
- Submit overstock campaign requests to `/plan-campaign` via the queue
- Flag high-intent / low-stock SKUs for restock prioritization

**Outputs:**
- Ad pauses → `pause_ads_for_sku()`
- Email pauses → `pause_campaign_channel(channel: "email")`
- Campaign requests and inventory alerts → MCP via `create_campaign_request()`

**Cowork task schedule:** Every 4 hours. Keep Claude Desktop running for this command to be effective.

**Skill file (`skills/check-inventory/SKILL.md`):**
```
You are the Inventory-Marketing Sync command for a wine e-commerce store.

MCP DOMAINS PERMITTED
Read: Catalog & Inventory, Campaign & Content
Write: Channel Execution (pause_ads_for_sku, pause_campaign_channel only)
MCP write: `create_campaign_request()` only
Do not create campaigns, send emails, or publish posts.

CHANNEL SCOPE RULE
When pausing activity for an out-of-stock SKU, only pause channels that the
campaign is actually using. Read the channels array from context/active-campaigns.json
for each affected campaign before calling any pause function.
- Only call pause_ads_for_sku() if "paid" is in that campaign's channels
- Only call pause_campaign_channel(channel: "email") if "email" is in that campaign's channels
- Only call pause_campaign_channel(channel: "social") if "social" is in that campaign's channels

RUN SEQUENCE
1. Read context/active-campaigns.json — note the channels array for each campaign
2. Collect all SKU IDs across all active campaigns
3. Call get_inventory_status(sku_ids: [all collected SKU IDs])
4. For any SKU with status "out_of_stock":
   a. Find which campaign(s) feature this SKU in context/active-campaigns.json
   b. For each affected campaign, read its channels array:
      - "paid" in channels → call pause_ads_for_sku(sku_id, platforms: ["google","meta","pinterest"])
      - "email" in channels → call pause_campaign_channel(campaign_id, channel: "email")
      - "social" in channels → call pause_campaign_channel(campaign_id, channel: "social")
   c. Call `create_campaign_request()` with:
      {type: "inventory_alert", sku_id, status: "out_of_stock", campaign_id,
       channels_paused: [list of channels actually paused], created_at: [now]}
5. Call get_overstock_skus(threshold_days: 90, behavioral_interest_window_days: 7)
6. For any SKU with days_of_supply > 90:
   a. Check queue/ — skip if a pending campaign_request for this SKU already exists
   b. Call `create_campaign_request()` with:
      {type: "campaign_request", requesting_command: "check-inventory",
       reason: "overstock — [days_of_supply] days of supply",
       sku_ids: [sku_id], priority: "high",
       suggested_campaign_type: "clearance",
       suggested_discount_pct: [suggested_discount_pct from MCP],
       behavioral_interest: {pdp_views, wishlist_adds, cart_adds},
       status: "pending", created_at: [now]}
7. Call get_high_intent_low_stock_skus(intent_threshold: 20, stock_threshold: 30)
8. For any SKU on this list, append a restock priority note to queue/
9. Log this run to logs/check-inventory-[date].md
```

---

### Skill: /review-behavior

**Role:** The analysis and configuration side of on-site behavior. In this Cowork implementation, high-frequency event ingestion runs as a separate external service (see Part 4). This skill handles everything that requires judgment: A/B test creation and winner evaluation, merchandising rule updates, demand gap routing, and on-site intervention configuration.

**Inputs:**
| Input | Source | MCP Function |
|-------|--------|--------------|
| On-site search queries and demand gaps | MCP | `get_search_query_report()`, `get_demand_gap_report()` |
| Funnel drop-off by step | MCP | `get_funnel_drop_off_report()` |
| SKU behavioral metrics for campaign SKUs | MCP | `get_sku_behavioral_metrics()` |
| Active campaigns | MCP | `get_campaign_briefs(status: "active")` |
| Active and completed A/B tests | MCP | `list_ab_tests()`, `get_ab_test_results()` |
| Current merchandising rules | MCP | `get_merchandising_rules()` |
| Campaign type defaults | MCP | `get_campaign_type_defaults()` |

**Functions:**
- Launch A/B tests on PDP urgency messaging, collection sort orders, and checkout flow
- Evaluate completed tests and surface winners for human approval
- Update collection page merchandising rules for active campaigns
- Route zero-result search queries as content and campaign requests
- Configure on-site intervention rules for exit-intent and low-stock urgency

**Outputs:**
- A/B tests → `create_ab_test(campaign_id, sku_id)`
- Merchandising updates → `update_merchandising_rules()`
- Demand gap requests → MCP via `create_campaign_request(request_type: 'zero_result_search', ...)`
- Daily behavior report → `outputs/reports/review-behavior-[date].md`

**Cowork task schedule:** Daily 07:00.

**Skill file (`skills/review-behavior/SKILL.md`):**
```
You are the On-Site Behavior & Experience command for a wine e-commerce store.

CAMPAIGN TYPE BEHAVIOR
Read brief.campaign_type before configuring any A/B test, merchandising rule,
or on-site intervention for a campaign.

  new_arrival
    A/B test: "Just Arrived" badge on PDP (variant) vs. no badge (control)
    Primary metric: add_to_cart_rate
    Merchandising: pin to top of relevant collection page for 14 days
    No urgency interventions — discovery framing only

  promotion
    A/B test: countdown timer urgency banner (variant) vs. "Limited time offer" copy (control)
    Primary metric: add_to_cart_rate
    Configure exit_intent_offer intervention with discount_code from brief
    Merchandising: pin to top of collection page for campaign duration

  limited_allocation
    A/B test: real inventory count display ("Only 11 bottles left" — variant) vs.
      generic "Limited availability" (control)
    Primary metric: add_to_cart_rate
    Configure low_stock_urgency auto-intervention to fire when inventory < 20 units
    Merchandising: pin to top; update rule with expires_at matching campaign end_date
    Watch cart_abandon_rate closely — flag spikes immediately

  seasonal
    A/B test: seasonal homepage hero (variant) vs. evergreen hero (control)
    Primary metric: collection_page_click_rate
    No product-level urgency — this is occasion framing, not scarcity

  winback
    SKIP A/B tests and merchandising rules — winback customers arrive via email link
    Configure exit_intent_offer for when they land from the email (if brief includes offer)
    Track scroll_depth and dwell_time on the PDP they land on

  educational
    A/B test: CTA placement at end of blog post (variant: inline CTA vs.
      control: footer CTA only)
    Primary metric: pdp_click_rate from the blog page
    No urgency interventions on the PDP itself — let the content do the work

  bundle
    A/B test: "Frequently bought together" module format on PDP
      (variant: explicit bundle pricing vs. control: individual products listed)
    Primary metric: add_to_cart_rate for both SKUs together
    Configure cross_sell_drawer intervention to fire when one bundle component
      is in cart but not the other

  pre_order
    A/B test: reservation CTA copy ("Reserve your case" variant vs.
      "Join the waitlist" control)
    Primary metric: reservation_completion_rate
    Merchandising: pin to top with a "Coming [month]" label
    No inventory-based urgency — urgency is allocation-based, stated in the copy

MCP DOMAINS PERMITTED
Read: Behavioral Events (analysis functions), Campaign & Content, Catalog & Inventory
Write: Behavioral Events (update_merchandising_rules, create_ab_test,
       trigger_onsite_intervention — using anonymous_id for anonymous sessions)
MCP write: `create_campaign_request()` only

RUN SEQUENCE
1. Call get_search_query_report() for last 7 days — for any zero-result query
   with search_count > 10, append a seo_content_request to queue/
2. Call get_demand_gap_report() — for new gaps not already in queue/: append entries
3. Call get_funnel_drop_off_report() — identify the worst single drop-off step
   and note it in the daily report
4. Call get_campaign_briefs(status: "active"). For each active campaign:
   a. Call get_sku_behavioral_metrics(sku_id, date_range: last 7 days)
   b. Call list_ab_tests(campaign_id, status: "running") — if no test is running:
      call create_ab_test(config: {name: "[campaign] PDP urgency test",
      page_type: "pdp", element: "urgency_banner",
      variants: [{id: "control", description: "no banner", traffic_split_pct: 50},
                 {id: "variant_a", description: "low stock + discount banner", traffic_split_pct: 50}],
      primary_metric: "add_to_cart_rate", min_sample_size: 400,
      max_duration_days: 21, campaign_id, sku_id})
   c. Call update_merchandising_rules(collection_id, rules: [{rule_type: "pin_to_top",
      sku_id, priority: 1, position: 1}], expires_at: campaign.end_date)
5. Call list_ab_tests(status: "complete") — for any completed test with a winner:
   present statistical results to the user and wait for explicit approval before
   calling update_merchandising_rules() to promote the winner to production
6. Write daily behavior report to outputs/reports/review-behavior-[date].md
7. Log this run to logs/review-behavior-[date].md

APPROVAL GATE
Before promoting any A/B test winner to production, present the p_value, lift_pct,
and sessions per variant. Wait for explicit user confirmation.
```

---

### Skill: /trace-campaign *(human-initiated, on-demand)*

**Role:** Synthesises the full execution history of any campaign into a single narrative document. Shows how each command made autonomous decisions, what data it acted on, how those decisions flowed between commands, and — when results are available — whether the campaign performed against its targets.

This skill makes no changes to any data. It is read-only, produces a single markdown document, and can be run at any point during or after a campaign. It is how you answer the question "what did the system actually do, and why?"

**When to run:**
- After a campaign brief is approved, to see how the strategy was constructed
- After content is generated, to understand what copy decisions were made and why
- After the campaign launches, to see the full execution chain so far
- After the campaign closes, to get the full trace enriched with performance results and retrospective learnings

**How to initiate:** Run `/trace-campaign` in Cowork and describe which campaign you want to trace. You do not need to know the campaign ID — the command searches `context/active-campaigns.json`, `outputs/campaigns/`, and the MCP by name. Examples:

- *"Trace the Bordeaux promotion"*
- *"Show me the campaign trace for the Barolo new arrival"*
- *"Give me the full trace for camp-2291 with results"*

If your description matches more than one campaign, the command lists the matches and asks you to confirm which one.

**MCP domains:** Analytics & Attribution (read), Campaign & Content (read), Channel Execution (read — metrics only), Behavioral Events (read — analysis only)

**File access:** All `logs/`, `outputs/campaigns/`, `outputs/content/`, `outputs/retrospectives/`, `context/`. The command reads log files for every command that ran during the campaign's date range to surface the decisions and reasoning each command recorded — answering not just "what happened" but "why." Missing log files are noted in the trace document but do not block completion.

**Output:** A single markdown file written to `outputs/traces/[campaign-name]-trace-[date].md`

**Cowork task schedule:** On-demand only. No scheduled run.

**Skill file (`skills/trace-campaign/SKILL.md`):**
```
You are the /trace-campaign command for a wine e-commerce store. Your job is to
reconstruct the full decision chain for a specific campaign and write it as a
clear, connected narrative document. You are read-only — you make no changes
to any data, queue, or MCP state.

STEP 1 — IDENTIFY THE CAMPAIGN
Ask the user which campaign they want to trace if they haven't specified one.
Read context/active-campaigns.json and list any campaigns that match the description.
If exactly one match: confirm it and proceed.
If multiple matches: list them and ask the user to confirm which one.
If no match in active-campaigns.json: search outputs/campaigns/ for brief files,
then call get_campaign_briefs() to search the MCP by name.

Once identified, note:
  - campaign_id
  - campaign_type
  - channels
  - campaign status (draft / active / paused / completed)
  - start_date and end_date

STEP 2 — DETERMINE TRACE MODE
  DURING EXECUTION (status: "active" or "paused"):
    Collect everything available so far. Note clearly which commands have run
    and which are yet to run. Performance data will be preliminary.
    Label the document: "Campaign Trace — In Progress"

  POST-CAMPAIGN (status: "completed"):
    Collect the full record including retrospective. Performance data is final.
    Label the document: "Campaign Trace — Complete"

STEP 3 — COLLECT THE RECORD
Read every available source for this campaign, in this order:

  a. Campaign origin
     Call `get_campaign_requests()` — find the request that originated this campaign.
     Was it human-initiated (requesting_command: "human") or autonomously detected
     (requesting_command: "check-inventory", etc.)? Note the original request text,
     the stated reason, and any type-specific fields (discount_pct, arrival_date, etc.)

  b. /plan-campaign decisions
     Read outputs/campaigns/[campaign-name]-brief.md
     Read logs/plan-campaign-[date].md for the run that created this campaign
     Call get_campaign_briefs(status: any) and find this campaign_id
     Note: what signals did /plan-campaign read? What segment did it create?
     What campaign_type and channels did it choose and why (read the notes field)?
     What KPIs did it set? What was the human approval response?

  c. /analyze-segments contribution
     Call get_customer_segments() — find the target_segment_id
     Read logs/analyze-segments-[date].md for the most recent run before campaign launch
     Note: what defines this segment? What is the CLV profile? What persona does it map to?

  d. Content generation decisions
     Read outputs/content/[campaign-id]-copy.md
     Read logs/generate-content-[date].md for the run that produced content for this campaign
     Call get_content_assets(campaign_id) — list all assets produced
     Note: what campaign_type behavior was applied? What copy angle was chosen?
     Which subject line variants were created? What persona was the copy written for?
     Which assets were approved / rejected by the human reviewer?

  e. Personalization decisions
     Read logs/update-personalization-[date].md for the relevant run
     Note: was a boost applied? What boost_factor and contexts? Why (or why not, for email-only)?

  f. On-site behavior configuration
     Read logs/review-behavior-[date].md for the relevant run
     Call list_ab_tests(campaign_id) — what test was set up and why?
     Call get_merchandising_rules() for the relevant collection — what rules were applied?
     Note: what campaign_type A/B test design was chosen?

  g. Email execution (if "email" in channels)
     Read logs/email-[date].md for all runs during the campaign window
     Call get_email_metrics() for each send_id recorded in outputs/campaigns/
     Note: what send cadence was used (matches campaign_type behavior)?
     Were reminder sends triggered? Was suppression applied? How many recipients?

  h. Paid media execution (if "paid" in channels)
     Read logs/manage-ads-[date].md for runs during the campaign window
     Call get_paid_metrics(source_campaign_id: campaign_id)
     Note: what campaign_type behavior was applied (or was paid skipped and why)?
     What bidding strategy? What audiences? What ROAS achieved vs. target?

  i. Social media execution (if "social" in channels)
     Read logs/publish-social-[date].md for runs during the campaign window
     Call get_social_metrics(campaign_id: campaign_id)
     Note: what post cadence? What engagement achieved?

  j. Inventory events during campaign
     Read logs/check-inventory-[date].md for runs during the campaign window
     Call `get_campaign_requests()` — find any inventory_alert entries for this campaign
     Note: did any out-of-stock events occur? Were channels paused? When?

  k. Analytics and retrospective (post-campaign mode only)
     Read outputs/retrospectives/[campaign-id]-retro.md if it exists
     Call get_campaign_retrospective(campaign_id) from MCP
     Call get_performance_summary(campaign_id: campaign_id)
     Call get_attribution_report(campaign_id: campaign_id)
     Note: actual KPIs vs. targets, attribution split by channel, learnings recorded

STEP 4 — WRITE THE TRACE DOCUMENT

Write a single markdown file to outputs/traces/[campaign-name]-trace-[date].md
using the structure below. Write in plain, connected prose — this is a narrative,
not a data dump. Every section should explain not just what happened but why the
command made that choice and how it connected to the next step.

The trace document you produce should follow this structure:

```markdown
# Campaign Trace: [Campaign Name]
*Type: [campaign_type] | Status: [status] | Channels: [channels]*
*Trace generated: [date] | Campaign: [start_date] → [end_date]*

---

### Origin: How This Campaign Came to Exist

[Was this autonomously detected or human-initiated? What was the triggering signal
or request? Quote the original request if human-initiated. Describe the data signal
if autonomous (e.g. "Inventory Sync detected 147 days of supply on SKU-0042 at the
current sell-through rate of 1.36 units/day, with 312 PDP views in the prior 7 days
suggesting latent demand.").]

---

### Campaign Strategy: How the Brief Was Built

**Campaign type assigned:** [type] — [one sentence rationale]
**Target audience:** [segment name and why this segment was chosen for this type]
**Persona fit:** [which of the five personas this segment maps to and why]
**Channels selected:** [channels] — [rationale per channel, e.g. "paid included because
promotion campaigns benefit from intent capture via Shopping; social included for offer
amplification"]
**Key autonomous decisions made:**
- [Decision 1: e.g. "Chose Bordeaux Loyalists — Lapsed 60d segment rather than the
  broader active subscriber list, reasoning that lapsed high-CLV customers have higher
  reactivation potential for a clearance offer than cold prospects"]
- [Decision 2, etc.]
**KPIs set:** [list with targets]
**Human approval:** [what the human confirmed, any changes requested]

---

### Customer Insights: Who Was Targeted

**Segment:** [name]
**Definition:** [rules that define this segment]
**Size at campaign launch:** [N customers]
**CLV profile:** [avg CLV, median CLV]
**Persona:** [persona name] — [1–2 sentences on why this persona fits]
**Notable behavioral signals in this segment:** [e.g. "Members of this segment have
viewed Bordeaux PDPs 3.2× more often than their purchase rate would predict, indicating
strong interest that hasn't converted — which informed the clearance angle"]

---

### Content Generation: What Was Created and Why

**Campaign type behavior applied:** [e.g. "promotion — offer-forward with wine story as justification"]
**Copy angle chosen:** [the strategic angle and why it fit this persona + campaign type]
**Assets produced:** [list by channel]
**Key content decisions:**
- [e.g. "Subject line A led with the discount ('15% off today') while subject line B
  led with urgency ('Your Bordeaux window is closing'). Both were written for the
  Deal Seeker / Loyalist overlap in the target segment."]
- [e.g. "PDP short_description was updated to include the offer alongside the existing
  tasting notes, maintaining the story while surfacing the value for deal-motivated visitors"]
**Human approval outcome:** [what was approved, what (if anything) was rejected]

---

### Personalization: On-Site Experience Configuration

**Boost applied:** [yes/no — if no, why not]
**Boost factor:** [e.g. 1.3×]
**Contexts boosted:** [list]
**Rationale:** [e.g. "Promotion campaigns receive a 1.3× boost across all contexts
to surface the featured SKU for visitors who may not be in the target email segment
but are actively browsing."]

---

### On-Site Behavior: Tests and Merchandising

**A/B test configured:** [test name, variants, primary metric]
**Test rationale:** [why this test design for this campaign type]
**Merchandising rules applied:** [what was pinned/boosted and for how long]
**Intervention configured:** [exit-intent, low-stock urgency, etc. — or none]

---

### Email Execution [omit section if "email" not in channels]

**Send cadence used:** [matches campaign_type behavior? note if it deviated and why]
**Send 1:** [date, recipients, subject line variant used]
**Send 2 (if applicable):** [date, trigger — e.g. "non-openers from send 1"]
**Final send (if applicable):** [date]
**Suppression applied:** [how many customers suppressed, reason]
**Preliminary metrics:** [open rate, CTR, conversion rate — or "pending" if too early]

---

### Paid Media Execution [omit section if "paid" not in channels]

**Activation decision:** [launched / skipped — if skipped, state the campaign_type rule]
**Campaigns created:** [platform, type, budget, audience]
**Bidding strategy:** [and target]
**Preliminary metrics:** [spend, ROAS, CPA — or "pending"]

---

### Social Media Execution [omit section if "social" not in channels]

**Post cadence:** [what was planned vs. what ran]
**Posts published:** [count by platform]
**Preliminary engagement:** [impressions, engagement rate — or "pending"]

---

### Inventory Events During Campaign

[If no inventory events: "No stock events affected this campaign during its flight."]
[If events occurred: describe each — when stock dropped, which channels were paused,
how the system responded, and whether the pause affected performance.]

---

### Results and Retrospective [post-campaign mode only — omit if in-progress]

**Actual KPIs vs. targets:**
| KPI | Target | Actual | Result |
|-----|--------|--------|--------|
| [metric] | [target] | [actual] | ✓ / ✗ |

**Attribution by channel:**
| Channel | Revenue attributed | Share |
|---------|--------------------|-------|
| [channel] | $[amount] | [%] |

**What worked:**
- [Finding 1 from retrospective learnings]
- [Finding 2]

**What to do differently:**
- [Recommendation 1]
- [Recommendation 2]

**Retrospective stored:** [yes / not yet — if yes, can be read by Campaign Strategy
on its next planning run]

---

### How the Commands Connected

[Write 3–5 sentences in plain prose summarising how the commands built on each other's
work. E.g. "/check-inventory's detection of the overstock gave /plan-campaign the
signal it needed to propose a clearance campaign rather than a new arrival. /plan-campaign's
choice of the Loyalists — Lapsed 60d segment directly shaped the copy angle
/generate-content chose — rather than a generic promotional tone, the email leaned into
the relationship and used the limited-time framing as a reason to reconnect, not
just a discount. The A/B test /review-behavior configured (urgency banner vs. no banner)
was designed to capture the additional demand /send-emails was driving to the PDP."]
```

---

```
STEP 5 — CONFIRM OUTPUT
Tell the user: "Campaign trace written to outputs/traces/[filename].md
[If in-progress: 'X of 13 commands have run for this campaign. Re-run this task after
[next expected milestone] to add results data.']
[If complete: 'The retrospective is stored in the MCP and will inform the next
Campaign Strategy planning run.']"
```

---

### Skill: /inspect-customer *(human-initiated, on-demand)*

**Role:** Produces a comprehensive 360° profile of any individual customer on demand. When you provide a customer ID (or email address), the command pulls data across five MCP domains — base profile, behavioral session history, product affinity, real-time recommendations, and suppression status — and synthesises them into a structured customer brief with a suggested next action.

This skill is read-only. It makes no changes to scores, segments, suppression lists, or any other data. It is how you answer the question "who is this customer, and what should we do with them?"

**When to run:**
- Before deciding whether to include a specific customer in a campaign
- When a customer service query requires understanding full purchase and engagement history
- To assess a high-CLV customer before any outreach decision
- To understand why a customer is suppressed and when that suppression expires
- To identify the best product recommendations for a customer for any upcoming campaign

**How to initiate:** Run `/inspect-customer` in Cowork and provide a customer identifier. Examples:

- *"Inspect customer cust-0042"*
- *"Give me the full profile for cust-0317"*
- *"Look up customer jane.smith@example.com"*

**MCP domains:** Customer Data & Segmentation (read), Behavioral Events (read — session history only), Personalization & Recommendations (read)

**MCP tools called (in order):**
1. `get_customer_profile(customer_id)` — base 360 profile including RFM, CLV, varietal affinities, segment membership, email engagement
2. `get_customer_session_history(customer_id, limit=5)` — last 5 sessions with intent scores, funnel stage, SKUs engaged
3. `get_product_affinity(customer_id, limit=10)` — top 10 SKUs by varietal affinity and price fit
4. `get_recommendations(customer_id, context="email", limit=5)` — real-time recommendations with campaign boost signals
5. `is_suppressed(customer_id)` — active suppressions, reasons, and expiry dates
6. `get_personas()` — all persona definitions, to map the customer's profile to the matching persona archetype

**Output format:** Structured brief with sections for Scoring (RFM, CLV, churn risk, upsell propensity), Purchase Engagement, Preferences and Segments, Recent Sessions with intent trend, Top Recommendations, Suppression Status, and a Suggested Next Action derived from the customer's lifecycle stage, churn risk, engagement pattern, and suppression state.

**Suggested Next Action logic:**
- `churn_risk > 0.70` → WINBACK PRIORITY — flag for `/send-emails` winback flow
- `upsell_propensity > 0.60` and not suppressed → UPSELL CANDIDATE — suitable for premium upsell campaign
- `email_open_rate < 0.10` and last purchase > 90 days → RE-ENGAGEMENT — consider dormancy flow
- First purchase within 60 days → WELCOME SERIES CHECK — confirm onboarding emails delivered
- Active suppression → SUPPRESSION HOLD — no outreach until suppression lifts or expires
- Otherwise → MONITOR — no immediate action

**Cowork task schedule:** On-demand only. No scheduled run.

**Skill file (`skills/inspect-customer/SKILL.md`):**
See `cowork-plugin/skills/inspect-customer/SKILL.md` for the full prompt.

---

Commands in Cowork do not run simultaneously and cannot call each other directly. All inter-command communication passes through MCP tools.

### Campaign Request Queue (MCP)

Every command that needs to submit or retrieve campaign requests uses the MCP tool functions. Only `/plan-campaign` may mark requests "accepted" or "rejected" via `update_campaign_request()`.

**MCP functions:**
- `create_campaign_request(params)` — submit a new campaign request, content request, SEO content request, or inventory alert
- `get_campaign_requests(status?, request_type?, sku_id?)` — retrieve requests matching the given filters; `/plan-campaign` calls this with `status: 'pending'` at the start of each run
- `update_campaign_request(request_id, updates)` — update the status or fields of an existing request; used by `/plan-campaign` to mark entries accepted or rejected

**Parameters passed to `create_campaign_request()`:**

| Field | Type | Description |
|-------|------|-------------|
| `request_type` | string | `campaign_request`, `content_request`, `seo_content_request`, or `inventory_alert` |
| `requesting_command` | string | Command that created the request, or `"human"` for operator-initiated requests |
| `status` | string | `pending` \| `accepted` \| `rejected` |
| `priority` | string | `low` \| `medium` \| `high` \| `urgent` |
| `sku_ids` | string[] | SKU IDs relevant to this request |
| `reason` | string | Free-text reason or description |
| `suggested_campaign_type` | string | e.g. `clearance`, `new_arrival` |
| `suggested_discount_pct` | number \| null | Suggested discount |
| `behavioral_interest` | object \| null | `{pdp_views, wishlist_adds, cart_adds}` |
| `content_type` | string \| null | For content requests |
| `topic` | string \| null | For SEO content requests |
| `target_keywords` | string[] \| null | For SEO content requests |
| `campaign_id` | string \| null | Associated campaign ID |
| `channels_paused` | string[] \| null | For inventory alerts |
| `created_at` | ISO datetime | Set automatically |
| `notes` | string \| null | Additional instructions |

For inventory_alert entries, `channels_paused` lists only the channels that were actually paused (those present in the campaign's channels array). For example, an email-only campaign that goes out-of-stock will produce `"channels_paused": ["email"]` — not `["email","paid","social"]`.

### Approval Records (MCP)

Gate approval decisions are recorded and retrieved via MCP tools. There is no local approval queue file — all approval state is managed through the MCP.

**MCP functions:**
- `create_approval_record(campaign_id, gate, decision, channel?, asset_ids?)` — record a gate approval or rejection; called by `/generate-content` after the human approves each channel's copy
- `get_approval_records(campaign_id?, gate?, decision?)` — retrieve approval records matching the given filters; called by `/send-emails`, `/manage-ads`, and `/publish-social` to confirm assets are approved before executing sends

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `campaign_id` | string | The campaign this approval belongs to |
| `gate` | number | Gate number: 1 (brief), 2 (content), 3 (creative), 4 (A/B winner) |
| `decision` | string | `approved` \| `rejected` |
| `channel` | string \| null | Channel approved, e.g. `email`, `paid`, `social` |
| `asset_ids` | string[] \| null | Asset IDs covered by this approval record |
| `approved_by` | string | Name of the human who approved |
| `created_at` | ISO datetime | Set automatically |

---

## Part 4: Scheduled Task Configuration

Commands fall into two categories. **Always-on commands** run continuously on a fixed schedule regardless of campaign state — they poll for whatever needs doing and self-correct. **Event-triggered commands** have a primary trigger (a specific milestone) and a fallback schedule that catches anything missed.

The most important operational rule: **after any approval gate, manually trigger the commands that depend on it immediately.** Don't wait for the next scheduled run. Cowork supports on-demand invocation alongside scheduled runs.

| Command | Primary trigger | Fallback schedule |
|---------|----------------|------------------|
| Campaign Request (Command 0) | You invoke it | None |
| /plan-campaign | Immediately after you use Campaign Request | Weekly Mon 08:00 |
| /generate-content | Immediately after brief is approved | Weekly Mon 10:00 |
| /seo-audit | Monthly audit | Monthly 1st Mon 09:00 |
| /send-emails | Daily schedule — self-correcting | Daily 07:30 |
| /manage-ads | Immediately after brief is approved | Daily 08:00 |
| /publish-social | Immediately after content assets approved | Weekly Mon 09:00 |
| /update-personalization | Daily schedule — self-correcting | Daily 06:00 |
| /performance-report | Daily schedule + immediately after campaign closes | Daily 06:30 |
| /analyze-segments | Weekly model refresh | Weekly Sun 23:00 |
| /check-inventory | Continuous monitoring | Every 4 hours |
| /review-behavior | Daily schedule — self-correcting | Daily 07:00 |
| /trace-campaign | You invoke it | None |
| /inspect-customer | You invoke it with a customer ID | None |

### What to run after each approval gate

**After approving a campaign brief (Gate 1):**
Run `/generate-content` and `/manage-ads` immediately. Don't wait until Monday or 08:00 the next day — a same-day brief means you want the campaign moving now.

**After approving content assets (Gate 2):**
Run `/publish-social` immediately so it can plan posts with the newly approved assets. `/send-emails` and `/manage-ads` will self-correct on their next daily run (within hours), so manual triggering is optional but speeds things up.

**After approving a creative asset (Gate 3):**
No manual trigger needed — `/publish-social` and `/manage-ads` pick up newly approved creative assets on their next scheduled run.

**After approving an A/B test winner (Gate 3):**
No manual trigger needed — `/review-behavior`'s daily run will have already applied the winner if you approved in-session.

**After a campaign closes:**
Run `/performance-report` immediately for the retrospective, then run `/trace-campaign` if you want the narrative document.

**After using Campaign Request:**
Run `/plan-campaign` immediately if the campaign is time-sensitive. Otherwise wait for Monday's scheduled run.

Scheduled tasks only execute while Claude Desktop is open. For overnight and unattended execution, run the app on a dedicated machine or laptop left open.

---

## Part 5: External Services

Two capabilities cannot run inside Cowork and require lightweight external services. Both are small serverless functions deployable to AWS Lambda, Cloudflare Workers, or Vercel Edge Functions.

### External Service 1: Behavioral Event Ingestion

**What it does:** Receives events from the website's tracking SDK (`page_view`, `pdp_view`, `add_to_cart`, `search_query`, `purchase`, etc.) and writes them to the MCP via `log_session_event()`.

**Why it cannot be Cowork:** `log_session_event` fires thousands of times per day from every visitor's browser. Cowork is not a persistent HTTP server and cannot receive inbound requests.

**What to build:** A single HTTP endpoint (~50 lines) that receives POST requests from the website tracking SDK, validates the event shape, calls `log_session_event()` on the MCP, and returns 200. The Cowork `/review-behavior` command reads the accumulated data from the MCP on its daily run — it never needs to receive events directly.

**Fallback if skipped:** The system operates without real-time behavioral data. On-site search reports, demand gaps, funnel drop-off reports, and SKU behavioral metrics will be unavailable. Personalization and Email trigger quality degrades significantly. This service is important.

### External Service 2: Real-Time Behavioral Triggers

**What it does:** Subscribes to behavioral trigger webhooks from the MCP and fires cart-abandonment emails and exit-intent interventions with low latency.

**Why it cannot be Cowork:** `watch_behavioral_triggers` requires a persistent HTTPS endpoint. The `/send-emails` command's daily polling cadence is too slow for cart abandonment (industry norm: fire 45–60 minutes after abandon, not 24+ hours later).

**What to build:** A serverless function that at startup calls `watch_behavioral_triggers()` on the MCP to register webhook subscriptions for `cart_abandon` and `exit_intent` trigger types, with `auto_intervention` configured for exit-intent so the MCP fires the UI intervention directly without a round-trip. When a cart-abandon webhook fires, the function calls `trigger_behavioral_email(event_type: "cart_abandon", customer_id, sku_id, delay_minutes: 45, suppress_if_purchased: true)`.

**Fallback if skipped:** Configure `/send-emails` to check `get_high_intent_customers(signal: "cart_abandon", window_hours: 24)` on its daily run and trigger winback emails for the previous day's abandons. You lose same-session response but maintain the flow with a 24-hour lag.

---

## Part 6: Human-in-the-Loop Workflow

Five moments require explicit human approval in Cowork before the system proceeds. These are enforced by the task prompts (commands declare they will wait for confirmation) and by the MCP server (certain write operations structurally require an `approved_by` field).

### Gate 1: Campaign Brief Activation

After `/plan-campaign` creates briefs, it presents a summary table in the task output. Review it, then confirm "approve campaign [campaign-id]" or "edit campaign [campaign-id] — [your changes]." Cowork then calls `update_campaign_status(campaign_id, "active", approved_by: "[your name]")`. Briefs not explicitly approved remain in draft status — no downstream command will act on them.

### Gate 2: Content Asset Approval

After `/generate-content` runs, it presents the full copy package in the Cowork task output and asks for your approval channel by channel. You review the copy there — in the conversation — and type your confirmation. For each channel you approve, Cowork calls `approve_content_asset(asset_id, approved_by)` on the MCP, which marks those assets as `status: "approved"`. The command calls `create_approval_record(campaign_id, gate: 2, decision: 'approved', channel, asset_ids)` to record each gate decision via MCP, so downstream skills can check approval status via `get_approval_records()`. Your only action is typing your response in the task conversation.

### Gate 3: Creative Asset Approval

When creative images are uploaded via `upload_creative_asset()`, they land at `status: "pending_review"` in the MCP. `/generate-content` presents image URLs and requests approval. On confirmation, the MCP marks them approved and they become available to `/publish-social` and `/manage-ads`.

### Gate 4: A/B Test Winner Promotion

When `/review-behavior` finds a completed test with a statistically significant winner, it presents the result — test name, winning variant, lift percentage, p-value, session count — and waits for explicit confirmation before calling `update_merchandising_rules()` to promote the winner to 100% of traffic.

Example output before the gate:

```
A/B TEST RESULT — AWAITING YOUR APPROVAL

Test: Bordeaux PDP urgency banner vs. none
Winner: variant_a (low stock + discount urgency banner)
Add-to-cart lift: +18.3%  |  p-value: 0.021  |  847 sessions per variant

If approved, I will update merchandising rules to show the urgency banner
to 100% of visitors on SKU-0042's PDP.

To proceed: confirm "promote variant_a for test [test-id]"
```

### Gate 5: Campaign Cancellation

No command can cancel a campaign — only pause individual channels. Full cancellation requires you to explicitly instruct Cowork. When you do, Cowork presents the full impact — which channels were active, which sends to cancel, which ads to pause, which posts to unschedule — scoped only to the channels the campaign was actually using. An email-only campaign cancellation will show email sends to cancel and nothing else. Cowork waits for confirmation before calling `update_campaign_status(campaign_id, "cancelled", reason)`.

---

## Part 7: Unified Marketing MCP Server

The MCP server is the shared data layer for all 13 commands. It is organized into 7 domains and exposes 53 fully typed functions. All commands authenticate via a single Cowork connector API key. Scope enforcement is implemented at the prompt level in each command's task template; for production deployments, back this with domain-level read/write flags configured per API key at the MCP server layer.


---

### Server Identity

```
name: wine-marketing-mcp
version: 5.0.0
transport: stdio | HTTP/SSE
auth: Single Cowork connector API key (scope enforced at prompt level per command task)
```

---

### Shared Type Definitions

The following types are referenced across multiple domains.

```typescript
// Date range used across all query functions
DateRange = {
  start: string          // ISO 8601 date: "2025-01-01"
  end: string            // ISO 8601 date: "2025-03-31"
}

// Reusable segment rule building block
SegmentRule = {
  field: string          // e.g. "purchase_count", "last_purchase_days_ago", "varietal_affinity", "pdp_views"
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "contains"
  value: string | number | string[]
  window_days?: number   // rolling time window for behavioral rules
}

// Reusable social post shape
SocialPost = {
  caption: string
  image_url: string
  hashtags: string[]
  link_url?: string
}
```

---

### Domain 1: Catalog & Inventory

---

#### `get_product_catalog`

Returns the full or filtered product catalog with all attributes needed for marketing use.

```typescript
Parameters:
  filters?: {
    varietal?: string                  // e.g. "Pinot Noir", "Chardonnay"
    region?: string                    // e.g. "Burgundy", "Napa Valley"
    price_range?: {
      min?: number                     // minimum price in USD
      max?: number                     // maximum price in USD
    }
    vintage?: number                   // e.g. 2019
    in_stock?: boolean                 // if true, exclude out-of-stock SKUs
    sort_by?: "price_asc" | "price_desc" | "margin_desc" | "velocity_desc"
    limit?: number                     // default: 100
    offset?: number                    // for pagination, default: 0
  }

Returns:
  {
    products: [
      {
        sku_id: string
        name: string
        varietal: string
        region: string
        sub_region?: string
        vintage: number
        price: number
        cost: number
        margin: number                 // gross margin as decimal (e.g. 0.42)
        image_url: string
        pdp_url: string
        tasting_notes: string
        winemaker: string
        winery: string
        inventory_count: number
        sell_through_velocity: number  // units sold per day (30-day avg)
        rating?: number                // avg customer rating 0–5
        review_count?: number
      }
    ]
    total_count: number
  }
```

---

#### `get_inventory_status`

Returns real-time stock status for one or more SKUs.

```typescript
Parameters:
  sku_ids: string[]                    // one or more SKU IDs; required

Returns:
  {
    results: [
      {
        sku_id: string
        quantity_on_hand: number
        reorder_threshold: number
        days_of_supply: number         // at current sell-through velocity
        status: "in_stock" | "low" | "out_of_stock"
        incoming_shipment_eta?: string // ISO 8601 date, if known
      }
    ]
  }
```

---

#### `get_overstock_skus`

Returns SKUs with excess supply relative to current sell-through velocity — candidates for promotional treatment. Optionally bundles behavioral interest metrics so callers can assess latent demand without a separate Domain 7 call.

```typescript
Parameters:
  threshold_days: number               // flag SKUs with more than N days of supply; required
  min_inventory?: number               // only include SKUs with at least N units on hand; default: 1
  varietal?: string                    // filter to a specific varietal
  region?: string                      // filter to a specific region
  sort_by?: "days_of_supply_desc" | "margin_desc" | "inventory_value_desc"
  limit?: number                       // default: 50
  behavioral_interest_window_days?: number  // if set, bundles pdp_views, wishlist_adds, cart_adds
                                            // for each SKU over this many days (default: 7)

Returns:
  {
    skus: [
      {
        sku_id: string
        name: string
        days_of_supply: number
        quantity_on_hand: number
        inventory_value: number        // quantity × cost
        sell_through_velocity: number
        margin: number
        suggested_discount_pct?: number  // model-suggested promotional depth
        behavioral_interest?: {        // only present if behavioral_interest_window_days is set
          pdp_views: number
          wishlist_adds: number
          cart_adds: number
          window_days: number
        }
      }
    ]
  }
```

---

#### `get_high_intent_low_stock_skus`

Returns SKUs with high browse or wishlist activity but low remaining inventory — used to prioritize restock decisions and surface urgency signals.

```typescript
Parameters:
  intent_threshold: number             // minimum pdp_views in the last 7 days; required
  stock_threshold: number              // maximum quantity_on_hand to qualify; required
  window_days?: number                 // behavioral lookback window in days; default: 7

Returns:
  {
    skus: [
      {
        sku_id: string
        name: string
        quantity_on_hand: number
        pdp_views_in_window: number
        wishlist_adds_in_window: number
        cart_adds_in_window: number
        restock_urgency_score: number  // composite 0–100
      }
    ]
  }
```

---

#### `watch_inventory_alerts`

Subscribes to real-time webhook notifications when a SKU's stock status changes.

```typescript
Parameters:
  webhook_url: string                  // HTTPS endpoint to receive POST payloads; required
  sku_ids?: string[]                   // if omitted, subscribes to all SKUs
  alert_on?: ("out_of_stock" | "low" | "restocked")[]  // default: all three

Returns:
  {
    subscription_id: string
    status: "active"
    sku_count: number
  }

Webhook payload shape:
  {
    event: "out_of_stock" | "low" | "restocked"
    sku_id: string
    quantity_on_hand: number
    timestamp: string                  // ISO 8601
  }
```

---

#### `update_product_metadata`

Updates marketing-owned content fields on a product record. Used by `/generate-content` after copy generation.

```typescript
Parameters:
  sku_id: string                       // required
  fields: {
    tasting_notes?: string
    seo_description?: string           // max 320 characters
    pairing_suggestions?: string[]     // e.g. ["duck confit", "aged cheeses"]
    short_description?: string         // used in email and social snippets, max 160 characters
  }

Returns:
  {
    sku_id: string
    updated_fields: string[]
    updated_at: string                 // ISO 8601
  }
```

---

### Domain 2: Customer Data & Segmentation

---

#### `get_customer_segments`

Returns all defined customer segments with membership counts and the rules defining them.

```typescript
Parameters:
  include_rules?: boolean              // if true, returns full SegmentRule[] per segment; default: false

Returns:
  {
    segments: [
      {
        segment_id: string
        name: string
        description: string
        member_count: number
        avg_clv: number
        avg_order_value: number
        rules?: SegmentRule[]
        created_at: string
        last_refreshed_at: string
      }
    ]
  }
```

---

#### `get_customers_in_segment`

Returns a paginated list of customers belonging to a segment.

```typescript
Parameters:
  segment_id: string                   // required
  limit?: number                       // records per page; default: 100, max: 1000
  offset?: number                      // pagination offset; default: 0
  include_fields?: ("email" | "clv" | "rfm" | "last_purchase_date" | "propensity_scores")[]
                                       // default: all fields

Returns:
  {
    segment_id: string
    total_count: number
    customers: [
      {
        customer_id: string
        email: string
        clv: number
        rfm_tier: string               // e.g. "Champions", "At Risk", "New Customers"
        rfm_score: number              // composite 1–5
        last_purchase_date: string
        propensity_scores?: {
          upsell: number               // 0–1
          churn: number                // 0–1
          reactivation: number         // 0–1
        }
      }
    ]
  }
```

---

#### `get_customer_profile`

Returns the full marketing profile for a single customer.

```typescript
Parameters:
  customer_id: string                  // required

Returns:
  {
    customer_id: string
    email: string
    first_name: string
    last_name: string
    location: {
      city: string
      state: string
      country: string
    }
    acquisition_channel: string
    acquisition_date: string
    lifecycle_stage: "new" | "active" | "at_risk" | "lapsed" | "churned"
    clv: number
    rfm_tier: string
    rfm_scores: { recency: number, frequency: number, monetary: number }
    purchase_history: [
      {
        order_id: string
        order_date: string
        total: number
        items: [{ sku_id: string, quantity: number, price: number }]
      }
    ]
    email_engagement: {
      open_rate_30d: number
      ctr_30d: number
      last_open_date: string
      unsubscribed: boolean
    }
    segment_memberships: string[]      // list of segment_ids
    propensity_scores: {
      upsell: number
      churn: number
      reactivation: number
    }
    top_varietal_affinities: string[]  // ranked list of varietal preferences
  }
```

---

#### `get_rfm_scores`

Returns RFM scores for the full customer base or as-of a historical date.

```typescript
Parameters:
  as_of_date?: string                  // ISO 8601 date for point-in-time snapshot; default: today
  segment_id?: string                  // filter to a specific segment
  min_rfm_score?: number               // filter to customers above a threshold (1–5)
  limit?: number                       // default: no limit

Returns:
  {
    as_of_date: string
    customers: [
      {
        customer_id: string
        email: string
        recency_score: number          // 1–5; 5 = purchased most recently
        frequency_score: number        // 1–5; 5 = most frequent buyer
        monetary_score: number         // 1–5; 5 = highest spender
        rfm_composite: number          // average of R, F, M scores
        rfm_tier: string               // "Champions" | "Loyal" | "Potential" | "At Risk" | "Lost"
      }
    ]
  }
```

---

#### `get_churn_risk_list`

Returns customers ranked by churn probability above a given threshold.

```typescript
Parameters:
  threshold?: number                   // minimum churn_probability to include; default: 0.5 (range 0–1)
  segment_id?: string                  // scope to a specific segment
  limit?: number                       // default: 500

Returns:
  {
    customers: [
      {
        customer_id: string
        email: string
        churn_probability: number      // 0–1
        days_since_last_purchase: number
        clv: number
        rfm_tier: string
        recommended_action: string     // e.g. "winback_email", "discount_offer"
      }
    ]
  }
```

---

#### `get_clv_estimates`

Returns customer lifetime value estimates at customer or segment level.

```typescript
Parameters:
  segment_id?: string                  // if provided, returns segment-level aggregate; else returns per-customer
  confidence_interval?: boolean        // include lower/upper bounds; default: true

Returns:
  {
    scope: "segment" | "all_customers"
    segment_id?: string
    customers?: [
      {
        customer_id: string
        clv: number
        clv_lower?: number
        clv_upper?: number
        predicted_next_purchase_date?: string
      }
    ]
    segment_summary?: {
      avg_clv: number
      median_clv: number
      total_clv: number
      member_count: number
    }
  }
```

---

#### `create_segment`

Creates a new named dynamic segment from a rule set. Segment membership is refreshed nightly.

```typescript
Parameters:
  name: string                         // required; max 100 characters
  description?: string
  rules: SegmentRule[]                 // required; at least one rule
  rule_logic?: "AND" | "OR"           // how rules are combined; default: "AND"
  refresh_frequency?: "hourly" | "daily" | "weekly"  // default: "daily"

Returns:
  {
    segment_id: string
    name: string
    member_count: number               // initial count at creation time
    created_at: string
  }
```

---

#### `get_product_affinity`

Returns a ranked list of SKUs a customer is most likely to purchase based on collaborative filtering and browse behavior.

```typescript
Parameters:
  customer_id: string                  // required
  top_n?: number                       // number of SKUs to return; default: 10, max: 50
  exclude_purchased?: boolean          // exclude SKUs already bought; default: true
  in_stock_only?: boolean              // exclude out-of-stock SKUs; default: true

Returns:
  {
    customer_id: string
    recommendations: [
      {
        sku_id: string
        name: string
        affinity_score: number         // 0–1
        signal_sources: string[]       // e.g. ["collaborative_filter", "browse_history", "similar_buyers"]
      }
    ]
  }
```

---

#### `get_high_intent_customers`

Returns customers currently exhibiting a specified high-intent behavioral signal within a rolling time window.

```typescript
Parameters:
  signal: "repeated_pdp" | "cart_abandon" | "wishlist_view" | "deep_scroll"  // required
  window_hours?: number                // lookback window in hours; default: 24, max: 168
  sku_id?: string                      // scope to customers showing intent for a specific SKU
  min_signal_count?: number            // minimum occurrences of the signal; default: 1
  limit?: number                       // default: 200

Returns:
  {
    signal: string
    window_hours: number
    customers: [
      {
        customer_id: string
        email: string
        signal_count: number
        sku_ids_engaged: string[]
        last_signal_at: string         // ISO 8601
        clv: number
        lifecycle_stage: string
      }
    ]
  }
```

---

#### `add_to_suppression_list`

Adds a customer to a suppression list to prevent them from receiving promotional emails — typically called after a purchase to prevent redundant campaign sends.

```typescript
Parameters:
  customer_id: string                  // required
  reason: "purchased" | "unsubscribed" | "complaint" | "manual"  // required
  campaign_id?: string                 // if set, suppression is scoped to this campaign only;
                                       // if omitted, suppression is global
  expires_at?: string                  // ISO 8601 datetime; if omitted, suppression is permanent
                                       // until explicitly removed

Returns:
  {
    customer_id: string
    suppression_id: string
    campaign_id?: string
    reason: string
    expires_at?: string
    created_at: string
  }
```

---

#### `remove_from_suppression_list`

Removes a customer from suppression — used after a cooling-off period or when a suppression was added in error.

```typescript
Parameters:
  customer_id: string                  // required
  campaign_id?: string                 // if set, removes only campaign-scoped suppression;
                                       // if omitted, removes global suppression

Returns:
  {
    customer_id: string
    removed: boolean
    campaign_id?: string
    removed_at: string
  }
```

---

#### `is_suppressed`

Checks whether a customer is currently suppressed, optionally in the context of a specific campaign.

```typescript
Parameters:
  customer_id: string                  // required
  campaign_id?: string                 // if set, checks campaign-scoped suppression first,
                                       // then global; if omitted, checks global only

Returns:
  {
    customer_id: string
    is_suppressed: boolean
    suppression_scope?: "campaign" | "global"
    reason?: string
    expires_at?: string
  }
```

---

### Domain 3: Campaign & Content Management

---

#### `get_campaign_briefs`

Returns campaign briefs filtered by status and/or date range. Each brief includes a `channels` array and `campaign_type` field that downstream execution commands use to determine whether they should act on the campaign and how.

```typescript
Parameters:
  status?: "draft" | "active" | "completed" | "paused"
  date_range?: DateRange               // filters by campaign start date
  channel?: "email" | "paid" | "social" | "seo"
                                       // if provided, returns only briefs whose channels
                                       // array includes this value
  campaign_type?: "new_arrival" | "promotion" | "limited_allocation" | "seasonal"
                | "winback" | "educational" | "bundle" | "pre_order"
  limit?: number                       // default: 20

Returns:
  {
    campaigns: [
      {
        campaign_id: string
        name: string
        status: string
        campaign_type: string          // drives downstream command behavior
        channels: string[]             // the definitive list of channels for this campaign
                                       // Execution commands MUST check both campaign_type
                                       // and channels before acting.
        goal: string
        target_segment_id: string
        featured_sku_ids: string[]
        discount_code?: string
        discount_pct?: number
        allocation_units?: number
        arrival_date?: string
        occasion?: string
        bundle_sku_ids?: string[]
        budget: number
        kpis: { metric: string, target: number }[]
        start_date: string
        end_date: string
        created_by: string             // command_id or "human"
        created_at: string
      }
    ]
  }
```

---

#### `create_campaign_brief`

Creates a new campaign brief record, initiating the campaign workflow. The `channels` array is the single source of truth for which execution commands are permitted to act on this campaign. The `campaign_type` field drives how every downstream command behaves — copy angle, audience logic, boost level, send cadence, KPIs, and urgency signals all vary by type.

```typescript
Parameters:
  payload: {
    name: string                       // required
    goal: string                       // required; e.g. "Drive sell-through of overstock Bordeaux"
    campaign_type: "new_arrival"       // required; one of:
                 | "promotion"         //   new_arrival   — new wine launch, excitement-led, no discount
                 | "limited_allocation"//   promotion     — discount/offer campaign, time-bounded
                 | "seasonal"          //   limited_allocation — scarcity-led, inventory-auto-close
                 | "winback"           //   seasonal      — occasion-driven, gift framing, broad
                 | "educational"       //   winback       — re-engagement, email-only, soft offer
                 | "bundle"            //   educational   — content-led, no discount, SEO+email
                 | "pre_order"         //   bundle        — cross-sell, basket-size KPI
                                       //   pre_order     — futures/allocation, no inventory constraint
    channels: ("email" | "paid" | "social" | "seo")[]
                                       // required; list of channels this campaign uses.
                                       // Default channels by campaign_type:
                                       //   new_arrival:        ["email", "social"]
                                       //   promotion:          ["email", "paid", "social"]
                                       //   limited_allocation: ["email", "social"]
                                       //   seasonal:           ["email", "paid", "social"]
                                       //   winback:            ["email"]
                                       //   educational:        ["email", "seo"]
                                       //   bundle:             ["email", "social"]
                                       //   pre_order:          ["email", "social"]
    target_segment_id: string          // required
    featured_sku_ids: string[]         // required; at least one SKU
    discount_code?: string             // required when campaign_type is "promotion"
    discount_pct?: number              // required when campaign_type is "promotion"
    allocation_units?: number          // for limited_allocation: total units available
    arrival_date?: string              // for new_arrival and pre_order: ISO 8601 date
    occasion?: string                  // for seasonal: e.g. "Valentine's Day", "Thanksgiving"
    bundle_sku_ids?: string[]          // for bundle: the companion SKUs in the bundle
    budget?: number
    kpis?: { metric: string, target: number }[]
    start_date: string                 // ISO 8601; required
    end_date: string                   // ISO 8601; required
    notes?: string
  }

Returns:
  {
    campaign_id: string
    campaign_type: string              // echoed back
    channels: string[]
    status: "draft"
    created_at: string
  }
```

---

#### `get_content_assets`

Returns all content assets associated with a campaign, optionally filtered by channel or SKU.

```typescript
Parameters:
  campaign_id: string                  // required
  channel?: "email" | "paid_search" | "paid_social" | "instagram" | "facebook" |
            "pinterest" | "tiktok" | "seo" | "pdp"
  sku_id?: string                      // filter to assets for a specific SKU within the campaign
  status?: "draft" | "approved" | "published"  // default: all

Returns:
  {
    campaign_id: string
    assets: [
      {
        asset_id: string
        channel: string
        asset_type: "subject_line" | "email_body" | "ad_headline" | "ad_body" |
                    "social_caption" | "product_description" | "blog_post"
        content: string
        sku_id?: string
        variant_label?: string         // e.g. "A", "B" for A/B variants
        status: string
        created_at: string
        approved_at?: string
      }
    ]
    pending_approval_count: number     // number of assets still awaiting review in this campaign
  }
```

---

#### `publish_content_asset`

Stores a generated content asset and marks it as ready for downstream agent consumption or human review.

```typescript
Parameters:
  campaign_id: string                  // required
  channel: string                      // required; matches channel values in get_content_assets
  asset: {
    asset_type: "subject_line" | "email_body" | "ad_headline" | "ad_body" |
                "social_caption" | "product_description" | "blog_post"  // required
    content: string                    // required; the actual copy
    sku_id?: string                    // associate asset with a specific SKU; enables per-SKU
                                       // filtering when a campaign features multiple products
    variant_label?: string             // e.g. "A" for A/B testing
    requires_approval?: boolean        // if true, routes to human review queue; default: true
  }

Returns:
  {
    asset_id: string
    status: "pending_review" | "auto_approved"
    campaign_id: string
    sku_id?: string
    created_at: string
  }
```

---

#### `get_brand_guidelines`

Returns the brand voice, style, and visual identity specifications used to constrain content generation.

```typescript
Parameters:
  section?: "voice" | "tone" | "style" | "visual" | "prohibited" | "all"  // default: "all"

Returns:
  {
    voice: {
      descriptors: string[]            // e.g. ["knowledgeable", "approachable", "never pretentious"]
      persona: string
    }
    tone: {
      by_channel: { channel: string, tone_notes: string }[]
    }
    style: {
      preferred_terms: string[]
      prohibited_terms: string[]
      oxford_comma: boolean
      capitalization_rules: string
    }
    visual: {
      primary_colors: string[]         // hex codes
      font_families: string[]
      logo_usage_url: string
    }
  }
```

---

#### `get_seasonal_calendar`

Returns the wine marketing calendar for a given year with key campaign windows.

```typescript
Parameters:
  year: number                         // required; e.g. 2025

Returns:
  {
    year: number
    events: [
      {
        event_id: string
        name: string                   // e.g. "Beaujolais Nouveau Release", "Valentine's Day"
        category: "harvest" | "holiday" | "gifting" | "regional" | "industry"
        start_date: string
        end_date: string
        lead_time_days: number         // recommended days before event to launch campaign
        featured_varietals?: string[]
        campaign_angle?: string        // suggested messaging angle
      }
    ]
  }
```

---

#### `get_seo_keyword_targets`

Returns prioritized keyword targets for SEO content planning.

```typescript
Parameters:
  varietal?: string                    // scope to a specific wine varietal
  region?: string                      // scope to a specific wine region
  intent?: "informational" | "transactional" | "navigational"  // default: all
  min_search_volume?: number           // filter to keywords above a monthly search volume threshold
  max_difficulty?: number              // filter to keywords below a difficulty score (0–100)
  limit?: number                       // default: 50

Returns:
  {
    keywords: [
      {
        keyword: string
        monthly_search_volume: number
        difficulty_score: number       // 0–100; higher = harder to rank
        current_ranking_position?: number  // null if not currently ranking
        intent: string
        suggested_content_type: "product_page" | "blog_post" | "collection_page" | "guide"
        related_sku_ids?: string[]
      }
    ]
  }
```

---

#### `upsert_seo_keyword`

Adds a new keyword target or updates an existing one. Used by `/seo-audit` to write discovered keyword opportunities back into the shared keyword store so `/generate-content` picks them up.

```typescript
Parameters:
  keyword: string                      // required
  intent: "informational" | "transactional" | "navigational"  // required
  target_content_type: "product_page" | "blog_post" | "collection_page" | "guide"  // required
  related_sku_ids?: string[]
  priority?: "high" | "medium" | "low"  // default: "medium"
  notes?: string                       // /seo-audit rationale for adding this keyword

Returns:
  {
    keyword: string
    action: "created" | "updated"
    updated_at: string
  }
```

---

#### `update_campaign_brief`

Updates fields on an existing campaign brief. Used by human reviewers or `/plan-campaign` to iterate before approval.

```typescript
Parameters:
  campaign_id: string                  // required
  fields: {
    name?: string
    goal?: string
    channel?: "email" | "paid" | "social" | "all"
    target_segment_id?: string
    featured_sku_ids?: string[]
    budget?: number
    kpis?: { metric: string, target: number }[]
    start_date?: string
    end_date?: string
    notes?: string
  }

Returns:
  {
    campaign_id: string
    updated_fields: string[]
    updated_at: string
  }
```

---

#### `update_campaign_status`

Transitions a campaign brief between lifecycle states. Required for downstream commands to detect campaigns moving from draft to active, and to close campaigns at end of flight.

```typescript
Parameters:
  campaign_id: string                  // required
  status: "draft" | "active" | "paused" | "completed" | "cancelled"  // required
  approved_by?: string                 // human reviewer ID or command_id; required when transitioning to "active"
  reason?: string                      // optional note; required when status is "cancelled"

Returns:
  {
    campaign_id: string
    previous_status: string
    new_status: string
    transitioned_at: string
    approved_by?: string
  }
```

---

#### `create_campaign_request`

Allows any command to submit a request for a new campaign to `/plan-campaign`. This is the primary inter-command event-push mechanism — it replaces polling with an explicit notification.

```typescript
Parameters:
  requesting_command_id: string          // required; e.g. "check-inventory"
  reason: string                       // required; human-readable explanation
  sku_ids: string[]                    // required; SKUs that should be featured
  priority: "low" | "medium" | "high" | "urgent"  // required
  suggested_campaign_type?: "clearance" | "seasonal" | "new_arrival" | "winback" | "cross_sell"
  suggested_discount_pct?: number
  notes?: string

Returns:
  {
    request_id: string
    status: "pending"
    created_at: string
  }
```

---

#### `get_campaign_requests`

Returns pending campaign requests, used by `/plan-campaign` on its processing runs.

```typescript
Parameters:
  status?: "pending" | "accepted" | "rejected"  // default: "pending"
  priority?: "low" | "medium" | "high" | "urgent"
  limit?: number                       // default: 20

Returns:
  {
    requests: [
      {
        request_id: string
        requesting_command_id: string
        reason: string
        sku_ids: string[]
        priority: string
        suggested_campaign_type?: string
        suggested_discount_pct?: number
        notes?: string
        status: string
        created_at: string
      }
    ]
  }
```

---

#### `create_content_request`

Allows `/seo-audit`, `/plan-campaign`, or `/check-inventory` to task `/generate-content` with producing a specific piece of content. Replaces out-of-band orchestration for content creation requests.

```typescript
Parameters:
  requesting_command_id: string          // required
  content_type: "blog_post" | "product_description" | "email_body" | "social_caption" |
                "ad_copy" | "region_guide" | "varietal_explainer"  // required
  topic: string                        // required; e.g. "Is 2021 Château Margaux ready to drink?"
  campaign_id?: string                 // associate request with an active campaign
  sku_ids?: string[]                   // SKUs to feature or reference
  target_keywords?: string[]           // SEO keywords to incorporate
  channel?: string                     // target channel for the content
  due_date?: string                    // ISO 8601
  notes?: string

Returns:
  {
    request_id: string
    status: "pending"
    created_at: string
  }
```

---

#### `get_content_requests`

Returns pending content requests for `/generate-content` to process.

```typescript
Parameters:
  status?: "pending" | "in_progress" | "completed" | "rejected"  // default: "pending"
  campaign_id?: string
  content_type?: string
  limit?: number                       // default: 20

Returns:
  {
    requests: [
      {
        request_id: string
        requesting_command_id: string
        content_type: string
        topic: string
        campaign_id?: string
        sku_ids?: string[]
        target_keywords?: string[]
        channel?: string
        due_date?: string
        notes?: string
        status: string
        created_at: string
      }
    ]
  }
```

---

#### `approve_content_asset`

Marks a content asset as approved, making it visible to downstream commands (`/send-emails`, `/manage-ads`, `/publish-social`) who filter by `status: "approved"`.

```typescript
Parameters:
  asset_id: string                     // required
  approved_by: string                  // required; human reviewer ID or "auto" for rule-based approval

Returns:
  {
    asset_id: string
    status: "approved"
    approved_by: string
    approved_at: string
  }
```

---

#### `get_content_approval_queue`

Returns all content assets currently awaiting human review, optionally scoped to a campaign or channel.

```typescript
Parameters:
  campaign_id?: string
  channel?: string
  limit?: number                       // default: 50

Returns:
  {
    total_pending: number
    assets: [
      {
        asset_id: string
        campaign_id: string
        channel: string
        asset_type: string
        content: string
        variant_label?: string
        created_at: string
        created_by: string             // command_id that published this asset
      }
    ]
  }
```

---

#### `get_creative_assets`

Returns approved creative image assets (bottle shots, lifestyle photos, campaign visuals) for use in social posts and paid ads.

```typescript
Parameters:
  campaign_id?: string                 // filter to assets tagged to a campaign
  sku_id?: string                      // filter to assets for a specific SKU
  asset_type?: "product_shot" | "lifestyle" | "banner" | "social_square" | "social_story"
  status?: "draft" | "approved"        // default: "approved"
  limit?: number                       // default: 20

Returns:
  {
    assets: [
      {
        asset_id: string
        asset_type: string
        file_url: string               // HTTPS URL; ready to pass to publish_social_post or create_paid_campaign
        thumbnail_url: string
        sku_id?: string
        campaign_id?: string
        alt_text?: string
        dimensions: { width: number, height: number }
        file_size_kb: number
        approved_at?: string
        created_at: string
      }
    ]
  }
```

---

#### `upload_creative_asset`

Uploads a creative image asset and associates it with a SKU and/or campaign. Returns a hosted URL ready for use in ad platforms and social posts.

```typescript
Parameters:
  file_url: string                     // required; source URL of the image to ingest
  asset_type: "product_shot" | "lifestyle" | "banner" | "social_square" | "social_story"
                                       // required
  sku_id?: string
  campaign_id?: string
  alt_text?: string
  requires_approval?: boolean          // default: true

Returns:
  {
    asset_id: string
    file_url: string                   // hosted, CDN-served URL
    status: "pending_review" | "approved"
    created_at: string
  }
```

---

#### `create_campaign_retrospective`

Stores the post-campaign performance summary and learnings so future Campaign Strategy runs can reference them without relying on raw metric queries alone.

```typescript
Parameters:
  campaign_id: string                  // required
  summary: string                      // required; 1–3 sentence narrative of what happened
  metrics: {
    units_sold?: number
    revenue?: number
    total_spend?: number
    roas?: number
    email_open_rate?: number
    email_conversion_rate?: number
    paid_roas?: number
    social_engagement_rate?: number
    [key: string]: number | undefined  // extensible for custom KPIs
  }
  learnings: [
    {
      category: "audience" | "copy" | "channel" | "timing" | "offer" | "product"
      observation: string              // what happened
      recommendation: string          // what to do differently next time
    }
  ]
  winning_ab_variant?: string          // variant_id of the winning test, if applicable

Returns:
  {
    retrospective_id: string
    campaign_id: string
    created_at: string
  }
```

---

#### `get_campaign_retrospective`

Returns the stored retrospective for a completed campaign.

```typescript
Parameters:
  campaign_id: string                  // required

Returns:
  {
    retrospective_id: string
    campaign_id: string
    summary: string
    metrics: Record<string, number>
    learnings: [
      {
        category: string
        observation: string
        recommendation: string
      }
    ]
    winning_ab_variant?: string
    created_at: string
  }
```

---

#### `get_personas`

Returns all customer persona definitions, or a single persona by ID. Skills call this at run start to inform targeting, copy voice, and segment-to-persona mapping.

```typescript
Parameters:
  persona_id?: "Explorer" | "Gifter" | "Loyalist" | "DealSeeker" | "Collector"
               // Optional. Omit to return all personas.

Returns (all):
  {
    total: number
    personas: [
      {
        id: string                    // "Explorer" | "Gifter" | "Loyalist" | "DealSeeker" | "Collector"
        name: string                  // e.g. "The Explorer"
        demographics: string
        purchase_behavior: string
        what_they_respond_to: string
        acquisition_channels: string[]
        campaign_type_fit: string[]   // e.g. ["new_arrival", "educational", "seasonal"]
        segment_signals: string[]     // behavioral signals that identify this persona
        tone_guidance: string         // copy direction for this persona
      }
    ]
  }
  // If persona_id is provided: returns the single matching persona object directly
```

---

#### `get_campaign_type_defaults`

Returns default configuration for each of the 8 campaign types. Skills use this to apply consistent channel selection, budget ranges, KPIs, send cadence, tone angle, and suppression rules without hardcoding them in the skill prompt.

```typescript
Parameters:
  campaign_type?: "new_arrival" | "promotion" | "limited_allocation" | "seasonal"
                | "winback" | "educational" | "bundle" | "pre_order"
                // Optional. Omit to return defaults for all 8 types.

Returns (all):
  {
    [campaign_type: string]: {
      default_channels: string[]     // e.g. ["email", "paid", "social"]
      budget_range: string           // e.g. "8–12% of GMV target"
      primary_kpis: string[]         // e.g. ["units_sold", "revenue", "paid_roas"]
      send_cadence: string           // human-readable cadence description
      tone_angle: string             // copy positioning guidance
      discount: boolean              // whether this type typically includes a discount offer
      paid: boolean                  // whether paid media is expected
      primary_personas: string[]     // e.g. ["DealSeeker", "Loyalist"]
      suppression_notes: string      // type-specific suppression overrides or exemptions
    }
  }
  // If campaign_type is provided: { campaign_type, defaults: { ... } }
```

---

#### `get_suppression_rules`

Returns all email suppression and fatigue rules. Skills call this before any email execution to apply the correct suppression logic for the campaign type.

```typescript
Parameters:
  (none)

Returns:
  {
    global_unsubscribe: { rule: string, check: string }
    email_fatigue_guard: {
      cooldown_days: number          // 3
      rule: string
      check: string
      applies_to: string[]           // campaign types this guard applies to
    }
    post_purchase_suppression: {
      expiry_days: number            // 30
      rule: string
      check: string
      applies_to: string[]
      exceptions: string[]           // e.g. ["seasonal"] — types where this is disabled
    }
    winback_cooldown: {
      cooldown_days: number          // 60
      rule: string
      check: string
    }
    campaign_scoped_suppression: { rule: string, check: string }
    invalid_email_filter: { rule: string, check: string }
    per_type_overrides: {
      [campaign_type: string]: { [rule_name: string]: string }
    }
    trigger_email_exemptions: {
      cart_abandon: string
      browse_abandon: string
      winback_trigger: string
    }
  }
```

---

#### `update_campaign_request`

Updates the status of a campaign request in the MCP queue. Called by `/plan-campaign` after accepting or rejecting a request, so it no longer appears on the next `get_campaign_requests(status: "pending")` call.

```typescript
Parameters:
  request_id: string          // Required — the campaign request ID
  status: "pending" | "accepted" | "rejected" | "processed"
  notes?: string              // Optional decision notes

Returns:
  { updated: string, status: string }
```

---

#### `create_approval_record`

Records a human gate decision (Gate 1–4) in the MCP approval store. Downstream skills check these records before executing a channel. Called by `/plan-campaign` (Gate 1), `/generate-content` (Gate 2), `/manage-ads` and `/publish-social` (Gate 3), and `/update-personalization` (Gate 4).

```typescript
Parameters:
  campaign_id: string         // Required
  gate: 1 | 2 | 3 | 4        // Required — the gate number
  decision: "approved" | "rejected" | "skipped"  // Required
  channel?: string            // e.g. "email", "paid", "social" — for gate 2/3
  asset_ids?: string[]        // Asset IDs approved — for gate 2
  test_id?: string            // A/B test ID — for gate 4
  approved_by?: string        // Defaults to "human"
  notes?: string

Returns:
  { record_id: string, record: ApprovalRecord }
```

---

#### `get_approval_records`

Returns approval records for a campaign or gate. Skills call this before executing a channel to verify the appropriate gate has been cleared.

```typescript
Parameters:
  campaign_id?: string        // Filter by campaign
  gate?: 1 | 2 | 3 | 4       // Filter by gate number
  decision?: "approved" | "rejected" | "skipped"  // Filter by outcome

Returns:
  { total: number, records: ApprovalRecord[] }
```

---

### Domain 4: Channel Execution

---

#### `send_email_campaign`

Executes a bulk email campaign send to a segment via the connected ESP. Supports A/B subject line splitting natively.

```typescript
Parameters:
  campaign_id: string                  // required; must have approved assets
  segment_id: string                   // required; target audience
  scheduled_at?: string                // ISO 8601 datetime; if omitted, sends immediately
  from_name?: string                   // default: brand default sender name
  from_email?: string                  // default: brand default sender address
  reply_to?: string
  track_clicks?: boolean               // default: true
  track_opens?: boolean                // default: true
  ab_test_config?: {                   // optional; enables split send for A/B subject line testing
    subject_line_asset_ids: string[]   // 2 asset_ids pointing to approved subject_line assets
    split_pct: number[]                // traffic split per variant; must sum to 100
                                       // e.g. [50, 50] for an even split
    winner_metric?: "open_rate" | "ctr" | "conversion_rate"  // auto-promote winner after N hours
    winner_after_hours?: number        // if set, auto-promotes winning variant to remaining audience
  }

Returns:
  {
    send_id: string
    campaign_id: string
    segment_id: string
    estimated_reach: number
    status: "scheduled" | "sending" | "sent"
    scheduled_at: string
    ab_test_id?: string                // present if ab_test_config was provided
  }
```

---

#### `trigger_behavioral_email`

Fires a single transactional/behavioral email to one customer based on a detected site event.

```typescript
Parameters:
  event_type: "cart_abandon" | "browse_abandon" | "post_purchase" | "winback" | "high_intent_nudge"
                                       // required
  customer_id: string                  // required
  sku_id?: string                      // scopes the email to a specific product; used for cart/browse abandon
  campaign_id?: string                 // associates this send with a campaign for attribution;
                                       // ensures revenue is rolled up to the correct campaign report
  delay_minutes?: number               // time to wait before sending; default: 60 for abandon flows
  suppress_if_purchased?: boolean      // cancel send if customer buys before delay elapses; default: true

Returns:
  {
    send_id: string
    customer_id: string
    campaign_id?: string
    event_type: string
    status: "queued" | "sent" | "suppressed"
    scheduled_at: string
  }
```

---

#### `get_email_metrics`

Returns performance metrics for a specific email send.

```typescript
Parameters:
  send_id: string                      // required

Returns:
  {
    send_id: string
    campaign_id: string
    sent_count: number
    delivered_count: number
    open_count: number
    unique_open_rate: number           // decimal e.g. 0.28
    click_count: number
    ctr: number
    conversion_count: number
    conversion_rate: number
    revenue_attributed: number
    unsubscribe_count: number
    bounce_count: number
    spam_complaint_count: number
  }
```

---

#### `publish_social_post`

Schedules or immediately publishes a post to a social platform.

```typescript
Parameters:
  platform: "instagram" | "facebook" | "pinterest" | "tiktok"  // required
  content: {
    caption: string                    // required; max character limits enforced per platform
    image_url: string                  // required; HTTPS URL to approved asset from get_creative_assets
    hashtags: string[]                 // without # prefix; max 30 for Instagram
    link_url?: string                  // added to bio link or Pinterest destination
    alt_text?: string                  // image accessibility description
  }
  scheduled_at?: string                // ISO 8601 datetime; if omitted, posts immediately
  campaign_id?: string                 // associates this post with a campaign for performance rollup;
                                       // enables filtering in get_social_metrics by campaign

Returns:
  {
    post_id: string
    platform: string
    campaign_id?: string
    status: "scheduled" | "published"
    scheduled_at?: string
    published_at?: string
    post_url?: string                  // populated once published
  }
```

---

#### `get_social_metrics`

Returns engagement and reach metrics for a platform over a date range.

```typescript
Parameters:
  platform: "instagram" | "facebook" | "pinterest" | "tiktok"  // required
  date_range: DateRange                // required
  post_id?: string                     // if provided, scopes to a single post
  campaign_id?: string                 // if provided, returns only posts tagged to this campaign

Returns:
  {
    platform: string
    date_range: DateRange
    campaign_id?: string
    impressions: number
    reach: number
    engagement_count: number
    engagement_rate: number            // engagements / reach
    follower_count: number
    follower_delta: number             // net change in period
    link_clicks: number
    top_posts: [
      {
        post_id: string
        caption_preview: string
        impressions: number
        engagement_rate: number
        published_at: string
      }
    ]
  }
```

---

#### `sync_product_feed_to_ad_platforms`

Pushes the current product catalog and inventory status to Google Merchant Center and/or Meta Commerce Manager.

```typescript
Parameters:
  platforms: ("google" | "meta" | "pinterest")[]  // required; at least one
  filters?: {
    in_stock_only?: boolean            // default: true; exclude out-of-stock SKUs
    min_margin?: number                // only include SKUs above this margin threshold
    varietal?: string
    region?: string
    sku_ids?: string[]                 // if provided, syncs only these SKUs
  }

Returns:
  {
    sync_id: string
    platforms: string[]
    skus_synced: number
    skus_excluded: number
    status: "success" | "partial" | "failed"
    errors?: { sku_id: string, reason: string }[]
    synced_at: string
  }
```

---

#### `create_paid_campaign`

Creates a campaign structure on a paid advertising platform.

```typescript
Parameters:
  platform: "google" | "meta" | "pinterest"  // required
  source_campaign_id?: string          // links this paid campaign to an internal campaign brief;
                                       // enables campaign-scoped reporting in get_paid_metrics
  brief: {
    name: string                       // required
    campaign_type: "search" | "shopping" | "display" | "video" | "social_feed" | "retargeting"
                                       // required
    daily_budget: number               // required; in USD
    start_date: string                 // ISO 8601; required
    end_date?: string                  // ISO 8601
    targeting: {
      audience_id?: string             // ID returned by create_behavioral_audience (platform audience);
                                       // use this for behavioral retargeting campaigns
      audience_source?: "behavioral_audience" | "crm_segment"
                                       // required when audience_id is provided; disambiguates
                                       // whether audience_id is a platform audience from
                                       // create_behavioral_audience or an internal segment_id
      segment_id?: string              // internal segment_id from Domain 2; use for CRM-based targeting;
                                       // MCP resolves this to the platform audience automatically
      geographic?: string[]            // list of US states or countries
      age_range?: { min: number, max: number }
      interests?: string[]             // platform interest categories
    }
    featured_sku_ids?: string[]        // for shopping campaigns
    ad_asset_ids?: string[]            // content asset IDs from Domain 3 (copy)
    creative_asset_ids?: string[]      // creative image asset IDs from get_creative_assets
    bidding_strategy: "target_roas" | "target_cpa" | "max_conversions" | "manual_cpc"
    target_roas?: number               // required if bidding_strategy is "target_roas"
    target_cpa?: number                // required if bidding_strategy is "target_cpa"
  }

Returns:
  {
    platform_campaign_id: string       // ID in the ad platform
    internal_campaign_id: string       // MCP-assigned internal ID
    source_campaign_id?: string        // echoed back if provided
    platform: string
    status: "draft" | "active"
    created_at: string
  }
```

---

#### `create_behavioral_audience`

Pushes an on-site behavioral segment to a paid ad platform as a custom audience for retargeting. The returned `audience_id` should be passed to `create_paid_campaign` targeting as `audience_id` with `audience_source: "behavioral_audience"`.

```typescript
Parameters:
  platform: "google" | "meta"          // required
  behavior_segment: {
    signal: "repeated_pdp" | "cart_abandon" | "wishlist_view" | "deep_scroll" | "high_intent"
                                       // required
    window_hours: number               // lookback window; required
    sku_id?: string                    // scope audience to a specific SKU
    min_signal_count?: number          // default: 1
  }
  audience_name: string                // required; label in the ad platform

Returns:
  {
    audience_id: string                // platform-specific audience ID; pass to
                                       // create_paid_campaign targeting.audience_id
                                       // with audience_source: "behavioral_audience"
    platform: string
    audience_name: string
    estimated_size: number
    status: "building" | "ready"
    created_at: string
  }
```

---

#### `get_paid_metrics`

Returns performance metrics for paid campaigns.

```typescript
Parameters:
  platform: "google" | "meta" | "pinterest"  // required
  campaign_id?: string                 // platform campaign ID; if omitted, returns aggregate
  source_campaign_id?: string          // filter by internal campaign brief ID; returns aggregate
                                       // across all platform campaigns linked to this brief
  date_range: DateRange                // required
  breakdown?: "campaign" | "ad_set" | "ad" | "sku"  // granularity level; default: "campaign"

Returns:
  {
    platform: string
    date_range: DateRange
    source_campaign_id?: string
    spend: number
    impressions: number
    clicks: number
    ctr: number
    conversions: number
    conversion_rate: number
    revenue: number
    roas: number
    cpa: number
    breakdown_rows?: [
      {
        id: string
        name: string
        spend: number
        roas: number
        cpa: number
        revenue: number
      }
    ]
  }
```

---

#### `pause_ads_for_sku`

Pauses all active ads referencing a specific SKU across one or more platforms — typically triggered by an out-of-stock event.

```typescript
Parameters:
  sku_id: string                       // required
  platforms: ("google" | "meta" | "pinterest")[]  // required
  reason?: string                      // logged reason; e.g. "out_of_stock"

Returns:
  {
    sku_id: string
    paused_campaigns: [
      {
        platform: string
        campaign_id: string
        campaign_name: string
        paused_at: string
      }
    ]
    total_paused: number
  }
```

---

#### `cancel_email_send`

Cancels a scheduled email send before it executes. Used when inventory depletes before a send fires, or when a campaign is cancelled mid-flight.

```typescript
Parameters:
  send_id: string                      // required
  reason?: string                      // logged reason; e.g. "out_of_stock", "campaign_cancelled"

Returns:
  {
    send_id: string
    status: "cancelled" | "already_sent" | "not_found"
    cancelled_at?: string
    reason?: string
  }
```

---

#### `pause_campaign_channel`

Pauses all pending sends and scheduled posts for a specific channel within a campaign. Used when a mid-flight event (stock depletion, brand issue) requires stopping execution on a particular channel without cancelling the whole campaign.

```typescript
Parameters:
  campaign_id: string                  // required
  channel: "email" | "paid_search" | "paid_social" | "instagram" |
           "facebook" | "pinterest" | "tiktok" | "all"  // required
  reason?: string                      // logged reason

Returns:
  {
    campaign_id: string
    channel: string
    sends_cancelled: number            // number of email sends cancelled
    posts_unscheduled: number          // number of social posts unscheduled
    ads_paused: number                 // number of ad campaigns paused (if channel is paid)
    paused_at: string
    reason?: string
  }
```

---

### Domain 5: Analytics & Attribution

---

#### `get_performance_summary`

Returns a unified cross-channel marketing performance snapshot. Scoping to a `campaign_id` isolates metrics to that campaign only, preventing concurrent campaigns from polluting each other's retrospectives.

```typescript
Parameters:
  date_range: DateRange                // required
  channels?: ("email" | "paid_search" | "paid_social" | "organic_search" | "social" | "direct")[]
                                       // default: all channels
  campaign_id?: string                 // if set, returns only activity attributable to this campaign;
                                       // email sends, paid campaigns, and social posts must be tagged
                                       // with this campaign_id to appear in scoped results
  compare_to_prior_period?: boolean    // include period-over-period delta; default: false

Returns:
  {
    date_range: DateRange
    campaign_id?: string
    total_revenue: number
    total_orders: number
    avg_order_value: number
    blended_roas: number
    total_spend: number
    new_customers: number
    returning_customers: number
    channels: [
      {
        channel: string
        revenue: number
        orders: number
        spend?: number
        roas?: number
        contribution_pct: number       // share of total revenue
        delta_vs_prior_period?: number // percentage change
      }
    ]
  }
```

---

#### `get_attribution_report`

Returns revenue attribution across channels under a specified model.

```typescript
Parameters:
  model: "first_touch" | "last_touch" | "linear" | "time_decay" | "data_driven"  // required
  date_range: DateRange                // required
  campaign_id?: string                 // scope attribution to a single campaign
  segment_id?: string                  // scope to a customer segment
  sku_id?: string                      // scope to a specific product

Returns:
  {
    model: string
    date_range: DateRange
    campaign_id?: string
    total_attributed_revenue: number
    channels: [
      {
        channel: string
        attributed_revenue: number
        attributed_orders: number
        attribution_share: number      // 0–1
        avg_touchpoints_before_conversion: number
      }
    ]
  }
```

---

#### `get_conversion_funnel`

Returns step-by-step funnel completion and drop-off data.

```typescript
Parameters:
  date_range?: DateRange               // default: last 30 days
  segment_id?: string                  // scope to a customer segment
  device_type?: "desktop" | "mobile" | "tablet"  // scope to a device type
  traffic_source?: string              // e.g. "email", "paid_search", "organic"

Returns:
  {
    steps: [
      {
        step: "visit" | "collection_view" | "pdp_view" | "add_to_cart" | "checkout_start" |
              "checkout_complete" | "purchase"
        sessions: number
        completion_rate: number        // share of sessions reaching this step from the previous
        drop_off_rate: number
        avg_time_on_step_seconds: number
        top_exit_pages?: string[]      // most common pages where users dropped off here
      }
    ]
    overall_visit_to_purchase_rate: number
  }
```

---

#### `detect_anomalies`

Runs anomaly detection on a specified metric and returns flags with severity and context. Scope filters narrow detection to campaign-specific or SKU-specific signals, preventing concurrent activity from masking or inflating anomalies.

```typescript
Parameters:
  metric: "revenue" | "orders" | "email_open_rate" | "paid_roas" | "site_sessions" |
          "conversion_rate" | "cart_abandon_rate" | "email_deliverability"  // required
  lookback_days?: number               // baseline comparison window; default: 30
  sensitivity?: "low" | "medium" | "high"  // controls how far from baseline triggers an alert; default: "medium"
  campaign_id?: string                 // scope detection to activity tagged to this campaign
  segment_id?: string                  // scope detection to a specific customer segment
  sku_id?: string                      // scope detection to a specific SKU (e.g. conversion_rate
                                       // on a specific PDP)

Returns:
  {
    metric: string
    scope: { campaign_id?: string, segment_id?: string, sku_id?: string }
    status: "normal" | "anomaly_detected"
    current_value: number
    baseline_value: number
    deviation_pct: number
    severity?: "warning" | "critical"
    detected_at?: string
    suggested_investigation?: string   // e.g. "Check ESP deliverability logs"
  }
```

---

#### `get_product_performance`

Returns SKU-level sales and engagement metrics ranked by a chosen dimension.

```typescript
Parameters:
  date_range: DateRange                // required
  sort_by?: "revenue" | "units" | "margin" | "pdp_views" | "view_to_cart_rate" | "cart_to_purchase_rate"
                                       // default: "revenue"
  varietal?: string
  region?: string
  limit?: number                       // default: 50

Returns:
  {
    date_range: DateRange
    products: [
      {
        sku_id: string
        name: string
        revenue: number
        units_sold: number
        margin: number
        pdp_views: number
        view_to_cart_rate: number
        cart_to_purchase_rate: number
        avg_order_quantity: number
      }
    ]
  }
```

---

#### `get_cohort_retention`

Returns customer retention curves grouped by acquisition cohort.

```typescript
Parameters:
  cohort_period: "week" | "month"      // required; granularity of cohort grouping
  lookback: number                     // required; number of periods to look back (e.g. 12 for 12 months)
  acquisition_channel?: string         // scope to customers acquired via a specific channel

Returns:
  {
    cohorts: [
      {
        cohort_label: string           // e.g. "2024-Q4", "2025-Jan"
        cohort_size: number
        retention_by_period: [
          {
            period: number             // 0 = acquisition period, 1 = next period, etc.
            retained_customers: number
            retention_rate: number
          }
        ]
      }
    ]
  }
```

---

#### `get_content_conversion_attribution`

Returns which blog posts, guides, or educational content pieces contributed to downstream product views and purchases.

```typescript
Parameters:
  content_type: "blog" | "region_guide" | "varietal_explainer" | "all"  // required
  date_range: DateRange                // required
  min_attributed_revenue?: number      // filter to content above a revenue threshold

Returns:
  {
    content_pieces: [
      {
        content_id: string
        title: string
        content_type: string
        page_url: string
        unique_views: number
        avg_dwell_seconds: number
        pdp_clicks: number             // clicks from content to a product page
        add_to_carts: number
        purchases: number
        attributed_revenue: number
        top_sku_ids_driven: string[]
      }
    ]
  }
```

---

### Domain 6: Personalization & Recommendations

---

#### `get_recommendations`

Returns a real-time ranked list of SKU recommendations for a customer in a specific page context.

```typescript
Parameters:
  customer_id: string                  // required
  context: "homepage" | "pdp" | "cart" | "email" | "search_results"  // required
  limit?: number                       // number of SKUs to return; default: 8, max: 30
  session_id?: string                  // if provided, adapts recs to current session behavior
  exclude_sku_ids?: string[]           // SKUs to suppress (e.g. already in cart)
  current_sku_id?: string             // for pdp context: the SKU currently being viewed

Returns:
  {
    customer_id: string
    context: string
    recommendations: [
      {
        sku_id: string
        name: string
        affinity_score: number         // 0–1
        price: number
        image_url: string
        reasoning: string[]            // e.g. ["bought similar region", "trending in segment"]
      }
    ]
    model_version: string
    generated_at: string
  }
```

---

#### `get_segment_recommendations`

Returns top recommended SKUs for a segment — used for batch email personalization where per-customer scoring is not feasible.

```typescript
Parameters:
  segment_id: string                   // required
  limit?: number                       // default: 10, max: 30
  in_stock_only?: boolean              // default: true

Returns:
  {
    segment_id: string
    recommendations: [
      {
        sku_id: string
        name: string
        segment_affinity_score: number
        price: number
        image_url: string
      }
    ]
  }
```

---

#### `get_trending_products`

Returns SKUs with accelerating purchase or browse velocity over a rolling window.

```typescript
Parameters:
  window_days?: number                 // lookback window; default: 7
  region?: string                      // filter to wines from a specific wine region
  varietal?: string                    // filter to a specific varietal
  trend_signal?: "purchases" | "pdp_views" | "wishlist_adds" | "cart_adds"
                                       // which signal drives the ranking; default: "purchases"
  limit?: number                       // default: 20

Returns:
  {
    window_days: number
    products: [
      {
        sku_id: string
        name: string
        trend_score: number            // velocity index; higher = faster acceleration
        current_period_signal: number  // e.g. purchases in window
        prior_period_signal: number
        pct_change: number
      }
    ]
  }
```

---

#### `get_frequently_bought_together`

Returns SKUs commonly purchased in the same order as a given SKU.

```typescript
Parameters:
  sku_id: string                       // required
  limit?: number                       // default: 5
  in_stock_only?: boolean              // default: true
  min_co_purchase_count?: number       // minimum co-purchase occurrences to qualify; default: 10

Returns:
  {
    sku_id: string
    pairings: [
      {
        paired_sku_id: string
        name: string
        co_purchase_count: number
        co_purchase_rate: number       // share of sku_id orders that also contain this SKU
        image_url: string
        price: number
      }
    ]
  }
```

---

#### `get_collection_page_sort_order`

Returns a personalized or segment-level SKU sort order for a collection page, incorporating affinity, inventory, and merchandising rules.

```typescript
Parameters:
  collection_id: string                // required
  customer_id?: string                 // if provided, returns 1:1 personalized sort
  segment_id?: string                  // if no customer_id, returns segment-level sort
  respect_merchandising_rules?: boolean  // honor pinned/boosted/buried rules; default: true

Returns:
  {
    collection_id: string
    sort_basis: "customer" | "segment" | "default"
    sku_order: [
      {
        sku_id: string
        position: number
        affinity_score?: number
        is_pinned?: boolean
        is_boosted?: boolean
      }
    ]
  }
```

---

#### `log_recommendation_feedback`

Records a customer interaction with a recommended product — used to improve future model scoring.

```typescript
Parameters:
  customer_id: string                  // required
  sku_id: string                       // required; the recommended SKU that was interacted with
  action: "view" | "add_to_cart" | "purchase" | "dismiss"  // required
  context: "homepage" | "pdp" | "cart" | "email" | "search_results"  // required
  session_id?: string
  recommendation_position?: number     // which slot the SKU occupied (1-indexed)

Returns:
  {
    logged: boolean
    customer_id: string
    sku_id: string
    action: string
    logged_at: string
  }
```

---

#### `set_campaign_boost`

Temporarily elevates specified SKUs in recommendation scores and collection sort orders for the duration of a campaign. This is the mechanism by which Campaign Strategy overrides pure affinity scoring to ensure featured SKUs appear prominently across the site during a promotional flight.

```typescript
Parameters:
  campaign_id: string                  // required; boost is automatically removed when campaign
                                       // transitions to "completed" or "cancelled"
  sku_ids: string[]                    // required; SKUs to boost
  boost_factor: number                 // required; multiplier applied to affinity score
                                       // e.g. 1.5 = 50% uplift in recommendation ranking
  contexts?: ("homepage" | "pdp" | "cart" | "email" | "search_results" | "collection")[]
                                       // which recommendation contexts to apply the boost;
                                       // default: all contexts
  start_date: string                   // ISO 8601; required
  end_date: string                     // ISO 8601; required; boost auto-expires at this date
                                       // regardless of campaign status

Returns:
  {
    boost_id: string
    campaign_id: string
    sku_ids: string[]
    boost_factor: number
    contexts: string[]
    start_date: string
    end_date: string
    status: "active"
    created_at: string
  }
```

---

#### `remove_campaign_boost`

Manually removes an active campaign boost before its scheduled expiry — used if a campaign is cancelled early or SKUs sell out.

```typescript
Parameters:
  campaign_id: string                  // required; removes all boosts for this campaign
  sku_ids?: string[]                   // if provided, removes boost only for these SKUs;
                                       // if omitted, removes all SKU boosts for the campaign

Returns:
  {
    campaign_id: string
    boosts_removed: number
    sku_ids_affected: string[]
    removed_at: string
  }
```

---

### Domain 7: Behavioral Events

*The data collection and query layer for all on-site customer behavior. The upstream source of truth for real-time triggers, personalization, segmentation, paid media audiences, and UX optimization.*

---

#### `log_session_event`

Records a single behavioral event from the website. Called by the site's tracking SDK on every user interaction.

```typescript
Parameters:
  event: {
    session_id: string                 // required; UUID per browser session
    customer_id?: string               // null for anonymous visitors
    anonymous_id: string               // required; persistent cookie or fingerprint ID
    event_type: "page_view" | "pdp_view" | "scroll_depth" | "video_play" |
                "add_to_cart" | "remove_from_cart" | "wishlist_add" | "wishlist_view" |
                "search_query" | "search_result_click" | "checkout_step" | "purchase" |
                "exit_intent" | "blog_view" | "filter_applied" | "sort_changed" | "hover_dwell"
                                       // required
    sku_id?: string                    // SKU being interacted with (where applicable)
    page_url: string                   // required; full URL
    referrer_url?: string
    properties: {                      // event-specific fields
      // For scroll_depth: { depth_pct: number }
      // For search_query: { query: string, result_count: number }
      // For search_result_click: { query: string, sku_id: string, result_position: number }
      // For checkout_step: { step: number, step_name: string }
      // For filter_applied: { filter_type: string, filter_value: string }
      // For hover_dwell: { element: string, dwell_ms: number }
      [key: string]: any
    }
    timestamp: string                  // ISO 8601; required
    device_type: "desktop" | "mobile" | "tablet"  // required
    browser?: string
    session_duration_seconds?: number  // cumulative time in session at event fire time
  }

Returns:
  {
    event_id: string
    logged: boolean
  }
```

---

#### `get_session_summary`

Returns the full event sequence and derived signals for a single session.

```typescript
Parameters:
  session_id: string                   // required

Returns:
  {
    session_id: string
    customer_id?: string
    anonymous_id: string
    started_at: string
    ended_at?: string
    duration_seconds?: number
    device_type: string
    traffic_source: string
    events: [
      {
        event_id: string
        event_type: string
        sku_id?: string
        page_url: string
        timestamp: string
        properties: Record<string, any>
      }
    ]
    derived_signals: {
      intent_score: number             // 0–100; composite purchase intent
      funnel_stage_reached: "browse" | "consideration" | "cart" | "checkout" | "purchase"
      sku_ids_engaged: string[]
      search_queries_used: string[]
      total_pdp_views: number
      converted: boolean
    }
  }
```

---

#### `get_customer_session_history`

Returns a chronological list of sessions for a specific customer with derived signals.

```typescript
Parameters:
  customer_id: string                  // required
  limit?: number                       // default: 20 sessions
  date_range?: DateRange
  include_anonymous?: boolean          // include pre-identity-resolution sessions; default: true

Returns:
  {
    customer_id: string
    sessions: [
      {
        session_id: string
        started_at: string
        duration_seconds: number
        traffic_source: string
        device_type: string
        funnel_stage_reached: string
        sku_ids_engaged: string[]
        converted: boolean
        intent_score: number
      }
    ]
    total_sessions: number
  }
```

---

#### `watch_behavioral_triggers`

Subscribes to real-time webhook notifications when a customer matches a specified behavioral trigger pattern. Supports optional `auto_intervention` so the MCP server can fire a UI response directly without requiring a round-trip agent call — critical for time-sensitive moments like exit-intent where latency kills effectiveness.

```typescript
Parameters:
  trigger_config: {
    trigger_type: "repeated_pdp_view" | "cart_abandon" | "high_dwell" |
                  "exit_intent" | "wishlist_inactivity" | "search_no_purchase"  // required
    threshold?: number                 // e.g. 3 for "repeated_pdp_view" = fires after 3rd view
    window_minutes?: number            // rolling time window for threshold evaluation; default: 60
    sku_id?: string                    // scope trigger to a specific SKU
    min_session_duration_seconds?: number  // only fire for sufficiently engaged sessions
    auto_intervention?: {              // if set, MCP fires the intervention directly on trigger
                                       // without waiting for agent webhook response
      intervention_type: "exit_intent_offer" | "low_stock_urgency" | "chat_prompt" | "cross_sell_drawer"
      payload: {
        headline?: string
        body_text?: string
        sku_id?: string
        discount_pct?: number
        discount_code?: string
        cta_label?: string
        cta_url?: string
      }
    }
  }
  webhook_url: string                  // required; HTTPS endpoint for POST payloads
                                       // webhook fires even when auto_intervention is set,
                                       // allowing the agent to log the event

Returns:
  {
    subscription_id: string
    trigger_type: string
    auto_intervention_enabled: boolean
    status: "active"
    registered_at: string
  }

Webhook payload shape:
  {
    subscription_id: string
    trigger_type: string
    customer_id?: string
    anonymous_id: string
    session_id: string
    sku_id?: string
    signal_count: number
    auto_intervention_fired: boolean
    intervention_id?: string           // present if auto_intervention fired
    triggered_at: string
  }
```

---

#### `get_search_query_report`

Returns aggregated on-site search query analytics including demand gap signals.

```typescript
Parameters:
  date_range: DateRange                // required
  limit?: number                       // top N queries to return; default: 100
  include_zero_results?: boolean       // include queries that returned no results; default: true
  min_search_count?: number            // filter to queries with at least N searches; default: 5

Returns:
  {
    date_range: DateRange
    total_searches: number
    search_to_purchase_rate: number
    top_queries: [
      {
        query: string
        search_count: number
        click_through_rate: number
        add_to_cart_rate: number
        purchase_rate: number
        top_clicked_sku_ids: string[]
      }
    ]
    zero_result_queries: [
      {
        query: string
        search_count: number
      }
    ]
    low_result_queries: [
      {
        query: string
        result_count: number
        search_count: number
      }
    ]
  }
```

---

#### `get_funnel_drop_off_report`

Returns a step-by-step conversion funnel with drop-off rates, optionally segmented.

```typescript
Parameters:
  date_range: DateRange                // required
  segment_id?: string                  // scope to a customer segment
  device_type?: "desktop" | "mobile" | "tablet"  // scope to a device type
  traffic_source?: string              // e.g. "email", "paid_search", "organic"

Returns:
  {
    date_range: DateRange
    filters: { segment_id?: string, device_type?: string, traffic_source?: string }
    steps: [
      {
        step_name: string
        sessions_entered: number
        sessions_completed: number
        completion_rate: number
        drop_off_rate: number
        median_time_on_step_seconds: number
        top_exit_pages: string[]
      }
    ]
    overall_conversion_rate: number
  }
```

---

#### `get_page_engagement_metrics`

Returns engagement quality metrics for a page type over a date range.

```typescript
Parameters:
  page_type: "homepage" | "collection" | "pdp" | "blog" | "cart" | "checkout"  // required
  date_range: DateRange                // required
  device_type?: "desktop" | "mobile" | "tablet"
  segment_id?: string

Returns:
  {
    page_type: string
    date_range: DateRange
    sessions: number
    avg_scroll_depth_pct: number       // 0–100
    avg_dwell_seconds: number
    bounce_rate: number
    exit_rate: number
    conversion_rate: number
    pages_by_url?: [                   // breakdown by specific URL (for pdp and blog types)
      {
        page_url: string
        sessions: number
        avg_dwell_seconds: number
        conversion_rate: number
      }
    ]
  }
```

---

#### `get_sku_behavioral_metrics`

Returns on-site behavioral engagement metrics for a specific SKU.

```typescript
Parameters:
  sku_id: string                       // required
  date_range: DateRange                // required

Returns:
  {
    sku_id: string
    date_range: DateRange
    pdp_views: number
    unique_viewers: number
    avg_dwell_seconds: number
    scroll_depth_avg_pct: number
    wishlist_adds: number
    cart_adds: number
    view_to_cart_rate: number
    cart_to_purchase_rate: number
    repeat_view_customers: number      // customers who viewed the PDP 2+ times
    search_driven_views: number        // PDP views originating from internal search
  }
```

---

#### `create_ab_test`

Creates a new A/B or multivariate test on a site page or experience element.

```typescript
Parameters:
  config: {
    name: string                       // required
    page_type: "homepage" | "collection" | "pdp" | "cart" | "checkout"  // required
    element?: string                   // specific element being tested; e.g. "hero_image", "add_to_cart_button"
    campaign_id?: string               // associate test with a campaign for retrospective linkage;
                                       // enables list_ab_tests filtering by campaign
    sku_id?: string                    // associate test with a specific SKU (e.g. PDP tests)
    variants: [
      {
        id: string                     // e.g. "control", "variant_a"
        description: string
        traffic_split_pct: number      // must sum to 100 across all variants
      }
    ]                                  // required; minimum 2 variants
    primary_metric: "conversion_rate" | "add_to_cart_rate" | "revenue_per_session" | "bounce_rate"
                                       // required
    secondary_metrics?: string[]
    min_sample_size: number            // required; minimum sessions per variant before reading results
    max_duration_days: number          // required; auto-stop after N days regardless of sample
    segment_id?: string                // scope test to a specific customer segment
  }

Returns:
  {
    test_id: string
    name: string
    campaign_id?: string
    sku_id?: string
    status: "running"
    started_at: string
    estimated_completion_date: string
  }
```

---

#### `get_ab_test_results`

Returns current results for an A/B test with statistical significance data.

```typescript
Parameters:
  test_id: string                      // required

Returns:
  {
    test_id: string
    name: string
    status: "running" | "complete" | "inconclusive" | "stopped_early"
    started_at: string
    completed_at?: string
    primary_metric: string
    variant_results: [
      {
        variant_id: string
        description: string
        sessions: number
        primary_metric_value: number
        lift_pct: number               // relative lift vs. control; 0 for control variant
        p_value: number                // statistical significance
        is_significant: boolean        // true if p_value < 0.05
        confidence_interval: { lower: number, upper: number }
      }
    ]
    winner?: string                    // variant_id of winner, if test is complete and significant
    recommendation: string             // e.g. "Promote variant_a to 100% of traffic"
  }
```

---

#### `update_merchandising_rules`

Updates the sort order and promotion/suppression rules for a collection page.

```typescript
Parameters:
  collection_id: string                // required
  rules: [
    {
      rule_type: "pin_to_top" | "boost" | "bury" | "exclude"  // required
      sku_id?: string                  // target a specific SKU
      condition?: {
        in_stock_only?: boolean
        min_margin?: number
        behavioral_signal?: "trending" | "high_intent" | "new_arrival"
      }
      boost_factor?: number            // for "boost": multiplier applied to sort score (e.g. 1.5)
      position?: number                // for "pin_to_top": explicit position (1-indexed)
      priority: number                 // rule evaluation order; lower = higher priority
    }
  ]
  expires_at?: string                  // ISO 8601; rule auto-expires after this datetime

Returns:
  {
    collection_id: string
    rules_applied: number
    effective_from: string
    expires_at?: string
  }
```

---

#### `get_merchandising_rules`

Returns the currently active merchandising rules for a collection page.

```typescript
Parameters:
  collection_id: string                // required

Returns:
  {
    collection_id: string
    rules: [
      {
        rule_id: string
        rule_type: string
        sku_id?: string
        condition?: Record<string, any>
        boost_factor?: number
        position?: number
        priority: number
        created_at: string
        expires_at?: string
      }
    ]
    last_updated_at: string
  }
```

---

#### `trigger_onsite_intervention`

Fires a real-time UI intervention for an active session. Supports both identified customers and anonymous visitors — exit-intent and urgency nudges must work for first-time anonymous sessions where identity has not yet been resolved.

```typescript
Parameters:
  customer_id?: string                 // provide if customer is identified (logged in or recognised)
  anonymous_id?: string                // provide for anonymous sessions; at least one of
                                       // customer_id or anonymous_id is required
  session_id?: string                  // recommended; allows MCP to verify session is still active
  intervention_type: "exit_intent_offer" | "low_stock_urgency" | "chat_prompt" | "cross_sell_drawer"
                                       // required
  payload: {
    headline?: string                  // displayed in the intervention UI
    body_text?: string
    sku_id?: string                    // product to feature in the intervention
    discount_pct?: number              // for exit_intent_offer: offer depth
    discount_code?: string
    cta_label?: string                 // button label; e.g. "Add to Cart"
    cta_url?: string
  }

Returns:
  {
    intervention_id: string
    customer_id?: string
    anonymous_id?: string
    intervention_type: string
    status: "delivered" | "session_not_active" | "identity_not_found"
    delivered_at?: string
  }
```

---

#### `list_ab_tests`

Returns a list of A/B tests, enabling commands to discover test IDs without prior knowledge. Used by `/plan-campaign` to find tests related to a campaign, and by `/performance-report` to compile retrospectives.

```typescript
Parameters:
  status?: "running" | "complete" | "inconclusive" | "stopped_early"  // default: all
  page_type?: "homepage" | "collection" | "pdp" | "cart" | "checkout"
  campaign_id?: string                 // filter to tests linked to a specific campaign
  sku_id?: string                      // filter to tests linked to a specific SKU
  date_range?: DateRange               // filter by test start date
  limit?: number                       // default: 20

Returns:
  {
    tests: [
      {
        test_id: string
        name: string
        page_type: string
        element?: string
        campaign_id?: string
        sku_id?: string
        status: string
        primary_metric: string
        started_at: string
        completed_at?: string
        winner?: string                // variant_id if test is complete and significant
      }
    ]
    total_count: number
  }
```

---

#### `get_demand_gap_report`

Returns on-site search queries that matched zero or very few catalog results — representing unmet customer demand.

```typescript
Parameters:
  date_range: DateRange                // required
  min_search_count?: number            // minimum searches to appear in report; default: 10
  max_result_count?: number            // maximum catalog results to qualify as a gap; default: 2
  sort_by?: "search_count" | "search_count_desc"  // default: "search_count_desc"
  limit?: number                       // default: 100

Returns:
  {
    date_range: DateRange
    gaps: [
      {
        query: string
        search_count: number
        avg_results_returned: number
        suggested_action: "add_sku" | "improve_search_index" | "create_content"
        related_existing_sku_ids?: string[]  // closest matches currently in catalog
      }
    ]
  }
```

---


---

## Part 8: Command ↔ MCP Domain Permissions

Each command's permitted MCP domains are declared in its task prompt. This table is the authoritative reference for what each command may read and write.

| Command | Read Domains | Write Domains |
|---------|-------------|--------------|
| Campaign Request (Command 0) | MCP | `create_campaign_request()` |
| /plan-campaign | Catalog & Inventory, Analytics & Attribution, Customer Data, Behavioral Events | Campaign & Content |
| /generate-content | Catalog & Inventory, Campaign & Content, Customer Data, Behavioral Events | Campaign & Content |
| /seo-audit | Campaign & Content, Analytics & Attribution, Behavioral Events, Catalog & Inventory | Campaign & Content (upsert_seo_keyword, create_content_request) |
| /send-emails | Channel Execution (metrics), Customer Data, Campaign & Content, Behavioral Events | Channel Execution (sends, cancels, pauses), Customer Data (suppression) |
| /manage-ads | Channel Execution (metrics), Catalog & Inventory, Campaign & Content, Analytics & Attribution, Behavioral Events | Channel Execution (campaigns, audiences, pauses) |
| /publish-social | Channel Execution (metrics), Campaign & Content, Catalog & Inventory | Channel Execution (publish_social_post) |
| /update-personalization | Personalization & Recommendations, Customer Data, Catalog & Inventory, Behavioral Events | Personalization & Recommendations (boosts, feedback) |
| /performance-report | Analytics & Attribution, Channel Execution (metrics), Behavioral Events, Campaign & Content | Campaign & Content (create_campaign_retrospective) |
| /analyze-segments | Customer Data, Analytics & Attribution, Behavioral Events | Customer Data (create_segment, suppression) |
| /check-inventory | Catalog & Inventory, Campaign & Content | Channel Execution (pause_ads_for_sku, pause_campaign_channel) |
| /review-behavior | Behavioral Events, Campaign & Content, Catalog & Inventory | Behavioral Events (update_merchandising_rules, create_ab_test, trigger_onsite_intervention) |
| /trace-campaign | Analytics & Attribution, Campaign & Content, Channel Execution (metrics), Behavioral Events | None (read-only — writes only to local outputs/traces/) |
| Human Reviewer | — | Campaign & Content (approve_content_asset, update_campaign_status, approve_creative_asset) |

---

## Part 9: Campaign Lifecycle State Machine

Campaigns move through five states. Transitions are controlled via `update_campaign_status()`. The human reviewer is the only actor who can transition a campaign to "active" or "cancelled."

```
[DRAFT] ──► [ACTIVE] ──► [PAUSED] ──► [ACTIVE]
               │                          │
               └──────────────────────────┴──► [COMPLETED]
               │
               └──► [CANCELLED]

DRAFT      → ACTIVE     Human only: requires approved_by in update_campaign_status()
ACTIVE     → PAUSED     Any command or human (e.g. stock depletion, brand issue)
PAUSED     → ACTIVE     Any command or human
ACTIVE     → COMPLETED  /performance-report on end_date, or human
ACTIVE     → CANCELLED  Human only: requires reason parameter
COMPLETED  → (terminal) Triggers /performance-report to run create_campaign_retrospective()
```

---

## Part 10: Behavioral Events Flow

The On-Site Behavior external service ingests events continuously. The Cowork commands consume the accumulated data on their scheduled runs.

```
Website SDK (browser)
        │
        │ POST events in real time
        ▼
External Ingestion Service
        │
        │ calls log_session_event() per event
        ▼
MCP Server — Behavioral Events domain
        │
        ├─ Daily read ──────────────────► /review-behavior
        │   (search queries, funnels,       (A/B tests, merchandising,
        │    SKU metrics, demand gaps)        demand gap routing)
        │
        ├─ Daily read ──────────────────► /performance-report
        │   (funnel, page engagement,       (dashboards, anomaly detection)
        │    A/B test results)
        │
        ├─ Daily read ──────────────────► /analyze-segments
        │   (session history, affinity)     (segments, RFM enrichment)
        │
        └─ Real-time webhook ───────────► External Trigger Service
            (cart_abandon, exit_intent)     (trigger_behavioral_email,
                                             auto_intervention)
```

---

## Part 11: Decision Guide — When to Graduate Beyond Cowork

This Cowork implementation is the right starting point for most wine e-commerce businesses. Graduate to a fully distributed multi-agent architecture when:

| Signal | What it means |
|--------|--------------|
| Cart-abandon email lag is measurably hurting revenue | Need sub-minute triggers, not 24-hour polling fallback |
| Running 5+ concurrent campaigns simultaneously | Cowork's sequential task execution creates coordination delays |
| Inventory sync needs sub-hourly cadence | Out-of-stock events are too costly to catch every 4 hours |
| Engineering team is available to operate infrastructure | Full distributed system requires deployment, monitoring, and on-call |
| Compliance or data residency requirements | Cowork runs locally but the MCP must be self-hosted and auditable |

The MCP server spec in Part 7 is identical whether you are running on Cowork or a distributed fleet. When you graduate, you port each command's task template into a dedicated runtime with a scoped API key — the MCP functions, parameters, and domain structure require no changes.
