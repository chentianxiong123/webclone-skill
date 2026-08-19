#!/usr/bin/env node
/**
 * extract-shadow.js — Shadow DOM traversal and extraction
 *
 * Walks all shadow roots, extracting shadow DOM content, host elements,
 * and distributed light DOM nodes.
 *
 * Usage: node scripts/js/extract-shadow.js <URL> [-o file.json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'shadow.json';

if (!url) {
  console.error('Usage: node extract-shadow.js <URL> [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const shadows = await page.evaluate(() => {
  const results = [];

  function walkShadows(root, depth) {
    if (depth > 10) return;
    const hosts = root.querySelectorAll('*');
    for (const el of hosts) {
      if (el.shadowRoot) {
        const hostRect = el.getBoundingClientRect();
        const shadowEl = el.shadowRoot.querySelector('*') || el.shadowRoot;
        const shadowRect = shadowEl.getBoundingClientRect();

        results.push({
          host: { tag: el.tagName.toLowerCase(), id: el.id || null, classes: [...el.classList].join(' ') },
          hostRect: { x: hostRect.x, y: hostRect.y, width: hostRect.width, height: hostRect.height },
          depth,
          content: el.shadowRoot.innerHTML.slice(0, 2000),
          children: walkShadows(el.shadowRoot, depth + 1),
        });
        walkShadows(el.shadowRoot, depth + 1);
      }
    }
    return results.filter(Boolean);
  }

  walkShadows(document, 0);
  return results;
});

fs.writeFileSync(outputFile, JSON.stringify(shadows, null, 2));
console.log(`Found ${shadows.length} shadow DOM instances → ${outputFile}`);
await browser.close();
