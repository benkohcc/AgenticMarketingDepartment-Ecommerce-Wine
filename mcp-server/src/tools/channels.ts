import { store, newSendId, newPostId, newPaidId } from "../data-store.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function stub(tool: string, args: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  console.error(`[stub] ${tool}: ${JSON.stringify(args)}`);
  return ok({ stub: true, tool, ...extra, timestamp: new Date().toISOString() });
}

export const channelTools = [
  {
    name: "send_email_campaign",
    description: "Send a bulk email campaign to a list of customers. Supports A/B subject line testing. (Stub — logs intent, returns simulated send_id.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        segment_id: { type: "string" },
        customer_ids: { type: "array", items: { type: "string" } },
        subject_line_asset_id: { type: "string" },
        ab_test_config: {
          type: "object",
          properties: {
            subject_line_a_asset_id: { type: "string" },
            subject_line_b_asset_id: { type: "string" },
            split_pct: { type: "number" },
          },
        },
        email_body_asset_id: { type: "string" },
        scheduled_at: { type: "string", description: "ISO 8601 datetime, or omit for immediate send" },
      },
      required: ["campaign_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const sendId = newSendId();
      const seg = args.segment_id ? store.segments.find(s => s.id === args.segment_id) : null;
      const recipientCount = seg ? seg.customer_count : ((args.customer_ids as string[])?.length || 0);
      const suppressedCount = Math.round(recipientCount * 0.04);
      const deliveredCount = recipientCount - suppressedCount;
      return stub("send_email_campaign", args, {
        send_id: sendId,
        campaign_id: args.campaign_id,
        recipient_count: recipientCount,
        suppressed_count: suppressedCount,
        delivered_count: deliveredCount,
        scheduled_at: args.scheduled_at || new Date().toISOString(),
        status: "queued",
      });
    },
  },

  {
    name: "trigger_behavioral_email",
    description: "Send a transactional behavioral email to a single customer (cart abandon, winback, etc.). (Stub)",
    inputSchema: {
      type: "object" as const,
      properties: {
        event_type: { type: "string", enum: ["cart_abandon", "browse_abandon", "post_purchase", "winback", "high_intent_nudge"] },
        customer_id: { type: "string" },
        sku_id: { type: "string" },
        delay_minutes: { type: "number", default: 45 },
        suppress_if_purchased: { type: "boolean", default: true },
      },
      required: ["event_type", "customer_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      return stub("trigger_behavioral_email", args, {
        trigger_id: `trig-${Date.now()}`,
        customer_id: args.customer_id,
        event_type: args.event_type,
        fires_at: new Date(Date.now() + ((args.delay_minutes as number) || 45) * 60000).toISOString(),
      });
    },
  },

  {
    name: "get_email_metrics",
    description: "Return email performance metrics for a campaign's sends.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        send_id: { type: "string" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let sends = [...store.emailSends];
      if (args.campaign_id) sends = sends.filter(s => s.campaign_id === args.campaign_id);
      if (args.send_id) sends = sends.filter(s => s.id === args.send_id);
      // Aggregate if multiple sends
      const agg = sends.reduce((acc, s) => ({
        total_delivered: acc.total_delivered + s.delivered_count,
        total_opens: acc.total_opens + s.open_count,
        total_clicks: acc.total_clicks + s.click_count,
        total_conversions: acc.total_conversions + s.conversion_count,
        total_revenue: acc.total_revenue + s.revenue_attributed,
      }), { total_delivered: 0, total_opens: 0, total_clicks: 0, total_conversions: 0, total_revenue: 0 });

      const avgOpenRate = sends.length ? sends.reduce((a, s) => a + s.unique_open_rate, 0) / sends.length : 0;
      const avgCtr = sends.length ? sends.reduce((a, s) => a + s.ctr, 0) / sends.length : 0;

      return ok({
        campaign_id: args.campaign_id,
        sends,
        aggregate: {
          ...agg,
          avg_open_rate: Math.round(avgOpenRate * 1000) / 1000,
          avg_ctr: Math.round(avgCtr * 1000) / 1000,
          overall_roas: agg.total_revenue > 0 ? Math.round(agg.total_revenue / Math.max(1, sends.length * 200) * 10) / 10 : 0,
        },
      });
    },
  },

  {
    name: "publish_social_post",
    description: "Schedule or immediately publish a social post. (Stub — returns post_id and scheduled_at.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        platform: { type: "string", enum: ["instagram", "facebook", "pinterest", "tiktok"] },
        caption: { type: "string" },
        image_url: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        link_url: { type: "string" },
        alt_text: { type: "string" },
        scheduled_at: { type: "string" },
      },
      required: ["campaign_id", "platform", "caption"],
    },
    handler: async (args: Record<string, unknown>) => {
      const postId = newPostId();
      return stub("publish_social_post", args, {
        post_id: postId,
        platform: args.platform,
        campaign_id: args.campaign_id,
        scheduled_at: args.scheduled_at || new Date().toISOString(),
        status: args.scheduled_at ? "scheduled" : "published",
      });
    },
  },

  {
    name: "get_social_metrics",
    description: "Return social media engagement metrics by platform.",
    inputSchema: {
      type: "object" as const,
      properties: {
        platform: { type: "string", enum: ["instagram", "facebook", "pinterest", "tiktok"] },
        campaign_id: { type: "string" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let metrics = [...store.socialMetrics];
      if (args.platform) metrics = metrics.filter(m => m.platform === args.platform);

      let posts = [...store.socialPosts];
      if (args.campaign_id) posts = posts.filter(p => p.campaign_id === args.campaign_id);
      if (args.platform) posts = posts.filter(p => p.platform === args.platform);

      return ok({ platform_metrics: metrics, campaign_posts: posts });
    },
  },

  {
    name: "sync_product_feed_to_ad_platforms",
    description: "Push current catalog (prices, availability, images) to connected ad platforms. (Stub)",
    inputSchema: {
      type: "object" as const,
      properties: {
        platforms: { type: "array", items: { type: "string", enum: ["google", "meta", "pinterest"] } },
        in_stock_only: { type: "boolean", default: true },
        min_margin: { type: "number" },
        varietal_filter: { type: "string" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let products = [...store.products];
      if (args.in_stock_only !== false) products = products.filter(p => p.stock_units > 0);
      if (args.min_margin) products = products.filter(p => p.margin_pct >= (args.min_margin as number));
      return stub("sync_product_feed_to_ad_platforms", args, {
        synced_sku_count: products.length,
        platforms: args.platforms || ["google", "meta"],
        synced_at: new Date().toISOString(),
      });
    },
  },

  {
    name: "create_paid_campaign",
    description: "Create a paid ad campaign on a platform. (Stub — returns platform_campaign_id.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        platform: { type: "string", enum: ["google", "meta", "pinterest"] },
        campaign_type: { type: "string", enum: ["search", "shopping", "display", "video", "social_feed", "retargeting"] },
        sku_ids: { type: "array", items: { type: "string" } },
        audience_id: { type: "string" },
        budget_daily: { type: "number" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        headline_asset_ids: { type: "array", items: { type: "string" } },
        description_asset_ids: { type: "array", items: { type: "string" } },
      },
      required: ["campaign_id", "platform", "campaign_type"],
    },
    handler: async (args: Record<string, unknown>) => {
      const platformCampaignId = `${args.platform}-${args.campaign_id}-${Date.now()}`;
      return stub("create_paid_campaign", args, {
        paid_campaign_id: newPaidId(),
        platform_campaign_id: platformCampaignId,
        platform: args.platform,
        campaign_id: args.campaign_id,
        status: "active",
        budget_daily: args.budget_daily,
      });
    },
  },

  {
    name: "create_behavioral_audience",
    description: "Push a behavioral customer segment to an ad platform as a custom audience. (Stub)",
    inputSchema: {
      type: "object" as const,
      properties: {
        platform: { type: "string", enum: ["google", "meta", "pinterest"] },
        segment_id: { type: "string" },
        behavior_signal: { type: "string", enum: ["repeated_pdp", "cart_abandon", "wishlist_view", "deep_scroll", "high_intent"] },
        campaign_id: { type: "string" },
        create_lookalike: { type: "boolean", default: false },
        lookalike_similarity: { type: "number", default: 0.02 },
      },
      required: ["platform", "behavior_signal"],
    },
    handler: async (args: Record<string, unknown>) => {
      const seg = args.segment_id ? store.segments.find(s => s.id === args.segment_id) : null;
      const estimatedSize = seg ? Math.round(seg.customer_count * 0.85) : 500;
      return stub("create_behavioral_audience", args, {
        audience_id: `aud-${args.platform}-${Date.now()}`,
        platform: args.platform,
        estimated_size: estimatedSize,
        lookalike_audience_id: args.create_lookalike ? `aud-lal-${Date.now()}` : null,
      });
    },
  },

  {
    name: "get_paid_metrics",
    description: "Return paid media performance metrics, filterable by campaign or platform.",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        platform: { type: "string", enum: ["google", "meta", "pinterest"] },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      let campaigns = [...store.paidCampaigns];
      if (args.campaign_id) campaigns = campaigns.filter(c => c.campaign_id === args.campaign_id);
      if (args.platform) campaigns = campaigns.filter(c => c.platform === args.platform);

      const agg = campaigns.reduce((acc, c) => ({
        total_spend: acc.total_spend + c.total_spend,
        total_revenue: acc.total_revenue + c.revenue,
        total_conversions: acc.total_conversions + c.conversions,
        total_clicks: acc.total_clicks + c.clicks,
        total_impressions: acc.total_impressions + c.impressions,
      }), { total_spend: 0, total_revenue: 0, total_conversions: 0, total_clicks: 0, total_impressions: 0 });

      return ok({
        campaigns,
        aggregate: {
          ...agg,
          blended_roas: agg.total_spend > 0 ? Math.round((agg.total_revenue / agg.total_spend) * 10) / 10 : 0,
          blended_cpa: agg.total_conversions > 0 ? Math.round(agg.total_spend / agg.total_conversions * 100) / 100 : 0,
        },
      });
    },
  },

  {
    name: "pause_ads_for_sku",
    description: "Pause all active paid ads that feature a specific SKU (typically because it went out of stock). (Stub)",
    inputSchema: {
      type: "object" as const,
      properties: {
        sku_id: { type: "string" },
        reason: { type: "string", default: "out_of_stock" },
      },
      required: ["sku_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const activePaid = store.paidCampaigns.filter(c => c.status === "active" && c.sku_ids.includes(args.sku_id as string));
      return stub("pause_ads_for_sku", args, {
        sku_id: args.sku_id,
        paused_campaigns: activePaid.map(c => ({ paid_campaign_id: c.id, platform: c.platform, campaign_id: c.campaign_id })),
        paused_count: activePaid.length,
      });
    },
  },

  {
    name: "pause_campaign_channel",
    description: "Pause sends/posts/ads for one channel in a campaign. (Stub — does not affect stored records.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        channel: { type: "string", enum: ["email", "paid", "social"] },
        reason: { type: "string" },
      },
      required: ["campaign_id", "channel"],
    },
    handler: async (args: Record<string, unknown>) => {
      return stub("pause_campaign_channel", args, {
        campaign_id: args.campaign_id,
        channel: args.channel,
        cancelled_sends: args.channel === "email" ? 2 : 0,
        unscheduled_posts: args.channel === "social" ? 3 : 0,
        paused_ads: args.channel === "paid" ? 2 : 0,
      });
    },
  },

  {
    name: "cancel_email_send",
    description: "Cancel a scheduled email send before it fires. (Stub)",
    inputSchema: {
      type: "object" as const,
      properties: {
        send_id: { type: "string" },
        reason: { type: "string" },
      },
      required: ["send_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      return stub("cancel_email_send", args, {
        send_id: args.send_id,
        cancelled: true,
        reason: args.reason,
      });
    },
  },
];
