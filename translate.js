#!/usr/bin/env node
/**
 * Optional machine-translation pipeline (Gemini API).
 *
 * The repository already ships with hand-checked translations for its six
 * languages. This script is for adding new languages later.
 *
 *   export GEMINI_API_KEY="..."
 *   node translate.js de ja ar        # only missing or changed cards
 *   node translate.js de --force      # retranslate everything for German
 *   node translate.js --list          # show what is current or stale
 *   node translate.js --rebuild       # rebuild translations/*.js without an API call
 */
'use strict';
const fs = require('fs');
const path = require('path');
const {
  FIELDS, loadDeck, readStore, cardHash, uiHash, tagSig, digitSig, buildTranslations
} = require('./scripts/i18n');

const DIR = __dirname;
const JSON_FILE = path.join(DIR, 'translations.json');
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const atomicWrite = (file, text) => {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, text, 'utf8');
  fs.renameSync(temporary, file);
};

function saveStore(store) {
  atomicWrite(JSON_FILE, JSON.stringify(store, null, 2) + '\n');
  buildTranslations();
}

async function callGemini(systemText, payload, env, fetchImpl) {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  });
  let lastError;
  let rateLimited = false;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body
      });
      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates && data.candidates[0];
        const parts = (candidate && candidate.content && candidate.content.parts) || [];
        const text = parts.map((part) => part.text || '').join('').trim();
        if (!text) throw new Error('Empty response (possibly blocked by a safety filter)');
        try {
          return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
        } catch (parseError) {
          throw new Error('Invalid JSON returned from model: ' + parseError.message);
        }
      }

      const errText = (await res.text()).slice(0, 400);
      if (res.status === 429) {
        rateLimited = true;
        const retryMatch = errText.match(/"retryDelay":\s*"(\d+)s"/) || errText.match(/retry after (\d+)/i);
        const wait = retryMatch ? (parseInt(retryMatch[1], 10) * 1000 + 1000) : (5000 * attempt);
        console.warn('\n   Rate limited. Waiting ' + (wait / 1000) + 's...');
        await sleep(wait);
        throw new Error('HTTP 429: Rate limited');
      }
      if (res.status === 503 || res.status === 502 || res.status === 504) {
        await sleep(5000 * attempt);
        throw new Error('HTTP ' + res.status + ': Server overloaded');
      }
      if (res.status === 404) throw Object.assign(new Error('HTTP 404: Model not found. ' + errText), { fatal: true });
      if (res.status === 400 || res.status === 401 || res.status === 403) throw Object.assign(new Error('HTTP ' + res.status + ': Check API key. ' + errText), { fatal: true });

      throw new Error('HTTP ' + res.status + ': ' + errText);
    } catch (error) {
      lastError = error;
      if (error.fatal || attempt === 5) break;
      if (rateLimited) rateLimited = false;
      else if (!/Server overloaded/.test(error.message)) await sleep(5000 * attempt);
    }
  }
  throw lastError;
}

const SYSTEM = (lang) => `You are an expert academic translator. Translate the values of the JSON object you receive into the language with code "${lang}".
Rules:
1. Return ONLY a JSON object with exactly the same keys. No markdown, no commentary.
2. Preserve every HTML tag, attribute, class name, href, and the order of tags exactly. Translate only the text between tags.
3. Preserve placeholders such as {n} and {total} exactly as they are.
4. Keep the names of people and works as in the source unless the target language has a standard localized form. Keep numbers, years, and Bible references; render Bible book names in the conventional form of the target language.
5. Use the target language's standard quotation marks and punctuation. Use the target language's conventional dash style.
6. Keep the register academic, neutral, and precise. Do not add, remove, soften, or strengthen any claim.
7. Translate "Evidence Deck" as a natural equivalent in this context (a curated dossier of evidence), not literally word for word.
8. Keep section labels consistent across cards: use the same translation for the same English summary label everywhere.`;

async function translateObject(lang, obj, fields, check, env, fetchImpl) {
  const payload = {};
  for (const field of fields) payload[field] = obj[field];
  let lastProblem = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    let systemPrompt = SYSTEM(lang);
    if (lastProblem) systemPrompt += '\n\nYour previous output was rejected: ' + lastProblem + '. Fix this.';
    try {
      const out = await callGemini(systemPrompt, payload, env, fetchImpl);
      const problem = fields.map((field) => (
        typeof out[field] === 'string' && out[field].trim() ? '' : 'missing "' + field + '"'
      )).find(Boolean) || check(payload, out);
      if (!problem) {
        const clean = {};
        for (const field of fields) clean[field] = out[field];
        return clean;
      }
      lastProblem = problem;
    } catch (error) {
      lastProblem = error.message;
      await sleep(3000);
    }
  }
  throw new Error('Validation failed after 3 tries: ' + lastProblem);
}

const checkCard = (src, out) => {
  if (tagSig(src.body) !== tagSig(out.body)) return 'HTML tags/attributes in body changed';
  if (digitSig(src.body) !== digitSig(out.body)) return 'Numbers in body changed';
  if (out.body.length < src.body.length * 0.5 || out.body.length > src.body.length * 2.5) return 'Body length is anomalous';
  for (const field of ['kicker', 'title', 'claim']) {
    if (/<[a-z]/i.test(out[field]) && !/<[a-z]/i.test(src[field])) return 'tags appeared in ' + field;
  }
  return '';
};

const checkUi = (src, out) => {
  for (const key of Object.keys(src)) {
    if (tagSig(src[key]) !== tagSig(out[key])) return 'HTML tags changed in ui.' + key;
    if (key === 'cardOf' && (!out[key].includes('{n}') || !out[key].includes('{total}'))) return 'placeholders changed in ui.cardOf';
  }
  return '';
};

async function run(argv, env = process.env, fetchImpl = globalThis.fetch) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const langCodes = argv.filter((arg) => !arg.startsWith('--'));
  const deck = loadDeck();
  const store = readStore();
  const uiFields = Object.keys(deck.ui);

  if (flags.has('--rebuild')) { saveStore(store); console.log('Rebuilt translations.js and translations/ from translations.json'); return; }

  if (flags.has('--list')) {
    for (const lang of Object.keys(store).sort()) {
      const stale = deck.cards.filter((card) => {
        const have = store[lang].cards && store[lang].cards[card.slug];
        return !have || have._src !== cardHash(card);
      }).length;
      const uiStale = !store[lang].ui || store[lang].uiSrc !== uiHash(deck.ui);
      console.log(lang + ': ' + (deck.cards.length - stale) + '/' + deck.cards.length + ' cards current'
        + (stale ? ', ' + stale + ' stale or missing' : '') + (uiStale ? ', ui stale' : ''));
    }
    return;
  }

  if (!langCodes.length) {
    console.error('Usage: GEMINI_API_KEY=... node translate.js <lang> [<lang> ...] [--force]\n       node translate.js --rebuild | --list');
    process.exitCode = 1;
    return;
  }
  if (!env.GEMINI_API_KEY) {
    console.error('Set GEMINI_API_KEY in your environment first. Do not paste keys into source files.');
    process.exitCode = 1;
    return;
  }

  for (const lang of langCodes) {
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(lang)) {
      console.error('Skipping "' + lang + '": not a language code like es or zh-CN');
      continue;
    }
    store[lang] = store[lang] || { ui: null, cards: {} };
    store[lang].cards = store[lang].cards || {};
    console.log('\n== ' + lang + ' ==');
    try {
      if (flags.has('--force') || !store[lang].ui || store[lang].uiSrc !== uiHash(deck.ui)) {
        process.stdout.write('  ui ... ');
        store[lang].ui = await translateObject(lang, deck.ui, uiFields, checkUi, env, fetchImpl);
        store[lang].uiSrc = uiHash(deck.ui);
        saveStore(store);
        console.log('ok');
      }
      for (const card of deck.cards) {
        const have = store[lang].cards[card.slug];
        if (!flags.has('--force') && have && have._src === cardHash(card)) {
          console.log('  ' + card.slug + ' ... up to date');
          continue;
        }
        process.stdout.write('  ' + card.slug + ' ... ');
        const translated = await translateObject(lang, card, FIELDS, checkCard, env, fetchImpl);
        store[lang].cards[card.slug] = Object.assign({}, translated, { _src: cardHash(card) });
        saveStore(store);
        console.log('ok');
        await sleep(3000);
      }
    } catch (error) {
      console.error('\n  FAILED for ' + lang + ': ' + error.message);
      process.exitCode = 1;
      if (/HTTP (400|401|403|404)/.test(error.message)) break;
    }
  }
  saveStore(store);
}

module.exports = { run, tagSig, cardHash, loadDeck };
if (require.main === module) run(process.argv.slice(2)).catch((error) => { console.error(error); process.exit(1); });
