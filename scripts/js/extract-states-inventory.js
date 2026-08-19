#!/usr/bin/env node
/**
 * extract-states-inventory.js — Interactive elements inventory
 *
 * Finds all interactive elements: buttons, links, inputs, checkboxes,
 * radio buttons, selects, and elements with event listeners.
 *
 * Usage: node scripts/js/extract-states-inventory.js <URL> [-o file.json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'states-inventory.json';

if (!url) {
  console.error('Usage: node extract-states-inventory.js <URL> [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const states = await page.evaluate(() => {
  const results = [];
  const selectors = ['button', 'input', 'select', 'textarea', 'a', '[role=button]', '[role=tab]', '[role=option]', '[onclick]', '[data-clickable]'];

  const elements = new Set(document.querySelectorAll(selectors.join(', ')));

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (el.offsetParent === null && el.closest('[style*="display: none"]')) continue;

    const cs = window.getComputedStyle(el);
    const isDisabled = el.disabled || el.hasAttribute('aria-disabled');

    results.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className ? el.className.split(/\s+/).filter(Boolean) : [],
      role: el.getAttribute('role') || null,
      text: (el.textContent || '').trim().slice(0, 100),
      value: el.value || null,
      type: el.type || null,
      disabled: isDisabled,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      cs: {
        cursor: cs.cursor,
        pointerEvents: cs.pointerEvents,
        userSelect: cs.userSelect,
      },
      listeners: {},
    });
  }

  return results;
});

fs.writeFileSync(outputFile, JSON.stringify(states, null, 2));
console.log(`Extracted ${states.length} interactive elements → ${outputFile}`);
await browser.close();
