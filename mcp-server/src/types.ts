// ============================================================
// Shared TypeScript types for Wine Marketing MCP Server
// ============================================================

export type PriceTier = "entry" | "mid" | "premium" | "collector";
export type Persona = "Explorer" | "Gifter" | "Loyalist" | "DealSeeker" | "Collector";
export type LifecycleStage = "active" | "lapsed" | "churned" | "new";
export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type CampaignType =
  | "new_arrival"
  | "promotion"
  | "limited_allocation"
  | "seasonal"
  | "winback"
  | "educational"
  | "bundle"
  | "pre_order";
export type Channel = "email" | "paid" | "social" | "seo";
export type Platform = "instagram" | "facebook" | "pinterest" | "tiktok";
export type AdPlatform = "google" | "meta" | "pinterest";
export type AssetType =
  | "subject_line"
  | "email_body"
  | "ad_headline"
  | "ad_body"
  | "social_caption"
  | "product_description"
  | "blog_post"
  | "preview_text"
  | "cta_text"
  | "meta_title"
  | "meta_description";
export type CreativeAssetType = "product_shot" | "lifestyle" | "banner" | "social_square" | "social_story";
export type AssetStatus = "pending_review" | "approved" | "rejected";
export type ABTestStatus = "running" | "complete" | "inconclusive" | "stopped_early";
export type FunnelStage = "browse" | "consideration" | "cart" | "checkout" | "purchase";
export type DeviceType = "desktop" | "mobile" | "tablet";
export type TrafficSource = "organic_search" | "paid_search" | "email" | "paid_social" | "direct" | "referral";

// ---------------------------------------------------------------
// Domain 1: Catalog & Inventory
// ---------------------------------------------------------------
export interface Product {
  id: string;           // e.g. "SKU-001"
  name: string;
  varietal: string;
  varietal_family: string;
  region: string;
  vintage: number;
  price: number;
  price_tier: PriceTier;
  margin_pct: number;
  stock_units: number;
  days_of_supply: number;
  velocity_units_per_day: number;
  pdp_views_7d: number;
  view_to_cart_rate: number;
  cart_to_purchase_rate: number;
  rating: number;
  rating_count: number;
  image_url: string;
  tasting_notes: string;
  pairing_suggestions: string[];
  short_description: string;
  seo_description: string;
  collection_ids: string[];
  is_active: boolean;
}

// ---------------------------------------------------------------
// Domain 2: Customer Data & Segmentation
// ---------------------------------------------------------------
export interface VarietalAffinity {
  varietal: string;
  score: number;  // 0-1
}

export interface RFMScores {
  r: number;  // 1-5
  f: number;  // 1-5
  m: number;  // 1-5
  rfm_segment: string;
}

export interface Suppression {
  scope: "global" | "campaign";
  campaign_id?: string;
  reason: string;
  added_at: string;
  expires_at?: string;
}

export interface Customer {
  id: string;          // e.g. "cust-0001"
  persona: Persona;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  city: string;
  state: string;
  zip: string;
  acquisition_channel: TrafficSource;
  acquisition_date: string;
  lifecycle_stage: LifecycleStage;
  preferred_varietal: string;
  preferred_region: string;
  secondary_varietal: string;
  price_sensitivity: "low" | "medium" | "high";
  engagement_modifier: number;  // -0.35 to +0.35
  rfm: RFMScores;
  clv_12m: number;
  clv_lifetime: number;
  email_open_rate: number;
  email_click_rate: number;
  churn_risk_score: number;  // 0-1
  segment_ids: string[];
  varietal_affinities: VarietalAffinity[];
  total_orders: number;
  total_spend: number;
  avg_order_value: number;
  last_purchase_date: string | null;
  first_purchase_date: string | null;
  suppression: Suppression[];
  upsell_propensity: number;  // 0-1
  is_outlier: boolean;
}

export interface Segment {
  id: string;           // e.g. "seg-001"
  name: string;
  description: string;
  customer_ids: string[];
  customer_count: number;
  avg_clv: number;
  avg_open_rate: number;
  rules: SegmentRule[];
  created_at: string;
  refreshed_at: string;
}

export interface SegmentRule {
  field: string;
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "contains";
  value: string | number | string[];
  window_days?: number;
}

// ---------------------------------------------------------------
// Domain 3: Campaign & Content Management
// ---------------------------------------------------------------
export interface CampaignBoost {
  sku_ids: string[];
  boost_factor: number;
  contexts: string[];
  expires_at: string;
}

export interface Campaign {
  id: string;           // e.g. "camp-001"
  name: string;
  campaign_type: CampaignType;
  status: CampaignStatus;
  channels: Channel[];
  target_segment_ids: string[];
  featured_sku_ids: string[];
  discount_pct: number;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  boost_config?: CampaignBoost;
  budget_daily?: number;
}

export interface ContentAsset {
  id: string;           // e.g. "asset-001"
  campaign_id: string;
  channel: Channel | "general";
  asset_type: AssetType;
  content: string;
  variant?: "A" | "B";
  status: AssetStatus;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface CreativeAsset {
  id: string;
  campaign_id: string;
  asset_type: CreativeAssetType;
  platform: Platform | AdPlatform;
  url: string;
  alt_text: string;
  status: AssetStatus;
  uploaded_at: string;
  approved_at?: string;
}

export interface SEOKeyword {
  id: string;
  keyword: string;
  intent: "informational" | "commercial" | "transactional" | "navigational";
  monthly_search_volume: number;
  difficulty_score: number;  // 0-100
  current_ranking_position?: number;
  suggested_content_type: string;
  priority: "high" | "medium" | "low";
  target_sku_ids: string[];
  updated_at: string;
}

export interface Retrospective {
  campaign_id: string;
  campaign_name: string;
  campaign_type: CampaignType;
  duration_days: number;
  channels_used: Channel[];
  total_revenue: number;
  total_orders: number;
  overall_roas: number;
  channel_breakdown: Record<string, {
    revenue: number;
    orders?: number;
    roas?: number;
    spend?: number;
    cpa?: number;
    open_rate?: number;
    click_rate?: number;
    reach?: number;
    engagement_rate?: number;
  }>;
  best_performing_element: string;
  worst_performing_element: string;
  ab_test_winner?: string;
  learnings: string[];
  recommendations_for_next_campaign: string[];
  completed_at: string;
}

export interface BrandGuidelines {
  voice: string;
  tone: string[];
  style_rules: string[];
  prohibited: string[];
  cta_examples: string[];
  color_palette: Record<string, string>;
}

export interface PersonaDefinition {
  id: string;
  name: string;
  demographics: string;
  purchase_behavior: string;
  what_they_respond_to: string;
  acquisition_channels: string[];
  campaign_type_fit: CampaignType[];
  segment_signals: string[];
  tone_guidance: string;
}

export interface CampaignTypeDefault {
  default_channels: Channel[];
  budget_range: string;
  primary_kpis: string[];
  send_cadence: string;
  tone_angle: string;
  discount: boolean;
  paid: boolean;
  primary_personas: Persona[];
  suppression_notes: string;
}

export interface SuppressionRules {
  global_unsubscribe: { rule: string; check: string };
  email_fatigue_guard: { cooldown_days: number; rule: string; check: string; applies_to: string[] };
  post_purchase_suppression: { expiry_days: number; rule: string; check: string; applies_to: string[]; exceptions: string[] };
  winback_cooldown: { cooldown_days: number; rule: string; check: string };
  campaign_scoped_suppression: { rule: string; check: string };
  invalid_email_filter: { rule: string; check: string };
  per_type_overrides: Record<string, Record<string, string>>;
  trigger_email_exemptions: Record<string, string>;
}

export interface SeasonalEvent {
  name: string;
  start_date: string;
  end_date: string;
  campaign_type: CampaignType;
  notes: string;
}

export interface CampaignRequest {
  id: string;
  request_type: string;
  alert_type?: string;
  status: "pending" | "accepted" | "rejected" | "processed";
  sku_id?: string;
  product_name?: string;
  suggested_campaign_type?: CampaignType;
  raised_at: string;
  agent: string;
  notes?: string;
  [key: string]: unknown;
}

export interface ApprovalRecord {
  id: string;
  campaign_id: string;
  gate: 1 | 2 | 3 | 4;
  decision: "approved" | "rejected" | "skipped";
  channel?: string;
  asset_ids?: string[];
  test_id?: string;
  approved_by: string;
  approved_at: string;
  notes?: string;
}

// ---------------------------------------------------------------
// Domain 4: Channel Execution
// ---------------------------------------------------------------
export interface EmailSend {
  id: string;
  campaign_id: string;
  sent_at: string;
  send_day: number;  // 1 = initial, 3 = day-3 reminder, 7 = final
  recipient_count: number;
  suppressed_count: number;
  delivered_count: number;
  open_count: number;
  unique_open_rate: number;
  click_count: number;
  ctr: number;
  conversion_count: number;
  conversion_rate: number;
  revenue_attributed: number;
  bounce_count: number;
  bounce_rate: number;
  spam_complaint_rate: number;
  subject_a_open_rate?: number;
  subject_b_open_rate?: number;
}

export interface SocialPost {
  id: string;
  campaign_id: string;
  platform: Platform;
  caption: string;
  image_url?: string;
  hashtags: string[];
  published_at: string;
  scheduled_at?: string;
  status: "scheduled" | "published" | "failed" | "cancelled";
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

export interface SocialMetrics {
  platform: Platform;
  period: string;
  followers: number;
  follower_delta: number;
  impressions: number;
  reach: number;
  engagement_rate: number;
  top_posts: Array<{ post_id: string; engagement_rate: number }>;
}

export interface PaidCampaign {
  id: string;
  campaign_id: string;
  platform: AdPlatform;
  platform_campaign_id: string;
  campaign_type: string;
  status: "active" | "paused" | "ended";
  start_date: string;
  end_date?: string;
  budget_daily: number;
  total_spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number;
  revenue: number;
  roas: number;
  sku_ids: string[];
}

// ---------------------------------------------------------------
// Domain 5: Analytics & Attribution
// ---------------------------------------------------------------
export interface FunnelStep {
  step: string;
  sessions: number;
  completion_rate: number;
  drop_off_rate: number;
  avg_time_seconds: number;
}

export interface ConversionFunnel {
  device_type?: DeviceType;
  traffic_source?: TrafficSource;
  overall_conversion_rate: number;
  steps: FunnelStep[];
}

export interface CohortRetentionRow {
  cohort: string;  // e.g. "2024-01"
  acquisition_channel: TrafficSource;
  cohort_size: number;
  retention_by_month: number[];  // index 0 = month 0 (100%), index 1 = month 1, etc.
}

export interface ProductPerformance {
  sku_id: string;
  product_name: string;
  revenue: number;
  units_sold: number;
  margin: number;
  pdp_views: number;
  view_to_cart_rate: number;
  cart_to_purchase_rate: number;
  avg_order_quantity: number;
  rank_by_revenue: number;
  rank_by_units: number;
}

// ---------------------------------------------------------------
// Domain 6: Personalization & Recommendations
// ---------------------------------------------------------------
export interface Recommendation {
  sku_id: string;
  affinity_score: number;  // 0-1
  signal_sources: string[];
  is_boosted: boolean;
  rank: number;
}

export interface CoPurchasePair {
  sku_id_a: string;
  sku_id_b: string;
  co_purchase_rate: number;  // 0-1
  lift: number;
}

export interface MerchandisingRule {
  id: string;
  collection_id: string;
  rule_type: "pin_to_top" | "boost" | "bury" | "exclude";
  sku_id?: string;
  condition?: string;
  priority: number;
  created_at: string;
  expires_at?: string;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  sku_ids: string[];
  default_sort: string;
  description: string;
}

// ---------------------------------------------------------------
// Domain 7: Behavioral Events
// ---------------------------------------------------------------
export type EventType =
  | "page_view" | "pdp_view" | "scroll_depth" | "video_play"
  | "add_to_cart" | "remove_from_cart" | "wishlist_add" | "wishlist_view"
  | "search_query" | "search_result_click" | "checkout_step" | "purchase"
  | "exit_intent" | "blog_view" | "filter_applied" | "sort_changed" | "hover_dwell";

export interface SessionEvent {
  event_type: EventType;
  timestamp: string;
  sku_id?: string;
  query?: string;
  page_type?: string;
  scroll_pct?: number;
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: string;
  customer_id?: string;
  anonymous_id?: string;
  started_at: string;
  ended_at: string;
  device_type: DeviceType;
  traffic_source: TrafficSource;
  intent_score: number;  // 0-100
  funnel_stage_reached: FunnelStage;
  converted: boolean;
  sku_ids_engaged: string[];
  search_queries_used: string[];
  total_pdp_views: number;
  events: SessionEvent[];
}

export interface ABTest {
  id: string;
  name: string;
  page_type: string;
  element: string;
  campaign_id?: string;
  sku_id?: string;
  status: ABTestStatus;
  primary_metric: string;
  traffic_split: number;
  min_sample_size: number;
  max_duration_days: number;
  started_at: string;
  ended_at?: string;
  winner?: "A" | "B";
  variants: ABVariant[];
}

export interface ABVariant {
  id: "A" | "B";
  description: string;
  sessions: number;
  primary_metric_value: number;
  lift_pct?: number;
  p_value?: number;
  is_significant?: boolean;
  confidence_interval?: [number, number];
}

export interface SearchQueryReport {
  period_days: number;
  total_searches: number;
  search_to_purchase_rate: number;
  top_queries: Array<{
    query: string;
    count: number;
    click_through_rate: number;
    add_to_cart_rate: number;
    purchase_rate: number;
  }>;
  zero_result_queries: Array<{ query: string; count: number }>;
  low_result_queries: Array<{ query: string; count: number; result_count: number }>;
}
