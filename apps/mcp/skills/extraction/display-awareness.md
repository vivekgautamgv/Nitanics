# Display Awareness

Your extraction output doesn't live in a JSON file. It appears on screen — in cards, in a graph, in a sidebar. Every field you write becomes a visual element that a researcher reads, clicks, or uses to navigate.

This file teaches you how your output is consumed so you write data that WORKS in the UI, not data that merely passes validation.

---

## Where Your Data Appears

```
GRAPH CANVAS                          RIGHT SIDEBAR (RSB)
+----------------------------------+  +------------------------+
|                                  |  |  ENTITY CARD           |
|    [Node]----[Edge]----[Node]    |  |  ┌──────────────────┐  |
|      |                   |       |  |  │ Name + Category   │  |
|    label               label     |  |  │ Definition        │  |
|    size = connections            |  |  │ Tags (pills)      │  |
|    color = category              |  |  │ Role (per project) │  |
|    glow = bridge tier            |  |  │ Connections list   │  |
|                                  |  |  │ Causal chains      │  |
|    [Bridge]====[Bridge]          |  |  │ Metrics bars       │  |
|    gold glow   silver glow       |  |  └──────────────────┘  |
+----------------------------------+  +------------------------+

LEFT SIDEBAR (LSB)                    PROJECT CARD
+----------------------------------+  +------------------------+
|  Filters                         |  |  Project Name          |
|  ├── Category (14 colors)        |  |  Thesis highlight      |
|  ├── Importance slider           |  |  Key Question box      |
|  ├── Bridge tier                 |  |  Source summary        |
|  ├── Edge type (15 families)     |  |  Geographic focus      |
|  └── Project filter              |  |  Historical period     |
+----------------------------------+  |  Entity count, chains  |
                                      +------------------------+
```

---

## Field-by-Field: What You Write, Where It Appears

### Entity Definition

Use a nonempty, source-supported definition proportionate to the document. A short source may support only a brief definition; the examples below are illustrative, not length requirements.

**Where it appears:** Entity card — the first thing a researcher reads when they click a node.

**The rule:** This definition must STAND ALONE. A researcher who has never read the source document should understand what this entity IS from the definition alone.

**BAD:**
```
"The IMF is an international organization."
```
Why bad: Says nothing a researcher doesn't already know. The card looks empty.

**GOOD:**
```
"The International Monetary Fund is a Bretton Woods institution that provides emergency
lending to nations facing balance-of-payments crises, conditions loans on structural
adjustment programs, and serves as the lender of last resort in the international
monetary system. Its voting structure gives disproportionate power to the US and
European founders."
```
Why good: A researcher understands the IMF's function, mechanism, and structural significance without reading the source.

---

### Entity Role (stance + mechanics + reasoning)

**Where it appears:** Right Sidebar — under each project where this entity is mentioned. When an entity appears in 3 projects, there are 3 role sections. This is how researchers see ROLE EVOLUTION.

**The rule:** Each role must answer THREE questions:
1. What is this entity's STANCE or POSITION in this document?
2. What are the MECHANICS of how it operates?
3. WHY does it hold this position? What's the reasoning?

**BAD:**
```
"The IMF plays an important role in the Asian Financial Crisis."
```
Why bad: No stance, no mechanics, no reasoning. The RSB section is a blank wall.

**GOOD:**
```
"In the Asian Financial Crisis, the IMF acted as both rescuer and destabilizer.
It provided $117B in emergency loans to Thailand, Indonesia, and South Korea,
but conditioned aid on austerity measures and capital market liberalization —
policies that deepened the recession by 15-20% GDP in affected nations. The IMF
maintained this approach because its institutional framework, designed for
current account crises, misdiagnosed the capital account crisis that was
actually occurring. This misdiagnosis-as-policy became the template that
BRICS nations later cited when pushing for IMF governance reform."
```
Why good: Stance (rescuer AND destabilizer), mechanics ($117B, conditioned on austerity), reasoning (institutional framework misdiagnosis). A researcher understands the IMF's role WITHOUT reading the source.

---

### Entity Aliases (2-3 per entity)

**Where they appear:** Nowhere visible — but they determine BRIDGE DETECTION.

Bridge entities are the most prominent visual feature in the graph:
- Gold glow (3+ projects)
- Silver glow (2 projects)
- Bronze glow (1 project, high betweenness)

Bridges are detected by matching entity names + aliases across projects. **A missed alias = a missed bridge = a missed research insight.**

**BAD:**
```
Entity: "People's Bank of China"
Aliases: ["People's Bank of China"]  ← Just the full name repeated
```

**GOOD:**
```
Entity: "People's Bank of China"
Aliases: ["PBOC", "China's central bank", "the People's Bank"]
```

Every alias you write is a potential bridge connection. Think: "How else would another document refer to this entity?"

---

### Edge Description

**Where it appears:** Connection list in entity cards. Hover tooltip on graph edges. Each row shows: `Source --[relType]--> Target: description`.

**The rule:** The description must explain HOW the relationship works mechanically. Not that it exists — HOW.

**BAD:**
```
relType: "INFLUENCES"
description: "Saudi Arabia influences oil prices."
```
Why bad: Restates the obvious. The connection row is meaningless.

**GOOD:**
```
relType: "REGULATES"
description: "Saudi Arabia regulates global oil prices through OPEC production
quotas, using spare capacity of 2-3M barrels/day as a price stabilization
mechanism — cutting production to raise prices during gluts, increasing
production to cool prices during shortages."
```
Why good: Explains the MECHANISM. A researcher understands the dynamic without reading the source.

---

### Edge Evidence (exact quote)

**Where it appears:** Blockquote under each connection row. Styled as an indented quote with source attribution.

**The rule:** EVERY relationship needs an evidence quote. This is how researchers verify your extraction. An edge without evidence is an unsourced claim.

**BAD:**
```
evidence: "The text mentions this relationship."
```
Why bad: Not a quote. The blockquote is useless.

**GOOD:**
```
evidence: "Saudi Arabia's ability to unilaterally increase production by up to
3 million barrels per day gives it effective veto power over OPEC pricing
decisions, a leverage no other member state possesses."
```
Why good: Exact quote. Researcher can verify the relationship against the source.

---

### Edge Tags (1-4 per edge)

**Where it appears:** Filter sidebar (future), collection matching, Research Agent thematic analysis.

Tags classify the THEME of the relationship, not its type (that's causalClassification).

**BAD:** `["relationship", "important"]` — generic, useless for filtering
**GOOD:** `["oil-pricing", "market-control"]` — thematic, filterable

---

### Causal Chain Explanations

**Where it appears:** CausalChainView — a step-by-step visual showing entity A → entity B → entity C with an explanation at each link.

**The rule:** Each link explanation must describe the MECHANISM of transmission. How does the effect pass from one entity to the next?

**BAD:**
```
Link: Saudi Arabia → Oil Price → US Economy
Explanation: "This affects the US economy."
```

**GOOD:**
```
Link: Saudi Arabia → Oil Price → US Economy
Explanation: "Saudi production cuts reduce global supply by 5-8%, causing oil
prices to rise 15-30%. Because the US imports 6.5M barrels/day, each $10/barrel
increase adds $24B to the annual import bill, which flows through to consumer
prices via transportation and manufacturing costs within 3-6 months."
```

---

### Project Summary

**Where it appears:** Project card — the overview that researchers read before diving into entities and relationships.

**The rule:** Adaptive to content type. System mechanics, not narrative.

For **research/geopolitical content:**
- What system is being described?
- What are the key mechanisms?
- What are the stakes and implications?
- What changed and why?

For **skill/technical content:**
- What does this skill/technology do?
- What techniques or approaches does it use?
- When should it be applied?
- What are the tradeoffs?

For **business/process content:**
- Who are the stakeholders?
- What is the process?
- What are the outcomes?
- What metrics matter?

---

### Project Thesis + Key Question

**Where it appears:** Highlighted box at the top of the project card. The thesis is the primary argument. The key question is what the research answers.

**BAD:**
```
thesis: "This document is about oil."
keyQuestion: "What is oil?"
```

**GOOD:**
```
thesis: "Saudi Arabia's control of global oil pricing through OPEC spare capacity
creates a geopolitical leverage mechanism that functions independently of military
or diplomatic power, effectively giving a single nation veto power over the global
energy market."

keyQuestion: "How does Saudi Arabia's oil production capacity translate into
geopolitical influence, and what structural vulnerabilities does this create?"
```

---

### Entity Tags (3-8 per entity)

**Where it appears:** Tag pills on entity cards. Fulltext search index. Vector embeddings. Collection matching.

See `tag-awareness.md` for full tag guidance.

---

### Project Geographic Focus + Historical Period

**Where it appears:** Pills and metadata section on project card.

```
geographicFocus: ["Saudi Arabia", "Middle East", "United States"]
historicalPeriod: "1973-2024"
```

Be specific. "Global" is only appropriate if the content genuinely covers worldwide dynamics. Most documents have a geographic center of gravity — name it.

---

## The Core Problem This Solves

Without display awareness, extraction produces:
- **Thin definitions** → Empty-looking entity cards
- **Missing evidence** → Connection blockquotes are blank
- **Weak aliases** → Missed bridges (the most prominent graph feature)
- **Generic chain explanations** → CausalChainView steps are meaningless
- **Missing project metadata** → Thesis and keyQuestion sections empty

With display awareness, every field serves its visual purpose. The graph becomes a research tool, not a data dump.

---

## Node Size = Your Connections

A node's visual size on the graph canvas is computed from:
- **PageRank (35%)** — importance based on incoming connections
- **Betweenness (25%)** — structural bridge role
- **Degree (20%)** — raw connection count
- **Project count (20%)** — how many projects mention this entity

**What this means for extraction:** Every relationship you MISS makes a node artificially small. Every alias you MISS prevents bridge detection. The visual quality of the graph is directly determined by your extraction thoroughness.

If a document discusses 5 entities but you only extract 3, the graph shows 3 small, isolated nodes instead of 5 interconnected nodes with meaningful size. The researcher sees a sparse, unhelpful visualization.

**Extract thoroughly. Connect extensively. The graph rewards completeness.**

---

## Appendix: What C02 and C03 Actually Read

### C02 Graph Studio (9 query functions)

| Function | What It Reads | Your Data That Feeds It |
|----------|-------------|------------------------|
| Q1 fetchCollectionGraph | Entity: entityId, name, category, definition, aliases, pageRank, betweenness, degree, projectCount. RELATES_TO: all 8 properties | Entities, relationships |
| Q1b fetchMentionedInEdges | Entity→Project links with MENTIONED_IN.role | Roles (per-project) |
| Q2 fetchCollectionProjects | Project: name, uniqueId, summary, domain, subdomain, baseTags, htmlPath | Project metadata |
| Q3 fetchEntityDetail | Entity ALL props + MENTIONED_IN roles + RELATES_TO all + CHAIN_LINK all + SIMILAR_TO | Everything about one entity |
| Q4 fulltextSearch | Entity: name, category, definition (via entity_fulltext index) | Definitions, aliases_text |
| Q5 findShortestPath | Entity names via RELATES_TO and MENTIONED_IN traversal | Relationships, mentions |
| Q6 fetchCausalChains | CausalChain: chainId, name, description + CHAIN_LINK: fromEntity, toEntity, orderIndex, explanation | Causal chains |
| Q7 fetchBridgeEntities | Entity: name, category, projectCount, pageRank, betweenness + tier computation | Entity metrics, aliases (for merge) |
| Q9 fetchCollections | Collection: name + computed project/entity counts | Collection assignment |

### C03 Frontend (30+ query functions)

**Directory View:** fetchAllDirectories, fetchDirectoryCollections, fetchDirectoryProjects, fetchDirectoryEntities, crossEntitySearch, fetchAllCollections

**Collection View:** fetchCollectionSummary, fetchCollectionProjects, fetchCollectionBridges, fetchCollectionRecommendations, fetchCollectionTopEntities, fetchCollectionCategories, fetchCollectionChains

**Project View:** fetchProjectDetail, fetchProjectEntities, fetchProjectRelationships, fetchRelatedProjects, fetchProjectChains, fetchProjectTimeline

**Entity View:** fetchEntityProfile (6-pass comprehensive), RSB EntityInfoCard (606 LOC), RSB ProjectInfoCard (278 LOC)

**CRUD:** createDirectory, updateDirectory, deleteDirectory, createCollection, addProjectToCollection, removeProjectFromCollection

### The Downstream Contract

If a property is not in this list, C02/C03 won't display it:

```
Entity:           entityId, name, category, definition, aliases, aliases_text,
                  role, firstAppearanceIndex, projectCount,
                  pageRank, betweenness, degree, embedding[384]

Project:          projectId, name, uniqueId, summary, narrativeFlow,
                  domain, subdomain, baseTags, htmlPath, directory,
                  embedding[384], createdAt

MENTIONED_IN:     role
RELATES_TO:       relType, causalClassification, description, evidence,
                  evidenceStrength, magnitude, year, projectId
CHAIN_LINK:       chainId, orderIndex, explanation
SIMILAR_TO:       similarity
```

**Every field you write must land in one of these properties. Anything else is invisible.**
