import {
  DRAFT_INTEL_STAGING_HOST,
  isDraftIntelHost,
  shouldIncludeDraftIntelBuild,
  type DraftIntelBuildEnvironment,
} from './draftIntelAccess';

describe('isDraftIntelHost', () => {
  it.each([
    'localhost',
    'app.localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
    DRAFT_INTEL_STAGING_HOST,
    `HTTPS://${DRAFT_INTEL_STAGING_HOST.toUpperCase()}/local/draft-intel`,
  ])('allows the approved hostname %s', (hostname) => {
    expect(isDraftIntelHost(hostname)).toBe(true);
  });

  it.each([
    'grundle-ball.vercel.app',
    'grundle-ball-git-release-2-4-0.vercel.app',
    '192.168.1.50',
    'example.com',
  ])('rejects the unapproved hostname %s', (hostname) => {
    expect(isDraftIntelHost(hostname)).toBe(false);
  });
});

describe('shouldIncludeDraftIntelBuild', () => {
  it.each<[string, DraftIntelBuildEnvironment]>([
    ['a Vercel custom staging target', { VERCEL_TARGET_ENV: 'staging' }],
    ['the dedicated staging project', { VERCEL_PROJECT_PRODUCTION_URL: DRAFT_INTEL_STAGING_HOST }],
    [
      'a release-branch preview used by the protected staging alias',
      { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'release/2.4.0' },
    ],
  ])('includes Draft Intel for %s', (_label, environment) => {
    expect(shouldIncludeDraftIntelBuild('build', environment)).toBe(true);
  });

  it('includes Draft Intel in the Vite development server', () => {
    expect(
      shouldIncludeDraftIntelBuild('serve', {
        VERCEL_ENV: 'production',
        VERCEL_GIT_COMMIT_REF: 'main',
      }),
    ).toBe(true);
  });

  it.each<[string, DraftIntelBuildEnvironment]>([
    ['a default production build', {}],
    [
      'the public production deployment',
      {
        VERCEL_ENV: 'production',
        VERCEL_TARGET_ENV: 'production',
        VERCEL_GIT_COMMIT_REF: 'main',
        VERCEL_PROJECT_PRODUCTION_URL: 'grundle-ball.vercel.app',
      },
    ],
    [
      'a release ref deployed as production',
      {
        VERCEL_ENV: 'production',
        VERCEL_GIT_COMMIT_REF: 'release/2.4.0',
        VERCEL_PROJECT_PRODUCTION_URL: 'grundle-ball.vercel.app',
      },
    ],
    [
      'an unrelated preview branch',
      { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/example' },
    ],
  ])('excludes Draft Intel from %s', (_label, environment) => {
    expect(shouldIncludeDraftIntelBuild('build', environment)).toBe(false);
  });
});
