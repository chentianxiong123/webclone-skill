#!/usr/bin/env node
/**
 * extract-links.js — Extract all links with SPA detection
 *
 * Identifies all <a> tags, classifies them as SPA-routable or external,
 * and extracts href, text, target, and data attributes.
 *
 * Usage: node scripts/js/extract-links.js <URL> [-o file.json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'links.json';

if (!url) {
  console.error('Usage: node extract-links.js <URL> [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const links = await page.evaluate((baseUrl) => {
  const results = [];
  const baseOrigin = new URL(baseUrl).origin;

  for (const a of document.querySelectorAll('a')) {
    const href = a.getAttribute('href') || '';
    const resolved = href ? new URL(href, baseUrl).href : '';
    const isExternal = href.startsWith('http') && resolved.startsWith(baseOrigin) === false;
    const isAnchor = href.startsWith('#');
    const isMailto = href.startsWith('mailto:');
    const isTel = href.startsWith('tel:');
    const isJS = href.startsWith('javascript:');

    // SPA detection: look for data attributes and href patterns
    const isSPA = !isExternal && !isAnchor && !isMailto && !isTel && !isJS &&
      (a.hasAttribute('data-route') || a.hasAttribute('data-page') ||
       href.startsWith('/') || a.closest('[data-app]'));

    results.push({
      text: (a.textContent || '').trim().slice(0, 100),
      href: href,
      resolved: resolved,
      type: isExternal ? 'external' : isAnchor ? 'anchor' : isSPA ? 'spa' : 'regular',
      target: a.target || null,
      rel: a.rel || null,
      data: Object.fromEntries([...a.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value])),
    });
  }

  return results;
}, url);

fs.writeFileSync(outputFile, JSON.stringify(links, null, 2));
const spaCount = links.filter(l => l.type === 'spa').length;
console.log(`Extracted ${links.length} links (${spaCount} SPA-routable) → ${outputFile}`);
await browser.close();
