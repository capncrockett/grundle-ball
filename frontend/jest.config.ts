import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testMatch: ['**/__tests__/**/*.(spec|test).[tj]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.md\\?raw$': '<rootDir>/src/test/__mocks__/rawMarkdown.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '@vercel/speed-insights/react': '<rootDir>/src/test/__mocks__/speedInsights.tsx',
    '^msw/node$': '<rootDir>/node_modules/msw/node',
    '^@mswjs/interceptors/ClientRequest$':
      '<rootDir>/node_modules/@mswjs/interceptors/ClientRequest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|until-async)/)',
  ],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
};

export default config;
