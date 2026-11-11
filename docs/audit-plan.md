# FastRouteCO — Audit Plan

Instructions for the coding agent (OpenCode) to perform a full professional audit of the FastRouteCO monorepo (`backend/`, `web/`, `mobile/`, infrastructure, CI and docs) before deployment.

## 1. Role

Act as a senior software security auditor (OWASP, CWE) and senior software architect.

Ask for an audit, not praise:
- Report only problems and risks. Do not praise the code.
- Do not soften findings. If something is wrong, insecure, untested or inconsistent with the requirements, say so plainly.
- Prioritize real impact over paranoia: every finding needs evidence in the code and a realistic scenario.
- If you are not sure, mark the finding as "Needs verification" and explain how to verify it. Never guess.

## 2. Sources of truth

Check the code against, in this order:
1. `README.md` (RF01–RF31, RNF01–RNF11, service modalities, payments, credit model, tech stack, glossary).
2. `docs/user-stories/user-stories.xlsx` (HU-01 to HU-39 and their acceptance criteria).
3. `docs/data-model/` (entity-relationship model).
4. `docs/build-plan.md` (decisions, deviations and [TO BE DEFINED] items).

Do not invent requirements. If a finding depends on an undefined business rule, mark it as [TO BE DEFINED] instead of choosing a rule.

## 3. Restrictions

- Fixes use the current stack only: TypeScript 6.0, Node.js 22, Express, Prisma, React + Vite, Expo SDK 58, and the libraries already installed.
- Do not propose new frameworks or dependencies. If a fix truly needs one, mark it as a recommendation and explain why.
- Fixes are minimal: change only what the finding requires.

## 4. Audit dimensions

### 4.1 Security
- Authentication: JWT access token (15 min) and refresh token (7 days) with rotation, hashed refresh tokens, revocation when a user or company is deactivated, invitation tokens (72 h).
- Authorization (RNF04): every endpoint and Socket.IO event checks the role. The Company Administrator can do everything the Logistics Supervisor does, and nothing more.
- Multi-tenant isolation (RNF09): every query, socket room, Redis key and file path is filtered by company. Try to read or change another company's orders, routes, drivers, incidents, students, payments and reports.
- Secrets: no keys, passwords or tokens in code, tests, seeds, Docker files or Git history. `.env` files ignored; only `.env.example` and `.env.test` in the repository. Do not read `.env`.
- Payments (RNF11): no card data stored or logged. Wompi webhook signature and integrity checks verified. Payment events processed once (idempotency). Purchases enabled only after approval.
- Evidence photos: Cloudinary uploads signed by the backend; the secret never reaches the mobile app.
- Input validation: every endpoint validated with zod. Check raw SQL and Cypher queries for injection.
- HTTP hardening: CORS restricted to known origins, security headers, rate limiting on login and invitation endpoints, generic 401 on login.
- Personal data: GPS trails, photos, customer data and student data (minors). Check what is logged, who can see it and whether anything is exposed without need. Report gaps; do not write privacy policies.
- Dependencies: run `pnpm audit` and report vulnerabilities by severity.

### 4.2 Architecture
- Compare the code with the component diagram and the tech stack in the README. Report every deviation.
- Live location and chat use Redis through the Socket.IO Redis adapter. The GPS history stays in PostgreSQL.
- The routing engine (Neo4j + Dijkstra + stop-order algorithm) is isolated from the business modules.
- Geocoding sits behind the backend's own interface, so the provider can be changed.
- RNF01: route optimization in 10 s or less, including the distance matrix. Measure it with realistic data.
- RNF06: the backend is stateless and can run more than one instance.
- RNF07 and RNF08: the mobile offline mode and the behavior when the map service is unavailable.
- Scheduled processes: monthly credit reset, pay-per-use billing close, early charge, Free Trial expiry, renewals. Check that they exist, run in `America/Bogota` time and cannot run twice.

### 4.3 Structure and organization
- Monorepo layout, folder and file naming, and module boundaries are consistent across `backend/`, `web/` and `mobile/`.
- Identifiers, code, comments, commits and repository docs in English; user-facing texts in Colombian Spanish.
- Duplicated logic, dead code, unused files and unused dependencies.
- Consistent patterns: router, controller, service, validation, typed errors.
- Configuration centralized; no magic numbers that should be settings.

### 4.4 Code quality and testing
- TypeScript strictness: `any`, unsafe casts, ignored errors, missing return types in public functions.
- Error handling: no swallowed errors, no leaking stack traces to clients.
- Tests cover the critical business rules: credits (plan first, then purchased), pay-per-use charges, spending limit (80 % alert, block at 100 %), Free Trial and blocking rules, plan limits (drivers, branches), school module entitlement, geofence, offline queue and sync conflicts.
- CI coverage: the CI currently checks only the backend. Report what is not checked (web, mobile) and the risk.
- Traceability: each module maps to its HU, RF or RNF. Report features without requirement and requirements without implementation.

### 4.5 Performance and reliability
- Database: N+1 queries, missing indexes on frequent filters (company, dates, status), missing pagination on lists.
- GPS volume: one point every 5 s per driver. Check write cost, Redis usage and history growth.
- Real time: Socket.IO reconnection and behavior after a backend restart.
- Memory and resources: the production target is a single 4 GB ARM64 server. Report anything that does not fit.
- Failure handling: timeouts and retries for Wompi, Resend, Cloudinary, Nominatim and Neo4j.

## 5. For each finding

Deliver these five items:

1. **Severity:** Critical / High / Medium / Low, with a justification.

   | Severity | Meaning |
   |---|---|
   | Critical | Security breach, data from another company exposed, money charged incorrectly, or data loss. Must be fixed before deployment. |
   | High | A requirement is not met, or a serious risk exists in production. Must be fixed before deployment. |
   | Medium | Real problem with limited impact. Fix if time allows, otherwise document. |
   | Low | Quality or maintainability issue. Recommendation only. |

2. **CWE identifier and OWASP category**, when applicable (for example CWE-639 and OWASP A01:2021 Broken Access Control). For non-security findings, write "N/A" and name the affected requirement (HU, RF or RNF) instead.
3. **Exploitability or impact scenario:** a concrete step-by-step scenario. For security findings, how an attacker exploits it. For other findings, how it fails in real use (for example: "driver goes offline for 2 hours → queue file grows → app closes → GPS trail lost").
4. **Concrete fix:** the minimal corrected code, with file and line. No generic advice.
5. **Possible false positive:** when the finding might not apply (for example, a check that already happens in a middleware).

## 6. Report format

Write `docs/audit/audit-report.md`:

1. **Summary table first:**

   | ID | Dimension | Severity | CWE / OWASP | Location (file:line) | Finding | Status |
   |---|---|---|---|---|---|---|

   Add below it: number of findings per severity and the top 5 risks.
2. **Detail after:** one section per finding (`### AUD-01 ...`) with the five items of section 5.

Commit: `docs(audit): add audit report`

## 7. Process

1. **Audit (read only).** Review all dimensions. Do not change code in this step.
2. **Report.** Write the report in the format of section 6.
3. **Fix Critical and High.** One commit per finding (`fix(<scope>): ...`), each with a test that proves the fix. Update the finding status to "Fixed" with the commit hash.
4. **Medium and Low.** Do not fix them. Leave them as recommendations in the report.
5. **Final check.** Lint, typecheck, test and build green in the three apps. Update the report summary.

## 8. Rules

- Stop and ask before: changing a business rule, adding a dependency, deleting data, changing the database schema, or fixing anything that depends on a [TO BE DEFINED] item.
- Never read `.env` files. Never push.
- Do not modify `evaluations/`.
- Save tokens: run only the tests of the module being changed while working and the full suite before each commit; show only failures; search with grep instead of reading whole files; keep progress messages short.
