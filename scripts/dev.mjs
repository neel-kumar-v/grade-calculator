#!/usr/bin/env node

/**
 * Universal Dev Server Runner with Smart Fallback & First-Run Setup
 *
 * 1. App Setup for other users / new clones:
 *    - Automatically initializes `.env.local` from `.env.example` if missing.
 *    - Can also be run directly as `pnpm setup` or `node scripts/dev.mjs --setup-only`.
 *
 * 2. Smart xport Fallback:
 *    - If `xport` CLI is installed: delegates to `xport run <command>`
 *      providing isolated loopbacks, port collision prevention, and URL banners.
 *    - If `xport` is NOT installed (other team members, open-source contributors, CI):
 *      gracefully runs standard dev server with zero errors or friction.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function ensureLocalEnv() {
  const envLocal = path.join(projectRoot, '.env.local');
  const envExample = path.join(projectRoot, '.env.example');

  if (!fs.existsSync(envLocal) && fs.existsSync(envExample)) {
    try {
      fs.copyFileSync(envExample, envLocal);
      console.log('\x1b[32m✔ [setup] Initialized .env.local from .env.example\x1b[0m');
      return true;
    } catch (err) {
      console.warn('⚠ [setup] Could not create .env.local:', err.message);
    }
  }
  return false;
}

// Run first-run setup
ensureLocalEnv();

if (process.argv.includes('--setup-only')) {
  process.exit(0);
}

// Filter out --setup-only if mixed with other args
const args = process.argv.slice(2).filter((arg) => arg !== '--setup-only');
const defaultCommand = args.length > 0 ? args : ['next', 'dev'];

function hasXportCli() {
  try {
    const res = spawnSync('xport', ['--version'], {
      stdio: 'ignore',
      shell: true,
      windowsHide: true,
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

const hasXport = hasXportCli();

// Prepend node_modules/.bin so commands like `next` always resolve cleanly
const localBin = path.join(projectRoot, 'node_modules', '.bin');
const rootBin = path.join(projectRoot, '..', '..', 'node_modules', '.bin');
const extraPaths = [localBin, rootBin].filter((p) => fs.existsSync(p));
const pathEnv = process.env.PATH || '';
const env = {
  ...process.env,
  PATH: extraPaths.length > 0 ? `${extraPaths.join(path.delimiter)}${path.delimiter}${pathEnv}` : pathEnv,
};

let bin;
let runArgs;

if (hasXport) {
  bin = 'xport';
  runArgs = ['run', ...defaultCommand];
} else {
  bin = defaultCommand[0];
  runArgs = defaultCommand.slice(1);
}

const child = spawn(bin, runArgs, {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
