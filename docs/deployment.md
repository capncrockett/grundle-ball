# Deployment and Release Operations

Grundle Ball is deployed as a static Vite SPA on Vercel. This document separates repository-confirmed configuration from settings that must be verified in the Vercel project dashboard.

## Repository-confirmed deployment shape

- GitHub repository: `capncrockett/grundle-ball`.
- Application: `frontend/` React + Vite workspace; no server-side rendering or runtime Node server.
- Expected install command: `npm ci` from the repository root.
- Expected build command: `npm run build -w frontend`.
- Build output: `frontend/dist`.
- Production: `https://grundle-ball.vercel.app`.
- Protected staging and Draft Intel target: `https://grundle-ball-staging.vercel.app`.
- The root package and GitHub Actions use Node 24.x; the Vercel project should use the same major version unless a release explicitly validates a different one.

Live checks performed during the rebrand audit established only host-level state:

- Production returned HTTP 200 and an HTML title of `Grundle Ball`.
- Staging returned a Vercel SSO/protection redirect (HTTP 302), confirming that bypass credentials are required but not that application routes pass.
- Both legacy Keeper Bowl Vercel hostnames returned HTTP 404 and are no longer serving the old application.

These checks do not verify every SPA route, external API call, mobile layout, or protected staging session; those remain explicit smoke tasks.

The root `vercel.json` provides:

- SPA fallback rewrites to `/index.html` for all paths except `/docs/`.
- Direct static serving for constitution documents under `/docs/`.
- Revalidation headers for `/` and `/index.html`.
- Long-lived immutable caching for hashed `/assets/*` files.

`vercel-ignore-build.sh` never skips production builds. For non-production builds, it allows `main` and `release/**` refs and skips other branches when Vercel is configured to use the script.

## Runtime services and secrets

The browser makes unauthenticated requests to Sleeper and ESPN. No private application API key is required for current user-facing features.

Current environment variables are test/deployment controls rather than app configuration:

- `E2E_BASE_URL`: overrides Playwright's target URL.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: lets Playwright access a protected Vercel deployment.
- Vercel-provided build variables populate the footer's branch and target environment through `frontend/vite.config.ts`; the repository link uses the canonical public GitHub URL.

Draft Intel uses two deployment gates:

- Vite includes it during local development, for `VERCEL_TARGET_ENV=staging`, for a dedicated project whose `VERCEL_PROJECT_PRODUCTION_URL` is `grundle-ball-staging.vercel.app`, or for a `release/**` Vercel preview used by the protected staging alias.
- The browser renders it only on localhost variants or `grundle-ball-staging.vercel.app`. The public `grundle-ball.vercel.app` build and origin remain excluded.

The hostname check is not authentication. Keep Vercel Deployment Protection enabled for staging and use its normal authenticated session when opening Draft Intel on a phone.

`VITE_LEAGUE_ID` is not implemented. The confirmed 2026 league ID is centralized in `frontend/src/config/league.ts`; all frontend pages use it, and the Node history updater imports it as its default. Before adding a Vercel variable, define how both the Vite build and the Node updater will receive and validate the same configuration instead of creating separate defaults; see `frontend/TODO.md`.

## GitHub Actions and release flow

Classify the release and select its version using [`versioning.md`](versioning.md). The root `package.json` version is canonical.

1. Branch from `main` as `release/MAJOR.MINOR.PATCH`, then set the same version in the root package and lockfile.
2. GitHub Actions uses Node 24.x to run formatting, root frontend/backend lint and typecheck, plus the frontend Jest suite. These checks run for pull requests and `release/**` pushes.
3. Playwright starts and tests the checked-out app for `release/**` pushes, pull requests targeting `main`, and manual dispatches.
4. Require the release-branch workflows to pass, then merge to `main`.
5. Allow the configured Vercel production deployment to build.
6. Run the Playwright smoke suite against the production URL by setting `E2E_BASE_URL` explicitly.
7. Verify the deployment footer reports the expected branch and environment and links to the public repository.

The protected staging deployment is an optional environment check, not a release gate. When `VERCEL_AUTOMATION_BYPASS_SECRET` is available, `npm run test:e2e -w frontend` exercises it before merge, including the Draft Intel route on desktop and mobile. Otherwise the required release-branch Playwright job still tests the exact commit locally.

The Vercel Git integration, production-branch selection, project root, install/build commands, output directory, Node version, and ignored-build command live outside this repository. Confirm them in the dashboard when changing deployment behavior; do not infer them solely from these docs.

## Local release checks

Run from the repository root:

```bash
npm ci
npm run format
npm run lint
npm run typecheck
npm run test:ci -w frontend
npm run build -w frontend
git diff --check
```

Then follow `TESTING.md` for staging and production browser checks.

## Operational checklist

Repository-backed items:

- [x] SPA rewrites and cache headers are versioned in `vercel.json`.
- [x] Staging Playwright target uses the Grundle Ball hostname.
- [x] Production root responds at `https://grundle-ball.vercel.app` with the Grundle Ball title.
- [x] New staging hostname exists behind Vercel protection; legacy Keeper Bowl hosts return 404.
- [x] Draft Intel build/runtime gates allow localhost and protected staging while excluding public production.
- [x] GitHub Actions run Jest, backend Node tests, the production Vite build, and conditional local Playwright jobs.
- [x] GitHub Actions run frontend/backend typechecks alongside root lint on Node 24.x.
- [x] Vite embeds the Vercel environment and Git branch, the footer links to the public repository, and the app renders Vercel Speed Insights.
- [x] The hosted constitution PDF is present at `frontend/public/docs/Grundle_League_Constitution_2026_REVIEW_DRAFT_v2.pdf`.

Items requiring live operational verification:

- [ ] Confirm Vercel is connected to `capncrockett/grundle-ball` and `main` is the production branch.
- [ ] Confirm project root/build/output/Node settings match the expectations above.
- [ ] Confirm `vercel-ignore-build.sh` is configured as the ignored-build command if branch filtering is desired.
- [ ] After the release deployment completes, open `/local/draft-intel` through the protected staging hostname on a phone and confirm the Draft Intel nav icon and live Sleeper requests.
- [ ] Run every route on staging and production at desktop and mobile widths.
- [ ] Verify Sleeper and ESPN requests succeed from the deployed origins and failures remain user-visible.
- [ ] If desired, add a Grundle Ball custom domain and update tests/docs after DNS and TLS are live.

## Troubleshooting

### Deep links return 404

Confirm the root `vercel.json` is being read by the configured project root and that the rewrite has not been overridden. `/docs/*` is deliberately excluded so static constitution files are served instead of `index.html`.

### Linux-only import failures

Match import casing exactly and run `npm run build -w frontend` before release; the default macOS filesystem may hide case mismatches that fail in Linux builds.

### Stale application shell

Verify the cache headers from `vercel.json` are active for `/` and `/index.html`, then confirm the deployment footer reports the expected branch and environment.

### Browser API failures

Inspect the user-visible error and network response separately for Sleeper and ESPN. The current architecture has no proxy/cache layer to absorb upstream CORS, availability, or response-shape changes.

## Deferred backend

The `backend/` workspace is maintenance tooling, not a deployed proxy. A hosted store, scheduled history updater, or runtime API would change this deployment shape and must be documented when implemented; the outstanding decisions are in `backend/TODO.md`.
