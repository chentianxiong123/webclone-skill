#!/usr/bin/env node
// scripts/wrappers/query.mjs
// Wrapper: Run web-clone query subcommand
// Usage: node scripts/wrappers/query.mjs <URL> <selector> [options]

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/wrappers/query.mjs <URL> <selector> [--row | --table | --json | --count]');
  process.exit(1);
}

const child = spawn('pnpm', ['dev:cli', 'query', ...args], {
  cwd: dirname(__dirname),
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => process.exit(code));
