#!/usr/bin/env node
/**
 * extract-lazy-load.js — Trigger lazy-loaded content
 *
 * Scrolls through the page, triggers IntersectionObservers,
 * and waits for lazy-loaded images, iframes, and components.
 *
 * Usage: node scripts/js/extract-lazy-load.js <URL> [--scroll-steps N] [-o file.json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const scrollSteps = parseInt(process.argv.find((a) => a.startsWith('--scroll-steps='))?.split('=')[1] || '10');
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'lazy.json';

if (!url) {
  console.error('Usage: node extract-lazy-load.js <URL> [--scroll-steps N] [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1080 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const scrollResults = [];

for (let i = 0; i <= scrollSteps; i++) {
  const scrollY = (page.viewportSize().height * i);
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(500);

  const state = await page.evaluate(() => {
    const lazyImages = [...document.querySelectorAll('img[loading="lazy"]')];
    const loadedImages = lazyImages.filter(img => img.complete && img.naturalWidth > 0);
    const iframes = [...document.querySelectorAll('iframe')];
    const totalElements = document.querySelectorAll('*').length;
    const bodyHeight = document.body.scrollHeight;

    return {
      scrollY: window.scrollY,
      totalElements,
      bodyHeight,
      lazyImages: lazyImages.length,
      lazyImagesLoaded: loadedImages.length,
      iframes: iframes.length,
    };
  });

  scrollResults.push(state);
}

fs.writeFileSync(outputFile, JSON.stringify(scrollResults, null, 2));
console.log(`Scrolled ${scrollSteps} steps, max body height: ${scrollResults[scrollResults.length - 1]?.bodyHeight}px → ${outputFile}`);
await browser.close();
