import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireVerification } from './verification-lock.mjs';
import { runCommand } from './run-command.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const frontend = path.join(root, 'frontend');
const require = createRequire(path.join(frontend, 'package.json'));
const [target, ...args] = process.argv.slice(2);
let lease;
try {
  if (!['local', 'deployment'].includes(target))
    throw new Error('Expected local or deployment browser target.');
  if (!process.env.npm_execpath)
    throw new Error('Run browser tests through the frontend npm scripts.');
  lease = acquireVerification(root, `Playwright ${target}`);
  let status = 0;
  if (target === 'local') {
    ({ status } = await runCommand(
      process.execPath,
      [process.env.npm_execpath, 'run', 'build', '-w', 'frontend'],
      { cwd: root, lease },
    ));
  }
  if (status === 0) {
    const env = { ...lease.env, PLAYWRIGHT_BROWSERS_PATH: '0' };
    if (target === 'local') env.E2E_BASE_URL = 'http://localhost:5173';
    ({ status } = await runCommand(
      process.execPath,
      [require.resolve('@playwright/test/cli'), 'test', ...args],
      { cwd: frontend, lease, env },
    ));
  }
  process.exitCode = status === 0 ? 0 : 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (lease) {
    try {
      lease.release();
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
