#!/usr/bin/env node
/**
 * extract-visual-v2.js — Semantic + visual button fusion
 *
 * Combines DOM-based button detection with visual heuristics
 * (border, shadow, icon presence) to identify all clickable elements.
 *
 * Usage: node scripts/js/extract-visual-v2.js <URL> [-o file.json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'visual.json';

if (!url) {
  console.error('Usage: node extract-visual-v2.js <URL> [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const visual = await page.evaluate(() => {
  const elements = [...document.querySelectorAll('*')];
  const buttons = [];

  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) continue;
    if (el.offsetParent === null) continue;

    const hasBorder = cs.borderColor !== 'transparent' && cs.borderStyle !== 'none';
    const hasShadow = cs.boxShadow !== 'none';
    const hasBg = cs.backgroundColor !== 'transparent' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    const hasIcon = el.querySelector('svg, i[aria-hidden], img[alt*="icon"]');
    const isNativeButton = el.tagName === 'BUTTON' || el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button' || el.type === 'reset');
    const hasClickHandler = el.onclick || el.hasAttribute('onclick') || el.getAttribute('role') === 'button';

    const confidence = (isNativeButton ? 1.0 : 0) +
      (hasBorder ? 0.2 : 0) +
      (hasShadow ? 0.15 : 0) +
      (hasBg ? 0.15 : 0) +
      (hasIcon ? 0.2 : 0) +
      (hasClickHandler ? 0.3 : 0);

    if (confidence >= 0.3) {
      buttons.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: [...el.classList].join(' '),
        text: (el.textContent || '').trim().slice(0, 80),
        confidence: Math.min(confidence, 1.0).toFixed(2),
        visual: { hasBorder, hasShadow, hasBg, hasIcon },
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    }
  }

  return buttons;
});

fs.writeFileSync(outputFile, JSON.stringify(visual, null, 2));
console.log(`Found ${visual.length} visual buttons → ${outputFile}`);
await browser.close();
