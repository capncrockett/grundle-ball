import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const OWNER_ENV = 'GRUNDLE_VERIFICATION_OWNER';

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Permission errors are not evidence that a process has stopped.
    return error.code !== 'ESRCH';
  }
}

function readOwner(directory) {
  try {
    const owner = JSON.parse(readFileSync(path.join(directory, 'owner.json'), 'utf8'));
    if (!owner.token || !Number.isInteger(owner.pid) || owner.pid <= 0) return null;
    return owner;
  } catch {
    return null;
  }
}

function participants(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json') && name !== 'owner.json')
    .map((name) => ({ name, ...JSON.parse(readFileSync(path.join(directory, name), 'utf8')) }));
}

function busy(owner, active) {
  const run = active ?? owner;
  return new Error(
    `Verification already running: ${run.label} (PID ${run.pid}, started ${run.started}). ` +
      'Wait for it to finish, or stop that run and its children before retrying. Do not delete an active lock.',
  );
}

function recover(directory, expectedOwner) {
  const recovery = path.join(directory, 'recovery');
  // Serialize stale recovery. Never recursively delete the lock directory:
  // a competing new owner or an unrecognized record must keep it locked.
  mkdirSync(recovery);
  try {
    const current = readOwner(directory);
    if (current?.token !== expectedOwner.token)
      throw new Error('Verification owner changed; retry.');
    const records = participants(directory);
    const active = records.find((record) => alive(record.pid));
    if (alive(current.pid) || active) throw busy(current, active);
    for (const record of records) unlinkSync(path.join(directory, record.name));
    unlinkSync(path.join(directory, 'owner.json'));
  } finally {
    rmdirSync(recovery);
  }
  rmdirSync(directory);
}

export function acquireVerification(root, label, env = process.env) {
  const directory = path.join(root, '.verification-lock');
  let ownsLock = false;
  let owner;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      mkdirSync(directory);
      ownsLock = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    if (ownsLock) {
      owner = { token: randomUUID(), pid: process.pid, label, started: new Date().toISOString() };
      writeFileSync(path.join(directory, 'owner.json'), JSON.stringify(owner), { flag: 'wx' });
      break;
    }
    owner = readOwner(directory);
    if (!owner) {
      throw new Error(
        `Verification lock is initializing or unreadable: ${directory}. Refusing to start; inspect it before recovery.`,
      );
    }
    const active = participants(directory).find((record) => alive(record.pid));
    if (env[OWNER_ENV] === owner.token && (alive(owner.pid) || active)) break;
    if (alive(owner.pid) || active) throw busy(owner, active);
    if (attempt === 1) throw new Error('Verification ownership changed during recovery; retry.');
    recover(directory, owner);
  }

  const register = (pid, command) => {
    const filename = path.join(directory, `${pid}-${randomUUID()}.json`);
    writeFileSync(
      filename,
      JSON.stringify({ pid, label: command, started: new Date().toISOString() }),
      { flag: 'wx' },
    );
    return () => unlinkSync(filename);
  };
  const unregister = register(process.pid, label);
  return {
    env: { ...env, [OWNER_ENV]: owner.token },
    register,
    retain(reason) {
      // PID 0 is deliberately indeterminate: automatic stale recovery must
      // not clear ownership after an unverified process-tree shutdown.
      register(0, reason);
    },
    release() {
      unregister();
      if (!ownsLock) return;
      const active = participants(directory).find((record) => alive(record.pid));
      if (active) throw busy(owner, active);
      // Dead child records can remain after a forced interruption.
      for (const record of participants(directory)) unlinkSync(path.join(directory, record.name));
      unlinkSync(path.join(directory, 'owner.json'));
      rmdirSync(directory);
    },
  };
}
