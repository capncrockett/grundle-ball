# Grundle Ball

Playoff visualization and bracket UI for the Grundle League (a Sleeper keeper league). Formerly "Keeper Bowl Playoffs."

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- DaisyUI
- ESLint + Prettier (soon)

## Testing

- Unit/integration: `cd frontend && npm test` (Jest + RTL, jsdom). See `TESTING.md` for roadmap.
- E2E smoke: `cd frontend && npm run test:e2e` (Playwright). Configure base URL via `E2E_BASE_URL` in `.env` (root uses the deployed Vercel URL by default).

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

## Playoff seeding

- Playoffs begin Week 15 and conclude in Week 17.
- Six-team championship bracket; seeds 1 and 2 earn first-round byes.
- Seeds 1-3: Division winners, ordered by record (wins/losses/ties) > Points For.
- Seeds 4-5: Next two best records regardless of division > Points For.
- Seed 6: Highest Points For among teams not already seeded (ignores record/division).

## Bracket rules (routing)

- Champ Bowl

  - Seeds 1 and 2 get byes into Round 2.
  - Round 1: 4 vs 5 (top), and 3 vs 6 (bottom). Losers drop into the Keeper Bowl as Floaters.
  - Round 2: 1 plays winner of 4/5; 2 plays winner of 3/6.
  - Finals: Round 2 winners play for 1st/2nd; Round 2 losers play to determine 3rd/4th.

- Keeper Bowl

  - Floaters come from the Champ Round 2 losers (top and bottom sides).
  - Splashbacks come from Toilet Round 1 winners: winner of 8/9 feeds Splash Back 1; winner of 7/10 feeds Splash Back 2.
  - Splashbacks winners play for 5th/6th; Splashbacks losers play for 7th/8th.

- Toilet Bowl
  - Seeds 12 and 11 punished with byes into Round 2.
  - Round 1: 8 vs 9 (top), 7 vs 10 (bottom). Winners jump up into the Keeper Bowl as Splashback.
  - Round 2: 12 plays loser of 8/9; 11 plays loser of 7/10.
  - Finals: Round 2 winners play for 12th (Toilet King gets 1.01)/11th; Round 2 losers play to determine 10th/9th (Poop King).
