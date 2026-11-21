import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { acquireVerification, OWNER_ENV } from './verification-lock.mjs';
import { runCommand } from './run-command.mjs';

const roots = [];
const children = new Set();
const scripts = fileURLToPath(new URL('./', import.meta.url));

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'grundle-lock-'));
  roots.push(root);
  mkdirSync(path.join(root, 'scripts'));
  mkdirSync(path.join(root, 'frontend'));
  for (const name of [
    'verification-lock.mjs',
    'run-command.mjs',
    'verify.mjs',
    'browser-tests.mjs',
  ]) {
    copyFileSync(path.join(scripts, name), path.join(root, 'scripts', name));
  }
  writeFileSync(path.join(root, 'frontend/package.json'), '{}');
  return root;
}

function start(root, source, args = []) {
  const filename = path.join(root, `worker-${children.size}.mjs`);
  writeFileSync(filename, source);
  const child = fork(filename, args, { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
}

afterEach(async () => {
  await Promise.all([...children].map(stop));
  for (const root of roots.splice(0)) {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('grundle-lock-'));
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects independent verification and browser commands before executing anything', () => {
  const root = fixture();
  const lease = acquireVerification(root, 'existing run');
  const env = { ...process.env, npm_execpath: 'must-not-execute' };
  delete env[OWNER_ENV];
  try {
    for (const [script, args] of [
      ['verify.mjs', ['--quick']],
      ['browser-tests.mjs', ['local']],
      ['browser-tests.mjs', ['deployment', '--headed']],
    ]) {
      const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
        env,
        encoding: 'utf8',
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Verification already running: existing run.*PID/);
      assert.doesNotMatch(result.stdout, /Repository invariants|vite|playwright/);
    }
    const list = spawnSync(process.execPath, [path.join(root, 'scripts/verify.mjs'), '--list'], {
      env,
      encoding: 'utf8',
    });
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stdout, /Repository invariants/);
  } finally {
    lease.release();
  }
  assert.equal(existsSync(path.join(root, '.verification-lock')), false);
});

test('allows inherited browser ownership without letting a nested run remove the parent lock', () => {
  const root = fixture();
  const owner = acquireVerification(root, 'parent');
  try {
    assert.throws(
      () => acquireVerification(root, 'unrelated', { [OWNER_ENV]: 'wrong' }),
      /already running/,
    );
    const nested = acquireVerification(root, 'browser', owner.env);
    nested.release();
    assert.throws(() => acquireVerification(root, 'still blocked', {}), /already running/);
  } finally {
    owner.release();
  }
  const next = acquireVerification(root, 'next');
  next.release();
});

test('two real concurrent contenders cannot both acquire ownership', async () => {
  const root = fixture();
  const source = `
    import { acquireVerification } from './scripts/verification-lock.mjs';
    try {
      const lease = acquireVerification(${JSON.stringify(root)}, 'contender', {});
      process.on('message', () => { lease.release(); process.exit(0); });
      process.send('acquired');
    } catch (error) { process.send(error.message); process.disconnect(); }
  `;
  const first = start(root, source);
  const second = start(root, source);
  const results = await Promise.all([once(first, 'message'), once(second, 'message')]);
  assert.equal(results.filter(([message]) => message === 'acquired').length, 1);
  assert.match(
    results.find(([message]) => message !== 'acquired')[0],
    /already running|initializing/,
  );
  const winner = results[0][0] === 'acquired' ? first : second;
  const exited = once(winner, 'exit');
  winner.send('finish');
  await exited;
});

test('preserves an orphaned live child and recovers only after all recorded processes stop', async () => {
  const root = fixture();
  const holder = start(root, "process.send('ready'); setInterval(() => {}, 1000);");
  await once(holder, 'message');
  const owner = start(
    root,
    `
    import { acquireVerification } from './scripts/verification-lock.mjs';
    const lease = acquireVerification(${JSON.stringify(root)}, 'interrupted parent', {});
    lease.register(${holder.pid}, 'still running browser');
    process.send('ready'); setInterval(() => {}, 1000);
  `,
  );
  await once(owner, 'message');
  await stop(owner);
  assert.throws(() => acquireVerification(root, 'too soon', {}), /still running browser/);
  await stop(holder);
  const recovered = acquireVerification(root, 'recovered', {});
  recovered.release();
  assert.equal(existsSync(path.join(root, '.verification-lock')), false);
});

test('does not guess that malformed ownership or child records are stale', () => {
  const root = fixture();
  const directory = path.join(root, '.verification-lock');
  mkdirSync(directory);
  writeFileSync(path.join(directory, 'owner.json'), 'broken');
  assert.throws(() => acquireVerification(root, 'blocked'), /unreadable/);
  assert.equal(readFileSync(path.join(directory, 'owner.json'), 'utf8'), 'broken');
  writeFileSync(
    path.join(directory, 'owner.json'),
    JSON.stringify({ token: 'valid', pid: process.pid }),
  );
  writeFileSync(path.join(directory, 'child.json'), 'broken child');
  assert.throws(() => acquireVerification(root, 'blocked'), SyntaxError);
  assert.equal(readFileSync(path.join(directory, 'child.json'), 'utf8'), 'broken child');
});

test('retains ownership when command-tree shutdown cannot be verified', () => {
  const root = fixture();
  const lease = acquireVerification(root, 'uncertain shutdown');
  lease.retain('inspect command tree');
  assert.throws(() => lease.release(), /inspect command tree/);
  assert.throws(() => acquireVerification(root, 'blocked', {}), /inspect command tree/);
  assert.equal(existsSync(path.join(root, '.verification-lock')), true);
});

test('tracks failing child commands, returns nonzero, and permits the next run after cleanup', async () => {
  const root = fixture();
  const lease = acquireVerification(root, 'failing run');
  const result = await runCommand(process.execPath, ['-e', 'process.exit(7)'], {
    cwd: root,
    lease,
  });
  assert.equal(result.status, 7);
  lease.release();
  const next = acquireVerification(root, 'next run');
  next.release();
});

test('an interrupted command exits nonzero and releases ownership only after its child stops', async () => {
  const root = fixture();
  const worker = start(
    root,
    `
    import { acquireVerification } from './scripts/verification-lock.mjs';
    import { runCommand } from './scripts/run-command.mjs';
    const lease = acquireVerification(${JSON.stringify(root)}, 'interruptible run', {});
    const command = runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: ${JSON.stringify(root)}, lease });
    process.on('message', () => process.emit('SIGTERM'));
    process.send('ready');
    const result = await command;
    lease.release();
    process.exit(result.status === 0 ? 0 : 1);
  `,
  );
  await once(worker, 'message');
  const exited = once(worker, 'exit');
  // Windows ChildProcess.kill forcibly terminates rather than delivering a
  // catchable signal. Exercise the same handler through IPC on Windows.
  if (process.platform === 'win32') worker.send('interrupt');
  else worker.kill('SIGTERM');
  const [code] = await exited;
  assert.equal(code, 1);
  assert.equal(existsSync(path.join(root, '.verification-lock')), false);
});
