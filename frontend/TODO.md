# Frontend TODO

## League configuration

- If deployments need runtime-selectable leagues, replace the checked-in configuration deliberately: validate the browser-facing value, define how the Node history updater receives the same default, preserve its `--league` override, and update deployment docs/tests together. The confirmed 2026 default is already centralized in `src/config/league.ts` for current use.

## Tailwind cleanup (optional)

- Remove unused Vite starter CSS in `frontend/src/App.css` (no imports) or migrate any needed styles to Tailwind classes.
- Replace `.bracket-team-name`/`.bracket-score` rules in `frontend/src/index.css` with Tailwind utilities applied in `frontend/src/components/bracket/BracketTile.tsx` (line-clamp + responsive text sizing).
- Swap inline size styles in `frontend/src/components/common/TeamAvatars.tsx` for Tailwind size class mappings (e.g., `w-6 h-6`, `w-8 h-8`, `w-10 h-10`).
- Consider moving the 3D flip inline styles in `frontend/src/components/bracket/BracketTile.tsx` to Tailwind arbitrary utilities for consistency.
