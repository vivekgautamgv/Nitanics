# Relationship Building (Step 04, Part 1)

**Relationships are where the graph becomes useful. Without them, you have a list of names. With them, you have a map of how the world works.**

---

## Input

- Raw text (the document)
- `04_all_entities.json` (entities from Step 03)

## Output (within `06_extraction.json`)

```json
{
  "relationships": [
    {
      "source": "Federal Reserve",
      "target": "Interest Rates",
      "relType": "CONTROLS",
      "causalClassification": "REGULATES",
      "description": "Explain the connection supported by the exact source quote",
      "evidence": "exact quote from source...",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "tags": ["monetary-policy", "interest-rate-policy"],
      "year": "1913-present"
    }
  ]
}
```

---

## The Two-Layer Classification

Every edge has BOTH:

### 1. relType — The Specific Verb

What EXACTLY is happening? Extensible, project-dependent.

```
FUNDS, SANCTIONS, CONTROLS, ENABLES, BLOCKS, DETERS,
ENFORCES, UNDERMINES, MEDIATES, PROVOKES, STABILIZES,
DISRUPTS, REPLACES, MONITORS, SUBSIDIZES, WEAPONIZES...
```

Not from a fixed list — use the verb that most precisely describes the relationship.

### 2. causalClassification — The Family (15 fixed)

Which FAMILY does this relationship belong to? For filtering and graph coloring.

```
CAUSES       — direct causation (A makes B happen)
ENABLES      — creates conditions for (A makes B possible)
BLOCKS       — prevents or impedes (A stops B)
INFLUENCES   — affects without determining (A shapes B)
DEPENDS_ON   — requires for function (A needs B)
CONTRADICTS  — opposes or conflicts (A and B are incompatible)
SUPPORTS     — reinforces or backs (A strengthens B)
PRECEDES     — temporal ordering (A comes before B)
COMPETES_WITH — rivalry (A and B contest the same thing)
COOPERATES_WITH — collaboration (A and B work together)
REGULATES    — controls or governs (A has authority over B)
TRANSFORMS   — fundamentally changes (A reshapes B)
PRODUCES     — creates or generates (A makes B)
CONSUMES     — uses up or absorbs (A depletes B)
IMPLEMENTS   — executes or realizes (A carries out B)
```

**Don't default to INFLUENCES.** It's the vaguest family. If you can use a more specific family, do.

---

## Writing Source-Supported Descriptions

The description explains HOW the relationship works mechanically.

### The Mechanism Test

"Does this description explain the MECHANISM, or just state the FACT?"

| Level | Example | Verdict |
|-------|---------|---------|
| **Fact** | "US sanctions Iran" | FAIL — says THAT, not HOW |
| **Mechanism** | "US leverages SWIFT dependency to force European banks to comply with sanctions, cutting Iran's access to international financial messaging" | PASS — explains HOW |
| **Deep mechanism** | "US leverages control of dollar clearing to threaten SWIFT with exclusion from the US financial system, forcing SWIFT to disconnect Iranian banks, eliminating Iran's ability to receive payments for oil through normal channels" | EXCELLENT — traces the full mechanism |

### Description Patterns

| Pattern | Template | Example |
|---------|----------|---------|
| Control | "A controls B through [mechanism], giving A [leverage]" | "Fed controls interest rates through FOMC rate decisions, giving it direct influence over borrowing costs economy-wide" |
| Dependency | "A depends on B for [function], making A vulnerable to [risk]" | "Europe depends on Russian gas for 40% of heating, making it vulnerable to supply disruption as political leverage" |
| Enablement | "A enables B by [mechanism], without which B [consequence]" | "SWIFT enables cross-border payments by transmitting payment instructions between banks, without which international trade settlement becomes manual and slow" |
| Competition | "A competes with B for [resource/position] through [mechanism]" | "BRICS payment system competes with SWIFT for transaction volume by offering sanctions-resistant alternatives to dollar-denominated messaging" |
| Transformation | "A transforms B from [state1] to [state2] through [mechanism]" | "US sanctions transform SWIFT from neutral infrastructure to geopolitical weapon by threatening secondary sanctions on non-compliant nodes" |

---

## Evidence Quotes

**Exact quotes from the source text. No paraphrasing. No synthesis.**

```
BAD:  "The text discusses sanctions against Iran."
BAD:  "According to the source, sanctions were imposed." (paraphrase)
GOOD: "Saudi Arabia's ability to unilaterally increase production by up to 
       3 million barrels per day gives it effective veto power over OPEC 
       pricing decisions."
```

If the source uses specific numbers, dates, or names — include them in the quote. Specific quotes are more verifiable than vague ones.

---

## Evidence Strength

| Strength | When to Use | Example |
|----------|------------|---------|
| **established** | Verifiable fact, data-backed, widely accepted | "GDP fell 15%" |
| **claimed** | Stated by source but not independently verified | "Officials said the program was effective" |
| **disputed** | Contested by other sources or within the text | "Critics argue sanctions hurt civilians more than the regime" |
| **speculative** | Prediction, hypothesis, or inference | "Future sanctions may target cryptocurrency" |

Preserve the source's attribution and uncertainty. A source assertion is not automatically an independently established fact.

---

## Magnitude

| Magnitude | When to Use | The Counterfactual Test |
|-----------|------------|----------------------|
| **foundational** | Removing this relationship collapses the system | Without Fed rate control, the entire monetary transmission mechanism breaks |
| **significant** | Important but system survives without it | Without OPEC quotas, oil pricing would be less stable but markets still function |
| **marginal** | Minor influence, detail | A minor bilateral agreement that doesn't affect the broader system |

**Most relationships are significant.** Reserve foundational for the 2-3 relationships that define the system's structure. Use marginal for genuine side-details.

---

## Direction Matters

Relationships are directional: source → target.

| Direction | Meaning | Example |
|-----------|---------|---------|
| A → B | A acts ON B | US --SANCTIONS--> Iran |
| A → B | A depends ON B | Europe --DEPENDS_ON--> Russian Gas |
| A → B | A controls B | Fed --CONTROLS--> Interest Rates |

**Get the direction right.** "Iran sanctions US" is different from "US sanctions Iran."

For mutual relationships (COOPERATES_WITH, COMPETES_WITH), pick the direction that matches the text's framing. If the text says "NATO and Russia compete," make NATO the source (since the text frames NATO's perspective).

---

## Relationship Count Guide

| Document Type | Typical Count | Why |
|---------------|--------------|-----|
| Dense geopolitical analysis | 20-40 | Many actors with cross-cutting relationships |
| Technical documentation | 15-25 | Components, dependencies, data flows |
| Business case study | 15-25 | Stakeholders, processes, outcomes |
| Historical narrative | 25-50 | Events, causes, consequences across time |
| Scientific research | 15-20 | Methods, results, implications |

There is no relationship count quota. An empty array is valid. Do not add a transitive or implied connection unless an exact source quote supports that specific connection.

---

## Edge Tags (1-4 per edge, kebab-case)

Tags classify the THEME of the relationship, not its type.

```
Don't duplicate relType: if relType is "FUNDS", don't tag "funding"
Do add thematic context: "oil-pricing", "sanctions-enforcement", "monetary-policy"
```

See `tag-awareness.md` for full guidance.

---

## Multiple Edges Between Same Pair

RELATES_TO uses CREATE, not MERGE. Multiple edges between the same entity pair are allowed — this is by design.

```
US --[SANCTIONS]--> Iran  (evidenceStrength: established, year: 2012)
US --[NEGOTIATES_WITH]--> Iran  (evidenceStrength: established, year: 2015)
```

Same entities, different relationships, different time periods. Both are valid.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| All relationships are INFLUENCES | Use specific families: CAUSES, BLOCKS, ENABLES, DEPENDS_ON |
| Descriptions restate the relType | "US sanctions Iran" is just the relType restated. Describe the MECHANISM. |
| Missing evidence quotes | Every edge needs an exact quote. No exceptions. |
| Wrong direction | Check: who acts on whom? Who depends on whom? |
| Missing temporal context | If the text says when, capture it in year/period |
| Inventing implied relationships | A→B and B→C do not by themselves justify a new A→C claim |
| Generic tags | Use thematic concepts, not "edge" or "relationship" |
