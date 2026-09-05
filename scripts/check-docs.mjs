import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryFiles } from './repository-files.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

const staleBrands = [
  {
    name: 'former application brand',
    pattern: /keeper bowl playoffs/giu,
    allowedFiles: new Set(['CONTEXT.md']),
  },
  {
    name: 'former deployment hostname',
    pattern: /league-for-all-seasons\.vercel\.app/giu,
    allowedFiles: new Set(),
  },
];

const markdownFiles = repositoryFiles(repositoryRoot).filter((file) => file.endsWith('.md'));

const errors = [];
let checkedLinks = 0;

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function githubSlug(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

function anchorsFor(markdownPath) {
  const content = readFileSync(markdownPath, 'utf8');
  const anchors = new Set();
  const slugCounts = new Map();
  let inFence = false;

  for (const line of content.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const baseSlug = githubSlug(heading[1]);
      const count = slugCounts.get(baseSlug) ?? 0;
      anchors.add(count === 0 ? baseSlug : `${baseSlug}-${count}`);
      slugCounts.set(baseSlug, count + 1);
    }

    for (const match of line.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) {
      anchors.add(match[1]);
    }
  }

  return anchors;
}

const anchorCache = new Map();

function validateLink(sourceFile, sourceLine, rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith('<')) {
    const closingBracket = target.indexOf('>');
    target = closingBracket === -1 ? target : target.slice(1, closingBracket);
  } else {
    target = target.split(/\s+["'(]/, 1)[0];
  }

  if (
    !target ||
    target.startsWith('/') ||
    target.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  ) {
    return;
  }

  const [rawPath, rawFragment = ''] = target.split('#', 2);
  let linkPath;
  let fragment;
  try {
    linkPath = decodeURIComponent(rawPath.split('?', 1)[0]);
    fragment = decodeURIComponent(rawFragment);
  } catch {
    errors.push(`${sourceFile}:${sourceLine}: invalid URL encoding in ${target}`);
    return;
  }
  const resolvedPath = linkPath
    ? path.resolve(path.dirname(path.join(repositoryRoot, sourceFile)), linkPath)
    : path.join(repositoryRoot, sourceFile);

  checkedLinks += 1;

  if (!existsSync(resolvedPath)) {
    errors.push(`${sourceFile}:${sourceLine}: missing internal target ${target}`);
    return;
  }

  let anchorPath = resolvedPath;
  if (statSync(resolvedPath).isDirectory()) {
    anchorPath = path.join(resolvedPath, 'README.md');
    if (!existsSync(anchorPath)) {
      errors.push(`${sourceFile}:${sourceLine}: directory target has no README.md: ${target}`);
      return;
    }
  }

  if (fragment && path.extname(anchorPath).toLowerCase() === '.md') {
    const cacheKey = path.normalize(anchorPath);
    const anchors = anchorCache.get(cacheKey) ?? anchorsFor(anchorPath);
    anchorCache.set(cacheKey, anchors);
    if (!anchors.has(fragment.toLowerCase())) {
      errors.push(`${sourceFile}:${sourceLine}: missing Markdown anchor #${fragment} in ${target}`);
    }
  }
}

for (const markdownFile of markdownFiles) {
  const absolutePath = path.join(repositoryRoot, markdownFile);
  const content = readFileSync(absolutePath, 'utf8');

  for (const staleBrand of staleBrands) {
    if (staleBrand.allowedFiles.has(markdownFile)) continue;
    for (const match of content.matchAll(staleBrand.pattern)) {
      errors.push(
        `${markdownFile}:${lineNumberAt(content, match.index)}: found ${staleBrand.name}`,
      );
    }
  }

  let inFence = false;
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      validateLink(markdownFile, index + 1, match[1]);
    }

    const reference = line.match(/^\s*\[[^\]]+\]:\s*(\S.*)$/);
    if (reference) validateLink(markdownFile, index + 1, reference[1]);
  }
}

if (errors.length > 0) {
  console.error(`Documentation checks failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation checks passed: ${markdownFiles.length} files, ${checkedLinks} internal links.`,
  );
}
