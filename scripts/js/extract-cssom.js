#!/usr/bin/env node
/**
 * extract-cssom.js — Full CSSOM (CSS Object Model) extraction
 *
 * Walks all CSS rules from all stylesheets, extracts selectors, properties,
 * and computed values for every element.
 *
 * Usage: node scripts/js/extract-cssom.js <URL> [-o file.json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'cssom.json';

if (!url) {
  console.error('Usage: node extract-cssom.js <URL> [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const cssom = await page.evaluate(() => {
  const stylesheets = [];

  for (const sheet of document.styleSheets) {
    try {
      const rules = [];
      for (const rule of sheet.cssRules || []) {
        if (rule.type === CSSRule.STYLE_RULE) {
          rules.push({
            selector: rule.selectorText,
            properties: Array.from(rule.style).reduce((acc, p) => {
              acc[p] = rule.style.getPropertyValue(p);
              return acc;
            }, {}),
          });
        }
      }
      stylesheets.push({ href: sheet.href || '(inline)', rules });
    } catch (e) {
      stylesheets.push({ href: sheet.href || '(cross-origin)', error: e.message });
    }
  }

  // Computed styles for all elements
  const computed = [];
  const elements = document.querySelectorAll('*');
  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    const props = {};
    for (const prop of ['color', 'background-color', 'font-size', 'font-family',
      'font-weight', 'line-height', 'padding', 'margin', 'border', 'display',
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'border-radius', 'box-shadow', 'opacity', 'text-align', 'letter-spacing']) {
      props[prop] = cs.getPropertyValue(prop);
    }

    computed.push({
      selector: getSelector(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className ? el.className.split(/\s+/).filter(Boolean) : [],
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      props,
    });
  }

  return { stylesheets, computed };

  function getSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.className) return `${el.tagName.toLowerCase()}.${el.className.split(/\s+/)[0]}`;
    return el.tagName.toLowerCase();
  }
});

fs.writeFileSync(outputFile, JSON.stringify(cssom, null, 2));
console.log(`Extracted ${cssom.stylesheets.length} stylesheets, ${cssom.computed.length} computed styles → ${outputFile}`);
await browser.close();
