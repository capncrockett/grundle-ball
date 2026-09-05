import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runChecks, verificationPlan } from './verify.mjs';

const scriptDirectory = fileURLToPath(new URL('./', import.meta.url));
const fixtures = [];

function fixtureRepository() {
  const root = mkdtempSync(path.join(tmpdir(), 'grundle-tooling-'));
  fixtures.push(root);
  mkdirSync(path.join(root, 'scripts'));
  for (const file of ['check-docs.mjs', 'check-repo.mjs', 'repository-files.mjs', 'doctor.mjs']) {
    copyFileSync(path.join(scriptDirectory, file), path.join(root, 'scripts', file));
  }
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      version: '2.4.1',
      engines: { node: '24.x' },
    }),
  );
  writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify({
      name: 'fixture',
      version: '2.4.1',
      packages: { '': { name: 'fixture', version: '2.4.1' } },
    }),
  );
  return root;
}

function run(root, script, args = []) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const root of fixtures.splice(0)) {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('grundle-tooling-'));
    rmSync(root, { recursive: true, force: true });
  }
});

test('documentation checks find broken links in unstaged new files', () => {
  const root = fixtureRepository();
  writeFileSync(path.join(root, 'new-guide.md'), '# New guide\n[Missing](missing.md)\n');
  const result = run(root, 'check-docs.mjs');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /new-guide\.md:2: missing internal target missing\.md/);
});

test('documentation checks handle deleted tracked files and ignore generated artifacts', () => {
  const root = fixtureRepository();
  writeFileSync(path.join(root, 'deleted.md'), '# Old guide');
  execFileSync('git', ['add', 'deleted.md'], { cwd: root });
  rmSync(path.join(root, 'deleted.md'));
  writeFileSync(path.join(root, '.gitignore'), 'generated/\n');
  mkdirSync(path.join(root, 'generated'));
  writeFileSync(path.join(root, 'generated/broken.md'), '[Ignore](missing.md)');
  writeFileSync(path.join(root, 'guide.md'), '# Guide\n## Safe section\n');
  writeFileSync(path.join(root, 'new.md'), '[Valid](guide.md#safe-section)\n');
  const result = run(root, 'check-docs.mjs');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 files, 1 internal links/);
});

test('documentation checks report malformed links without crashing', () => {
  const root = fixtureRepository();
  writeFileSync(path.join(root, 'bad.md'), '[Malformed](%not-a-path.md)\n[Missing](other.md)');
  const result = run(root, 'check-docs.mjs');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid URL encoding/);
  assert.match(result.stderr, /missing internal target other\.md/);
});

test('repository checks accept a consistent package and lockfile', () => {
  const result = run(fixtureRepository(), 'check-repo.mjs');
  assert.equal(result.status, 0, result.stderr);
});

test('repository checks detect lockfile drift and prohibited punctuation in new source', () => {
  const root = fixtureRepository();
  writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify({
      name: 'fixture',
      version: '2.4.1',
      packages: { '': { name: 'fixture', version: '2.4.0' } },
    }),
  );
  writeFileSync(path.join(root, 'new.ts'), `// invalid ${String.fromCharCode(0x2014)} dash\n`);
  const result = run(root, 'check-repo.mjs');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /both root versions must match/);
  assert.match(result.stderr, /new\.ts:1: use ASCII/);
});

test('verification stops after a failed command and does not report a pass', () => {
  const executed = [];
  const messages = [];
  const status = runChecks(
    [
      ['First', ['first']],
      ['Failing', ['fail']],
      ['Never run', ['last']],
    ],
    (args) => {
      executed.push(args[0]);
      return { status: args[0] === 'fail' ? 2 : 0 };
    },
    (message) => messages.push(message),
  );
  assert.equal(status, 1);
  assert.deepEqual(executed, ['first', 'fail']);
  assert.ok(messages.some((message) => message.includes('FAILED: Failing')));
  assert.ok(messages.every((message) => !message.includes('PASS:')));
});

test('verification treats a terminated subprocess as a failure', () => {
  assert.equal(
    runChecks(
      [['Stopped', []]],
      () => ({ status: null, signal: 'SIGTERM' }),
      () => {},
    ),
    1,
  );
});

test('verification rejects misspelled or contradictory options', () => {
  assert.throws(() => verificationPlan(['--quik']), /Unknown option/);
  assert.throws(() => verificationPlan(['--quick', '--e2e']), /cannot be combined/);
});

test('doctor reports missing dependencies as structured failures', () => {
  const root = fixtureRepository();
  const result = run(root, 'doctor.mjs', ['--json']);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((check) => check.name === 'vite' && check.status === 'fail'));
  assert.ok(report.checks.some((check) => check.detail.includes('npm ci')));
});
