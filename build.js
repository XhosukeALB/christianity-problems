#!/usr/bin/env node
/**
 * Static Site Generator (SSG) for Christianity's Problems.
 * Generates SEO-friendly HTML pages for each card, plus a sitemap.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIST_DIR = path.join(__dirname, 'dist');
const TEMPLATE_FILE = path.join(__dirname, 'index.html');
const CARDS_FILE = path.join(__dirname, 'cards.js');
const BASE_URL = 'https://christianity-problems.pages.dev';

// 1. Load cards data
function loadDeck() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(CARDS_FILE, 'utf8'), sandbox);
  if (!sandbox.window.DECK) throw new Error('cards.js must define window.DECK');
  return sandbox.window.DECK;
}

// 2. Setup dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR);

// 3. Copy assets
const assets = ['cards.js', 'translations.js', 'translations.json'];
assets.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    fs.copyFileSync(path.join(__dirname, file), path.join(DIST_DIR, file));
  }
});

// 4. Read template and deck
const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
const deck = loadDeck();

// 5. Write the main index.html
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), template);

// 6. Generate per-card static pages
deck.cards.forEach(card => {
  const slug = card.slug;
  const cardDir = path.join(DIST_DIR, slug);
  if (!fs.existsSync(cardDir)) fs.mkdirSync(cardDir);

  // Inject meta tags for SEO and social sharing
  const metaTags = `
    <meta name="description" content="${card.claim}">
    <meta property="og:title" content="${card.title}">
    <meta property="og:description" content="${card.claim}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${BASE_URL}/${slug}/">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${card.title}">
    <meta name="twitter:description" content="${card.claim}">
    <link rel="canonical" href="${BASE_URL}/${slug}/">
    <script>
      // Redirect human visitors to the hash-routed SPA
      if (window.location.pathname !== '/') {
        window.location.replace('/#${slug}');
      }
    </script>
  `;

  let pageHtml = template
    .replace('<title>Christianity’s Problems: Evidence Deck</title>', `<title>${card.title} - Christianity's Problems</title>`)
    .replace('</head>', metaTags + '</head>');

  // Pre-render the card content for bots/crawlers
  const preRenderedCard = `
    <div class="slide" data-slug="${slug}">
      <div class="card-inner">
        <div class="card-kicker">${card.kicker}</div>
        <h2 class="card-title">${card.title}</h2>
        <p class="card-claim">${card.claim}</p>
        <div class="card-body">${card.body}</div>
      </div>
    </div>
  `;
  
  // Insert pre-rendered content into the track
  pageHtml = pageHtml.replace('<div class="deck-track" id="track"></div>', `<div class="deck-track" id="track">${preRenderedCard}</div>`);

  fs.writeFileSync(path.join(cardDir, 'index.html'), pageHtml);
});

// 7. Generate sitemap.xml
let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
sitemap += `  <url><loc>${BASE_URL}/</loc></url>\n`;
deck.cards.forEach(card => {
  sitemap += `  <url><loc>${BASE_URL}/${card.slug}/</loc></url>\n`;
});
sitemap += '</urlset>';
fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);

// 8. Generate robots.txt
fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);

console.log('Build complete. Output is in the /dist directory.');