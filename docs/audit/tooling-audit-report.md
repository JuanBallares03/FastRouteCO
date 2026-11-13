# FastRouteCO — Tooling Audit Report

Audit date: 2026-11-12. Scope: static analysis, linting, testing, dependency and secret scanning for `backend/`, `web/`, `mobile/`, infrastructure and CI.
Sources of truth: `README.md`, `docs/build-plan.md`, `docs/audit/code-audit-report.md`, `docs/deployment-plan.md`.
Repository: `JuanBallares03/FastRouteCO`, `private: false` (public). No `.env` file was read.

## Summary

| Tool | Scope | Status | CWE / OWASP | Notes |
|---|---|---|---|---|
| ESLint | backend, web, mobile | Present | Code quality (no specific CWE) | Flat config with `typescript-eslint` recommended in backend/web; `eslint-config-expo` in mobile. No security plugin. |
| TypeScript `strict` | backend, mobile | Present | Defensive typing (no specific CWE) | Enabled in both. |
| TypeScript `strict` | web | Missing | Defensive typing (no specific CWE) | Measured: enabling it produces **0 errors**. Not enabled by decision; recommendation only. |
| Vitest / Jest | backend, web, mobile | Present | Regression safety (no specific CWE) | 217 backend, 10 web and 24 mobile tests pass. |
| Coverage | backend, web, mobile | Missing | Regression safety (no specific CWE) | No `--coverage` or threshold in any app. |
| CodeQL | all TypeScript | **Integrated** | CWE-89, CWE-79, CWE-639, CWE-798 (plus other CodeQL queries) | `security-extended` suite, push/PR to `main` and weekly. |
| Dependabot | npm, GitHub Actions, Docker Compose | **Integrated** | CWE-1104 / OWASP A06:2021 | Weekly, major versions ignored, 3-day cooldown. |
| `pnpm audit` | whole workspace | **Integrated** | CWE-1104 / OWASP A06:2021 | CI fails only on `high` or `critical`. |
| Dependency Review | pull requests | **Integrated** | CWE-1104 / OWASP A06:2021 | Fails PRs that add `high` or `critical` advisories. |
| GitHub secret scanning | repository | Native, expected enabled | CWE-798 / OWASP A07:2021 | Free for public repositories and enabled by default. Push protection also applies. |
| Gitleaks | repository, full Git history | **Integrated** | CWE-798 / OWASP A07:2021 | Scans push/PR ranges and the full history on schedule and manual runs. |
| Semgrep | all TypeScript | Not integrated | Custom CWE rules | Optional future addition; no npm dependency. |
| Trivy | container images | Not integrated | CWE-1104 / OWASP A06:2021 | Optional future addition for Docker image CVEs. |

Current dependency state: `pnpm audit` reports **0 critical, 0 high, 2 moderate and 1 low**. The remaining advisories are in Expo, ESLint and Jest tooling (`glob`, `minimatch`) and are not reachable from the production backend runtime. The CI threshold is `high` so these do not break the build.

## Inventory before this audit

- Lint: ESLint in the three apps. Backend and web use `@eslint/js` plus `typescript-eslint` recommended rules; mobile uses the Expo flat config. `@typescript-eslint/no-explicit-any` is a warning. The web project also has `oxlint` installed but no script uses it.
- Type checks: backend and mobile use `strict: true`; web `tsconfig.app.json` and `tsconfig.node.json` did not enable `strict`.
- Tests: Vitest in backend and web, `jest-expo` in mobile. CI ran the three suites with PostgreSQL, Redis and Neo4j services.
- Dependency scanning: `pnpm audit` available locally but not executed by CI.
- Secret scanning: no repository-level scanner. `.env` is ignored and `.env.example` files contain names only.
- Static security analysis: none.
- Coverage: none.
- CI: `test`, `web` and `mobile` jobs with install, lint, typecheck, tests and build. No security jobs.

## How the tools apply to FastRouteCO

### Backend (Node.js, Express, Prisma, Redis, Neo4j)

- **CWE-89 / OWASP A03:2021 (injection).** Prisma access is parameterized; the only raw SQL is a static `CREATE DATABASE` statement in `backend/scripts/setup-test-db.ts`. CodeQL covers SQL and command injection in JS/TS. CodeQL does not model Cypher: the Neo4j queries in `backend/src/lib/routing.ts` and the OSM import scripts use driver parameters (`$start`, `$targetIds`, `$points`) instead of interpolation, so there is no known Cypher injection, but no static analyzer enforces that rule. This remains a review and test responsibility.
- **CWE-79 / OWASP A03:2021 (XSS).** React escapes values by default and the codebase has no `dangerouslySetInnerHTML`. CodeQL adds sink detection for future changes.
- **CWE-639 / OWASP A01:2021 (authorization bypass).** The API uses `authenticate`, `authorize` and `authorizeCompanyAccess` in `backend/src/middleware/auth.ts`; tenant filters are applied per service and covered by multi-company isolation tests. CodeQL can flag some routes that reach sensitive sinks without an authorization check, but it cannot prove tenant isolation. Tests remain the primary control.
- **CWE-1104 / OWASP A06:2021 (vulnerable components).** Dependabot, `pnpm audit` and Dependency Review cover direct and transitive npm packages. Dependabot also watches the PostgreSQL, Redis and Neo4j image tags in `docker-compose.yml` and `docker-compose.prod.yml`.
- **CWE-798 / OWASP A07:2021 (hardcoded credentials).** Gitleaks scans the full Git history; GitHub secret scanning covers new pushes. The backend reads secrets from environment variables and the mobile secrets used by tests are non-production placeholders.

### Web (React, Vite)

- CodeQL analyzes the React/TypeScript sources and covers XSS and unsafe DOM patterns.
- The web app consumes the REST API and Socket.IO; no secret should reach it. `VITE_*` values are public by definition and are not treated as secrets.
- Enabling `strict` in `web/tsconfig.app.json` and `web/tsconfig.node.json` produces 0 errors in the current code, so it can be enabled later without code changes. It was intentionally left disabled in this change.

### Mobile (React Native, Expo Router)

- CodeQL analyzes the JavaScript/TypeScript sources. It does not analyze native Kotlin or Swift, which this project does not use.
- The mobile app stores sessions in secure storage and keeps the offline queue in SQLite. Gitleaks prevents committed credentials; it does not inspect runtime device storage.
- The mobile tests use Jest; coverage is not configured.

### Infrastructure and CI

- Dependabot `docker-compose` updates cover image tags, but there is no image CVE scanner. `Trivy` is a free, dependency-free future option.
- CodeQL, Dependency Review and GitHub secret scanning are free for this public repository. If the repository becomes private, CodeQL code scanning and Dependency Review require GitHub Advanced Security; Gitleaks can still run as an action.

## Integrated changes

| Commit | Change |
|---|---|
| `62b8018` | `chore(ci): add CodeQL analysis` — `.github/workflows/codeql.yml` with the `security-extended` query suite for `javascript-typescript` on push, pull request and weekly schedule. |
| `b2ce63a` | `chore(deps): add Dependabot configuration` — weekly npm, GitHub Actions and Docker Compose updates, major versions ignored and a 3-day cooldown. |
| `561e6b0` | `chore(ci): fail on high severity dependency advisories` — `pnpm audit --audit-level=high` in a dedicated CI job. |
| `18d8d28` | `chore(ci): add dependency review workflow` — `actions/dependency-review-action@v5` fails pull requests that introduce `high` or `critical` advisories. |
| `2581f7a` | `chore(ci): add gitleaks secret scanning` — `gitleaks/gitleaks-action@v3` with full checkout, push/PR triggers, weekly schedule and manual dispatch. |

Secret scanning notes:

- GitHub secret scanning and push protection are enabled by default for public repositories. This audit did not change repository settings because no admin credential was used; verify them under **Settings > Code security** if a formal control record is required.
- Gitleaks covers the history requirement. A local full-history scan of 168 commits found no leaks.
- The Gitleaks action is free for personal accounts. The repository owner is a personal account, so no `GITLEAKS_LICENSE` is needed. A free license key is required if the repository is transferred to an organization.

## Gaps and recommendations

1. **Coverage (not integrated).** Vitest coverage needs `@vitest/coverage-v8`, a new npm dependency, so it was excluded by the no-new-dependencies rule. Jest coverage in mobile can run without a new direct dependency but is not configured. Define a coverage threshold per app before deployment.
2. **ESLint security rules (not integrated).** `eslint-plugin-security` would add CWE-oriented rules such as `detect-eval-with-expression`, but it is a new npm dependency. As an alternative, built-in rules (`no-eval`, `no-implied-eval`, `no-new-func`) can be enabled without dependencies.
3. **Web TypeScript `strict` (not enabled).** The measured impact is 0 errors for `tsconfig.app.json` and `tsconfig.node.json`. Recommended as a follow-up commit; it was not enabled in this audit by decision.
4. **Cypher analysis (not available).** No free, zero-dependency static analyzer for Cypher was found. Keep every query parameterized and add a CI grep guard or a focused test if the query surface grows.
5. **Container image CVEs (not integrated).** `Trivy` can scan the Compose images in a GitHub Action without npm dependencies. Consider it before production deployment.
6. **Optional Semgrep.** Semgrep CE can add project-specific rules (for example, Cypher string interpolation), but it is not necessary while CodeQL covers the JS/TS surface.

## Verification

Local results at the time of this report:

- `pnpm lint`: pass for backend, web and mobile.
- `pnpm test`: 16 backend files / 217 tests, 2 web files / 10 tests, 6 mobile suites / 24 tests. All pass.
- `pnpm build`: backend `tsc`, web `tsc -b && vite build` and mobile `tsc --noEmit` pass.
- `pnpm audit`: 0 critical, 0 high, 2 moderate, 1 low (tooling only).
- Gitleaks full history: 168 commits scanned, no leaks.
- Workflow YAML files parsed successfully.

No push was performed. The new workflows will run on the next push to `main`; the local equivalents of lint, typecheck, test and build are green.

## CWE and OWASP coverage matrix

| Control | CWE | OWASP Top 10 2021 |
|---|---|---|
| CodeQL | CWE-79 Cross-site Scripting; CWE-89 SQL Injection; CWE-639 Authorization Bypass Through User-Controlled Key; CWE-798 Use of Hard-coded Credentials | A01 Broken Access Control, A03 Injection, A07 Identification and Authentication Failures |
| Dependabot | CWE-1104 Use of Unmaintained Third Party Components | A06 Vulnerable and Outdated Components |
| `pnpm audit` | CWE-1104 | A06 |
| Dependency Review | CWE-1104 | A06 |
| Gitleaks | CWE-798 | A07 |
| GitHub secret scanning | CWE-798 | A07 |
| ESLint / TypeScript / tests | No single CWE; reduce the probability of CWE-20, CWE-704 and CWE-754 classes | A04 Insecure Design (supporting control) |

Residual risk: static analysis cannot prove multi-tenant authorization or Cypher safety. Those controls remain dependent on the existing test suite and code review.
