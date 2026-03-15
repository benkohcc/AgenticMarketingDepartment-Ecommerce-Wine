import { store } from "../data-store.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export const analyticsTools = [
  {
    name: "get_performance_summary",
    description: "Return a cross-channel performance snapshot — total revenue, orders, ROAS, and per-channel breakdown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        date_range: {
          type: "object",
          properties: { start: { type: "string" }, end: { type: "string" } },
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const emailSends = args.campaign_id
        ? store.emailSends.filter(s => s.campaign_id === args.campaign_id)
        : store.emailSends;
      const paid = args.campaign_id
        ? store.paidCampaigns.filter(p => p.campaign_id === args.campaign_id)
        : store.paidCampaigns;
      const posts = args.campaign_id
        ? store.socialPosts.filter(p => p.campaign_id === args.campaign_id)
        : store.socialPosts;

      const emailRevenue = emailSends.reduce((s, x) => s + x.revenue_attributed, 0);
      const emailOrders = emailSends.reduce((s, x) => s + x.conversion_count, 0);
      const paidRevenue = paid.reduce((s, x) => s + x.revenue, 0);
      const paidSpend = paid.reduce((s, x) => s + x.total_spend, 0);
      const paidOrders = paid.reduce((s, x) => s + x.conversions, 0);
      const socialRevenue = posts.reduce((s, x) => {
        // Rough attribution: 5% of reach × avg order value
        return s + x.reach * 0.001 * 85;
      }, 0);
      const totalRevenue = emailRevenue + paidRevenue + socialRevenue;
      const totalSpend = paidSpend + 200; // notional email platform spend
      const blendedRoas = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 10) / 10 : 0;

      return ok({
        campaign_id: args.campaign_id || "all",
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_orders: emailOrders + paidOrders,
        avg_order_value: (emailOrders + paidOrders) > 0 ? Math.round(totalRevenue / (emailOrders + paidOrders) * 100) / 100 : 0,
        blended_roas: blendedRoas,
        channels: [
          { channel: "email", revenue: Math.round(emailRevenue * 100) / 100, orders: emailOrders, spend: 200, roas: Math.round(emailRevenue / 200 * 10) / 10, contribution_pct: Math.round(emailRevenue / Math.max(totalRevenue, 1) * 1000) / 10 },
          { channel: "paid", revenue: Math.round(paidRevenue * 100) / 100, orders: paidOrders, spend: paidSpend, roas: paidSpend > 0 ? Math.round(paidRevenue / paidSpend * 10) / 10 : 0, contribution_pct: Math.round(paidRevenue / Math.max(totalRevenue, 1) * 1000) / 10 },
          { channel: "social", revenue: Math.round(socialRevenue * 100) / 100, orders: Math.round(socialRevenue / 85), spend: 0, roas: null, contribution_pct: Math.round(socialRevenue / Math.max(totalRevenue, 1) * 1000) / 10 },
        ],
      });
    },
  },

  {
    name: "get_attribution_report",
    description: "Return revenue attribution by model (first_touch, last_touch, linear, time_decay, data_driven).",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        model: { type: "string", enum: ["first_touch", "last_touch", "linear", "time_decay", "data_driven"], default: "last_touch" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const model = (args.model as string) || "last_touch";
      // Model weights (email / paid / social)
      const weights: Record<string, [number, number, number]> = {
        first_touch: [0.30, 0.55, 0.15],
        last_touch: [0.55, 0.30, 0.15],
        linear: [0.40, 0.40, 0.20],
        time_decay: [0.50, 0.35, 0.15],
        data_driven: [0.48, 0.36, 0.16],
      };
      const [ew, pw, sw] = weights[model];
      const emailRevenue = store.emailSends.reduce((s, x) => s + x.revenue_attributed, 0);
      const paidRevenue = store.paidCampaigns.reduce((s, x) => s + x.revenue, 0);
      const total = emailRevenue + paidRevenue;

      return ok({
        campaign_id: args.campaign_id || "all",
        model,
        channels: [
          { channel: "email", attributed_revenue: Math.round(total * ew * 100) / 100, attribution_pct: Math.round(ew * 1000) / 10 },
          { channel: "paid", attributed_revenue: Math.round(total * pw * 100) / 100, attribution_pct: Math.round(pw * 1000) / 10 },
          { channel: "social", attributed_revenue: Math.round(total * sw * 100) / 100, attribution_pct: Math.round(sw * 1000) / 10 },
        ],
        note: `Attribution model: ${model}. Revenue split differs from last_touch by design.`,
      });
    },
  },

  {
    name: "get_conversion_funnel",
    description: "Return step-by-step conversion funnel with drop-off rates, optionally filtered by device type or traffic source.",
    inputSchema: {
      type: "object" as const,
      properties: {
        device_type: { type: "string", enum: ["desktop", "mobile", "tablet"] },
        traffic_source: { type: "string", enum: ["organic_search", "paid_search", "email", "paid_social", "direct", "referral"] },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let funnels = [...store.conversionFunnels];
      if (args.device_type) funnels = funnels.filter(f => f.device_type === args.device_type);
      if (args.traffic_source) funnels = funnels.filter(f => f.traffic_source === args.traffic_source);
      return ok({ funnels });
    },
  },

  {
    name: "detect_anomalies",
    description: "Detect anomalies in key metrics over a lookback window, with optional campaign or segment scoping.",
    inputSchema: {
      type: "object" as const,
      properties: {
        metric: { type: "string", description: "e.g. email_open_rate, roas, conversion_rate" },
        lookback_days: { type: "number", default: 7 },
        sensitivity: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
        campaign_id: { type: "string" },
        segment_id: { type: "string" },
        sku_id: { type: "string" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      // Simulate anomaly detection with threshold rules
      const anomalies: Array<{ metric: string; severity: string; current_value: number; expected_value: number; deviation_pct: number; description: string }> = [];

      if (store.emailSends.length > 0) {
        const avgOpenRate = store.emailSends.reduce((s, x) => s + x.unique_open_rate, 0) / store.emailSends.length;
        const recentSend = store.emailSends[store.emailSends.length - 1];
        if (recentSend && recentSend.bounce_rate > 0.03) {
          anomalies.push({ metric: "email_bounce_rate", severity: "warning", current_value: recentSend.bounce_rate, expected_value: 0.015, deviation_pct: Math.round((recentSend.bounce_rate / 0.015 - 1) * 100), description: "Email bounce rate above normal — check list hygiene" });
        }
      }

      const activePaid = store.paidCampaigns.filter(p => p.status === "active");
      for (const p of activePaid) {
        if (p.roas < 1.5 && p.total_spend > 200) {
          anomalies.push({ metric: "paid_roas", severity: p.roas < 1.0 ? "critical" : "warning", current_value: p.roas, expected_value: 2.5, deviation_pct: Math.round((1 - p.roas / 2.5) * 100), description: `Low ROAS on ${p.platform} campaign for ${p.campaign_id}` });
        }
      }

      return ok({
        lookback_days: args.lookback_days || 7,
        sensitivity: args.sensitivity || "medium",
        anomaly_count: anomalies.length,
        anomalies,
        checked_at: new Date().toISOString(),
      });
    },
  },

  {
    name: "get_product_performance",
    description: "Return SKU-level performance metrics ranked by a specified dimension.",
    inputSchema: {
      type: "object" as const,
      properties: {
        rank_by: { type: "string", enum: ["revenue", "units", "margin", "pdp_views", "view_to_cart_rate", "cart_to_purchase_rate"], default: "revenue" },
        varietal: { type: "string" },
        price_tier: { type: "string" },
        limit: { type: "number", default: 20 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let perf = [...store.productPerformance];
      if (args.varietal) {
        const ids = store.products.filter(p => p.varietal_family.toLowerCase().includes((args.varietal as string).toLowerCase())).map(p => p.id);
        perf = perf.filter(p => ids.includes(p.sku_id));
      }
      if (args.price_tier) {
        const ids = store.products.filter(p => p.price_tier === args.price_tier).map(p => p.id);
        perf = perf.filter(p => ids.includes(p.sku_id));
      }
      const rankBy = (args.rank_by as string) || "revenue";
      perf.sort((a, b) => (b[rankBy as keyof typeof b] as number) - (a[rankBy as keyof typeof a] as number));
      return ok({ total: perf.length, rank_by: rankBy, products: perf.slice(0, (args.limit as number) || 20) });
    },
  },

  {
    name: "get_cohort_retention",
    description: "Return customer retention by acquisition cohort and channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        acquisition_channel: { type: "string", enum: ["organic_search", "paid_search", "email", "paid_social", "direct", "referral"] },
        cohort_period: { type: "string", enum: ["week", "month"], default: "month" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let cohorts = [...store.cohortRetention];
      if (args.acquisition_channel) cohorts = cohorts.filter(c => c.acquisition_channel === args.acquisition_channel);
      return ok({ cohorts, notes: "retention_by_month: index 0 = acquisition month (100%), index 1 = month 1, etc." });
    },
  },

  {
    name: "get_content_conversion_attribution",
    description: "Return attribution data for blog posts and editorial content (what traffic did they drive to PDPs and purchases).",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        limit: { type: "number", default: 10 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      // Return simulated content attribution based on campaign-005 (educational)
      const items = [
        { content_id: "blog-001", title: "What is Natural Wine? A Beginner's Guide", campaign_id: "camp-005", unique_views: 2840, avg_dwell_seconds: 284, pdp_clicks: 312, add_to_carts: 88, purchases: 22, attributed_revenue: 1980, top_sku_ids_driven: [] as string[] },
        { content_id: "blog-002", title: "5 Barolo Producers You Should Know", campaign_id: "camp-006", unique_views: 1420, avg_dwell_seconds: 412, pdp_clicks: 248, add_to_carts: 64, purchases: 18, attributed_revenue: 3240, top_sku_ids_driven: ["SKU-031"] },
      ];
      let results = args.campaign_id ? items.filter(i => i.campaign_id === args.campaign_id) : items;
      return ok({ total: results.length, content: results.slice(0, (args.limit as number) || 10) });
    },
  },
];
