import { defineConfig } from 'vite';
import type { CSSOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const buildInfo = {
  gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_REF ?? null,
  vercelEnv: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
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
