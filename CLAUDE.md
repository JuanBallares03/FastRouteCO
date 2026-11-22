# FastRouteCO — Claude Code project instructions

FastRouteCO is an intelligent B2B multi-stop assignment and routing system for Colombian
companies with their own fleet, with dynamic optimization for delivery and pickup routes
based on the driver's starting point. It includes a web panel for administrators and
supervisors and a mobile app for drivers. The initial rollout is planned for Ibagué,
Colombia.

The repository is a pnpm workspace: `backend/` (Node.js + Express, Prisma, PostgreSQL,
Redis, Neo4j), `web/` (React + Vite panel) and `mobile/` (Expo / React Native driver app).

## Project context
- `docs/build-plan.md` is the build prompt: role, rules, tech stack, phases, environment
  variable names and working mode. Before a task, read the sections that apply (search
  with grep, do not load the whole file).
- Phases 0–7 are complete, including Phase 7 (deployment). The as-built detail, later
  changes and the progress log live in `docs/build-log.md`; add new progress entries there.
- Sources of truth (if this file or the plan contradicts them, they win; stop and ask):
  `README.md` (RF01–RF31, RNF01–RNF11), `docs/data-model/entity-relationship-model.sql`,
  `docs/user-stories/user-stories.xlsx` (HU-01–HU-39), `docs/use-cases/` (CU-01–CU-43),
  `docs/architecture/component-diagram.png`.
- Before changing anything in `mobile/`, read `mobile/AGENTS.md` (Expo rules).

## Rules
- **Language**: everything stored in the repository is in English: code, identifiers,
  comments, commit messages and docs. User-facing UI text is in Colombian Spanish (es-CO).
- **No invented requirements**: every feature, endpoint, screen and table must trace to an
  HU, RF, RNF or CU. Reference the IDs in commit bodies and code comments where useful.
  Anything not defined is marked `[TO BE DEFINED]`: list the options with trade-offs and ask.
- **Commits**: Conventional Commits, `type(scope): description` in imperative English,
  lowercase, no trailing period. Types: feat, fix, chore, docs, test, refactor. One commit
  per logical change. Lint, typecheck, test and build of what changed must pass first.
- **Git**: never push without asking. Never rewrite history (force push, `reset --hard`,
  rebasing pushed commits).
- **Secrets**: never read, open or print `.env`, `production.env` or similar files.
  `.env.example`, `.env.test` and `production.env.example` are fine. Never commit secrets.
- **Protected folders**: never modify `evaluations/`. Also leave the course framework
  folders (`agents/`, `config/`, `core/`, `interfaces/`, `skills/`, `tools/`) and
  `docs/architecture.md` and `docs/manifest_schema.md` untouched (build plan rule 8).
- **Dependencies**: stable versions only; ask before adding one outside the confirmed stack.
- **Windows**: when a command differs between PowerShell and Git Bash, give both versions.

## Commands
| Task | Command |
|---|---|
| Lint / test / build (all apps) | `pnpm lint` · `pnpm test` · `pnpm build` |
| Single app | `pnpm --filter <backend\|web\|mobile> lint\|typecheck\|test` |
| Build single app | `pnpm --filter <backend\|web> build` |
| Dev servers | `pnpm dev` |
| Migrations | `pnpm db:migrate` |
