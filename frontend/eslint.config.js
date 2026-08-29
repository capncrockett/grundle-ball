import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));
const tsProjects = [
  path.join(tsconfigRootDir, 'tsconfig.app.json'),
  path.join(tsconfigRootDir, 'tsconfig.node.json'),
];
const frontendFiles = ['**/src/**/*.{ts,tsx}'];
const backendFiles = ['**/backend/**/*.ts'];

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: [frontendFiles],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        project: tsProjects,
        tsconfigRootDir,
      },
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
  {
    files: [backendFiles],
    ignores: ['../backend/node_modules/**'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        tsconfigRootDir,
      },
      globals: {
        ...globals.node,
      },
    },
  },
]);
