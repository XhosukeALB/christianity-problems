#!/usr/bin/env node
/**
 * Assemble validated .work/parts/<lang>/ files into translations.json and
 * rebuild translations/<lang>.js.
 *
 *   node scripts/assemble-parts.js es fr de ar ur id
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { FIELDS, ROOT, loadDeck, cardHash, uiHash, buildTranslations } = require('./i18n');
const { checkParts } = require('./check-parts');

const STORE = path.join(ROOT, 'translations.json');
const PART_DIR = path.join(ROOT, '.work/parts');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function main() {
  const langs = process.argv.slice(2);
  if (!langs.length) { console.error('Usage: node scripts/assemble-parts.js <lang> [<lang> ...]'); process.exit(1); }
  const deck = loadDeck();
  const store = fs.existsSync(STORE) ? readJson(STORE) : {};
  let failures = 0;

  for (const lang of langs) {
    const result = checkParts(lang);
    if (result.errors.length) {
      failures++;
      console.error(lang + ': refusing to assemble — ' + result.errors.length + ' error(s)');
      for (const error of result.errors.slice(0, 12)) console.error('  ' + error);
      continue;
    }
    const dir = path.join(PART_DIR, lang);
    const ui = readJson(path.join(dir, 'ui.json'));
    const cleanUi = {};
    for (const key of Object.keys(deck.ui)) cleanUi[key] = ui[key];

    const cards = {};
    for (const card of deck.cards) {
      if (card.type === 'essay') continue;
      const translated = readJson(path.join(dir, card.slug + '.json'));
      const clean = {};
      for (const field of FIELDS) clean[field] = translated[field];
      clean._src = cardHash(card);
      cards[card.slug] = clean;
    }

    store[lang] = { ui: cleanUi, uiSrc: uiHash(deck.ui), cards };
    console.log(lang + ': assembled ' + deck.cards.filter((card) => card.type !== 'essay').length + ' cards (essays stay English)');
  }

  if (failures) { process.exitCode = 1; return; }
  fs.writeFileSync(STORE, JSON.stringify(store, null, 2) + '\n', 'utf8');
  const { summary } = buildTranslations();
  console.log('\nTranslations built:');
  for (const row of summary) console.log('  ' + row.code + ': ' + row.cards + '/' + row.total + ' cards, ' + (row.bytes / 1024).toFixed(1) + ' KB');
}

if (require.main === module) main();
module.exports = { main };
