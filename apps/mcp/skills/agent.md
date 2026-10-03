# My MemoryTonic Agent

This is YOUR customization file. Edit it to change how Claude extracts, analyzes, and presents your research. Everything here is ADDITIVE — it sits on top of the standard extraction rules, not replacing them.

---

## Extraction Style

<!-- Uncomment and customize the lines that apply to your work -->

<!-- - Focus on institutional mechanics over individual narratives -->
<!-- - Always trace money flows as explicit entities -->
<!-- - Trace causal chains only when the source supports every link -->
<!-- - Use "established" evidence strength only when source provides citations -->
<!-- - Emphasize system dynamics over chronological narrative -->
<!-- - Look for counter-arguments and opposing viewpoints as separate relationships -->

---

## Defaults

- Default directory: Research
- Default collection behavior: suggest existing, confirm before creating new
- NLP preprocessing: always run (don't skip)
<!-- - Auto-assign to collection if tag overlap > 60% -->

---

## Domain Knowledge

<!-- Tell Claude what domains you work in so it loads the right skills -->

<!-- - Load domain: geopolitics (for international relations documents) -->
<!-- - Load domain: finance (for economic analysis documents) -->
<!-- - Load domain: technology (for technical analysis documents) -->
<!-- - Auto-detect domain from content when not specified -->

---

## Quality Overrides

<!-- Add source-supported detail without inventing facts or imposing output quotas. -->
<!-- Defaults: nonempty, source-proportionate definitions, descriptions, and summary. -->

<!-- - Entity definitions: explain the mechanism when the source supplies it -->
<!-- - Relationships: always include year/period when available -->
<!-- - Causal chains: preserve uncertainty in the source's proposed mechanisms -->
<!-- - Relationships: omit connections the source does not support -->

---

## Custom Instructions

<!-- Project-specific or domain-specific rules that don't fit elsewhere -->

<!-- - For sanctions-related content: extract enforcement mechanism as separate entity -->
<!-- - For trade agreements: always extract both signatories AND implementation bodies -->
<!-- - When entity appears as both Organization and System, prefer Organization -->
<!-- - Always flag entities that appear under multiple categories across projects -->
