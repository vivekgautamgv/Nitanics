# Tag Awareness

Tags make entities and relationships findable. Without tags, finding things requires exact name matches or broad semantic search. With tags, Claude can search by CONCEPT — "monetary-policy" finds Federal Reserve, ECB, interest rates, and quantitative easing in one query.

---

## What Tags Do (3 Purposes)

### 1. LLM Search (Claude finding things fast)

Without tags: 3 separate searches to find all monetary policy entities.
With tags: 1 search on tag "monetary-policy" returns all related entities.

Tags are added to the fulltext index. When Claude calls `memorytonic_search({ query: "monetary-policy" })`, it finds every entity tagged with that concept.

### 2. Vector Search (richer embeddings)

Tags are concatenated into embedding text:
```
embedding_input = definition + " " + role + " " + tags.join(" ")
```

**Without tags:**
```
"The Federal Reserve is a central banking system..."
→ Vector captures: banking, central, system
```

**With tags:**
```
"The Federal Reserve is a central banking system... monetary-policy dollar-hegemony quantitative-easing interest-rate-policy"
→ Vector captures: banking, central, system + monetary, policy, dollar, hegemony, quantitative, easing
```

Now a vector search for "who controls the dollar?" finds the Fed through the enriched embedding.

### 3. Collection Matching (smart placement)

When extracting a new document, tags help match it to existing collections:
```
New document tags: ["monetary-policy", "trade-policy", "USD"]
Collection "Global Finance Systems" has entities tagged: ["monetary-policy", "trade-policy", "fiscal-policy"]
→ Tag overlap: 2/3 → High match. Suggest this collection.
```

---

## Entity Tags (3-8 per entity, kebab-case)

### Tag Taxonomy

Use tags from these categories:

**Thematic** — what concept space does this entity belong to?
```
monetary-policy, trade-policy, energy-policy, foreign-policy,
climate-policy, defense-policy, fiscal-policy, sanctions-policy,
digital-currency, supply-chain, debt-management, labor-market
```

**Functional** — what role does this entity play in systems?
```
decision-maker, regulator, disruptor, stabilizer, intermediary,
enforcer, facilitator, beneficiary, challenger, architect,
gatekeeper, innovator, watchdog
```

**Domain** — what field does this entity primarily belong to?
```
geopolitics, finance, technology, energy, military,
diplomacy, trade, law, economics, environment,
healthcare, infrastructure, intelligence
```

**Temporal** — what era or period is this entity most associated with?
```
cold-war, post-cold-war, post-2008, post-pandemic,
pre-colonial, colonial-era, 21st-century, digital-age,
bretton-woods-era, post-bretton-woods
```

### Rules

1. **3-8 tags per entity** — fewer than 3 is too sparse, more than 8 is noise
2. **kebab-case** — `monetary-policy` not `Monetary Policy` or `monetary_policy`
3. **Conceptual, not descriptive** — tags represent concept spaces, not descriptions
4. **No generics** — tags must add information beyond what the category already tells you
5. **Mix taxonomy types** — good entities have thematic + functional + domain tags

### BAD Tags (rejected by validation)

```
"important"          ← Every entity is important or it wouldn't be extracted
"entity"             ← Tautological
"mentioned"          ← Tautological
"relevant"           ← Says nothing
"big"                ← Subjective, not a concept
"thing"              ← Useless
"related"            ← Tautological
"key"                ← Subjective
"major"              ← Subjective
"various"            ← Meaningless
```

### GOOD Tags (examples by entity type)

**Person: "Janet Yellen"**
```
tags: ["monetary-policy", "decision-maker", "finance", "federal-reserve",
       "interest-rate-policy", "post-2008"]
```
Why: Captures her concept space (monetary policy), her functional role (decision-maker), her domain (finance), her institutional association, her specific policy area, and her temporal relevance.

**Organization: "OPEC"**
```
tags: ["energy-policy", "oil-pricing", "cartel", "geopolitics",
       "market-control", "supply-management"]
```
Why: Thematic (energy-policy, oil-pricing), functional (cartel, market-control), domain (geopolitics), and what it actually does (supply-management).

**Concept: "Dollar Hegemony"**
```
tags: ["monetary-policy", "dollar-hegemony", "reserve-currency",
       "geopolitics", "post-bretton-woods", "financial-power"]
```
Why: Direct concept tag, related thematic tags, domain, temporal era, and what kind of power it represents.

**Event: "2008 Financial Crisis"**
```
tags: ["financial-crisis", "systemic-risk", "post-2008", "finance",
       "banking-collapse", "regulatory-failure"]
```

**Technology: "SWIFT Network"**
```
tags: ["financial-infrastructure", "payment-system", "sanctions-enforcement",
       "technology", "intermediary", "dollar-hegemony"]
```
Why: What it is (financial infrastructure, payment system), how it's used (sanctions enforcement), its role (intermediary), and what power structure it supports.

---

## Relationship Tags (1-4 per edge, kebab-case)

Relationship tags classify the THEME of the connection, not its type (relType and causalClassification already classify the type).

### Rules

1. **1-4 tags per edge** — relationships are narrower than entities, fewer tags needed
2. **Thematic, not structural** — describe what the relationship IS ABOUT, not what kind it is
3. **Don't duplicate relType** — if relType is "FUNDS", don't tag "funding"

### Examples

**Edge: Saudi Arabia --[REGULATES]--> Oil Price**
```
tags: ["oil-pricing", "market-control"]
```
Why: The theme is oil pricing and market control. NOT "regulates" (that's the relType).

**Edge: IMF --[ENABLES]--> Structural Adjustment**
```
tags: ["economic-reform", "conditionality"]
```

**Edge: US --[BLOCKS]--> Huawei**
```
tags: ["tech-sanctions", "supply-chain-decoupling"]
```

**Edge: Federal Reserve --[INFLUENCES]--> USD Exchange Rate**
```
tags: ["monetary-policy", "interest-rate-policy"]
```

---

## How Tags Feed Downstream Systems

```
YOUR TAGS
    │
    ├──→ FULLTEXT INDEX
    │    bootstrap.py adds tags_text to fulltext index
    │    Search: "monetary-policy" → finds all tagged entities
    │
    ├──→ EMBEDDING TEXT
    │    embed.py concatenates tags into vector input
    │    Richer vectors → better semantic search
    │
    ├──→ NEO4J PROPERTY
    │    Cypher: WHERE "monetary-policy" IN e.tags
    │    Direct property queries (fast, exact)
    │
    ├──→ COLLECTION MATCHING
    │    Smart placement: tag overlap ranks collection suggestions
    │    New doc with ["trade-policy", "USD"] → matches "Global Finance"
    │
    ├──→ RESEARCH AGENT
    │    Thematic gap detection:
    │    "8 entities tagged 'monetary-policy' but only 1 tagged 'fiscal-policy'"
    │    → Research suggestion: fiscal policy underexplored
    │
    └──→ UI (entity cards)
         Rendered as clickable pills on entity cards
         User filters/explores by tag
```

---

## Tag Consistency Across Projects

When extracting multiple documents into the same collection, use CONSISTENT tags for the same concepts. If you tagged "monetary-policy" in one project, don't switch to "money-policy" or "monetary-policies" in another.

**Check what tags already exist** in the collection before inventing new ones. Reusing existing tags strengthens the connection graph; inventing synonyms fragments it.

The Research Agent uses tag distributions to detect thematic gaps. Inconsistent tagging produces false gap signals.

---

## Quick Reference

| Rule | Entity Tags | Edge Tags |
|------|------------|-----------|
| Count | 3-8 | 1-4 |
| Format | kebab-case | kebab-case |
| Types | thematic + functional + domain + temporal | thematic only |
| Purpose | Search, vectors, collection match, analysis | Theme classification |
| Validation | Use only source-supported tags; no count quota | At least one nonempty tag |
