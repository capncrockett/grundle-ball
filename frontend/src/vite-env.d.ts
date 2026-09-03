/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string;
  export default content;
}

declare global {
  const __BUILD_INFO__: {
    gitRef: string | null;
    vercelEnv: string | null;
  };
  const __DRAFT_INTEL_BUILD__: boolean;
}

export {};
