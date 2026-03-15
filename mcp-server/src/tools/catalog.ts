import { z } from "zod";
import { store } from "../data-store.js";
import { Product } from "../types.js";

// Helper to return MCP content format
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export const catalogTools = [
  {
    name: "get_product_catalog",
    description: "Retrieve the full product catalog with optional filters. Returns products with all fields including inventory, pricing, and behavioral metrics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        varietal: { type: "string", description: "Filter by varietal family (e.g. 'Bordeaux Blend')" },
        region: { type: "string" },
        price_tier: { type: "string", enum: ["entry", "mid", "premium", "collector"] },
        in_stock_only: { type: "boolean", description: "Only return products with stock_units > 0" },
        sort_by: { type: "string", enum: ["price_asc", "price_desc", "margin_desc", "velocity_desc", "rating_desc"], default: "price_asc" },
        limit: { type: "number", default: 20 },
        offset: { type: "number", default: 0 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let results = [...store.products];
      if (args.varietal) results = results.filter(p => p.varietal_family.toLowerCase().includes((args.varietal as string).toLowerCase()));
      if (args.region) results = results.filter(p => p.region.toLowerCase().includes((args.region as string).toLowerCase()));
      if (args.price_tier) results = results.filter(p => p.price_tier === args.price_tier);
      if (args.in_stock_only) results = results.filter(p => p.stock_units > 0);

      const sortBy = (args.sort_by as string) || "price_asc";
      results.sort((a, b) => {
        switch (sortBy) {
          case "price_desc": return b.price - a.price;
          case "margin_desc": return b.margin_pct - a.margin_pct;
          case "velocity_desc": return b.velocity_units_per_day - a.velocity_units_per_day;
          case "rating_desc": return b.rating - a.rating;
          default: return a.price - b.price;
        }
      });

      const limit = (args.limit as number) || 20;
      const offset = (args.offset as number) || 0;
      const paginated = results.slice(offset, offset + limit);

      return ok({ total: results.length, offset, limit, products: paginated });
    },
  },

  {
    name: "get_inventory_status",
    description: "Get real-time stock status for one or more SKUs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sku_ids: { type: "array", items: { type: "string" }, description: "List of SKU IDs to query" },
      },
      required: ["sku_ids"],
    },
    handler: async (args: Record<string, unknown>) => {
      const ids = args.sku_ids as string[];
      const results = ids.map(id => {
        const p = store.products.find(x => x.id === id);
        if (!p) return { sku_id: id, error: "not found" };
        const status = p.stock_units === 0 ? "out_of_stock" : p.days_of_supply < 14 ? "low" : p.days_of_supply > 90 ? "overstock" : "in_stock";
        return {
          sku_id: p.id,
          name: p.name,
          stock_units: p.stock_units,
          days_of_supply: p.days_of_supply,
          velocity_units_per_day: p.velocity_units_per_day,
          status,
          incoming_shipment_eta: null,
        };
      });
      return ok(results);
    },
  },

  {
    name: "get_overstock_skus",
    description: "Return SKUs that have excess inventory beyond a threshold of days-of-supply.",
    inputSchema: {
      type: "object" as const,
      properties: {
        threshold_days: { type: "number", description: "Flag SKUs with days_of_supply >= this value", default: 60 },
        include_behavioral: { type: "boolean", description: "Include pdp_views and view_to_cart_rate in response", default: true },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const threshold = (args.threshold_days as number) || 60;
      const results = store.products
        .filter(p => p.days_of_supply >= threshold)
        .sort((a, b) => b.days_of_supply - a.days_of_supply)
        .map(p => ({
          sku_id: p.id,
          name: p.name,
          varietal: p.varietal,
          region: p.region,
          price_tier: p.price_tier,
          price: p.price,
          stock_units: p.stock_units,
          days_of_supply: p.days_of_supply,
          velocity_units_per_day: p.velocity_units_per_day,
          severity: p.days_of_supply >= 90 ? "critical" : "moderate",
          ...(args.include_behavioral !== false && { pdp_views_7d: p.pdp_views_7d, view_to_cart_rate: p.view_to_cart_rate }),
        }));
      return ok({ count: results.length, threshold_days: threshold, skus: results });
    },
  },

  {
    name: "get_high_intent_low_stock_skus",
    description: "Return SKUs with high browse intent but low inventory — candidates for limited allocation campaigns.",
    inputSchema: {
      type: "object" as const,
      properties: {
        min_pdp_views_7d: { type: "number", default: 200 },
        min_view_to_cart_rate: { type: "number", default: 0.25 },
        max_stock_units: { type: "number", default: 100 },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const minViews = (args.min_pdp_views_7d as number) || 200;
      const minV2C = (args.min_view_to_cart_rate as number) || 0.25;
      const maxStock = (args.max_stock_units as number) || 100;

      const results = store.products
        .filter(p => p.pdp_views_7d >= minViews && p.view_to_cart_rate >= minV2C && p.stock_units <= maxStock && p.stock_units > 0)
        .sort((a, b) => b.view_to_cart_rate - a.view_to_cart_rate)
        .map(p => ({
          sku_id: p.id,
          name: p.name,
          varietal: p.varietal,
          price_tier: p.price_tier,
          price: p.price,
          stock_units: p.stock_units,
          days_of_supply: p.days_of_supply,
          pdp_views_7d: p.pdp_views_7d,
          view_to_cart_rate: p.view_to_cart_rate,
          restock_urgency_score: Math.round((p.view_to_cart_rate * 100) * (1 - p.stock_units / maxStock)),
        }));
      return ok({ count: results.length, skus: results });
    },
  },

  {
    name: "watch_inventory_alerts",
    description: "Subscribe to webhook alerts for stock status changes (stub — logs intent, returns webhook_id).",
    inputSchema: {
      type: "object" as const,
      properties: {
        alert_types: { type: "array", items: { type: "string", enum: ["out_of_stock", "low", "restocked", "overstock"] } },
        sku_ids: { type: "array", items: { type: "string" }, description: "Specific SKUs to watch, or omit for all" },
        webhook_url: { type: "string" },
      },
      required: ["alert_types"],
    },
    handler: async (args: Record<string, unknown>) => {
      const webhookId = `wh-inv-${Date.now()}`;
      console.error(`[stub] watch_inventory_alerts: ${webhookId} registered for ${JSON.stringify(args.alert_types)}`);
      return ok({ webhook_id: webhookId, status: "registered", message: "Stub: alerts will not fire in simulation mode" });
    },
  },

  {
    name: "update_product_metadata",
    description: "Update marketing-owned fields on a product (tasting notes, SEO description, pairing suggestions, short description).",
    inputSchema: {
      type: "object" as const,
      properties: {
        sku_id: { type: "string" },
        tasting_notes: { type: "string" },
        seo_description: { type: "string" },
        short_description: { type: "string" },
        pairing_suggestions: { type: "array", items: { type: "string" } },
      },
      required: ["sku_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const product = store.products.find(p => p.id === args.sku_id);
      if (!product) return ok({ error: `SKU ${args.sku_id} not found` });
      if (args.tasting_notes) product.tasting_notes = args.tasting_notes as string;
      if (args.seo_description) product.seo_description = args.seo_description as string;
      if (args.short_description) product.short_description = args.short_description as string;
      if (args.pairing_suggestions) product.pairing_suggestions = args.pairing_suggestions as string[];
      return ok({ sku_id: product.id, updated: true, product });
    },
  },
];
