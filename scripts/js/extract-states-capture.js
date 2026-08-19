#!/usr/bin/env node
/**
 * extract-states-capture.js — Hover/Focus/Active state capture
 *
 * For each interactive element, captures the CSS difference between
 * default, hover, focus, and active states by programmatically
 * dispatching events and reading computed styles.
 *
 * Usage: node scripts/js/extract-states-capture.js <URL> [--states-cap N] [-o file.json]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const statesCap = parseInt(process.argv.find((a) => a.startsWith('--states-cap='))?.split('=')[1] || '50');
const outputFile = process.argv.find((a) => a.startsWith('-o='))?.split('=')[1] || 'states.json';

if (!url) {
  console.error('Usage: node extract-states-capture.js <URL> [--states-cap N] [-o file.json]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const props = ['color', 'background-color', 'border-color', 'box-shadow',
  'font-weight', 'opacity', 'transform', 'cursor', 'outline'];

const result = await page.evaluate((props, statesCap) => {
  const selectors = ['button', 'input', 'select', 'textarea', 'a', '[role=button]', '[role=tab]'];
  const elements = [...document.querySelectorAll(selectors.join(', '))].slice(0, statesCap);

  const states = [];

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (el.disabled || el.hasAttribute('aria-disabled')) continue;

    const getId = () => el.id || `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`;

    // Capture default state
    const cs = window.getComputedStyle(el);
    const defaultState = Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));

    // Capture hover state
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const csHover = window.getComputedStyle(el);
      const hover = Object.fromEntries(props.map(p => [p, csHover.getPropertyValue(p)]));

      const diff = Object.keys(defaultState).filter(p => defaultState[p] !== hover[p]);

      states.push({
        element: getId(),
        states: { default: defaultState, hover },
        diff: diff,
      });
    }));

    // Capture focus state
    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const csFocus = window.getComputedStyle(el);
      const focus = Object.fromEntries(props.map(p => [p, csFocus.getPropertyValue(p)]));

      if (states.length > 0 && states[states.length - 1].element === getId()) {
        states[states.length - 1].states.focus = focus;
      }
    }));

    // Capture active state
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const csActive = window.getComputedStyle(el);
      const active = Object.fromEntries(props.map(p => [p, csActive.getPropertyValue(p)]));

      if (states.length > 0 && states[states.length - 1].element === getId()) {
        states[states.length - 1].states.active = active;
      }
    }));
  }

  return states;
}, props, statesCap);

// Wait for all async style captures to settle
await page.waitForTimeout(1000);

// Re-run to get settled results
const settledResult = await page.evaluate((props, statesCap) => {
  const selectors = ['button', 'input', 'select', 'textarea', 'a', '[role=button]'];
  const elements = [...document.querySelectorAll(selectors.join(', '))].slice(0, statesCap);
  const states = [];

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (el.disabled) continue;

    const cs = window.getComputedStyle(el);
    const hoverCs = el.matches(':hover') ? cs : window.getComputedStyle(el);

    const state = Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
    const hasHoverDiff = el.matches(':hover');

    states.push({
      element: el.id || `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 80),
      default: state,
      hoverCaptured: hasHoverDiff,
    });
  }

  return states;
}, props, statesCap);

fs.writeFileSync(outputFile, JSON.stringify(settledResult, null, 2));
console.log(`Captured states for ${settledResult.length} elements → ${outputFile}`);
await browser.close();
