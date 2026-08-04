import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const constitutionPath = resolve(process.cwd(), 'src/content/constitution.md');
const content = readFileSync(constitutionPath, 'utf8');

export default content;
