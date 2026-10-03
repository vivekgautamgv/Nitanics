# Knowledge Graph Theory Foundation

You are building a knowledge graph from text. Not summarizing. Not retrieving. BUILDING A STRUCTURED REPRESENTATION OF HOW THE WORLD WORKS — entities, their relationships, the mechanisms that connect them, the evidence that supports each claim, and the biases that shape the source.

This file has three parts:
- **Part 1: The Theory** — The academic foundations, explained plainly
- **Part 2: The Lenses** — How to SEE text like a detective, not a summarizer
- **Part 3: The Application** — How we apply all of this in MemoryTonic

---

# PART 1: THE THEORY

---

## 1. What Is a Knowledge Graph?

A knowledge graph is a network of **entities** (things) and **relationships** (connections between things) that captures not just data but MEANING. A database stores "Federal Reserve" and "Interest Rates" as rows. A knowledge graph stores that the Federal Reserve CONTROLS interest rates, that this relationship is FOUNDATIONAL to the US monetary system, that the evidence is a specific quote, and that this control mechanism operates through the Federal Open Market Committee setting the federal funds rate.

The difference between a knowledge graph and a pile of facts is STRUCTURE. Structure reveals what no single fact contains — patterns, gaps, contradictions, and hidden connections that only emerge when knowledge is organized as a connected system.

---

## 2. Why Knowledge Graphs Beat Plain RAG

RAG (Retrieval Augmented Generation) works like this:
```
Question → Vector search → Find similar text chunks → Feed to LLM → Answer
```

The problem: vector search retrieves text that SOUNDS similar, not text that IS connected. Ask "How does Saudi oil production affect the US economy?" and RAG might find a paragraph about Saudi oil and a paragraph about the US economy — but miss the causal chain that connects them through OPEC quotas → global supply → price transmission → consumer prices.

**Knowledge graphs solve this:**

```
Question → Find relevant entities → Traverse relationships → Follow causal chains
  → Discover multi-hop connections → Answer with STRUCTURAL understanding
```

| Capability | RAG (Vector Only) | Knowledge Graph | Our Hybrid |
|-----------|-------------------|-----------------|------------|
| "Find documents about oil" | Good (semantic match) | OK (entity search) | Best (both) |
| "How does A connect to B?" | Fails (no structure) | Excellent (path traversal) | Excellent |
| "What's missing in my research?" | Impossible | Possible (gap detection) | Possible |
| "What changed between 1973 and 2024?" | Poor (temporal blind) | Good (temporal edges) | Good |
| "What contradicts what?" | Poor | Good (conflicting roles) | Good |
| "What connects these 3 projects?" | Impossible | Excellent (bridge entities) | Excellent |
| "How does this cause that?" | Poor | Excellent (causal chains) | Excellent |

**Our system does BOTH — this is the hybrid advantage:**

```
FULLTEXT SEARCH ──→ Exact name/keyword matches (ms speed)
       +
VECTOR SEARCH ───→ Semantic similarity via BERT 384d embeddings (finds conceptually related)
       +
GRAPH TRAVERSAL ─→ Follow relationships, paths, chains (finds structurally connected)
       +
GDS ALGORITHMS ──→ PageRank, Betweenness, Similarity (finds important + bridging)
       =
MULTI-MODE DISCOVERY that no single approach can match
```

When Claude calls `memorytonic_search`, it can use fulltext, semantic, or hybrid mode. When it calls `memorytonic_recall`, it gets GraphRAG — entities + their connections + causal chains + project context. When it calls `memorytonic_find_paths`, it traverses the actual graph structure. When it calls `memorytonic_gaps`, it identifies what's MISSING.

**This is why extraction quality matters so much.** The graph is only as powerful as what you put in it. Thin definitions → weak vector search. Missing relationships → broken paths. Missing aliases → missed bridges. Every shortcut in extraction degrades every downstream capability.

---

## 3. Ontology (What Exists and How It's Organized)

In philosophy, ontology asks: "What kinds of things exist?" In knowledge engineering, an **ontology** is a formal description of the types of things in a domain, their properties, and the relationships between them.

Think of it as the BLUEPRINT for your knowledge graph:
- What CATEGORIES of things can exist? (Person, Organization, Event...)
- What PROPERTIES can things have? (name, definition, role...)
- What RELATIONSHIPS can connect things? (CAUSES, ENABLES, BLOCKS...)
- What RULES govern the structure? (every entity needs a category, every edge needs evidence)

### Upper Ontologies

Academic ontologies start with very abstract categories and work down:

**BFO (Basic Formal Ontology)** divides everything into:
```
Entity
├── Continuant (things that persist)
│   ├── Independent Continuant (exists on its own: a person, a rock)
│   ├── Dependent Continuant (depends on something else: a color, a role)
│   └── Spatial Region (a location)
└── Occurrent (things that happen)
    ├── Process (unfolds over time: a war, a reaction)
    ├── Process Boundary (the start or end of a process)
    └── Temporal Region (a time period)
```

**DOLCE** adds:
```
├── Abstract (concepts, numbers, plans, theories)
├── Quality (properties: weight, importance)
└── Social Object (conventions: laws, organizations, agreements)
```

**For us:** Our 14 entity categories are a simplified practical ontology:
- **Continuants** → Person, Organization, Place, Technology, Resource
- **Occurrents** → Event, Process, Agreement, Law
- **Abstractions** → Concept, System, Metric, Document, Other

When you categorize an entity, you're making an ontological claim about what KIND of thing it is. Ask: "Does it persist? Does it happen? Or does it exist only as a concept?"

### Ontological Commitment

When you build a knowledge graph, you make an "ontological commitment" — you decide what exists in your world. Our commitment: 14 categories, 15 causal relationship types, mandatory evidence, mandatory definitions. Anything outside this commitment is excluded. This forces clarity.

---

## 4. RDF and the Triple (The Atomic Unit of Knowledge)

RDF (Resource Description Framework) is the foundational data model of the semantic web. Its core idea:

**Everything is a triple: Subject → Predicate → Object**

```
Federal Reserve  --[CONTROLS]-->  Interest Rates
```

Every fact in the world can be expressed as a triple. A knowledge graph is a collection of triples.

### Why Triples Work

Triples are composable. Chain them:
```
Federal Reserve  --[controls]-->  Interest Rates
Interest Rates   --[influences]-->  Housing Market
Housing Market   --[affects]-->  Consumer Spending
```

Now you have a causal chain. Each link is independently verifiable. The chain emerges from composition. This is more powerful than a paragraph that says "The Fed affects consumer spending" — the graph shows you the MECHANISM, step by step.

### Reification (Statements About Statements)

In RDF, "reification" means making a statement ABOUT a statement. Instead of just "A controls B," you can express "The claim that A controls B is disputed by source X."

We handle this through metadata on every triple:
- **evidence:** the exact quote supporting the claim
- **evidenceStrength:** established | claimed | disputed | speculative
- **magnitude:** foundational | significant | marginal
- **assertionType:** factual | analytical | opinion | prediction

This is triple-with-metadata — the same concept as reification, without RDF syntax.

**Our reification metadata on every relationship:**
- **evidence:** the exact quote supporting the claim
- **evidenceStrength:** established | claimed | disputed | speculative
- **magnitude:** foundational | significant | marginal

Note: We capture epistemic nuance (factual vs analytical vs opinion) through the **evidenceStrength** field and through richer **description** text — not through separate assertion type fields. When you notice an analytical interpretation vs a factual claim, encode that distinction in evidenceStrength and write a more precise description.

---

## 5. OWL (Classes, Properties, and Reasoning)

OWL (Web Ontology Language) builds on RDF to add structure and logic. You don't need OWL syntax, but its CONCEPTS are fundamental.

### Classes and Hierarchies

OWL organizes entities into classes with inheritance:
```
Thing → Agent → Organization → Government → Central Bank
```

**For us:** We use a FLAT 14-category system. Deep hierarchies create classification debates ("Is the Fed a GovernmentAgency or a QuasiGovernmentalOrganization?") that add complexity without insight. The richness comes from definitions and roles, not sub-categorization.

### Properties and Constraints

OWL defines what properties entities can have:
- **Domain:** "CONTROLS can only have an Organization or Person as source"
- **Range:** "CONTROLS can only target a Resource, Process, or Metric"
- **Cardinality:** "Every entity must have exactly one category"

**For us:** These constraints live in validate_project.py (30+ rules). Code enforces what OWL would enforce with formal logic.

### Reasoning and Inference

OWL enables automated reasoning — if A IS_A B and B CONTROLS C, then A CONTROLS C.

**For us:** YOU are the reasoning engine. When you see that A controls B and B determines C, you should ALSO extract A→C if the text supports it. Think like a reasoner — follow implications.

---

## 6. Taxonomy (Classification Systems)

A taxonomy is a hierarchical classification — things organized into groups and subgroups. The IS-A relationship is the backbone:

```
Federal Reserve  IS_A  Central Bank  IS_A  Financial Institution  IS_A  Organization
```

**For us:** Our 14 categories form a flat taxonomy. We avoid deeper hierarchies because:
1. Our scale doesn't need it
2. Depth creates debates that slow extraction
3. The tag system provides thematic clustering instead

### Polyhierarchy

Sometimes a thing belongs to multiple categories. "The Internet" could be Technology AND System.

**Our rule:** One category per entity. Choose what matches how the SOURCE TEXT treats it. Tags handle the multi-dimensional aspect.

---

## 7. Semantics (What Gives Meaning)

Semantics is the study of meaning. In knowledge graphs, meaning comes from three sources:

### Structural Semantics (meaning from position)
An entity's meaning is partly defined by its connections:
```
Federal Reserve → connected to: US Dollar, Interest Rates, Treasury
                → bridge between: Bretton Woods project, 2008 Crisis project
                → high PageRank = structurally important
```
The Fed's meaning EMERGES from its connections. More relationships = richer meaning.

### Lexical Semantics (meaning from words)
"Controls" vs "influences" vs "regulates" — each implies different power dynamics. Choose precise verbs. Vague language produces vague analysis.

### Contextual Semantics (meaning from context)
"Bank" in finance ≠ "bank" in geography. "Reserve" in monetary policy ≠ "reserve" in military. Always resolve using the document's context.

---

## 8. Context in Knowledge Graphs

The same entity exists differently in different documents.

### Named Graphs

In RDF, a "named graph" is a set of triples belonging to a specific context:
```
GRAPH "Bretton Woods":  IMF --[stabilizes]--> Global Markets
GRAPH "BRICS Challenge": IMF --[obstructs]--> Developing Nations
```

Both are true — in their contexts.

**For us:** Each project IS a named graph. Entity definitions are context-free (general truth). Entity roles are context-bound (this document's perspective). Cross-document role variation IS the research insight.

### Temporal Context

Knowledge changes over time:
- "Soviet Union IS_A Superpower" — true until 1991
- "SWIFT IS_A Neutral Payment System" — true until US sanctions weaponized it

Relationships need year/period fields. Historical facts aren't current truths.

---

## 9. Epistemology (How We Know What We Know)

Ontology asks "what exists?" Epistemology asks "how do we KNOW it exists?" and "how confident should we be?"

This is critical because **these knowledge graphs will be shared publicly**. A reader who didn't extract the data needs to understand: Is this fact? Opinion? Speculation? Whose perspective? What evidence supports it?

### The Knowledge Hierarchy

```
DATA        → "GDP is $25.5 trillion"               (raw measurement)
INFORMATION → "US has the world's largest GDP"       (data in context)
KNOWLEDGE   → "US GDP dominance gives it financial   (information + understanding
               leverage in trade negotiations"        of mechanisms)
WISDOM      → "Economic dominance alone doesn't      (knowledge + judgment
               guarantee geopolitical influence"       about limits)
```

We operate at the KNOWLEDGE level. We don't just store data ("GDP = $25.5T"). We store understanding ("US GDP dominance creates financial leverage, exercised through trade negotiations and dollar hegemony"). The evidence quote grounds this in the source. The assertionType tells the reader whether this is factual, analytical, opinion, or prediction.

### Justified True Belief vs Claims

Classical epistemology defines knowledge as "justified true belief." But in research:
- We can't always verify TRUTH (is the source correct?)
- We CAN verify JUSTIFICATION (does the source provide evidence?)
- We CAN track BELIEF TYPE (is this stated as fact, analysis, or opinion?)

**Our epistemological framework on every relationship:**

| Field | What It Captures | Example |
|-------|-----------------|---------|
| `evidence` | JUSTIFICATION — the exact quote | "Saudi spare capacity of 3M bbl/day..." |
| `evidenceStrength` | CERTAINTY — how established is this? | established / claimed / disputed / speculative |
| `magnitude` | SIGNIFICANCE — how important? | foundational / significant / marginal |
| `description` | MECHANISM — how does this work? | Nonempty explanation of the mechanism the source supports |

### Source Awareness (Thinking Lens, Not Fields)

When reading a document, consider the SOURCE — but encode that awareness in EXISTING fields:

| What You Notice | Where It Goes |
|----------------|---------------|
| The document is an academic paper presenting verifiable data | evidenceStrength: **established** |
| The document is an opinion piece with subjective analysis | evidenceStrength: **claimed** for interpretations |
| The claim is contested by other sources | evidenceStrength: **disputed** |
| The claim is a forward-looking prediction | evidenceStrength: **speculative** |
| The source has a specific institutional perspective | Note in the project **summary** and entity **roles** |
| The author's framing emphasizes certain actors over others | Be aware — extract entities the text IMPLIES, not just foregrounds |

A relationship backed by an exact data quote with established evidenceStrength is epistemologically stronger than one paraphrasing an opinion. The **evidenceStrength** field is your primary epistemic tool. The **description** field lets you note mechanism nuances. The project **summary** can note source limitations.

### Subjectivity and Bias

Every source has a perspective. A Western think tank analyzing China's Belt and Road Initiative writes from a different epistemological position than a Chinese state media outlet covering the same topic. Neither is "wrong" — but both carry perspective.

**For extraction:**
- When the text presents a FACT (verifiable, data-backed) → assertionType: `factual`
- When the text presents ANALYSIS (reasoned interpretation of facts) → assertionType: `analytical`
- When the text presents OPINION (value judgment, subjective view) → assertionType: `opinion`
- When the text presents PREDICTION (forward-looking claim) → assertionType: `prediction`

**At the project level:**
- sourceType tells the reader WHAT the document is
- sourcePerspective tells the reader WHERE the document is coming from

This doesn't judge the source. It gives the reader the epistemological tools to judge for themselves.

---

## 10. Temporal Intelligence (Time Permeates Everything)

Time isn't just "when did this happen?" Time ORGANIZES knowledge. It provides sequence, causation, relevance, and expiration.

### Five Dimensions of Temporal Awareness

**1. Historical Time (dates and periods)**
When did this happen? When was this true?
```
Edge: US --[FUNDS]--> Mujahideen
Period: "1979-1989"
```
This relationship has a temporal BOUND. It was true during the Soviet-Afghan War. It's not true now. Without the period, the graph presents it as timeless.

**2. Causal Sequence (what caused what, in order)**
Things happen in order. A leads to B leads to C. Our causal chains capture this:
```
Oil Embargo (1973) → Petrodollar Agreement (1974) → Dollar Hegemony (1975-present)
```
Each link has temporal ordering. The chain shows not just THAT A caused C, but the PATH through B.

**3. Entity Temporal Relevance (when was this entity active?)**
Entities have lifespans of relevance:
```
Entity: "Soviet Union"
temporalRelevance: "1922-1991"

Entity: "European Union"  
temporalRelevance: "1993-present"

Entity: "Bretton Woods System"
temporalRelevance: "1944-1971"
```
This tells the reader (and the Research Agent) when this entity MATTERS. A query about modern finance shouldn't weight the Bretton Woods System as heavily as one about post-war order.

**4. Process Order (sequence without dates)**
Not everything has dates. A technical process, a legislative pipeline, an organizational workflow — these have SEQUENCE but not historical timestamps:
```
Temporal Phases (index-based):
  Phase 1: "Problem identification" 
  Phase 2: "Policy proposal"
  Phase 3: "Legislative debate"
  Phase 4: "Implementation"
  Phase 5: "Enforcement"
```
This is "fake temporal order" — it's not about WHEN, it's about SEQUENCE. Process entities and non-historical content use index-based ordering.

**5. Information Organization (temporal flow of the argument)**
The source document itself has a temporal flow — it presents ideas in an order that builds understanding:
```
First the author establishes X → then introduces complication Y → 
  then reveals mechanism Z → then draws conclusion W
```
Our narrative_flow field captures this: the ordered key moments that explain the arc of the document. This isn't historical time — it's argumentative time.

### Temporal Markers on Everything

| Element | Temporal Field | Example |
|---------|---------------|---------|
| Project | historicalPeriod | "1944-1971" |
| Entity | temporalRelevance | "1922-1991" |
| Relationship | year/period | "1973" |
| Causal chain | ordered links + periods | Link 1 (1973) → Link 2 (1974) → Link 3 (1975-present) |
| Temporal phase | index + label + period | Phase 1: "Pre-war context (1930-1939)" |
| Entity first appearance | first_appearance_index | Links entity to its temporal phase |
| Narrative flow | ordered moments | How the argument unfolds |

**The principle:** When in doubt, add temporal context. A relationship without a time marker floats in an undefined present. A relationship anchored to "1973-1979" is grounded knowledge.

---

## 11. KG Embeddings (Structure as Vectors)

Knowledge graph embeddings convert graph structure into numerical vectors.

### Text Embeddings (What We Use)
Encode the WORDS in definitions/roles as 384-dimensional vectors:
```
"Federal Reserve" → [0.12, -0.34, 0.56, ...] (384 numbers)
```
Good for: "find entities SIMILAR IN MEANING"

### Graph Embeddings (Academic, Not Yet For Us)
Encode the STRUCTURE of connections as vectors (TransE, ComplEx):
```
vector(Fed) + vector(CONTROLS) ≈ vector(Interest Rates)
```
Good for: "predict what SHOULD be connected"

**Why we use text embeddings:** Our scale (< 1000 entities) is too small for graph embeddings. Text embeddings serve our primary use case (semantic search). At 10,000+ entities, graph embeddings become valuable.

**Tags enrich embeddings:** When we concatenate tags into embedding text ("monetary-policy dollar-hegemony quantitative-easing"), the vector captures thematic concepts that the definition alone might miss. This is why good tags improve search quality.

---

## 12. Knowledge Extraction from Text

The academic field has three core tasks:

**Named Entity Recognition (NER):** "**Janet Yellen** told the **Federal Reserve**..."
- Our spaCy NLP handles initial NER (Step 02)
- But NER alone catches ~60% of entities — misses abstracts, systems, domain-specific entities
- YOUR reasoning is the primary engine. NER is input, not output.

**Relation Extraction (RE):** Identifying "Janet Yellen [CHAIRS] the Federal Reserve"
- Academic RE uses pattern matching. You use full-text comprehension — far more powerful.
- You can identify IMPLICIT relationships no pattern matcher would catch.

**Coreference Resolution:** "the Fed" = "Federal Reserve" = "US central bank"
- The 45% rule: proper coreference eliminates nearly half of duplicates
- This is YOUR job and the #1 quality factor

---

## 13. Practical KG Systems

| System | What It Is | What We Borrow |
|--------|-----------|----------------|
| **Google KG** | 500B+ facts, powers search | Entity disambiguation by context |
| **Wikidata** | Community-built structured data | Property-based descriptions, multi-language aliases |
| **DBpedia** | Structured data from Wikipedia | Automatic extraction patterns |
| **YAGO** | Academic KG (Wikipedia + WordNet) | Temporal annotations on relationships |
| **ConceptNet** | Common-sense knowledge | Causal vocabulary (CAUSES, HAS_PREREQUISITE) — inspired our 15 families |

---

# PART 2: THE LENSES

How to SEE text. Not as a summarizer. As a detective.

---

## 14. The Detective Lens

A summarizer reads text and reports what it says. A detective reads text and understands what it MEANS — the mechanics underneath, the connections implied, the gaps left unfilled.

### See What's Not Written

Every document is a partial view. The author chose what to include and what to leave out. Your job is to extract what's there AND recognize what's missing.

**Example text:** "Saudi Arabia cut oil production by 2 million barrels per day."

**Summarizer extracts:**
```
Saudi Arabia --[REDUCES]--> Oil Production
```

**Detective extracts:**
```
Saudi Arabia --[REDUCES]--> Oil Production
  + mechanism: OPEC quota decision
  + implied: Oil Production --[DETERMINES]--> Global Oil Price
  + implied: Global Oil Price --[AFFECTS]--> Oil-Importing Nations
  + question for Research Agent: "What was the trigger? Price war? Geopolitical pressure?"
  + temporal: When? Under what conditions does Saudi Arabia make this move?
```

The detective doesn't FABRICATE — they follow implications that the text supports. The production cut implies a price impact. The price impact implies effects on importers. These are extractable relationships IF the text discusses them even indirectly.

### Follow the Mechanism

Never stop at WHAT. Always push to HOW and WHY.

| Level | What You See | What the Detective Asks |
|-------|-------------|------------------------|
| Surface | "A sanctions B" | HOW are sanctions enforced? Through what infrastructure? |
| Mechanism | "Through SWIFT restrictions" | WHO controls SWIFT? What alternatives exist? |
| System | "US controls SWIFT" | WHAT happens if an alternative emerges? (BRICS payment system) |
| Implication | "Alternatives threaten dollar hegemony" | HOW MUCH of dollar hegemony depends on SWIFT specifically? |

Each level of "how" and "why" produces another entity, another relationship, another link in the causal chain. The detective goes deeper than the summarizer.

### The Five Detective Questions

For every significant claim in the text, ask:

1. **WHO benefits?** Every system has beneficiaries. Extract them as entities with "beneficiary" functional tags.
2. **WHO loses?** Every system has those who bear the cost. Their resistance or counter-strategy is often the most interesting unexplored area.
3. **WHAT mechanism makes this work?** The HOW is always more valuable than the WHAT. Extract the mechanism as a relationship with full description.
4. **WHAT would break this?** Every system has vulnerabilities. If the text hints at them, extract them. If not, flag for the Research Agent.
5. **WHAT changed to make this happen?** Things don't exist in a vacuum. What preceded this? What enabled it? This feeds your causal chains.

---

## 15. System Thinking

Entities don't exist in isolation. They exist in SYSTEMS — networks of interdependent parts where changing one thing ripples through everything else.

### Feedback Loops

Look for cycles in the text:
```
Dollar strength → Cheap imports for US → Trade deficit grows →
  Foreign dollar reserves grow → Demand for US treasuries →
  Low US interest rates → Dollar strength (cycle repeats)
```

This is a REINFORCING feedback loop. Extract it as a causal chain. The cycle nature is the insight — it's self-perpetuating until something breaks it.

### Balancing Forces

Every system has forces pulling in opposite directions:
```
OPEC wants high prices (revenue maximization)
  vs.
Consumers want low prices (economic growth)
  →
Saudi Arabia balances both through spare capacity management
```

Extract BOTH forces and the balancing mechanism. The tension IS the system.

### Emergent Properties

Some things only exist because of the system — they don't exist in any single part:
- "Dollar hegemony" doesn't reside in any single institution
- "Systemic risk" doesn't exist in any single bank
- "Balance of power" doesn't exist in any single nation

These are **System** or **Concept** entities. They emerge from the relationships between other entities. Extract them — they're often the most important entities in the graph.

---

## 16. Investigative Curiosity

Approach every text as if you're investigating a system you need to understand well enough to explain to someone else. Not parroting the text — UNDERSTANDING the machine.

### Follow the Money
In any system involving economics, trace:
- Where does money flow FROM and TO?
- Who controls the flow?
- What happens if the flow is interrupted?
- Extract each flow as a relationship with "financial-flow" tags.

### Follow the Power
In any system involving governance or authority:
- Who makes decisions?
- Who implements them?
- Who can veto or block?
- What gives them this power?
- Extract power structures as relationships with "power-dynamics" tags.

### Follow the Dependency
In any system:
- What does A need from B to function?
- What happens if B stops providing it?
- Is there an alternative to B?
- Extract dependencies as DEPENDS_ON relationships. These reveal vulnerabilities.

---

## 17. Bias and Perspective Awareness

Every source has a perspective. Your job is not to judge whether the source is "right" — it's to make the perspective VISIBLE so readers can judge for themselves.

### Detecting Source Perspective

| Signal | What It Suggests | How to Encode |
|--------|-----------------|---------------|
| Think tank affiliation | Institutional worldview | Note in project **summary**: "Written from a Brookings / center-left policy perspective" |
| Geographic origin | Regional lens | Note in project **summary**: "Reflects US foreign policy establishment framing" |
| Funding source | Potential bias | Note in project **summary** if disclosed |
| Language choices | Framing bias | "Freedom fighters" vs "insurgents" → same entity, different framing. Write neutral **definitions**. |
| What's omitted | Selective attention | Extract entities the text IMPLIES but doesn't foreground. Research Agent detects remaining gaps. |

### Classifying Claims via Evidence Strength

The most important epistemological act in extraction is correctly classifying what KIND of claim each relationship represents — using the **evidenceStrength** field:

**Factual / Verifiable data:**
```
"China's GDP reached $17.7 trillion in 2023"
→ evidenceStrength: established (verifiable, data-backed)
```

**Analytical / Reasoned interpretation:**
```
"China's GDP growth gives it increasing leverage in trade negotiations"
→ evidenceStrength: established (widely shared analysis backed by evidence)
  OR claimed (if it's the author's interpretation without broad consensus)
```

**Subjective / Value judgment:**
```
"China's economic model is unsustainable"
→ evidenceStrength: claimed (author's opinion, not independently verified)
```

**Predictive / Forward-looking:**
```
"China will overtake the US as the world's largest economy by 2030"
→ evidenceStrength: speculative (prediction, not established fact)
```

**Contested claims:**
```
"Sanctions were effective in bringing Iran to the table"
→ evidenceStrength: disputed (contested by other analysts)
```

**The key:** When you notice the text presents an interpretation rather than a fact, use evidenceStrength to signal this. Write a more precise **description** that captures the mechanism AND any qualifications. The reader sees the evidence quote + the strength classification and can judge for themselves.

---

# PART 3: THE APPLICATION

---

## 18. Our Ontological Commitment (14 Categories)

### Continuants (things that persist)

| Category | What It Is | Example |
|----------|-----------|---------|
| **Person** | Individual human | Janet Yellen, Xi Jinping |
| **Organization** | Group with structure and purpose | Federal Reserve, OPEC |
| **Place** | Geographic location or region | Saudi Arabia, the Eurozone |
| **Technology** | Tool, system, or technical artifact | SWIFT network, blockchain |
| **Resource** | Thing consumed, traded, or depleted | Crude oil, US dollar |

### Occurrents (things that happen)

| Category | What It Is | Example |
|----------|-----------|---------|
| **Event** | Specific thing that happened | 2008 Financial Crisis |
| **Process** | Ongoing activity or mechanism | Quantitative easing |
| **Agreement** | Formal arrangement | Paris Climate Accord |
| **Law** | Codified rule or regulation | Dodd-Frank Act |

### Abstractions (things that are thought)

| Category | What It Is | Example |
|----------|-----------|---------|
| **Concept** | Idea, theory, or framework | Dollar hegemony |
| **System** | Abstract structure with parts | The petrodollar system |
| **Metric** | Measurable quantity | GDP growth rate |
| **Document** | Published work | IMF World Economic Outlook |

---

## 19. Coreference Resolution (The 45% Rule)

Same entity, different names. Catch them all.

| Text says | Same entity as | Pattern |
|-----------|---------------|---------|
| "the Fed" | "Federal Reserve" | Abbreviation |
| "Beijing" | "Chinese government" | Metonymy |
| "the Trump administration" | "United States" | Government as country |
| "Powell" | "Jerome Powell" | Partial name |
| "PBOC" | "People's Bank of China" | Acronym |

**Every entity needs 2-3 aliases.** A missed alias = a missed bridge = a missed research insight.

---

## 20. Triple-with-Metadata (Our Atomic Unit)

```
SUBJECT  ---[PREDICATE]--->  OBJECT
  + relType           (specific verb: FUNDS, SANCTIONS, ENABLES...)
  + causalClassification  (1 of 15 families, for filtering/coloring)
  + description       (nonempty explanation supported by the source)
  + evidence          (exact quote from source)
  + evidenceStrength  (established | claimed | disputed | speculative)
  + magnitude         (foundational | significant | marginal)
  + year/period       (temporal anchor)
  + tags              (1-4 thematic tags, kebab-case)
  + projectId         (which project this comes from)
```

A triple without metadata is an assertion. A triple with full metadata is knowledge.

---

## 21. Domain Adaptation (One Schema, Many Domains)

14 categories + 15 causal families work across ALL domains. Domain concepts MAP to existing categories:

| Domain | Domain Concept | Category |
|--------|---------------|----------|
| Geopolitics | Treaty | Agreement |
| Geopolitics | Sanctions regime | Process |
| Finance | Central bank | Organization |
| Biology | Gene | Resource |
| Technology | API | Technology |
| Code | Design pattern | Concept |

---

## 22. Quality Over Quantity (The 95% Rule)

**Missing an entity is recoverable. Hallucinating an entity corrupts the graph.**

Extract if:
1. The text gives it a ROLE in a system or argument
2. The source supports a meaningful, nonempty definition
3. Removing it would lose structural insight
4. It has AGENCY or SIGNIFICANCE, not just a passing mention

---

## Summary: What We Borrowed and What We Rejected

### Borrowed
| From | What |
|------|------|
| BFO/DOLCE ontology | Continuant/occurrent/abstraction trichotomy |
| RDF | Triple as atomic unit |
| RDF reification | Triple-with-metadata |
| OWL constraints | validate_project.py (30+ rules) |
| OWL reasoning | You are the reasoning engine |
| Taxonomy | 14 flat categories + tags |
| Named graphs | Each project = a context |
| Linked data | Bridge entities link projects |
| ConceptNet | 15 causal families |
| Epistemology | evidenceStrength + evidence quotes + magnitude |
| BERT | 384d text embeddings |
| GDS | PageRank, Betweenness, Degree, Similarity |

### Rejected
| What | Why |
|------|-----|
| Full formal ontology | Person-years of engineering |
| OWL syntax / SPARQL | Wrong stack (we use Neo4j/Cypher) |
| Deep type hierarchies | Creates debates, doesn't add insight |
| Graph embeddings | Need 10,000+ entities (we have < 1000) |
| Full provenance ontology | Relationship properties suffice |
