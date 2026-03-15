import * as fs from "fs";
import * as path from "path";
import {
  Product, Customer, Segment, Campaign, ContentAsset, CreativeAsset,
  SEOKeyword, Retrospective, BrandGuidelines, SeasonalEvent,
  CampaignRequest, ApprovalRecord, EmailSend, SocialPost, SocialMetrics, PaidCampaign,
  ConversionFunnel, CohortRetentionRow, ProductPerformance,
  MerchandisingRule, Collection, Session, ABTest, SearchQueryReport,
  CoPurchasePair, PersonaDefinition, CampaignTypeDefault, SuppressionRules
} from "./types.js";

const DATA_DIR = path.join(__dirname, "..", "data");

function loadJson<T>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`[data-store] WARNING: ${filename} not found — returning empty array/object`);
    return (filename.endsWith(".json") && fs.existsSync(filePath)) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : ([] as unknown as T);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// ---------------------------------------------------------------
// In-memory store — mutable so writes within a session are visible
// ---------------------------------------------------------------
export const store = {
  products: [] as Product[],
  customers: [] as Customer[],
  segments: [] as Segment[],
  campaigns: [] as Campaign[],
  contentAssets: [] as ContentAsset[],
  creativeAssets: [] as CreativeAsset[],
  seoKeywords: [] as SEOKeyword[],
  retrospectives: [] as Retrospective[],
  brandGuidelines: {} as BrandGuidelines,
  seasonalCalendar: [] as SeasonalEvent[],
  personas: [] as PersonaDefinition[],
  campaignTypeDefaults: {} as Record<string, CampaignTypeDefault>,
  suppressionRules: {} as SuppressionRules,
  campaignRequests: [] as CampaignRequest[],
  approvalRecords: [] as ApprovalRecord[],
  emailSends: [] as EmailSend[],
  socialPosts: [] as SocialPost[],
  socialMetrics: [] as SocialMetrics[],
  paidCampaigns: [] as PaidCampaign[],
  conversionFunnels: [] as ConversionFunnel[],
  cohortRetention: [] as CohortRetentionRow[],
  productPerformance: [] as ProductPerformance[],
  merchandisingRules: [] as MerchandisingRule[],
  collections: [] as Collection[],
  sessions: [] as Session[],
  abTests: [] as ABTest[],
  searchQueryReport: {} as SearchQueryReport,
  coPurchasePairs: [] as CoPurchasePair[],
  // New session events logged at runtime (not persisted to disk)
  runtimeSessionEvents: [] as Array<{ session_id: string; event: object }>,
};

export function loadStore(): void {
  console.error("[data-store] Loading synthetic data from data/...");

  store.products = loadJson<Product[]>("products.json");
  store.customers = loadJson<Customer[]>("customers.json");
  store.segments = loadJson<Segment[]>("segments.json");
  store.campaigns = loadJson<Campaign[]>("campaigns.json");
  store.contentAssets = loadJson<ContentAsset[]>("content-assets.json");
  store.creativeAssets = loadJson<CreativeAsset[]>("creative-assets.json");
  store.seoKeywords = loadJson<SEOKeyword[]>("seo-keywords.json");
  store.retrospectives = loadJson<Retrospective[]>("retrospectives.json");
  store.brandGuidelines = loadJson<BrandGuidelines>("brand-guidelines.json");
  store.seasonalCalendar = loadJson<SeasonalEvent[]>("seasonal-calendar.json");
  store.personas = loadJson<PersonaDefinition[]>("personas.json");
  store.campaignTypeDefaults = loadJson<Record<string, CampaignTypeDefault>>("campaign-type-defaults.json");
  store.suppressionRules = loadJson<SuppressionRules>("suppression-rules.json");
  store.campaignRequests = loadJson<CampaignRequest[]>("campaign-requests.json");
  store.emailSends = loadJson<EmailSend[]>("email-sends.json");
  store.socialPosts = loadJson<SocialPost[]>("social-posts.json");
  store.socialMetrics = loadJson<SocialMetrics[]>("social-metrics.json");
  store.paidCampaigns = loadJson<PaidCampaign[]>("paid-campaigns.json");
  store.conversionFunnels = loadJson<ConversionFunnel[]>("conversion-funnels.json");
  store.cohortRetention = loadJson<CohortRetentionRow[]>("cohort-retention.json");
  store.productPerformance = loadJson<ProductPerformance[]>("product-performance.json");
  store.merchandisingRules = loadJson<MerchandisingRule[]>("merchandising-rules.json");
  store.collections = loadJson<Collection[]>("collections.json");
  store.sessions = loadJson<Session[]>("sessions.json");
  store.abTests = loadJson<ABTest[]>("ab-tests.json");
  store.searchQueryReport = loadJson<SearchQueryReport>("search-query-report.json");
  store.coPurchasePairs = loadJson<CoPurchasePair[]>("co-purchase-pairs.json");

  console.error(`[data-store] Loaded: ${store.products.length} products, ${store.customers.length} customers, ${store.campaigns.length} campaigns, ${store.segments.length} segments`);
}

// ---------------------------------------------------------------
// ID generators
// ---------------------------------------------------------------
let assetCounter = 10000;
let campaignCounter = 100;
let segmentCounter = 100;
let requestCounter = 10000;
let sendCounter = 10000;
let postCounter = 10000;
let paidCounter = 10000;
let testCounter = 100;
let ruleCounter = 10000;

export function newAssetId(): string { return `asset-${++assetCounter}`; }
export function newCampaignId(): string { return `camp-${String(++campaignCounter).padStart(3, "0")}`; }
export function newSegmentId(): string { return `seg-${String(++segmentCounter).padStart(3, "0")}`; }
export function newRequestId(): string { return `req-${++requestCounter}`; }
export function newSendId(): string { return `send-${++sendCounter}`; }
export function newPostId(): string { return `post-${++postCounter}`; }
export function newPaidId(): string { return `paid-${++paidCounter}`; }
export function newTestId(): string { return `test-${String(++testCounter).padStart(3, "0")}`; }
export function newRuleId(): string { return `rule-${++ruleCounter}`; }
