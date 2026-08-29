import { defineConfig } from 'vite';
import type { CSSOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const buildInfo = {
  buildAt: new Date().toISOString(),
  gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
  gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_REF ?? null,
  gitRepo: process.env.VERCEL_GIT_REPO_SLUG ?? null,
  gitOwner: process.env.VERCEL_GIT_REPO_OWNER ?? null,
  gitCommitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
  gitCommitAuthor:
    process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN ?? process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME ?? null,
  gitPullRequestId: process.env.VERCEL_GIT_PULL_REQUEST_ID ?? null,
  gitPullRequestTitle: process.env.VERCEL_GIT_PULL_REQUEST_TITLE ?? null,
  vercelEnv: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
  vercelRegion: process.env.VERCEL_REGION ?? null,
  vercelUrl: process.env.VERCEL_URL ?? null,
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  projectId: process.env.VERCEL_PROJECT_ID ?? null,
};

const lightningcssOptions = {
  // Teach Lightning CSS about CSS Houdini @property, used by DaisyUI radial progress
  customAtRules: {
    property: {
      prelude: '<custom-ident>',
      body: 'declaration-list',
    },
  },
} satisfies NonNullable<CSSOptions['lightningcss']>;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss({
      // Skip Tailwind's Lightning CSS optimizer (it doesn't recognize @property yet)
      optimize: false,
    }), // Tailwind v4 integration
  ],
  css: {
    transformer: 'lightningcss',
    lightningcss: lightningcssOptions,
  },
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  build: {
    // Avoid DaisyUI's @property warning during minification
    cssMinify: 'lightningcss',
  },
});
