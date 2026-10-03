# Bridge Entity Detection

**How to find and analyze entities that connect different projects — the primary cross-document insight mechanism.**

---

## What Bridges Are

Bridge entities appear in multiple projects within a collection. They reveal connections between documents that no single document contains.

| Tier | Criteria | Meaning |
|------|----------|---------|
| **Gold** | projectCount >= 3 | Major connector. Appears across 3+ research documents. |
| **Silver** | projectCount = 2 | Emerging bridge. Two documents share this entity. |
| **Bronze** | projectCount = 1 AND betweenness > 1000 | Single project but structurally critical — sits between entity clusters. |

---

## Finding Bridges

### Tool: `memorytonic_collection_bridges`

Returns bridge entities for a collection, sorted by tier and importance.

### Manual Query Pattern

```cypher
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $name})
WITH e, count(DISTINCT p) AS projectCount
WHERE projectCount > 1
RETURN e.name, e.category, projectCount, e.pageRank, e.betweenness
ORDER BY projectCount DESC, e.pageRank DESC
```

---

## Analyzing Bridges

For each bridge entity, investigate:

### 1. Role Evolution

How does this entity's role change across projects?

```
Entity: "Federal Reserve"
Project A (Bretton Woods): "Architect of the dollar-based international monetary order"
Project B (2008 Crisis): "Emergency lender deploying unconventional tools"  
Project C (Sanctions): "Enforcement mechanism for dollar-based sanctions"
```

The ROLE EVOLUTION across projects IS the research insight. Same entity, different contexts, reveals how the entity adapts.

### 2. Relationship Divergence

Which relationships exist in one project but not another?

```
Project A: Federal Reserve --[STABILIZES]--> Global Markets
Project B: Federal Reserve --[DISRUPTS]--> Emerging Markets (via rate hikes)
```

Divergent relationships reveal tensions or trade-offs.

### 3. Causal Chain Intersection

Does this bridge entity appear in causal chains from different projects?

```
Project A chain: Bretton Woods → Dollar Standard → Fed Reserve → Dollar Hegemony
Project B chain: Oil Shock → Inflation → Fed Reserve → Rate Hikes → Recession
```

Intersecting chains through the same entity reveal systemic dependencies.

---

## Bridge Quality Indicators

| Indicator | High Quality Bridge | Low Quality Bridge |
|-----------|-------------------|-------------------|
| Role richness | Detailed stance/mechanics/reasoning in each project | Thin "mentioned in X" roles |
| Alias coverage | 2-3 aliases caught the merge | Only exact name match |
| Relationship density | 5+ relationships across projects | 1-2 relationships total |
| Causal chain presence | In chains from multiple projects | Not in any chain |
| Category consistency | Same category across projects | Different categories (data quality issue) |

---

## Research Questions Bridges Answer

1. **"What connects these two research topics?"** → Find bridge entities shared between projects
2. **"What would break if this entity was removed?"** → High betweenness bridges are structural
3. **"How does X play different roles in different contexts?"** → Compare roles across projects
4. **"What's the hidden connection between A and B?"** → Path through bridge entities
5. **"What should I research next?"** → Bridges with thin roles in some projects = gaps to fill

---

## Improving Bridge Detection

Bridges depend on entity merge. Merge depends on aliases. Therefore:

- **Better aliases = more bridges** — if one project calls it "the Fed" and another "Federal Reserve," they only merge if aliases match
- **Consistent naming = more bridges** — standardize entity names across extractions
- **Tag overlap = collection suggestions** — entities with similar tags are likely bridges waiting to be discovered
