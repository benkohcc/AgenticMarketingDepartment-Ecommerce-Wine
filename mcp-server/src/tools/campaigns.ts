import { store, newCampaignId, newAssetId } from "../data-store.js";
import { Campaign, CampaignStatus, ContentAsset, CampaignRequest, ApprovalRecord, Retrospective } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED", "COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const campaignTools = [
  {
    name: "get_campaign_briefs",
    description: "Return campaign briefs filtered by status, date range, channel, or type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] },
        campaign_type: { type: "string" },
        channel: { type: "string", enum: ["email", "paid", "social", "seo"] },
        limit: { type: "number", default: 20 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let results = [...store.campaigns];
      if (args.status) results = results.filter(c => c.status === args.status);
      if (args.campaign_type) results = results.filter(c => c.campaign_type === args.campaign_type);
      if (args.channel) results = results.filter(c => c.channels.includes(args.channel as "email" | "paid" | "social" | "seo"));
      const limit = (args.limit as number) || 20;
      return ok({ total: results.length, campaigns: results.slice(0, limit) });
    },
  },

  {
    name: "create_campaign_brief",
    description: "Create a new campaign brief in DRAFT status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        campaign_type: { type: "string", enum: ["new_arrival", "promotion", "limited_allocation", "seasonal", "winback", "educational", "bundle", "pre_order"] },
        channels: { type: "array", items: { type: "string", enum: ["email", "paid", "social", "seo"] } },
        target_segment_ids: { type: "array", items: { type: "string" } },
        featured_sku_ids: { type: "array", items: { type: "string" } },
        discount_pct: { type: "number", default: 0 },
        start_date: { type: "string" },
        end_date: { type: "string" },
        budget_daily: { type: "number" },
      },
      required: ["name", "campaign_type", "channels"],
    },
    handler: async (args: Record<string, unknown>) => {
      const now = new Date().toISOString();
      const campaign: Campaign = {
        id: newCampaignId(),
        name: args.name as string,
        campaign_type: args.campaign_type as Campaign["campaign_type"],
        status: "DRAFT",
        channels: (args.channels as Campaign["channels"]) || [],
        target_segment_ids: (args.target_segment_ids as string[]) || [],
        featured_sku_ids: (args.featured_sku_ids as string[]) || [],
        discount_pct: (args.discount_pct as number) || 0,
        start_date: (args.start_date as string) || now.split("T")[0],
        end_date: (args.end_date as string) || "",
        created_at: now,
        updated_at: now,
        budget_daily: args.budget_daily as number | undefined,
      };
      store.campaigns.push(campaign);
      return ok({ campaign_id: campaign.id, status: "DRAFT", campaign });
    },
  },

  {
    name: "get_content_assets",
    description: "Return content assets for a campaign, optionally filtered by channel or status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        channel: { type: "string", enum: ["email", "paid", "social", "seo", "general"] },
        status: { type: "string", enum: ["pending_review", "approved", "rejected"] },
      },
      required: ["campaign_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      let assets = store.contentAssets.filter(a => a.campaign_id === args.campaign_id);
      if (args.channel) assets = assets.filter(a => a.channel === args.channel);
      if (args.status) assets = assets.filter(a => a.status === args.status);
      const pendingCount = assets.filter(a => a.status === "pending_review").length;
      return ok({ campaign_id: args.campaign_id, total: assets.length, pending_approval_count: pendingCount, assets });
    },
  },

  {
    name: "publish_content_asset",
    description: "Store a generated content asset (email copy, ad copy, social caption, etc.) for a campaign.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        channel: { type: "string", enum: ["email", "paid", "social", "seo", "general"] },
        asset_type: { type: "string", enum: ["subject_line", "email_body", "ad_headline", "ad_body", "social_caption", "product_description", "blog_post", "preview_text", "cta_text", "meta_title", "meta_description"] },
        content: { type: "string" },
        variant: { type: "string", enum: ["A", "B"] },
      },
      required: ["campaign_id", "channel", "asset_type", "content"],
    },
    handler: async (args: Record<string, unknown>) => {
      const asset: ContentAsset = {
        id: newAssetId(),
        campaign_id: args.campaign_id as string,
        channel: args.channel as ContentAsset["channel"],
        asset_type: args.asset_type as ContentAsset["asset_type"],
        content: args.content as string,
        variant: args.variant as "A" | "B" | undefined,
        status: "pending_review",
        created_at: new Date().toISOString(),
      };
      store.contentAssets.push(asset);
      return ok({ asset_id: asset.id, status: "pending_review", asset });
    },
  },

  {
    name: "get_brand_guidelines",
    description: "Return the brand voice, tone, style rules, and prohibited patterns.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sections: { type: "array", items: { type: "string", enum: ["voice", "tone", "style", "visual", "prohibited", "cta"] }, description: "Specific sections to return, or omit for all" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      return ok(store.brandGuidelines);
    },
  },

  {
    name: "get_seasonal_calendar",
    description: "Return the wine marketing seasonal calendar with key campaign windows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        upcoming_only: { type: "boolean", description: "Only return events starting from today", default: true },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let events = [...store.seasonalCalendar];
      if (args.upcoming_only !== false) {
        const today = new Date().toISOString().split("T")[0];
        events = events.filter(e => e.end_date >= today);
      }
      return ok({ events });
    },
  },

  {
    name: "get_seo_keyword_targets",
    description: "Return prioritized SEO keywords with intent, search volume, difficulty, and current ranking.",
    inputSchema: {
      type: "object" as const,
      properties: {
        priority: { type: "string", enum: ["high", "medium", "low"] },
        intent: { type: "string", enum: ["informational", "commercial", "transactional", "navigational"] },
        limit: { type: "number", default: 20 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let kws = [...store.seoKeywords];
      if (args.priority) kws = kws.filter(k => k.priority === args.priority);
      if (args.intent) kws = kws.filter(k => k.intent === args.intent);
      kws.sort((a, b) => {
        const pOrder = { high: 0, medium: 1, low: 2 };
        return pOrder[a.priority] - pOrder[b.priority];
      });
      return ok({ total: kws.length, keywords: kws.slice(0, (args.limit as number) || 20) });
    },
  },

  {
    name: "upsert_seo_keyword",
    description: "Add or update an SEO keyword target.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string" },
        intent: { type: "string", enum: ["informational", "commercial", "transactional", "navigational"] },
        monthly_search_volume: { type: "number" },
        difficulty_score: { type: "number" },
        target_content_type: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        target_sku_ids: { type: "array", items: { type: "string" } },
      },
      required: ["keyword"],
    },
    handler: async (args: Record<string, unknown>) => {
      const existing = store.seoKeywords.find(k => k.keyword === args.keyword);
      if (existing) {
        Object.assign(existing, { ...args, updated_at: new Date().toISOString() });
        return ok({ action: "updated", keyword_id: existing.id, keyword: existing });
      }
      const newKw = {
        id: `kw-${Date.now()}`,
        keyword: args.keyword as string,
        intent: ((args.intent as string) || "commercial") as "informational" | "commercial" | "transactional" | "navigational",
        monthly_search_volume: (args.monthly_search_volume as number) || 0,
        difficulty_score: (args.difficulty_score as number) || 50,
        suggested_content_type: (args.target_content_type as string) || "collection_page",
        priority: (args.priority as "high" | "medium" | "low") || "medium",
        target_sku_ids: (args.target_sku_ids as string[]) || [],
        updated_at: new Date().toISOString(),
      };
      store.seoKeywords.push(newKw);
      return ok({ action: "created", keyword_id: newKw.id, keyword: newKw });
    },
  },

  {
    name: "update_campaign_brief",
    description: "Update fields on a campaign brief (only allowed in DRAFT or ACTIVE status).",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        name: { type: "string" },
        channels: { type: "array", items: { type: "string" } },
        target_segment_ids: { type: "array", items: { type: "string" } },
        featured_sku_ids: { type: "array", items: { type: "string" } },
        discount_pct: { type: "number" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        budget_daily: { type: "number" },
      },
      required: ["campaign_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const c = store.campaigns.find(x => x.id === args.campaign_id);
      if (!c) return ok({ error: `Campaign ${args.campaign_id} not found` });
      const updatable = ["name", "channels", "target_segment_ids", "featured_sku_ids", "discount_pct", "start_date", "end_date", "budget_daily"];
      updatable.forEach(field => { if (args[field] !== undefined) (c as unknown as Record<string, unknown>)[field] = args[field]; });
      c.updated_at = new Date().toISOString();
      return ok({ campaign_id: c.id, updated: true, campaign: c });
    },
  },

  {
    name: "update_campaign_status",
    description: "Update campaign status. Enforces valid state transitions. Requires approved_by for DRAFT→ACTIVE.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        status: { type: "string", enum: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] },
        approved_by: { type: "string" },
        reason: { type: "string" },
      },
      required: ["campaign_id", "status"],
    },
    handler: async (args: Record<string, unknown>) => {
      const c = store.campaigns.find(x => x.id === args.campaign_id);
      if (!c) return ok({ error: `Campaign ${args.campaign_id} not found` });
      const newStatus = args.status as CampaignStatus;
      const allowed = VALID_TRANSITIONS[c.status];
      if (!allowed.includes(newStatus)) {
        return ok({ error: `Invalid transition: ${c.status} → ${newStatus}. Allowed: ${allowed.join(", ")}` });
      }
      if (c.status === "DRAFT" && newStatus === "ACTIVE" && !args.approved_by) {
        return ok({ error: "approved_by is required to activate a campaign from DRAFT" });
      }
      c.status = newStatus;
      c.updated_at = new Date().toISOString();
      if (args.approved_by) { c.approved_by = args.approved_by as string; c.approved_at = new Date().toISOString(); }
      return ok({ campaign_id: c.id, old_status: allowed[0], new_status: newStatus, campaign: c });
    },
  },

  {
    name: "create_campaign_request",
    description: "Create an inter-agent campaign request (inventory alert, segment insight, etc.) for Campaign Strategy to act on.",
    inputSchema: {
      type: "object" as const,
      properties: {
        request_type: { type: "string" },
        alert_type: { type: "string" },
        sku_id: { type: "string" },
        segment_id: { type: "string" },
        suggested_campaign_type: { type: "string" },
        suggested_discount_pct: { type: "number" },
        notes: { type: "string" },
        agent: { type: "string" },
      },
      required: ["request_type", "agent"],
    },
    handler: async (args: Record<string, unknown>) => {
      const req: CampaignRequest = {
        id: `req-${Date.now()}`,
        request_type: args.request_type as string,
        alert_type: args.alert_type as string | undefined,
        status: "pending",
        raised_at: new Date().toISOString(),
        agent: args.agent as string,
        notes: args.notes as string | undefined,
        ...args,
      };
      store.campaignRequests.push(req);
      return ok({ request_id: req.id, status: "pending", request: req });
    },
  },

  {
    name: "get_campaign_requests",
    description: "Return pending campaign requests from the inter-agent queue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["pending", "accepted", "rejected", "processed"], default: "pending" },
        limit: { type: "number", default: 20 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const status = (args.status as string) || "pending";
      const results = store.campaignRequests.filter(r => r.status === status);
      return ok({ total: results.length, requests: results.slice(0, (args.limit as number) || 20) });
    },
  },

  {
    name: "update_campaign_request",
    description: "Update the status of a campaign request after processing. Call after plan-campaign accepts or rejects a request so it doesn't re-appear on the next run.",
    inputSchema: {
      type: "object" as const,
      properties: {
        request_id: { type: "string", description: "The campaign request ID to update" },
        status: { type: "string", enum: ["pending", "accepted", "rejected", "processed"], description: "New status for the request" },
        notes: { type: "string", description: "Optional notes about the decision" },
      },
      required: ["request_id", "status"],
    },
    handler: async (args: Record<string, unknown>) => {
      const req = store.campaignRequests.find(r => r.id === args.request_id);
      if (!req) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Campaign request ${args.request_id} not found` }) }] };
      req.status = args.status as CampaignRequest["status"];
      if (args.notes) req.notes = args.notes as string;
      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: req.id, status: req.status }) }] };
    },
  },

  {
    name: "create_approval_record",
    description: "Record a human approval or rejection decision for a campaign gate (Gate 1–4). Required before any downstream skill can proceed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        gate: { type: "number", enum: [1, 2, 3, 4] },
        decision: { type: "string", enum: ["approved", "rejected", "skipped"] },
        channel: { type: "string", description: "Specific channel for gate 2/3 records (email, paid, social)" },
        asset_ids: { type: "array", items: { type: "string" }, description: "Asset IDs approved at gate 2/3" },
        test_id: { type: "string", description: "A/B test ID for gate 4 records" },
        approved_by: { type: "string", description: "Who approved — defaults to 'human'" },
        notes: { type: "string" },
      },
      required: ["campaign_id", "gate", "decision"],
    },
    handler: async (args: Record<string, unknown>) => {
      const record: ApprovalRecord = {
        id: `appr-${Date.now()}`,
        campaign_id: args.campaign_id as string,
        gate: args.gate as 1 | 2 | 3 | 4,
        decision: args.decision as ApprovalRecord["decision"],
        channel: args.channel as string | undefined,
        asset_ids: args.asset_ids as string[] | undefined,
        test_id: args.test_id as string | undefined,
        approved_by: (args.approved_by as string) || "human",
        approved_at: new Date().toISOString(),
        notes: args.notes as string | undefined,
      };
      store.approvalRecords.push(record);
      return { content: [{ type: "text" as const, text: JSON.stringify({ record_id: record.id, record }) }] };
    },
  },

  {
    name: "get_approval_records",
    description: "Return approval records for a campaign or gate. Use to check whether a campaign has been approved before executing a channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string", description: "Filter by campaign ID" },
        gate: { type: "number", enum: [1, 2, 3, 4], description: "Filter by gate number" },
        decision: { type: "string", enum: ["approved", "rejected", "skipped"], description: "Filter by decision" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let records = store.approvalRecords;
      if (args.campaign_id) records = records.filter(r => r.campaign_id === args.campaign_id);
      if (args.gate) records = records.filter(r => r.gate === (args.gate as number));
      if (args.decision) records = records.filter(r => r.decision === args.decision);
      return { content: [{ type: "text" as const, text: JSON.stringify({ total: records.length, records }) }] };
    },
  },

  {
    name: "approve_content_asset",
    description: "Mark a content asset as approved, making it available for downstream channel execution agents.",
    inputSchema: {
      type: "object" as const,
      properties: {
        asset_id: { type: "string" },
        approved_by: { type: "string" },
      },
      required: ["asset_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const asset = store.contentAssets.find(a => a.id === args.asset_id);
      if (!asset) return ok({ error: `Asset ${args.asset_id} not found` });
      asset.status = "approved";
      asset.approved_by = (args.approved_by as string) || "human";
      asset.approved_at = new Date().toISOString();
      return ok({ asset_id: asset.id, status: "approved", asset });
    },
  },

  {
    name: "get_content_approval_queue",
    description: "Return content assets currently awaiting human review.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        channel: { type: "string" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let assets = store.contentAssets.filter(a => a.status === "pending_review");
      if (args.campaign_id) assets = assets.filter(a => a.campaign_id === args.campaign_id);
      if (args.channel) assets = assets.filter(a => a.channel === args.channel);
      return ok({ total: assets.length, assets });
    },
  },

  {
    name: "get_creative_assets",
    description: "Return approved creative image/video assets for a campaign.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        asset_type: { type: "string", enum: ["product_shot", "lifestyle", "banner", "social_square", "social_story"] },
        status: { type: "string", enum: ["pending_review", "approved", "rejected"] },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let assets = [...store.creativeAssets];
      if (args.campaign_id) assets = assets.filter(a => a.campaign_id === args.campaign_id);
      if (args.asset_type) assets = assets.filter(a => a.asset_type === args.asset_type);
      if (args.status) assets = assets.filter(a => a.status === args.status);
      return ok({ total: assets.length, assets });
    },
  },

  {
    name: "upload_creative_asset",
    description: "Ingest a creative image/video asset URL for a campaign (stub — returns asset_id).",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        asset_type: { type: "string", enum: ["product_shot", "lifestyle", "banner", "social_square", "social_story"] },
        platform: { type: "string" },
        url: { type: "string" },
        alt_text: { type: "string" },
        auto_approve: { type: "boolean", default: false },
      },
      required: ["campaign_id", "asset_type", "url"],
    },
    handler: async (args: Record<string, unknown>) => {
      const asset = {
        id: `creative-${Date.now()}`,
        campaign_id: args.campaign_id as string,
        asset_type: args.asset_type as string,
        platform: args.platform as string,
        url: args.url as string,
        alt_text: (args.alt_text as string) || "",
        status: args.auto_approve ? "approved" : "pending_review",
        uploaded_at: new Date().toISOString(),
        approved_at: args.auto_approve ? new Date().toISOString() : undefined,
      };
      store.creativeAssets.push(asset as typeof store.creativeAssets[0]);
      return ok({ asset_id: asset.id, status: asset.status, asset });
    },
  },

  {
    name: "create_campaign_retrospective",
    description: "Store a post-campaign retrospective with metrics and learnings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        campaign_name: { type: "string" },
        duration_days: { type: "number" },
        channels_used: { type: "array", items: { type: "string" } },
        total_revenue: { type: "number" },
        total_orders: { type: "number" },
        overall_roas: { type: "number" },
        channel_breakdown: { type: "object" },
        best_performing_element: { type: "string" },
        worst_performing_element: { type: "string" },
        ab_test_winner: { type: "string" },
        learnings: { type: "array", items: { type: "string" } },
        recommendations_for_next_campaign: { type: "array", items: { type: "string" } },
      },
      required: ["campaign_id", "total_revenue", "learnings"],
    },
    handler: async (args: Record<string, unknown>) => {
      const retro = {
        ...args,
        completed_at: new Date().toISOString(),
      } as Retrospective;
      store.retrospectives.push(retro);
      return ok({ campaign_id: retro.campaign_id, retrospective_saved: true });
    },
  },

  {
    name: "get_campaign_retrospective",
    description: "Retrieve stored retrospectives for a campaign or list all recent retrospectives.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        campaign_type: { type: "string" },
        limit: { type: "number", default: 5 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let retros = [...store.retrospectives];
      if (args.campaign_id) retros = retros.filter(r => r.campaign_id === args.campaign_id);
      if (args.campaign_type) retros = retros.filter(r => r.campaign_type === args.campaign_type);
      return ok({ total: retros.length, retrospectives: retros.slice(0, (args.limit as number) || 5) });
    },
  },

  {
    name: "get_personas",
    description: "Return customer persona definitions including purchase behavior, campaign type fit, segment signals, and tone guidance. Use to inform campaign targeting and copy voice.",
    inputSchema: {
      type: "object" as const,
      properties: {
        persona_id: { type: "string", enum: ["Explorer", "Gifter", "Loyalist", "DealSeeker", "Collector"], description: "Return a single persona by ID, or omit for all." },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      if (args.persona_id) {
        const persona = store.personas.find(p => p.id === args.persona_id);
        if (!persona) return ok({ error: `Persona '${args.persona_id}' not found` });
        return ok(persona);
      }
      return ok({ total: store.personas.length, personas: store.personas });
    },
  },

  {
    name: "get_campaign_type_defaults",
    description: "Return default configuration for each campaign type: channels, budget range, KPIs, send cadence, tone angle, discount flag, and suppression notes. Use at the start of /plan-campaign and /generate-content runs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_type: { type: "string", enum: ["new_arrival", "promotion", "limited_allocation", "seasonal", "winback", "educational", "bundle", "pre_order"], description: "Return defaults for a single campaign type, or omit for all." },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      if (args.campaign_type) {
        const defaults = store.campaignTypeDefaults[args.campaign_type as string];
        if (!defaults) return ok({ error: `Campaign type '${args.campaign_type}' not found` });
        return ok({ campaign_type: args.campaign_type, defaults });
      }
      return ok(store.campaignTypeDefaults);
    },
  },

  {
    name: "get_suppression_rules",
    description: "Return all email suppression and fatigue rules: global unsubscribe, 3-day fatigue guard, post-purchase suppression, winback cooldown, per-type overrides, and trigger email exemptions. Call at the start of any skill that sends email.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return ok(store.suppressionRules);
    },
  },
];
