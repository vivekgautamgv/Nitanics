# Quality Bar

Validation requires faithful, source-supported extraction. Counts and lengths depend on the document; never add facts, aliases, chronology, or causality to meet a quota. Examples below illustrate writing styles only and must not supply facts absent from the source.

---

## Entity Quality

### Definition: nonempty and source-supported

**What it must answer:** "What IS this entity and why does it matter in a system?"

| Quality | Example | Why |
|---------|---------|-----|
| FAIL (45 chars) | "The IMF is an international financial institution." | Dictionary definition. No mechanics. No system role. |
| PASS (180 chars) | "The International Monetary Fund provides emergency lending to nations facing balance-of-payments crises, conditions loans on structural adjustment, and serves as lender of last resort in the international monetary system." | Function, mechanism, system role. Stands alone. |
| EXCELLENT (250 chars) | "The International Monetary Fund is a Bretton Woods institution that provides emergency lending to nations facing balance-of-payments crises, conditions loans on structural adjustment programs, and serves as the lender of last resort in the international monetary system. Its voting structure gives disproportionate power to the US and European founders, making it both a stabilizer and a target of governance reform demands." | All of PASS + structural context + why it's contested. |

### Role: stance + mechanics + reasoning

**What it must answer:** "What role did this entity play in THIS document? What is its position? WHY?"

| Quality | Example |
|---------|---------|
| FAIL | "The IMF plays a role in the crisis." |
| PASS | "The IMF acted as emergency lender during the Asian Financial Crisis, providing $117B in loans to Thailand, Indonesia, and South Korea. However, it conditioned aid on austerity measures that deepened the recession, making it both rescuer and destabilizer." |
| EXCELLENT | "The IMF acted as both rescuer and destabilizer in the Asian Financial Crisis. It provided $117B in emergency loans but conditioned aid on austerity and capital market liberalization — policies that deepened the recession by 15-20% GDP. The IMF maintained this approach because its institutional framework, designed for current account crises, misdiagnosed the capital account crisis occurring. This misdiagnosis-as-policy became the template BRICS nations later cited for governance reform." |

### Aliases: only supported names; an empty array is valid

| Quality | Entity | Aliases |
|---------|--------|---------|
| FAIL | Federal Reserve | `["Federal Reserve"]` |
| PASS | Federal Reserve | `["the Fed", "Fed"]` |
| EXCELLENT | Federal Reserve | `["the Fed", "Federal Reserve System", "US central bank"]` |

### Tags: descriptive, source-supported terms

| Quality | Entity | Tags |
|---------|--------|------|
| FAIL | Federal Reserve | `["important", "finance"]` |
| PASS | Federal Reserve | `["monetary-policy", "central-banking", "finance"]` |
| EXCELLENT | Federal Reserve | `["monetary-policy", "central-banking", "finance", "interest-rate-policy", "decision-maker", "dollar-hegemony"]` |

### Category: one of 14 fixed

The 14 categories:
```
Person, Organization, Place, Event, Concept, System,
Process, Technology, Law, Agreement, Metric, Document,
Resource, Other
```

**Decision guide when ambiguous:**
- "US-China Trade War" — Event (bounded period) or Process (ongoing mechanism)? → Check how the TEXT treats it.
- "GDP" — Metric (what it measures) or Concept (the idea of GDP)? → Metric if numbers are discussed, Concept if the idea itself is analyzed.
- "The Internet" — Technology (infrastructure) or System (network of networks)? → Technology if discussing the technical artifact, System if discussing the ecosystem.

**"Other" is a last resort.** If more than 10% of entities are "Other," reconsider your categorization.

---

## Relationship Quality

### Count: whatever the source supports

Relationships may be an empty array. Include a connection only when an exact source quote supports it; do not create transitive or implied claims that the source does not support.

### Description: explain the supported connection without padding

| Quality | Example |
|---------|---------|
| FAIL (30 chars) | "Saudi Arabia influences oil." |
| PASS (90 chars) | "Saudi Arabia regulates global oil prices through OPEC production quotas and spare capacity leverage." |
| EXCELLENT (160 chars) | "Saudi Arabia regulates global oil prices through OPEC production quotas, using spare capacity of 2-3M barrels/day as a price stabilization mechanism — cutting production during gluts, increasing during shortages." |

### Evidence: exact quote from source

| Quality | Example |
|---------|---------|
| FAIL | "The document mentions this." |
| FAIL | "Saudi Arabia controls oil prices through production quotas." (paraphrase, not quote) |
| PASS | "Saudi Arabia's ability to unilaterally increase production by up to 3 million barrels per day gives it effective veto power over OPEC pricing decisions." |

### relType: specific verb

| Quality | Example |
|---------|---------|
| FAIL | `RELATES_TO` (generic, says nothing) |
| PASS | `REGULATES` |
| EXCELLENT | `REGULATES` with description explaining the mechanism |

### causalClassification: one of 15 families

```
CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON,
CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH,
COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES,
CONSUMES, IMPLEMENTS
```

Choose the family that captures the NATURE of the relationship. Don't default to INFLUENCES for everything — it's the catch-all that hides specificity.

### Edge Tags: 1-4, kebab-case, thematic

| Quality | Example |
|---------|---------|
| FAIL | `["edge"]` |
| PASS | `["oil-pricing"]` |
| EXCELLENT | `["oil-pricing", "market-control"]` |

---

## Causal Chain Quality

### Count: optional

Some documents contain no causal mechanisms. Use an empty array in that case. Every included chain link must reference an evidence-bearing relationship in the same extraction.

### Link Explanations: system mechanics

| Quality | Link: A → B | Explanation |
|---------|------------|-------------|
| FAIL | Saudi Arabia → Oil Price | "This affects oil prices." |
| PASS | Saudi Arabia → Oil Price | "Saudi production cuts reduce global supply by 5-8%, causing prices to rise 15-30%." |
| EXCELLENT | Saudi Arabia → Oil Price | "Saudi production cuts reduce global supply by 5-8%, causing prices to rise 15-30%. Because the kingdom holds 2-3M barrels/day of spare capacity, it can make these adjustments without damaging its own long-term production infrastructure." |

### Chain Length: supported links only

Included chains need at least one supported link. Do not extend a chain beyond the evidence.

---

## Project Metadata Quality

### Summary: nonempty and proportionate to the source

The summary is NOT a book report. It's a systems description.

| Quality | What's Wrong |
|---------|-------------|
| FAIL | "This document discusses Saudi Arabia and oil." (10 words) |
| FAIL | "This document provides a comprehensive analysis of the oil market and its implications for global geopolitics..." (flowery, says nothing specific, no mechanics) |
| PASS | A concise summary of the findings actually supported by this document |

### Narrative Flow: supported ordered moments, or an empty array

| Quality | Example |
|---------|---------|
| FAIL | `["Saudi Arabia", "Oil", "OPEC"]` (not moments, just keywords) |
| PASS | `["1973 oil embargo establishes OPEC leverage", "Petrodollar recycling creates dollar dependency", "Spare capacity becomes geopolitical tool", "BRICS challenge emerges"]` |

### Tags: domain + subdomain + base_tags[]

```json
{
  "domain": "geopolitics",
  "subdomain": "energy-geopolitics",
  "base_tags": ["oil-pricing", "OPEC", "petrodollar", "energy-security", "dollar-hegemony"]
}
```

### Thesis + Key Question

Both must be specific to THIS document's argument.

| Field | FAIL | PASS |
|-------|------|------|
| thesis | "Oil is important." | "Saudi Arabia's control of oil production capacity creates geopolitical leverage independent of military or diplomatic power." |
| keyQuestion | "What is oil?" | "How does Saudi Arabia's spare oil capacity translate into geopolitical influence?" |

---

## Quick Validation Checklist

Before submitting extraction, verify:

- [ ] At least one source-supported entity with a nonempty definition and role
- [ ] Aliases contain only supported names; an empty array is allowed
- [ ] Descriptive tags reflect the document; no fabricated context
- [ ] Every entity has a category from the 14 fixed set
- [ ] Roles have stance + mechanics + reasoning
- [ ] Relationships contain only supported connections; an empty array is allowed
- [ ] Every relationship has an exact evidence quote
- [ ] Every relationship has 1-4 tags
- [ ] Every relationship has relType + causalClassification
- [ ] Causal chains are optional; every included link references an evidence-bearing relationship
- [ ] Chain explanations describe mechanisms, not outcomes
- [ ] Summary is nonempty and proportionate to the document
- [ ] Narrative flow contains supported moments or is empty
- [ ] Thesis is specific (not "this is about X")
- [ ] Key question is answerable from the content
- [ ] Geographic focus and historical period are specific
- [ ] Not all entities are "Other" category
- [ ] No generic tags ("important", "relevant", "key")
