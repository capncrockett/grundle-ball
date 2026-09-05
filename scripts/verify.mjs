import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function verificationPlan(args) {
  const supported = new Set(['--quick', '--e2e', '--list']);
  for (const arg of args) {
    if (!supported.has(arg))
      throw new Error(`Unknown option: ${arg}. Use --quick, --e2e, or --list.`);
  }
  if (args.includes('--quick') && args.includes('--e2e')) {
    throw new Error('--quick and --e2e cannot be combined.');
  }
  const checks = [
    ['Repository invariants', ['run', 'repo:check']],
    ['Documentation', ['run', 'docs:check']],
    ['Formatting', ['run', 'format']],
    ['Lint', ['run', 'lint']],
    ['TypeScript', ['run', 'typecheck']],
    ['Repository tooling tests', ['run', 'test:tooling']],
  ];
  if (!args.includes('--quick')) {
    checks.push(
      ['Frontend tests', ['run', 'test:ci', '-w', 'frontend']],
      ['Backend tests', ['run', 'test', '-w', 'backend']],
      args.includes('--e2e')
        ? ['Production build and browser tests', ['run', 'test:e2e:local', '-w', 'frontend']]
        : ['Production build', ['run', 'build', '-w', 'frontend']],
    );
  }
  return checks;
}

function executeCheck(args) {
  // npm supplies its CLI path on every supported platform. Avoid cmd.exe/shell quoting.
  if (!process.env.npm_execpath) throw new Error('Run this command through npm run verify.');
  return spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: root,
    stdio: 'inherit',
  });
}

export function runChecks(checks, execute = executeCheck, log = console.log) {
  const started = Date.now();
  for (const [index, [name, args]] of checks.entries()) {
    log(`\n[${index + 1}/${checks.length}] ${name}: npm ${args.join(' ')}`);
    const result = execute(args);
    if (result.error || result.status !== 0) {
      log(
        `\nFAILED: ${name}${result.error ? ` (${result.error.message})` : ''}. Later checks were not run.`,
      );
      return 1;
    }
  }
  log(`\nPASS: ${checks.length} checks in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const plan = verificationPlan(args);
    if (args.includes('--list')) {
      for (const [name, command] of plan) console.log(`${name}: npm ${command.join(' ')}`);
    } else {
      process.exitCode = runChecks(plan);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
