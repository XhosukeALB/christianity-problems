#!/usr/bin/env node
/* Visual and behavioural smoke test for the deck (Puppeteer + headless Chrome). */
'use strict';
const path = require('path');
const fs = require('fs');
const puppeteer = require('../.work/browser/node_modules/puppeteer');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.work/shots');
const CHROME = path.join(ROOT, '.work/chrome/chrome-headless-shell-linux64/chrome-headless-shell');
const URL = process.env.TEST_URL || 'http://127.0.0.1:8099/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none', '--lang=en-US']
  });
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push('console: ' + message.text()); });
  page.on('requestfailed', (request) => problems.push('requestfailed: ' + request.url() + ' ' + (request.failure() || {}).errorText));

  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#track .slide', { timeout: 8000 });

  const home = await page.evaluate(() => ({
    slides: document.querySelectorAll('.slide').length,
    bootHidden: document.getElementById('boot').hidden,
    here: document.getElementById('hereTitle').textContent,
    meta: document.getElementById('hereMeta').textContent,
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    detailsOpen: document.querySelectorAll('details[open]').length,
    progress: getComputedStyle(document.getElementById('progress')).transform
  }));
  console.log('home:', JSON.stringify(home));
  await page.screenshot({ path: path.join(OUT, 'home-1280.png') });

  await page.keyboard.press('ArrowRight');
  await new Promise((resolve) => setTimeout(resolve, 700));
  const afterNext = await page.evaluate(() => ({
    here: document.getElementById('hereTitle').textContent,
    hash: location.hash,
    visible: Array.from(document.querySelectorAll('.slide')).findIndex((slide) => slide.getAttribute('aria-hidden') === 'false')
  }));
  console.log('after ArrowRight:', JSON.stringify(afterNext));
  await page.screenshot({ path: path.join(OUT, 'evil-1280.png') });

  await page.keyboard.press('c');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const index = await page.evaluate(() => ({
    open: !document.getElementById('indexOverlay').hidden,
    items: document.querySelectorAll('#indexList .ix-item').length,
    active: document.activeElement && document.activeElement.id
  }));
  console.log('index overlay:', JSON.stringify(index));
  await page.keyboard.press('Escape');
  await new Promise((resolve) => setTimeout(resolve, 150));

  await page.keyboard.press('/');
  await new Promise((resolve) => setTimeout(resolve, 250));
  await page.keyboard.type('Quirinius');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const search = await page.evaluate(() => ({
    open: !document.getElementById('searchOverlay').hidden,
    results: document.querySelectorAll('#searchResults .search-result').length,
    first: (document.querySelector('#searchResults .search-result b') || {}).textContent || ''
  }));
  console.log('search:', JSON.stringify(search));
  await page.screenshot({ path: path.join(OUT, 'search-1280.png') });
  await page.keyboard.press('Escape');

  await page.goto(URL + '#resurrection-contradictions', { waitUntil: 'networkidle0' });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const card = await page.evaluate(() => ({
    here: document.getElementById('hereTitle').textContent,
    hash: location.hash,
    tables: document.querySelectorAll('.slide[aria-hidden="false"] table.compare').length,
    rows: document.querySelectorAll('.slide[aria-hidden="false"] table.compare tbody tr').length
  }));
  console.log('resurrection card:', JSON.stringify(card));
  await page.screenshot({ path: path.join(OUT, 'resurrection-1280.png') });

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await page.screenshot({ path: path.join(OUT, 'home-390.png') });
  await page.evaluate(() => document.getElementById('nextBtn').click());
  await new Promise((resolve) => setTimeout(resolve, 700));
  await page.screenshot({ path: path.join(OUT, 'evil-390.png') });

  await page.emulateMediaType('print');
  await page.pdf({ path: path.join(OUT, 'deck.pdf'), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
  console.log('pdf pages: written');

  const detailsInPrint = await page.evaluate(() => {
    const state = [];
    document.querySelectorAll('details').forEach((details) => state.push(details.open));
    return { openCount: state.filter(Boolean).length, total: state.length };
  });
  console.log('details after print media:', JSON.stringify(detailsInPrint));

  console.log('problems:', problems.length ? JSON.stringify(problems, null, 2) : 'none');
  await browser.close();
  if (problems.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
