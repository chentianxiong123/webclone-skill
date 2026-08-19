#!/usr/bin/env node
/**
 * map-dom.js — Vision to DOM mapping via containment-ratio
 *
 * Maps bounding rect coordinates to DOM elements using containment-ratio
 * algorithm. Used for component boundary detection.
 *
 * Usage: node scripts/js/map-dom.js <URL> [-o file.json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'dom-map.json';

if (!url) {
  console.error('Usage: node map-dom.js <URL> [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const domMap = await page.evaluate(() => {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const elements = [];

  function walk(node, depth) {
    if (depth > 15) return;
    if (!node || node.nodeType !== 1) return;
    if (node.style.display === 'none') return;

    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    elements.push({
      tag: node.tagName.toLowerCase(),
      id: node.id || null,
      classes: node.className ? node.className.split(/\s+/).filter(Boolean) : [],
      text: (node.textContent || '').trim().slice(0, 50),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      area: rect.width * rect.height,
      depth,
    });

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  walk(document.body, 0);

  // Sort by area descending for containment analysis
  elements.sort((a, b) => b.area - a.area);

  // Compute containment ratios
  const containerMap = [];
  for (let i = 0; i < elements.length && i < 200; i++) {
    const parent = elements[i];
    const contained = [];
    for (let j = i + 1; j < elements.length && contained.length < 10; j++) {
      const child = elements[j];
      const overlapX = Math.max(0, Math.min(parent.rect.x + parent.rect.width, child.rect.x + child.rect.width) - Math.max(parent.rect.x, child.rect.x));
      const overlapY = Math.max(0, Math.min(parent.rect.y + parent.rect.height, child.rect.y + child.rect.height) - Math.max(parent.rect.y, child.rect.y));
      const childArea = child.rect.width * child.rect.height;
      if (childArea > 0) {
        const ratio = (overlapX * overlapY) / childArea;
        if (ratio > 0.8) contained.push({ tag: child.tag, ratio: ratio.toFixed(2) });
      }
    }
    containerMap.push({
      container: parent,
      contained,
      containmentScore: contained.length,
    });
  }

  return { viewport, elements, containerMap };
});

fs.writeFileSync(outputFile, JSON.stringify(domMap, null, 2));
console.log(`Mapped ${domMap.elements.length} elements, ${domMap.containerMap.filter(c => c.contained.length > 0).length} container relationships → ${outputFile}`);
await browser.close();
