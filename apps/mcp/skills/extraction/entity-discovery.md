# Entity Discovery (Step 03)

**The most important extraction step. This is where you identify every component of the system the text describes.**

Read `kg-theory.md` first — it teaches you HOW to think. This file teaches you WHAT to produce.

---

## Input

- Raw text (the document)
- `03_nlp_entities.json` (NLP candidates from preprocess.py — spaCy NER + TF-IDF + co-occurrences)

## Output

`04_all_entities.json` containing:
- `entities[]` — each with name, aliases, category, definition, role, tags, first_appearance_index
- `temporal_phases[]` — ordered phases with index, label, period

---

## The 11-Step Process

### 1. Review NLP Candidates

NLP gives you a starting list. It's usually 60% useful:
- **Keep:** Entities that have ACTIVE ROLES in the text (not just mentions)
- **Discard:** Generic mentions, passing references, noise
- **Note:** NLP misses abstractions (System, Concept, Process) — these are YOUR job

### 2. Apply Ontological Thinking

For each candidate, determine what KIND of thing it is:
- **Continuant** (persists: Person, Org, Place, Tech, Resource) → definition = what it IS + how it WORKS
- **Occurrent** (happens: Event, Process) → definition = what HAPPENED + WHY
- **Abstraction** (pattern: Concept, System, Metric, Law, Agreement) → definition = what the PATTERN IS + how it OPERATES

### 3. Apply Domain Knowledge

If a domain skill is loaded (geopolitics.md, finance.md, etc.):
- Check the entity mapping table — does a domain concept map to a category?
- Check "entities to always look for" — are you missing common domain-critical entities?
- Check "entities to be cautious about" — are you over-extracting?

### 4. Apply Display Awareness

Every definition will appear on an entity card in the UI. Ask:
- "Could a researcher who has NEVER read the source document understand this entity from the definition alone?"
- If no → the definition needs more substance

### 5. Write Source-Supported Definitions

**Not a dictionary entry. A systems description.**

```
BAD:  "The Federal Reserve is a central bank." (39 chars)
GOOD: "The Federal Reserve is the US central banking system that controls 
       monetary policy through the federal funds rate, manages dollar 
       liquidity via open market operations, and serves as lender of last 
       resort to commercial banks. Its dual mandate of price stability and 
       maximum employment gives it enormous influence over the US and global 
       economy." (287 chars)
```

Rules:
- Nonempty and proportionate to what the source supports; no character quota
- System mechanics: WHAT it is + HOW it works + WHY it matters
- Context-free: true regardless of which document extracted it
- Preserve uncertainty, attribution, and limitations from the source

### 6. Write Roles (stance + mechanics + reasoning)

Roles are **per-project** — they describe what the entity does in THIS document's context. When an entity appears in multiple projects, each project has its own role.

```
BAD:  "The IMF plays an important role."
GOOD: "The IMF acted as both rescuer and destabilizer during the Asian 
       Financial Crisis, providing $117B in emergency loans while 
       conditioning aid on austerity measures that deepened the recession. 
       Its institutional framework, designed for current account crises, 
       misdiagnosed the capital account crisis occurring."
```

Three parts:
1. **Stance** — what position does it take? (rescuer AND destabilizer)
2. **Mechanics** — HOW does it operate? ($117B, conditioned on austerity)
3. **Reasoning** — WHY this position? (institutional framework misdiagnosis)

### 7. Assign Categories (14 fixed)

```
Person, Organization, Place, Event, Concept, System,
Process, Technology, Law, Agreement, Metric, Document,
Resource, Other
```

**One category per entity.** When ambiguous, choose how the SOURCE TEXT treats it:
- "The Internet" discussed as infrastructure → Technology
- "The Internet" discussed as an ecosystem → System
- Tags handle the multi-dimensional aspect

**"Other" is a last resort.** If >10% are Other, reconsider.

### 8. Create Aliases (2-3 per entity)

**This is what enables cross-project bridge detection.** Missed aliases = missed bridges = missed research insights.

Think: "How would ANOTHER document refer to this entity?"

```
"Federal Reserve"  → ["the Fed", "Federal Reserve System", "US central bank"]
"People's Bank of China" → ["PBOC", "China's central bank", "the People's Bank"]
"Belt and Road Initiative" → ["BRI", "One Belt One Road", "OBOR"]
```

**Case matters.** Entity merge is case-sensitive: "IMF" and "imf" are different.

### 9. Create Tags (3-8 per entity, kebab-case)

See `tag-awareness.md` for full guidance. Quick rules:
- Mix thematic + functional + domain tags
- No generics ("important", "relevant", "key")
- kebab-case: `monetary-policy` not `Monetary Policy`
- Check existing tags in the collection for consistency

### 10. Map Temporal Phases

Identify the temporal structure of the document:

**For historical/temporal content:**
```json
{
  "temporal_phases": [
    { "index": 0, "label": "Pre-war context", "period": "1930-1939" },
    { "index": 1, "label": "Wartime economy", "period": "1939-1945" },
    { "index": 2, "label": "Bretton Woods creation", "period": "1944" },
    { "index": 3, "label": "Post-war reconstruction", "period": "1945-1950" }
  ]
}
```

**For non-temporal content (skills, processes, technical docs):**
```json
{
  "temporal_phases": [
    { "index": 0, "label": "Problem definition", "period": "Phase 1" },
    { "index": 1, "label": "Approach design", "period": "Phase 2" },
    { "index": 2, "label": "Implementation", "period": "Phase 3" }
  ]
}
```

Temporal phases are optional. Use an empty array when the source has no supported chronology; do not invent phases from document headings.

### 11. Assign first_appearance_index

Each entity links to the temporal phase where it FIRST appears in the text:
```json
{
  "name": "Federal Reserve",
  "first_appearance_index": 2
}
```

This maps entities to a supported timeline. Use `null` when there is no supported temporal phase.

---

## Gate Checks (ALL must pass)

Before submitting `04_all_entities.json`:

| Check | Minimum | Common Failure |
|-------|---------|----------------|
| Entity count | At least one supported entity | Unsupported entities invented to meet a quota |
| Definition length | Nonempty and source-proportionate | Padding with facts absent from the document |
| Categories | From 14 fixed set | Domain-specific categories — map to universal set |
| Aliases | Array of supported names; empty allowed | Invented aliases or self-referencing aliases |
| Tags | 3-8 per entity, kebab-case | Generic tags, too few tags |
| Temporal phases | Optional; empty allowed | Invented chronology |
| No duplicates | Unique names | Same entity under different names → merge + aliases |
| Category distribution | Not all "Other" | Miscategorization — review ontological thinking |
| No generic tags | No "important", "relevant" | Tag quality — use thematic concepts |

**Gate fail → retry once with specific feedback → escalate to Main Agent.**

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Extracting every mentioned name | Only extract entities with ACTIVE ROLES — agency, significance, structural importance |
| Dictionary definitions | Add HOW it works and WHY it matters |
| Missing abstract entities | Look for Systems, Concepts, Processes — NLP misses these |
| Single alias (just the name) | Think: "What would another document call this?" |
| All entities "Organization" | Apply ontological thinking — is it really an org, or a System, Process, Agreement? |
| Phases match document sections | Phases are TEMPORAL, not structural. Map the chronology, not the headings. |
| Copy-pasting source text as definition | Definitions are your synthesis — context-free, standing alone |

---

## Entity Count Guide

| Document Type | Typical Count | Why |
|---------------|--------------|-----|
| Dense geopolitical analysis | 15-25 | Many actors, institutions, policies, mechanisms |
| Technical documentation | 10-15 | Fewer actors, more systems and processes |
| Business case study | 12-18 | Companies, people, metrics, strategies |
| Historical narrative | 15-30 | People, events, places, agreements, consequences |
| Scientific research | 10-15 | Methods, organisms, compounds, processes |

Typical counts are illustrative, not requirements. A short note may support one entity and no relationships.
