# Deployment Strategy (Phase 7)

This is a short, actionable plan to ship the current frontend-only SPA and leave room for a later proxy/cache backend.

## What We’re Shipping Now

- React + Vite SPA in `frontend`, no server-side rendering.
- Direct, unauthenticated calls to Sleeper public APIs (CORS-friendly) and ESPN API (for game status).
- Client-side routing via `BrowserRouter` (needs SPA rewrite on host).
- Responsive mobile-first design with DaisyUI themes.

## ✅ Chosen Platform: Vercel

Why Vercel

- Zero configuration — auto-detects Vite projects
- Free tier: 100GB bandwidth/month (plenty for a league site)
- Automatic HTTPS and custom domains
- SPA routing works out of the box
- Instant preview deployments for PRs
- Deploys on every push to main

Current Deployment

- Repository: Connected to GitHub (`capncrockett/grundle-ball`, formerly `capncrockett/keeper-bowl-playoffs`)
- Branch: `main` auto-deploys
- Build command: Auto-detected (runs from `frontend` directory)
- Output directory: `frontend/dist`
- Node version: 20.x (auto-detected)

Vercel-Specific Notes

- Vercel automatically handles SPA routing (no config needed)
- Build cache speeds up subsequent deployments
- Preview URLs generated for every PR
- Production URL: `[your-app].vercel.app` (add a custom domain in Vercel dashboard if desired)

## Config / Secrets

- League targeting: today the league ID is hard-coded in pages; before prod, centralize to `VITE_LEAGUE_ID` (and set it in the host) so we can change leagues without rebuilds.
  - For Vercel: Project Settings -> Environment Variables -> Add `VITE_LEAGUE_ID`
- No private API keys are required for Sleeper/ESPN right now.
- Optional envs to add later:
  - `VITE_SENTRY_DSN` — error tracking
  - `VITE_FEATURE_FLAGS` — remote toggles
  - `VITE_ANALYTICS_ID` — analytics provider ID

## CI/CD Flow

Current Setup (Vercel)

1. Push to main: Vercel automatically builds and deploys to production.
2. Pull Requests: Vercel creates a preview deployment with a unique URL.
3. Build checks: Vercel runs `npm run build` — build must succeed.

Optional GitHub Actions (future)

1. PRs: run `npm ci`, `npm run lint`, `npm run build` in `frontend`.
2. Add tests when a framework is configured.
3. Track bundle size changes.
4. Gate merges on passing checks.

## Release Readiness Checklist

- [x] Connect GitHub repo to Vercel
- [x] Confirm SPA routing works (Vercel handles automatically)
- [x] Fix case-sensitivity issues (macOS vs Linux)
- [x] Verify `npm run build` passes in Vercel
- [x] Mobile responsive design tested
- [ ] Add env-backed league ID (`VITE_LEAGUE_ID`) for easier league swaps
- [ ] Test all routes on production URL
- [ ] Verify ESPN API calls work from deployed environment
- [ ] Share production URL with league members
- [ ] Optional: Add custom domain (e.g., `keeper-bowl.com`)
- [ ] Optional: Create GitHub Action for additional CI checks

## Common Issues

Case-Sensitivity Errors

- macOS filesystem is case-insensitive, but Linux (Vercel) is case-sensitive.
- Always match import statements exactly to filename casing.
- Test with `npm run build` locally before pushing.

Build Timeouts

- Vercel free tier has a ~45s build timeout (rarely an issue for this project).

API Rate Limits

- Sleeper API: generous; this app’s call volume is low.
- ESPN API: generally permissive; also low volume per user.

## Later: Backend Proxy (optional)

- Add a small Node service in `backend` to cache Sleeper responses, hide any future API keys, and rate-limit.
- Host as a Vercel Serverless Function, Render Web Service, or Cloudflare Worker.
- Front it with the same static site.
- Until then, the static deploy is sufficient for league usage.
