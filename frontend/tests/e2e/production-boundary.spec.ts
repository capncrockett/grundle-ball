import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const distRoot = fileURLToPath(new URL('../../dist/', import.meta.url));
const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

let productionOrigin = '';
let productionServer: Server | null = null;

const startProductionServer = async (): Promise<string> => {
  productionServer = createServer((request, response) => {
    void (async () => {
      const requestURL = new URL(request.url ?? '/', 'http://127.0.0.1');
      const relativePath = decodeURIComponent(requestURL.pathname).replace(/^\/+/, '');
      const candidatePath = path.resolve(distRoot, relativePath);
      const isInsideDist =
        candidatePath === path.resolve(distRoot) ||
        candidatePath.startsWith(`${path.resolve(distRoot)}${path.sep}`);

      if (!isInsideDist) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      let filePath = path.join(distRoot, 'index.html');
      if (relativePath) {
        try {
          if ((await stat(candidatePath)).isFile()) filePath = candidatePath;
        } catch {
          if (relativePath.startsWith('assets/')) {
            response.writeHead(404).end('Not found');
            return;
          }
        }
      }

      const body = await readFile(filePath);
      const contentType = contentTypes[path.extname(filePath)] ?? 'application/octet-stream';
      response.writeHead(200, { 'content-type': contentType }).end(body);
    })().catch((error: unknown) => {
      response.writeHead(500).end(error instanceof Error ? error.message : 'Server error');
    });
  });

  await new Promise<void>((resolve, reject) => {
    productionServer?.once('error', reject);
    productionServer?.listen(0, '127.0.0.1', resolve);
  });
  const address = productionServer.address();
  if (!address || typeof address === 'string')
    throw new Error('Production test server has no port');
  return `http://127.0.0.1:${address.port.toString()}`;
};

test.beforeAll(async ({}, workerInfo) => {
  const configuredBaseURL = String(workerInfo.project.use.baseURL ?? '');
  const configuredHost = configuredBaseURL ? new URL(configuredBaseURL).hostname : '';
  productionOrigin =
    configuredHost === 'localhost' || configuredHost === '127.0.0.1'
      ? await startProductionServer()
      : configuredBaseURL.replace(/\/$/, '');
});

test.afterAll(async () => {
  if (!productionServer) return;
  await new Promise<void>((resolve, reject) => {
    productionServer?.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

test('production omits the local-only Draft Intel navigation and route', async ({ page }) => {
  await page.goto(`${productionOrigin}/`);

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('link', { name: /draft intel/i })).toHaveCount(0);

  await page.goto(`${productionOrigin}/local/draft-intel`);

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('heading', { name: /draft intel/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /draft intel/i })).toHaveCount(0);
});
