# Christianity’s Problems — Evidence Deck

A static, multilingual evidence deck and long-form case files about Christianity’s historical, philosophical, and moral problems. Each card separates what the texts say from what the evidence shows, states the strongest counterarguments, and rates its conclusions as possible, plausible, or probable.

Live site: <https://christianity-problems.pages.dev/>

## Run it locally

No build step is needed to preview the English deck:

```bash
npm start            # http://127.0.0.1:8080/
# or
node serve.js 3000   # custom port
```

Opening `index.html` directly from the filesystem also works, but the preview server is recommended: it enables the deep links (`/#problem-of-evil`) and lazy translation files exactly as they behave in production.

## Build and deploy

```bash
npm run build
```

`build.js` writes a self-contained `dist/` directory:

- `dist/index.html` — the deck, with all English content pre-rendered for crawlers
- `dist/<slug>/index.html` — one crawlable page per card; case files (`type: "essay"`) use the reading template with a table of contents and article JSON-LD
- `dist/translations/<code>.js` — one lazy-loaded file per language
- `dist/sitemap.xml`, `dist/robots.txt`, `dist/404.html`, `dist/_headers`, `dist/_redirects`

Deploy `dist/` to Cloudflare Pages (build command `npm run build`, output directory `dist`), Netlify, or any static host. The `_headers` file adds sensible security and caching headers on Cloudflare Pages.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The app shell: layout, styles, and client logic. |
| `essay.html` | The long-form case-file template: reading layout, TOC, footnotes, evidence drawers, print styles. |
| `cards.js` | English content. The single source of truth for cards and UI strings. |
| `translations.json` | Translation store (source of truth, includes source hashes). |
| `translations.js` | Generated language index. Do not edit by hand. |
| `translations/<code>.js` | Generated per-language data, loaded on demand. Do not edit by hand. |
| `languages.json` | Native names, English names, and text direction per language. |
| `build.js` | Static build: card pages, essay pages, TOC/reading time, sitemap, redirects, headers. |
| `serve.js` | Zero-dependency local preview server. |
| `translate.js` | Optional Gemini pipeline for adding new languages. |
| `scripts/i18n.js` | Shared build/validation helpers for translations. |
| `scripts/check-parts.js` | Validates one language’s translated parts. |
| `scripts/assemble-parts.js` | Merges validated parts into `translations.json`. |
| `scripts/validate-translations.js` | Validates every shipped language. |
| `scripts/visual-check.cjs` | Optional Puppeteer smoke test (needs a local Chrome). |
| `docs/quote-ledger-resurrection.md` | Quotation and citation audit for the first case file. |

## Editing content

Cards live in `cards.js`:

```js
{
  "slug": "problem-of-evil",
  "kicker": "Philosophy",
  "title": "The problem of evil",
  "claim": "One-sentence summary.",
  "body": `<details class='deck-details' open>…</details>`,
  "sources": [{ "label": "Author, Title (Year)", "url": "https://…" }]
}
```

- Keep the `slug` stable: it is the card’s URL (`/problem-of-evil/`), its deep link (`/#problem-of-evil`), and its translation key.
- Keep the `<details>` / `<summary>` structure. The first section of each card is open by default.
- Source links are not translated; bibliographic references stay in their original form.
- After editing English text, existing translations become stale (`_src` hashes stop matching). Run `node translate.js --list` to see what needs updating, or ask a translator to redo the changed card.

UI strings live in the `ui` object at the top of `cards.js`. `hint1` intentionally contains HTML (`<span class="keycap">`); all other strings are plain text. `cardOf` uses `{n}` and `{total}` placeholders.

### Case files

Some arguments are cumulative rather than evidentiary, so they use a long-form case file instead of a card of drawers. A case file is a card entry with `"type": "essay"`:

```js
{
  "slug": "resurrection",
  "type": "essay",
  "kicker": "History",
  "title": "The resurrection of Jesus",
  "subtitle": "One-sentence standfirst.",
  "claim": "The thesis, shown at the top of the page and on the deck summary.",
  "summary": "Short deck-index blurb.",
  "verdict": "The calibrated verdict, shown in the summary and the thesis box.",
  "updated": "2026-11-23",
  "readingTime": 15,
  "body": `<section id="stakes"><h2>…</h2>…</section>`,
  "sources": [{ "label": "1 Corinthians 15 (ESV)", "url": "https://…" }]
}
```

Rules for the format:

- The argument itself is always visible prose. `<details class="evidence">` is only for primary texts, comparison tables, and manuscript data.
- Each `<section>` needs an `id`; the build generates the table of contents from its `<h2>`.
- Sections with `data-toc="false"` (notes, sources) are excluded from the TOC.
- Footnotes use `<sup class="fn"><a href="#fn1" id="ref1">1</a></sup>` and a matching `<li id="fn1">` in the notes section.
- Build computes visible word count and reading time, and emits `Article` + `BreadcrumbList` JSON-LD.
- The deck renders a summary slide with the claim, verdict, reading time, and a link to `/<slug>/`; the full body is not loaded into the deck.
- `/resurrection-contradictions/` is 301-redirected to `/resurrection/` in `_redirects`.
- Quotes must be checked against a named edition. Anything that cannot be confirmed is paraphrased, not quoted. The audit for the first case file is in `docs/quote-ledger-resurrection.md`.

## Translations

The deck ships with six complete languages:

| Code | Language | Direction |
| --- | --- | --- |
| `es` | Español | LTR |
| `fr` | Français | LTR |
| `de` | Deutsch | LTR |
| `ar` | العربية | RTL |
| `ur` | اردو | RTL |
| `id` | Bahasa Indonesia | LTR |

English is the original. Every other language is labelled as machine translated in the interface, and the English original remains authoritative.

The translations currently cover the seven deck cards. Case files are English-only in this prototype: `validateTranslations` skips `type: "essay"` entries, and the deck falls back to English for the essay summary. Translating the long-form case changes its `_src` hash and is deliberately deferred until the English text is final.

### How it works

- `translations.json` is the source of truth. It stores the UI block, every card, and `_src` / `uiSrc` hashes of the English source at translation time.
- `npm run translations` regenerates `translations/<code>.js` and the `translations.js` index from `translations.json`.
- The browser loads only the selected language: `translations/ar.js` is not fetched until the user picks Arabic.
- Missing fields fall back to English field by field, so a partially translated language still works.
- The selected language is shareable: `/?lang=ar#problem-of-evil` opens the Arabic version of a card directly.
- RTL languages flip the whole interface, and load Noto Naskh Arabic / Noto Nastaliq Urdu on demand. The card carousel itself stays LTR internally, so swipe and arrow navigation remain consistent.

### Add a new language with Gemini (optional)

The pipeline needs a Gemini API key. Never put the key in a file.

```bash
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-3.5-flash-lite"   # optional override

node translate.js pt          # translate missing or changed Portuguese cards
node translate.js pt --force  # retranslate everything for Portuguese
node translate.js --list      # show which languages are current or stale
node translate.js --rebuild   # regenerate translations/*.js without an API call
```

The script saves after every card, so a crash or rate limit loses nothing. It checks that the HTML tags and numbers match the English and retries when they do not.

Add the language’s metadata (native name, English name, direction) to `languages.json` first; otherwise it falls back to the bare code.

### Add or fix a translation by hand

The bundled translations were produced card by card and validated. To work on a language manually:

1. Write `.work/parts/<code>/ui.json` and `.work/parts/<code>/<slug>.json` (one file per card).
2. Run `node scripts/check-parts.js <code>` until it prints OK.
3. Run `node scripts/assemble-parts.js <code>` to merge it into `translations.json` and rebuild the generated files.

To patch a shipped translation directly, edit `translations.json`, then run `npm run translations`. Do not edit `translations.js` or `translations/<code>.js`.

### Validate everything

```bash
npm run validate
```

This checks, for every language:

- all UI keys and all card fields are present and non-empty;
- HTML tags, attributes, and their order match the English;
- numbers and years match;
- `<details>` and `<summary>` counts match;
- no replacement characters or stray `</script>`;
- the body length is plausible (catches omissions);
- RTL languages actually contain the expected script;
- `_src` hashes against the current English (stale translations are reported).

`npm test` runs validation and the production build.

## Browser support

Modern browsers with `<details>`, `inert`, CSS logical properties, and `hidden`. That covers Chrome/Edge 102+, Firefox 112+, and Safari 15.5+. The deck degrades gracefully without JavaScript to the pre-rendered English content produced by the build.

## License

MIT.
