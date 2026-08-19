#!/usr/bin/env node
/**
 * extract-structure-v2.js — Multi-coordinate DOM structure extraction
 *
 * Extracts full DOM tree with bounding rect, text content, tag info,
 * and computed styles. Used as the foundation for component boundary detection.
 *
 * Usage: node scripts/js/extract-structure-v2.js <URL> [--max-depth N]
 */

import { chromium } from 'playwright';

const url = process.argv[2];
const maxDepth = parseInt(process.argv.find((a) => a.startsWith('--max-depth='))?.split('=')[1] || '5');
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'structure.json';

if (!url) {
  console.error('Usage: node extract-structure-v2.js <URL> [--max-depth N] [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const structure = await page.evaluate((maxDepth) => {
  const results = [];
  const visited = new Set();

  function walk(node, depth) {
    if (depth > maxDepth || !node || node.nodeType !== 1) return;
    if (visited.has(node)) return;
    visited.add(node);

    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && !node.children.length) return;

    const entry = {
      tag: node.tagName.toLowerCase(),
      id: node.id || null,
      classes: [...node.classList].join(' '),
      text: (node.textContent || '').trim().slice(0, 200),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      children: [],
      attrs: {},
    };

    for (const attr of node.attributes || []) {
      if (attr.name !== 'style') entry.attrs[attr.name] = attr.value;
    }

    for (const child of node.children) {
      entry.children.push(walk(child, depth + 1));
    }
    entry.children = entry.children.filter(Boolean);

    return entry;
  }

  return walk(document.body, 0);
}, maxDepth);

const fs = await import('node:fs');
fs.writeFileSync(outputFile, JSON.stringify(structure, null, 2));
console.log(`Extracted structure with ${countNodes(structure)} nodes → ${outputFile}`);

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, c) => sum + countNodes(c), 0);
}

await browser.close();
