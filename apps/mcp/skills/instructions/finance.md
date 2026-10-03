# Finance Extraction Skill

Domain-specific guidance for extracting knowledge graphs from financial and economic content.
This skill is ADDITIVE — it maps domain concepts to existing categories.
It does NOT change the extraction format, schema, or validation rules.

---

## 1. Domain Overview

What makes financial content distinctive for knowledge graph extraction:
- **Quantitative relationships dominate.** Numbers, rates, ratios, and metrics are the language of finance. Extract them as evidence.
- **Institutional plumbing matters.** Financial systems have invisible infrastructure (clearing houses, settlement systems, rating agencies) that are structurally critical but easy to miss.
- **Time series are arguments.** "GDP grew 3%" is data. "GDP grew 3% after a rate cut" is a causal claim. Extract the causation, not just the data.
- **Regulatory frameworks are actors.** Dodd-Frank, Basel III, MiFID aren't just documents — they reshape how institutions behave. Extract them as active entities.

Common source types: central bank reports, financial analysis, economic research, policy papers, market commentary, regulatory documents.

---

## 2. Entity Mapping

| Domain Concept | Category | Why | Example |
|---------------|----------|-----|---------|
| Central bank | Organization | Institution with mandate and powers | "Federal Reserve", "ECB", "PBOC" |
| Commercial bank | Organization | Private institution in the system | "JPMorgan Chase", "Deutsche Bank" |
| Financial instrument | Technology | Technical tool for value transfer | "Treasury bonds", "Credit default swaps" |
| Market / exchange | System | Trading ecosystem with participants | "NYSE", "Forex market", "Bond market" |
| Regulatory body | Organization | Enforcement institution | "SEC", "BIS", "Financial Stability Board" |
| Regulation / act | Law | Codified rule governing finance | "Dodd-Frank Act", "Basel III Accord" |
| Economic indicator | Metric | Measurable quantity | "CPI", "GDP", "Unemployment rate", "Yield curve" |
| Financial crisis | Event | Bounded systemic failure | "2008 Financial Crisis", "Asian Financial Crisis" |
| Monetary policy | Process | Ongoing policy mechanism | "Quantitative easing", "Interest rate targeting" |
| Payment system | Technology | Settlement infrastructure | "SWIFT", "Fedwire", "CHIPS" |
| Economic theory | Concept | Framework for understanding | "Modern Monetary Theory", "Efficient Market Hypothesis" |
| Commodity | Resource | Traded physical resource | "Crude oil", "Gold", "Copper" |
| Currency | Resource | Medium of exchange | "US Dollar", "Euro", "Yuan" |
| Credit rating agency | Organization | Assessment institution | "Moody's", "S&P", "Fitch" |
| Trade agreement | Agreement | Economic arrangement | "NAFTA", "RCEP", "CPTPP" |

### Entities to Always Look For

- **Transmission mechanisms** — HOW does a rate change affect the real economy? What's the channel?
- **Settlement infrastructure** — Clearing houses, payment systems, correspondent banking networks
- **Shadow banking** — Non-bank financial intermediaries, money market funds, repo markets
- **Rating agencies and indices** — They shape behavior even without direct authority
- **Cross-border flows** — Capital flows, remittances, trade flows between entities

### Entities to Be Cautious About

- **Don't extract every stock or bond mentioned** — only those with systemic significance or active roles
- **Don't extract every historical data point as an entity** — "Q3 2023 GDP" is data, not an entity
- **Don't extract market commentary as entities** — "bullish sentiment" is not an extractable entity unless it's analyzed as a force

---

## 3. Relationship Patterns

### High-Frequency Patterns

| Pattern | relType | causalClassification | Example |
|---------|---------|---------------------|---------|
| Central bank sets rate | CONTROLS | REGULATES | Fed --CONTROLS--> Federal Funds Rate |
| Rate affects borrowing | DETERMINES | INFLUENCES | Fed Funds Rate --DETERMINES--> Mortgage Rates |
| Institution provides liquidity | PROVIDES_LIQUIDITY | ENABLES | Fed --PROVIDES_LIQUIDITY--> Banking System |
| Regulation constrains | CONSTRAINS | REGULATES | Basel III --CONSTRAINS--> Bank Leverage |
| Crisis triggers response | TRIGGERS | CAUSES | 2008 Crisis --TRIGGERS--> Dodd-Frank |
| Rating affects cost | RATES | INFLUENCES | S&P --RATES--> US Treasuries |
| Capital flows between | FLOWS_TO | PRODUCES | Chinese Savings --FLOWS_TO--> US Treasuries |
| Market transmits shock | TRANSMITS | CAUSES | Bond Market --TRANSMITS--> Credit Crunch |
| Institution hedges risk | HEDGES | BLOCKS | JPMorgan --HEDGES--> Interest Rate Risk |
| Currency competes | COMPETES_WITH | COMPETES_WITH | Yuan --COMPETES_WITH--> Dollar (reserve status) |

### Domain Verbs to Causal Families

| Finance Verb | Maps To | Example |
|-------------|---------|---------|
| lends, funds, finances | ENABLES | Bank lends to company |
| constrains, limits, caps | REGULATES | Regulation limits leverage |
| triggers, precipitates, sparks | CAUSES | Event triggers crisis |
| hedges, offsets, insures | BLOCKS | Derivative hedges risk |
| rates, grades, assesses | INFLUENCES | Agency rates bond |
| settles, clears, processes | IMPLEMENTS | Clearing house settles trades |
| competes with, challenges | COMPETES_WITH | Fintech challenges banks |
| depends on, requires | DEPENDS_ON | Bank depends on interbank lending |

---

## 4. Quality Expectations

### Definitions in Finance

- **For institutions:** Mandate, scale (assets under management, market share), key powers, systemic importance
- **For instruments:** What it is, how it works mechanically, who uses it, what risk it manages
- **For regulations:** What it governs, when enacted, key provisions, enforcement mechanism
- **For metrics:** What it measures, who publishes it, what range is normal vs crisis, why it matters
- **For crises:** Trigger, duration, scale (GDP impact, job losses), structural cause

### Roles in Finance

- For institutions: function in the specific financial system described, how they exercise power, what constraints they face
- For regulations: what behavior they changed, whether they succeeded, what circumvention strategies emerged
- For markets: what they price, who participates, what information they aggregate

### Evidence in Finance

- Include SPECIFIC NUMBERS: "$4.5 trillion in QE", "rate cut from 5.25% to 0.25%", "GDP fell 4.3%"
- Financial claims often have quantitative evidence — capture the numbers, not paraphrases

---

## 5. Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|-------------|
| Extracting market commentary as fact | "Markets expect..." is prediction, not fact | evidenceStrength: speculative for expectations |
| Missing the infrastructure | Text focuses on outcomes, not plumbing | Ask: "What infrastructure makes this possible?" |
| Confusing correlation with causation | "GDP and stocks both fell" ≠ causation | Only extract CAUSES when the text argues mechanism |
| Over-simplifying monetary policy | "Fed raised rates" → but HOW does that work? | Extract the transmission mechanism as relationships |
| Missing shadow banking | Non-bank finance is often discussed implicitly | Look for money market funds, repo, commercial paper |

---

## 6. Tag Vocabulary

### Thematic Tags
```
monetary-policy, fiscal-policy, trade-policy, financial-regulation,
banking-system, capital-markets, derivatives, fixed-income,
foreign-exchange, commodities, credit-markets, payment-systems,
systemic-risk, financial-stability, central-banking
```

### Functional Tags
```
lender-of-last-resort, market-maker, clearing-house, regulator,
rating-agency, settlement-system, reserve-currency, benchmark,
safe-haven, too-big-to-fail, shadow-banking
```

### Temporal Tags
```
bretton-woods-era, post-bretton-woods, pre-2008, post-2008,
great-recession, quantitative-easing-era, zero-interest-rate,
post-pandemic, fintech-era
```
