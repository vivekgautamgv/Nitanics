# Geopolitics Extraction Skill

Domain-specific guidance for extracting knowledge graphs from geopolitical content.
This skill is ADDITIVE — it maps domain concepts to existing categories.
It does NOT change the extraction format, schema, or validation rules.

---

## 1. Domain Overview

What makes geopolitical content distinctive for knowledge graph extraction:
- **Power dynamics are the subject.** Every entity has relative power, every relationship shifts that balance. Track who has leverage over whom and WHY.
- **Relationships are often indirect.** A pressures B through C. Sanctions work because D controls the infrastructure that E depends on. Extract the full chain, not just the endpoints.
- **Temporal context flips meaning.** The same relationship (US-Saudi alliance) means different things in 1973, 1991, and 2023. Always anchor relationships with year/period.
- **Institutions are not monolithic.** "The US" might mean the State Department, Pentagon, Treasury, or White House — each with different stances. Distinguish when the text does.
- **Documents present arguments, not just facts.** Extract the THESIS (what the author argues) separately from the EVIDENCE (what facts they cite).

Common source types: policy analysis, investigative journalism, diplomatic cables, think tank reports, academic papers, OSINT reports.

---

## 2. Entity Mapping

| Domain Concept | Category | Why | Example |
|---------------|----------|-----|---------|
| Nation-state | Organization | States are structured institutions, not places | "China" (as an actor), "the United States" |
| Geographic region | Place | Physical territory or geopolitical zone | "the South China Sea", "the Sahel", "the Arctic" |
| Alliance / bloc | Organization | Group of states acting collectively | "NATO", "BRICS", "the Quad" |
| Treaty / accord | Agreement | Formal arrangement between parties | "JCPOA", "Treaty of Westphalia" |
| Sanctions regime | Process | Ongoing enforcement mechanism | "US secondary sanctions on Iran" |
| Military operation | Event | Bounded action with start/end | "Operation Desert Storm" |
| Policy doctrine | Concept | Framework guiding state behavior | "Monroe Doctrine", "One China Policy" |
| International org | Organization | Multilateral institution | "United Nations Security Council" |
| Economic indicator | Metric | Measurable geopolitical signal | "Current account deficit", "FDI flows" |
| Legislation | Law | Domestic law with international effect | "Magnitsky Act", "CHIPS Act" |
| Strategic resource | Resource | Asset that confers geopolitical leverage | "Rare earth minerals", "natural gas pipelines" |
| Intelligence apparatus | Organization | State intelligence institution | "CIA", "MSS", "Mossad" |
| Infrastructure system | Technology | Physical or digital infrastructure | "Belt and Road projects", "SWIFT network" |
| Proxy force | Organization | Non-state armed group with state backing | "Hezbollah", "Wagner Group" |
| Strategic concept | System | Abstract structure of power or order | "Nuclear deterrence", "balance of power" |

### Entities to Always Look For

- **Enforcement mechanisms** — How are agreements or sanctions actually enforced? These are usually described implicitly ("through secondary sanctions" or "via SWIFT restrictions") but are structurally critical.
- **Intermediary actors** — Countries, organizations, or systems that sit between two adversaries. Turkey between NATO and Russia. SWIFT between US policy and Iranian banks.
- **Leverage points** — Resources, infrastructure, or positions that give one actor power over another. Oil production capacity. Control of shipping lanes. Veto power in the UNSC.
- **Counter-strategies** — What are actors doing to reduce their vulnerability? De-dollarization, alternative payment systems, nuclear development.

### Entities to Be Cautious About

- **Don't extract every country mentioned.** Only countries with ACTIVE ROLES in the argument. If a text mentions 30 countries in a UN vote list, only extract those whose votes are discussed.
- **Don't extract passing historical references.** If the text says "unlike the Congress of Vienna," don't extract Congress of Vienna unless it's analyzed, not just referenced.
- **Don't split a state into 5 entities** unless the text genuinely distinguishes their different stances. "The US" is fine when the text treats it as a unitary actor.

---

## 3. Relationship Patterns

### High-Frequency Patterns

| Pattern | relType | causalClassification | Example |
|---------|---------|---------------------|---------|
| State sanctions state | SANCTIONS | BLOCKS | US --SANCTIONS--> Iran |
| State funds actor | FUNDS | ENABLES | Saudi Arabia --FUNDS--> Sunni militias |
| Alliance deters adversary | DETERS | BLOCKS | NATO --DETERS--> Russian expansion |
| Org enforces agreement | ENFORCES | REGULATES | IAEA --ENFORCES--> JCPOA |
| State controls resource | CONTROLS | REGULATES | Saudi Arabia --CONTROLS--> Oil production |
| Actor undermines system | UNDERMINES | BLOCKS | BRICS --UNDERMINES--> Dollar hegemony |
| State depends on resource | DEPENDS_ON | DEPENDS_ON | Europe --DEPENDS_ON--> Russian gas |
| Institution mediates dispute | MEDIATES | ENABLES | UN --MEDIATES--> Syria ceasefire |
| Policy triggers response | PROVOKES | CAUSES | US tariffs --PROVOKES--> Chinese retaliation |
| Alliance competes with bloc | RIVALS | COMPETES_WITH | NATO --RIVALS--> SCO |

### Domain Verbs to Causal Families

| Geopolitical Verb | Maps To | Why |
|------------------|---------|-----|
| sanctions, embargoes, blockades | BLOCKS | Prevents target from accessing something |
| allies with, partners with | COOPERATES_WITH | Mutual strategic alignment |
| rivals, contests, challenges | COMPETES_WITH | Opposing strategic interests |
| deters, threatens, warns | BLOCKS | Prevents action through threat |
| funds, arms, supplies | ENABLES | Provides capability to act |
| mediates, brokers, facilitates | ENABLES | Creates conditions for outcome |
| ratifies, signs, implements | IMPLEMENTS | Formalizes or executes agreement |
| violates, breaches, undermines | CONTRADICTS | Acts against established arrangement |
| precedes, escalates to, leads to | PRECEDES | Temporal or causal ordering |
| depends on, requires, needs | DEPENDS_ON | Structural dependency |
| regulates, governs, controls | REGULATES | Authority over target |
| transforms, reshapes, restructures | TRANSFORMS | Fundamentally changes target |

### Indirect Relationships

Geopolitical relationships are often mediated:
- **Sanctions chains:** US sanctions Iran → through SWIFT → by threatening European banks → who stop processing Iranian transactions. Extract: US→SWIFT (REGULATES), SWIFT→European Banks (REGULATES), European Banks→Iran (BLOCKS)
- **Proxy dynamics:** Saudi Arabia→Houthi conflict is really Saudi Arabia→Coalition Forces→Yemen. Extract both the direct military relationship and the proxy structure.
- **Economic leverage:** China doesn't threaten Australia militarily — it reduces coal imports. Extract the economic mechanism as the actual relationship.

---

## 4. Quality Expectations

### Definitions in Geopolitics

- **For nation-states (as actors):** Always include: form of government, strategic position, key leverage or vulnerability, population/economic scale if relevant. "China is a one-party state with the world's second-largest economy, a permanent UNSC veto, and the world's largest manufacturing base — giving it structural economic leverage over trade partners dependent on its supply chains."
- **For treaties/agreements:** Always include: parties involved, year, what it governs, enforcement mechanism, current status (active/withdrawn/expired).
- **For institutions:** Always include: mandate, member states (or describe composition), key powers (veto, sanctions authority, etc.), and governance structure.
- **For strategic concepts:** Always include: what the concept describes, who first articulated it (if known), how it operates as a system, and what would violate or invalidate it.

### Roles in Geopolitics

- For state actors: always specify **stance** (what position they take), **leverage mechanism** (what power they use), and **strategic objective** (what they're trying to achieve).
- For institutions: always specify **mandate vs actual behavior** (are they doing what they were designed to do?), and **structural power** (veto, funding, enforcement).
- For processes: always specify **who initiates**, **who is affected**, **what the mechanism is**, and **what resistance exists**.

### Evidence in Geopolitics

- Prefer quotes that show the MECHANISM, not just the outcome
- If the source uses specific numbers (troop counts, trade volumes, GDP figures), include them
- For disputed relationships, quote BOTH sides if the text presents them

---

## 5. Common Pitfalls

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|-------------|
| Treating countries as monolithic | Text says "the US" but means different agencies with different stances | Split only when the text distinguishes stances. Default to country-as-actor. |
| Missing the enforcement mechanism | Text describes sanctions but you only capture "US sanctions Iran" | Ask: HOW are these sanctions enforced? What infrastructure does enforcement use? |
| Confusing stated goals with actual effects | Text describes policy intent but you extract it as accomplished outcome | Use evidenceStrength: "claimed" for stated goals, "established" for verified outcomes |
| Extracting every bilateral relationship | 10 countries = 45 possible bilateral pairs, most not discussed | Only extract relationships the text actually ANALYZES, not those it merely implies |
| Missing temporal shifts | Same relationship means different things in different eras | Always include year/period. If the relationship changes over time, extract it at each phase. |
| Over-simplifying causal chains | "A caused B" when really A→B→C→D | Extract the full chain with intermediary steps. Geopolitical causation is rarely direct. |

---

## 6. Tag Vocabulary

### Thematic Tags
```
sanctions-policy, trade-policy, energy-policy, nuclear-policy,
foreign-policy, defense-policy, alliance-politics, proxy-conflict,
territorial-dispute, maritime-security, cyber-operations,
economic-coercion, diplomatic-relations, regime-change,
multilateral-governance, arms-control, intelligence-operations
```

### Functional Tags
```
decision-maker, enforcer, mediator, destabilizer, stabilizer,
challenger, gatekeeper, proxy, deterrent, leverage-holder,
swing-state, revisionist-power, status-quo-power
```

### Temporal Tags
```
cold-war, post-cold-war, post-9/11, post-2008, post-2020,
unipolar-moment, multipolar-transition, pre-wwi, interwar,
decolonization-era, arab-spring-era
```

### Regional Tags
```
middle-east, east-asia, south-asia, sub-saharan-africa,
eastern-europe, indo-pacific, arctic, central-asia,
latin-america, western-europe, north-africa
```
