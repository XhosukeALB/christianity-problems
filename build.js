#!/usr/bin/env node
/**
 * Static build for Christianity's Problems.
 *
 * Produces a crawlable page per card, a sitemap, and the lazily loaded
 * translation files. The site still works as a single-page deck; the extra
 * pages exist so that each argument has its own URL, title, and description.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadDeck, buildTranslations } = require('./scripts/i18n');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const TEMPLATE = path.join(ROOT, 'index.html');
const BASE_URL = 'https://christianity-problems.pages.dev';
const SITE_NAME = 'Christianity’s Problems';

const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function atomicWrite(file, text) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, text, 'utf8');
  fs.renameSync(temporary, file);
}

function copyFile(source, target) {
  fs.copyFileSync(source, target);
}

function staticDeck(deck) {
  const ui = deck.ui;
  const dir = 'ltr';
  let html = '<div class="slide" dir="ltr"><div class="cover"><div class="cover-kicker">' + esc(ui.kicker) + '</div><h1>' + esc(ui.title) + '</h1><div class="cover-rule"></div><p class="cover-sub">' + esc(ui.sub) + '</p><p class="cover-method">' + esc(ui.method) + '</p><ul class="cover-hint">'
    + '<li class="desktop-hint">' + ui.hint1 + '</li><li class="mobile-hint">' + esc(ui.hintSwipe) + '</li><li class="desktop-hint">' + ui.hint2 + '</li><li class="desktop-hint">' + ui.hint3 + '</li><li>' + ui.hint4 + '</li></ul></div></div>';

  for (const card of deck.cards) {
    const sources = (card.sources || []).map((source) => {
      const external = /^https?:\/\//.test(source.url);
      return '<li><a class="source-link" dir="auto" href="' + esc(source.url) + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(source.label) + '</a></li>';
    }).join('');
    html += '<div class="slide" dir="' + dir + '" data-slug="' + esc(card.slug) + '">'
      + '<div class="card-inner">'
      + '<div class="card-kicker">' + esc(card.kicker) + '</div>'
      + '<h2 class="card-title">' + esc(card.title) + '</h2>'
      + '<p class="card-claim">' + esc(card.claim) + '</p>'
      + '<div class="card-body">' + card.body + '</div>'
      + '<div class="sources"><h3>' + esc(ui.sources) + '</h3><ol>' + sources + '</ol></div>'
      + '</div></div>';
  }
  return html;
}

function pageMeta(options) {
  const title = options.title;
  const description = options.description;
  const url = options.url;
  const isCard = !!options.slug;
  const jsonLd = isCard
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: options.headline || options.title,
        description: options.description,
        url,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: BASE_URL + '/' },
        inLanguage: 'en'
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        description: options.description,
        url: BASE_URL + '/',
        inLanguage: 'en'
      };
  return [
    '<meta name="description" content="' + esc(description) + '" />',
    '<meta property="og:type" content="' + (isCard ? 'article' : 'website') + '" />',
    '<meta property="og:site_name" content="' + esc(SITE_NAME) + '" />',
    '<meta property="og:title" content="' + esc(title) + '" />',
    '<meta property="og:description" content="' + esc(description) + '" />',
    '<meta property="og:url" content="' + esc(url) + '" />',
    '<meta property="og:image" content="' + BASE_URL + '/assets/og.png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' + esc(title) + '" />',
    '<meta name="twitter:description" content="' + esc(description) + '" />',
    '<meta name="twitter:image" content="' + BASE_URL + '/assets/og.png" />',
    '<link rel="canonical" href="' + esc(url) + '" />',
    '<script type="application/ld+json">' + JSON.stringify(jsonLd).replace(/</g, '\\u003c') + '</script>'
  ].join('\n');
}

function buildPage(template, deck, options) {
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + esc(options.title) + '</title>');
  html = html.replace(/<meta name="description"[^>]*>/, '');
  html = html.replace(/<meta property="og:type"[^>]*>/, '');
  html = html.replace(/<meta property="og:site_name"[^>]*>/, '');
  html = html.replace(/<meta property="og:title"[^>]*>/, '');
  html = html.replace(/<meta property="og:description"[^>]*>/, '');
  html = html.replace(/<meta property="og:url"[^>]*>/, '');
  html = html.replace(/<meta property="og:image"[^>]*>/, '');
  html = html.replace(/<meta property="og:image:width"[^>]*>/, '');
  html = html.replace(/<meta property="og:image:height"[^>]*>/, '');
  html = html.replace(/<meta name="twitter:card"[^>]*>/, '');
  html = html.replace(/<meta name="twitter:title"[^>]*>/, '');
  html = html.replace(/<meta name="twitter:description"[^>]*>/, '');
  html = html.replace(/<meta name="twitter:image"[^>]*>/, '');
  html = html.replace(/<link rel="canonical"[^>]*>/, '');
  html = html.replace('</head>', pageMeta(options) + '\n</head>');

  html = html.replace('<div class="deck-track" id="track"><!--PRERENDER--></div>',
    '<div class="deck-track" id="track">' + staticDeck(deck) + '</div>');

  const boot = 'window.__HOME__="/";' + (options.slug ? 'window.__INITIAL_SLUG__="' + options.slug + '";' : '');
  html = html.replace('<script>/*BOOT*/</script>', '<script>' + boot + '</script>');
  html = html.replace('src="cards.js"', 'src="/cards.js"');
  html = html.replace('src="translations.js"', 'src="/translations.js"');

  return html;
}

function build404() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Page not found — Christianity’s Problems</title>
<meta name="robots" content="noindex" />
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf6;color:#15100a;font-family:Georgia,serif;padding:2rem}
.box{max-width:34rem;text-align:center}
.kicker{font:800 .7rem/1 system-ui,sans-serif;letter-spacing:.36em;text-transform:uppercase;color:#5e3a18;margin-bottom:1rem}
h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1;margin:0 0 1rem;letter-spacing:-.04em}
p{font-family:system-ui,sans-serif;color:#6e5b44;line-height:1.6}
a{display:inline-block;margin-top:1.2rem;padding:.7rem 1.1rem;border:1px solid #7e5c20;border-radius:10px;color:#15100a;text-decoration:none;font:600 .9rem/1 system-ui,sans-serif}
a:hover{background:rgba(94,58,24,.08)}
</style>
</head>
<body>
<div class="box">
<div class="kicker">404</div>
<h1>This page is not in the deck.</h1>
<p>The address may be mistyped, or the card may have moved. The cover page lists every argument.</p>
<a href="/">Return to the deck</a>
</div>
</body>
</html>
`;
}

function main() {
  buildTranslations();

  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const deck = loadDeck();
  const template = fs.readFileSync(TEMPLATE, 'utf8');

  copyFile(path.join(ROOT, 'cards.js'), path.join(DIST, 'cards.js'));
  copyFile(path.join(ROOT, 'translations.js'), path.join(DIST, 'translations.js'));

  const assetsDir = path.join(ROOT, 'assets');
  if (fs.existsSync(assetsDir)) fs.cpSync(assetsDir, path.join(DIST, 'assets'), { recursive: true });

  const translationsDir = path.join(ROOT, 'translations');
  if (fs.existsSync(translationsDir)) {
    fs.mkdirSync(path.join(DIST, 'translations'), { recursive: true });
    for (const file of fs.readdirSync(translationsDir)) {
      if (file.endsWith('.js')) copyFile(path.join(translationsDir, file), path.join(DIST, 'translations', file));
    }
  }

  const description = deck.ui.sub + ' ' + deck.ui.method;
  const home = buildPage(template, deck, {
    title: 'Christianity’s Problems — Evidence Deck',
    description: description.slice(0, 300),
    url: BASE_URL + '/'
  });
  atomicWrite(path.join(DIST, 'index.html'), home);

  for (const card of deck.cards) {
    const cardDir = path.join(DIST, card.slug);
    fs.mkdirSync(cardDir, { recursive: true });
    const page = buildPage(template, deck, {
      title: card.title + ' — Christianity’s Problems',
      headline: card.title,
      description: card.claim,
      url: BASE_URL + '/' + card.slug + '/',
      slug: card.slug
    });
    atomicWrite(path.join(cardDir, 'index.html'), page);
  }

  atomicWrite(path.join(DIST, '404.html'), build404());

  const today = new Date().toISOString().slice(0, 10);
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  sitemap += '  <url><loc>' + BASE_URL + '/</loc><lastmod>' + today + '</lastmod><priority>1.0</priority></url>\n';
  for (const card of deck.cards) {
    sitemap += '  <url><loc>' + BASE_URL + '/' + card.slug + '/</loc><lastmod>' + today + '</lastmod><priority>0.8</priority></url>\n';
  }
  sitemap += '</urlset>\n';
  atomicWrite(path.join(DIST, 'sitemap.xml'), sitemap);

  atomicWrite(path.join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: ' + BASE_URL + '/sitemap.xml\n');

  atomicWrite(path.join(DIST, '_headers'), [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: geolocation=(), microphone=(), camera=()',
    '',
    '/cards.js',
    '  Cache-Control: public, max-age=300, must-revalidate',
    '',
    '/translations.js',
    '  Cache-Control: public, max-age=300, must-revalidate',
    '',
    '/translations/*',
    '  Cache-Control: public, max-age=3600, must-revalidate',
    ''
  ].join('\n'));

  console.log('Built dist/ with ' + (deck.cards.length + 1) + ' pages, sitemap, robots, and 404.');
}

if (require.main === module) main();
module.exports = { main, buildPage, staticDeck };
