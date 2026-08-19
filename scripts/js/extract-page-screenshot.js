#!/usr/bin/env node
/**
 * extract-page-screenshot.js — Full-page screenshot metadata
 *
 * Captures full-page screenshots and metadata for each page.
 * Used for pixel-diff verification baseline.
 *
 * Usage: node scripts/js/extract-page-screenshot.js <URL> [-o path.png]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'screenshot.png';

if (!url) {
  console.error('Usage: node extract-page-screenshot.js <URL> [-o path.png]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

await page.screenshot({ path: outputFile, fullPage: true });

const meta = {
  url,
  viewport: { width: 1440, height: 900 },
  title: await page.title(),
  bodyHeight: await page.evaluate(() => document.body.scrollHeight),
  bodyWidth: await page.evaluate(() => document.body.scrollWidth),
  timestamp: new Date().toISOString(),
};

fs.writeFileSync(outputFile.replace('.png', '-meta.json'), JSON.stringify(meta, null, 2));
console.log(`Screenshot saved → ${outputFile} (${meta.bodyWidth}x${meta.bodyHeight}px)`);
await browser.close();
