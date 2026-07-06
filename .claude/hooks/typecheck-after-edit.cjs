#!/usr/bin/env node
// PostToolUse hook (Write|Edit|MultiEdit): surfaces TypeScript errors after an edit,
// adapted from the claude-code-typescript-hooks pattern (bartolli/claude-code-typescript-hooks)
// for this project's actual scale. That reference hook assumes a single-file check
// completes in single-digit milliseconds; on this codebase a full `tsc --noEmit`
// (needed for accurate cross-file/path-alias resolution — this project uses `@/*`
// paths and strict mode, so a truly single-file check would be inaccurate) measured
// ~24s even with `incremental: true` in tsconfig.json. Blocking every edit on that
// would make the harness unusable, so this hook never blocks: it reports the *previous*
// background run's results (if any, and if they're new) in well under a second, then
// kicks off the next check in the background for next time. Feedback lags by one edit
// cycle instead of being instant — a deliberate, honest tradeoff given the measured cost.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const RESULT_FILE = path.join(PROJECT_ROOT, '.claude', 'hooks', '.typecheck-last.json');
const LOCK_FILE = path.join(PROJECT_ROOT, '.claude', 'hooks', '.typecheck.lock');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function getEditedFile(payload) {
  try {
    const data = JSON.parse(payload);
    const input = data.tool_input || data;
    // MultiEdit uses file_path too; Write/Edit use file_path.
    return input.file_path || null;
  } catch {
    return null;
  }
}

function isTsFile(filePath) {
  return !!filePath && /\.(ts|tsx)$/.test(filePath) && !filePath.includes('node_modules');
}

function reportPreviousResult() {
  if (!fs.existsSync(RESULT_FILE)) return;
  let result;
  try {
    result = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
  } catch {
    return;
  }
  // Consume it either way so we never re-report the same run twice.
  fs.unlinkSync(RESULT_FILE);
  if (result.status !== 'done' || !result.errors || result.errors.length === 0) return;
  const lines = result.errors.slice(0, 25);
  process.stderr.write(
    `[typecheck-after-edit] Background \`tsc --noEmit\` (started ${result.startedAt}) found ${result.errors.length} error(s):\n` +
    lines.join('\n') +
    (result.errors.length > lines.length ? `\n... (${result.errors.length - lines.length} more)` : '') +
    '\n'
  );
  process.exitCode = 2; // surfaces as feedback; the edit already happened, this is advisory
}

function startBackgroundCheck() {
  if (fs.existsSync(LOCK_FILE)) return; // a check is already running, don't pile up
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  const startedAt = new Date().toISOString();
  const child = spawn('npx', ['tsc', '--noEmit'], {
    cwd: PROJECT_ROOT,
    shell: true,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d.toString(); });
  child.stderr.on('data', (d) => { output += d.toString(); });
  child.on('close', () => {
    const errors = output.split('\n').filter((l) => /error TS\d+:/.test(l));
    try {
      fs.writeFileSync(RESULT_FILE, JSON.stringify({ status: 'done', startedAt, errors }, null, 2));
    } catch { /* best-effort */ }
    try { fs.unlinkSync(LOCK_FILE); } catch { /* best-effort */ }
  });
  child.unref();
}

const payload = readStdin();
const editedFile = getEditedFile(payload);

// Always report whatever the last background run found (even if this edit wasn't
// a .ts/.tsx file) — it's still relevant feedback the user hasn't seen yet.
reportPreviousResult();

if (isTsFile(editedFile)) {
  startBackgroundCheck();
}
