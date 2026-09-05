import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryFiles } from './repository-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const errors = [];
const textExtensions = new Set([
  '.md',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.html',
  '.yml',
  '.yaml',
  '.sh',
  '.txt',
  '.csv',
  '.toml',
]);
const textNames = new Set(['.gitignore', '.gitattributes', '.prettierignore', '.prettierrc']);

try {
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lockfile = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) {
    errors.push('package.json: version must be MAJOR.MINOR.PATCH.');
  }
  if (
    lockfile.version !== manifest.version ||
    lockfile.packages?.['']?.version !== manifest.version
  ) {
    errors.push('package-lock.json: both root versions must match package.json.');
  }
  if (lockfile.name !== manifest.name || lockfile.packages?.['']?.name !== manifest.name) {
    errors.push('package-lock.json: both root names must match package.json.');
  }
} catch (error) {
  errors.push(`Cannot validate root package files: ${error.message}`);
}

let checked = 0;
for (const file of repositoryFiles(root)) {
  if (
    !textExtensions.has(path.extname(file)) &&
    !textNames.has(path.basename(file)) &&
    !file.startsWith('.husky/')
  )
    continue;
  checked += 1;
  const content = readFileSync(path.join(root, file), 'utf8');
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (/[\u2013\u2014]/u.test(line)) {
      errors.push(
        `${file}:${index + 1}: use ASCII hyphen-minus instead of Unicode dash punctuation.`,
      );
    }
  }
}

if (errors.length) {
  console.error(`Repository checks failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Repository checks passed: ${checked} text files; root package and lockfile agree.`);
}
