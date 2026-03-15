import { store, newTestId, newRuleId } from "../data-store.js";
import { ABTest, MerchandisingRule, Session } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export const behavioralTools = [
  {
    name: "log_session_event",
    description: "Record a behavioral event from the website tracking SDK (page_view, pdp_view, add_to_cart, purchase, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: { type: "string" },
        customer_id: { type: "string" },
        anonymous_id: { type: "string" },
        event_type: { type: "string", enum: ["page_view", "pdp_view", "scroll_depth", "video_play", "add_to_cart", "remove_from_cart", "wishlist_add", "wishlist_view", "search_query", "search_result_click", "checkout_step", "purchase", "exit_intent", "blog_view", "filter_applied", "sort_changed", "hover_dwell"] },
        sku_id: { type: "string" },
        query: { type: "string" },
        page_type: { type: "string" },
        scroll_pct: { type: "number" },
        metadata: { type: "object" },
      },
      required: ["session_id", "event_type"],
    },
    handler: async (args: Record<string, unknown>) => {
      store.runtimeSessionEvents.push({ session_id: args.session_id as string, event: { ...args, timestamp: new Date().toISOString() } });
      return ok({ logged: true, session_id: args.session_id, event_type: args.event_type, timestamp: new Date().toISOString() });
    },
  },

  {
    name: "get_session_summary",
    description: "Return a summary of all events in a session with derived intent signals.",
    inputSchema: {
      type: "object" as const,
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const session = store.sessions.find(s => s.id === args.session_id);
      if (!session) {
        const rtEvents = store.runtimeSessionEvents.filter(e => e.session_id === args.session_id);
        if (rtEvents.length === 0) return ok({ error: `Session ${args.session_id} not found` });
        return ok({ session_id: args.session_id, event_count: rtEvents.length, events: rtEvents.map(e => e.event), note: "Runtime session — no derived signals yet" });
      }
      return ok({
        session_id: session.id,
        customer_id: session.customer_id,
        device_type: session.device_type,
        traffic_source: session.traffic_source,
        intent_score: session.intent_score,
        funnel_stage_reached: session.funnel_stage_reached,
        converted: session.converted,
        sku_ids_engaged: session.sku_ids_engaged,
        search_queries_used: session.search_queries_used,
        total_pdp_views: session.total_pdp_views,
        events: session.events,
      });
    },
  },

  {
    name: "get_customer_session_history",
    description: "Return chronological session history for a customer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string" },
        limit: { type: "number", default: 10 },
      },
      required: ["customer_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const sessions = store.sessions
        .filter(s => s.customer_id === args.customer_id)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, (args.limit as number) || 10)
        .map(s => ({
          session_id: s.id,
          started_at: s.started_at,
          device_type: s.device_type,
          traffic_source: s.traffic_source,
          funnel_stage: s.funnel_stage_reached,
          converted: s.converted,
          intent_score: s.intent_score,
          sku_ids_engaged: s.sku_ids_engaged,
        }));
      return ok({ customer_id: args.customer_id, total: sessions.length, sessions });
    },
  },

  {
    name: "watch_behavioral_triggers",
    description: "Subscribe to webhook alerts for behavioral patterns (cart_abandon, exit_intent, etc.). (Stub)",
    inputSchema: {
      type: "object" as const,
      properties: {
        trigger_type: { type: "string", enum: ["repeated_pdp_view", "cart_abandon", "high_dwell", "exit_intent", "wishlist_inactivity", "search_no_purchase"] },
        webhook_url: { type: "string" },
        auto_intervention: { type: "string", enum: ["cart_abandon_email", "exit_intent_offer", "nudge"] },
      },
      required: ["trigger_type"],
    },
    handler: async (args: Record<string, unknown>) => {
      const webhookId = `wh-beh-${Date.now()}`;
      console.error(`[stub] watch_behavioral_triggers: ${webhookId} for ${args.trigger_type}`);
      return ok({ webhook_id: webhookId, trigger_type: args.trigger_type, status: "registered", message: "Stub: triggers will not fire in simulation mode" });
    },
  },

  {
    name: "get_search_query_report",
    description: "Return search analytics: top queries, zero-result queries, and search-to-purchase rate.",
    inputSchema: {
      type: "object" as const,
      properties: {
        period_days: { type: "number", default: 30 },
        min_count: { type: "number", default: 5 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      return ok(store.searchQueryReport);
    },
  },

  {
    name: "get_funnel_drop_off_report",
    description: "Return conversion funnel with drop-off analysis, optionally filtered by device or traffic source.",
    inputSchema: {
      type: "object" as const,
      properties: {
        device_type: { type: "string", enum: ["desktop", "mobile", "tablet"] },
        traffic_source: { type: "string" },
        segment_id: { type: "string" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let funnels = [...store.conversionFunnels];
      if (args.device_type) funnels = funnels.filter(f => f.device_type === args.device_type);
      if (args.traffic_source) funnels = funnels.filter(f => f.traffic_source === args.traffic_source);
      const overall = funnels.length > 0 ? funnels.reduce((a, f) => a + f.overall_conversion_rate, 0) / funnels.length : 0;
      return ok({ overall_conversion_rate: Math.round(overall * 1000) / 1000, funnels });
    },
  },

  {
    name: "get_page_engagement_metrics",
    description: "Return page engagement metrics (scroll depth, dwell time, bounce rate) by page type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_type: { type: "string", enum: ["homepage", "collection", "pdp", "blog", "cart", "checkout"] },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      // Return simulated page metrics
      const metrics: Record<string, object> = {
        homepage: { page_type: "homepage", avg_scroll_depth_pct: 0.52, avg_dwell_seconds: 42, bounce_rate: 0.38, exit_rate: 0.22, conversion_rate: 0.028 },
        collection: { page_type: "collection", avg_scroll_depth_pct: 0.68, avg_dwell_seconds: 94, bounce_rate: 0.24, exit_rate: 0.18, conversion_rate: 0.048 },
        pdp: { page_type: "pdp", avg_scroll_depth_pct: 0.74, avg_dwell_seconds: 128, bounce_rate: 0.18, exit_rate: 0.28, conversion_rate: 0.12 },
        blog: { page_type: "blog", avg_scroll_depth_pct: 0.62, avg_dwell_seconds: 248, bounce_rate: 0.42, exit_rate: 0.38, conversion_rate: 0.018 },
        cart: { page_type: "cart", avg_scroll_depth_pct: 0.88, avg_dwell_seconds: 64, bounce_rate: 0.08, exit_rate: 0.44, conversion_rate: 0.58 },
        checkout: { page_type: "checkout", avg_scroll_depth_pct: 0.95, avg_dwell_seconds: 124, bounce_rate: 0.04, exit_rate: 0.22, conversion_rate: 0.78 },
      };
      if (args.page_type) return ok(metrics[args.page_type as string] || { error: "page_type not found" });
      return ok({ pages: Object.values(metrics) });
    },
  },

  {
    name: "get_sku_behavioral_metrics",
    description: "Return on-site behavioral metrics for one or more SKUs (pdp_views, view_to_cart_rate, repeat_viewers, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        sku_ids: { type: "array", items: { type: "string" } },
        period_days: { type: "number", default: 7 },
      },
      required: ["sku_ids"],
    },
    handler: async (args: Record<string, unknown>) => {
      const ids = args.sku_ids as string[];
      const results = ids.map(id => {
        const p = store.products.find(x => x.id === id);
        if (!p) return { sku_id: id, error: "not found" };
        const sessionsWithSku = store.sessions.filter(s => s.sku_ids_engaged.includes(id));
        const uniqueViewers = new Set(sessionsWithSku.map(s => s.customer_id)).size;
        const searchDriven = sessionsWithSku.filter(s => s.search_queries_used.length > 0).length;
        return {
          sku_id: p.id,
          product_name: p.name,
          pdp_views: p.pdp_views_7d,
          unique_viewers: uniqueViewers,
          scroll_depth_avg_pct: 0.74,
          wishlist_adds: Math.round(p.pdp_views_7d * 0.08),
          cart_adds: Math.round(p.pdp_views_7d * p.view_to_cart_rate),
          view_to_cart_rate: p.view_to_cart_rate,
          cart_to_purchase_rate: p.cart_to_purchase_rate,
          repeat_view_customers: Math.round(uniqueViewers * 0.22),
          search_driven_views: searchDriven,
        };
      });
      return ok({ period_days: args.period_days || 7, skus: results });
    },
  },

  {
    name: "create_ab_test",
    description: "Create a new A/B test for a page element.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        page_type: { type: "string", enum: ["homepage", "collection", "pdp", "blog", "cart", "checkout", "email"] },
        element: { type: "string" },
        campaign_id: { type: "string" },
        sku_id: { type: "string" },
        variants: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string", enum: ["A", "B"] }, description: { type: "string" } },
          },
        },
        primary_metric: { type: "string" },
        traffic_split: { type: "number", default: 0.5 },
        min_sample_size: { type: "number", default: 200 },
        max_duration_days: { type: "number", default: 21 },
      },
      required: ["name", "page_type", "element", "primary_metric", "variants"],
    },
    handler: async (args: Record<string, unknown>) => {
      const test: ABTest = {
        id: newTestId(),
        name: args.name as string,
        page_type: args.page_type as string,
        element: args.element as string,
        campaign_id: args.campaign_id as string | undefined,
        sku_id: args.sku_id as string | undefined,
        status: "running",
        primary_metric: args.primary_metric as string,
        traffic_split: (args.traffic_split as number) || 0.5,
        min_sample_size: (args.min_sample_size as number) || 200,
        max_duration_days: (args.max_duration_days as number) || 21,
        started_at: new Date().toISOString(),
        variants: ((args.variants as ABTest["variants"]) || []).map(v => ({
          ...v,
          sessions: 0,
          primary_metric_value: 0,
        })),
      };
      store.abTests.push(test);
      return ok({ test_id: test.id, status: "running", test });
    },
  },

  {
    name: "get_ab_test_results",
    description: "Return results for one or all A/B tests with statistical significance data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        test_id: { type: "string" },
        campaign_id: { type: "string" },
        status: { type: "string", enum: ["running", "complete", "inconclusive", "stopped_early"] },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let tests = [...store.abTests];
      if (args.test_id) tests = tests.filter(t => t.id === args.test_id);
      if (args.campaign_id) tests = tests.filter(t => t.campaign_id === args.campaign_id);
      if (args.status) tests = tests.filter(t => t.status === args.status);
      return ok({ total: tests.length, tests });
    },
  },

  {
    name: "update_merchandising_rules",
    description: "Add or update a merchandising rule for a collection (pin, boost, bury, exclude).",
    inputSchema: {
      type: "object" as const,
      properties: {
        collection_id: { type: "string" },
        rule_type: { type: "string", enum: ["pin_to_top", "boost", "bury", "exclude"] },
        sku_id: { type: "string" },
        condition: { type: "string" },
        priority: { type: "number", default: 5 },
        expires_at: { type: "string" },
      },
      required: ["collection_id", "rule_type"],
    },
    handler: async (args: Record<string, unknown>) => {
      const rule: MerchandisingRule = {
        id: newRuleId(),
        collection_id: args.collection_id as string,
        rule_type: args.rule_type as MerchandisingRule["rule_type"],
        sku_id: args.sku_id as string | undefined,
        condition: args.condition as string | undefined,
        priority: (args.priority as number) || 5,
        created_at: new Date().toISOString(),
        expires_at: args.expires_at as string | undefined,
      };
      store.merchandisingRules.push(rule);
      return ok({ rule_id: rule.id, collection_id: rule.collection_id, rule });
    },
  },

  {
    name: "get_merchandising_rules",
    description: "Return active merchandising rules for a collection.",
    inputSchema: {
      type: "object" as const,
      properties: {
        collection_id: { type: "string" },
        include_expired: { type: "boolean", default: false },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let rules = [...store.merchandisingRules];
      if (args.collection_id) rules = rules.filter(r => r.collection_id === args.collection_id);
      if (!args.include_expired) {
        const now = new Date().toISOString();
        rules = rules.filter(r => !r.expires_at || r.expires_at > now);
      }
      return ok({ total: rules.length, rules });
    },
  },

  {
    name: "trigger_onsite_intervention",
    description: "Fire a UI intervention for a customer session (exit intent offer, low stock urgency, chat prompt, cross-sell drawer). (Stub)",
    inputSchema: {
      type: "object" as const,
      properties: {
        intervention_type: { type: "string", enum: ["exit_intent_offer", "low_stock_urgency", "chat_prompt", "cross_sell_drawer"] },
        customer_id: { type: "string" },
        anonymous_id: { type: "string" },
        sku_id: { type: "string" },
        offer_pct: { type: "number" },
      },
      required: ["intervention_type"],
    },
    handler: async (args: Record<string, unknown>) => {
      console.error(`[stub] trigger_onsite_intervention: ${args.intervention_type} for customer=${args.customer_id}`);
      return ok({ triggered: true, intervention_id: `int-${Date.now()}`, intervention_type: args.intervention_type });
    },
  },

  {
    name: "list_ab_tests",
    description: "List A/B tests filtered by status, page type, campaign, or SKU.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["running", "complete", "inconclusive", "stopped_early"] },
        page_type: { type: "string" },
        campaign_id: { type: "string" },
        sku_id: { type: "string" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let tests = [...store.abTests];
      if (args.status) tests = tests.filter(t => t.status === args.status);
      if (args.page_type) tests = tests.filter(t => t.page_type === args.page_type);
      if (args.campaign_id) tests = tests.filter(t => t.campaign_id === args.campaign_id);
      if (args.sku_id) tests = tests.filter(t => t.sku_id === args.sku_id);
      const summary = tests.map(t => ({
        test_id: t.id,
        name: t.name,
        page_type: t.page_type,
        element: t.element,
        status: t.status,
        primary_metric: t.primary_metric,
        started_at: t.started_at,
        winner: t.winner,
      }));
      return ok({ total: tests.length, tests: summary });
    },
  },

  {
    name: "get_demand_gap_report",
    description: "Return search queries that returned zero or very few results — these represent catalog or content gaps.",
    inputSchema: {
      type: "object" as const,
      properties: {
        min_search_count: { type: "number", default: 5, description: "Only return queries with at least this many searches" },
        max_result_count: { type: "number", default: 3, description: "Only return queries that returned fewer than this many results" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const minCount = (args.min_search_count as number) || 5;
      const zeroResult = store.searchQueryReport.zero_result_queries?.filter(q => q.count >= minCount) || [];
      const lowResult = store.searchQueryReport.low_result_queries?.filter(q => q.count >= minCount) || [];
      const gaps = [
        ...zeroResult.map(q => ({ ...q, result_count: 0, gap_type: "zero_results", suggested_action: "add_sku or create_content" })),
        ...lowResult.map(q => ({ ...q, gap_type: "low_results", suggested_action: "improve_search_index" })),
      ].sort((a, b) => b.count - a.count);
      return ok({ total: gaps.length, demand_gaps: gaps });
    },
  },
];
