import { store, newRuleId } from "../data-store.js";
import { MerchandisingRule } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export const personalizationTools = [
  {
    name: "get_recommendations",
    description: "Return real-time personalized product recommendations for a customer in a given context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string" },
        context: { type: "string", enum: ["homepage", "pdp", "cart", "email", "search_results"], default: "homepage" },
        session_id: { type: "string" },
        limit: { type: "number", default: 8 },
        exclude_sku_ids: { type: "array", items: { type: "string" } },
      },
      required: ["customer_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const c = store.customers.find(x => x.id === args.customer_id);
      if (!c) return ok({ error: `Customer ${args.customer_id} not found` });

      const affinityMap: Record<string, number> = {};
      c.varietal_affinities.forEach(a => { affinityMap[a.varietal] = a.score; });

      const exclude = new Set((args.exclude_sku_ids as string[]) || []);
      const limit = (args.limit as number) || 8;

      // Apply active campaign boosts
      const activeCampaigns = store.campaigns.filter(cam => cam.status === "ACTIVE" && cam.boost_config);
      const boostedSkus = new Set<string>();
      activeCampaigns.forEach(cam => cam.boost_config?.sku_ids.forEach(id => boostedSkus.add(id)));

      const scored = store.products
        .filter(p => p.stock_units > 0 && !exclude.has(p.id))
        .map(p => {
          const affinity = affinityMap[p.varietal_family] || 0.05;
          const priceFit = 1 - Math.min(1, Math.abs(c.avg_order_value - p.price) / (c.avg_order_value + p.price + 1));
          const boost = boostedSkus.has(p.id) ? 0.15 : 0;
          const score = affinity * 0.55 + priceFit * 0.30 + boost + (p.view_to_cart_rate * 0.15);
          return {
            sku_id: p.id,
            product_name: p.name,
            varietal: p.varietal,
            price: p.price,
            affinity_score: Math.round(score * 1000) / 1000,
            signal_sources: ["varietal_affinity", "price_fit", ...(boostedSkus.has(p.id) ? ["campaign_boost"] : [])],
            is_boosted: boostedSkus.has(p.id),
            rank: 0,
          };
        })
        .sort((a, b) => b.affinity_score - a.affinity_score)
        .slice(0, limit)
        .map((r, i) => ({ ...r, rank: i + 1 }));

      return ok({ customer_id: c.id, context: args.context, recommendations: scored });
    },
  },

  {
    name: "get_segment_recommendations",
    description: "Return the top 10 SKUs most affine to a segment (for batch email personalization).",
    inputSchema: {
      type: "object" as const,
      properties: {
        segment_id: { type: "string" },
        limit: { type: "number", default: 10 },
      },
      required: ["segment_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const seg = store.segments.find(s => s.id === args.segment_id);
      if (!seg) return ok({ error: `Segment ${args.segment_id} not found` });

      // Aggregate affinities across segment members (sample up to 50)
      const sampleIds = seg.customer_ids.slice(0, 50);
      const skuScores: Record<string, number> = {};
      sampleIds.forEach(cid => {
        const c = store.customers.find(x => x.id === cid);
        if (!c) return;
        store.products.filter(p => p.stock_units > 0).forEach(p => {
          const aff = c.varietal_affinities.find(a => a.varietal === p.varietal_family);
          skuScores[p.id] = (skuScores[p.id] || 0) + (aff?.score || 0.05);
        });
      });

      const limit = (args.limit as number) || 10;
      const results = Object.entries(skuScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([sku_id, score], i) => {
          const p = store.products.find(x => x.id === sku_id);
          return { rank: i + 1, sku_id, product_name: p?.name, varietal: p?.varietal, price: p?.price, affinity_score: Math.round(score / sampleIds.length * 1000) / 1000 };
        });

      return ok({ segment_id: seg.id, segment_name: seg.name, recommendations: results });
    },
  },

  {
    name: "get_trending_products",
    description: "Return products with accelerating velocity (by pdp_views, purchases, wishlist adds, or cart adds).",
    inputSchema: {
      type: "object" as const,
      properties: {
        trend_signal: { type: "string", enum: ["pdp_views", "velocity", "view_to_cart_rate"], default: "pdp_views" },
        varietal: { type: "string" },
        limit: { type: "number", default: 10 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let products = store.products.filter(p => p.stock_units > 0);
      if (args.varietal) products = products.filter(p => p.varietal_family.toLowerCase().includes((args.varietal as string).toLowerCase()));

      const signal = (args.trend_signal as string) || "pdp_views";
      const sortField: Record<string, keyof typeof products[0]> = {
        pdp_views: "pdp_views_7d",
        velocity: "velocity_units_per_day",
        view_to_cart_rate: "view_to_cart_rate",
      };
      const field = sortField[signal] || "pdp_views_7d";
      products.sort((a, b) => (b[field] as number) - (a[field] as number));

      return ok({
        trend_signal: signal,
        products: products.slice(0, (args.limit as number) || 10).map((p, i) => ({
          rank: i + 1, sku_id: p.id, product_name: p.name, varietal: p.varietal, price: p.price, [signal]: p[field],
        })),
      });
    },
  },

  {
    name: "get_frequently_bought_together",
    description: "Return frequently co-purchased product pairs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sku_id: { type: "string", description: "Filter to pairs containing this SKU" },
        min_co_purchase_rate: { type: "number", default: 0.1 },
        limit: { type: "number", default: 10 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let pairs = [...store.coPurchasePairs];
      if (args.sku_id) pairs = pairs.filter(p => p.sku_id_a === args.sku_id || p.sku_id_b === args.sku_id);
      if (args.min_co_purchase_rate) pairs = pairs.filter(p => p.co_purchase_rate >= (args.min_co_purchase_rate as number));
      pairs.sort((a, b) => b.co_purchase_rate - a.co_purchase_rate);

      const enriched = pairs.slice(0, (args.limit as number) || 10).map(pair => {
        const pA = store.products.find(x => x.id === pair.sku_id_a);
        const pB = store.products.find(x => x.id === pair.sku_id_b);
        return { ...pair, product_a: pA?.name, product_b: pB?.name };
      });
      return ok({ total: pairs.length, pairs: enriched });
    },
  },

  {
    name: "get_collection_page_sort_order",
    description: "Return personalized product sort order for a collection page, respecting merchandising rules and campaign boosts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        collection_id: { type: "string" },
        customer_id: { type: "string" },
        segment_id: { type: "string" },
      },
      required: ["collection_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const collection = store.collections.find(c => c.id === args.collection_id);
      if (!collection) return ok({ error: `Collection ${args.collection_id} not found` });

      const rules = store.merchandisingRules.filter(r => r.collection_id === args.collection_id);
      const pinnedSkus = new Set(rules.filter(r => r.rule_type === "pin_to_top" && r.sku_id).map(r => r.sku_id!));
      const boostedSkus = new Set(rules.filter(r => r.rule_type === "boost" && r.sku_id).map(r => r.sku_id!));
      const excludedSkus = new Set(rules.filter(r => r.rule_type === "exclude" && r.condition?.includes("stock_units == 0")).flatMap(() => store.products.filter(p => p.stock_units === 0).map(p => p.id)));

      // Also apply active campaign boosts
      store.campaigns.filter(c => c.status === "ACTIVE" && c.boost_config).forEach(cam => {
        cam.boost_config?.sku_ids.forEach(id => boostedSkus.add(id));
      });

      const skus = collection.sku_ids
        .filter(id => !excludedSkus.has(id))
        .map(id => {
          const p = store.products.find(x => x.id === id);
          const is_pinned = pinnedSkus.has(id);
          const is_boosted = boostedSkus.has(id);
          const score = (is_pinned ? 100 : 0) + (is_boosted ? 50 : 0) + (p?.view_to_cart_rate || 0) * 20 + (p?.margin_pct || 0) * 10;
          return { sku_id: id, product_name: p?.name, is_pinned, is_boosted, affinity_score: Math.round(score * 100) / 100 };
        })
        .sort((a, b) => b.affinity_score - a.affinity_score);

      return ok({ collection_id: collection.id, collection_name: collection.name, total_skus: skus.length, sku_order: skus });
    },
  },

  {
    name: "log_recommendation_feedback",
    description: "Record a customer interaction with a recommendation (view, add_to_cart, purchase, dismiss). (Stub)",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string" },
        sku_id: { type: "string" },
        action: { type: "string", enum: ["view", "add_to_cart", "purchase", "dismiss"] },
        context: { type: "string" },
        recommendation_position: { type: "number" },
      },
      required: ["customer_id", "sku_id", "action"],
    },
    handler: async (args: Record<string, unknown>) => {
      console.error(`[stub] log_recommendation_feedback: customer=${args.customer_id} sku=${args.sku_id} action=${args.action}`);
      return ok({ logged: true, feedback_id: `fb-${Date.now()}` });
    },
  },

  {
    name: "set_campaign_boost",
    description: "Elevate featured SKUs during a campaign — boosts recommendation scores in email, homepage, and collection contexts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        sku_ids: { type: "array", items: { type: "string" } },
        boost_factor: { type: "number", description: "Multiplier, e.g. 1.5 = 50% uplift", default: 1.5 },
        contexts: { type: "array", items: { type: "string" }, default: ["homepage", "collection", "email", "pdp"] },
        expires_at: { type: "string", description: "ISO 8601 datetime" },
      },
      required: ["campaign_id", "sku_ids"],
    },
    handler: async (args: Record<string, unknown>) => {
      const campaign = store.campaigns.find(c => c.id === args.campaign_id);
      if (!campaign) return ok({ error: `Campaign ${args.campaign_id} not found` });
      campaign.boost_config = {
        sku_ids: args.sku_ids as string[],
        boost_factor: (args.boost_factor as number) || 1.5,
        contexts: (args.contexts as string[]) || ["homepage", "collection", "email"],
        expires_at: (args.expires_at as string) || campaign.end_date,
      };
      return ok({ campaign_id: campaign.id, boost_applied: true, boost_config: campaign.boost_config });
    },
  },

  {
    name: "remove_campaign_boost",
    description: "Remove the recommendation boost from a campaign (on completion or pause).",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        sku_ids: { type: "array", items: { type: "string" }, description: "Specific SKUs to remove, or omit to remove all boosts for campaign" },
      },
      required: ["campaign_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const campaign = store.campaigns.find(c => c.id === args.campaign_id);
      if (!campaign) return ok({ error: `Campaign ${args.campaign_id} not found` });
      campaign.boost_config = undefined;
      return ok({ campaign_id: campaign.id, boost_removed: true });
    },
  },
];
