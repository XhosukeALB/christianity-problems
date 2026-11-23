#!/usr/bin/env node
/**
 * Validate one language's translated parts before assembling:
 *   node scripts/check-parts.js ar
 *
 * Parts live in .work/parts/<lang>/ as one JSON file per card plus ui.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { FIELDS, ROOT, loadDeck, tagSig, digitSig, stripTags } = require('./i18n');

const PART_DIR = path.join(ROOT, '.work/parts');
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
const LETTER = /\p{L}/gu;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function checkParts(lang) {
  const deck = loadDeck();
  const dir = path.join(PART_DIR, lang);
  const errors = [];
  const warnings = [];
  const at = (suffix) => lang + (suffix ? ' / ' + suffix : '');

  if (!fs.existsSync(dir)) return { errors: [at('') + ': no parts directory'], warnings, cards: 0 };

  const uiFile = path.join(dir, 'ui.json');
  if (!fs.existsSync(uiFile)) errors.push(at('ui') + ': missing ui.json');
  else {
    let ui;
    try { ui = readJson(uiFile); } catch (error) { errors.push(at('ui') + ': invalid JSON: ' + error.message); }
    if (ui) {
      for (const key of Object.keys(deck.ui)) {
        const value = ui[key];
        if (typeof value !== 'string' || !value.trim()) { errors.push(at('ui.' + key) + ': missing or empty'); continue; }
        if (tagSig(deck.ui[key]) !== tagSig(value)) errors.push(at('ui.' + key) + ': HTML tags changed');
        if (value.includes('\uFFFD')) errors.push(at('ui.' + key) + ': replacement character');
        if (key === 'cardOf') {
          for (const placeholder of ['{n}', '{total}']) {
            if (!value.includes(placeholder)) errors.push(at('ui.cardOf') + ': missing ' + placeholder);
          }
        }
      }
    }
  }

  let complete = 0;
  for (const card of deck.cards) {
    const file = path.join(dir, card.slug + '.json');
    if (!fs.existsSync(file)) { errors.push(at(card.slug) + ': missing file'); continue; }
    let translated;
    try { translated = readJson(file); } catch (error) { errors.push(at(card.slug) + ': invalid JSON: ' + error.message); continue; }

    let cardOk = true;
    for (const field of FIELDS) {
      if (typeof translated[field] !== 'string' || !translated[field].trim()) {
        errors.push(at(card.slug + '.' + field) + ': missing or empty');
        cardOk = false;
      }
    }
    if (typeof translated.body !== 'string') continue;

    if (tagSig(card.body) !== tagSig(translated.body)) { errors.push(at(card.slug) + ': HTML tags/attributes changed'); cardOk = false; }
    if (digitSig(card.body) !== digitSig(translated.body)) { errors.push(at(card.slug) + ': numbers changed'); cardOk = false; }
    if (translated.body.includes('\uFFFD')) { errors.push(at(card.slug) + ': replacement character'); cardOk = false; }
    if (/<\/script/i.test(translated.body)) { errors.push(at(card.slug) + ': contains </script'); cardOk = false; }

    const ratio = translated.body.length / card.body.length;
    if (ratio < 0.55 || ratio > 2.2) warnings.push(at(card.slug) + ': body length ratio ' + ratio.toFixed(2));

    for (const tag of ['details', 'summary']) {
      const expected = (card.body.match(new RegExp('<' + tag + '\\b', 'g')) || []).length;
      const actual = (translated.body.match(new RegExp('<' + tag + '\\b', 'g')) || []).length;
      if (expected !== actual) { errors.push(at(card.slug) + ': <' + tag + '> count ' + actual + ', expected ' + expected); cardOk = false; }
    }

    if (['ar', 'ur', 'fa', 'ps'].includes(lang)) {
      const letters = (stripTags(translated.body).match(LETTER) || []).length;
      const arabic = letters ? (stripTags(translated.body).match(ARABIC) || []).length / letters : 0;
      if (arabic < 0.4) { errors.push(at(card.slug) + ': Arabic-script ratio only ' + arabic.toFixed(2)); cardOk = false; }
    }

    if (cardOk) complete++;
  }

  return { errors, warnings, cards: complete, total: deck.cards.length };
}

module.exports = { checkParts };

if (require.main === module) {
  const lang = process.argv[2];
  if (!lang) { console.error('Usage: node scripts/check-parts.js <lang>'); process.exit(1); }
  const { errors, warnings, cards, total } = checkParts(lang);
  for (const warning of warnings) console.warn('warning: ' + warning);
  for (const error of errors) console.error('error:   ' + error);
  if (errors.length) {
    console.error('\n' + lang + ': ' + errors.length + ' error(s), ' + warnings.length + ' warning(s)');
    process.exit(1);
  }
  console.log(lang + ': OK — ' + cards + '/' + total + ' cards, ui complete, ' + warnings.length + ' warning(s)');
}
