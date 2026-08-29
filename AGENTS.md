# AGENTS.md

Guidance for coding agents working in this repository.

## Where things live

| Concern                                                 | Location                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Frontend agent index (architecture, commands, patterns) | `frontend/WARP.md`                                                                           |
| Repo-level agent conventions + skills index             | `AGENTS.md` (this file)                                                                      |
| Domain glossary (ubiquitous language)                   | `CONTEXT.md` (created when terminology work starts)                                          |
| Architecture Decision Records                           | `docs/adr/` (created lazily)                                                                 |
| Versioning and release policy                           | `docs/versioning.md`                                                                         |
| Installed agent skills                                  | `.agents/skills/`                                                                            |
| League constitution source of truth                     | `frontend/src/content/constitution.md`                                                       |
| Current constitution archive (2026 review draft)        | `docs/Grundle_League_Constitution_2026_REVIEW_DRAFT_v2.pdf`                                  |
| Hosted constitution PDF (Vercel static)                 | `frontend/public/docs/Grundle_League_Constitution_2026_REVIEW_DRAFT_v2.pdf` → `/docs/...pdf` |
| Legacy constitution archive                             | `docs/Grundle Constitution v2.docx`                                                          |

Keep implementation details out of `CONTEXT.md`. That file is a glossary only.

## Product and bracket names

- **Grundle Ball** is the current application and repository brand.
- **Grundle League** is the fantasy league represented by the application.
- **Playoffs** means the official bracket mirrored from Sleeper at `/playoffs`.
- **Grundle Bowl Beta** is the rejected custom three-bracket proposal retained under `/beta/grundle-bowl` for experimentation.
- **Keeper Bowl** is still the proper name of the middle bracket inside that Beta proposal and of the corresponding historical 2026 vote. Do not use it as the application name.

Do not reintroduce the previous application brand in current-facing copy. Retain old names only where repository migration history or league rule history genuinely requires them, and label that context as historical.

## Skills

Skills in `.agents/skills/` are project-local copies so agents in this repo can use them without depending on a personal machine install.

### Available skills

- **grill-with-docs** (`.agents/skills/grill-with-docs`)  
  Explicit-only. Relentless design interview while maintaining `CONTEXT.md` and sparingly writing ADRs. Use when the user asks to be grilled with docs / grill-with-docs.
- **grilling** (`.agents/skills/grilling`)  
  One-question-at-a-time stress test of a plan or decision. No implementation during the session.
- **domain-modeling** (`.agents/skills/domain-modeling`)  
  Challenge terminology, keep the glossary sharp, and record durable decisions as ADRs when warranted.

Personal Codex installs of the same skills may also exist under `~/.codex/skills/`. Prefer the repo copies for project work so docs land in this repository.

### Upstream source

These skills are based on [mattpocock/skills](https://github.com/mattpocock/skills), especially:

- `skills/engineering/grill-with-docs`
- `skills/engineering/domain-modeling`
- `skills/productivity/grilling`

## Working conventions

1. Read `frontend/WARP.md` before non-trivial frontend changes.
2. Prefer DaisyUI components/layout primitives over custom UI chrome.
3. Constitution content edits go through `frontend/src/content/constitution.md` (PR-reviewed).
4. When terminology is being decided or renamed, use **grill-with-docs** / **domain-modeling** and update `CONTEXT.md` as terms resolve.
5. Do not commit unless asked. When committing, include:
   `Co-Authored-By: Oz <oz-agent@warp.dev>`
6. Classify releases by the declared public and operational contract in `docs/versioning.md`. Release branches use `release/MAJOR.MINOR.PATCH`, and the root `package.json` version is canonical.
7. Before committing maintained frontend code or content, run `npm run format:write`, then verify `npm run format`. Husky and lint-staged also format supported staged text files during `git commit`; CI enforces the full frontend formatting check on pull requests and `release/**` pushes.
8. Never use Unicode em dashes or en dashes anywhere in the repository. Use the ASCII hyphen-minus (`-`) instead.
