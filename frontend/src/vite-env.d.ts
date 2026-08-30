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
}

export {};
