# Collection Analysis (Research Agent Protocol)

**The 7-phase protocol for analyzing a collection and producing actionable research insights.**

---

## When This Runs

The Research Agent is spawned when a user asks:
- "Analyze this collection"
- "What should I research next?"
- "What are the key findings?"
- "Show me the gaps"

The Research Agent has read-only access to query and analysis tools.

---

## The 7 Phases

### Phase 1: Collection Overview

**Goal:** Understand the collection's size, scope, and composition.

**Queries:**
- `memorytonic_get_collection` → project count, entity count, description
- `memorytonic_list_projects` → all projects with domain, subdomain, tags
- `memorytonic_stats` → GDS metrics status

**Output:**
```
Collection: "Global Finance Systems"
Projects: 7
Entities: 156
Relationships: 284
Causal Chains: 18
Domains: geopolitics (4), finance (2), trade (1)
Date range: 2026-03-20 to 2026-04-05
```

---

### Phase 2: Structural Analysis

**Goal:** Identify the most important entities and structural patterns.

**Queries:**
- `memorytonic_importance` → top entities by PageRank
- `memorytonic_collection_bridges` → bridge entities with tiers

**Analysis:**
1. Top 10 entities by PageRank — these define the collection's core
2. Bridge entities by tier — these connect different projects
3. Entity category distribution — what kinds of things are in this collection?

**Output:**
```
Top entities: Federal Reserve (PR: 4.2), US Dollar (PR: 3.8), IMF (PR: 3.1)
Bridges: Federal Reserve (Gold, 5 projects), IMF (Silver, 2 projects)
Categories: Organization (42), Concept (28), Place (22), System (18)...
```

---

### Phase 3: Gap Detection

**Goal:** Find what's missing.

See `gap-analysis.md` for the full gap detection protocol.

**Queries:**
- `memorytonic_gaps` → isolated entities, structural holes
- Tag distribution analysis
- Temporal coverage check

**Output:**
```
Gaps found:
1. Fiscal policy underrepresented (3/156 entities)
2. No coverage of 1980s debt crisis era
3. Entity "World Bank" isolated (degree=0)
```

---

### Phase 4: Causal Chain Analysis

**Goal:** Understand the causal mechanisms and find cross-project patterns.

**For each project:** Fetch causal chains and analyze:
1. Which chains are the most complete (longest, best-explained)?
2. Which chains overlap with chains in other projects?
3. Which chains have abrupt endings (incomplete mechanism)?

**Cross-project insight:** When two projects have chains that share bridge entities, those chains may CONNECT across projects:
```
Project A chain: Oil Embargo → Petrodollar Agreement → Dollar Hegemony
Project B chain: Dollar Hegemony → SWIFT Weaponization → Sanctions Regime

Combined: Oil Embargo → ... → Dollar Hegemony → ... → Sanctions Regime
```

---

### Phase 5: Cross-Project Reasoning

**Goal:** Analyze how entities behave differently across projects.

For each bridge entity:
1. Compare roles across projects — how does the role change?
2. Compare relationships — which relationships appear in one project but not another?
3. Identify contradictions — do projects disagree about this entity?

**Output:**
```
Entity: "Federal Reserve"
- In "Bretton Woods": Architect of international monetary order
- In "2008 Crisis": Emergency lender using unconventional tools
- In "Sanctions": Enforcement arm of dollar-based sanctions

Role evolution: From institution-builder → crisis manager → geopolitical weapon
```

---

### Phase 6: Research Suggestions

**Goal:** Ranked, specific, actionable suggestions for what to research next.

Synthesize findings from Phases 2-5 into ranked suggestions:

| Priority | Based On | Example |
|----------|---------|---------|
| **High** | Temporal gap in core area | "Add analysis of 1980s debt crisis" |
| **High** | Bridge with thin coverage | "Deepen IMF coverage in Project B" |
| **Medium** | Thematic gap | "Add fiscal policy analysis" |
| **Medium** | Missing counter-narrative | "Collection has Western perspective — add developing-world viewpoint" |
| **Low** | Data quality issue | "Entity X categorized differently across projects" |

Each suggestion should specify:
- WHAT to add (topic, focus)
- WHY it matters (what gap it fills)
- HOW it would improve the collection (which connections would emerge)

---

### Phase 7: Ontology Consistency

**Goal:** Check for data quality issues.

Check for:
1. **Category conflicts** — same entity has different categories in different projects
2. **Definition conflicts** — same entity has contradictory definitions
3. **Alias gaps** — entities that should be the same but weren't merged (look for near-name-matches)
4. **Tag inconsistency** — same concept tagged differently across projects ("monetary-policy" vs "money-policy")

---

## Presenting Results

The Research Agent should present findings in order of IMPACT:

```
## Collection Analysis: "Global Finance Systems"

### Key Findings
- 156 entities across 7 projects, 3 Gold bridges (Federal Reserve, IMF, US Dollar)
- Strong coverage of monetary policy (28 entities) and sanctions (22)
- Weak coverage of fiscal policy (3 entities) — significant gap

### Bridge Insights
- Federal Reserve (Gold): Role evolved from institution-builder → crisis manager → sanctions weapon
- IMF (Silver): Rescuer in Project A, destabilizer in Project B — tension is the insight

### Research Suggestions (ranked)
1. [HIGH] Add 1980s debt crisis analysis — temporal gap between Bretton Woods and 2008
2. [HIGH] Deepen Federal Reserve coverage in Project C — thin role despite Gold bridge status
3. [MEDIUM] Add fiscal policy document — 3 vs 28 entities compared to monetary policy
4. [LOW] Fix: "World Trade Organization" has degree=0 — missing relationships

### Data Quality
- Entity "SWIFT" categorized as Technology (2 projects) and Organization (1 project) — standardize
```
