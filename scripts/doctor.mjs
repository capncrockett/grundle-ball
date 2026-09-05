import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--json')) {
  console.error('Usage: npm run doctor -- [--json]');
  process.exit(1);
}

const checks = [];
const report = (name, status, detail) => checks.push({ name, status, detail });
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const requiredMajor = manifest.engines.node.split('.')[0];
report(
  'Node',
  process.versions.node.split('.')[0] === requiredMajor ? 'ok' : 'fail',
  `Running ${process.versions.node}; repository requires ${manifest.engines.node}.`,
);

try {
  const branch = execFileSync('git', ['branch', '--show-current'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const status = execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  report(
    'Git',
    'ok',
    `${branch || 'detached HEAD'}; ${status ? 'uncommitted work present' : 'working tree clean'}.`,
  );
  if (branch.startsWith('release/')) {
    report(
      'Release version',
      branch === `release/${manifest.version}` ? 'ok' : 'fail',
      `Branch ${branch}; root version ${manifest.version}.`,
    );
  }
  const hookPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  report(
    'Commit hooks',
    hookPath === '.husky/_' ? 'ok' : 'warn',
    hookPath === '.husky/_'
      ? 'Husky is configured.'
      : 'Check core.hooksPath before a requested commit; npm run prepare installs project hooks.',
  );
} catch {
  report(
    'Git / hooks',
    'warn',
    'Git metadata or hooks are unavailable; verify the checkout before release actions.',
  );
}

const frontendRequire = createRequire(path.join(root, 'frontend/package.json'));
const backendRequire = createRequire(path.join(root, 'backend/package.json'));
for (const name of ['vite', 'typescript', 'eslint', 'jest', '@playwright/test']) {
  try {
    const installed = JSON.parse(
      readFileSync(frontendRequire.resolve(`${name}/package.json`), 'utf8'),
    );
    report(name, 'ok', `Installed ${installed.version}.`);
  } catch {
    report(name, 'fail', 'Missing dependency. Run npm ci from the repository root.');
  }
}

try {
  const Database = backendRequire('better-sqlite3');
  const database = new Database(':memory:');
  database.close();
  report(
    'SQLite test adapter',
    'ok',
    'Native module loads with this Node version; no disk database opened.',
  );
} catch {
  report(
    'SQLite test adapter',
    'fail',
    'Native module unavailable. Select the required Node version, then run npm ci.',
  );
}

try {
  // Match the existing test scripts in this diagnostic process only.
  process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
  const { chromium, webkit } = frontendRequire('playwright');
  const missing = [chromium, webkit].filter((browser) => !existsSync(browser.executablePath()));
  report(
    'Browser binaries',
    missing.length ? 'warn' : 'ok',
    missing.length
      ? `Missing ${missing.map((browser) => browser.name()).join(', ')}. Run npm exec -w frontend -- cross-env PLAYWRIGHT_BROWSERS_PATH=0 playwright install chromium webkit.`
      : 'Chromium and WebKit binaries found. Browser tests verify OS dependencies and runtime access.',
  );
} catch {
  report(
    'Browser binaries',
    'warn',
    'Install dependencies before checking optional browser-test prerequisites.',
  );
}

const ok = checks.every((check) => check.status !== 'fail');
if (args.includes('--json')) {
  console.log(JSON.stringify({ ok, checks }, null, 2));
} else {
  for (const check of checks)
    console.log(`${check.status.toUpperCase()} ${check.name}: ${check.detail}`);
  console.log(
    '\nRead-only diagnostic. No dependencies installed, Git state changed, or external services contacted.',
  );
}
process.exitCode = ok ? 0 : 1;
