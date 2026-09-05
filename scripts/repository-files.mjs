import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

// Include new work before staging, omit ignored artifacts and tracked deletions.
export function repositoryFiles(root) {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  return [...new Set(output.split('\0').filter(Boolean))]
    .filter((file) => {
      const absolute = path.join(root, file);
      return existsSync(absolute) && statSync(absolute).isFile();
    })
    .sort();
}
