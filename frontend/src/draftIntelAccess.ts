const LOCAL_DRAFT_INTEL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const DRAFT_INTEL_STAGING_HOST = 'grundle-ball-staging.vercel.app';

const normalizeHostname = (value: string | undefined): string =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    ?.replace(/\.$/, '') ?? '';

export const isDraftIntelHost = (hostname?: string): boolean => {
  const normalized = normalizeHostname(hostname);
  return (
    LOCAL_DRAFT_INTEL_HOSTS.has(normalized) ||
    normalized.endsWith('.localhost') ||
    normalized === DRAFT_INTEL_STAGING_HOST
  );
};

export type DraftIntelBuildEnvironment = {
  readonly VERCEL_ENV?: string;
  readonly VERCEL_TARGET_ENV?: string;
  readonly VERCEL_GIT_COMMIT_REF?: string;
  readonly VERCEL_PROJECT_PRODUCTION_URL?: string;
};

export const shouldIncludeDraftIntelBuild = (
  command: string,
  environment: DraftIntelBuildEnvironment,
): boolean => {
  if (command === 'serve') return true;

  const targetEnvironment = environment.VERCEL_TARGET_ENV?.trim().toLowerCase();
  if (targetEnvironment === 'staging') return true;

  if (normalizeHostname(environment.VERCEL_PROJECT_PRODUCTION_URL) === DRAFT_INTEL_STAGING_HOST) {
    return true;
  }

  const vercelEnvironment = environment.VERCEL_ENV?.trim().toLowerCase();
  const isPreview = targetEnvironment === 'preview' || vercelEnvironment === 'preview';
  const gitRef = environment.VERCEL_GIT_COMMIT_REF?.trim() ?? '';
  return isPreview && gitRef.startsWith('release/');
};
