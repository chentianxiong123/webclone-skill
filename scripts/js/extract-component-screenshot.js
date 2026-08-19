#!/usr/bin/env node
/**
 * extract-component-screenshot.js — Component crop coordinates
 *
 * Identifies component boundaries and exports screenshot crop coordinates
 * for each component.
 *
 * Usage: node scripts/js/extract-component-screenshot.js <URL> [-o json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'component-crops.json';

if (!url) {
  console.error('Usage: node extract-component-screenshot.js <URL> [-o path.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const crops = await page.evaluate(() => {
  const candidates = document.querySelectorAll('header, nav, main, footer, aside, section, article, div[class*="card"], div[class*="component"], div[class*="widget"], div[class*="modal"], dialog, aside');
  const results = [];

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) continue;

    results.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: [...el.classList].join(' '),
      text: (el.textContent || '').trim().slice(0, 80),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  }

  return results;
});

fs.writeFileSync(outputFile, JSON.stringify(crops, null, 2));
console.log(`Identified ${crops.length} component crop regions → ${outputFile}`);
await browser.close();
