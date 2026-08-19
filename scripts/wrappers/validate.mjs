#!/usr/bin/env node
// scripts/wrappers/validate.mjs
// Wrapper: Validate a snapshot directory
// Usage: node scripts/wrappers/validate.mjs <OUTPUT_DIR>

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/wrappers/validate.mjs <OUTPUT_DIR> [--clean]');
  process.exit(1);
}

const child = spawn('pnpm', ['dev:cli', ...args, '--validate'], {
  cwd: dirname(__dirname),
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => process.exit(code));
