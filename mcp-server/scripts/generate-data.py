#!/usr/bin/env python3
"""
Wine Marketing MCP — Synthetic Data Generator
Seed=42 for reproducibility. Run from mcp-server/ directory:
    pip install faker numpy
    python scripts/generate-data.py
Outputs ~25 JSON files to data/
"""

import json
import math
import os
import random
from datetime import datetime, timedelta, date

import numpy as np
from faker import Faker

# ---------------------------------------------------------------
# Config
# ---------------------------------------------------------------
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
fake = Faker()
fake.seed_instance(SEED)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

TODAY = date(2026, 3, 14)
TODAY_STR = TODAY.isoformat()

def dt(d: date) -> str:
    return d.isoformat()

def rdelta(days: int) -> date:
    return TODAY - timedelta(days=days)

def jitter(val: float, std: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return float(np.clip(val + np.random.normal(0, std), lo, hi))

def save(filename: str, data: object) -> None:
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved {filename} ({len(data) if isinstance(data, list) else 'object'})")

# ---------------------------------------------------------------
# 1. Products (120 SKUs)
# ---------------------------------------------------------------
VARIETAL_FAMILIES = [
    ("Cabernet Sauvignon", "Napa Valley", "premium", 10),
    ("Pinot Noir", "Willamette Valley", "mid", 10),
    ("Chardonnay", "Burgundy", "mid", 8),
    ("Barolo/Nebbiolo", "Piedmont", "premium", 6),
    ("Natural/Biodynamic", "Various", "mid", 10),
    ("Sparkling/Champagne", "Champagne", "premium", 8),
    ("Bordeaux Blend", "Bordeaux", "premium", 8),
    ("Syrah/Rhône", "Rhône Valley", "mid", 8),
    ("Rosé", "Provence", "entry", 8),
    ("Riesling/Alsatian", "Alsace", "entry", 8),
    ("Malbec", "Mendoza", "entry", 8),
    ("Italian Varietals", "Tuscany", "mid", 10),
    ("Spanish Varietals", "Rioja", "mid", 8),
    ("White Burgundy", "Burgundy", "premium", 6),
    ("Dessert/Fortified", "Port", "collector", 4),
]

PRICE_TIERS = {
    "entry":     (18, 35),
    "mid":       (36, 65),
    "premium":   (66, 120),
    "collector": (121, 350),
}

WINERY_PREFIXES = ["Château", "Domaine", "Estate", "Reserve", "Clos", "Vignes", "Tenuta", "Bodega", "Weingut"]
WINE_DESCRIPTORS = ["Grand Cru", "Classico", "Riserva", "Premier Cru", "Old Vine", "Barrel Select", "Single Vineyard"]

products = []
sku_idx = 1

# Named fixtures (must be created first with specific IDs)
FIXTURES = {
    "SKU-042": {"varietal_family": "Bordeaux Blend", "region": "Bordeaux", "price_tier": "premium",
                "stock_units": 480, "days_of_supply": 147, "pdp_views_7d": 120, "view_to_cart_rate": 0.12},
    "SKU-017": {"varietal_family": "Pinot Noir", "region": "Willamette Valley", "price_tier": "mid",
                "stock_units": 310, "days_of_supply": 112, "pdp_views_7d": 85, "view_to_cart_rate": 0.14},
    "SKU-058": {"varietal_family": "Cabernet Sauvignon", "region": "Napa Valley", "price_tier": "premium",
                "stock_units": 250, "days_of_supply": 98, "pdp_views_7d": 95, "view_to_cart_rate": 0.11},
    "SKU-031": {"varietal_family": "Barolo/Nebbiolo", "region": "Piedmont", "price_tier": "premium",
                "stock_units": 27, "days_of_supply": 18, "pdp_views_7d": 847, "view_to_cart_rate": 0.41},
    "SKU-009": {"varietal_family": "Sparkling/Champagne", "region": "Spain", "price_tier": "entry",
                "stock_units": 0, "days_of_supply": 0, "pdp_views_7d": 45, "view_to_cart_rate": 0.0},
}

COLLECTION_MAP = {
    "Cabernet Sauvignon": ["col-001", "col-006"],
    "Pinot Noir": ["col-001"],
    "Chardonnay": ["col-002", "col-006"],
    "Barolo/Nebbiolo": ["col-001", "col-007"],
    "Natural/Biodynamic": ["col-001", "col-005"],
    "Sparkling/Champagne": ["col-003"],
    "Bordeaux Blend": ["col-001", "col-006"],
    "Syrah/Rhône": ["col-001", "col-006"],
    "Rosé": ["col-004"],
    "Riesling/Alsatian": ["col-002"],
    "Malbec": ["col-001"],
    "Italian Varietals": ["col-001", "col-007"],
    "Spanish Varietals": ["col-001"],
    "White Burgundy": ["col-002", "col-006"],
    "Dessert/Fortified": ["col-001"],
}

TASTING_NOTES_BANK = [
    "Rich dark fruit with cedar and tobacco undertones. Firm tannins and a long, complex finish.",
    "Bright cherry and raspberry with earthy undertones. Silky texture and elegant structure.",
    "Crisp apple and citrus with hints of vanilla and toasted oak. Refreshing acidity.",
    "Dried rose petals, tar, and cherry. Full-bodied with grippy tannins and a mineral finish.",
    "Funky, alive — orange peel, wild herbs, and beeswax. Low sulphur, bright acidity.",
    "Fine bubbles, brioche, and green apple. Creamy mouthfeel with a persistent finish.",
    "Cassis and plum with graphite and violet. Structured, age-worthy, and classic.",
    "Blueberry and bacon smoke with peppery spice. Rich and savory with Mediterranean herbs.",
    "Strawberry, peach, and lavender. Bone dry, crisp, and effortlessly refreshing.",
    "Petrol and white flowers with zesty lime. Off-dry, vibrant, and aromatic.",
    "Plum and chocolate with leather and spice. Full-bodied and plush on the palate.",
    "Sour cherry and espresso with a hint of anise. Firm acidity, savory and compelling.",
    "Dried fig, leather, and vanilla. Medium body with integrated tannins and spice.",
    "Hazelnut and honey with mineral salinity. Rich, textured, and endlessly complex.",
    "Raisin, caramel, and walnut. Sweet and luscious with a warming finish.",
]

PAIRINGS_BANK = [
    ["Aged cheddar", "Grilled ribeye", "Lamb chops"],
    ["Duck confit", "Salmon en croûte", "Mushroom risotto"],
    ["Lobster", "Roasted chicken", "Soft cheeses"],
    ["Truffle pasta", "Braised short rib", "Hard aged cheese"],
    ["Charcuterie board", "Natural rind cheese", "Roasted beets"],
    ["Oysters", "Smoked salmon", "Caviar"],
    ["Beef Wellington", "Venison", "Roquefort"],
    ["Lamb merguez", "Grilled tuna", "Provençal vegetables"],
    ["Grilled shrimp", "Goat cheese salad", "Light summer pasta"],
    ["Spicy Thai", "Riesling cake", "Pork belly"],
    ["Empanadas", "Grilled flank steak", "Chimichurri chicken"],
    ["Bistecca", "Pecorino", "Porcini mushrooms"],
    ["Jamón ibérico", "Manchego", "Paella"],
    ["Roasted cod", "Scallops", "Beurre blanc"],
    ["Stilton", "Chocolate cake", "Walnuts"],
]

def make_product(sku_id, varietal_family, region, price_tier, notes_idx, collections):
    lo, hi = PRICE_TIERS[price_tier]
    price = round(random.uniform(lo, hi), 0)
    margin = round(random.uniform(0.35, 0.68), 3)
    vintage = random.randint(2018, 2023)
    winery = f"{random.choice(WINERY_PREFIXES)} {fake.last_name()}"
    descriptor = random.choice(WINE_DESCRIPTORS) if random.random() > 0.5 else ""
    name = f"{winery} {varietal_family.split('/')[0]}{(' ' + descriptor) if descriptor else ''} {vintage}"
    velocity = round(random.uniform(0.3, 5.0), 2)
    stock = max(0, int(random.gauss(velocity * 60, velocity * 15)))
    daysup = round(stock / velocity, 1) if velocity > 0 else 0
    pdp = int(random.gauss(100, 80))
    pdp = max(5, pdp)
    v2c = jitter(0.18, 0.07, 0.03, 0.55)
    c2p = jitter(0.42, 0.10, 0.10, 0.75)
    rating_base = {"entry": 3.85, "mid": 4.20, "premium": 4.55, "collector": 4.72}[price_tier]
    rating = round(jitter(rating_base, 0.2, 3.5, 5.0), 2)
    return {
        "id": sku_id,
        "name": name,
        "varietal": varietal_family.split("/")[0].strip(),
        "varietal_family": varietal_family,
        "region": region,
        "vintage": vintage,
        "price": float(price),
        "price_tier": price_tier,
        "margin_pct": margin,
        "stock_units": stock,
        "days_of_supply": round(daysup, 1),
        "velocity_units_per_day": velocity,
        "pdp_views_7d": pdp,
        "view_to_cart_rate": round(v2c, 3),
        "cart_to_purchase_rate": round(c2p, 3),
        "rating": rating,
        "rating_count": random.randint(12, 480),
        "image_url": f"https://images.wineshop.example/skus/{sku_id.lower()}.jpg",
        "tasting_notes": TASTING_NOTES_BANK[notes_idx % len(TASTING_NOTES_BANK)],
        "pairing_suggestions": PAIRINGS_BANK[notes_idx % len(PAIRINGS_BANK)],
        "short_description": f"A beautiful {varietal_family.split('/')[0]} from {region}.",
        "seo_description": f"Discover {name} — an exceptional {varietal_family.split('/')[0]} from {region}. {TASTING_NOTES_BANK[notes_idx % len(TASTING_NOTES_BANK)][:80]}",
        "collection_ids": collections,
        "is_active": True,
    }

# Create fixtures first
fixture_skus = list(FIXTURES.keys())  # SKU-042, SKU-017, SKU-058, SKU-031, SKU-009
for fix_id, fix_data in FIXTURES.items():
    lo, hi = PRICE_TIERS[fix_data["price_tier"]]
    price = round(random.uniform(lo, hi), 0)
    vintage = random.randint(2018, 2022)
    winery = f"Château {fake.last_name()}"
    vf = fix_data["varietal_family"]
    name = f"{winery} {vf.split('/')[0].strip()} {vintage}"
    collections = COLLECTION_MAP.get(vf, ["col-001"])
    products.append({
        "id": fix_id,
        "name": name,
        "varietal": vf.split("/")[0].strip(),
        "varietal_family": vf,
        "region": fix_data["region"],
        "vintage": vintage,
        "price": float(price),
        "price_tier": fix_data["price_tier"],
        "margin_pct": round(random.uniform(0.38, 0.60), 3),
        "stock_units": fix_data["stock_units"],
        "days_of_supply": fix_data["days_of_supply"],
        "velocity_units_per_day": round(fix_data["stock_units"] / fix_data["days_of_supply"], 2) if fix_data["days_of_supply"] > 0 else 0.0,
        "pdp_views_7d": fix_data["pdp_views_7d"],
        "view_to_cart_rate": fix_data["view_to_cart_rate"],
        "cart_to_purchase_rate": round(jitter(0.38, 0.08, 0.05, 0.70), 3),
        "rating": round(jitter(4.3, 0.15, 3.8, 5.0), 2),
        "rating_count": random.randint(50, 600),
        "image_url": f"https://images.wineshop.example/skus/{fix_id.lower()}.jpg",
        "tasting_notes": TASTING_NOTES_BANK[int(fix_id[-3:]) % len(TASTING_NOTES_BANK)],
        "pairing_suggestions": PAIRINGS_BANK[int(fix_id[-3:]) % len(PAIRINGS_BANK)],
        "short_description": f"A premium {vf.split('/')[0]} from {fix_data['region']}.",
        "seo_description": f"Shop {name} from {fix_data['region']}. {TASTING_NOTES_BANK[0][:80]}",
        "collection_ids": collections,
        "is_active": True,
    })

# Build remaining 115 SKUs
notes_idx = 0
for (varietal_family, region, price_tier_base, count) in VARIETAL_FAMILIES:
    tiers = ["entry", "mid", "premium", "collector"]
    pt_idx = tiers.index(price_tier_base)
    collections = COLLECTION_MAP.get(varietal_family, ["col-001"])
    # Check if the target count for this family already partially filled by fixtures
    fixture_in_family = sum(1 for p in products if p["varietal_family"] == varietal_family)
    remaining = count - fixture_in_family
    for _ in range(remaining):
        sku_id = f"SKU-{sku_idx:03d}"
        while sku_id in fixture_skus:
            sku_idx += 1
            sku_id = f"SKU-{sku_idx:03d}"
        # Vary price tier slightly within family
        chosen_tier = tiers[max(0, min(3, pt_idx + random.choice([-1, 0, 0, 0, 1])))]
        p = make_product(sku_id, varietal_family, region, chosen_tier, notes_idx, collections)
        products.append(p)
        sku_idx += 1
        notes_idx += 1

# Pad if < 120
while len(products) < 120:
    sku_id = f"SKU-{sku_idx:03d}"
    p = make_product(sku_id, "Italian Varietals", "Tuscany", "mid", notes_idx, ["col-001", "col-007"])
    products.append(p)
    sku_idx += 1
    notes_idx += 1

# Truncate to exactly 120
products = products[:120]
save("products.json", products)

# ---------------------------------------------------------------
# 2. Customers (1,000)
# ---------------------------------------------------------------
PERSONAS = [
    ("Explorer", 275),
    ("Gifter", 250),
    ("Loyalist", 200),
    ("DealSeeker", 175),
    ("Collector", 100),
]

PERSONA_CONFIG = {
    "Explorer":   {"clv_median": 420,  "clv_sigma": 0.7, "open_base": 0.28, "orders_mean": 2.5, "price_sens": "medium", "rfm_r_mean": 3, "rfm_f_mean": 2, "rfm_m_mean": 2},
    "Gifter":     {"clv_median": 310,  "clv_sigma": 0.8, "open_base": 0.22, "orders_mean": 1.5, "price_sens": "low",    "rfm_r_mean": 2, "rfm_f_mean": 1, "rfm_m_mean": 2},
    "Loyalist":   {"clv_median": 950,  "clv_sigma": 0.6, "open_base": 0.42, "orders_mean": 5.0, "price_sens": "low",    "rfm_r_mean": 4, "rfm_f_mean": 4, "rfm_m_mean": 4},
    "DealSeeker": {"clv_median": 160,  "clv_sigma": 0.9, "open_base": 0.19, "orders_mean": 3.0, "price_sens": "high",   "rfm_r_mean": 3, "rfm_f_mean": 3, "rfm_m_mean": 1},
    "Collector":  {"clv_median": 1800, "clv_sigma": 0.5, "open_base": 0.47, "orders_mean": 4.0, "price_sens": "low",    "rfm_r_mean": 4, "rfm_f_mean": 3, "rfm_m_mean": 5},
}

PERSONA_VARIATALS = {
    "Explorer":   ["Natural/Biodynamic", "Riesling/Alsatian", "Chardonnay", "Rosé", "White Burgundy"],
    "Gifter":     ["Sparkling/Champagne", "Rosé", "Chardonnay", "Malbec"],
    "Loyalist":   ["Cabernet Sauvignon", "Bordeaux Blend", "Pinot Noir", "Syrah/Rhône"],
    "DealSeeker": ["Malbec", "Spanish Varietals", "Italian Varietals", "Rosé"],
    "Collector":  ["Barolo/Nebbiolo", "Bordeaux Blend", "Cabernet Sauvignon", "White Burgundy", "Dessert/Fortified"],
}

ACQ_CHANNELS = ["organic_search", "paid_search", "email", "paid_social", "direct", "referral"]
LIFECYCLE_STAGES = ["active", "lapsed", "churned", "new"]
LIFECYCLE_WEIGHTS = {
    "Explorer":   [0.55, 0.25, 0.15, 0.05],
    "Gifter":     [0.35, 0.35, 0.20, 0.10],
    "Loyalist":   [0.65, 0.20, 0.10, 0.05],
    "DealSeeker": [0.35, 0.35, 0.20, 0.10],
    "Collector":  [0.75, 0.15, 0.07, 0.03],
}

def rfm_to_segment_label(r, f, m):
    if r >= 4 and f >= 4 and m >= 4: return "Champions"
    if r >= 3 and f >= 3 and m >= 3: return "Loyal Customers"
    if r >= 4 and f == 1: return "New Customers"
    if r == 1 and f >= 3: return "At Risk"
    if r == 1 and f == 1: return "Lost"
    if r >= 4 and m >= 4 and f <= 2: return "High Value Irregulars"
    return "Promising"

def make_customer(cust_id, persona_name, cfg, outlier=False):
    engagement_modifier = float(np.clip(np.random.normal(0, 0.15), -0.35, 0.35))

    # Lifecycle
    lifecycle_weights = LIFECYCLE_WEIGHTS[persona_name]
    lifecycle_stage = np.random.choice(LIFECYCLE_STAGES, p=lifecycle_weights)

    # CLV (lognormal)
    log_clv = np.random.normal(math.log(cfg["clv_median"]), cfg["clv_sigma"])
    clv_12m = float(np.clip(math.exp(log_clv), 40, 8000))
    if outlier: clv_12m = float(np.clip(clv_12m * random.uniform(3, 5), 40, 8000))
    lifecycle_mult = {"active": 1.0, "new": 0.8, "lapsed": 0.4, "churned": 0.15}[lifecycle_stage]
    clv_12m *= lifecycle_mult
    clv_12m = round(clv_12m, 2)
    clv_lifetime = round(clv_12m * random.uniform(2.5, 4.5), 2)

    # Orders / spend
    total_orders = max(0, int(np.random.poisson(cfg["orders_mean"] * lifecycle_mult)))
    avg_order = round(clv_12m / max(total_orders, 1), 2)
    total_spend = round(total_orders * avg_order, 2)

    # Dates
    acq_days_ago = random.randint(30, 1000)
    acq_date = rdelta(acq_days_ago)
    if total_orders > 0:
        last_purchase_days = {"active": random.randint(1, 60), "lapsed": random.randint(61, 180), "churned": random.randint(181, 365), "new": random.randint(1, 30)}[lifecycle_stage]
        last_purchase = rdelta(last_purchase_days)
        first_purchase = rdelta(min(acq_days_ago, last_purchase_days + random.randint(0, 90)))
    else:
        last_purchase = None
        first_purchase = None

    # RFM
    if last_purchase:
        days_since = (TODAY - last_purchase).days
        rfm_r = 5 if days_since <= 30 else 4 if days_since <= 60 else 3 if days_since <= 90 else 2 if days_since <= 180 else 1
    else:
        rfm_r = 1
    rfm_f = min(5, max(1, int(np.clip(np.random.poisson(cfg["rfm_f_mean"]), 1, 5))))
    rfm_m = min(5, max(1, int(np.clip(np.random.poisson(cfg["rfm_m_mean"]), 1, 5))))
    rfm_label = rfm_to_segment_label(rfm_r, rfm_f, rfm_m)

    # Email engagement
    open_base = cfg["open_base"] + engagement_modifier * 0.3
    lifecycle_damp = {"active": 1.0, "new": 0.9, "lapsed": 0.45, "churned": 0.20}[lifecycle_stage]
    open_rate = round(float(np.clip(np.random.normal(open_base, 0.08), 0.04, 0.82)) * lifecycle_damp, 3)
    click_rate = round(open_rate * jitter(0.12, 0.04, 0.02, 0.30), 4)

    # Churn risk
    recency_decay = min(1.0, (TODAY - last_purchase).days / 365) if last_purchase else 1.0
    email_engagement = open_rate
    orders_last_90d = 0 if lifecycle_stage in ("churned", "lapsed") else random.randint(0, 3)
    avg_orders_per_90 = cfg["orders_mean"] / 4
    frequency_drop = max(0.0, 1.0 - (orders_last_90d / avg_orders_per_90)) if avg_orders_per_90 > 0 else 1.0
    churn_risk = round(0.5 * recency_decay + 0.3 * (1 - email_engagement) + 0.2 * frequency_drop, 3)
    churn_risk = float(np.clip(churn_risk, 0.0, 1.0))

    # Varietal affinities
    top_varietals = PERSONA_VARIATALS[persona_name]
    affinities = []
    for i, var in enumerate(top_varietals):
        score = jitter(0.85 - i * 0.15, 0.08, 0.05, 0.99)
        affinities.append({"varietal": var, "score": round(score, 3)})

    preferred_varietal = affinities[0]["varietal"] if affinities else "Cabernet Sauvignon"
    secondary_varietal = affinities[1]["varietal"] if len(affinities) > 1 else preferred_varietal

    # Upsell propensity
    upsell_propensity = round(jitter(0.5 + engagement_modifier, 0.15, 0.01, 0.99), 3)

    return {
        "id": cust_id,
        "persona": persona_name,
        "first_name": fake.first_name(),
        "last_name": fake.last_name(),
        "email": fake.email(),
        "phone": fake.phone_number(),
        "city": fake.city(),
        "state": fake.state_abbr(),
        "zip": fake.zipcode(),
        "acquisition_channel": random.choice(ACQ_CHANNELS),
        "acquisition_date": dt(acq_date),
        "lifecycle_stage": lifecycle_stage,
        "preferred_varietal": preferred_varietal,
        "preferred_region": random.choice(["France", "Italy", "USA", "Spain", "Argentina"]),
        "secondary_varietal": secondary_varietal,
        "price_sensitivity": cfg["price_sens"],
        "engagement_modifier": round(engagement_modifier, 4),
        "rfm": {"r": rfm_r, "f": rfm_f, "m": rfm_m, "rfm_segment": rfm_label},
        "clv_12m": clv_12m,
        "clv_lifetime": clv_lifetime,
        "email_open_rate": open_rate,
        "email_click_rate": click_rate,
        "churn_risk_score": churn_risk,
        "segment_ids": [],  # filled in after segment generation
        "varietal_affinities": affinities,
        "total_orders": total_orders,
        "total_spend": total_spend,
        "avg_order_value": avg_order,
        "last_purchase_date": dt(last_purchase) if last_purchase else None,
        "first_purchase_date": dt(first_purchase) if first_purchase else None,
        "suppression": [],
        "upsell_propensity": upsell_propensity,
        "is_outlier": outlier,
    }

customers = []
cust_idx = 1
for (persona_name, count) in PERSONAS:
    cfg = PERSONA_CONFIG[persona_name]
    outlier_count = max(1, int(count * 0.03))
    for i in range(count):
        cust_id = f"cust-{cust_idx:04d}"
        outlier = (i < outlier_count)
        customers.append(make_customer(cust_id, persona_name, cfg, outlier=outlier))
        cust_idx += 1

# ---------------------------------------------------------------
# 3. Segments (12 pre-built)
# ---------------------------------------------------------------
def seg_filter(fn):
    return [c["id"] for c in customers if fn(c)]

def has_varietal_affinity(c, varietal, min_score=0.5):
    return any(a["varietal"] == varietal and a["score"] >= min_score for a in c["varietal_affinities"])

segments_raw = [
    {"id": "seg-001", "name": "Bordeaux Loyalists",
     "description": "Customers with high Bordeaux affinity and 3+ orders",
     "filter": lambda c: has_varietal_affinity(c, "Bordeaux Blend", 0.6) and c["total_orders"] >= 3,
     "rules": [{"field": "varietal_affinity.Bordeaux Blend", "operator": "gte", "value": 0.6}, {"field": "total_orders", "operator": "gte", "value": 3}]},
    {"id": "seg-002", "name": "Natural Wine Explorers",
     "description": "Customers with Natural/Biodynamic affinity and recent activity",
     "filter": lambda c: has_varietal_affinity(c, "Natural/Biodynamic", 0.5) and c["lifecycle_stage"] in ("active", "new"),
     "rules": [{"field": "varietal_affinity.Natural/Biodynamic", "operator": "gte", "value": 0.5}, {"field": "lifecycle_stage", "operator": "in", "value": ["active", "new"]}]},
    {"id": "seg-003", "name": "Holiday Gifters",
     "description": "Customers with Gifter persona and avg order > $60",
     "filter": lambda c: c["persona"] == "Gifter" and c["avg_order_value"] > 60,
     "rules": [{"field": "persona", "operator": "eq", "value": "Gifter"}, {"field": "avg_order_value", "operator": "gt", "value": 60}]},
    {"id": "seg-004", "name": "Cart Abandoners",
     "description": "Customers with high churn risk and no recent purchase",
     "filter": lambda c: c["churn_risk_score"] > 0.55 and c["lifecycle_stage"] == "lapsed",
     "rules": [{"field": "churn_risk_score", "operator": "gt", "value": 0.55}, {"field": "lifecycle_stage", "operator": "eq", "value": "lapsed"}]},
    {"id": "seg-005", "name": "Champions",
     "description": "RFM Champions — high recency, frequency, and monetary",
     "filter": lambda c: c["rfm"]["rfm_segment"] == "Champions",
     "rules": [{"field": "rfm.rfm_segment", "operator": "eq", "value": "Champions"}]},
    {"id": "seg-006", "name": "Lapsed Loyalists",
     "description": "Previously highly engaged customers now lapsed",
     "filter": lambda c: c["rfm"]["rfm_segment"] == "At Risk" and c["total_orders"] >= 4,
     "rules": [{"field": "rfm.rfm_segment", "operator": "eq", "value": "At Risk"}, {"field": "total_orders", "operator": "gte", "value": 4}]},
    {"id": "seg-007", "name": "High-Intent Browsers",
     "description": "High upsell propensity customers who haven't converted recently",
     "filter": lambda c: c["upsell_propensity"] > 0.65 and c["lifecycle_stage"] in ("active", "new"),
     "rules": [{"field": "upsell_propensity", "operator": "gt", "value": 0.65}, {"field": "lifecycle_stage", "operator": "in", "value": ["active", "new"]}]},
    {"id": "seg-008", "name": "Price-Sensitive Buyers",
     "description": "DealSeeker persona with high purchase frequency",
     "filter": lambda c: c["persona"] == "DealSeeker" and c["total_orders"] >= 3,
     "rules": [{"field": "persona", "operator": "eq", "value": "DealSeeker"}, {"field": "total_orders", "operator": "gte", "value": 3}]},
    {"id": "seg-009", "name": "New Customers",
     "description": "Customers acquired in the last 90 days",
     "filter": lambda c: c["lifecycle_stage"] == "new",
     "rules": [{"field": "lifecycle_stage", "operator": "eq", "value": "new"}]},
    {"id": "seg-010", "name": "High CLV Potential",
     "description": "Customers with high upsell propensity and CLV > $300",
     "filter": lambda c: c["upsell_propensity"] > 0.6 and c["clv_12m"] > 300,
     "rules": [{"field": "upsell_propensity", "operator": "gt", "value": 0.6}, {"field": "clv_12m", "operator": "gt", "value": 300}]},
    {"id": "seg-011", "name": "Pre-Order Eligible",
     "description": "Loyalist and Collector personas with Barolo affinity",
     "filter": lambda c: c["persona"] in ("Loyalist", "Collector") and has_varietal_affinity(c, "Barolo/Nebbiolo", 0.4),
     "rules": [{"field": "persona", "operator": "in", "value": ["Loyalist", "Collector"]}, {"field": "varietal_affinity.Barolo/Nebbiolo", "operator": "gte", "value": 0.4}]},
    {"id": "seg-012", "name": "Churn Risk",
     "description": "Customers with high churn risk score",
     "filter": lambda c: c["churn_risk_score"] > 0.70,
     "rules": [{"field": "churn_risk_score", "operator": "gt", "value": 0.70}]},
]

segments = []
for s in segments_raw:
    ids = seg_filter(s["filter"])
    clv_vals = [c["clv_12m"] for c in customers if c["id"] in ids]
    open_vals = [c["email_open_rate"] for c in customers if c["id"] in ids]
    segments.append({
        "id": s["id"],
        "name": s["name"],
        "description": s["description"],
        "customer_ids": ids,
        "customer_count": len(ids),
        "avg_clv": round(sum(clv_vals) / len(clv_vals), 2) if clv_vals else 0,
        "avg_open_rate": round(sum(open_vals) / len(open_vals), 3) if open_vals else 0,
        "rules": s["rules"],
        "created_at": dt(rdelta(random.randint(30, 180))),
        "refreshed_at": TODAY_STR,
    })

# Back-fill segment_ids onto customers
for seg in segments:
    for cid in seg["customer_ids"]:
        for c in customers:
            if c["id"] == cid:
                c["segment_ids"].append(seg["id"])
                break

save("customers.json", customers)
save("segments.json", segments)

# ---------------------------------------------------------------
# 4. Campaigns (6)
# ---------------------------------------------------------------
campaigns = [
    {
        "id": "camp-001",
        "name": "Bordeaux Spring Clearance",
        "campaign_type": "promotion",
        "status": "COMPLETED",
        "channels": ["email", "paid", "social"],
        "target_segment_ids": ["seg-008", "seg-001"],
        "featured_sku_ids": ["SKU-042"],
        "discount_pct": 15,
        "start_date": dt(rdelta(45)),
        "end_date": dt(rdelta(31)),
        "created_at": dt(rdelta(50)),
        "updated_at": dt(rdelta(31)),
        "approved_by": "human",
        "approved_at": dt(rdelta(49)),
    },
    {
        "id": "camp-002",
        "name": "2024 Barolo Pre-Order",
        "campaign_type": "pre_order",
        "status": "COMPLETED",
        "channels": ["email", "social"],
        "target_segment_ids": ["seg-011", "seg-005"],
        "featured_sku_ids": ["SKU-031"],
        "discount_pct": 0,
        "start_date": dt(rdelta(90)),
        "end_date": dt(rdelta(76)),
        "created_at": dt(rdelta(95)),
        "updated_at": dt(rdelta(76)),
        "approved_by": "human",
        "approved_at": dt(rdelta(94)),
    },
    {
        "id": "camp-003",
        "name": "Holiday Gifting 2024",
        "campaign_type": "seasonal",
        "status": "COMPLETED",
        "channels": ["email", "paid", "social"],
        "target_segment_ids": ["seg-003", "seg-010"],
        "featured_sku_ids": ["SKU-009", "SKU-058"],
        "discount_pct": 10,
        "start_date": dt(rdelta(120)),
        "end_date": dt(rdelta(100)),
        "created_at": dt(rdelta(125)),
        "updated_at": dt(rdelta(100)),
        "approved_by": "human",
        "approved_at": dt(rdelta(124)),
    },
    {
        "id": "camp-004",
        "name": "Natural Wine Discovery",
        "campaign_type": "educational",
        "status": "COMPLETED",
        "channels": ["email", "social", "seo"],
        "target_segment_ids": ["seg-002", "seg-009"],
        "featured_sku_ids": [],
        "discount_pct": 0,
        "start_date": dt(rdelta(75)),
        "end_date": dt(rdelta(61)),
        "created_at": dt(rdelta(80)),
        "updated_at": dt(rdelta(61)),
        "approved_by": "human",
        "approved_at": dt(rdelta(79)),
    },
    {
        "id": "camp-005",
        "name": "Spring Natural Wine Content",
        "campaign_type": "educational",
        "status": "ACTIVE",
        "channels": ["email", "social", "seo"],
        "target_segment_ids": ["seg-002", "seg-007"],
        "featured_sku_ids": [],
        "discount_pct": 0,
        "start_date": dt(rdelta(14)),
        "end_date": dt(rdelta(-14)),
        "created_at": dt(rdelta(18)),
        "updated_at": dt(rdelta(14)),
        "approved_by": "human",
        "approved_at": dt(rdelta(17)),
    },
    {
        "id": "camp-006",
        "name": "Barolo Reserve Campaign",
        "campaign_type": "limited_allocation",
        "status": "ACTIVE",
        "channels": ["email", "paid", "social"],
        "target_segment_ids": ["seg-011", "seg-005", "seg-010"],
        "featured_sku_ids": ["SKU-031"],
        "discount_pct": 0,
        "start_date": dt(rdelta(7)),
        "end_date": dt(rdelta(-7)),
        "created_at": dt(rdelta(10)),
        "updated_at": dt(rdelta(7)),
        "approved_by": "human",
        "approved_at": dt(rdelta(9)),
        "boost_config": {
            "sku_ids": ["SKU-031"],
            "boost_factor": 1.5,
            "contexts": ["homepage", "collection", "email", "pdp"],
            "expires_at": dt(rdelta(-7)),
        },
    },
]
save("campaigns.json", campaigns)

# ---------------------------------------------------------------
# 5. Content Assets
# ---------------------------------------------------------------
content_assets = [
    # camp-001 email
    {"id": "asset-001", "campaign_id": "camp-001", "channel": "email", "asset_type": "subject_line", "content": "Save 15% on our best Bordeaux — clearance pricing starts now", "variant": "A", "status": "approved", "created_at": dt(rdelta(48)), "approved_at": dt(rdelta(47))},
    {"id": "asset-002", "campaign_id": "camp-001", "channel": "email", "asset_type": "subject_line", "content": "We have too much Bordeaux. That's your gain.", "variant": "B", "status": "approved", "created_at": dt(rdelta(48)), "approved_at": dt(rdelta(47))},
    {"id": "asset-003", "campaign_id": "camp-001", "channel": "email", "asset_type": "email_body", "content": "Spring is here, and our Bordeaux cellar is overflowing. We're offering 15% off our finest Bordeaux blends — rich, complex, and ready to drink now or cellar for years. These won't last long at this price.", "status": "approved", "created_at": dt(rdelta(48)), "approved_at": dt(rdelta(47))},
    {"id": "asset-004", "campaign_id": "camp-001", "channel": "email", "asset_type": "cta_text", "content": "Shop the Bordeaux Clearance", "status": "approved", "created_at": dt(rdelta(48)), "approved_at": dt(rdelta(47))},
    {"id": "asset-005", "campaign_id": "camp-001", "channel": "paid", "asset_type": "ad_headline", "content": "Bordeaux Clearance — 15% Off", "status": "approved", "created_at": dt(rdelta(48)), "approved_at": dt(rdelta(47))},
    {"id": "asset-006", "campaign_id": "camp-001", "channel": "social", "asset_type": "social_caption", "content": "Spring clearance has arrived. Our finest Bordeaux blends, now 15% off. Cassis, cedar, and complexity at a price that shouldn't exist. Link in bio. #BordeauxLovers #WineSale #SpringWine", "status": "approved", "created_at": dt(rdelta(48)), "approved_at": dt(rdelta(47))},
    # camp-006 email (active)
    {"id": "asset-020", "campaign_id": "camp-006", "channel": "email", "asset_type": "subject_line", "content": "Only 27 bottles remain — Barolo Reserve", "variant": "A", "status": "approved", "created_at": dt(rdelta(9)), "approved_at": dt(rdelta(8))},
    {"id": "asset-021", "campaign_id": "camp-006", "channel": "email", "asset_type": "subject_line", "content": "This Barolo is almost gone. Here's why that matters.", "variant": "B", "status": "approved", "created_at": dt(rdelta(9)), "approved_at": dt(rdelta(8))},
    {"id": "asset-022", "campaign_id": "camp-006", "channel": "email", "asset_type": "email_body", "content": "We received one final allocation of our 2021 Barolo Reserve — just 27 bottles. This is a wine of extraordinary depth: dried rose petals, tar, and mountain cherry. It's ready now with a good decant, and will age magnificently for 15+ years.", "status": "approved", "created_at": dt(rdelta(9)), "approved_at": dt(rdelta(8))},
    {"id": "asset-023", "campaign_id": "camp-006", "channel": "email", "asset_type": "cta_text", "content": "Reserve Your Bottles Now", "status": "approved", "created_at": dt(rdelta(9)), "approved_at": dt(rdelta(8))},
    {"id": "asset-024", "campaign_id": "camp-006", "channel": "paid", "asset_type": "ad_headline", "content": "Final Allocation: 2021 Barolo Reserve", "status": "approved", "created_at": dt(rdelta(9)), "approved_at": dt(rdelta(8))},
    {"id": "asset-025", "campaign_id": "camp-006", "channel": "social", "asset_type": "social_caption", "content": "27 bottles. That's all we have left of our 2021 Barolo Reserve. Tar, dried roses, and a finish that goes on forever. If Barolo is your thing — this is the one. Link in bio. #Barolo #Nebbiolo #FineWine #LimitedAllocation", "status": "approved", "created_at": dt(rdelta(9)), "approved_at": dt(rdelta(8))},
]
save("content-assets.json", content_assets)

# ---------------------------------------------------------------
# 6. Creative Assets
# ---------------------------------------------------------------
creative_assets = [
    {"id": "creative-001", "campaign_id": "camp-001", "asset_type": "social_square", "platform": "instagram", "url": "https://assets.wineshop.example/camp-001-instagram.jpg", "alt_text": "Bottles of Bordeaux on a rustic wooden table", "status": "approved", "uploaded_at": dt(rdelta(47)), "approved_at": dt(rdelta(47))},
    {"id": "creative-002", "campaign_id": "camp-006", "asset_type": "social_square", "platform": "instagram", "url": "https://assets.wineshop.example/camp-006-instagram.jpg", "alt_text": "Single bottle of Barolo against dark background", "status": "approved", "uploaded_at": dt(rdelta(8)), "approved_at": dt(rdelta(8))},
]
save("creative-assets.json", creative_assets)

# ---------------------------------------------------------------
# 7. Retrospectives
# ---------------------------------------------------------------
retrospectives = [
    {
        "campaign_id": "camp-001",
        "campaign_name": "Bordeaux Spring Clearance",
        "campaign_type": "promotion",
        "duration_days": 14,
        "channels_used": ["email", "paid", "social"],
        "total_revenue": 18420.0,
        "total_orders": 142,
        "overall_roas": 3.2,
        "channel_breakdown": {
            "email": {"revenue": 11600, "orders": 89, "roas": 4.2, "open_rate": 0.26, "click_rate": 0.038},
            "paid": {"revenue": 4800, "spend": 2666, "roas": 1.8, "cpa": 29.8},
            "social": {"revenue": 2020, "reach": 12400, "engagement_rate": 0.042, "attributed_revenue": 2020},
        },
        "best_performing_element": "Email Subject B (curiosity-led) drove 2.1× higher open rate vs Subject A",
        "worst_performing_element": "Paid media underperformed (1.8× ROAS vs email 4.2×) — consider email-first for promotions",
        "ab_test_winner": "Subject B: 'We have too much Bordeaux. That's your gain.'",
        "learnings": [
            "Email Subject B (curiosity-led) drove 2.1× higher open rate than Subject A for Deal Seeker segment",
            "Day-3 follow-up email drove 34% of total email revenue",
            "Paid ROAS (1.8×) significantly underperformed email (4.2×) for this campaign type",
            "Social drove 11% of total revenue with minimal spend — high efficiency channel for clearance",
        ],
        "recommendations_for_next_campaign": [
            "For Bordeaux promotions, lead with email-only in first 5 days before launching paid",
            "Deal Seeker segment responds to curiosity and value framing — avoid generic 'sale' language",
            "Day-3 follow-up is essential — do not skip it for promotion campaigns",
        ],
        "completed_at": dt(rdelta(31)),
    },
    {
        "campaign_id": "camp-002",
        "campaign_name": "2024 Barolo Pre-Order",
        "campaign_type": "pre_order",
        "duration_days": 14,
        "channels_used": ["email", "social"],
        "total_revenue": 24680.0,
        "total_orders": 68,
        "overall_roas": 8.1,
        "channel_breakdown": {
            "email": {"revenue": 20200, "orders": 55, "roas": 9.2, "open_rate": 0.41, "click_rate": 0.082},
            "social": {"revenue": 4480, "reach": 8200, "engagement_rate": 0.068, "attributed_revenue": 4480},
        },
        "best_performing_element": "Scarcity framing in email drove 41% open rate — highest in last 12 months",
        "worst_performing_element": "No paid channel — missed opportunity to reach lookalike audiences",
        "ab_test_winner": "Subject B: 'This Barolo is almost gone. Here's why that matters.'",
        "learnings": [
            "Limited allocation campaigns achieve 3× higher open rates than promotions for Collector and Loyalist segments",
            "Scarcity framing ('27 bottles remain') outperforms quality framing in subject lines",
            "No paid channel needed for high-affinity segments — ROAS naturally high from email alone",
            "Social organically drove 18% of revenue with high engagement — Barolo content resonates",
        ],
        "recommendations_for_next_campaign": [
            "Always lead limited allocation campaigns with email 48 hours before any social or paid",
            "Include exact bottle count in subject line for maximum urgency",
            "Test adding Google Shopping for Barolo searches — high-intent audience not yet captured",
        ],
        "completed_at": dt(rdelta(76)),
    },
    {
        "campaign_id": "camp-003",
        "campaign_name": "Holiday Gifting 2024",
        "campaign_type": "seasonal",
        "duration_days": 20,
        "channels_used": ["email", "paid", "social"],
        "total_revenue": 31200.0,
        "total_orders": 218,
        "overall_roas": 2.8,
        "channel_breakdown": {
            "email": {"revenue": 14400, "orders": 101, "roas": 3.6, "open_rate": 0.22, "click_rate": 0.031},
            "paid": {"revenue": 11200, "spend": 5600, "roas": 2.0, "cpa": 25.5},
            "social": {"revenue": 5600, "reach": 28000, "engagement_rate": 0.031, "attributed_revenue": 5600},
        },
        "best_performing_element": "Pinterest drove 2× higher attributed revenue per post vs Instagram for gifting content",
        "worst_performing_element": "Email open rate low (22%) — Gifter segment less email-engaged than other personas",
        "learnings": [
            "Pinterest is the highest-ROI social channel for seasonal gifting campaigns",
            "Gifter segment has lower email engagement — supplement with paid social earlier in campaign",
            "Bundle offer ('buy 2 get gift bag') drove 28% of orders — include in all seasonal campaigns",
        ],
        "recommendations_for_next_campaign": [
            "Increase Pinterest budget allocation for holiday seasonal campaigns",
            "Lead with social and paid for Gifter segment — email as supporting channel only",
            "Always include a gift bundle option for seasonal/gifting campaigns",
        ],
        "completed_at": dt(rdelta(100)),
    },
    {
        "campaign_id": "camp-004",
        "campaign_name": "Natural Wine Discovery",
        "campaign_type": "educational",
        "duration_days": 14,
        "channels_used": ["email", "social", "seo"],
        "total_revenue": 8640.0,
        "total_orders": 72,
        "overall_roas": 5.4,
        "channel_breakdown": {
            "email": {"revenue": 5200, "orders": 43, "roas": 6.8, "open_rate": 0.31, "click_rate": 0.055},
            "social": {"revenue": 2400, "reach": 9200, "engagement_rate": 0.052, "attributed_revenue": 2400},
        },
        "best_performing_element": "Long-form Instagram carousel (10 slides explaining natural wine) drove highest engagement of any campaign",
        "worst_performing_element": "SEO content took 3+ weeks to rank — not attributable within campaign window",
        "learnings": [
            "Educational campaigns have high organic efficiency but long attribution windows",
            "Explorer segment responds strongly to story and education — long-form content works",
            "Natural wine content has 5× higher share rate than product promotion content",
            "SEO content from this campaign continued driving organic traffic for 3+ months post-campaign",
        ],
        "recommendations_for_next_campaign": [
            "Plan educational/SEO campaigns 6-8 weeks before peak season for organic benefit",
            "Invest in high-production Instagram carousels for Explorer segment campaigns",
            "Track 90-day attribution window for educational campaigns, not just 14-day",
        ],
        "completed_at": dt(rdelta(61)),
    },
]
save("retrospectives.json", retrospectives)

# ---------------------------------------------------------------
# 8. Brand Guidelines
# ---------------------------------------------------------------
brand_guidelines = {
    "voice": "Knowledgeable but approachable. Expert without being snobbish. We speak like a trusted friend who happens to know a lot about wine.",
    "tone": ["conversational", "second-person ('you', 'your cellar')", "sensory", "specific (name the grape, vintage, region)"],
    "style_rules": [
        "Lead with occasion or story, not product specs",
        "Use sensory language (taste, smell, texture) before technical terms",
        "CTAs are direct and specific: 'Shop the Clearance', 'Reserve Your Case', never 'Click here'",
        "Scarcity is honest, not manufactured — only use if genuinely limited stock",
        "Pair suggestions should be specific: 'grilled lamb chops' not 'meat'",
    ],
    "prohibited": [
        "Wine jargon without explanation (terroir, typicity, etc.)",
        "Superlatives without substance: 'world's best', 'greatest ever'",
        "Urgency clichés: 'act now!', 'limited time!', 'don't miss out!'",
        "Generic CTAs: 'click here', 'learn more', 'buy now'",
    ],
    "cta_examples": [
        "Shop the Bordeaux Clearance",
        "Reserve Your Case",
        "Explore Natural Wines",
        "Discover This Vintage",
        "Claim Your Allocation",
        "Gift a Great Bottle",
    ],
    "color_palette": {
        "primary": "#2D1B3D",
        "accent": "#C4853A",
        "neutral": "#F5F0EA",
        "text": "#1A1A1A",
    },
}
save("brand-guidelines.json", brand_guidelines)

# ---------------------------------------------------------------
# 9. Seasonal Calendar
# ---------------------------------------------------------------
seasonal_calendar = [
    {"name": "Valentine's Day", "start_date": "2026-02-07", "end_date": "2026-02-14", "campaign_type": "seasonal", "notes": "Gifting, Rosé, Sparkling focus. 2 weeks lead time."},
    {"name": "Spring Clearance", "start_date": "2026-03-15", "end_date": "2026-04-15", "campaign_type": "promotion", "notes": "Clear winter inventory. Bordeaux, Rhône, and heavy reds."},
    {"name": "Summer Rosé Season", "start_date": "2026-05-01", "end_date": "2026-07-31", "campaign_type": "seasonal", "notes": "Rosé, Sparkling, and light whites. Extended campaign window."},
    {"name": "Harvest Season", "start_date": "2026-09-01", "end_date": "2026-10-31", "campaign_type": "educational", "notes": "Vineyard story content. New vintage pre-orders."},
    {"name": "Pre-Holiday Gifting", "start_date": "2026-11-01", "end_date": "2026-11-25", "campaign_type": "seasonal", "notes": "Gift sets, bundles, corporate gifting. Sparkling and premium tiers."},
    {"name": "Holiday Peak", "start_date": "2026-11-26", "end_date": "2026-12-24", "campaign_type": "seasonal", "notes": "Maximum email cadence. All channels active. Gift focus."},
    {"name": "New Year Sparkling", "start_date": "2026-12-26", "end_date": "2026-12-31", "campaign_type": "seasonal", "notes": "Champagne and quality sparkling. Urgency window."},
]
save("seasonal-calendar.json", seasonal_calendar)

# ---------------------------------------------------------------
# 10. SEO Keywords
# ---------------------------------------------------------------
seo_keywords = [
    {"id": "kw-001", "keyword": "natural wine online", "intent": "commercial", "monthly_search_volume": 4400, "difficulty_score": 42, "current_ranking_position": 8, "suggested_content_type": "collection_page", "priority": "high", "target_sku_ids": [], "updated_at": TODAY_STR},
    {"id": "kw-002", "keyword": "barolo wine buy", "intent": "transactional", "monthly_search_volume": 1900, "difficulty_score": 51, "current_ranking_position": 12, "suggested_content_type": "collection_page", "priority": "high", "target_sku_ids": ["SKU-031"], "updated_at": TODAY_STR},
    {"id": "kw-003", "keyword": "best bordeaux under 50", "intent": "commercial", "monthly_search_volume": 2400, "difficulty_score": 38, "current_ranking_position": 6, "suggested_content_type": "editorial", "priority": "high", "target_sku_ids": ["SKU-042"], "updated_at": TODAY_STR},
    {"id": "kw-004", "keyword": "biodynamic wine", "intent": "informational", "monthly_search_volume": 8100, "difficulty_score": 45, "current_ranking_position": 15, "suggested_content_type": "blog_post", "priority": "medium", "target_sku_ids": [], "updated_at": TODAY_STR},
    {"id": "kw-005", "keyword": "wine gift set", "intent": "transactional", "monthly_search_volume": 12000, "difficulty_score": 58, "current_ranking_position": None, "suggested_content_type": "collection_page", "priority": "high", "target_sku_ids": [], "updated_at": TODAY_STR},
    {"id": "kw-006", "keyword": "pinot noir under 40", "intent": "commercial", "monthly_search_volume": 1600, "difficulty_score": 32, "current_ranking_position": 9, "suggested_content_type": "collection_page", "priority": "medium", "target_sku_ids": ["SKU-017"], "updated_at": TODAY_STR},
    {"id": "kw-007", "keyword": "orange wine where to buy", "intent": "transactional", "monthly_search_volume": 880, "difficulty_score": 28, "current_ranking_position": None, "suggested_content_type": "collection_page", "priority": "medium", "target_sku_ids": [], "updated_at": TODAY_STR},
]
save("seo-keywords.json", seo_keywords)

# ---------------------------------------------------------------
# 11. Campaign Requests (queue)
# ---------------------------------------------------------------
campaign_requests = [
    {"id": "req-001", "request_type": "inventory_alert", "alert_type": "overstock", "severity": "critical", "sku_id": "SKU-017", "product_name": products[1]["name"], "days_of_supply": 112, "suggested_campaign_type": "promotion", "suggested_discount_pct": 20, "status": "pending", "raised_at": dt(rdelta(2)), "agent": "inventory-sync"},
    {"id": "req-002", "request_type": "segment_insight", "alert_type": "churn_growth", "segment_id": "seg-012", "segment_name": "Churn Risk", "previous_count": 82, "current_count": 104, "change_pct": 26.8, "status": "pending", "raised_at": dt(rdelta(1)), "agent": "customer-insights"},
]
save("campaign-requests.json", campaign_requests)

# ---------------------------------------------------------------
# 12. Email Sends
# ---------------------------------------------------------------
email_sends = [
    # camp-001: 3 sends
    {"id": "send-001", "campaign_id": "camp-001", "sent_at": dt(rdelta(45)), "send_day": 1, "recipient_count": 420, "suppressed_count": 18, "delivered_count": 402, "open_count": 104, "unique_open_rate": 0.259, "click_count": 16, "ctr": 0.040, "conversion_count": 12, "conversion_rate": 0.030, "revenue_attributed": 4200.0, "bounce_count": 4, "bounce_rate": 0.010, "spam_complaint_rate": 0.0025, "subject_a_open_rate": 0.185, "subject_b_open_rate": 0.333},
    {"id": "send-002", "campaign_id": "camp-001", "sent_at": dt(rdelta(42)), "send_day": 3, "recipient_count": 308, "suppressed_count": 12, "delivered_count": 296, "open_count": 82, "unique_open_rate": 0.277, "click_count": 14, "ctr": 0.047, "conversion_count": 21, "conversion_rate": 0.071, "revenue_attributed": 3900.0, "bounce_count": 3, "bounce_rate": 0.010, "spam_complaint_rate": 0.003},
    {"id": "send-003", "campaign_id": "camp-001", "sent_at": dt(rdelta(38)), "send_day": 7, "recipient_count": 228, "suppressed_count": 8, "delivered_count": 220, "open_count": 54, "unique_open_rate": 0.245, "click_count": 11, "ctr": 0.050, "conversion_count": 12, "conversion_rate": 0.055, "revenue_attributed": 3500.0, "bounce_count": 2, "bounce_rate": 0.009, "spam_complaint_rate": 0.004},
    # camp-002: 2 sends
    {"id": "send-004", "campaign_id": "camp-002", "sent_at": dt(rdelta(90)), "send_day": 1, "recipient_count": 185, "suppressed_count": 8, "delivered_count": 177, "open_count": 73, "unique_open_rate": 0.413, "click_count": 24, "ctr": 0.136, "conversion_count": 18, "conversion_rate": 0.102, "revenue_attributed": 10800.0, "bounce_count": 2, "bounce_rate": 0.011, "spam_complaint_rate": 0.001},
    {"id": "send-005", "campaign_id": "camp-002", "sent_at": dt(rdelta(84)), "send_day": 6, "recipient_count": 114, "suppressed_count": 5, "delivered_count": 109, "open_count": 44, "unique_open_rate": 0.404, "click_count": 17, "ctr": 0.156, "conversion_count": 13, "conversion_rate": 0.119, "revenue_attributed": 9400.0, "bounce_count": 1, "bounce_rate": 0.009, "spam_complaint_rate": 0.001},
    # camp-006: 1 send so far (active)
    {"id": "send-006", "campaign_id": "camp-006", "sent_at": dt(rdelta(7)), "send_day": 1, "recipient_count": 312, "suppressed_count": 14, "delivered_count": 298, "open_count": 124, "unique_open_rate": 0.416, "click_count": 42, "ctr": 0.141, "conversion_count": 11, "conversion_rate": 0.037, "revenue_attributed": 6600.0, "bounce_count": 3, "bounce_rate": 0.010, "spam_complaint_rate": 0.002, "subject_a_open_rate": 0.380, "subject_b_open_rate": 0.452},
]
save("email-sends.json", email_sends)

# ---------------------------------------------------------------
# 13. Social Posts
# ---------------------------------------------------------------
social_posts = [
    {"id": "post-001", "campaign_id": "camp-001", "platform": "instagram", "caption": "Spring clearance has arrived...", "image_url": "https://assets.wineshop.example/camp-001-instagram.jpg", "hashtags": ["BordeauxLovers", "WineSale", "SpringWine"], "published_at": dt(rdelta(45)), "status": "published", "impressions": 8400, "reach": 6200, "likes": 312, "comments": 28, "shares": 44, "engagement_rate": 0.062},
    {"id": "post-002", "campaign_id": "camp-001", "platform": "facebook", "caption": "Bordeaux clearance — 15% off.", "hashtags": [], "published_at": dt(rdelta(45)), "status": "published", "impressions": 4200, "reach": 3100, "likes": 88, "comments": 12, "shares": 18, "engagement_rate": 0.038},
    {"id": "post-003", "campaign_id": "camp-006", "platform": "instagram", "caption": "27 bottles. That's all we have left...", "image_url": "https://assets.wineshop.example/camp-006-instagram.jpg", "hashtags": ["Barolo", "Nebbiolo", "FineWine", "LimitedAllocation"], "published_at": dt(rdelta(7)), "status": "published", "impressions": 11200, "reach": 8400, "likes": 624, "comments": 82, "shares": 108, "engagement_rate": 0.097},
    {"id": "post-004", "campaign_id": "camp-006", "platform": "pinterest", "caption": "2021 Barolo Reserve — only 27 bottles available...", "hashtags": ["Barolo", "ItalianWine", "FineDining"], "published_at": dt(rdelta(7)), "status": "published", "impressions": 18400, "reach": 14200, "likes": 284, "comments": 14, "shares": 162, "engagement_rate": 0.032},
]
save("social-posts.json", social_posts)

# ---------------------------------------------------------------
# 14. Social Metrics (platform-level aggregates)
# ---------------------------------------------------------------
social_metrics = [
    {"platform": "instagram", "period": "2026-03", "followers": 12400, "follower_delta": 182, "impressions": 88000, "reach": 62000, "engagement_rate": 0.038, "top_posts": [{"post_id": "post-003", "engagement_rate": 0.097}]},
    {"platform": "facebook", "period": "2026-03", "followers": 8200, "follower_delta": 64, "impressions": 38000, "reach": 28000, "engagement_rate": 0.021, "top_posts": [{"post_id": "post-002", "engagement_rate": 0.038}]},
    {"platform": "pinterest", "period": "2026-03", "followers": 3100, "follower_delta": 48, "impressions": 142000, "reach": 98000, "engagement_rate": 0.055, "top_posts": [{"post_id": "post-004", "engagement_rate": 0.032}]},
    {"platform": "tiktok", "period": "2026-03", "followers": 2800, "follower_delta": 92, "impressions": 218000, "reach": 162000, "engagement_rate": 0.082, "top_posts": []},
]
save("social-metrics.json", social_metrics)

# ---------------------------------------------------------------
# 15. Paid Campaigns
# ---------------------------------------------------------------
paid_campaigns = [
    {"id": "paid-001", "campaign_id": "camp-001", "platform": "google", "platform_campaign_id": "g-camp-001-shopping", "campaign_type": "shopping", "status": "ended", "start_date": dt(rdelta(45)), "end_date": dt(rdelta(31)), "budget_daily": 50.0, "total_spend": 700.0, "impressions": 28400, "clicks": 842, "ctr": 0.030, "conversions": 24, "cpa": 29.2, "revenue": 4800.0, "roas": 3.8, "sku_ids": ["SKU-042"]},
    {"id": "paid-002", "campaign_id": "camp-001", "platform": "meta", "platform_campaign_id": "meta-camp-001-feed", "campaign_type": "social_feed", "status": "ended", "start_date": dt(rdelta(45)), "end_date": dt(rdelta(31)), "budget_daily": 40.0, "total_spend": 560.0, "impressions": 42000, "clicks": 1260, "ctr": 0.030, "conversions": 18, "cpa": 31.1, "revenue": 3200.0, "roas": 2.5, "sku_ids": ["SKU-042"]},
    {"id": "paid-003", "campaign_id": "camp-006", "platform": "google", "platform_campaign_id": "g-camp-006-shopping", "campaign_type": "shopping", "status": "active", "start_date": dt(rdelta(7)), "budget_daily": 60.0, "total_spend": 420.0, "impressions": 18200, "clicks": 624, "ctr": 0.034, "conversions": 14, "cpa": 30.0, "revenue": 2800.0, "roas": 4.4, "sku_ids": ["SKU-031"]},
    {"id": "paid-004", "campaign_id": "camp-006", "platform": "meta", "platform_campaign_id": "meta-camp-006-feed", "campaign_type": "social_feed", "status": "active", "start_date": dt(rdelta(7)), "budget_daily": 50.0, "total_spend": 350.0, "impressions": 38400, "clicks": 1152, "ctr": 0.030, "conversions": 9, "cpa": 38.9, "revenue": 2100.0, "roas": 2.9, "sku_ids": ["SKU-031"]},
]
save("paid-campaigns.json", paid_campaigns)

# ---------------------------------------------------------------
# 16. Conversion Funnels
# ---------------------------------------------------------------
def make_funnel(device, source, visit_base, step_rates, overall_rate):
    steps = []
    prev = visit_base
    step_names = ["visit", "collection_view", "pdp_view", "add_to_cart", "checkout_start", "checkout_complete", "purchase"]
    for i, (name, rate) in enumerate(zip(step_names, [1.0] + step_rates)):
        count = int(prev * rate) if i > 0 else visit_base
        drop = 1 - step_rates[i - 1] if i > 0 else 0
        steps.append({"step": name, "sessions": count, "completion_rate": round(rate, 3), "drop_off_rate": round(drop, 3), "avg_time_seconds": random.randint(15, 180)})
        prev = count
    return {"device_type": device, "traffic_source": source, "overall_conversion_rate": overall_rate, "steps": steps}

conversion_funnels = [
    make_funnel("desktop", None, 8200, [0.72, 0.64, 0.38, 0.72, 0.79, 0.99], 0.061),
    make_funnel("mobile", None, 6800, [0.61, 0.58, 0.28, 0.38, 0.71, 0.99], 0.032),
    make_funnel("tablet", None, 1200, [0.68, 0.62, 0.34, 0.58, 0.76, 0.99], 0.048),
    make_funnel(None, "email", 2100, [0.82, 0.74, 0.52, 0.78, 0.82, 0.99], 0.082),
    make_funnel(None, "organic_search", 4800, [0.71, 0.62, 0.35, 0.68, 0.79, 0.99], 0.049),
    make_funnel(None, "paid_search", 3200, [0.68, 0.58, 0.32, 0.64, 0.77, 0.99], 0.058),
    make_funnel(None, "paid_social", 2800, [0.55, 0.48, 0.24, 0.42, 0.65, 0.99], 0.032),
    make_funnel(None, "direct", 1400, [0.76, 0.68, 0.44, 0.74, 0.81, 0.99], 0.061),
]
save("conversion-funnels.json", conversion_funnels)

# ---------------------------------------------------------------
# 17. Cohort Retention
# ---------------------------------------------------------------
def make_cohort(cohort_str, channel, size, base_rates):
    rates = [round(jitter(r, 0.04, 0, 1), 3) for r in base_rates]
    rates[0] = 1.0  # month 0 always 100%
    return {"cohort": cohort_str, "acquisition_channel": channel, "cohort_size": size, "retention_by_month": rates}

cohort_retention = [
    make_cohort("2025-09", "organic_search", 142, [1.0, 0.78, 0.64, 0.52, 0.38, 0.28]),
    make_cohort("2025-10", "organic_search", 158, [1.0, 0.76, 0.62, 0.50, 0.36, 0.26]),
    make_cohort("2025-11", "paid_search", 210, [1.0, 0.71, 0.57, 0.44, 0.29, 0.18]),
    make_cohort("2025-12", "email", 88, [1.0, 0.82, 0.69, 0.57, 0.42, 0.31]),
    make_cohort("2026-01", "paid_social", 124, [1.0, 0.58, 0.42, 0.31, 0.18]),
    make_cohort("2026-01", "organic_search", 136, [1.0, 0.80, 0.66, 0.54]),
    make_cohort("2026-02", "direct", 92, [1.0, 0.85, 0.72, 0.61]),
    make_cohort("2026-02", "referral", 68, [1.0, 0.82, 0.69]),
]
save("cohort-retention.json", cohort_retention)

# ---------------------------------------------------------------
# 18. Product Performance
# ---------------------------------------------------------------
product_performance = []
for i, p in enumerate(products):
    units = max(0, int(random.gauss(p["velocity_units_per_day"] * 30, p["velocity_units_per_day"] * 8)))
    revenue = round(units * p["price"], 2)
    product_performance.append({
        "sku_id": p["id"],
        "product_name": p["name"],
        "revenue": revenue,
        "units_sold": units,
        "margin": round(revenue * p["margin_pct"], 2),
        "pdp_views": p["pdp_views_7d"] * 4,  # 28-day approximation
        "view_to_cart_rate": p["view_to_cart_rate"],
        "cart_to_purchase_rate": p["cart_to_purchase_rate"],
        "avg_order_quantity": round(jitter(1.4, 0.3, 1.0, 4.0), 1),
        "rank_by_revenue": 0,  # filled after sort
        "rank_by_units": 0,
    })

product_performance.sort(key=lambda x: -x["revenue"])
for i, pp in enumerate(product_performance):
    pp["rank_by_revenue"] = i + 1
product_performance.sort(key=lambda x: -x["units_sold"])
for i, pp in enumerate(product_performance):
    pp["rank_by_units"] = i + 1
product_performance.sort(key=lambda x: x["rank_by_revenue"])
save("product-performance.json", product_performance)

# ---------------------------------------------------------------
# 19. Merchandising Rules
# ---------------------------------------------------------------
merchandising_rules = [
    {"id": "rule-001", "collection_id": "col-001", "rule_type": "exclude", "condition": "stock_units == 0", "priority": 1, "created_at": dt(rdelta(60))},
    {"id": "rule-002", "collection_id": "col-001", "rule_type": "boost", "sku_id": "SKU-031", "condition": "campaign_boosted", "priority": 2, "created_at": dt(rdelta(7)), "expires_at": dt(rdelta(-7))},
    {"id": "rule-003", "collection_id": "col-005", "rule_type": "pin_to_top", "condition": "varietal_family == Natural/Biodynamic", "priority": 1, "created_at": dt(rdelta(14))},
    {"id": "rule-004", "collection_id": "col-008", "rule_type": "exclude", "condition": "price > 50", "priority": 1, "created_at": dt(rdelta(30))},
]
save("merchandising-rules.json", merchandising_rules)

# ---------------------------------------------------------------
# 20. Collections
# ---------------------------------------------------------------
def sku_ids_for_collection(col_id):
    return [p["id"] for p in products if col_id in p["collection_ids"]]

collections = [
    {"id": "col-001", "name": "Red Wines", "slug": "red-wines", "sku_ids": sku_ids_for_collection("col-001"), "default_sort": "margin_desc", "description": "Our full selection of red wines from around the world."},
    {"id": "col-002", "name": "White Wines", "slug": "white-wines", "sku_ids": sku_ids_for_collection("col-002"), "default_sort": "velocity_desc", "description": "Crisp, elegant white wines for every occasion."},
    {"id": "col-003", "name": "Sparkling", "slug": "sparkling", "sku_ids": sku_ids_for_collection("col-003"), "default_sort": "price_desc", "description": "Champagne, Cava, Prosecco, and Pétillant Naturel."},
    {"id": "col-004", "name": "Rosé", "slug": "rose", "sku_ids": sku_ids_for_collection("col-004"), "default_sort": "velocity_desc", "description": "Dry, refreshing rosés from Provence and beyond."},
    {"id": "col-005", "name": "Natural & Biodynamic", "slug": "natural-biodynamic", "sku_ids": sku_ids_for_collection("col-005"), "default_sort": "new_arrival", "description": "Low-intervention wines made with minimal added sulphur."},
    {"id": "col-006", "name": "French Wines", "slug": "french-wines", "sku_ids": sku_ids_for_collection("col-006"), "default_sort": "margin_desc", "description": "Bordeaux, Burgundy, Rhône, Champagne, and beyond."},
    {"id": "col-007", "name": "Italian Wines", "slug": "italian-wines", "sku_ids": sku_ids_for_collection("col-007"), "default_sort": "price_desc", "description": "Barolo, Brunello, Chianti, and more from Italy's finest regions."},
    {"id": "col-008", "name": "Gifts Under $50", "slug": "gifts-under-50", "sku_ids": [p["id"] for p in products if p["price"] <= 50], "default_sort": "price_asc", "description": "Great wine gifts that won't break the bank."},
]
save("collections.json", collections)

# ---------------------------------------------------------------
# 21. Sessions (500 synthetic records)
# ---------------------------------------------------------------
EVENT_SEQUENCES = {
    "browse": [{"event_type": "page_view"}, {"event_type": "pdp_view"}],
    "consideration": [{"event_type": "page_view"}, {"event_type": "pdp_view"}, {"event_type": "scroll_depth", "scroll_pct": 0.75}, {"event_type": "pdp_view"}],
    "cart": [{"event_type": "page_view"}, {"event_type": "pdp_view"}, {"event_type": "add_to_cart"}],
    "checkout": [{"event_type": "page_view"}, {"event_type": "pdp_view"}, {"event_type": "add_to_cart"}, {"event_type": "checkout_step"}],
    "purchase": [{"event_type": "page_view"}, {"event_type": "pdp_view"}, {"event_type": "add_to_cart"}, {"event_type": "checkout_step"}, {"event_type": "purchase"}],
}

DEVICE_WEIGHTS = [0.55, 0.38, 0.07]
DEVICES = ["desktop", "mobile", "tablet"]
SOURCE_WEIGHTS = [0.29, 0.19, 0.13, 0.21, 0.10, 0.08]
SOURCES = ["organic_search", "paid_search", "email", "paid_social", "direct", "referral"]

sessions = []
for i in range(500):
    c = random.choice(customers)
    stage = random.choices(list(EVENT_SEQUENCES.keys()), weights=[0.25, 0.30, 0.20, 0.10, 0.15])[0]
    device = random.choices(DEVICES, weights=DEVICE_WEIGHTS)[0]
    source = random.choices(SOURCES, weights=SOURCE_WEIGHTS)[0]
    skus_engaged = random.sample([p["id"] for p in products], k=random.randint(1, 5))
    started = rdelta(random.randint(0, 30))
    intent_means = {"Explorer": 48, "Gifter": 38, "Loyalist": 65, "DealSeeker": 42, "Collector": 72}
    intent_score = int(np.clip(np.random.normal(intent_means[c["persona"]], 15), 5, 100))
    events = EVENT_SEQUENCES[stage].copy()
    for ev in events:
        if ev["event_type"] == "pdp_view" and skus_engaged:
            ev["sku_id"] = random.choice(skus_engaged)

    session = {
        "id": f"sess-{i+1:05d}",
        "customer_id": c["id"],
        "started_at": dt(started),
        "ended_at": dt(started + timedelta(minutes=random.randint(2, 45))),
        "device_type": device,
        "traffic_source": source,
        "intent_score": intent_score,
        "funnel_stage_reached": stage,
        "converted": stage == "purchase",
        "sku_ids_engaged": skus_engaged,
        "search_queries_used": [fake.word() + " wine"] if random.random() < 0.3 else [],
        "total_pdp_views": len([e for e in events if e["event_type"] == "pdp_view"]),
        "events": events,
    }
    sessions.append(session)
save("sessions.json", sessions)

# ---------------------------------------------------------------
# 22. A/B Tests
# ---------------------------------------------------------------
ab_tests = [
    {"id": "test-001", "name": "Bordeaux PDP Urgency Banner", "page_type": "pdp", "element": "urgency_banner", "campaign_id": "camp-001", "sku_id": "SKU-042", "status": "complete", "primary_metric": "add_to_cart_rate", "traffic_split": 0.5, "min_sample_size": 200, "max_duration_days": 14, "started_at": dt(rdelta(45)), "ended_at": dt(rdelta(31)), "winner": "B", "variants": [{"id": "A", "description": "No urgency banner (control)", "sessions": 410, "primary_metric_value": 0.12, "lift_pct": 0, "p_value": None, "is_significant": False}, {"id": "B", "description": "Low stock urgency banner", "sessions": 412, "primary_metric_value": 0.142, "lift_pct": 18.3, "p_value": 0.021, "is_significant": True, "confidence_interval": [0.08, 0.29]}]},
    {"id": "test-002", "name": "Barolo Allocation Subject Line", "page_type": "email", "element": "subject_line", "campaign_id": "camp-002", "status": "complete", "primary_metric": "open_rate", "traffic_split": 0.5, "min_sample_size": 80, "max_duration_days": 7, "started_at": dt(rdelta(90)), "ended_at": dt(rdelta(84)), "winner": "B", "variants": [{"id": "A", "description": "Feature-led: 'Only 27 bottles remain'", "sessions": 88, "primary_metric_value": 0.380, "lift_pct": 0}, {"id": "B", "description": "Story-led: 'This Barolo is almost gone. Here's why that matters.'", "sessions": 89, "primary_metric_value": 0.452, "lift_pct": 18.9, "p_value": 0.018, "is_significant": True}]},
    {"id": "test-003", "name": "Holiday Homepage Hero", "page_type": "homepage", "element": "hero_banner", "campaign_id": "camp-003", "status": "complete", "primary_metric": "collection_click_rate", "traffic_split": 0.5, "min_sample_size": 300, "max_duration_days": 14, "started_at": dt(rdelta(120)), "ended_at": dt(rdelta(106)), "winner": "A", "variants": [{"id": "A", "description": "Product-led: bottle imagery with price", "sessions": 820, "primary_metric_value": 0.082, "lift_pct": 9.4, "p_value": 0.038, "is_significant": True}, {"id": "B", "description": "Occasion-led: lifestyle gifting image", "sessions": 818, "primary_metric_value": 0.075}]},
    {"id": "test-004", "name": "Natural Wine Blog CTA Placement", "page_type": "blog", "element": "cta_position", "campaign_id": "camp-005", "status": "running", "primary_metric": "pdp_click_rate", "traffic_split": 0.5, "min_sample_size": 400, "max_duration_days": 21, "started_at": dt(rdelta(14)), "variants": [{"id": "A", "description": "CTA at bottom of article", "sessions": 248, "primary_metric_value": 0.038}, {"id": "B", "description": "Inline CTA mid-article + sticky footer", "sessions": 251, "primary_metric_value": 0.052, "lift_pct": 36.8, "p_value": 0.089, "is_significant": False}]},
    {"id": "test-005", "name": "Barolo PDP Stock Counter", "page_type": "pdp", "element": "stock_counter", "campaign_id": "camp-006", "sku_id": "SKU-031", "status": "running", "primary_metric": "add_to_cart_rate", "traffic_split": 0.5, "min_sample_size": 150, "max_duration_days": 14, "started_at": dt(rdelta(7)), "variants": [{"id": "A", "description": "Static text: 'Limited stock'", "sessions": 58, "primary_metric_value": 0.38}, {"id": "B", "description": "Live counter: '27 bottles left'", "sessions": 59, "primary_metric_value": 0.44, "lift_pct": 15.8, "p_value": 0.24, "is_significant": False}]},
]
save("ab-tests.json", ab_tests)

# ---------------------------------------------------------------
# 23. Search Query Report
# ---------------------------------------------------------------
search_query_report = {
    "period_days": 30,
    "total_searches": 824,
    "search_to_purchase_rate": 0.048,
    "top_queries": [
        {"query": "barolo", "count": 68, "click_through_rate": 0.82, "add_to_cart_rate": 0.34, "purchase_rate": 0.12},
        {"query": "natural wine", "count": 54, "click_through_rate": 0.74, "add_to_cart_rate": 0.22, "purchase_rate": 0.07},
        {"query": "bordeaux", "count": 48, "click_through_rate": 0.79, "add_to_cart_rate": 0.28, "purchase_rate": 0.09},
        {"query": "wine under 50", "count": 42, "click_through_rate": 0.68, "add_to_cart_rate": 0.31, "purchase_rate": 0.11},
        {"query": "gift wine", "count": 38, "click_through_rate": 0.61, "add_to_cart_rate": 0.18, "purchase_rate": 0.06},
        {"query": "pinot noir", "count": 36, "click_through_rate": 0.77, "add_to_cart_rate": 0.25, "purchase_rate": 0.08},
        {"query": "champagne", "count": 32, "click_through_rate": 0.71, "add_to_cart_rate": 0.20, "purchase_rate": 0.07},
        {"query": "rosé wine", "count": 28, "click_through_rate": 0.66, "add_to_cart_rate": 0.24, "purchase_rate": 0.09},
        {"query": "chardonnay", "count": 24, "click_through_rate": 0.73, "add_to_cart_rate": 0.19, "purchase_rate": 0.06},
        {"query": "syrah", "count": 18, "click_through_rate": 0.69, "add_to_cart_rate": 0.22, "purchase_rate": 0.08},
    ],
    "zero_result_queries": [
        {"query": "natural orange wine", "count": 22},
        {"query": "biodynamic jura savagnin", "count": 12},
        {"query": "1990 bordeaux futures", "count": 8},
        {"query": "orange wine skin contact", "count": 18},
    ],
    "low_result_queries": [
        {"query": "vintage 2010 burgundy", "count": 14, "result_count": 2},
        {"query": "amphora wine", "count": 10, "result_count": 1},
    ],
}
save("search-query-report.json", search_query_report)

# ---------------------------------------------------------------
# 24. Co-Purchase Pairs
# ---------------------------------------------------------------
co_purchase_pairs = [
    {"sku_id_a": "SKU-031", "sku_id_b": "SKU-058", "co_purchase_rate": 0.44, "lift": 3.8},
    {"sku_id_a": "SKU-042", "sku_id_b": "SKU-017", "co_purchase_rate": 0.31, "lift": 2.9},
    {"sku_id_a": "SKU-009", "sku_id_b": "SKU-058", "co_purchase_rate": 0.28, "lift": 2.4},
]
# Add some random pairs from the product list
p_ids = [p["id"] for p in products if p["id"] not in ("SKU-031", "SKU-042", "SKU-017", "SKU-009", "SKU-058")]
for _ in range(20):
    a, b = random.sample(p_ids, 2)
    rate = round(jitter(0.18, 0.08, 0.05, 0.45), 3)
    co_purchase_pairs.append({"sku_id_a": a, "sku_id_b": b, "co_purchase_rate": rate, "lift": round(rate / 0.06, 1)})
save("co-purchase-pairs.json", co_purchase_pairs)

print("\n✓ All data files generated successfully!")
print(f"  Products: {len(products)}")
print(f"  Customers: {len(customers)}")
print(f"  Segments: {len(segments)}")
print(f"  Campaigns: {len(campaigns)}")
print(f"  Sessions: {len(sessions)}")
print(f"  A/B Tests: {len(ab_tests)}")
