# Discussion 11: Full Extraction Simulation

**Date:** 2026-04-09
**Purpose:** End-to-end trace of what happens when a user extracts a document — every agent, every tool call, every artifact, every Neo4j write. Grounded in real code (C01 scripts) and real artifacts (petrodollar-system extraction).

---

## The Scenario

User has MemoryTonic running. 7 projects already extracted in "Global Finance Systems" collection. User gives Claude a new document about Iran sanctions.

```
USER: "Put this in MemoryTonic"
[pastes 3000-word article about US sanctions on Iran]
```

---

## Phase A: Text Scan (Main Agent, ~2 seconds)

Main Agent does a quick scan. No tool calls — pure Claude reasoning.

```
MAIN AGENT THINKS:
  Domain:       geopolitics (sanctions, state actors, international policy)
  Key entities: United States, Iran, SWIFT, European banks, JCPOA, Treasury Dept
  Tags:         sanctions-policy, iran, dollar-hegemony, swift, energy-policy
  Type:         investigative analysis
  Source type:  think-tank (Brookings attribution in text)
  Perspective:  US policy establishment (frames sanctions as "tools" not "weapons")
```

**Output:** `{ domain: "geopolitics", keyEntities: [...], tags: [...], type: "investigative", sourceType: "think-tank", sourcePerspective: "US policy establishment framing" }`

---

## Phase B: Skill Discovery (Main Agent, ~5 seconds)

```
MAIN AGENT:
  1. Check skills/custom/ → no custom geopolitics skill
  2. Check skills/domains/ → MATCH: geopolitics.md exists (shipped)
  3. Load geopolitics.md
  4. Tell user: "Using geopolitics extraction skill"
```

**No tool calls.** Main Agent reads from MCP resources.

---

## Phase C: Smart Placement (Main Agent + User, ~30 seconds)

```
MAIN AGENT calls:
  memorytonic_collection_suggestions({
    projectName: "us-iran-sanctions",
    summary: "US sanctions regime against Iran...",
    entityNames: ["United States", "Iran", "SWIFT", "JCPOA"],
    tags: ["sanctions-policy", "iran", "dollar-hegemony"]
  })

MCP INTERNALLY:
  → Neo4j: MATCH (c:Collection) RETURN c.name, c.baseTags
  → Compare tags: "Global Finance Systems" has ["dollar-hegemony", "sanctions"] overlap
  → Return: { suggestions: [{ name: "Global Finance Systems", overlap: 2/5 }] }
```

Main Agent asks user 3 questions:

```
MAIN AGENT → USER:
  "Directory: Research (matches domain). OK?"
USER: "yes"

MAIN AGENT → USER:  
  "Collection: 'Global Finance Systems' matches 2/5 tags. Or create new?"
USER: "yes that one"

MAIN AGENT → USER:
  "Project name: 'us-iran-sanctions'. OK?"
USER: "yes"
```

**Output:** `placement = { directory: "Research", collection: "Global Finance Systems", projectName: "us-iran-sanctions", collectionIsNew: false }`

---

## Phase D: Spawn Extraction Worker (Main Agent)

Main Agent spawns a bounded subagent with:

```
MAIN AGENT → EXTRACTION WORKER (via Agent tool in Claude Code):

  You are an extraction worker. Execute the 6-step pipeline.

  INPUTS:
    raw_text:       [3000-word article]
    placement:      { directory: "Research", collection: "Global Finance Systems",
                      projectName: "us-iran-sanctions" }
    sourceType:     "think-tank"
    sourcePerspective: "US policy establishment framing"

  INSTRUCTIONS LOADED INTO WORKER CONTEXT:
    skills/maps/pipeline-map.md           ← step order, gates, failure handling
    skills/extraction/kg-theory.md        ← ontological reasoning + detective lens
    skills/extraction/quality-bar.md      ← FAIL/PASS/EXCELLENT examples
    skills/extraction/display-awareness.md ← how data appears in UI
    skills/extraction/tag-awareness.md     ← tag rules
    skills/extraction/html-template.md     ← dark theme HTML format
    skills/domains/geopolitics.md          ← domain-specific guidance
    agent.md (extraction section)          ← user preferences
```

Worker is now alive with bounded context. It executes steps 01-06.

---

## Step 01: HTML + Placement (Worker, ~15 seconds)

Worker generates two artifacts. No tool calls — pure Claude output.

### Artifact: `data/temp/us-iran-sanctions/01_html.html`
```html
<html><head><style>/* dark theme */</style></head>
<body>
  <div class="narrator-voice">
    The architecture of American sanctions against Iran...
  </div>
  <div class="gatorsquare-voice">
    The mechanism: SWIFT, the messaging system connecting 11,000 banks...
  </div>
  <!-- full article converted to dark-theme HTML with voice blocks -->
</body></html>
```

### Artifact: `data/temp/us-iran-sanctions/02_placement.json`
```json
{
  "directory": "Research",
  "project_name": "us-iran-sanctions",
  "unique_id": "us-iran-sanctions",
  "collection": "Global Finance Systems",
  "collection_is_new": false
}
```

**Gate check:** HTML file exists? ✓ Placement has all 5 fields? ✓ Proceed.

---

## Step 02: NLP Preprocessing (Worker, 5-10 seconds)

Worker makes its FIRST tool call:

```
WORKER calls:
  memorytonic_nlp_preprocess({
    text: "The architecture of American sanctions against Iran...",
    title: "us-iran-sanctions"
  })

MCP SERVER (src/tools/extraction.ts):
  → Spawns: python nlp/preprocess.py
  → stdin: { text: "...", title: "us-iran-sanctions" }
  → preprocess.py runs:
      spaCy NER: [("United States", "GPE"), ("Iran", "GPE"), ("SWIFT", "ORG"),
                   ("JCPOA", "MISC"), ("Treasury Department", "ORG"), ...]
      TF-IDF: ["sanctions", "SWIFT", "banking", "nuclear", "compliance", ...]
      Co-occurrence: [("SWIFT", "sanctions", 0.87), ("Iran", "nuclear", 0.73), ...]
      Dedup groups: [["US", "United States", "America"], ["JCPOA", "Iran nuclear deal"]]
  → stdout: JSON result
```

### Artifact: `data/temp/us-iran-sanctions/03_nlp_entities.json`
```json
{
  "entities": [
    { "text": "United States", "label": "GPE", "count": 14, "confidence": 0.97 },
    { "text": "Iran", "label": "GPE", "count": 22, "confidence": 0.99 },
    { "text": "SWIFT", "label": "ORG", "count": 8, "confidence": 0.91 },
    { "text": "Treasury Department", "label": "ORG", "count": 5, "confidence": 0.88 },
    { "text": "JCPOA", "label": "MISC", "count": 6, "confidence": 0.85 }
  ],
  "keywords": ["sanctions", "SWIFT", "banking", "nuclear", "compliance", "oil"],
  "cooccurrences": [
    { "pair": ["SWIFT", "sanctions"], "score": 0.87 },
    { "pair": ["Iran", "nuclear"], "score": 0.73 }
  ],
  "dedup_groups": [
    ["US", "United States", "America"],
    ["JCPOA", "Iran nuclear deal", "nuclear agreement"]
  ]
}
```

**Gate check:** JSON valid? ✓ Entities array present? ✓ Proceed.
(If NLP crashes: proceed without it. Claude reasoning is the primary engine.)

---

## Step 03: Entity Discovery — THE DETECTIVE STEP (Worker, 30-50 seconds)

**No tool calls.** Pure Claude reasoning. This is where quality is won or lost.

Worker has: raw text + NLP hints + kg-theory.md (detective lens) + geopolitics.md (domain skill) + quality-bar.md + display-awareness.md + tag-awareness.md

### What the Worker Does (two-phase, single Claude output)

**Detective Read Phase (internal reasoning, not a separate step):**

```
WORKER THINKS:

  SOURCE ANALYSIS:
    Type: think-tank analysis (Brookings)
    Perspective: US policy establishment — frames sanctions as "tools of statecraft"
                 not "economic warfare." Notable: never mentions humanitarian cost
                 to Iranian civilians. This absence is data.

  ENTITY CANDIDATES + QUESTIONS (15 entities):

    1. "United States" → Already in graph (bridge entity, 7 projects). Category: Place.
       QUESTION: Is the text treating US as monolithic or splitting agencies?
       → RESOLVED: text distinguishes Treasury vs State Dept vs White House.
         DECISION: Keep as single "United States" entity (text treats as primary
         actor) but extract "Treasury Department/OFAC" as separate entity with
         its own distinct enforcement role.

    2. "Iran" → Not yet in graph. Category: Place.
       QUESTION: Is Iran the government, the state, or the people?
       → RESOLVED: text treats Iran as state actor (government decisions,
         nuclear program) not as population. When text says "Iran suffers"
         it means the economy, not the people explicitly.
       INFERRED: Iran's population suffers sanctions effects that the text
         attributes to "Iran" as abstraction — the people are invisible
         in this framing. Detective notes this.

    3. "SWIFT" → Already in graph (bridge entity, 2 projects).
       QUESTION: Is SWIFT an actor or an instrument?
       → RESOLVED: text shows SWIFT as infrastructure the US CONTROLS.
         Category: Technology (not Org).
         NOTE: geopolitics.md maps "Infrastructure system" → Technology. ✓
       QUESTION: Did SWIFT comply voluntarily?
       → RESOLVED (between the lines): text says SWIFT "agreed" but also
         describes US threat to sanction SWIFT itself. Agreement under
         threat = coercion. Mark as inferredProperty.

    4. "Treasury Department/OFAC"
       QUESTION: Is this the same as "United States"?
       → RESOLVED: No — OFAC is the specific AGENCY that designates sanctioned
         entities. It has its own authority, process, and decision-making.
         Category: Organization (not Place — it's an institution within the state)
       QUESTION: Who runs OFAC? Named officials?
       → UNRESOLVED: text doesn't name OFAC leadership. openQuestion.

    5. "Secondary Sanctions" → This is a MECHANISM, not a thing.
       QUESTION: Is this an entity or a process?
       → RESOLVED: Category: Process. It's an ongoing enforcement mechanism
         with a clear how-it-works: US threatens to cut off any bank that
         processes Iranian transactions from the dollar system.
       QUESTION: When did secondary sanctions start?
       → RESOLVED: text traces to Iran-Libya Sanctions Act (1996). temporalRelevance.

    6. "European Banking System"
       QUESTION: Is this one entity or many?
       → PARTIALLY RESOLVED: text names Deutsche Bank, BNP Paribas, HSBC as
         examples but treats European banks as a COLLECTIVE that behaves
         uniformly (overcompliance). Extract as collective entity.
         aliases: ["European banks", "EU financial institutions"]
       QUESTION: Do ALL European banks comply equally?
       → UNRESOLVED: text implies uniformity but reality is probably varied.
         openQuestion.

    7. "JCPOA" → Treaty. Category: Agreement.
       QUESTION: Is it active or dead?
       → RESOLVED: text says "effectively dead since 2018 US withdrawal."
         temporalRelevance: "2015-2018 (active), 2018-present (defunct)"
       DISAMBIGUATION: Text uses "Iran deal", "JCPOA", "nuclear agreement"
         interchangeably. All become aliases.
       QUESTION: Could JCPOA be revived?
       → PARTIALLY RESOLVED: text mentions failed 2022 Vienna negotiations.
         Mark as openQuestion for ongoing relevance.

    8. "Iran Nuclear Program" → Category: Process.
       QUESTION: Is this the same as "Iran"?
       → RESOLVED: No — the nuclear program is a specific process Iran runs,
         with its own metrics (enrichment %, centrifuge count). It's the
         OBJECT that sanctions target, separate from the state itself.
       INFERRED: Iran accelerated enrichment AFTER JCPOA withdrawal — from
         3.67% to 60%. The sanctions intended to prevent this arguably caused it.

    9. "BNP Paribas" → Category: Organization.
       QUESTION: Why is one bank extracted separately from "European Banking System"?
       → RESOLVED: BNP Paribas's $8.97B fine is a PIVOT EVENT — it changed
         the behavior of the entire European banking sector. It's not just
         a bank; it's the case study that created overcompliance.
       INFERRED: The fine amount ($8.97B) was designed to be existentially
         terrifying — it's larger than most banks' annual profit. The
         deterrent message was the product, not the fine itself.

    10. "China" → Not yet in graph for this collection.
        QUESTION: Is China an actor or a context?
        → RESOLVED: China is an ACTIVE counter-strategy actor — buying
          Iranian oil in yuan, providing CIPS as SWIFT alternative,
          reducing US Treasury holdings. Category: Place (state actor).
        QUESTION: What's China's actual motivation?
        → PARTIALLY RESOLVED: text implies geopolitical competition but
          also cheap oil. Both motivations present. openQuestion for depth.

    11. "CIPS" (Cross-Border Interbank Payment System)
        → Category: Technology (payment infrastructure, parallel to SWIFT).
        QUESTION: How big is CIPS vs SWIFT?
        → PARTIALLY RESOLVED: text says 1,400+ members vs SWIFT's 11,000+.
          CIPS is growing but not yet a replacement.
        INFERRED: CIPS doesn't need to replace SWIFT — it just needs to
          process enough transactions to make sanctions leaky. The threshold
          for undermining sanctions is much lower than full replacement.

    12. "Oil Markets" → Category: System.
        QUESTION: Are oil markets an entity or a context?
        → RESOLVED: Oil markets are the MEDIUM through which sanctions
          create economic pain — Iran's oil exports dropped from 2.5M to
          0.5M barrels/day. The market IS the mechanism. Extract as System.
        QUESTION: Who buys Iranian oil now?
        → PARTIALLY RESOLVED: China, Syria, some black market. openQuestion
          for specific volumes.

    13. "Central Bank of Iran" → Category: Organization.
        QUESTION: Why extract separately from "Iran"?
        → RESOLVED: CBI is the specific institution that was sanctioned and
          disconnected from SWIFT. It has its own distinct role — managing
          currency reserves, facilitating oil payments. Its disconnection
          was the specific mechanism that collapsed Iran's trade.

    14. "INSTEX" (Instrument in Support of Trade Exchanges)
        → Category: Technology (financial mechanism).
        QUESTION: Does INSTEX actually work?
        → PARTIALLY RESOLVED: text mentions it was created by EU to
          circumvent US sanctions but only processed ONE transaction.
          Mark as openQuestion for effectiveness.
        INFERRED: INSTEX's failure suggests European sovereignty claims
          are empty — EU couldn't build a functional workaround despite
          political motivation. This is a finding about European power, not
          just about Iran.

    15. "Dollar Hegemony" → Category: System.
        → Already in graph (bridge entity from petrodollar project).
        QUESTION: Is this the same as "US Dollar" entity in other projects?
        → RESOLVED: Different. "Dollar Hegemony" is the SYSTEM of global
          dollar dominance. "US Dollar" is the currency. Dollar Hegemony
          includes SWIFT control, Treasury bond demand, forex dominance —
          it's the architecture, not the artifact.
        INFERRED: Sanctions are simultaneously a product of dollar hegemony
          AND a threat to it — each use of financial warfare accelerates
          the search for alternatives.

  SELF-RESOLVED QUESTIONS (resolved by later text):
    - "Is the text treating US as monolithic?" → NO (Treasury/OFAC extracted separately)
    - "Is SWIFT voluntary?" → NO (coercion revealed in paragraph 7)
    - "Is JCPOA alive?" → NO (withdrawal in 2018, failed 2022 revival)
    - "Who processes Iranian oil now?" → CHINA (paragraph 12)
    - "How do secondary sanctions work?" → RESOLVED in detail (paragraph 4)

  STILL OPEN (no answer in text):
    - Humanitarian cost to Iranian civilians (GDP, medicine, inflation)
    - Legal basis for extraterritorial US law application
    - INSTEX transaction volume and effectiveness
    - Full list of countries buying Iranian oil under sanctions
    - Who leads OFAC and what decision process selects targets
    - Whether European bank overcompliance is legally challengeable

  BETWEEN THE LINES (what a thinking reader sees):
    - Source never quantifies cost to Iranian civilians (GDP loss, medicine
      shortages, inflation). A detective notes: this is a US-perspective analysis
      that treats sanctions as policy tools, not as economic warfare with
      human cost. A counter-source would frame this completely differently.
    - Text says "sanctions work" but evidence is mixed — Iran still enriches
      uranium, now to 60% (was 3.67% under JCPOA). By the source's OWN metric,
      maximum pressure failed. Text acknowledges this but doesn't draw the conclusion.
    - SWIFT's compliance is presented as voluntary but was actually coerced
      by US threat to exclude SWIFT itself from dollar system.
    - BNP Paribas fine is framed as "deterrence" but the second-order effect
      (overcompliance blocking humanitarian trade) is never examined.
    - INSTEX's failure is mentioned but not analyzed — it reveals that European
      political will to resist US extraterritorial authority is functionally zero.
    - The article treats sanctions as a TOOL. A structural analysis would treat
      them as a SYMPTOM of dollar hegemony — and ask what happens to US power
      when that hegemony erodes.
```

**Entity Extraction Phase (structured output):**

### Artifact: `data/temp/us-iran-sanctions/04_all_entities.json`

```json
{
  "temporal_phases": [
    { "index": 1, "label": "Pre-sanctions era", "period": "1979-1995" },
    { "index": 2, "label": "Escalating pressure", "period": "1995-2006" },
    { "index": 3, "label": "Nuclear crisis & maximum pressure", "period": "2006-2015" },
    { "index": 4, "label": "JCPOA diplomatic window", "period": "2015-2018" },
    { "index": 5, "label": "Maximum pressure redux", "period": "2018-present" }
  ],
  "entities": [
    {
      "name": "United States",
      "aliases": ["US", "America", "Washington"],
      "category": "Place",
      "definition": "Global superpower that designed and enforces the most comprehensive sanctions regime in modern history against Iran, using its control over the dollar-based financial system as the primary enforcement mechanism — able to threaten any foreign bank or company with exclusion from American markets if they transact with Iranian entities.",
      "role": "Architect and enforcer of the Iran sanctions regime. The US stance is that sanctions are a non-military tool to prevent Iranian nuclear weapons development, but the mechanics reveal broader strategic objectives: (1) Treasury Department's OFAC designates sanctioned entities, (2) secondary sanctions threaten ANY global bank processing Iranian transactions with loss of US market access — making compliance a survival issue for foreign banks, (3) SWIFT disconnection eliminates Iran's ability to move money internationally. The reasoning: the US can weaponize the dollar system because 88% of global forex transactions involve the dollar — defying US sanctions means defying the architecture of global finance itself.",
      "first_appearance_index": 1,
      "tags": ["sanctions-policy", "dollar-hegemony", "decision-maker", "enforcer", "status-quo-power"],
      "inferredProperties": [
        {
          "property": "Dual objective beyond nuclear nonproliferation",
          "reasoning": "Text describes sanctions surviving even during JCPOA compliance period — suggests sanctions serve geopolitical containment beyond stated nuclear goals",
          "confidence": "medium"
        }
      ],
      "openQuestions": [
        "What is the humanitarian cost of US sanctions on Iranian civilians? Source does not address this.",
        "How much has the US sanctions regime cost American businesses in lost trade?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "1979-present"
    },
    {
      "name": "SWIFT",
      "aliases": ["Society for Worldwide Interbank Financial Telecommunication", "SWIFT network"],
      "category": "Technology",
      "definition": "Belgium-based financial messaging system connecting 11,000+ banks in 200+ countries that serves as the nervous system of global banking — its disconnection from a country's banks effectively eliminates that country's ability to conduct international financial transactions, making it the most powerful non-military enforcement mechanism in the sanctions toolkit.",
      "role": "The enforcement infrastructure that makes Iran sanctions operational. SWIFT's stated stance is political neutrality — it is technically a Belgian cooperative, not a US entity. But the mechanics tell a different story: (1) the US threatened to sanction SWIFT itself if it didn't disconnect Iranian banks, (2) SWIFT complied in 2012 (first time in history disconnecting an entire country), (3) this created the template used against Russia in 2022. SWIFT's 'neutrality' is structurally impossible because the dollar system flows through it — whoever controls dollar access controls SWIFT's behavior.",
      "first_appearance_index": 2,
      "tags": ["financial-infrastructure", "enforcement-mechanism", "gatekeeper", "sanctions-policy"],
      "inferredProperties": [
        {
          "property": "SWIFT compliance was coerced, not voluntary",
          "reasoning": "Text says SWIFT 'agreed' to disconnect Iran but also notes US threatened SWIFT with exclusion — agreement under threat is coercion",
          "confidence": "high"
        }
      ],
      "openQuestions": [
        "What alternatives to SWIFT has Iran developed? Text mentions INSTEX but doesn't detail effectiveness."
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "2012-present (sanctions role)"
    },
    {
      "name": "Secondary Sanctions",
      "aliases": ["Extraterritorial sanctions", "Secondary enforcement"],
      "category": "Process",
      "definition": "The mechanism by which the US extends its sanctions beyond American entities to ANY foreign entity worldwide — threatening foreign banks, companies, and governments with loss of access to US markets and the dollar system if they conduct business with sanctioned Iranian entities, effectively conscripting the entire global financial system into US policy enforcement.",
      "role": "The force multiplier that transforms bilateral US-Iran sanctions into a global blockade. The stance is stated as 'compliance incentive' but the mechanics are coercive: (1) any bank processing an Iranian transaction risks being cut off from US dollar clearing — a death sentence for international banks, (2) BNP Paribas paid $8.97 billion in 2014 for sanctions violations, making the cost of non-compliance existential, (3) European banks over-comply ('de-risking'), refusing even legal humanitarian transactions to avoid any risk. This over-compliance amplifies sanctions beyond their designed scope.",
      "first_appearance_index": 2,
      "tags": ["enforcement-mechanism", "extraterritorial", "sanctions-policy", "economic-coercion"],
      "inferredProperties": [
        {
          "property": "Secondary sanctions cause humanitarian harm through over-compliance",
          "reasoning": "Text describes European banks refusing even legal humanitarian trade with Iran due to compliance fear — unintended consequence the source doesn't frame as a problem",
          "confidence": "high"
        }
      ],
      "openQuestions": [
        "How many humanitarian transactions have been blocked by over-compliant banks?",
        "Is there legal basis for extraterritorial application of US domestic law?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "1996-present"
    },
    {
      "name": "Iran",
      "aliases": ["Islamic Republic of Iran", "Tehran"],
      "category": "Place",
      "definition": "Middle Eastern state under the most comprehensive international sanctions regime in modern history, whose nuclear program serves as the stated justification for financial isolation, but whose actual offense — from the US perspective — is strategic defiance of American regional hegemony since the 1979 Revolution.",
      "role": "The target of the sanctions regime and the adversary whose behavior sanctions aim to change. Iran's stance is strategic defiance: it has not capitulated to sanctions demands despite severe economic damage (GDP contracted 6% in 2018, oil exports dropped from 2.5M to 0.5M barrels/day). The mechanics of survival: (1) redirected oil exports to China at discounted prices, accepting yuan, (2) developed domestic alternatives to imported goods under 'resistance economy' policy, (3) accelerated nuclear enrichment to 60% as leverage — creating the very threat sanctions were meant to prevent. Iran's reasoning: capitulation to US demands without guarantees (as JCPOA demonstrated) is strategically worse than enduring sanctions.",
      "first_appearance_index": 1,
      "tags": ["sanctions-target", "nuclear-policy", "middle-east", "revisionist-power", "energy-policy"],
      "inferredProperties": [
        {
          "property": "Iran's nuclear acceleration is a RESPONSE to sanctions, not the cause of them",
          "reasoning": "Text shows Iran enriched to 3.67% under JCPOA, accelerated to 60% only AFTER US withdrawal — the causal arrow runs from sanctions to enrichment, not the reverse",
          "confidence": "high"
        },
        {
          "property": "Iranian civilian population bears costs invisible in this source",
          "reasoning": "Text attributes suffering to 'Iran' as state abstraction. GDP contraction, currency collapse, medicine shortages affect people, not states. Source's framing erases this.",
          "confidence": "high"
        }
      ],
      "openQuestions": [
        "What is the humanitarian cost of sanctions on Iranian civilians (medicine shortages, inflation, mortality)?",
        "Has Iran's 'resistance economy' achieved genuine import substitution or just lower living standards?",
        "What percentage of Iranian oil exports now bypass dollar denomination?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "1979-present"
    },
    {
      "name": "Treasury Department/OFAC",
      "aliases": ["OFAC", "Office of Foreign Assets Control", "US Treasury"],
      "category": "Organization",
      "definition": "The US government agency responsible for administering and enforcing economic and trade sanctions, operating within the Treasury Department — its Office of Foreign Assets Control (OFAC) maintains the Specially Designated Nationals (SDN) list that determines which entities worldwide are cut off from the dollar system.",
      "role": "The operational engine of the sanctions regime. Treasury/OFAC's stance is that sanctions are a precision tool — they designate specific entities, banks, and individuals rather than entire populations. But the mechanics produce blunt force effects: (1) OFAC designation puts an entity on the SDN list, immediately freezing any US-connected assets, (2) the designation cascades — any entity transacting with a designated entity risks becoming designated themselves, (3) the 'precision' framing obscures that secondary sanctions make the ENTIRE country radioactive to global banks. Treasury's reasoning: financial sanctions are cheaper and more targeted than military action. The counter-argument: overcompliance makes them as blunt as embargoes.",
      "first_appearance_index": 2,
      "tags": ["decision-maker", "enforcer", "sanctions-policy", "regulatory-body"],
      "inferredProperties": [],
      "openQuestions": [
        "What is OFAC's internal decision process for adding entities to the SDN list?",
        "Who reviews OFAC designations for humanitarian impact?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "1950-present (OFAC established)"
    },
    {
      "name": "European Banking System",
      "aliases": ["European banks", "EU financial institutions"],
      "category": "Organization",
      "definition": "The collective of European commercial and investment banks — including Deutsche Bank, BNP Paribas, HSBC, and hundreds of smaller institutions — that function as the transmission layer between US sanctions policy and Iran's economic isolation, complying with (and exceeding) US sanctions requirements despite the sanctions being extraterritorial applications of American domestic law.",
      "role": "The involuntary enforcer that gives US sanctions global reach. The European banking system's stance is reluctant compliance — European governments officially oppose US secondary sanctions and even created INSTEX to circumvent them. But the mechanics make defiance impossible: (1) any bank processing Iranian transactions risks losing access to US dollar clearing — existential for international banks, (2) BNP Paribas's $8.97B fine demonstrated the cost is not theoretical, (3) banks over-comply ('de-risking'), refusing even legal humanitarian transactions to eliminate any risk. The result: US domestic law is enforced by non-US banks against non-US entities — extraterritorial power without formal legal authority.",
      "first_appearance_index": 2,
      "tags": ["enforcer", "financial-infrastructure", "overcompliance", "sanctions-policy", "european-sovereignty"],
      "inferredProperties": [
        {
          "property": "European bank overcompliance reveals EU sovereignty is functionally limited by dollar dependency",
          "reasoning": "EU governments created INSTEX to resist US sanctions but their own banks refuse to use it — political sovereignty without financial sovereignty is performative",
          "confidence": "high"
        }
      ],
      "openQuestions": [
        "Do all European banks over-comply equally, or do some process permitted transactions?",
        "Is European bank overcompliance legally challengeable under EU law?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "2006-present (sanctions compliance role)"
    },
    {
      "name": "JCPOA",
      "aliases": ["Iran nuclear deal", "Iran deal", "Joint Comprehensive Plan of Action"],
      "category": "Agreement",
      "definition": "2015 multilateral nuclear agreement between Iran and P5+1 powers (US, UK, France, Russia, China, Germany) that froze Iran's nuclear enrichment at 3.67%, reduced centrifuges from 19,000 to 6,104, and imposed the most intrusive international inspection regime in history — in exchange for phased sanctions relief — demonstrating that diplomacy could achieve what sanctions alone could not.",
      "role": "The diplomatic alternative that proved sanctions unnecessary for achieving nonproliferation goals — and whose destruction proved US commitment to sanctions as a tool of domination, not just nonproliferation. The JCPOA's mechanics were precise: Iran accepted verifiable constraints, IAEA confirmed compliance in 11 consecutive reports, sanctions were partially lifted. The destruction mechanics were equally precise: Trump withdrew in May 2018 despite Iranian compliance, re-imposed maximum pressure, and Iran began enriching beyond JCPOA limits within a year. The reasoning behind withdrawal was never about Iranian violations (there were none) — it was about regime change advocacy and Israeli/Saudi pressure. The JCPOA's death carries a meta-lesson: any future adversary now knows US agreements don't survive presidential transitions.",
      "first_appearance_index": 4,
      "tags": ["nuclear-nonproliferation", "diplomatic-engagement", "arms-control", "multilateral-governance"],
      "inferredProperties": [
        {
          "property": "JCPOA withdrawal was strategic, not compliance-based",
          "reasoning": "Text states IAEA confirmed compliance in 11 consecutive reports before US withdrawal — withdrawal was a policy choice, not a response to violation",
          "confidence": "high"
        },
        {
          "property": "JCPOA's destruction undermined future US diplomatic credibility globally",
          "reasoning": "If the US won't honor agreements even when the other side complies, what rational actor would negotiate? This implication is present but unstated in the text.",
          "confidence": "medium"
        }
      ],
      "openQuestions": [
        "Could a JCPOA-like agreement be revived given the credibility damage?",
        "What role did Israeli and Saudi lobbying play in the US withdrawal decision?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "2015-2018 (active), 2018-present (defunct but referenced)"
    },
    {
      "name": "Iran Nuclear Program",
      "aliases": ["Iranian enrichment program", "Iran's nuclear capability"],
      "category": "Process",
      "definition": "Iran's uranium enrichment and nuclear development infrastructure — the stated target of the US sanctions regime — which has paradoxically ACCELERATED under maximum pressure, enriching from 3.67% (JCPOA-compliant) to 60% (near weapons-grade) since the US withdrawal, demonstrating that sanctions failed at their stated objective.",
      "role": "The official justification for the sanctions regime, but one that reveals a structural contradiction. The nuclear program was FROZEN under JCPOA (diplomacy) and ACCELERATED under maximum pressure (sanctions). The mechanics: (1) under JCPOA, centrifuges reduced from 19,000 to 6,104 and enrichment capped at 3.67%, (2) after US withdrawal, Iran restarted advanced centrifuges and enriched to 60%, (3) the diplomatic constraint that worked was destroyed in favor of the coercive constraint that didn't. This is the most damning evidence against the 'sanctions work' thesis in the source — and the source acknowledges it without drawing the conclusion.",
      "first_appearance_index": 3,
      "tags": ["nuclear-policy", "enrichment", "nonproliferation", "sanctions-target"],
      "inferredProperties": [
        {
          "property": "Nuclear acceleration is sanctions blowback, not independent decision",
          "reasoning": "3.67% → 60% enrichment tracks exactly with JCPOA collapse timeline. The program is a RESPONSE variable, not an independent one.",
          "confidence": "high"
        }
      ],
      "openQuestions": [
        "How close is 60% enrichment to weapons-grade (90%)? What technical barriers remain?",
        "Has Iran made a political decision to pursue weapons, or is enrichment leverage for negotiations?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "2003-present (international concern)"
    },
    {
      "name": "BNP Paribas",
      "aliases": ["BNP", "BNPP"],
      "category": "Organization",
      "definition": "French multinational bank fined $8.97 billion in 2014 for processing transactions with sanctioned entities including Iran, Sudan, and Cuba — the largest sanctions fine in history and the pivot event that transformed European banking behavior from selective compliance to blanket overcompliance with US sanctions.",
      "role": "The cautionary tale that made overcompliance rational. BNP Paribas is not extracted for its own importance but for its SYSTEMIC EFFECT: the fine was so large ($8.97B — larger than most banks' annual profit) that it rewired the risk calculations of every European bank. The mechanics of impact: (1) BNP was temporarily barred from dollar clearing — equivalent to a death sentence for an international bank, (2) every compliance department in Europe calculated: even if the probability of getting caught is 1%, the potential loss is existential, (3) the rational response became: refuse ALL Iran-connected transactions, even legal ones. The fine's real product wasn't $8.97B — it was a behavioral change across an entire continent's banking system.",
      "first_appearance_index": 2,
      "tags": ["sanctions-enforcement", "financial-deterrence", "pivot-event", "overcompliance"],
      "inferredProperties": [
        {
          "property": "The fine was calibrated for deterrent effect, not proportional punishment",
          "reasoning": "$8.97B exceeds the profit from Iran transactions by orders of magnitude — the fine's purpose was to make an example, not to recover damages",
          "confidence": "medium"
        }
      ],
      "openQuestions": [],
      "disambiguationNotes": null,
      "temporalRelevance": "2014 (fine), 2014-present (behavioral effect)"
    },
    {
      "name": "China",
      "aliases": ["People's Republic of China", "PRC", "Beijing"],
      "category": "Place",
      "definition": "World's second-largest economy and Iran's primary economic lifeline under sanctions — the only major power both willing and able to absorb Iranian oil exports in non-dollar currency, while simultaneously building CIPS as a structural alternative to US-controlled financial infrastructure.",
      "role": "The strategic beneficiary of US-Iran confrontation and the primary sanctions circumventer. China's stance is calculated: it does not openly defy US sanctions but exploits their gaps. The mechanics: (1) buys Iranian oil at 15-30% discount, paying in yuan — cheap energy fuels Chinese manufacturing, (2) provides CIPS as SWIFT alternative for Iran-China transactions, (3) reduces US Treasury holdings ($1.3T → $850B) reducing dollar leverage over China's own economy, (4) uses Iran as testing ground for yuan internationalization. China's reasoning: every transaction conducted in yuan instead of dollars is a structural erosion of the infrastructure that makes US sanctions possible.",
      "first_appearance_index": 5,
      "tags": ["sanctions-circumventer", "east-asia", "yuan-internationalization", "challenger", "energy-policy"],
      "inferredProperties": [
        {
          "property": "China's Iran engagement serves dual purpose: cheap oil AND dollar hegemony erosion",
          "reasoning": "Text shows China both profiting from discounted oil AND building CIPS — two distinct strategic objectives served by one relationship",
          "confidence": "high"
        }
      ],
      "openQuestions": [
        "What volume of Iranian oil does China actually import, and how much is paid in yuan vs dollar?",
        "Is China building CIPS specifically to circumvent sanctions, or as general dollar-alternative infrastructure?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "2012-present (sanctions circumvention role)"
    },
    {
      "name": "CIPS",
      "aliases": ["Cross-Border Interbank Payment System", "China's SWIFT alternative"],
      "category": "Technology",
      "definition": "Chinese cross-border payment messaging system with 1,400+ institutional members that processes international transactions outside US-controlled SWIFT infrastructure — the most advanced structural alternative to dollar-based financial messaging and the mechanism through which Iran-China trade bypasses US surveillance and sanctions enforcement.",
      "role": "The emerging alternative infrastructure that threatens sanctions' long-term viability. CIPS processes yuan-denominated cross-border payments without touching the SWIFT network or US dollar clearing. The mechanics: (1) Iran-China oil transactions route through CIPS, invisible to US enforcement, (2) 1,400+ members give CIPS critical mass but still a fraction of SWIFT's 11,000+, (3) each new member is one more node in a network the US cannot surveil or block. CIPS doesn't need to replace SWIFT — it just needs to process enough transactions to make sanctions leaky. The threshold for undermining sanctions is FAR lower than the threshold for replacing SWIFT.",
      "first_appearance_index": 5,
      "tags": ["financial-infrastructure", "de-dollarization", "sanctions-circumvention", "challenger"],
      "inferredProperties": [
        {
          "property": "CIPS undermines sanctions at a threshold far below SWIFT replacement",
          "reasoning": "If even 20% of sanctioned transactions migrate to CIPS, sanctions effectiveness drops disproportionately — the system doesn't need to be comprehensive to be corrosive",
          "confidence": "medium"
        }
      ],
      "openQuestions": [
        "What percentage of Iran's international transactions now route through CIPS?",
        "How many CIPS members are from countries under US sanctions?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "2015-present (launched), 2018-present (Iran role)"
    },
    {
      "name": "Oil Markets",
      "aliases": ["Global oil trade", "Oil pricing system"],
      "category": "System",
      "definition": "The global system of oil production, pricing, and trade — denominated overwhelmingly in US dollars — that serves as the primary transmission mechanism for sanctions' economic impact on Iran, whose oil exports collapsed from 2.5 million to 0.5 million barrels/day under maximum pressure.",
      "role": "The medium through which sanctions create economic pain. Oil markets matter because oil is Iran's primary revenue source (60%+ of government revenue). The mechanics: (1) sanctions don't physically block oil — they make it financially impossible to process payments for Iranian crude through dollar-based banking, (2) Iran's oil exports dropped from 2.5M bpd to 0.5M bpd under maximum pressure, (3) the remaining exports go to China at 15-30% discount — Iran gets less money for less oil, (4) the dollar denomination of oil markets is what gives sanctions their power — if oil were priced in a basket currency, this mechanism would fail.",
      "first_appearance_index": 1,
      "tags": ["energy-policy", "oil-pricing", "sanctions-mechanism", "dollar-hegemony"],
      "inferredProperties": [],
      "openQuestions": [
        "What would happen to sanctions effectiveness if OPEC accepted non-dollar payment for oil?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "1979-present"
    },
    {
      "name": "Central Bank of Iran",
      "aliases": ["CBI", "Bank Markazi"],
      "category": "Organization",
      "definition": "Iran's central monetary authority, sanctioned and disconnected from SWIFT in 2012 — the specific institutional target whose isolation from international banking collapsed Iran's ability to process sovereign financial transactions, receive oil payments, and manage foreign currency reserves.",
      "role": "The institutional chokepoint through which sanctions cripple Iran's economy. CBI's disconnection from SWIFT meant Iran's central bank could not send or receive international payment messages — equivalent to cutting the phone line of the country's financial nerve center. The mechanics: (1) CBI was specifically designated by OFAC in 2012, (2) SWIFT disconnected CBI's messaging access, (3) without CBI processing, even non-sanctioned Iranian transactions became impossible through normal channels, (4) Iran resorted to barter, gold, and cryptocurrency to bypass CBI isolation.",
      "first_appearance_index": 3,
      "tags": ["central-banking", "sanctions-target", "enforcement-mechanism"],
      "inferredProperties": [],
      "openQuestions": [
        "How does CBI currently process international transactions? What workarounds exist?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "2012-present (sanctions role)"
    },
    {
      "name": "INSTEX",
      "aliases": ["Instrument in Support of Trade Exchanges"],
      "category": "Technology",
      "definition": "European special purpose vehicle created in 2019 by France, Germany, and the UK to facilitate non-dollar trade with Iran — designed to circumvent US secondary sanctions by avoiding the dollar system entirely — but which processed only ONE transaction before effectively becoming dormant, revealing the gap between European political aspirations and financial reality.",
      "role": "The failed European sovereignty experiment. INSTEX was created with political fanfare as proof that Europe could resist US extraterritorial sanctions. The mechanics of failure: (1) European banks refused to use it — the same overcompliance that makes sanctions work made INSTEX radioactive, (2) it was limited to 'humanitarian goods' from the start (a concession to US pressure), (3) no European company with US exposure would risk association, (4) INSTEX processed exactly ONE transaction (medical supplies) in its existence. INSTEX's failure is more revealing than its creation — it demonstrates that dollar dependency gives the US veto power over European foreign policy.",
      "first_appearance_index": 5,
      "tags": ["european-sovereignty", "sanctions-circumvention", "failure-case", "financial-infrastructure"],
      "inferredProperties": [
        {
          "property": "INSTEX's failure reveals European sovereignty is limited by dollar dependency",
          "reasoning": "EU governments created INSTEX specifically to resist US extraterritorial authority, but their own banks and companies refused to use it — political will without financial independence is performative",
          "confidence": "high"
        }
      ],
      "openQuestions": [
        "Is INSTEX still operational or formally dissolved?",
        "Could a future EU digital euro reduce European dependency on dollar clearing?"
      ],
      "disambiguationNotes": null,
      "temporalRelevance": "2019-present (created), effectively defunct"
    },
    {
      "name": "Dollar Hegemony",
      "aliases": ["Dollar dominance", "Dollar system"],
      "category": "System",
      "definition": "The global monetary architecture in which the US dollar serves as the primary reserve currency, trade settlement currency, and financial messaging medium — with 88% of global forex transactions involving the dollar — creating structural power that the US can weaponize through sanctions, as any entity excluded from the dollar system is effectively excluded from the global economy.",
      "role": "The underlying infrastructure that makes sanctions possible AND the system that sanctions erode with each use. Dollar hegemony provides the US with what de Gaulle called 'exorbitant privilege' — the ability to print the world's reserve currency and weaponize access to it. The mechanics for sanctions: (1) 88% of forex = most international trade touches dollars somewhere, (2) US controls CHIPS (dollar clearing) and pressures SWIFT (messaging), (3) exclusion from dollars = exclusion from trade. But each sanctions use accelerates alternatives: CIPS grows, yuan oil trade increases, central banks buy gold. The fundamental paradox: the more the US uses dollar hegemony as a weapon, the faster the world builds alternatives — sanctions simultaneously demonstrate and erode American financial power.",
      "first_appearance_index": 1,
      "tags": ["dollar-hegemony", "reserve-currency", "financial-architecture", "systemic-risk"],
      "inferredProperties": [
        {
          "property": "Sanctions weaponization is accelerating dollar hegemony's erosion",
          "reasoning": "Text shows each sanctions episode (Iran, Russia, Venezuela) triggers new alternative infrastructure (CIPS, yuan oil, gold reserves) — the weapon degrades with use",
          "confidence": "high"
        }
      ],
      "openQuestions": [
        "At what dollar reserve share threshold (currently 58%, down from 71%) do sanctions become ineffective?",
        "Is dollar hegemony erosion linear or does it have a tipping point?"
      ],
      "disambiguationNotes": "Different from 'US Dollar' (the currency). Dollar Hegemony is the SYSTEM of structural dominance — includes SWIFT control, Treasury demand, forex dominance, sanctions capability. US Dollar is an artifact within this system.",
      "temporalRelevance": "1944-present (Bretton Woods origin)"
    }
  ]
}
```

**(All 15 entities shown. Each has: definition 100+ chars, role with stance+mechanics+reasoning, 3-8 tags, inferredProperties where applicable, openQuestions where applicable, temporalRelevance.)**

**Gate check:**
- ≥10 entities? ✓ (15 entities)
- All definitions ≥100 chars? ✓
- All categories from 14 fixed set? ✓
- All have aliases[]? ✓
- All have tags[] 3-8, kebab-case? ✓
- temporal_phases 2+ phases? ✓ (5 phases)
- No all-"Other"? ✓
- NEW: inferredProperties present where applicable? ✓
- NEW: openQuestions present where applicable? ✓
- Proceed.

---

## Step 04: Full Extraction — RELATIONSHIPS + CHAINS + METADATA (Worker, 25-45 seconds)

**No tool calls.** Pure Claude reasoning. Worker has: raw text + 04_all_entities.json + relationship-building skill + causal-chains skill + domain skill.

### Artifact: `data/temp/us-iran-sanctions/06_extraction.json`

```json
{
  "project": {
    "name": "US-Iran Sanctions Regime",
    "unique_id": "us-iran-sanctions",
    "summary": "The US sanctions regime against Iran represents the most comprehensive deployment of financial warfare in modern history — a system where American control of the dollar-based global financial architecture is weaponized to isolate a nation-state from the international economy. The mechanism operates through three interlocking layers: (1) primary sanctions prohibit US entities from transacting with Iran, (2) secondary sanctions threaten ANY global entity with loss of dollar access if they transact with Iran, and (3) SWIFT disconnection eliminates Iran's banks from the international messaging system entirely. The enforcement works because 88% of global forex transactions flow through the dollar — defying US sanctions means risking exclusion from the system that makes international business possible. The regime's effectiveness is amplified by over-compliance: European banks, terrified by BNP Paribas's $8.97 billion fine, refuse even legal humanitarian transactions with Iran — creating suffering the sanctions weren't designed to impose. The JCPOA (2015-2018) briefly demonstrated that diplomatic engagement could achieve what sanctions alone could not — verifiable nuclear rollback — but the US withdrawal in 2018 restored maximum pressure and undermined future diplomatic credibility. Iran's responses include CIPS integration with China, cryptocurrency experimentation, and BRICS membership — each a fragment of a potential alternative financial architecture. The fundamental question is whether financial dominance can substitute for diplomatic engagement indefinitely, or whether the weaponization of finance accelerates the very de-dollarization that would make sanctions toothless.",
    "narrative_flow": [
      "1979 Iranian Revolution creates permanent US-Iran hostility — sanctions begin as diplomatic tool (1979-1995)",
      "US discovers financial system as weapon — secondary sanctions force global compliance (1996-2006)",
      "Nuclear crisis escalates — SWIFT disconnection unprecedented, Iran isolated from global banking (2006-2012)",
      "JCPOA diplomatic window — sanctions relief demonstrates engagement works, nuclear program frozen (2015-2018)",
      "US withdrawal from JCPOA — maximum pressure redux, Iran accelerates enrichment, credibility destroyed (2018-present)",
      "Iran pivots to China/BRICS — alternative financial infrastructure fragments emerging but not yet viable"
    ],
    "tags": {
      "domain": "geopolitics",
      "subdomain": "sanctions-policy",
      "base_tags": ["iran-sanctions", "swift", "dollar-hegemony", "secondary-sanctions",
                     "nuclear-nonproliferation", "jcpoa", "financial-warfare", "de-dollarization"]
    },
    "thesis": "US sanctions on Iran demonstrate that control of the dollar-based financial system gives America the ability to wage economic warfare against any nation, but this weaponization of finance accelerates the development of alternative systems that could eventually make sanctions toothless.",
    "keyQuestion": "Can the US sustain sanctions effectiveness as Iran, China, and BRICS build alternative financial infrastructure?",
    "geographicFocus": ["Iran", "United States", "Europe", "China"],
    "historicalPeriod": "1979-2024",
    "sourceType": "think-tank",
    "sourcePerspective": "US policy establishment framing — treats sanctions as statecraft tools, does not address humanitarian cost or question the legitimacy of extraterritorial enforcement. A counter-analysis from Iran, Europe, or the Global South would frame the same facts as economic warfare and sovereignty violation.",
    "analyticalNotes": [
      "Source never quantifies humanitarian cost to Iranian civilians (GDP contraction, medicine shortages, inflation) — this absence is notable in a 3000-word sanctions analysis. A detective asks: whose suffering is invisible in this framing?",
      "All effectiveness metrics are nuclear-focused, but Iran has accelerated enrichment post-JCPOA withdrawal — by the source's own metric, maximum pressure has failed. Text acknowledges this but doesn't draw the conclusion.",
      "SWIFT's 'cooperation' is framed as voluntary partnership, but the mechanism was US threat to sanction SWIFT itself. The cooperative framing obscures the coercive reality.",
      "BNP Paribas fine ($8.97B) is cited as deterrence success, but the over-compliance it triggered blocks legal humanitarian trade — the source doesn't examine this second-order effect."
    ]
  },
  "relationships": [
    {
      "source": "United States",
      "target": "Iran",
      "relType": "SANCTIONS",
      "causalClassification": "BLOCKS",
      "description": "Comprehensive multilayer sanctions regime blocking Iran from global financial system through primary sanctions (US entities), secondary sanctions (all global entities), and infrastructure disconnection (SWIFT) — the most extensive financial isolation of a nation-state since WWII.",
      "evidence": "The United States has constructed the most comprehensive sanctions regime in modern history against Iran, layering primary, secondary, and infrastructure-level restrictions into a financial blockade that touches every corner of the global economy.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "1979-present",
      "tags": ["sanctions-policy", "financial-warfare"],
      "assertionType": "factual"
    },
    {
      "source": "United States",
      "target": "SWIFT",
      "relType": "COERCES",
      "causalClassification": "REGULATES",
      "description": "US threatened to sanction SWIFT itself — a Belgian cooperative — if it didn't disconnect Iranian banks, using the threat of dollar system exclusion to compel a nominally neutral infrastructure provider into serving as an enforcement mechanism for American foreign policy.",
      "evidence": "Washington made clear that SWIFT's continued access to the US financial system was contingent on its cooperation with Iranian bank disconnections.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "2012",
      "tags": ["enforcement-mechanism", "extraterritorial"],
      "assertionType": "factual"
    },
    {
      "source": "Secondary Sanctions",
      "target": "European Banking System",
      "relType": "CAUSES_OVERCOMPLIANCE",
      "causalClassification": "BLOCKS",
      "description": "Secondary sanctions create such existential risk for European banks that they refuse even LEGAL humanitarian transactions with Iran — 'de-risking' beyond what sanctions require, amplifying economic isolation beyond designed scope and blocking medicine and food trade the sanctions explicitly exempt.",
      "evidence": "European banks have gone far beyond what sanctions legally require, refusing to process even humanitarian transactions explicitly permitted under sanctions exemptions — the risk of a BNP Paribas-scale fine makes any Iran-connected transaction radioactive.",
      "evidenceStrength": "established",
      "magnitude": "significant",
      "year": "2014-present",
      "tags": ["overcompliance", "humanitarian-impact", "de-risking"],
      "assertionType": "analytical"
    },
    {
      "source": "JCPOA",
      "target": "Iran Nuclear Program",
      "relType": "FREEZES",
      "causalClassification": "REGULATES",
      "description": "The JCPOA froze Iran's nuclear enrichment program at 3.67% and reduced centrifuges from 19,000 to 6,104 — achieving through diplomacy what decades of sanctions had not — in exchange for phased sanctions relief, demonstrating that engagement could produce verifiable nonproliferation results.",
      "evidence": "Under the deal, Iran reduced its centrifuge count from 19,000 to 6,104, capped enrichment at 3.67%, and submitted to the most intrusive international inspection regime in history.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "2015-2018",
      "tags": ["nuclear-nonproliferation", "diplomatic-engagement"],
      "assertionType": "factual"
    },
    {
      "source": "United States",
      "target": "JCPOA",
      "relType": "WITHDRAWS_FROM",
      "causalClassification": "BLOCKS",
      "description": "The US withdrew from the JCPOA in May 2018 despite 11 consecutive IAEA reports confirming Iranian compliance — destroying the diplomatic framework that had verifiably frozen Iran's nuclear program and signaling to future adversaries that US agreements do not survive presidential transitions.",
      "evidence": "Trump withdrew the United States from the JCPOA in May 2018, reimposing all nuclear-related sanctions, despite the IAEA's repeated certification that Iran was in full compliance with the agreement.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "2018",
      "tags": ["jcpoa", "diplomatic-credibility", "nuclear-nonproliferation"],
      "assertionType": "factual"
    },
    {
      "source": "United States",
      "target": "Treasury Department/OFAC",
      "relType": "DIRECTS",
      "causalClassification": "ENABLES",
      "description": "The US government directs OFAC's sanctions enforcement through executive orders and legislation — OFAC operates as the operational engine translating presidential sanctions directives into specific entity designations on the SDN list, asset freezes, and enforcement actions.",
      "evidence": "The Treasury Department's Office of Foreign Assets Control administers and enforces economic sanctions programs, maintaining the Specially Designated Nationals list that determines which entities are cut off from the dollar system.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "1950-present",
      "tags": ["regulatory-body", "sanctions-policy", "enforcement-mechanism"],
      "assertionType": "factual"
    },
    {
      "source": "Treasury Department/OFAC",
      "target": "Secondary Sanctions",
      "relType": "ADMINISTERS",
      "causalClassification": "IMPLEMENTS",
      "description": "OFAC operationalizes secondary sanctions by designating not just Iranian entities but any foreign entity that transacts with them — extending US domestic law extraterritorially by making the SDN list's reach global, forcing every international bank to become a de facto US compliance officer.",
      "evidence": "OFAC's enforcement extends beyond US borders through secondary sanctions, threatening any foreign entity that conducts significant transactions with Iranian-designated persons with loss of access to the US financial system.",
      "evidenceStrength": "established",
      "magnitude": "significant",
      "year": "1996-present",
      "tags": ["extraterritorial", "enforcement-mechanism", "sanctions-policy"],
      "assertionType": "factual"
    },
    {
      "source": "Treasury Department/OFAC",
      "target": "Central Bank of Iran",
      "relType": "DESIGNATES",
      "causalClassification": "BLOCKS",
      "description": "OFAC specifically designated the Central Bank of Iran in 2012, placing it on the SDN list and triggering its disconnection from SWIFT — a targeted strike on the institutional chokepoint through which all of Iran's sovereign financial transactions flowed, collapsing the country's ability to process international payments.",
      "evidence": "The designation of the Central Bank of Iran in 2012 was the pivotal enforcement action — once CBI was on the SDN list, its SWIFT disconnection followed automatically.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "2012",
      "tags": ["enforcement-mechanism", "central-banking", "sanctions-target"],
      "assertionType": "factual"
    },
    {
      "source": "SWIFT",
      "target": "Central Bank of Iran",
      "relType": "DISCONNECTS",
      "causalClassification": "BLOCKS",
      "description": "SWIFT disconnected the Central Bank of Iran and other designated Iranian banks from its messaging network in 2012 — the first time in history an entire country's banking system was cut off from the global financial messaging infrastructure, making it physically impossible to send or receive international payment instructions.",
      "evidence": "For the first time in its history, SWIFT disconnected an entire country's banking system, cutting off Iranian banks including the Central Bank of Iran from the global financial messaging network.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "2012",
      "tags": ["financial-infrastructure", "enforcement-mechanism", "unprecedented"],
      "assertionType": "factual"
    },
    {
      "source": "BNP Paribas",
      "target": "European Banking System",
      "relType": "DETERS",
      "causalClassification": "INFLUENCES",
      "description": "BNP Paribas's $8.97 billion fine in 2014 — the largest sanctions penalty in history — rewired the risk calculations of every European bank, transforming the entire continent's banking behavior from selective compliance to blanket overcompliance: the fine's real product was not revenue but a behavioral change across an industry.",
      "evidence": "The $8.97 billion fine levied against BNP Paribas — larger than most banks' entire annual profit — sent a message to every compliance department in Europe: the cost of even marginal sanctions risk is existential.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "2014",
      "tags": ["sanctions-enforcement", "financial-deterrence", "pivot-event"],
      "assertionType": "factual"
    },
    {
      "source": "Dollar Hegemony",
      "target": "Secondary Sanctions",
      "relType": "ENABLES",
      "causalClassification": "ENABLES",
      "description": "Dollar hegemony — 88% of global forex transactions, the dollar as reserve currency, US control of CHIPS clearing — is the structural foundation that makes secondary sanctions possible: the threat of exclusion from the dollar system is only existential because the dollar IS the system. Without dominance, secondary sanctions would be unenforceable.",
      "evidence": "The power of secondary sanctions derives from the dollar's role in 88% of global foreign exchange transactions — exclusion from the dollar system is exclusion from the global economy.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "1944-present",
      "tags": ["dollar-hegemony", "structural-power", "financial-architecture"],
      "assertionType": "analytical"
    },
    {
      "source": "Iran",
      "target": "Iran Nuclear Program",
      "relType": "ACCELERATES",
      "causalClassification": "PRODUCES",
      "description": "After the US withdrew from the JCPOA, Iran accelerated uranium enrichment from 3.67% to 60% and restarted advanced centrifuges — the nuclear program's escalation is a direct response to the collapse of the diplomatic framework, producing the exact threat that sanctions were meant to prevent.",
      "evidence": "Following the US withdrawal, Iran began enriching uranium beyond JCPOA limits, eventually reaching 60% — near weapons-grade — and restarting advanced centrifuges that had been mothballed under the agreement.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "2019-present",
      "tags": ["nuclear-policy", "enrichment", "sanctions-blowback"],
      "assertionType": "factual"
    },
    {
      "source": "Iran",
      "target": "China",
      "relType": "REDIRECTS_EXPORTS",
      "causalClassification": "COOPERATES_WITH",
      "description": "Iran redirected its oil exports to China — accepting yuan at 15-30% discounts below market price — as the only viable sales channel after sanctions eliminated dollar-denominated oil trade. This transforms a bilateral trade relationship into a strategic partnership: Iran gets survival revenue, China gets cheap energy.",
      "evidence": "Iran has redirected its remaining oil exports primarily to China, selling crude at discounts of 15-30% below market prices and accepting payment in yuan rather than dollars.",
      "evidenceStrength": "established",
      "magnitude": "significant",
      "year": "2012-present",
      "tags": ["energy-policy", "sanctions-circumvention", "yuan-internationalization"],
      "assertionType": "factual"
    },
    {
      "source": "Iran",
      "target": "Oil Markets",
      "relType": "EXPORTS_TO",
      "causalClassification": "PRODUCES",
      "description": "Iran's oil exports collapsed from 2.5 million barrels/day to approximately 0.5 million barrels/day under maximum pressure — the primary economic damage mechanism of sanctions, since oil revenue constitutes 60%+ of Iranian government revenue and the remaining exports trade at steep discounts through grey-market channels.",
      "evidence": "Iran's oil exports plummeted from 2.5 million barrels per day before maximum pressure sanctions to approximately 500,000 barrels per day — a 80% reduction in the country's primary revenue source.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "2018-present",
      "tags": ["energy-policy", "oil-pricing", "sanctions-mechanism"],
      "assertionType": "factual"
    },
    {
      "source": "Oil Markets",
      "target": "Dollar Hegemony",
      "relType": "REINFORCES",
      "causalClassification": "SUPPORTS",
      "description": "The global oil trade's overwhelming denomination in US dollars is the single largest structural pillar of dollar hegemony — every oil-importing nation must hold dollar reserves, every oil transaction creates dollar demand, and this circular reinforcement makes the dollar system self-sustaining, which in turn makes sanctions possible.",
      "evidence": "The dollar denomination of global oil trade creates structural demand for dollars worldwide — oil-importing nations must maintain dollar reserves, reinforcing the currency's dominance in global forex markets.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "1974-present",
      "tags": ["dollar-hegemony", "oil-pricing", "petrodollar"],
      "assertionType": "analytical"
    },
    {
      "source": "China",
      "target": "CIPS",
      "relType": "OPERATES",
      "causalClassification": "IMPLEMENTS",
      "description": "China built and operates CIPS as a deliberate structural alternative to SWIFT — a payment messaging system that processes cross-border yuan transactions outside US-controlled infrastructure, with 1,400+ institutional members forming an expanding network the US cannot surveil or block.",
      "evidence": "China has developed the Cross-Border Interbank Payment System with over 1,400 institutional members, processing international yuan transactions independently of the SWIFT network.",
      "evidenceStrength": "established",
      "magnitude": "significant",
      "year": "2015-present",
      "tags": ["financial-infrastructure", "de-dollarization", "challenger"],
      "assertionType": "factual"
    },
    {
      "source": "CIPS",
      "target": "SWIFT",
      "relType": "COMPETES_WITH",
      "causalClassification": "COMPETES_WITH",
      "description": "CIPS competes with SWIFT as a parallel cross-border payment messaging system — not by matching SWIFT's 11,000+ member scale, but by providing a sanctions-proof alternative channel for countries under US financial pressure. CIPS doesn't need to replace SWIFT; it only needs enough throughput to make sanctions leaky.",
      "evidence": "CIPS operates as an alternative to SWIFT for cross-border payments, allowing countries under US sanctions to conduct international transactions outside the reach of American financial surveillance and enforcement.",
      "evidenceStrength": "established",
      "magnitude": "significant",
      "year": "2015-present",
      "tags": ["financial-infrastructure", "sanctions-circumvention", "de-dollarization"],
      "assertionType": "analytical"
    },
    {
      "source": "CIPS",
      "target": "Dollar Hegemony",
      "relType": "ERODES",
      "causalClassification": "BLOCKS",
      "description": "Each transaction processed through CIPS instead of SWIFT is a transaction the US cannot surveil or block — structural erosion of the dollar-based financial architecture. As CIPS membership grows and yuan-denominated trade expands, the infrastructure that makes sanctions possible progressively weakens.",
      "evidence": "The growth of CIPS represents a gradual erosion of the dollar-based financial architecture — every yuan-denominated cross-border transaction is one that bypasses US-controlled infrastructure.",
      "evidenceStrength": "claimed",
      "magnitude": "significant",
      "year": "2018-present",
      "tags": ["de-dollarization", "financial-architecture", "systemic-risk"],
      "assertionType": "analytical"
    },
    {
      "source": "European Banking System",
      "target": "INSTEX",
      "relType": "REFUSES_TO_USE",
      "causalClassification": "BLOCKS",
      "description": "European banks refused to use INSTEX — the EU's own mechanism to circumvent US secondary sanctions — because the same overcompliance that makes sanctions work made INSTEX radioactive. No bank with US exposure would risk association, reducing the EU sovereignty experiment to a single transaction in its entire existence.",
      "evidence": "Despite political support from European governments, European banks refused to participate in INSTEX transactions — the same de-risking behavior that enforces US sanctions made Europe's own workaround unusable.",
      "evidenceStrength": "established",
      "magnitude": "significant",
      "year": "2019-present",
      "tags": ["european-sovereignty", "overcompliance", "failure-case"],
      "assertionType": "factual"
    },
    {
      "source": "INSTEX",
      "target": "Dollar Hegemony",
      "relType": "FAILS_TO_CHALLENGE",
      "causalClassification": "SUPPORTS",
      "description": "INSTEX's functional failure — processing only one transaction despite EU political backing — paradoxically reinforces dollar hegemony by demonstrating that even major US allies with explicit political motivation cannot build viable alternatives. The failure reveals that financial sovereignty requires more than political will; it requires financial infrastructure independent of the dollar system.",
      "evidence": "INSTEX processed only a single transaction — medical supplies — in its entire existence, despite being created by France, Germany, and the UK specifically to demonstrate European financial sovereignty.",
      "evidenceStrength": "established",
      "magnitude": "significant",
      "year": "2019-present",
      "tags": ["european-sovereignty", "dollar-hegemony", "failure-case"],
      "assertionType": "analytical"
    },
    {
      "source": "Secondary Sanctions",
      "target": "Iran",
      "relType": "ISOLATES",
      "causalClassification": "BLOCKS",
      "description": "Secondary sanctions extend Iran's economic isolation beyond US bilateral policy to a GLOBAL blockade — by threatening any foreign entity with dollar exclusion for Iranian transactions, the US effectively conscripts the entire global financial system into enforcing American policy against Iran, collapsing oil revenue, freezing reserves, and blocking even humanitarian imports.",
      "evidence": "Secondary sanctions have proven more devastating than primary sanctions — by threatening any global entity with loss of dollar access for Iranian transactions, they transform a bilateral dispute into a worldwide financial blockade.",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "1996-present",
      "tags": ["sanctions-policy", "extraterritorial", "economic-isolation"],
      "assertionType": "factual"
    },
    {
      "source": "Central Bank of Iran",
      "target": "Oil Markets",
      "relType": "PROCESSES_PAYMENTS_FOR",
      "causalClassification": "ENABLES",
      "description": "CBI was the institutional chokepoint for processing Iran's oil export payments — its SWIFT disconnection didn't just freeze one bank, it severed the payment processing channel for Iran's primary revenue stream, making it impossible to receive oil payments through normal international banking channels even from willing buyers.",
      "evidence": "The Central Bank of Iran served as the processing hub for oil export payments — its disconnection from SWIFT eliminated Iran's ability to receive international payments for its primary revenue source through standard banking channels.",
      "evidenceStrength": "established",
      "magnitude": "significant",
      "year": "2012-present",
      "tags": ["central-banking", "oil-pricing", "enforcement-mechanism"],
      "assertionType": "factual"
    },
    {
      "source": "Iran Nuclear Program",
      "target": "Dollar Hegemony",
      "relType": "THREATENS_INDIRECTLY",
      "causalClassification": "INFLUENCES",
      "description": "Iran's nuclear acceleration post-JCPOA forces continued sanctions use, which accelerates de-dollarization — creating a feedback loop: the nuclear threat justifies sanctions, sanctions drive alternative infrastructure development, alternatives erode the dollar system that makes sanctions work. The nuclear program unknowingly contributes to the structural erosion of American financial power.",
      "evidence": "Iran's enrichment to 60% post-withdrawal has been cited as justification for maintaining maximum pressure sanctions — but each year of sanctions drives further development of CIPS, yuan oil trade, and other dollar alternatives.",
      "evidenceStrength": "speculative",
      "magnitude": "marginal",
      "year": "2019-present",
      "tags": ["nuclear-policy", "de-dollarization", "feedback-loop"],
      "assertionType": "analytical"
    }
  ],
  "causal_chains": [
    {
      "name": "Sanctions Enforcement Chain",
      "description": "How US sanctions on Iran actually work — from policy decision to economic isolation, tracing the mechanism through each institutional layer",
      "links": [
        {
          "from": "United States",
          "to": "Treasury Department/OFAC",
          "explanation": "Executive orders and legislation direct OFAC to administer sanctions enforcement. OFAC maintains the SDN list — adding an entity freezes its US-connected assets and triggers cascading compliance obligations globally."
        },
        {
          "from": "Treasury Department/OFAC",
          "to": "Secondary Sanctions",
          "explanation": "OFAC operationalizes secondary sanctions by designating not just Iranian entities but threatening designation of ANY foreign entity transacting with them. This extends US domestic law extraterritorially — every international bank becomes a de facto US compliance officer."
        },
        {
          "from": "Secondary Sanctions",
          "to": "SWIFT",
          "explanation": "US threatened to sanction SWIFT itself if it didn't disconnect Iranian banks. SWIFT — nominally neutral Belgian cooperative — complied in 2012, disconnecting all designated Iranian banks from the global financial messaging system. First time in SWIFT's history."
        },
        {
          "from": "SWIFT",
          "to": "Central Bank of Iran",
          "explanation": "SWIFT disconnected CBI specifically — severing the institutional chokepoint through which all of Iran's sovereign financial transactions flowed. Without SWIFT access, CBI could not send or receive international payment messages."
        },
        {
          "from": "Central Bank of Iran",
          "to": "Oil Markets",
          "explanation": "CBI's disconnection from SWIFT made it impossible to process payments for Iran's oil exports through normal banking channels — cutting the revenue pipeline for 60%+ of Iranian government income."
        },
        {
          "from": "Oil Markets",
          "to": "Iran",
          "explanation": "Iran's oil exports collapsed from 2.5M to 0.5M barrels/day. Remaining exports sell at 15-30% discount through grey channels. GDP contracted 6% in 2018 alone. The complete chain: US policy → OFAC designation → secondary sanctions → SWIFT disconnection → CBI isolation → oil revenue collapse → economic crisis."
        }
      ]
    },
    {
      "name": "Overcompliance Amplification Chain",
      "description": "How a single enforcement action (BNP fine) created humanitarian consequences the sanctions weren't designed to produce",
      "links": [
        {
          "from": "Treasury Department/OFAC",
          "to": "BNP Paribas",
          "explanation": "OFAC fined BNP Paribas $8.97 billion in 2014 for processing transactions with sanctioned entities — the largest sanctions fine in history, exceeding most banks' annual profit. BNP was also temporarily barred from dollar clearing."
        },
        {
          "from": "BNP Paribas",
          "to": "European Banking System",
          "explanation": "The fine rewired risk calculations across every European bank: even if the probability of getting caught is 1%, the potential loss is existential ($8.97B+). Every compliance department in Europe concluded: refuse ALL Iran-connected transactions to eliminate any risk."
        },
        {
          "from": "European Banking System",
          "to": "Secondary Sanctions",
          "explanation": "European banks over-comply — refusing even LEGAL transactions explicitly permitted under humanitarian exemptions. This 'de-risking' behavior amplifies secondary sanctions far beyond their designed scope, creating enforcement the US didn't even need to impose."
        },
        {
          "from": "Secondary Sanctions",
          "to": "Iran",
          "explanation": "Overcompliance means Iran cannot import medicine, medical equipment, or food through normal banking channels — even though these are explicitly exempt from sanctions. The humanitarian cost the source never quantifies is a product of this amplification chain, not of the sanctions themselves."
        }
      ]
    },
    {
      "name": "Counter-Strategy Chain",
      "description": "How Iran and China build alternative financial infrastructure that circumvents sanctions AND erodes the system that makes sanctions possible",
      "links": [
        {
          "from": "Iran",
          "to": "China",
          "explanation": "Iran redirects oil exports to China at 15-30% discount, accepting yuan instead of dollars. China's willingness to buy circumvents the primary sanctions mechanism — dollar-denominated oil trade. Iran gets survival revenue; China gets cheap energy."
        },
        {
          "from": "China",
          "to": "CIPS",
          "explanation": "China processes Iran-China oil transactions through CIPS, bypassing SWIFT entirely. These transactions are invisible to US enforcement infrastructure. 1,400+ CIPS member institutions form an expanding alternative network."
        },
        {
          "from": "CIPS",
          "to": "Dollar Hegemony",
          "explanation": "Each CIPS transaction is one the US cannot surveil or block. As CIPS grows, the infrastructure that makes sanctions possible — US control of global financial messaging — erodes. CIPS doesn't need to replace SWIFT; it just needs enough throughput to make sanctions leaky."
        },
        {
          "from": "Dollar Hegemony",
          "to": "Secondary Sanctions",
          "explanation": "As dollar hegemony erodes (dollar reserve share: 71% → 58%), the threat of dollar exclusion becomes less existential. When alternatives are viable, secondary sanctions lose their coercive power — the weapon degrades with the system it depends on."
        }
      ]
    },
    {
      "name": "Diplomatic Destruction Chain",
      "description": "How the JCPOA's success was destroyed by the same political dynamics that created sanctions — and the cascading consequences",
      "links": [
        {
          "from": "JCPOA",
          "to": "Iran Nuclear Program",
          "explanation": "JCPOA froze enrichment at 3.67%, reduced centrifuges from 19,000 to 6,104, imposed the most intrusive IAEA inspections in history. Diplomacy achieved what decades of sanctions could not — verifiable nuclear rollback."
        },
        {
          "from": "United States",
          "to": "JCPOA",
          "explanation": "US withdrew in May 2018 despite 11 consecutive IAEA compliance certifications. Withdrawal was a policy choice (regime change advocacy, Israeli/Saudi pressure), not a response to Iranian violations. The diplomatic framework that worked was destroyed."
        },
        {
          "from": "JCPOA",
          "to": "Iran",
          "explanation": "With the agreement destroyed, Iran had no incentive to maintain voluntary constraints. Within a year, enrichment restarted beyond JCPOA limits. The agreement's death carried a meta-lesson for all US adversaries: American commitments don't survive presidential transitions."
        },
        {
          "from": "Iran",
          "to": "Iran Nuclear Program",
          "explanation": "Iran accelerated enrichment from 3.67% to 60% and restarted advanced centrifuges — producing the exact nuclear threat that sanctions and the JCPOA were designed to prevent. Maximum pressure created maximum proliferation risk."
        }
      ]
    }
  ]
}
```

**(All 20 relationships shown. All 4 causal chains shown.)**

**Gate check:**
- ≥15 relationships? ✓ (20 relationships — all shown)
- ≥2 causal chains? ✓ (4 chains — all shown)
- All descriptions ≥80 chars? ✓
- All have evidence quotes? ✓
- All have tags[]? ✓
- Summary ≥200 words? ✓ (267 words)
- narrative_flow 4+ moments? ✓ (6 moments)
- thesis + keyQuestion present? ✓
- NEW: assertionType on all relationships? ✓
- NEW: sourceType, sourcePerspective, analyticalNotes on project? ✓
- Proceed.

---

## Step 05: Embeddings (Worker, 60-90 seconds)

Worker doesn't call a tool directly here — embeddings are generated during the upload step. But the CONTENT that gets embedded is important:

```
WHAT GETS EMBEDDED (per entity):
  text = definition + " " + role + " " + tags.join(" ")
       + " " + openQuestions.join(" ")           ← NEW: makes gaps searchable
       + " " + inferredProperties.map(p=>p.property).join(" ")  ← NEW

WHAT GETS EMBEDDED (project):
  text = summary + " " + thesis + " " + keyQuestion
       + " " + analyticalNotes.join(" ")          ← NEW: makes between-lines searchable
       + " " + baseTags.join(" ")

INTERNALLY:
  python nlp/embed.py
  → sentence-transformers all-MiniLM-L6-v2
  → 384-dimensional vectors, cosine similarity
  → Each entity + project gets a vector
```

### Artifact: `data/temp/us-iran-sanctions/05_embeddings.json`
```json
{
  "entities": {
    "United States": [0.0234, -0.1567, 0.0891, ...],
    "SWIFT": [0.0412, -0.0923, 0.1234, ...],
    "Secondary Sanctions": [0.0567, -0.0345, ...],
    ...
  },
  "project": [0.0123, -0.0456, 0.0789, ...]
}
```

**384 dimensions per vector. ~15 entities + 1 project = 16 vectors.**

---

## Step 06: Validate → Upload → GDS → File Organization

### 6a: Validation (Worker, <1 second)

```
WORKER calls (inside memorytonic_extract):
  python neo4j/validate_project.py data/temp/us-iran-sanctions/

VALIDATE_PROJECT.PY checks 30+ rules:
  ✓ All 6 files present (01_html, 02_placement, 03_nlp, 04_entities, 05_embeddings, 06_extraction)
  ✓ placement JSON has all 5 fields
  ✓ unique_id matches project_name
  ✓ ≥10 entities with definitions ≥100 chars
  ✓ All categories from 14 fixed set
  ✓ All aliases present
  ✓ temporal_phases with ≥2 phases
  ✓ ≥15 relationships with descriptions ≥80 chars
  ✓ All evidence quotes present
  ✓ All causalClassification from 15 families
  ✓ ≥2 causal chains
  ✓ Summary ≥200 words
  ✓ tags has domain + subdomain + base_tags
  ✓ No generic tags ("important", "relevant")
  ✓ NEW: entity tags 3-8, kebab-case
  ✓ NEW: edge tags 1-4, kebab-case
  ✓ NEW: assertionType in (factual|analytical|opinion|prediction) for edges
  ✓ NEW: sourceType valid enum for project
  ✓ NEW: inferredProperties have property + reasoning + confidence

Exit code 0 → PASS. Proceed to upload.
```

### 6b: Upload (Worker, 2-5 seconds)

```
WORKER calls:
  memorytonic_extract({ /* full payload */ })

MCP SERVER (src/tools/extraction.ts):
  → Spawns: python neo4j/upload.py data/temp/us-iran-sanctions/

UPLOAD.PY runs 9 operations (7 HTTP calls to Neo4j):

  1. Create DateTime nodes (date + time)
     MERGE (d:DateTime {datetimeId: "2026-04-09"}) SET d.date = "2026-04-09"...
     MERGE (t:DateTime {datetimeId: "2026-04-09-143022"}) SET t.time = "14:30:22"...

  2. Create Project node
     CREATE (p:Project {
       projectId: "proj-a1b2c3d4e5f6",
       name: "US-Iran Sanctions Regime",
       uniqueId: "us-iran-sanctions",
       summary: "The US sanctions regime...",                    ← 267 words
       narrativeFlow: ["1979 Iranian Revolution...", ...],       ← 6 moments
       domain: "geopolitics",
       subdomain: "sanctions-policy",
       baseTags: ["iran-sanctions", "swift", ...],               ← 8 tags
       thesis: "US sanctions on Iran demonstrate...",            ← NEW
       keyQuestion: "Can the US sustain...",                     ← NEW
       geographicFocus: ["Iran", "United States", ...],         ← NEW
       historicalPeriod: "1979-2024",                            ← NEW
       sourceType: "think-tank",                                 ← NEW
       sourcePerspective: "US policy establishment framing...",  ← NEW
       analyticalNotes: ["Source never quantifies...", ...],     ← NEW (array)
       htmlPath: "data/sources/2026-04-09/us-iran-sanctions/01_html.html",
       directory: "Research",
       createdAt: datetime()
     })

  3. Link Project → Directory, DateTime, Collection
     (p)-[:IN_DIRECTORY]->(d:DirectoryCategory {name: "Research"})
     (p)-[:CREATED_ON]->(d:DateTime {datetimeId: "2026-04-09"})
     (p)-[:BELONGS_TO]->(c:Collection {name: "Global Finance Systems"})

  4. For each entity (15 entities):
     Check existence by name + aliases (cross-project merge!)
       "United States" → FOUND (exists in 7 other projects, projectCount: 7)
       "SWIFT" → FOUND (exists in 2 other projects, projectCount: 2)
       "Secondary Sanctions" → NOT FOUND (new entity, create)
       "JCPOA" → NOT FOUND (new entity, create)

     For EXISTING entities:
       MATCH (e:Entity {entityId: $eid})
       SET e.projectCount = e.projectCount + 1
       ← "United States" now projectCount: 8
       ← "SWIFT" now projectCount: 3 (→ becomes GOLD bridge!)

     For NEW entities:
       CREATE (e:Entity {
         entityId: "ent-x1y2z3",
         name: "Secondary Sanctions",
         aliases: ["Extraterritorial sanctions", "Secondary enforcement"],
         aliases_text: "Extraterritorial sanctions, Secondary enforcement",
         category: "Process",
         definition: "The mechanism by which...",
         role: "The force multiplier...",
         firstAppearanceIndex: 2,
         projectCount: 1,
         tags: ["enforcement-mechanism", "extraterritorial", ...],   ← NEW
         inferredProperties: [...],                                   ← NEW (JSON string)
         openQuestions: ["How many humanitarian...", ...],            ← NEW (array)
         disambiguationNotes: null,                                   ← NEW
         temporalRelevance: "1996-present",                          ← NEW
         createdAt: datetime()
       })

  5. Create MENTIONED_IN links (role is per-project):
     For each entity:
       MERGE (e)-[:MENTIONED_IN {role: $role}]->(p)
       ← Same entity gets DIFFERENT roles in different projects

  6. Create RELATES_TO edges:
     For each relationship:
       CREATE (a)-[r:RELATES_TO {
         relType: "SANCTIONS",
         causalClassification: "BLOCKS",
         description: "Comprehensive multilayer...",
         evidence: "The United States has...",
         evidenceStrength: "established",
         magnitude: "foundational",
         year: "1979-present",
         tags: ["sanctions-policy", "financial-warfare"],    ← NEW
         assertionType: "factual"                             ← NEW
       }]->(b)

  7. Create CausalChain nodes + CHAIN_LINK edges:
     CREATE (cc:CausalChain {chainId: "chain-abc", name: "Sanctions Enforcement Chain"...})
     For each link: CREATE (cc)-[:CHAIN_LINK {fromEntity: ..., toEntity: ..., order: N}]->(cc)

  8. Create TemporalEvent nodes:
     For each phase: CREATE (te:TemporalEvent {phaseIndex: N, label: "...", period: "..."})

  9. Store embeddings as vector properties:
     For each entity: SET e.embedding = $vector (384d float array)
     For project: SET p.embedding = $vector
```

### 6c: GDS Recomputation (Worker, 1-10 seconds)

```
WORKER calls:
  memorytonic_recompute()

MCP SERVER:
  → Spawns: python neo4j/gds.py

GDS.PY runs 4 algorithms on FULL graph:

  1. PageRank → entity.pageRank (float)
     "United States" gets high PageRank (many connections across 8 projects)

  2. Betweenness Centrality → entity.betweenness (float)
     "SWIFT" gets high betweenness (connects sanctions entities to finance entities)

  3. Degree Centrality → entity.degree (int)
     "Iran" now has high degree (many relationships in this new project)

  4. Node Similarity → SIMILAR_TO edges (cosine similarity > threshold)
     "Secondary Sanctions" SIMILAR_TO "SWIFT Sanctions" (from petrodollar project)

POST-GDS:
  Bridge tier recalculation:
    "United States": projectCount 8 → GOLD bridge (≥3)
    "SWIFT": projectCount 3 → GOLD bridge (was Silver with 2!) ← PROMOTION
    "Iran": projectCount 1 → no bridge yet
    "OPEC": unchanged
```

### 6d: File Organization (Worker, <1 second)

```
MOVE:
  data/temp/us-iran-sanctions/02_placement.json      → data/extracted/us-iran-sanctions/
  data/temp/us-iran-sanctions/03_nlp_entities.json    → data/extracted/us-iran-sanctions/
  data/temp/us-iran-sanctions/04_all_entities.json    → data/extracted/us-iran-sanctions/
  data/temp/us-iran-sanctions/05_embeddings.json      → data/extracted/us-iran-sanctions/
  data/temp/us-iran-sanctions/06_extraction.json      → data/extracted/us-iran-sanctions/
  data/temp/us-iran-sanctions/01_html.html            → data/sources/2026-04-09/us-iran-sanctions/

CLEAN: rm -rf data/temp/us-iran-sanctions/
```

---

## Worker Report (returned to Main Agent)

```json
{
  "success": true,
  "project": {
    "uniqueId": "us-iran-sanctions",
    "name": "US-Iran Sanctions Regime",
    "directory": "Research",
    "collection": "Global Finance Systems",
    "entityCount": 15,
    "relationshipCount": 20,
    "chainCount": 4,
    "temporalPhases": 5,
    "newEntities": 8,
    "mergedEntities": 7,
    "openQuestions": 12,
    "analyticalNotes": 4,
    "inferredProperties": 6
  },
  "artifacts": {
    "html": "sources/2026-04-09/us-iran-sanctions/01_html.html",
    "extraction": "extracted/us-iran-sanctions/06_extraction.json"
  },
  "gds": {
    "pageRankComputed": true,
    "betweennessComputed": true,
    "similarityEdges": 8,
    "bridgePromotions": ["SWIFT: Silver → Gold"]
  },
  "detective": {
    "sourceType": "think-tank",
    "sourcePerspective": "US policy establishment",
    "openQuestionCount": 12,
    "inferredPropertyCount": 6,
    "analyticalNoteCount": 4,
    "disambiguations": 0
  },
  "warnings": []
}
```

---

## Phase E: Report to User (Main Agent)

```
MAIN AGENT → USER:

  Extracted "US-Iran Sanctions Regime"
  → Research / Global Finance Systems
  → 15 entities (7 merged with existing graph, 8 new)
  → 20 relationships, 4 causal chains, 5 temporal phases
  → 384d embeddings generated

  Bridge update: SWIFT promoted to Gold bridge (now in 3 projects)

  Causal chains mapped:
  → Sanctions Enforcement: US → OFAC → Secondary Sanctions → SWIFT → CBI → Oil → Iran
  → Overcompliance Amplification: OFAC → BNP fine → EU banks → overcompliance → humanitarian harm
  → Counter-Strategy: Iran → China → CIPS → Dollar Hegemony erosion
  → Diplomatic Destruction: JCPOA success → US withdrawal → Iran accelerates enrichment

  Detective findings:
  → Source: think-tank (Brookings), US policy establishment perspective
  → 12 open research questions identified
  → 6 inferred properties (what text implies but doesn't state)
  → 4 analytical notes (between-the-lines observations)
  → Key gap: humanitarian cost of sanctions not addressed by this source

  Graph metrics recomputed.
```

---

## What The User Can Do Next

```
"What are the open questions in my graph?"
  → memorytonic_search for entities with openQuestions → "12 open questions across this project,
    including: humanitarian cost, legal basis for extraterritoriality, INSTEX effectiveness"

"Analyze my collection"
  → Research Agent spawns → 7-phase analysis → finds:
    "SWIFT is now a Gold bridge connecting petrodollar, sanctions, and banking projects.
     The sanctions enforcement chain in this project connects to the dollar hegemony chain
     in petrodollar-system — suggesting a unified narrative about US financial power."

"How does SWIFT connect to the petrodollar?"
  → memorytonic_find_paths({from: "SWIFT", to: "Petrodollar System"})
  → Path: SWIFT → REGULATES → European Banking System → ENABLES → Dollar Hegemony → ...

"Find a counter-perspective source on Iran sanctions"
  → sourcePerspective on this project flags US-centric framing
  → Research Agent suggests: "Extract an Iranian, European, or Global South analysis
     to fill the perspective gap identified in analyticalNotes"
```

---

## Neo4j State After Upload

```
BEFORE this extraction:
  Projects: 7
  Entities: 287
  Collections: 1 ("Global Finance Systems")
  Gold bridges: 5
  Silver bridges: 18
  Bronze bridges: 18

AFTER this extraction:
  Projects: 8
  Entities: 295 (287 + 8 new, 7 merged)
  Collections: 1
  Gold bridges: 6 (+1: SWIFT promoted)
  Silver bridges: 17 (-1: SWIFT promoted, +0 new)
  Bronze bridges: 20 (+2: new entities with high betweenness)
  Open questions: 12 (new — never existed before)
  Analytical notes: 4 (new — never existed before)
  Inferred properties: 6 (new — never existed before)
```

---

## Timing

```
Phase A:  Text scan              ~2 seconds
Phase B:  Skill discovery        ~3 seconds
Phase C:  Smart placement        ~20 seconds (includes user interaction)
Step 01:  HTML generation        ~15 seconds
Step 02:  NLP preprocessing      ~8 seconds
Step 03:  Entity discovery       ~40 seconds (detective read + extraction)
Step 04:  Full extraction        ~35 seconds
Step 05:  Embeddings             ~75 seconds (BOTTLENECK: BERT model)
Step 06a: Validation             ~1 second
Step 06b: Upload                 ~3 seconds
Step 06c: GDS                    ~5 seconds
Step 06d: File organization      ~1 second
Phase E:  Report                 ~3 seconds

TOTAL: ~3.5 minutes
```
