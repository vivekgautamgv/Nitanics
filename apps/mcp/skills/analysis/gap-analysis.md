# Gap Analysis

**How to find what's MISSING in a collection — the entities, relationships, and topics that should exist but don't.**

---

## What Gaps Are

A gap is something a complete analysis SHOULD cover but the current collection DOESN'T. Gaps are the most actionable research output — they tell the user what to investigate next.

---

## Types of Gaps

### 1. Isolated Entities (Structural Gap)

Entities with degree = 0 or very low degree — they exist but aren't connected to anything.

```cypher
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $name})
WHERE e.degree IS NULL OR e.degree <= 1
RETURN e.name, e.category, e.definition, e.degree
```

**What this means:** The entity was extracted but its relationships weren't captured — or it genuinely has few connections in the source material.

**Research suggestion:** "Entity X is mentioned but barely connected. Consider extracting a document that analyzes X's role in the system."

### 2. Missing Counterparts (Semantic Gap)

Entities that SHOULD have counterparts based on domain knowledge.

| Pattern | Gap Signal | Example |
|---------|-----------|---------|
| Actor without institution | Person with no Organization connection | A leader without their government |
| Policy without enforcement | Law/Agreement with no Process/Organization enforcing it | A treaty with no enforcement mechanism |
| Cause without effect | Entity in causal chain start but chain ends abruptly | Sanctions imposed but no downstream impact extracted |
| One side of conflict | Organization A but not their adversary | NATO without Russia in a Cold War collection |

**Tool:** `memorytonic_gaps` detects these patterns.

### 3. Tag Distribution Gaps (Thematic Gap)

When a collection has strong coverage of one theme but weak coverage of a related theme.

```
Collection "Global Finance Systems":
  monetary-policy: 28 entities tagged
  trade-policy: 22 entities tagged
  fiscal-policy: 3 entities tagged  ← GAP
  sanctions-policy: 15 entities tagged
```

Fiscal policy is underrepresented relative to the collection's scope.

**Research suggestion:** "This collection covers monetary and trade policy extensively but has minimal fiscal policy coverage. Consider adding a document on government spending and taxation in the global financial system."

### 4. Temporal Gaps

Periods that should be covered but aren't.

```
Collection covers: 1944-1971 (Bretton Woods), 2008-2023 (Post-crisis)
Missing: 1971-2008 (Post-Bretton Woods to crisis)  ← GAP
```

**Research suggestion:** "There's a temporal gap between the Bretton Woods era and the 2008 crisis. Consider adding analysis of the 1971-2008 floating exchange rate period."

### 5. Cross-Project Gaps

Entities that appear in multiple projects but with inconsistent roles or missing connections between them.

```
Entity "IMF" appears in 3 projects but:
- Project A: 8 relationships, detailed role
- Project B: 2 relationships, thin role  ← GAP
- Project C: 5 relationships, good role
```

**Research suggestion:** "The IMF's role in Project B is underdeveloped compared to Projects A and C. Either the source material is thin or the extraction missed connections."

---

## Gap Detection Protocol (Research Agent)

### Phase 1: Structural Scan

1. Query all entities with degree <= 1 → isolated entities
2. Query entities with projectCount = 1 but high betweenness → underexplored bridges
3. Query causal chains with < 3 links → incomplete mechanisms

### Phase 2: Thematic Analysis

1. Aggregate entity tags → find tag distribution
2. Identify tags with < 3 entities → underrepresented themes
3. Compare tags to collection's stated scope (domain, subdomain) → coverage gaps

### Phase 3: Temporal Analysis

1. Aggregate entity temporal contexts and relationship year/period values
2. Identify covered periods vs gaps
3. Check if the collection's historicalPeriod is fully covered

### Phase 4: Cross-Project Comparison

1. For each bridge entity, compare role depth across projects
2. For each project, compare entity count and relationship density to collection average
3. Identify projects that are thinner than the average → extraction quality gap

---

## Presenting Gaps to Users

Rank gaps by **impact** — which gap, if filled, would improve the collection most?

| Impact Level | Criteria | Example |
|-------------|---------|---------|
| **High** | Bridge entity with thin role | "The Federal Reserve appears in 4 projects but has only 2 relationships in Project C" |
| **High** | Temporal gap in core period | "Collection covers 1970s and 2000s but nothing on the 1980s debt crisis" |
| **Medium** | Thematic gap in related topic | "Strong monetary policy coverage, weak fiscal policy coverage" |
| **Medium** | Isolated important entity | "OPEC extracted but not connected to any other entity" |
| **Low** | Minor cross-project inconsistency | "Entity categorized as Organization in one project, System in another" |

---

## Gap → Research Suggestion

Every gap should produce a specific, actionable research suggestion:

```
GAP:    Fiscal policy underrepresented (3 entities vs 28 for monetary policy)
SUGGEST: "Extract a document on government fiscal policy in the context of
          global finance — specifically, how fiscal deficits interact with
          monetary policy and trade dynamics."

GAP:    1971-2008 temporal gap
SUGGEST: "Add analysis of the post-Bretton Woods floating exchange rate era,
          covering the 1970s oil shocks, 1980s debt crisis, 1990s emerging
          market crises, and early 2000s globalization acceleration."

GAP:    IMF has thin role in Project B
SUGGEST: "Re-extract Project B with focus on IMF involvement, or add a
          supplementary document specifically analyzing the IMF's role in
          that context."
```
