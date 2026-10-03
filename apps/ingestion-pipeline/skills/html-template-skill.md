# HTML Template — Investigation Viewer

**Purpose:** Defines the styled HTML template for `01_html.html` extraction artifacts. Every extraction agent MUST use this template when generating HTML in Step 01.

**Aesthetic:** Dark, industrial utilitarian. MemoryTonic brand identity.

---

## Template Structure

Every `01_html.html` MUST follow this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{TITLE}}</title>
<style>
{{PASTE THE FULL CSS BLOCK FROM BELOW}}
</style>
</head>
<body>
<article>
  <header class="hero">
    <div class="hero-label">MEMORYTONIC INVESTIGATION</div>
    <h1>{{TITLE}}</h1>
    <p class="hero-meta">{{SUBTITLE — e.g. "30 Moments | NARRATOR + GATORSQUARE Voice"}}</p>
  </header>

  <section class="moment" id="moment-01">
    <div class="moment-number">01</div>
    <h2>The Destruction</h2>
    <div class="voice voice-narrator">
      <span class="voice-tag">NARRATOR</span>
      <p>Content here...</p>
    </div>
  </section>

  <!-- For GATORSQUARE voice sections -->
  <section class="moment" id="moment-02">
    <div class="moment-number">02</div>
    <h2>The Question</h2>
    <div class="voice voice-gatorsquare">
      <span class="voice-tag">GATORSQUARE</span>
      <p>Content here...</p>
    </div>
  </section>

  <!-- For mixed voice sections (both NARRATOR and GATORSQUARE) -->
  <section class="moment" id="moment-05">
    <div class="moment-number">05</div>
    <h2>The Auction</h2>
    <div class="voice voice-narrator">
      <span class="voice-tag">NARRATOR</span>
      <p>Narrator content...</p>
    </div>
    <div class="voice voice-gatorsquare">
      <span class="voice-tag">GATORSQUARE</span>
      <p>GatorSquare analysis content...</p>
    </div>
  </section>

  <footer class="investigation-footer">
    <p>Extracted by MemoryTonic</p>
  </footer>
</article>
</body>
</html>
```

---

## CSS Block (embed in every HTML file)

```css
/* MemoryTonic Investigation Viewer — v1 */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --bg: #0b0c0e;
  --bg-surface: #12141a;
  --bg-elevated: #1a1d25;
  --text: #c8ccd4;
  --text-muted: #6b7280;
  --text-bright: #e8ecf4;
  --accent: #60a5fa;
  --accent-dim: #2563eb;
  --narrator-border: #374151;
  --gs-border: #d97706;
  --gs-bg: rgba(217, 119, 6, 0.04);
  --gs-tag: #f59e0b;
  --divider: #1e2028;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
}

html {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 17px;
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}

body {
  max-width: 740px;
  margin: 0 auto;
  padding: 2rem 1.5rem 6rem;
}

article { position: relative; }

/* --- Hero --- */
.hero {
  padding: 4rem 0 3rem;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 3rem;
}
.hero-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}
.hero h1 {
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--text-bright);
  line-height: 1.2;
  margin-bottom: 0.75rem;
}
.hero-meta {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

/* --- Moments --- */
.moment {
  position: relative;
  padding: 2.5rem 0;
  border-bottom: 1px solid var(--divider);
}
.moment:last-of-type {
  border-bottom: none;
}

.moment-number {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent-dim);
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.moment h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-bright);
  margin-bottom: 1.5rem;
  line-height: 1.3;
}

/* --- Voice blocks --- */
.voice {
  margin: 1.25rem 0;
  padding: 1.25rem 1.5rem;
  border-left: 3px solid var(--narrator-border);
  border-radius: 0 6px 6px 0;
  background: var(--bg-surface);
}
.voice p {
  margin-bottom: 0.9rem;
}
.voice p:last-child {
  margin-bottom: 0;
}

.voice-tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  margin-bottom: 0.75rem;
}

.voice-narrator .voice-tag {
  color: var(--text-muted);
  background: var(--bg-elevated);
}

.voice-gatorsquare {
  border-left-color: var(--gs-border);
  background: var(--gs-bg);
}
.voice-gatorsquare .voice-tag {
  color: var(--gs-tag);
  background: rgba(217, 119, 6, 0.1);
}

/* --- Typography --- */
strong {
  color: var(--text-bright);
  font-weight: 600;
}
em {
  color: var(--accent);
  font-style: italic;
}

blockquote {
  border-left: 3px solid var(--accent-dim);
  padding: 0.75rem 1.25rem;
  margin: 1rem 0;
  background: var(--bg-elevated);
  border-radius: 0 4px 4px 0;
  color: var(--text);
  font-style: italic;
}

ul, ol {
  margin: 1rem 0;
  padding-left: 1.5rem;
}
li {
  margin-bottom: 0.5rem;
}
li strong {
  color: var(--accent);
}

/* --- Key equation / callout --- */
.equation {
  text-align: center;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-bright);
  padding: 1.5rem;
  margin: 1.5rem 0;
  background: var(--bg-elevated);
  border: 1px solid var(--divider);
  border-radius: 6px;
}

/* --- Footer --- */
.investigation-footer {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--divider);
  text-align: center;
}
.investigation-footer p {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* --- Responsive --- */
@media (max-width: 600px) {
  body { padding: 1rem 1rem 4rem; }
  .hero h1 { font-size: 1.8rem; }
  .moment h2 { font-size: 1.25rem; }
  .voice { padding: 1rem; }
}
```

---

## Voice Detection Rules

When converting raw text to HTML, detect voices by these patterns:

| Pattern | Class | Visual |
|---------|-------|--------|
| `**NARRATOR:**` at start of paragraph | `voice-narrator` | Gray left border, dark surface bg |
| `**GATORSQUARE:**` at start of paragraph | `voice-gatorsquare` | Amber left border, subtle warm bg |
| No voice marker | Wrap in `voice-narrator` by default | — |

**Mixed moments:** When a moment has BOTH voices, create TWO separate `.voice` divs inside the same `.moment` section. The NARRATOR block comes first, GATORSQUARE second.

**Voice tag text:** Use `NARRATOR` or `GATORSQUARE` as the `<span class="voice-tag">` text. Strip the `**NARRATOR:**` from the paragraph text itself — it becomes the tag.

---

## Special Elements

### Equations / Key Formulas
Wrap in `<div class="equation">`:
```html
<div class="equation">
  Addiction + Military Power + Financial Innovation = Permanent Infrastructure.
</div>
```

### Blockquotes (letters, direct quotes)
Use `<blockquote>`:
```html
<blockquote>
  "Let us ask, where is your conscience? I have heard that the smoking of opium
  is very strictly forbidden by your country..."
</blockquote>
```

### Lists (mapped networks, inventories)
Use `<ul>` with `<strong>` for the lead term:
```html
<ul>
  <li><strong>Hong Kong</strong> — the original. Free port. British law.</li>
  <li><strong>Singapore</strong> — the second node. Same template.</li>
</ul>
```

---

## Non-Investigation Documents

For non-investigation content (skills, business docs, personal notes), use the same template but:
- Replace `MEMORYTONIC INVESTIGATION` with `MEMORYTONIC DOCUMENT`
- Omit `.moment-number` divs
- Use `<section>` without `.moment` class — just standard content sections
- Omit voice blocks — use plain `<p>` inside sections

---

## Applying to Existing Projects

To retroactively apply this template to existing `01_html.html` files, use the conversion script pattern:

1. Read the existing HTML
2. Extract the text content from each `<section>`
3. Detect NARRATOR/GATORSQUARE voice blocks
4. Wrap in the new template structure
5. Overwrite the file
6. Copy to `data/sources/YYYY-MM-DD/<project>/01_html.html` to update the served version

The HTML structure in Neo4j (`htmlPath`) points to the sources copy, so updating sources updates what the frontend sees.
