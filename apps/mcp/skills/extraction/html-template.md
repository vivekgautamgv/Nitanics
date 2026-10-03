# HTML Template (Step 01)

**How to convert raw text into formatted, dark-theme HTML for permanent storage and display in C03.**

---

## Purpose

The HTML is stored at `data/sources/YYYY-MM-DD/<slug>/01_html.html` and displayed in C03's Source page via an iframe with dark theme injection.

---

## Template Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Project Name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.8;
      color: #e0e0e0;
      background: #1a1a1a;
      padding: 2rem 3rem;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { font-size: 2rem; margin: 2rem 0 1rem; color: #ffffff; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin: 1.8rem 0 0.8rem; color: #f0f0f0; }
    h3 { font-size: 1.2rem; margin: 1.5rem 0 0.6rem; color: #e8e8e8; }
    p { margin: 0.8rem 0; text-align: justify; }
    blockquote {
      border-left: 3px solid #4a9eff;
      padding: 0.8rem 1.2rem;
      margin: 1rem 0;
      background: #222;
      font-style: italic;
      color: #ccc;
    }
    ul, ol { margin: 0.8rem 0; padding-left: 1.5rem; }
    li { margin: 0.3rem 0; }
    strong { color: #ffffff; }
    em { color: #b0b0b0; }
    code { background: #2a2a2a; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    hr { border: none; border-top: 1px solid #333; margin: 2rem 0; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #444; padding: 0.5rem 0.8rem; text-align: left; }
    th { background: #2a2a2a; color: #fff; }
    .narrator {
      background: #1e2a3a;
      border-left: 3px solid #4a9eff;
      padding: 1rem 1.2rem;
      margin: 1.2rem 0;
      border-radius: 0 4px 4px 0;
    }
    .system-note {
      background: #2a1e1e;
      border-left: 3px solid #ff6b6b;
      padding: 1rem 1.2rem;
      margin: 1.2rem 0;
      border-radius: 0 4px 4px 0;
      font-size: 0.95em;
    }
  </style>
</head>
<body>
  <!-- Content goes here -->
</body>
</html>
```

---

## Content Rules

1. **Preserve ALL depth from the source.** Do not summarize, truncate, or simplify. The HTML is the archival copy.

2. **Use semantic HTML.** Headers (h1-h3), paragraphs (p), blockquotes, lists — not just raw text in divs.

3. **Dark theme is built-in.** C03 injects dark theme CSS, but the HTML should already be dark-compatible (the template above handles this).

4. **Two voice blocks:**
   - `.narrator` — analysis, explanation, context (blue left border)
   - `.system-note` — system mechanics, technical details (red left border)

5. **Tables for structured data.** If the source has tabular information, preserve it as HTML tables.

6. **Code blocks for technical content.** Use `<code>` for inline and `<pre><code>` for blocks.

---

## What NOT to Do

- Don't add navigation or interactive elements
- Don't use external CSS or JavaScript
- Don't include images (text-only archival)
- Don't add headers/footers beyond the content
- Don't truncate — every paragraph from the source must appear
