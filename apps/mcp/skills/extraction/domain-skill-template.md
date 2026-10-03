# Domain Skill Template

Use this template when you encounter a specialized domain and need to create extraction guidance. This template ensures every domain skill has the same structure, making them predictable and composable.

**When to create a domain skill:**
- Text is from a specialized field (biology, code, law, military, etc.)
- General extraction guidance misses domain-specific patterns
- The same domain will likely appear in future extractions

**Where to save:** `instructions/{domain-name}.md` (e.g., `instructions/molecular-biology.md`)

---

## Template (copy and fill)

```markdown
# {Domain Name} Extraction Skill

Domain-specific guidance for extracting knowledge graphs from {domain} content.
This skill is ADDITIVE — it maps domain concepts to existing categories.
It does NOT change the extraction format, schema, or validation rules.

---

## 1. Domain Overview

What makes {domain} content distinctive for knowledge graph extraction:
- {Key characteristic 1: e.g., "Geopolitical texts describe power dynamics between state and non-state actors"}
- {Key characteristic 2: e.g., "Relationships are often indirect — A pressures B through C"}
- {Key characteristic 3: e.g., "Temporal context is critical — the same relationship can flip meaning across decades"}

Common source types: {journal articles, policy papers, technical docs, legislative text, etc.}

---

## 2. Entity Mapping

How domain-specific concepts map to the 14 universal categories:

| Domain Concept | Category | Why | Example |
|---------------|----------|-----|---------|
| {domain thing} | {one of 14} | {why this category fits} | {concrete example} |
| {domain thing} | {one of 14} | {why this category fits} | {concrete example} |
| ... | ... | ... | ... |

### Entities to Always Look For
In {domain} content, these entity types are frequently important but easy to miss:
- {Entity type 1: e.g., "Enforcement mechanisms — these are often described implicitly"}
- {Entity type 2: e.g., "Intermediary organizations — mentioned in passing but structurally critical"}
- {Entity type 3: e.g., "Metrics/indicators — often embedded in sentences, not called out"}

### Entities to Be Cautious About
- {Entity type to avoid: e.g., "Don't extract every country mentioned — only those with active roles"}
- {Entity type to avoid: e.g., "Passing references to historical figures are not entities unless they have agency in the argument"}

---

## 3. Relationship Patterns

Common relationship patterns in {domain} content:

### High-Frequency Patterns
| Pattern | relType | causalClassification | Example |
|---------|---------|---------------------|---------|
| {pattern} | {verb} | {family} | {A --[verb]--> B} |
| {pattern} | {verb} | {family} | {A --[verb]--> B} |
| ... | ... | ... | ... |

### Domain Verbs → Causal Families
{Domain} texts use specific verbs. Map them to causal classification families:

| Domain Verb | Maps To | Example |
|------------|---------|---------|
| {domain verb} | {one of 15 families} | {"X sanctions Y" → BLOCKS} |
| {domain verb} | {one of 15 families} | {"X ratifies Y" → IMPLEMENTS} |
| ... | ... | ... |

### Indirect Relationships
In {domain}, relationships are often mediated:
- {Pattern: e.g., "A doesn't directly affect C, but A pressures B, and B's response affects C"}
- Extract BOTH the direct link (A→B) AND the indirect consequence (B→C)

---

## 4. Quality Expectations

### Definitions in {Domain}
{Domain}-specific guidance for writing entity definitions:
- {Guidance: e.g., "For treaties, always include: parties, year signed, what it governs, enforcement mechanism"}
- {Guidance: e.g., "For institutions, always include: mandate, governance structure, key powers"}
- {Guidance: e.g., "For metrics, always include: what it measures, who publishes it, normal range"}

### Roles in {Domain}
{Domain}-specific guidance for writing roles:
- {Guidance: e.g., "For state actors, always specify: stance, leverage mechanism, and strategic objective"}
- {Guidance: e.g., "For processes, always specify: who initiates, who is affected, what the mechanism is"}

### Evidence in {Domain}
- {Guidance: e.g., "Prefer quotes that show the mechanism, not just the outcome"}
- {Guidance: e.g., "If source uses statistics, include the specific numbers in the evidence quote"}

---

## 5. Common Pitfalls

Mistakes commonly made when extracting {domain} content:

| Pitfall | Why It Happens | How to Avoid |
|---------|---------------|-------------|
| {pitfall} | {reason} | {fix} |
| {pitfall} | {reason} | {fix} |
| {pitfall} | {reason} | {fix} |

---

## 6. Tag Vocabulary

Recommended tags for {domain} content:

### Thematic Tags
{domain-specific-tag-1}, {domain-specific-tag-2}, {domain-specific-tag-3},
{domain-specific-tag-4}, {domain-specific-tag-5}

### Functional Tags (common in this domain)
{functional-tag-1}, {functional-tag-2}, {functional-tag-3}

### Temporal Tags (if domain has distinct eras)
{era-tag-1}, {era-tag-2}
```

---

## Guidelines for Filling the Template

1. **Section 2 (Entity Mapping)** is the most important. This is where domain knowledge translates to our universal schema. Aim for 8-15 mappings.

2. **Section 3 (Relationship Patterns)** should include 5-10 high-frequency patterns. Focus on patterns that are NON-OBVIOUS — don't list "A CAUSES B" since that's universal.

3. **Section 5 (Common Pitfalls)** should have at least 3 entries. These are the mistakes you actually made or would make extracting this domain. Be honest about what's hard.

4. **Section 6 (Tag Vocabulary)** provides a starting vocabulary so tags are consistent across documents in the same domain. 10-15 tags is sufficient.

5. **Keep it under 300 lines.** A domain skill is a reference, not a textbook. If it's too long, Claude won't read it effectively.

6. **Test with real text.** After creating a domain skill, mentally walk through extracting a paragraph from that domain. Does the skill help you make better decisions? If not, revise.
