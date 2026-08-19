#!/usr/bin/env node
/**
 * validate-extraction.js — Extraction sanity check
 *
 * Validates an extraction JSON file for completeness and correctness.
 * Reports missing fields, empty arrays, and structural issues.
 *
 * Usage: node scripts/js/validate-extraction.js <file.json>
 */

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-extraction.js <file.json>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
const errors = [];
const warnings = [];

function validateStructure(node, path = 'root') {
  if (!node) {
    errors.push(`${path}: null or undefined`);
    return;
  }

  if (node.tag && node.rect) {
    if (node.rect.width <= 0 || node.rect.height <= 0) {
      warnings.push(`${path}.${node.tag}: zero-size rect`);
    }
    if (!node.text && !node.children?.length) {
      warnings.push(`${path}.${node.tag}: no text and no children`);
    }
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      validateStructure(node.children[i], `${path}.children[${i}]`);
    }
  }

  if (node.stylesheets) {
    for (let i = 0; i < node.stylesheets.length; i++) {
      const s = node.stylesheets[i];
      if (s.error) warnings.push(`stylesheet[${i}]: ${s.error}`);
      if (!s.rules || s.rules.length === 0) warnings.push(`stylesheet[${i}]: no rules`);
    }
  }
}

validateStructure(data);

console.log(`\nValidation Report for ${file}`);
console.log(`  Errors:   ${errors.length}`);
console.log(`  Warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log('\n  ERRORS:');
  errors.forEach(e => console.log(`    ✗ ${e}`));
}

if (warnings.length > 0) {
  console.log('\n  WARNINGS:');
  warnings.forEach(w => console.log(`    ⚠ ${w}`));
}

if (errors.length === 0) {
  console.log('\n  ✓ Extraction PASSED\n');
} else {
  console.log(`\n  ✗ Extraction FAILED with ${errors.length} errors\n`);
  process.exit(1);
}
