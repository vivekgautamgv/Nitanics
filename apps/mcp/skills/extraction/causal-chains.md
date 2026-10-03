# Causal Chains (Step 04, Part 2)

**Causal chains show HOW effects propagate through a system. They are the highest-value extraction artifact — no other tool produces these.**

---

## What a Causal Chain IS

An ordered sequence of entity → entity links, where each link explains the **mechanism of transmission** — HOW the effect passes from one entity to the next.

```
Saudi Arabia → Oil Production → Global Oil Price → US Consumer Prices → Federal Reserve → Interest Rates

Link 1: Saudi Arabia → Oil Production
  "Saudi cuts reduce global supply by 5-8% through OPEC quota enforcement"

Link 2: Oil Production → Global Oil Price
  "Reduced supply with constant demand pushes Brent crude up 15-30%"

Link 3: Global Oil Price → US Consumer Prices
  "Oil price increase flows to gasoline (+$0.30/gallon per $10/barrel)
   and through manufacturing and transport costs within 3-6 months"

Link 4: US Consumer Prices → Federal Reserve
  "CPI inflation above 2% target triggers Fed tightening bias per dual mandate"

Link 5: Federal Reserve → Interest Rates
  "Fed raises federal funds rate in 25bp increments to cool demand-pull inflation"
```

---

## What a Causal Chain is NOT

- **Not a timeline.** "A happened, then B happened" is chronology, not causation.
- **Not a summary.** "The document discusses A, B, and C" is a summary.
- **Not a single relationship.** "A causes B" is one edge. A chain traces the FULL propagation path.

---

## Output Format

Within `06_extraction.json`:

```json
{
  "causal_chains": [
    {
      "name": "Oil Price Transmission Mechanism",
      "description": "How Saudi production decisions propagate through the global economy to US monetary policy",
      "links": [
        {
          "source": "Saudi Arabia",
          "target": "Oil Production",
          "order": 1,
          "explanation": "Saudi Arabia reduces global oil supply by 5-8% through OPEC quota enforcement, using spare capacity of 2-3M bpd as leverage"
        },
        {
          "source": "Oil Production",
          "target": "Global Oil Price",
          "order": 2,
          "explanation": "Supply reduction with inelastic short-term demand pushes Brent crude prices up 15-30% within weeks"
        }
      ]
    }
  ]
}
```

---

## How to Find Chains

### 1. Follow the Consequences

Every significant relationship has downstream effects. Ask: "And then what happens?"

```
US sanctions Iran → [and then?]
→ Iranian banks lose SWIFT access → [and then?]
→ Iran can't receive oil payments → [and then?]
→ Iran's oil exports drop 80% → [and then?]
→ Iran's government revenue collapses → [and then?]
→ Iran comes to negotiating table
```

That's a 5-link chain. Each "and then?" adds a link.

### 2. Follow the Dependencies

Every DEPENDS_ON relationship implies a chain: "What happens when the dependency breaks?"

```
Europe depends on Russian gas → Russia restricts supply → Energy prices spike
→ European industry faces cost crisis → EU accelerates LNG infrastructure
→ US becomes major LNG supplier to Europe
```

### 3. Follow the Feedback Loops

Look for cycles where the output feeds back into the input:

```
Dollar strength → Cheap US imports → Growing trade deficit → Foreign dollar reserves grow
→ Foreign demand for US treasuries → Low US interest rates → Dollar stays strong
```

This is a reinforcing loop. Extract it as a chain — the cycle nature is the insight.

### 4. Follow the Counter-Strategies

When the text describes an action AND a response:

```
US sanctions via SWIFT → Creates demand for SWIFT alternatives
→ China develops CIPS → Russia connects to CIPS
→ BRICS payment volume grows → Dollar share of global payments erodes
```

---

## Chain Quality

### Link Explanations: System Mechanics

Each explanation must describe the MECHANISM — HOW the effect transmits.

| Quality | Example |
|---------|---------|
| **FAIL** | "This leads to economic problems." |
| **PASS** | "Iranian banks losing SWIFT access eliminates their ability to receive international payment instructions, making oil trade settlement impossible through normal banking channels." |
| **EXCELLENT** | "Iranian banks losing SWIFT access means they can no longer receive MT103 (single customer transfers) or MT202 (bank-to-bank transfers) messages, eliminating the communication layer needed for oil trade settlement. This doesn't freeze existing funds — it cuts off the instruction channel, making new transactions impossible through normal banking infrastructure." |

### Chain Length

| Length | Verdict |
|--------|---------|
| 2 links | Too short — this is just a relationship, not a chain |
| 3-4 links | Minimum viable chain — shows basic propagation |
| 5-7 links | Ideal — shows full system propagation |
| 8+ links | Be cautious — are all links adding insight, or is this stretched? |

### Chain Naming

The chain name should describe the MECHANISM, not the topic.

```
BAD:  "Saudi Arabia Chain"
GOOD: "Oil Price Transmission Mechanism"
GOOD: "Sanctions Enforcement Through Financial Infrastructure"
GOOD: "Dollar Hegemony Self-Reinforcing Cycle"
```

### Chain Description

1-2 sentences explaining what this chain SHOWS — the insight.

```
BAD:  "A chain about oil and Saudi Arabia."
GOOD: "How Saudi production decisions propagate through OPEC, global oil markets,
       and transportation costs to ultimately affect US monetary policy decisions,
       demonstrating the energy-finance-policy transmission mechanism."
```

---

## Chains Are Optional

Use an empty array when the source does not support a causal mechanism. Every included chain link must match an evidence-bearing relationship; never extend a chain using outside knowledge. To locate supported mechanisms:

1. **Look for "because," "therefore," "as a result," "consequently"** — these signal causation
2. **Look for action-reaction pairs** — A does something, B responds
3. **Look for system descriptions** — any system has cause-and-effect pathways
4. **Look for historical sequences** — event A led to event B which caused event C

---

## Chain Entities Must Exist

Every entity in a chain link MUST be in your `04_all_entities.json`. Chains reference entities by name — if the entity doesn't exist, the chain breaks.

Before writing chains, verify: "Is every entity I'm linking actually in my entity list?"

---

## How Chains Are Displayed

In C02 Graph Studio: CausalChainView shows chains as step-by-step visualizations with entity nodes connected by labeled arrows. Each link displays the explanation text.

In C03 Frontend: Chain cards on the project page show chain name, description, and expandable link details.

**The explanation at each link is what the researcher reads.** If it says "this affects that," the card is useless. If it describes the mechanism, the card is a research tool.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Chain is just a timeline | Chains are CAUSAL, not chronological. Each link must show WHY A causes B. |
| All links say "leads to" | Each link should have a specific mechanism. HOW does it lead? |
| Chain uses entities not in entity list | Every chain entity must exist in 04_all_entities.json |
| Chain has 2 links | Too short — expand by asking "and then what?" at each end |
| Chain name is a topic | Name should describe the mechanism: "Oil Price Transmission" not "Oil" |
| Missing counter-chain | If the text describes an action AND resistance, extract both chains |
