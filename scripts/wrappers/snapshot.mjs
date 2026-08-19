#!/usr/bin/env node
// scripts/wrappers/snapshot.mjs
// Wrapper: Run web-clone snapshot engine
// Usage: node scripts/wrappers/snapshot.mjs <URL> [options]

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/wrappers/snapshot.mjs <URL> [-o output] [other-flags]');
  process.exit(1);
}

const child = spawn('pnpm', ['dev:cli', ...args], {
  cwd: dirname(__dirname),
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => process.exit(code));
