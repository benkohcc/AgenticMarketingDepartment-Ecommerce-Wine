import { store, newSegmentId } from "../data-store.js";
import { Segment, Suppression } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export const customerTools = [
  {
    name: "get_customer_segments",
    description: "Return all defined segments with membership counts, average CLV, and segment rules.",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async (_args: Record<string, unknown>) => {
      const segments = store.segments.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        customer_count: s.customer_count,
        avg_clv: s.avg_clv,
        avg_open_rate: s.avg_open_rate,
        rules: s.rules,
        refreshed_at: s.refreshed_at,
      }));
      return ok({ total: segments.length, segments });
    },
  },

  {
    name: "get_customers_in_segment",
    description: "Return paginated list of customers in a segment, with optional CLV, RFM, and propensity fields.",
    inputSchema: {
      type: "object" as const,
      properties: {
        segment_id: { type: "string" },
        include_clv: { type: "boolean", default: true },
        include_rfm: { type: "boolean", default: false },
        include_propensity: { type: "boolean", default: false },
        limit: { type: "number", default: 50 },
        offset: { type: "number", default: 0 },
      },
      required: ["segment_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const seg = store.segments.find(s => s.id === args.segment_id);
      if (!seg) return ok({ error: `Segment ${args.segment_id} not found` });

      const limit = (args.limit as number) || 50;
      const offset = (args.offset as number) || 0;
      const ids = seg.customer_ids.slice(offset, offset + limit);
      const customers = ids.map(id => {
        const c = store.customers.find(x => x.id === id);
        if (!c) return { id, error: "not found" };
        const base = { id: c.id, email: c.email, first_name: c.first_name, last_name: c.last_name, persona: c.persona, lifecycle_stage: c.lifecycle_stage };
        const row: Record<string, unknown> = { ...base };
        if (args.include_clv !== false) { row.clv_12m = c.clv_12m; row.clv_lifetime = c.clv_lifetime; }
        if (args.include_rfm) { row.rfm = c.rfm; }
        if (args.include_propensity) { row.upsell_propensity = c.upsell_propensity; row.churn_risk_score = c.churn_risk_score; }
        return row;
      });
      return ok({ segment_id: seg.id, segment_name: seg.name, total: seg.customer_count, offset, limit, customers });
    },
  },

  {
    name: "get_customer_profile",
    description: "Return the full 360 profile for a customer: purchase history, email engagement, segment memberships, and varietal affinities.",
    inputSchema: {
      type: "object" as const,
      properties: { customer_id: { type: "string" } },
      required: ["customer_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const c = store.customers.find(x => x.id === args.customer_id);
      if (!c) return ok({ error: `Customer ${args.customer_id} not found` });
      // Enrich segment names
      const segs = c.segment_ids.map(sid => {
        const s = store.segments.find(x => x.id === sid);
        return { id: sid, name: s?.name || "unknown" };
      });
      return ok({ ...c, segments: segs });
    },
  },

  {
    name: "get_rfm_scores",
    description: "Return RFM scores for all customers or filtered by segment. Returns R, F, M (1-5 scale) and segment label.",
    inputSchema: {
      type: "object" as const,
      properties: {
        segment_id: { type: "string", description: "Filter to customers in this segment" },
        rfm_segment: { type: "string", description: "Filter by RFM label (Champions, Loyal Customers, etc.)" },
        limit: { type: "number", default: 100 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let customers = [...store.customers];
      if (args.segment_id) {
        const seg = store.segments.find(s => s.id === args.segment_id);
        if (seg) customers = customers.filter(c => seg.customer_ids.includes(c.id));
      }
      if (args.rfm_segment) customers = customers.filter(c => c.rfm.rfm_segment === args.rfm_segment);
      const limit = (args.limit as number) || 100;
      const results = customers.slice(0, limit).map(c => ({
        customer_id: c.id,
        persona: c.persona,
        rfm: c.rfm,
        last_purchase_date: c.last_purchase_date,
        total_orders: c.total_orders,
      }));
      return ok({ total: customers.length, results });
    },
  },

  {
    name: "get_churn_risk_list",
    description: "Return customers ranked by churn probability (highest risk first) with recommended action.",
    inputSchema: {
      type: "object" as const,
      properties: {
        min_churn_score: { type: "number", default: 0.5 },
        limit: { type: "number", default: 50 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const minScore = (args.min_churn_score as number) || 0.5;
      const limit = (args.limit as number) || 50;
      const results = store.customers
        .filter(c => c.churn_risk_score >= minScore)
        .sort((a, b) => b.churn_risk_score - a.churn_risk_score)
        .slice(0, limit)
        .map(c => ({
          customer_id: c.id,
          email: c.email,
          persona: c.persona,
          churn_risk_score: c.churn_risk_score,
          last_purchase_date: c.last_purchase_date,
          total_orders: c.total_orders,
          clv_12m: c.clv_12m,
          recommended_action: c.churn_risk_score > 0.8 ? "winback_email" : c.churn_risk_score > 0.65 ? "re_engagement_email" : "monitor",
        }));
      return ok({ total: results.length, min_churn_score: minScore, customers: results });
    },
  },

  {
    name: "get_clv_estimates",
    description: "Return CLV estimates at customer or segment level, with 12-month and lifetime projections.",
    inputSchema: {
      type: "object" as const,
      properties: {
        segment_id: { type: "string" },
        min_clv: { type: "number" },
        limit: { type: "number", default: 100 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let customers = [...store.customers];
      if (args.segment_id) {
        const seg = store.segments.find(s => s.id === args.segment_id);
        if (seg) customers = customers.filter(c => seg.customer_ids.includes(c.id));
      }
      if (args.min_clv) customers = customers.filter(c => c.clv_12m >= (args.min_clv as number));
      customers.sort((a, b) => b.clv_12m - a.clv_12m);
      const limit = (args.limit as number) || 100;
      const results = customers.slice(0, limit).map(c => ({
        customer_id: c.id,
        persona: c.persona,
        clv_12m: c.clv_12m,
        clv_lifetime: c.clv_lifetime,
        total_orders: c.total_orders,
        avg_order_value: c.avg_order_value,
        lifecycle_stage: c.lifecycle_stage,
      }));
      const avg = customers.reduce((s, c) => s + c.clv_12m, 0) / (customers.length || 1);
      return ok({ total: customers.length, avg_clv_12m: Math.round(avg * 100) / 100, customers: results });
    },
  },

  {
    name: "create_segment",
    description: "Create a new dynamic segment from a rule set.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: { type: "string" },
              value: {},
              window_days: { type: "number" },
            },
          },
        },
        rule_logic: { type: "string", enum: ["AND", "OR"], default: "AND" },
      },
      required: ["name", "rules"],
    },
    handler: async (args: Record<string, unknown>) => {
      const newSeg: Segment = {
        id: newSegmentId(),
        name: args.name as string,
        description: (args.description as string) || "",
        customer_ids: [],
        customer_count: 0,
        avg_clv: 0,
        avg_open_rate: 0,
        rules: (args.rules as Segment["rules"]) || [],
        created_at: new Date().toISOString(),
        refreshed_at: new Date().toISOString(),
      };
      store.segments.push(newSeg);
      return ok({ segment_id: newSeg.id, name: newSeg.name, message: "Segment created. Rule evaluation runs on next Customer Insights refresh." });
    },
  },

  {
    name: "get_product_affinity",
    description: "Return top-N SKU recommendations for a customer based on their varietal affinities and purchase history.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string" },
        limit: { type: "number", default: 10 },
        exclude_purchased: { type: "boolean", default: true },
      },
      required: ["customer_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const c = store.customers.find(x => x.id === args.customer_id);
      if (!c) return ok({ error: `Customer ${args.customer_id} not found` });

      const affinityMap: Record<string, number> = {};
      c.varietal_affinities.forEach(a => { affinityMap[a.varietal] = a.score; });

      const limit = (args.limit as number) || 10;
      const scored = store.products
        .filter(p => p.stock_units > 0)
        .map(p => {
          const affinity = affinityMap[p.varietal_family] || 0.1;
          const priceFit = 1 - Math.min(1, Math.abs(c.avg_order_value - p.price) / Math.max(c.avg_order_value, p.price));
          const score = affinity * 0.6 + priceFit * 0.4;
          return { sku_id: p.id, product_name: p.name, varietal: p.varietal, price: p.price, affinity_score: Math.round(score * 1000) / 1000, signal_sources: ["varietal_affinity", "price_fit"], is_boosted: false };
        })
        .sort((a, b) => b.affinity_score - a.affinity_score)
        .slice(0, limit);

      return ok({ customer_id: c.id, total: scored.length, recommendations: scored });
    },
  },

  {
    name: "get_high_intent_customers",
    description: "Return customers showing a specific behavioral signal (e.g. cart_abandon, repeated_pdp) in a rolling window.",
    inputSchema: {
      type: "object" as const,
      properties: {
        signal: { type: "string", enum: ["repeated_pdp", "cart_abandon", "wishlist_view", "deep_scroll", "high_intent"] },
        window_hours: { type: "number", default: 24 },
        sku_id: { type: "string", description: "Filter to customers who showed this signal on a specific SKU" },
        limit: { type: "number", default: 50 },
      },
      required: ["signal"],
    },
    handler: async (args: Record<string, unknown>) => {
      // Map signals to session funnel stages as proxy
      const signalToStage: Record<string, string[]> = {
        repeated_pdp: ["consideration"],
        cart_abandon: ["cart"],
        wishlist_view: ["consideration"],
        deep_scroll: ["consideration"],
        high_intent: ["cart", "checkout"],
      };
      const stages = signalToStage[args.signal as string] || ["cart"];
      const limit = (args.limit as number) || 50;

      const matchingSessions = store.sessions.filter(s => {
        const inStage = stages.includes(s.funnel_stage_reached) && !s.converted;
        const inSku = args.sku_id ? s.sku_ids_engaged.includes(args.sku_id as string) : true;
        return inStage && inSku && s.customer_id;
      });

      const customerIds = [...new Set(matchingSessions.map(s => s.customer_id!))].slice(0, limit);
      const results = customerIds.map(id => {
        const c = store.customers.find(x => x.id === id);
        return c ? { customer_id: c.id, email: c.email, persona: c.persona, clv_12m: c.clv_12m, signal: args.signal } : { customer_id: id };
      });

      return ok({ signal: args.signal, total: results.length, customers: results });
    },
  },

  {
    name: "add_to_suppression_list",
    description: "Add a customer to the suppression list (campaign-scoped or global).",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string" },
        scope: { type: "string", enum: ["global", "campaign"], default: "campaign" },
        campaign_id: { type: "string" },
        reason: { type: "string" },
        expires_at: { type: "string", description: "ISO 8601 date after which suppression expires" },
      },
      required: ["customer_id", "reason"],
    },
    handler: async (args: Record<string, unknown>) => {
      const c = store.customers.find(x => x.id === args.customer_id);
      if (!c) return ok({ error: `Customer ${args.customer_id} not found` });
      const sup: Suppression = {
        scope: (args.scope as "global" | "campaign") || "campaign",
        campaign_id: args.campaign_id as string | undefined,
        reason: args.reason as string,
        added_at: new Date().toISOString(),
        expires_at: args.expires_at as string | undefined,
      };
      c.suppression.push(sup);
      return ok({ customer_id: c.id, suppression_added: true, suppression: sup });
    },
  },

  {
    name: "remove_from_suppression_list",
    description: "Remove a suppression record from a customer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string" },
        scope: { type: "string", enum: ["global", "campaign"] },
        campaign_id: { type: "string" },
      },
      required: ["customer_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const c = store.customers.find(x => x.id === args.customer_id);
      if (!c) return ok({ error: `Customer ${args.customer_id} not found` });
      const before = c.suppression.length;
      c.suppression = c.suppression.filter(s => {
        if (args.scope && s.scope !== args.scope) return true;
        if (args.campaign_id && s.campaign_id !== args.campaign_id) return true;
        return false;
      });
      return ok({ customer_id: c.id, removed: before - c.suppression.length, remaining: c.suppression.length });
    },
  },

  {
    name: "is_suppressed",
    description: "Check if a customer is currently suppressed, globally or for a specific campaign.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string" },
        campaign_id: { type: "string", description: "Check campaign-scoped suppression for this campaign" },
      },
      required: ["customer_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const c = store.customers.find(x => x.id === args.customer_id);
      if (!c) return ok({ error: `Customer ${args.customer_id} not found` });
      const now = new Date();
      const activeSups = c.suppression.filter(s => !s.expires_at || new Date(s.expires_at) > now);
      const globalSup = activeSups.find(s => s.scope === "global");
      const campaignSup = args.campaign_id ? activeSups.find(s => s.scope === "campaign" && s.campaign_id === args.campaign_id) : undefined;
      return ok({
        customer_id: c.id,
        is_suppressed: !!(globalSup || campaignSup),
        global: !!globalSup,
        campaign_scoped: !!campaignSup,
        active_suppressions: activeSups,
      });
    },
  },
];
