# Sample Data Generation Plan: Wine Marketing MCP Prototype
*Coherent synthetic data across all 7 MCP domains — 1,000 customers with realistic variance*

---

## Overview

This document specifies how to generate synthetic sample data for every data-retrieval function in the wine marketing MCP. Two design constraints govern everything:

**Cross-dataset coherence.** The same 1,000 customers appear consistently across every domain. A customer's education level, income, and persona archetype determine their purchase history, which determines their CLV and RFM tier, which determines their segment memberships, which shapes their behavioral signals. No dataset is generated independently — everything is derived from a shared master customer table.

**Realistic variance (jitter).** Real customer data is never clean. Customers within the same persona don't all behave identically — a Loyalist might have a 58% email open rate or a 31% open rate depending on their individual engagement history, acquisition channel, tenure, and some irreducible randomness. Every metric in this plan has a defined jitter model that introduces per-customer noise while preserving the correct population-level signal. The goal is data that looks like it came from a real CRM, not a spreadsheet filled with averages.

---

## Jitter Design Principles

Before specifying any dataset, these principles apply universally:

**Bounded noise, not unbounded.** Every metric is drawn from a distribution centered on a persona-appropriate baseline, clipped to a plausible real-world range. Email open rates don't go below 2% or above 85% regardless of persona. CLV doesn't go negative. RFM scores don't escape 1–5.

**Correlated noise, not independent noise.** A customer who is naturally more engaged should be slightly above their persona baseline across *multiple* metrics — not just one. This is implemented by giving each customer a latent `engagement_modifier` drawn from N(0, 0.15) at generation time, which nudges all engagement-related metrics in the same direction for that individual.

**Noise amplitude scales with the range.** A metric with a wide range (CLV: $80–$4,000) gets more absolute noise than a narrow range (RFM score: 1–5). Noise is specified as a percentage of the persona's baseline range.

**Outliers are intentional.** 2–4% of customers in each persona get an `outlier_flag` that places them at the extreme of their distribution. A Deal Seeker outlier might have $800 CLV. A Loyalist outlier might have a 12% open rate. These test whether agents handle edge cases correctly.

---

## Generation Architecture

### The Master Customer Table

Everything derives from a single master table of **1,000 customers**. Build this first.

**Persona distribution (1,000 total):**

| Persona | Count | Rationale |
|---------|-------|-----------|
| Explorer | 275 | Largest — curious, broad appeal |
| Gifter | 250 | Strong seasonal demand |
| Loyalist | 200 | Core revenue base |
| Deal Seeker | 175 | High volume, lower value |
| Collector | 100 | Smallest but highest value |

**Seed attributes per customer:**

```
customer_id             string    "cust-0001" to "cust-1000"
persona                 enum      Explorer | Gifter | Loyalist | DealSeeker | Collector
first_name              string    Generated via Faker — realistic US first names
last_name               string    Generated via Faker — realistic US last names
email                   string    Generated as [first].[last][2-digit-number]@[provider].com
                                  Providers weighted: gmail(42%), yahoo(18%), outlook(14%),
                                  icloud(10%), custom domain(16% — used for high-income/Collector)
phone                   string    US format (XXX) XXX-XXXX — generated via Faker
date_of_birth           date      Persona-correlated age bands:
                                    Explorer:    25–42 (skewed younger)
                                    Gifter:      32–58 (broad)
                                    Loyalist:    35–62 (skewed older)
                                    Deal Seeker: 28–55
                                    Collector:   42–72 (skewed older)
location_city           string    Major city within location_state (e.g. "Austin" for TX)
location_state          string    US state — weighted: CA(18%), NY(12%), TX(10%), FL(9%), IL(7%), others spread
location_zip            string    5-digit ZIP code consistent with city/state — generated via Faker
education               enum      high_school | college | graduate | phd
income_band             enum      low ($40–75k) | mid ($75–130k) | high ($130–250k) | premium ($250k+)
acquisition_channel     enum      organic_search | paid_search | social | referral | direct
acquisition_date        date      Spread across 36 months ago to 3 months ago
lifecycle_stage         enum      new | active | at_risk | lapsed | churned
preferred_varietal      string    Primary varietal preference
preferred_region        string    Correlated with preferred_varietal
secondary_varietal      string    Second preference (adds cross-varietal purchasing realism)
price_sensitivity       float     0.0–1.0 — drawn from persona distribution below
engagement_modifier     float     N(0, 0.15) clipped to ±0.35 — nudges all engagement metrics uniformly
outlier_flag            boolean   True for ~3% of customers
tenure_days             integer   Derived from acquisition_date
```

**PII generation rules:**

All PII is synthetic — generated by Faker with no relation to real individuals. Apply these rules for coherence:

- **Email format:** `[first_name.lower()].[last_name.lower()][random.randint(10,99)]@[provider]`. Add occasional variants: some use initials (`j.smith44@gmail.com`), some omit the number. Ensure no two customers share the same email address.
- **Custom domain emails:** Collector and high-income Loyalist customers have a 30% chance of using a custom domain (e.g. `mwilliams@harborconsulting.com`). Generate plausible business domain names via Faker.
- **Phone:** ~8% of customers have no phone on file (`null`) — realistic for online-acquired customers.
- **Date of birth:** Jitter within persona age band using `random.gauss(band_midpoint, band_sd)` clipped to band. This produces realistic age spread within each persona rather than a flat distribution.
- **City/state/zip coherence:** Use Faker's `local_latlng` or a US zip-to-city mapping to ensure city, state, and zip are consistent. Never assign "Austin" with a New York state.
- **Name diversity:** Use Faker's locales to generate a realistic US demographic mix of names. Avoid generating 1,000 customers all with Anglo-Saxon names.

**Persona-to-attribute distributions:**

| Attribute | Explorer | Gifter | Loyalist | Deal Seeker | Collector |
|-----------|----------|--------|----------|-------------|-----------|
| Education | 35% college, 45% grad, 20% phd | 40% HS, 45% college, 15% grad | 20% college, 50% grad, 30% phd | 45% HS, 40% college, 15% grad | 10% college, 35% grad, 55% phd |
| Income | 60% mid, 30% high, 10% low | 40% mid, 40% high, 20% low | 20% mid, 55% high, 25% premium | 50% low, 40% mid, 10% high | 15% high, 85% premium |
| Price sensitivity | Beta(2,6) → mean 0.25, sd 0.12 | Beta(3,5) → mean 0.38, sd 0.14 | Beta(1,9) → mean 0.11, sd 0.09 | Beta(7,3) → mean 0.72, sd 0.13 | Beta(1,12) → mean 0.08, sd 0.07 |
| Lifecycle mix | 55% active, 20% at_risk, 20% new, 5% lapsed | 35% active, 25% lapsed, 30% new, 10% at_risk | 65% active, 20% at_risk, 10% lapsed, 5% new | 35% active, 35% lapsed, 20% churned, 10% new | 75% active, 15% at_risk, 10% lapsed |
| Acquisition channel | 40% organic, 35% social, 15% referral, 10% paid | 50% paid_search, 20% social, 20% direct, 10% organic | 45% direct, 30% referral, 15% organic, 10% paid | 60% paid_search, 25% social, 15% direct | 50% direct, 35% referral, 15% organic |

**Preferred varietal distribution (across all 1,000 customers):**

| Varietal family | % | Notes |
|-----------------|---|-------|
| Cabernet Sauvignon | 14% | Broadest appeal — Loyalists, Collectors, Gifters |
| Pinot Noir | 12% | Explorers, premium Gifters |
| Chardonnay | 10% | Gifters, casual buyers, broad market |
| Barolo / Nebbiolo | 7% | Collectors, serious Loyalists |
| Natural / Biodynamic | 9% | Explorers, younger demographic |
| Sparkling / Champagne | 8% | Gifters, seasonal buyers |
| Bordeaux blends (Left Bank) | 6% | Loyalists, Collectors |
| Syrah / Rhône blends | 6% | Explorers, mid-tier Loyalists |
| Rosé | 5% | Gifters, casual summer buyers |
| Riesling / Alsatian whites | 5% | Explorers, food-pairing buyers |
| Malbec / South American | 5% | Entry-level Loyalists, Deal Seekers |
| Italian varieties (non-Barolo) | 5% | Explorers, Collectors expanding palate |
| Spanish varieties | 4% | Explorers, Deal Seekers |
| White Burgundy / White Bordeaux | 3% | Collectors, high-education Loyalists |
| Other / None | 1% | New customers without established preference |

---

## Jitter Models by Data Type

These functions are referenced throughout the domain specifications. Implement each as a utility and call it wherever that metric appears.

### Email open rate

```python
def jitter_open_rate(persona_baseline, engagement_modifier, lifecycle_stage, tenure_days):
    base = random.gauss(persona_baseline, sigma=0.08)
    base += engagement_modifier * 0.12
    # Long-tenure customers regress slightly toward their stable personal rate
    if tenure_days > 540:
        base = base * 0.85 + persona_baseline * 0.15
    dampening = {"active": 1.0, "at_risk": 0.75, "lapsed": 0.45, "churned": 0.20, "new": 0.90}
    base *= dampening[lifecycle_stage]
    return clip(base, 0.04, 0.82)
```

**Resulting distributions by persona:**

| Persona | Mean | Std | Range |
|---------|------|-----|-------|
| Loyalist | 42% | 8% | 18–68% |
| Collector | 47% | 7% | 22–71% |
| Explorer | 28% | 9% | 8–52% |
| Gifter | 22% | 11% | 5–48% |
| Deal Seeker | 19% | 10% | 4–44% |

CTR is derived from open rate rather than generated independently:
```python
ctr_30d = open_rate_30d * random.uniform(0.08, 0.22)
```
This preserves the open→click relationship while adding per-customer variance in that ratio.

### Customer Lifetime Value

```python
def jitter_clv(persona_base_clv, engagement_modifier, lifecycle_stage, outlier_flag):
    # Lognormal — CLV is always right-skewed in real data
    raw = math.exp(random.gauss(math.log(persona_base_clv), 0.45))
    raw *= (1 + engagement_modifier * 0.3)
    multipliers = {
        "active":  random.uniform(2.5, 3.5),
        "at_risk": random.uniform(1.2, 1.8),
        "lapsed":  random.uniform(0.5, 0.9),
        "churned": random.uniform(0.1, 0.3),
        "new":     random.uniform(1.0, 1.5),
    }
    raw *= multipliers[lifecycle_stage]
    if outlier_flag:
        raw *= random.uniform(2.0, 4.0)  # 3% of customers are extreme cases
    return round(clip(raw, 40, 8000), 2)
```

**Resulting CLV distributions by persona:**

| Persona | Median | P25 | P75 |
|---------|--------|-----|-----|
| Collector | $1,800 | $900 | $3,200 |
| Loyalist | $950 | $480 | $1,800 |
| Explorer | $420 | $210 | $780 |
| Gifter | $310 | $140 | $580 |
| Deal Seeker | $160 | $80 | $310 |

### Purchase order value

```python
def jitter_order_value(persona_base_aov, price_sensitivity, sku_price, engagement_modifier):
    personal_aov = random.gauss(persona_base_aov, sigma=persona_base_aov * 0.25)
    # Price-sensitive customers are pulled toward lower-priced items
    personal_aov -= price_sensitivity * (persona_base_aov - sku_price) * 0.4
    personal_aov *= (1 + engagement_modifier * 0.1)
    return round(clip(personal_aov, 18, 1200), 2)
```

### Behavioral event frequency

```python
def jitter_event_count(persona_base_count, engagement_modifier, lifecycle_stage):
    lambda_val = persona_base_count * (1 + engagement_modifier * 0.4)
    dampening = {"active": 1.0, "at_risk": 0.6, "lapsed": 0.2, "churned": 0.05, "new": 0.7}
    lambda_val *= dampening[lifecycle_stage]
    # Poisson-like: integer count, minimum 0
    return max(0, int(random.gauss(lambda_val, math.sqrt(max(lambda_val, 1)))))
```

### Propensity scores

```python
def jitter_propensity(persona_base, engagement_modifier):
    alpha = persona_base * 10
    beta_param = (1 - persona_base) * 10
    raw = random.betavariate(max(alpha, 0.1), max(beta_param, 0.1))
    return round(clip(raw + engagement_modifier * 0.08, 0.01, 0.99), 3)
```

### Inter-purchase gap (days)

```python
def jitter_inter_purchase_days(persona_base_days):
    # Exponential — purchase timing is memoryless within a persona
    return max(1, int(random.expovariate(1 / persona_base_days)))
```

**Persona baseline inter-purchase days and resulting spread:**

| Persona | Base (days) | Typical range |
|---------|------------|---------------|
| Loyalist | 28 | 5–120 (frequent, occasional long gaps) |
| Collector | 65 | 14–300 (deliberate, irregular) |
| Explorer | 42 | 10–180 (varied) |
| Gifter | 90 | 20–365 (seasonal clusters) |
| Deal Seeker | 50 | 14–240 (promo-event clusters) |

---

## Domain 1: Catalog & Inventory

### `get_product_catalog`

Generate **120 SKUs** across 4 price tiers and 15 varietal families.

**Price tier distribution:**
- Entry ($18–35): 40 SKUs — velocity 2–5/day, margin 0.35–0.45
- Mid ($36–65): 40 SKUs — velocity 0.8–2.5/day, margin 0.42–0.52
- Premium ($66–120): 24 SKUs — velocity 0.2–0.8/day, margin 0.50–0.62
- Collector ($121–350): 16 SKUs — velocity 0.05–0.2/day, margin 0.55–0.68

**Varietal families and SKU allocation (120 total):**

| Family | SKUs | Price tier emphasis | Key regions | Persona fit |
|--------|------|-------------------|-------------|-------------|
| Cabernet Sauvignon | 10 | Mid + Premium | Napa Valley, Sonoma, Paso Robles, Pauillac | Loyalist, Collector |
| Pinot Noir | 10 | Mid + Premium | Burgundy, Willamette Valley, Santa Barbara, Central Otago NZ | Explorer, Gifter |
| Chardonnay | 8 | Entry + Mid | Burgundy (Meursault), Napa, Chablis, Mâcon | Gifter, Loyalist |
| Barolo / Nebbiolo | 6 | Premium + Collector | Barolo DOCG, Barbaresco, Langhe | Collector, Loyalist |
| Natural / Biodynamic | 10 | Entry + Mid | Loire, Beaujolais (Gamay), Jura, Alsace, Austria | Explorer |
| Sparkling / Champagne | 8 | Entry + Collector | Champagne, Prosecco, Cava, Crémant d'Alsace, California | Gifter, all |
| Bordeaux blends (Left Bank) | 8 | Mid + Collector | Pauillac, Saint-Estèphe, Saint-Julien, Margaux, Pessac-Léognan | Loyalist, Collector |
| Syrah / Rhône blends | 8 | Mid + Premium | Northern Rhône (Crozes-Hermitage, Cornas, Côte-Rôtie), Southern Rhône, Barossa AUS | Explorer, Loyalist |
| Rosé | 8 | Entry + Mid | Provence (Bandol, Côtes de Provence), Tavel, Spanish Rosado | Gifter, casual |
| Riesling / Alsatian whites | 8 | Entry + Mid | Alsace (Riesling, Gewurztraminer, Pinot Gris), Mosel, Clare Valley AUS | Explorer, Collector |
| Malbec / South American | 8 | Entry + Mid | Mendoza (Argentina), Cahors (France), Carmenère (Chile) | Entry Loyalist, Deal Seeker |
| Italian varieties (non-Barolo) | 10 | Entry + Collector | Chianti Classico, Brunello, Amarone, Vermentino, Nerello Mascalese, Nero d'Avola, Montepulciano | Explorer, Collector |
| Spanish varieties | 8 | Entry + Mid | Rioja (Tempranillo), Priorat (Garnacha), Albariño, Verdejo, Txakoli | Explorer, Deal Seeker |
| White Burgundy / White Bordeaux | 6 | Premium + Collector | Puligny-Montrachet, Chassagne-Montrachet, Corton-Charlemagne, Pessac-Léognan Blanc | Collector, high-CLV Loyalist |
| Dessert / Fortified / Orange | 4 | Entry + Collector | Sauternes, Port (Vintage, LBV), Orange wine (Georgia), Vin Santo | Collector, Explorer |

**Full SKU list by varietal family:**

*Cabernet Sauvignon (10 SKUs):*
- 2021 Stag's Leap District Cabernet, Napa — $88 (premium)
- 2022 Alexander Valley Cabernet, Sonoma — $42 (mid)
- 2020 Chateau Montelena Cabernet, Napa — $165 (collector)
- 2021 Justin Vineyards Cabernet, Paso Robles — $34 (entry)
- 2019 Château Lynch-Bages, Pauillac — $220 (collector)
- 2022 Jordan Winery Cabernet, Sonoma — $58 (mid)
- 2021 B.V. Georges de Latour Private Reserve, Napa — $94 (premium)
- 2020 Duckhorn Vineyards Cabernet, Napa — $72 (premium)
- 2022 Bread & Butter Cabernet, California — $22 (entry)
- SKU-058: 2019 Napa Reserve Cabernet — $95 (premium, **overstock**)

*Pinot Noir (10 SKUs):*
- 2021 Domaine Drouhin Pinot Noir, Willamette Valley — $52 (mid)
- 2020 Adelsheim Pinot Noir, Willamette Valley — $38 (mid)
- SKU-017: 2022 Anderson Valley Pinot Noir — $29 (entry, **overstock**)
- 2021 Sanford Pinot Noir, Santa Barbara — $44 (mid)
- 2020 Meiomi Pinot Noir, California — $24 (entry)
- 2021 Domaine Faiveley Bourgogne Pinot Noir — $36 (mid)
- 2019 Gevrey-Chambertin Villages, Burgundy — $78 (premium)
- 2021 Felton Road Pinot Noir, Central Otago, NZ — $65 (mid)
- 2020 Au Bon Climat Pinot Noir, Santa Barbara — $48 (mid)
- 2019 Chambolle-Musigny 1er Cru, Burgundy — $145 (collector)

*Chardonnay (8 SKUs):*
- 2022 Louis Jadot Mâcon-Villages — $22 (entry)
- 2021 Sonoma-Cutrer Russian River Ranches — $42 (mid)
- 2022 Pouilly-Fuissé, Burgundy — $38 (mid)
- 2021 William Fèvre Chablis 1er Cru — $55 (mid)
- 2020 Meursault Blagny, Burgundy — $88 (premium)
- 2022 Rombauer Chardonnay, Carneros — $34 (entry)
- 2021 Far Niente Chardonnay, Napa — $92 (premium)
- 2022 La Marca Chardonnay, Veneto — $19 (entry)

*Barolo / Nebbiolo (6 SKUs):*
- SKU-031: 2020 Barolo Riserva DOCG, Piedmont — $145 (collector, **low stock**)
- 2021 Barolo Castiglione DOCG, Piedmont — $68 (premium)
- 2019 Barbaresco DOCG, Piedmont — $82 (premium)
- 2020 Langhe Nebbiolo, Piedmont — $38 (mid — gateway SKU, frequently co-purchased with Barolo)
- 2018 Barolo Serralunga d'Alba DOCG — $165 (collector)
- 2019 Barbaresco Asili Riserva DOCG — $195 (collector)

*Natural / Biodynamic (10 SKUs):*
- 2022 Muscadet Sèvre et Maine sur Lie — $19 (entry)
- 2022 Sancerre Blanc, Loire (Sauvignon Blanc) — $48 (mid)
- 2021 Marcel Lapierre Morgon, Beaujolais (Gamay) — $32 (entry)
- 2022 Jean-Paul Brun Fleurie, Beaujolais (Gamay) — $28 (entry)
- 2021 Domaine Overnoy Poulsard, Jura — $58 (mid)
- 2022 Domaine Tissot Savagnin Ouillé, Jura — $42 (mid)
- 2021 Gonon Saint-Joseph Blanc, Northern Rhône (Marsanne/Roussanne) — $62 (mid)
- 2022 Claus Preisinger Pannobile Rot, Austria (Blaufränkisch/Zweigelt) — $38 (mid)
- 2021 Massimago Valpolicella Ripasso, Italy (certified biodynamic) — $44 (mid)
- 2022 Domaine Léon Barral Faugères, Languedoc — $34 (entry)

*Sparkling / Champagne (8 SKUs):*
- SKU-009: NV Cava Brut, Spain — $22 (entry, **out of stock**)
- NV Prosecco DOC Brut, Veneto — $18 (entry)
- NV Bollinger Special Cuvée Brut Champagne — $74 (premium)
- NV Veuve Clicquot Yellow Label Brut Champagne — $62 (mid)
- NV Taittinger Brut Rosé Champagne — $88 (premium)
- 2015 Billecart-Salmon Blanc de Blancs Champagne — $145 (collector)
- NV Crémant d'Alsace Brut, France — $24 (entry)
- NV Schramsberg Blanc de Blancs, California — $38 (mid)

*Bordeaux blends / Left Bank (8 SKUs):*
- SKU-042: 2021 Château Dupont Bordeaux AC — $48 (mid, **overstock**)
- 2020 Château Léoville Barton, Saint-Julien — $185 (collector)
- 2021 Château Sociando-Mallet, Haut-Médoc — $44 (mid)
- 2019 Château Cos d'Estournel, Saint-Estèphe — $240 (collector)
- 2021 Château Cantenac Brown, Margaux — $68 (premium)
- 2022 Mouton Cadet Bordeaux AC — $22 (entry)
- 2020 Château Phélan Ségur, Saint-Estèphe — $52 (mid)
- 2021 Château Pichon-Baron, Pauillac — $155 (collector)

*Syrah / Rhône blends (8 SKUs):*
- 2021 Crozes-Hermitage Rouge, Northern Rhône — $36 (mid)
- 2020 Cornas, Northern Rhône — $82 (premium)
- 2019 Côte-Rôtie, Northern Rhône — $115 (premium)
- 2021 Châteauneuf-du-Pape, Southern Rhône — $68 (premium)
- 2022 Côtes du Rhône Villages Rouge — $24 (entry)
- 2021 Penfolds Bin 28 Kalimna Shiraz, Barossa, AUS — $34 (entry)
- 2020 Two Hands Gnarly Dudes Shiraz, Barossa, AUS — $42 (mid)
- 2019 K Vintners The Hidden Syrah, Walla Walla — $88 (premium)

*Rosé (8 SKUs):*
- 2023 Chateau d'Esclans Rock Angel Rosé, Provence — $38 (mid)
- 2023 Miraval Rosé, Provence — $28 (entry)
- 2023 Domaine Tempier Bandol Rosé, Provence — $52 (mid)
- 2023 Tavel Rosé, Rhône — $32 (entry)
- 2023 Whispering Angel Rosé, Provence — $24 (entry)
- 2023 Garrus by Château d'Esclans, Provence — $92 (premium)
- 2023 Luis Cañas Rioja Rosado, Spain — $19 (entry)
- 2022 A to Z Rosé, Oregon — $22 (entry)

*Riesling / Alsatian whites (8 SKUs):*
- 2022 Trimbach Riesling, Alsace — $28 (entry)
- 2021 Domaine Weinbach Riesling Clos des Capucins, Alsace — $52 (mid)
- 2022 Loosen Bros Dr. L Riesling, Mosel, Germany — $19 (entry)
- 2020 Egon Müller Scharzhofberger Riesling Spätlese, Mosel — $145 (collector)
- 2021 Hugel Gewurztraminer Jubilee, Alsace — $44 (mid)
- 2022 Zind-Humbrecht Pinot Gris, Alsace — $38 (mid)
- 2022 Pike's Riesling, Clare Valley, AUS — $24 (entry)
- 2021 Dönnhoff Niederhäuser Hermannshöhle Riesling Spätlese — $68 (premium)

*Malbec / South American (8 SKUs):*
- 2022 Zuccardi Valle de Uco Malbec, Mendoza — $28 (entry)
- 2021 Catena Zapata Adrianna Vineyard Malbec, Mendoza — $95 (premium)
- 2022 Achaval Ferrer Malbec, Mendoza — $34 (entry)
- 2021 Clos de los Siete Malbec blend, Mendoza — $22 (entry)
- 2022 Château du Cèdre Cahors Malbec, France — $32 (entry)
- 2021 Cousiño-Macul Carmenère Antiguas Reservas, Chile — $24 (entry)
- 2021 Almaviva Cabernet-Carmenère blend, Chile — $115 (premium)
- 2022 Alamos Malbec, Mendoza — $18 (entry)

*Italian varieties / non-Barolo (10 SKUs):*
- 2021 Antinori Pèppoli Chianti Classico, Tuscany — $28 (entry)
- 2019 Badia a Coltibuono Chianti Classico Riserva, Tuscany — $48 (mid)
- 2018 Casanova di Neri Brunello di Montalcino, Tuscany — $95 (premium)
- 2020 Zenato Amarone della Valpolicella, Veneto — $82 (premium)
- 2020 Dal Forno Romano Amarone, Veneto — $285 (collector)
- 2022 Vermentino di Sardegna, Sardinia — $22 (entry)
- 2021 Benanti Etna Rosso (Nerello Mascalese), Sicily — $44 (mid)
- 2022 Valle dell'Acate Cerasuolo di Vittoria (Nero d'Avola blend), Sicily — $28 (entry)
- 2021 Umani Ronchi Cumaro Conero Riserva (Montepulciano), Marche — $34 (entry)
- 2020 Gaja Sori Tildìn Barbaresco, Piedmont — $320 (collector)

*Spanish varieties (8 SKUs):*
- 2019 La Rioja Alta Viña Ardanza Reserva, Rioja — $38 (mid)
- 2018 Muga Prado Enea Gran Reserva, Rioja — $58 (mid)
- 2020 Clos Mogador Priorat (Garnacha/Cariñena), Catalonia — $88 (premium)
- 2022 Txomin Etxaniz Txakoli, Basque Country — $22 (entry)
- 2022 Do Ferreiro Albariño, Rías Baixas, Galicia — $32 (entry)
- 2022 Naia Verdejo, Rueda — $19 (entry)
- 2018 Pingus, Ribera del Duero — $350 (collector)
- 2021 Bodegas Muga Rosado, Rioja — $24 (entry)

*White Burgundy / White Bordeaux (6 SKUs):*
- 2021 Joseph Drouhin Puligny-Montrachet, Burgundy — $98 (premium)
- 2020 Domaine Leflaive Puligny-Montrachet 1er Cru — $195 (collector)
- 2019 Corton-Charlemagne Grand Cru, Burgundy — $245 (collector)
- 2021 Chassagne-Montrachet Villages, Burgundy — $78 (premium)
- 2020 Château Smith Haut Lafitte Blanc, Pessac-Léognan — $88 (premium)
- 2022 Domaine Leflaive Mâcon-Verzé — $42 (mid)

*Dessert / Fortified / Orange (4 SKUs):*
- 2021 Château d'Yquem Sauternes, Bordeaux — $285 (collector)
- NV Graham's Six Grapes Reserve Port, Portugal — $28 (entry)
- 2017 Quinta do Crasto Vintage Port, Portugal — $65 (mid)
- 2021 Pheasant's Tears Rkatsiteli Orange Wine, Georgia — $34 (entry)

**SKU-level jitter:**
- `sell_through_velocity`: `random.uniform(tier_min, tier_max) * random.gauss(1.0, 0.18)` — produces fast and slow movers within each tier
- `margin`: `random.uniform(tier_min, tier_max)`
- `rating`: `clip(random.gauss(tier_mean, 0.25), 1.0, 5.0)` — tier means: entry 3.85, mid 4.20, premium 4.55, collector 4.72
- `review_count`: lognormal — entry mean 84 sd 40, collector mean 12 sd 8
- `price`: within tier, rounded to nearest dollar, no two SKUs at identical price

**Named SKUs (fixed, no jitter applied):**

| SKU ID | Name | Price | Qty | Vel/day | Days supply | Status |
|--------|------|-------|-----|---------|-------------|--------|
| SKU-042 | 2021 Château Dupont Bordeaux AC | $48 | 118 | 0.80 | 147 | Overstock |
| SKU-017 | 2022 Anderson Valley Pinot Noir | $29 | 134 | 1.19 | 112 | Overstock |
| SKU-058 | 2019 Napa Reserve Cabernet | $95 | 29 | 0.30 | 98 | Overstock |
| SKU-031 | 2020 Barolo Riserva DOCG | $145 | 27 | 0.15 | 18 | Low stock |
| SKU-009 | NV Cava Brut | $22 | 0 | 2.10 | 0 | Out of stock |

**Co-purchase pairs for `get_frequently_bought_together` (expanded):**

| SKU A | SKU B | Co-purchase rate | Bundle rationale |
|-------|-------|-----------------|-----------------|
| SKU-042 (Bordeaux AC) | Chambolle-Musigny Pinot Noir | 0.31 | Classic Left Bank + Burgundy pairing |
| SKU-031 (Barolo) | Langhe Nebbiolo | 0.44 | Regional progression — gateway to Barolo |
| Anderson Valley Pinot | Willamette Valley Pinot | 0.28 | Same varietal, different New World terroir |
| Cornas Syrah | Côte-Rôtie | 0.36 | Northern Rhône vertical exploration |
| Miraval Rosé | Whispering Angel Rosé | 0.41 | Provence comparison — popular gift set |
| Chianti Classico | Brunello di Montalcino | 0.29 | Tuscan Sangiovese progression |
| Trimbach Riesling | Hugel Gewurztraminer | 0.38 | Alsace white flight — food pairing buyers |
| Bollinger Champagne | Taittinger Brut Rosé | 0.33 | Celebration pairing |
| Zuccardi Malbec | Achaval Ferrer Malbec | 0.35 | Mendoza terroir comparison |
| La Rioja Alta Ardanza | Muga Prado Enea Gran Reserva | 0.31 | Rioja Reserva vs. Gran Reserva |
| Châteauneuf-du-Pape | Crozes-Hermitage | 0.27 | Rhône North vs. South exploration |
| Egon Müller Riesling | Dönnhoff Riesling Spätlese | 0.34 | Mosel Riesling comparison — Collector pair |

---

## Domain 2: Customer Data & Segmentation

### `get_customer_profile`

**Purchase history generation:**

Order count drawn per customer using jitter:
```python
order_count_samplers = {
    "Loyalist":   lambda: int(clip(random.gauss(13, 4), 4, 28)),
    "Collector":  lambda: int(clip(random.gauss(5, 2), 2, 14)),
    "Explorer":   lambda: int(clip(random.gauss(7, 3), 2, 18)),
    "Gifter":     lambda: int(clip(random.gauss(4, 2), 1, 12)),
    "DealSeeker": lambda: int(clip(random.gauss(6, 3), 2, 16)),
}
```

SKU selection per order is biased but not deterministic:
- 65% of orders pull from `preferred_varietal` SKUs (coherence)
- 35% pull from `secondary_varietal` or random (realism — people try new things)
- `price_sensitivity` weights toward lower-priced SKUs within the chosen varietal

Order dates walk backward from today using `jitter_inter_purchase_days()`. Gifters additionally have their order dates clustered ±6 days around Nov 20, Feb 8, and May 8.

**Email engagement:** Apply `jitter_open_rate()` and derive CTR as above. `last_open_date` uses:
- Active: `today - Exponential(mean=8 days)` — most opened recently
- At-risk: `today - Uniform(30, 75 days)`
- Lapsed: `today - Uniform(75, 180 days)`
- Churned: `today - Uniform(180, 540 days)`

**Unsubscribed customers:** ~4% of list (40 customers). Weighted toward churned/lapsed, but 6–8 active customers included (real-world pattern: active subscribers sometimes opt out after one bad email).

**Propensity scores:** Apply `jitter_propensity()` with these persona baselines, then add a `days_since_last_purchase` boost to churn:

| Propensity | Loyalist | Explorer | Gifter | Deal Seeker | Collector |
|------------|---------|---------|--------|-------------|-----------|
| Upsell | 0.68 | 0.44 | 0.31 | 0.18 | 0.55 |
| Churn | 0.14 | 0.28 | 0.35 | 0.48 | 0.12 |
| Reactivation | 0.22 | 0.38 | 0.45 | 0.55 | 0.20 |

```python
# Churn boost from recency gap
churn += clip((days_since_last_purchase - 30) / 200, 0, 0.45)
```

### `get_rfm_scores`

Computed deterministically from purchase history. Tier boundaries use actual quintiles of the 1,000-customer dataset (not fixed thresholds) to ensure all tiers are populated. Boundary jitter applied:

```python
# Customers near a tier boundary get ±0.5 nudge from N(0, 0.3)
# Prevents all Champions from having identical composite scores
```

**Expected tier distribution at 1,000 customers:**

| Tier | Count | % |
|------|-------|---|
| Champions | 108 | 11% |
| Loyal | 154 | 15% |
| Potential | 142 | 14% |
| At Risk | 198 | 20% |
| Lost | 94 | 9% |
| New | 174 | 17% |
| Lapsed/Churned | 130 | 13% |

### `get_clv_estimates`

Apply `jitter_clv()` to each customer. Confidence intervals:
```python
clv_lower = clv * random.uniform(0.62, 0.78)
clv_upper = clv * random.uniform(1.28, 1.58)
# Newer customers (< 6 months tenure) get wider intervals: ×0.50 lower, ×1.80 upper
```

`predicted_next_purchase_date`:
```python
base_days = jitter_inter_purchase_days(persona_base_days)
predicted_date = last_purchase_date + timedelta(days=base_days)
predicted_date += timedelta(days=int(random.gauss(0, 5)))  # ±5 days placement noise
```

### `get_customer_segments`

**12 pre-built segments, scaled to 1,000 customers:**

| Segment ID | Name | Count | Target persona | Key rule |
|------------|------|-------|----------------|----------|
| seg-001 | Bordeaux Loyalists | 138 | Loyalist | preferred_varietal=Bordeaux, purchase_count≥3 |
| seg-002 | Barolo Enthusiasts | 94 | Loyalist + Collector | preferred_varietal=Barolo, clv≥$500 |
| seg-003 | Natural Wine Explorers | 156 | Explorer | natural_wine_purchases≥2 |
| seg-004 | Holiday Gifters | 218 | Gifter | seasonal_purchase_ratio≥0.6 |
| seg-005 | High CLV Champions | 108 | Collector + Loyalist | rfm_tier=Champions, clv≥$1,000 |
| seg-006 | Lapsed Loyalists 60d | 89 | Loyalist | last_purchase_days≥60, purchase_count≥4 |
| seg-007 | Deal Seekers Active | 134 | Deal Seeker | discount_order_ratio≥0.6, lifecycle=active |
| seg-008 | Churn Risk | 104 | Mixed | churn_probability≥0.65 |
| seg-009 | New Arrival Prospects | 172 | Explorer + Loyalist | high pdp_view_rate, preferred_varietal notNull |
| seg-010 | Premium Upsell Ready | 81 | Explorer → Loyalist | avg_order_value $45–75, upsell_propensity≥0.7 |
| seg-011 | Pre-order Eligible | 72 | Collector | clv≥$1,500, collector_tier_purchases≥2 |
| seg-012 | Bundle Candidates | 143 | Explorer + Gifter | bought component A, not component B |

**Segment overlap distribution:**
- 1 segment only: 35% of customers
- 2 segments: 40%
- 3 segments: 18%
- 4+ segments: 7% (highest-value customers)

### `get_churn_risk_list`

~175 customers with churn_probability ≥ 0.50. Distribution:
- 0.50–0.60: ~60 customers (borderline)
- 0.60–0.75: ~75 customers (at risk)
- 0.75–0.90: ~30 customers (high risk)
- 0.90–1.00: ~10 customers (near-certain)

`days_since_last_purchase` jitter within each band:
```python
# 0.75–0.90 band: random.uniform(80, 140)
# 0.60–0.75 band: random.uniform(55, 110)
# 0.50–0.60 band: random.uniform(40, 90)
```

`recommended_action` varies by persona: Loyalists → `"new_arrival_email"`, Explorers → `"educational_content"`, Deal Seekers → `"discount_offer"`, Gifters → `"seasonal_reminder"`.

### `get_high_intent_customers`

Signal counts use `jitter_event_count()`:

| Signal | Customer count | Signal count range |
|--------|---------------|-------------------|
| repeated_pdp | ~90 | randint(3, 11) per customer |
| cart_abandon | ~60 | randint(1, 4) |
| wishlist_view | ~45 | randint(2, 8) |
| deep_scroll | ~110 | randint(1, 5) |

~40 customers appear in 2+ signal types. ~12 appear in 3+ — these skew toward Loyalists and Collectors with high CLV.

---

## Domain 5: Analytics & Attribution

### `get_performance_summary`

Generate 90 days of **daily** data (agents aggregate to any window). Per-day jitter:

```python
base_daily_revenue = 13000 / 7  # midpoint of weekly range

dow_multipliers = {
    Mon: 0.85, Tue: 0.80, Wed: 0.88, Thu: 0.95,
    Fri: 1.18, Sat: 1.42, Sun: 1.12
}  # weekend-weighted — realistic for wine retail

trend_factor = 1 + (day_index / 90) * 0.12  # slight upward slope
noise = random.gauss(1.0, 0.12)              # ±12% daily variance
promo_factor = 1.55 if is_promo_day else 1.0

daily_revenue = base_daily_revenue * dow_multipliers[dow] * trend_factor * noise * promo_factor
```

**Channel share daily jitter:**
```python
email_share = base_email_share + random.gauss(0, 0.04)   # ±4% daily
paid_share  = base_paid_share  + random.gauss(0, 0.03)   # ±3% daily
# Paid and organic shares slightly inversely correlated (finite demand)
```

### `detect_anomalies`

Three hard-coded anomalies with **gradual shape** — not a cliff:

**Anomaly 1 — Email deliverability drop (7 days ago):**
```
Day -10: 0.38  Day -9: 0.35  Day -8: 0.31  Day -7: 0.16 (cliff)
Day -6:  0.14  Day -5: 0.19  Day -4: 0.28  Day -3: 0.34 (recovered)
```

**Anomaly 2 — Mobile cart abandon spike (14 days ago):**
```
Normal: 0.58 ± 0.04 daily jitter
Spike: 0.74 → held 2 days at 0.71–0.74 → resolved
```

**Anomaly 3 — Paid ROAS dip (21 days ago, resolved):**
```
Normal: 3.8 ± 0.3 daily jitter
Dip: 2.1 → held 7 days → recovered to 3.6
```

---

## Domain 6: Personalization & Recommendations

### `get_recommendations`

Affinity scores computed with per-customer noise:
```python
base_score = (0.4 * varietal_match) + (0.3 * region_match) +
             (0.2 * price_tier_match) + (0.1 * collaborative_filter)
score = clip(base_score + random.gauss(0, 0.05), 0.01, 0.99)
```

Top recommendation vs. rank 10 should differ by 0.25–0.45 affinity score. Flat scores across all 10 indicate missing jitter.

`signal_sources` varies by purchase history depth:
- 8+ orders: `["purchase_history", "varietal_affinity", "collaborative_filter"]`
- 3–7 orders: `["purchase_history", "collaborative_filter"]`
- 1–2 orders: `["collaborative_filter", "similar_buyers"]`
- New: `["similar_buyers", "trending"]`

### `get_trending_products`

```python
pct_change = ((current_7d_velocity - prior_7d_velocity) / prior_7d_velocity) * 100
pct_change += random.gauss(0, 3.5)  # avoids round trending numbers
```

SKU-031 (Barolo) is hard-coded at +68% — driven by blog traffic.

---

## Domain 7: Behavioral Events

### `get_search_query_report`

```python
# Apply Poisson noise to all counts — no perfectly round numbers
actual_count = base_count + random.randint(-8, 12)
zero_result_count = base_zero_count + random.randint(-5, 8)
```

CTR and purchase rate vary by query intent:
- Transactional ("bordeaux under $50"): CTR `Uniform(0.65, 0.82)`, purchase rate `Uniform(0.16, 0.28)`
- Informational ("pinot noir food pairing"): CTR `Uniform(0.22, 0.38)`, purchase rate `Uniform(0.03, 0.10)`

### Session metrics

Apply `jitter_event_count()` to every count field per session. Continuous metrics:
```python
scroll_depth = clip(random.gauss(persona_base_scroll, 0.14), 0.05, 1.0)
dwell_time   = max(8, int(random.gauss(persona_base_dwell, persona_base_dwell * 0.35)))
```

**Persona baseline session behavior (means — actual values drawn from distributions around these):**

| Metric | Loyalist | Explorer | Gifter | Deal Seeker | Collector |
|--------|----------|---------|--------|-------------|-----------|
| Pages/session | 6.2 | 7.8 | 4.1 | 3.9 | 5.4 |
| PDP views/session | 2.8 | 3.4 | 1.6 | 2.1 | 2.2 |
| Avg scroll depth | 0.72 | 0.68 | 0.48 | 0.52 | 0.81 |
| Avg dwell time (sec) | 142 | 168 | 94 | 88 | 198 |
| Sessions last 30d | 3.8 | 4.2 | 1.4 | 2.6 | 2.9 |

---

## Domain 2: Customer Data & Segmentation (continued)

### `get_product_affinity` — pre-computed per customer

The sample data plan covers recommendations via affinity scoring, but `get_product_affinity` has a slightly different shape — it returns `signal_sources` per SKU recommendation and is scoped to a specific customer requesting their top-N SKUs. The underlying data is the same recommendation dataset; ensure each customer's record includes:
- `affinity_score` per SKU (0–1, jittered as described)
- `signal_sources` array varying by purchase history depth (see recommendations section)
- `exclude_purchased` flag correctly removes already-owned SKUs from results

No additional data generation needed beyond what the recommendations dataset provides — just ensure the MCP server's `get_product_affinity` handler reads from the same recommendations JSON.

### `is_suppressed` — pre-populated suppression list

Generate **80 suppression records** covering three scenarios:

**Post-purchase suppressions (campaign-scoped, 50 records):**
- Customers who purchased a featured SKU during a simulated past campaign
- `reason: "purchased"`, `campaign_id: [one of the pre-built campaign IDs]`
- `expires_at`: 30 days from a simulated purchase date within the last 60 days
- Spread across 40 unique customers, some with 2 campaign suppressions

**Global unsubscribes (permanent, 22 records):**
- The same ~40 customers flagged as `unsubscribed: true` in customer profiles
- `reason: "unsubscribed"`, no `campaign_id`, no `expires_at`
- `is_suppressed` should return `true` for these customers in any campaign context

**Complaint suppressions (permanent, 8 records):**
- `reason: "complaint"`, global scope
- Distributed across Deal Seekers and churned customers

---

## Domain 3: Campaign & Content Management

Domain 3 is the most complex to pre-populate because many of its functions are write-oriented — agents create briefs, content, and requests at runtime. The read functions below need pre-existing data for the prototype to be meaningful from the first run.

### `get_brand_guidelines`

One static document. Define the fictional store's brand voice:

```json
{
  "voice": {
    "descriptors": ["knowledgeable", "approachable", "never pretentious",
                    "honest about quality", "enthusiastic but not breathless"],
    "persona": "A trusted friend who happens to know a lot about wine — someone who gives you their genuine opinion, not a sales pitch."
  },
  "tone": {
    "by_channel": [
      { "channel": "email", "tone_notes": "Warm and direct. Lead with the wine story, not the offer. Subject lines that reward the open." },
      { "channel": "instagram", "tone_notes": "Visual storytelling first. Caption is secondary. Hashtags are functional, not decorative." },
      { "channel": "paid_search", "tone_notes": "Clear value proposition. Varietal and region in headline. Occasion or price point in description." },
      { "channel": "pdp", "tone_notes": "Tasting notes first, food pairing second, wine geek context third. No superlatives without specifics." }
    ]
  },
  "style": {
    "preferred_terms": ["drinking window", "terroir", "old vines", "grower", "négociant", "appellation"],
    "prohibited_terms": ["smooth", "oaky" (as a positive), "pairs well with chicken", "perfect for any occasion", "world-class"],
    "oxford_comma": true,
    "capitalization_rules": "Varietal names capitalised (Pinot Noir, Chardonnay). Region names capitalised (Burgundy, Napa Valley). 'wine' lowercase always."
  },
  "visual": {
    "primary_colors": ["#2C1810", "#8B4513", "#F5F0E8", "#4A7C59"],
    "font_families": ["Freight Display Pro", "Freight Text Pro"],
    "logo_usage_url": "https://assets.example-wine-store.com/brand/logo-guidelines.pdf"
  }
}
```

### `get_seasonal_calendar`

Generate **18 calendar events** for the current year covering the full wine marketing calendar:

| Event ID | Name | Category | Month | Lead time | Featured varietals | Campaign angle |
|----------|------|----------|-------|-----------|-------------------|----------------|
| evt-001 | Valentine's Day | gifting | Feb 14 | 21 days | Sparkling, Rosé, Pinot Noir | Gift-giving, romance, sharing |
| evt-002 | Spring Wine Release | harvest | Mar 15 | 14 days | Natural/Biodynamic, Rosé | Fresh releases, seasonal transition |
| evt-003 | Mother's Day | gifting | May 12 | 21 days | Rosé, Sparkling, Chardonnay | Gift-giving, celebration |
| evt-004 | Memorial Day Weekend | holiday | May 27 | 14 days | Rosé, Sparkling | Outdoor entertaining, grilling |
| evt-005 | Father's Day | gifting | Jun 16 | 21 days | Cabernet Sauvignon, Barolo, Bordeaux | Gift-giving, premium reds |
| evt-006 | 4th of July | holiday | Jul 4 | 14 days | Sparkling, Rosé | Celebration, American wines |
| evt-007 | Summer Rosé Season | harvest | Jul–Aug | 7 days | Rosé, Natural wines | Warm weather, outdoor |
| evt-008 | Harvest Season Begins | harvest | Sep 1 | 7 days | All reds | Vintage narrative, cellar building |
| evt-009 | Beaujolais Nouveau | regional | Nov 21 | 14 days | Gamay/Beaujolais | Annual tradition, easy drinking |
| evt-010 | Thanksgiving | holiday | Nov 28 | 21 days | Pinot Noir, Chardonnay, Riesling | Food pairing, gathering |
| evt-011 | Black Friday / Cyber Monday | holiday | Nov 29–Dec 2 | 7 days | All | Promotional, gifting |
| evt-012 | Holiday Gifting Season | gifting | Dec 1–24 | 30 days | Champagne, Barolo, Cabernet | Gift-giving peak, premium |
| evt-013 | New Year's Eve | holiday | Dec 31 | 14 days | Champagne, Sparkling | Celebration, luxury |
| evt-014 | Dry January Recovery | industry | Jan 15 | 7 days | Natural/low-alc | Mindful drinking |
| evt-015 | Super Bowl Weekend | holiday | Feb 9 | 10 days | Cabernet Sauvignon, Rosé | Entertaining, casual |
| evt-016 | Spring Futures/Pre-order | harvest | Feb–Mar | 30 days | Barolo, Bordeaux, Burgundy | Allocation, cellar investment |
| evt-017 | Earth Day / Natural Wine | industry | Apr 22 | 14 days | Natural/Biodynamic | Sustainability, terroir |
| evt-018 | Bastille Day | regional | Jul 14 | 10 days | Burgundy, Champagne, Loire | French wine celebration |

### `get_seo_keyword_targets`

Generate **80 keyword targets** across the 15 varietal families and key occasion terms. Sample structure with jitter on `monthly_search_volume` and `current_ranking_position`:

**Transactional keywords (40):**

| Keyword | Monthly volume | Difficulty | Ranking | Intent | Content type |
|---------|---------------|------------|---------|--------|--------------|
| buy barolo wine online | 1,200 | 42 | 8 | transactional | collection_page |
| bordeaux wine under $50 | 2,800 | 38 | 4 | transactional | collection_page |
| best pinot noir under $40 | 3,400 | 51 | null | transactional | collection_page |
| natural wine delivery | 1,800 | 35 | 12 | transactional | collection_page |
| champagne gift ideas | 5,600 | 62 | null | transactional | product_page |
| barolo wine buy | 940 | 44 | 6 | transactional | product_page |
| rioja reserva online | 780 | 31 | 15 | transactional | collection_page |
| albariño wine buy | 620 | 28 | null | transactional | product_page |
| prosecco delivery | 4,200 | 55 | 18 | transactional | product_page |
| malbec wine online | 2,100 | 40 | 9 | transactional | collection_page |

**Informational keywords (40):**

| Keyword | Monthly volume | Difficulty | Ranking | Intent | Content type |
|---------|---------------|------------|---------|--------|--------------|
| what is barolo wine | 8,400 | 48 | 3 | informational | blog_post |
| barolo vs barbaresco | 3,200 | 44 | 7 | informational | blog_post |
| pinot noir food pairing | 9,800 | 52 | 11 | informational | guide |
| natural wine vs organic wine | 4,100 | 38 | 5 | informational | blog_post |
| bordeaux wine regions explained | 3,800 | 46 | 14 | informational | guide |
| how to store riesling | 2,200 | 31 | null | informational | blog_post |
| barolo drinking window 2018 | 1,400 | 29 | 2 | informational | blog_post |
| champagne vs prosecco difference | 11,200 | 58 | 21 | informational | blog_post |
| what is orange wine | 6,800 | 44 | 8 | informational | blog_post |
| malbec vs cabernet sauvignon | 4,600 | 41 | null | informational | blog_post |

Apply jitter to `monthly_search_volume`: `actual = base + random.gauss(0, base * 0.12)` rounded to nearest 10.
Apply jitter to `current_ranking_position`: `actual = base + random.randint(-2, 3)` where not null.

### `get_campaign_briefs`

Pre-build **6 campaign briefs** covering a range of statuses and types. These give agents something meaningful to read on first run rather than an empty database:

| Campaign ID | Name | Type | Status | Channels | Featured SKU | Segment |
|-------------|------|------|--------|----------|-------------|---------|
| camp-001 | Bordeaux Clearance Spring | promotion | completed | email, paid, social | SKU-042 | seg-007 (Deal Seekers) |
| camp-002 | Barolo Limited Allocation | limited_allocation | completed | email, social | SKU-031 | seg-002 (Barolo Enthusiasts) |
| camp-003 | Holiday Gifting 2024 | seasonal | completed | email, paid, social | Multiple | seg-004 (Holiday Gifters) |
| camp-004 | Lapsed Loyalist Winback Q1 | winback | completed | email | SKU-042 | seg-006 (Lapsed Loyalists) |
| camp-005 | Natural Wine Education Series | educational | active | email, seo | Natural/Biodynamic SKUs | seg-003 (Natural Explorers) |
| camp-006 | Barolo Pre-order 2024 Vintage | pre_order | draft | email, social | SKU-031 family | seg-011 (Pre-order Eligible) |

The 4 completed campaigns are essential — they feed `get_campaign_retrospective`, `get_performance_summary` with `campaign_id` scope, `get_attribution_report`, and `get_email_metrics` with `send_id` references. Without completed campaigns, the Analytics Agent has nothing to retrospect and Campaign Strategy has no learnings to read.

### `get_campaign_retrospective`

Generate **4 retrospective records** (one per completed campaign above):

Each retrospective should contain:
- `summary`: 2–3 sentences on campaign outcome
- `metrics`: actual KPIs vs targets (use performance data below)
- `learnings`: 3–4 bullet points that give future Campaign Strategy runs useful signal

**camp-001 (Bordeaux Clearance) key learnings:**
- Email drove 2.1× higher conversion than paid for this SKU and segment
- Day-3 reminder to non-openers produced 34% of total email revenue
- discount_pct of 15% was the inflection point — 10% tested underperformed significantly

**camp-002 (Barolo Limited Allocation) key learnings:**
- Tier-1 CLV-first send strategy worked: top 20% of recipients converted at 18%
- Second wave to broader segment still converted at 9% — allocation ceiling was the constraint
- No discount needed; scarcity copy outperformed price-led copy in A/B test

**camp-003 (Holiday Gifting) key learnings:**
- Social drove 22% of gift orders — highest social share of any campaign
- Gifter segment AOV was $112 vs. $78 baseline — gift framing successfully raised spend
- Paid prospecting CPA was $28 — highest ROI channel for new customer acquisition

**camp-004 (Winback) key learnings:**
- Reactivation rate of 14% (email → purchase within 30 days) — above industry benchmark
- Free shipping offer outperformed 10% discount for Loyalist winback
- Customers reactivated by this campaign had 2.1× higher 90-day retention than non-winback actives

### `get_content_assets`

Generate content assets for the 2 active/draft campaigns (camp-005 and camp-006) plus 1 completed campaign still in the MCP (camp-001). Each asset needs `asset_id`, `channel`, `asset_type`, `content`, `status`, and `sku_id`:

**camp-005 (Natural Wine Education — active):** Generate 4 approved assets:
- Email subject line A: `"The wine your sommelier won't stop talking about"`
- Email subject line B: `"Natural wine: what it actually means"`
- Email body: ~200-word placeholder with blog article CTA
- Blog post draft: 1,200-word article on natural vs. organic vs. biodynamic — `status: "approved"`

**camp-006 (Barolo Pre-order — draft):** Generate 3 draft assets:
- Email subject line: `"Reserve your 2024 Barolo before it arrives"` — `status: "draft"`
- Instagram caption draft — `status: "draft"`
- PDP short_description — `status: "draft"`

### `get_content_requests`

Generate **5 pre-populated content requests** representing work the SEO Agent has already submitted:

```json
[
  { "request_id": "cr-001", "requesting_command": "seo", "content_type": "blog_post",
    "topic": "What is orange wine? A guide for skeptics",
    "target_keywords": ["what is orange wine", "orange wine flavor", "orange wine vs white wine"],
    "status": "pending", "priority": "high",
    "rationale": "89 zero-result searches in last 30 days; no catalog coverage yet" },
  { "request_id": "cr-002", "requesting_command": "seo", "content_type": "guide",
    "topic": "Barolo drinking windows by vintage: 2015–2022",
    "target_keywords": ["barolo drinking window", "when to drink barolo", "barolo vintage guide"],
    "status": "pending", "priority": "high",
    "rationale": "blog post already driving 38% PDO click rate; guide would capture higher intent" },
  { "request_id": "cr-003", "requesting_command": "seo", "content_type": "blog_post",
    "topic": "Albariño: the best summer white you're not drinking",
    "target_keywords": ["albariño wine", "galicia white wine", "best summer white wine"],
    "status": "accepted", "priority": "medium" },
  { "request_id": "cr-004", "requesting_command": "seo", "content_type": "collection_page",
    "topic": "Rhône Valley wines collection page refresh",
    "target_keywords": ["rhone valley wine", "syrah wine", "chateauneuf du pape buy"],
    "status": "pending", "priority": "medium" },
  { "request_id": "cr-005", "requesting_command": "inventory-sync", "content_type": "campaign_request",
    "topic": null, "sku_ids": ["SKU-042"],
    "reason": "Overstock — 147 days of supply at 0.80 units/day",
    "suggested_campaign_type": "promotion", "status": "pending", "priority": "high" }
]
```

### `get_campaign_requests`

Generate **3 pre-populated campaign requests** (the inter-agent coordination queue). This is what the Campaign Strategy Agent will find waiting on its first run:

```json
[
  { "request_id": "req-001", "type": "campaign_request",
    "requesting_command": "inventory-sync", "status": "pending", "priority": "high",
    "campaign_type": "promotion",
    "sku_ids": ["SKU-042"],
    "reason": "Overstock — 147 days of supply. 312 PDP views in last 7 days.",
    "suggested_discount_pct": 15,
    "behavioral_interest": { "pdp_views": 312, "wishlist_adds": 18, "cart_adds": 24 } },
  { "request_id": "req-002", "type": "campaign_request",
    "requesting_command": "inventory-sync", "status": "pending", "priority": "urgent",
    "campaign_type": "limited_allocation",
    "sku_ids": ["SKU-031"],
    "reason": "High intent (847 PDP views, 41% view-to-cart) but only 27 bottles remaining",
    "suggested_campaign_type": "limited_allocation",
    "behavioral_interest": { "pdp_views": 847, "wishlist_adds": 44, "cart_adds": 61 } },
  { "request_id": "req-003", "type": "campaign_request",
    "requesting_command": "human", "status": "pending", "priority": "high",
    "campaign_type": "pre_order",
    "sku_description": "2024 Barolo vintage — arriving in 8 weeks",
    "suggested_channels": ["email", "social"],
    "target_audience_description": "Barolo enthusiasts and Collectors",
    "desired_start_date": "[2 weeks from today]" }
]
```

### `get_content_approval_queue`

Generate **8 approval queue entries** across the active campaigns — a realistic snapshot of work awaiting human review:

```json
[
  { "asset_id": "asset-101", "campaign_id": "camp-005", "channel": "email",
    "asset_type": "subject_line", "variant_label": "A",
    "content_preview": "The wine your sommelier won't stop talking about",
    "status": "pending_review" },
  { "asset_id": "asset-102", "campaign_id": "camp-005", "channel": "email",
    "asset_type": "subject_line", "variant_label": "B",
    "content_preview": "Natural wine: what it actually means",
    "status": "pending_review" },
  { "asset_id": "asset-103", "campaign_id": "camp-005", "channel": "seo",
    "asset_type": "blog_post",
    "content_preview": "Natural vs. organic vs. biodynamic — a 1,200-word guide...",
    "status": "approved" },
  { "asset_id": "asset-104", "campaign_id": "camp-006", "channel": "email",
    "asset_type": "subject_line", "variant_label": "A",
    "content_preview": "Reserve your 2024 Barolo before it arrives",
    "status": "pending_review" },
  { "asset_id": "asset-105", "campaign_id": "camp-006", "channel": "instagram",
    "asset_type": "social_caption",
    "content_preview": "The 2024 harvest in Piedmont was exceptional. 24 cases...",
    "status": "pending_review" }
]
```

### `get_creative_assets`

Generate **24 creative asset records** (image URLs) across the pre-built campaigns. These simulate uploaded images already in the system. Each record needs `asset_id`, `campaign_id`, `asset_type`, `url`, `dimensions`, `status`, and `tags`:

Generate 4–6 assets per completed campaign (status: `"approved"`) and 2–3 per active/draft campaign (status: `"pending_review"` or `"approved"`). Asset types: `"product_shot"`, `"lifestyle"`, `"occasion"`, `"email_hero"`, `"social_square"`.

Use placeholder URL format: `https://assets.example-wine-store.com/campaigns/[campaign_id]/[asset_id].jpg`

---

## Domain 4: Channel Execution

### `get_email_metrics`

Generate **12 email send records** — 3 per completed campaign. Each needs a `send_id` (referenced in campaign brief records) and full metrics. Apply jitter:

```python
# Per send record:
sent_count = segment_size  # from get_customers_in_segment
delivered_rate = random.uniform(0.962, 0.991)  # realistic deliverability
open_rate = jitter_open_rate(campaign_type_baseline, engagement_modifier_avg, ...)
ctr = open_rate * random.uniform(0.10, 0.22)
conversion_rate = ctr * random.uniform(0.08, 0.28)  # varies by campaign type
revenue_attributed = conversion_rate * sent_count * random.gauss(aov, aov * 0.2)
unsubscribe_rate = random.uniform(0.001, 0.006)
bounce_rate = random.uniform(0.008, 0.024)
spam_complaint_rate = random.uniform(0.0001, 0.0008)
```

**Baseline open rates by campaign type (before jitter):**
- promotion: 0.24
- limited_allocation: 0.38 (higher — exclusive access framing)
- winback: 0.19
- educational: 0.28

Ensure the 3 sends per campaign show realistic progression (e.g. day-1 send → day-3 reminder to non-openers shows lower send count but similar open rate; final urgency send shows highest conversion rate).

### `get_social_metrics`

Generate **4 platform × 4 time period records** = 16 social metrics records. Cover Instagram, Facebook, Pinterest, and TikTok for the last 30 days. Apply per-platform jitter:

```python
platform_baselines = {
    "instagram": {"followers": 12400, "engagement_rate": 0.038, "impressions": 28000},
    "facebook":  {"followers": 8200,  "engagement_rate": 0.021, "impressions": 18000},
    "pinterest": {"followers": 3100,  "engagement_rate": 0.055, "impressions": 41000},
    "tiktok":    {"followers": 2800,  "engagement_rate": 0.082, "impressions": 52000},
}
# Apply: actual = baseline * random.gauss(1.0, 0.12) for each metric
```

`follower_delta` should show slow organic growth (0.5–1.8% per month) with slight variance.

`top_posts` should include 3–5 posts per platform with varying engagement rates — ensure at least one post clearly outperforms others (2.5–4× average engagement) to give Social Media Agent a learning signal.

### `get_paid_metrics`

Generate paid campaign performance records for all 3 platforms across the 4 completed campaigns. Key values to include, with per-campaign jitter:

```python
# Per platform × campaign:
spend = campaign_budget * channel_share * random.gauss(1.0, 0.08)
roas = base_roas * random.gauss(1.0, 0.15)  # base varies by campaign type
ctr = base_ctr * random.gauss(1.0, 0.12)
cpa = spend / max(conversions, 1)

# Campaign type ROAS baselines:
# promotion:          google 3.8, meta 2.9
# limited_allocation: google null (no paid), meta null (no paid)
# seasonal:           google 2.8, meta 2.1, pinterest 1.9
# winback:            no paid campaigns (email-only)
```

Ensure `source_campaign_id` correctly maps each paid campaign record back to the internal `campaign_id` — this is what `get_paid_metrics(source_campaign_id: "camp-001")` queries.

---

## Domain 5: Analytics & Attribution (continued)

### `get_product_performance`

Generate performance records for all **120 SKUs** covering the last 90 days. Derive from purchase history:

```python
# Per SKU:
units_sold = count purchases of this SKU across all customers in last 90 days
revenue = sum(purchase_totals) for this SKU
avg_order_value_when_purchased = revenue / orders_containing_this_sku
view_to_cart_rate = cart_adds / pdp_views  # from behavioral data
pdp_views = sum from sku_behavioral_metrics

# Jitter on velocity metrics:
units_sold += random.randint(-2, 3)  # slight count noise
```

The resulting data should show:
- SKU-031 (Barolo): low `units_sold` rank (limited stock) but highest `view_to_cart_rate` (0.41)
- SKU-042 (Bordeaux overstock): low `units_sold` relative to inventory, flagging clearance need
- Top 5 SKUs by revenue dominated by Collector-tier wines despite lower unit counts
- Top 5 by unit volume dominated by entry-tier SKUs

### `get_cohort_retention`

Fully specify **8 monthly cohorts** (not just mention them). Each cohort needs per-month retention rates:

| Cohort | Month 0 | Month 1 | Month 2 | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|---------|---------|---------|---------|
| Organic search | 100% | 78% | 64% | 52% | 38% | 28% |
| Paid search | 100% | 71% | 57% | 44% | 29% | 18% |
| Social | 100% | 58% | 42% | 31% | 18% | 9% |
| Referral | 100% | 82% | 69% | 57% | 42% | 31% |
| Direct | 100% | 85% | 72% | 61% | 46% | 34% |

Apply jitter: each cell gets `actual = base * random.gauss(1.0, 0.04)` — enough to make adjacent cohorts look different without inverting the acquisition channel ranking.

### `get_conversion_funnel` — device and traffic source breakdown

The funnel steps are defined in the Domain 5 section above. Add the device-type breakdown that the On-Site Behavior Agent uses for UX analysis:

| Step | Desktop completion | Mobile completion | Tablet completion |
|------|-------------------|-------------------|-------------------|
| visit → collection | 72% | 61% | 68% |
| collection → pdp | 64% | 58% | 62% |
| pdp → add_to_cart | 38% | 28% | 34% |
| cart → checkout_start | **72%** | **38%** | 58% |
| checkout_start → complete | 79% | 71% | 76% |

The mobile `cart → checkout_start` step (38% vs. 72% desktop) is the primary UX friction point and should be flagged prominently.

Add `traffic_source` breakdown too:
- `email` traffic: overall conversion 8.2% (highest — pre-qualified intent)
- `paid_search` traffic: overall conversion 5.8%
- `organic_search`: 4.9%
- `paid_social`: 3.2% (lowest — cold audience)
- `direct`: 6.1%

---

## Domain 6: Personalization & Recommendations (continued)

### `get_segment_recommendations`

Pre-compute segment-level recommendation sets for all **12 segments**. Each returns the top 10 SKUs most affine to that segment's member profile. These are used for batch email personalization where per-customer scoring is too slow.

Derive by averaging affinity scores across segment members. Key expectations:
- seg-001 (Bordeaux Loyalists) → top recommendations are Bordeaux blends and Left Bank Bordeaux SKUs
- seg-003 (Natural Explorers) → top recommendations are Natural/Biodynamic and Riesling SKUs
- seg-004 (Holiday Gifters) → top recommendations are Sparkling, Rosé, and Chardonnay
- seg-011 (Pre-order Eligible) → top recommendations are collector-tier Barolo and Burgundy

### `get_collection_page_sort_order`

Define **8 collection pages** with IDs, names, and default sort orders. These are the browsable categories on the store:

| Collection ID | Name | Default sort | SKU count |
|--------------|------|-------------|-----------|
| col-001 | Red Wines | margin_desc | 52 |
| col-002 | White Wines | velocity_desc | 30 |
| col-003 | Sparkling & Champagne | price_desc | 8 |
| col-004 | Rosé | velocity_desc | 8 |
| col-005 | Natural & Biodynamic | new_arrival | 10 |
| col-006 | French Wines | margin_desc | 28 |
| col-007 | Italian Wines | price_desc | 16 |
| col-008 | Gifts Under $50 | price_asc | 18 |

Pre-compute a default `sku_order` for each collection (sorted by `margin_desc` unless otherwise specified). When `customer_id` or `segment_id` is provided, affinity scoring overrides the default order.

---

## Domain 7: Behavioral Events (continued)

### `get_ab_test_results` and `list_ab_tests`

Pre-build **5 A/B test records** across the completed and active campaigns:

| Test ID | Name | Campaign | Page | Element | Status | Winner | Primary metric | Lift |
|---------|------|----------|------|---------|--------|--------|---------------|------|
| test-001 | Bordeaux promo urgency banner | camp-001 | pdp | urgency_banner | complete | variant_a | add_to_cart_rate | +18.3% |
| test-002 | Barolo allocation subject line | camp-002 | — | email subject | complete | variant_a | open_rate | +12.1% |
| test-003 | Holiday gifting homepage hero | camp-003 | homepage | hero_image | complete | variant_b | click_through_rate | +9.4% |
| test-004 | Natural wine blog CTA placement | camp-005 | blog | cta_position | running | null | pdp_click_rate | in progress |
| test-005 | Barolo PDP urgency count | camp-006 | pdp | urgency_banner | running | null | add_to_cart_rate | in progress |

For completed tests, generate full `variant_results` with `sessions`, `primary_metric_value`, `lift_pct`, `p_value`, `is_significant`, and `confidence_interval` — with appropriate jitter on session counts and metric values.

For running tests, populate `sessions` and `primary_metric_value` with partial results (test-004 at 62% of `min_sample_size`, test-005 at 38%) — not yet significant.

### `get_merchandising_rules`

Pre-build active rules for the **8 collection pages**. At minimum:

```json
[
  { "collection_id": "col-001", "rules": [
    { "rule_id": "rule-001", "rule_type": "pin_to_top", "sku_id": "SKU-031",
      "position": 1, "priority": 1,
      "condition": { "behavioral_signal": "high_intent" },
      "expires_at": "[campaign end_date for camp-002]" },
    { "rule_id": "rule-002", "rule_type": "boost", "boost_factor": 1.5,
      "condition": { "behavioral_signal": "trending" }, "priority": 2 },
    { "rule_id": "rule-003", "rule_type": "bury",
      "condition": { "in_stock_only": false }, "priority": 10 }
  ]},
  { "collection_id": "col-005", "rules": [
    { "rule_id": "rule-004", "rule_type": "boost",
      "condition": { "behavioral_signal": "new_arrival" }, "boost_factor": 1.3, "priority": 1 }
  ]}
]
```

### `get_session_summary` — derived_signals field specification

The current plan defines session structure but doesn't specify all the `derived_signals` fields. Ensure per-session records include:

```python
derived_signals = {
    "intent_score":          clip(random.gauss(persona_base_intent, 15), 0, 100),
    "funnel_stage_reached":  computed from highest checkout_step event in session,
    "sku_ids_engaged":       list of unique SKU IDs from pdp_view events,
    "search_queries_used":   list of unique queries from search_query events,
    "total_pdp_views":       count of pdp_view events,
    "converted":             True if session contains a purchase event
}
```

**Persona baseline `intent_score` (before jitter):**
- Collector: 72 — deliberate, high dwell, few distractions
- Loyalist: 65 — focused on preferred varietal
- Explorer: 48 — broad browsing, lower per-session conversion focus
- Gifter: 38 — seasonal spikes, otherwise low
- Deal Seeker: 42 — medium intent, price-conditional

### `get_funnel_drop_off_report` — traffic source breakdown

Add per-`traffic_source` funnel records matching the conversion rates specified in the Domain 5 addition above. Each source should have a full step-by-step record with `sessions_entered`, `completion_rate`, `drop_off_rate`, and `top_exit_pages` per step.

---

## MCP Stub Implementations for Write-Only and Webhook Functions

30 of the 53 MCP functions are pure writes, webhooks, or ingestion endpoints — they don't require sample data because agents call them to *create* state rather than read it. For a prototype, each of these should return a plausible success response immediately without performing the actual operation. This lets agents complete their full run sequences without errors, and makes it easy to inspect what the agent *would* have done without actually sending emails, creating ad campaigns, or modifying external systems.

### Stub pattern

Each stub should:
1. Accept any valid input parameters without validation errors
2. Return a realistic response with generated IDs and timestamps
3. Log the call to a local file (`logs/mcp-stubs-[date].jsonl`) so you can inspect what the agent tried to do
4. Return the correct status field (e.g. `"status": "sent"` for email sends, `"status": "active"` for paid campaigns)

```python
import uuid, json
from datetime import datetime, timezone

def stub_response(function_name: str, params: dict, response_template: dict) -> dict:
    """Logs the call and returns the template with generated IDs and timestamps."""
    with open(f"logs/mcp-stubs-{datetime.now().strftime('%Y-%m-%d')}.jsonl", "a") as f:
        f.write(json.dumps({
            "function": function_name, "params": params,
            "called_at": datetime.now(timezone.utc).isoformat(), "stub": True
        }) + "\n")
    for key, value in response_template.items():
        if value == "__uuid__": response_template[key] = str(uuid.uuid4())[:12]
        if value == "__now__":  response_template[key] = datetime.now(timezone.utc).isoformat()
    return response_template
```

### Stub responses by function

**Domain 1:**

`update_product_metadata` → `{ "sku_id": "[echoed]", "updated_fields": ["[fields]"], "updated_at": "__now__" }`

`watch_inventory_alerts` → `{ "subscription_id": "__uuid__", "status": "active", "sku_count": 120 }`

---

**Domain 2:**

`create_segment` → `{ "segment_id": "seg-__uuid__", "name": "[echoed]", "member_count": 0, "created_at": "__now__" }`

`add_to_suppression_list` → `{ "customer_id": "[echoed]", "suppression_id": "sup-__uuid__", "campaign_id": "[echoed]", "reason": "[echoed]", "expires_at": "[echoed]", "created_at": "__now__" }`

`remove_from_suppression_list` → `{ "customer_id": "[echoed]", "removed": true, "removed_at": "__now__" }`

---

**Domain 3:**

`create_campaign_brief` → `{ "campaign_id": "camp-__uuid__", "campaign_type": "[echoed]", "channels": ["[echoed]"], "status": "draft", "created_at": "__now__" }`

`publish_content_asset` → `{ "asset_id": "asset-__uuid__", "campaign_id": "[echoed]", "channel": "[echoed]", "status": "pending_review", "created_at": "__now__" }`

`upsert_seo_keyword` → `{ "keyword": "[echoed]", "action": "created", "updated_at": "__now__" }`

`update_campaign_brief` → `{ "campaign_id": "[echoed]", "updated_fields": ["[fields]"], "updated_at": "__now__" }`

`update_campaign_status` → `{ "campaign_id": "[echoed]", "previous_status": "draft", "new_status": "[echoed]", "approved_by": "[echoed]", "updated_at": "__now__" }`
*Also update the campaign record in `campaigns.json` so subsequent `get_campaign_briefs` calls return the correct status — see write-back table below.*

`create_campaign_request` → `{ "request_id": "req-__uuid__", "campaign_id": "[echoed]", "status": "pending", "created_at": "__now__" }`

`create_content_request` → `{ "request_id": "cr-__uuid__", "requesting_command": "[echoed]", "status": "pending", "created_at": "__now__" }`

`approve_content_asset` → `{ "asset_id": "[echoed]", "approved_by": "[echoed]", "approved_at": "__now__", "new_status": "approved" }`
*Also update the asset record in `content_assets.json` — see write-back table below.*

`upload_creative_asset` → `{ "asset_id": "img-__uuid__", "campaign_id": "[echoed]", "url": "https://assets.example-wine-store.com/campaigns/[campaign_id]/img-__uuid__.jpg", "status": "pending_review", "uploaded_at": "__now__" }`

`create_campaign_retrospective` → `{ "retrospective_id": "retro-__uuid__", "campaign_id": "[echoed]", "created_at": "__now__" }`
*Also write the retrospective payload to `outputs/retrospectives/[campaign_id]-retro.md` for the Campaign Trace Agent to find.*

---

**Domain 4:**

`send_email_campaign` → `{ "send_id": "send-__uuid__", "campaign_id": "[echoed]", "segment_id": "[echoed]", "estimated_reach": "[segment member_count]", "status": "sent", "scheduled_at": "__now__" }`

`trigger_behavioral_email` → `{ "send_id": "send-__uuid__", "customer_id": "[echoed]", "campaign_id": "[echoed]", "event_type": "[echoed]", "status": "queued", "scheduled_at": "__now__" }`

`publish_social_post` → `{ "post_id": "post-__uuid__", "platform": "[echoed]", "campaign_id": "[echoed]", "status": "published", "published_at": "__now__", "post_url": "https://www.instagram.com/p/__uuid__" }`

`sync_product_feed_to_ad_platforms` → `{ "sync_id": "sync-__uuid__", "platforms": ["[echoed]"], "skus_synced": 118, "skus_excluded": 2, "status": "success", "synced_at": "__now__" }`

`create_paid_campaign` → `{ "platform_campaign_id": "goog-__uuid__", "internal_campaign_id": "paid-__uuid__", "source_campaign_id": "[echoed]", "platform": "[echoed]", "status": "active", "created_at": "__now__" }`

`create_behavioral_audience` → `{ "audience_id": "aud-__uuid__", "platform": "[echoed]", "audience_name": "[echoed]", "estimated_size": "[random.randint(600, 1100)]", "status": "ready", "created_at": "__now__" }`

`pause_ads_for_sku` → `{ "sku_id": "[echoed]", "paused_campaigns": [{ "platform": "google", "campaign_id": "goog-__uuid__", "campaign_name": "[sku_id] Shopping", "paused_at": "__now__" }, { "platform": "meta", "campaign_id": "meta-__uuid__", "campaign_name": "[sku_id] Retargeting", "paused_at": "__now__" }], "total_paused": 2 }`

`cancel_email_send` → `{ "send_id": "[echoed]", "status": "cancelled", "cancelled_at": "__now__", "reason": "[echoed]" }`

`pause_campaign_channel` → `{ "campaign_id": "[echoed]", "channel": "[echoed]", "sends_cancelled": 1, "posts_unscheduled": 0, "ads_paused": 0, "paused_at": "__now__" }`

---

**Domain 6:**

`log_recommendation_feedback` → `{ "logged": true, "customer_id": "[echoed]", "sku_id": "[echoed]", "action": "[echoed]", "logged_at": "__now__" }`

`set_campaign_boost` → `{ "boost_id": "boost-__uuid__", "campaign_id": "[echoed]", "sku_ids": ["[echoed]"], "boost_factor": "[echoed]", "contexts": ["[echoed]"], "start_date": "[echoed]", "end_date": "[echoed]", "status": "active", "created_at": "__now__" }`

`remove_campaign_boost` → `{ "campaign_id": "[echoed]", "boosts_removed": 1, "sku_ids_affected": ["[echoed]"], "removed_at": "__now__" }`

---

**Domain 7:**

`log_session_event` → `{ "event_id": "evt-__uuid__", "logged": true }`
*Handled by the external ingestion service in production. Stub exists for direct testing only.*

`watch_behavioral_triggers` → `{ "subscription_id": "sub-__uuid__", "trigger_type": "[echoed]", "auto_intervention_enabled": true, "status": "active", "registered_at": "__now__" }`

`update_merchandising_rules` → `{ "collection_id": "[echoed]", "rules_applied": "[count of rules]", "effective_from": "__now__", "expires_at": "[echoed]" }`
*Also update the collection's rules in `merchandising_rules.json` — see write-back table below.*

`trigger_onsite_intervention` → `{ "intervention_id": "int-__uuid__", "customer_id": "[echoed]", "anonymous_id": "[echoed]", "intervention_type": "[echoed]", "status": "delivered", "delivered_at": "__now__" }`

### Stubs that must also write back to the data layer

Three stubs need to update the static JSON so the next read call sees the new state. Without this, an agent that creates a campaign brief and immediately reads it back would find nothing.

| Function | File to update | Field to update |
|----------|---------------|----------------|
| `update_campaign_status` | `domain3/campaigns.json` | `status` field for matching `campaign_id` |
| `approve_content_asset` | `domain3/content_assets.json` | `status` → `"approved"`, `approved_at` → now, `approved_by` → echoed |
| `update_merchandising_rules` | `domain7/merchandising_rules.json` | Replace `rules` array for matching `collection_id` |

All other stubs can safely no-op on the data layer — the agent will not immediately re-read what it just wrote.

---

## Cross-Dataset Coherence Checks

Run these after generation to verify that jitter hasn't broken coherence:

**Check 1: Jitter amplitude is in range.** Compute coefficient of variation (sd/mean) for email open rate, CLV, and propensity scores within each persona. CV < 0.15 means jitter is too low (data looks artificially clean). CV > 0.65 means jitter is too aggressive (persona signal is buried in noise). Target: 0.20–0.50.

**Check 2: Persona-to-CLV ranking preserved.** Mean CLV must rank: Collectors > Loyalists > Explorers > Gifters > Deal Seekers. Jitter can produce individual outliers (a Deal Seeker with $900 CLV is fine) but must not invert group means.

**Check 3: RFM-to-CLV correlation.** Pearson correlation between `rfm_composite` and `clv` across all 1,000 customers should be 0.55–0.75. Lower indicates the two metrics are effectively uncorrelated (jitter broke the link). Higher than 0.75 indicates they're too tightly coupled to look realistic.

**Check 4: Engagement modifier consistency.** For each customer, verify that `email_open_rate`, `upsell_propensity`, and session `dwell_time` are all nudged in the same direction as `engagement_modifier`. Compute the sign of `(metric - persona_mean)` for each. All three should agree in sign for at least 70% of customers.

**Check 5: Segment membership rules are hard constraints.** Jitter affects continuous metrics only. Segment membership is rule-based and must not be jittered. All customers in seg-001 must have `preferred_varietal = "Bordeaux"`. All in seg-005 must be Champions. These are checked by re-applying the segment rules to the generated data and comparing counts.

**Check 6: Churned customers are disengaged.** No churned customer should have `email_open_rate_30d > 0.15` or `sessions_last_30d > 1`. The lifecycle dampening in jitter models enforces this — verify it holds.

**Check 7: Campaign type coverage.** The dataset should surface all eight campaign types autonomously:
- Promotion → SKU-042, SKU-017, SKU-058 (overstock)
- Limited allocation → SKU-031 (high intent + low stock)
- Winback → seg-006 (lapsed Loyalists)
- Educational → Barolo content gap in search data
- Bundle → SKU-042 + SKU-019 co-purchase pair
- New arrival → SKU-031 trending +68%
- Seasonal → upcoming event in seasonal calendar
- Pre-order → seg-011 (pre-order eligible)

---

## Implementation

### Option A: Static JSON files

Write each function's response as a static JSON file. MCP server applies filtering in-memory. Suitable for a quick start; coherence must be maintained manually when editing files.

### Option B: Generation script (recommended)

At 1,000 customers, the generation script is the right approach. All jitter functions in this plan are directly implementable in Python.

```python
import numpy as np, random, math, json
from faker import Faker
from datetime import datetime, timedelta

fake = Faker()

PERSONA_DIST = {"Explorer": 275, "Gifter": 250, "Loyalist": 200, "DealSeeker": 175, "Collector": 100}

def generate_all(seed=42):
    random.seed(seed); np.random.seed(seed)

    customers = generate_customers(PERSONA_DIST)   # master table first
    products  = generate_products()                # 120 SKUs across 15 varietal families

    purchases = generate_purchases(customers, products)  # derived from customers × products

    # All downstream metrics computed from purchases — never generated independently
    for c in customers:
        cp = [p for p in purchases if p["customer_id"] == c["customer_id"]]
        c["clv"]              = compute_clv(c, cp)
        c["rfm_scores"]       = compute_rfm(c, cp)
        c["email_engagement"] = compute_email_engagement(c)
        c["propensity_scores"]= compute_propensity(c, cp)
        c["top_varietal_affinities"] = compute_affinities(cp)

    segments, memberships = compute_segments(customers)  # rule-based, no jitter
    sessions   = generate_sessions(customers, products)
    search     = generate_search_data(products)
    performance= aggregate_performance(purchases)
    attribution= compute_attribution(purchases)

    return {k: v for k, v in locals().items()
            if k in ["customers","products","purchases","segments",
                     "memberships","sessions","search","performance","attribution"]}
```

**Dependencies:** `pip install numpy faker`
**Runtime:** ~3–5 minutes for 1,000 customers
**Output:** ~90–120MB JSON across all files
**Reproducibility:** Fixed seed=42 gives identical output on every run

### Option C: Claude-generated in steps

Feasible but requires careful session management at 1,000 customers. Use this prompt sequence if you want to get running immediately:

1. Generate master customer table (1,000 rows as CSV — compact format)
2. Generate 120 SKUs across 15 varietal families
3. Generate purchase history in batches of 250 customers each
4. Derivation pass: CLV, RFM, segments computed from purchase history
5. Behavioral and search data
6. Analytics and attribution (aggregated from purchase history)

At this scale, Option C will require 5–6 Claude sessions and manual stitching of the purchase history batches. Option B is faster and produces better data.

---

## Recommended Approach

Use **Option B** with seed=42. The jitter functions in this plan are directly implementable — the entire script is approximately 400 lines of Python.

Start by implementing Steps 1 and 2 only (master customer table and product catalog). Verify the persona distribution and varietal distribution look correct. Then add purchase history generation and run coherence checks 2 and 3 before building any downstream datasets. This staged approach catches jitter calibration errors early, before they propagate into 8 downstream files.

The most important thing to verify first: coherence check #4 (engagement modifier consistency). If `email_open_rate`, `upsell_propensity`, and `dwell_time` don't correlate with `engagement_modifier` at the individual customer level, every downstream analysis will be noisier than it needs to be and the agent demonstrations will be less convincing.
