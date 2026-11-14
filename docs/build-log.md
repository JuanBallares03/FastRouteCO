# FastRouteCO — Build log

Completed phase details moved from `docs/build-plan.md`. The plan keeps standing decisions and pending work.

## Progress log

| Date | Step | Result | Commit |
|---|---|---|---|
| 2026-11-05 | Phase 1, step 3 | Company Administrator backend: company data, branches, supervisors and drivers with plan limits and multi-company isolation | `c51ec39` |
| 2026-11-05 | Phase 1, steps 4-5 | Web design system and login/set-password screens verified (already present) | — |
| 2026-11-05 | Phase 1, steps 6-11 | Web screens: companies and company detail (already present), my company, branches, supervisors and drivers | `b04492b` |
| 2026-11-05 | Phase 2 | Orders registration, geocoding and management (HU-28) | `85fa47c` |
| 2026-11-05 | Phase 2 | Driver suggestions, order assignment and route creation (HU-29, HU-06) | `7d9477a` |
| 2026-11-05 | Phase 2 | Route paths with Neo4j Dijkstra and approximate fallback (RF15) | `2cc147d` |
| 2026-11-05 | Phase 2 | Local Nominatim and road-network import tooling | `8008fa4` |
| 2026-11-05 | Phase 2 | Web screens: orders, routes and route detail with map (HU-28, HU-29, HU-06, HU-08) | `4b6cdb8` |
| 2026-11-05 | Phase 2 | Route optimization with nearest neighbor and 2-opt, metrics in `route_optimizations` (RF06, RNF01, HU-07, HU-08) | `b35f495` |
| 2026-11-05 | Phase 2 | Optimize action in the route detail screen | `15a824c` |
| 2026-11-05 | Fix | Free trial renewal stored as a Bogotá business date | `28cb501` |
| 2026-11-05 | Phase 3 | Plans, credit balances, consumption, Wompi checkout and webhook, card registration and pay-per-use (RF18-RF22, RF28-RF31, HU-16 to HU-18, HU-22, HU-33, HU-37 to HU-39) | `a7f0e91` |
| 2026-11-05 | Phase 3 | Platform plans/modules/packages screen and company subscription/credits/history screen | `be3ddef` |
| 2026-11-05 | Fix | Monthly pay-per-use spending limit aggregates early and open charges | `f564a34` |
| 2026-11-05 | Fix | Plan seed limits and provisional prices aligned with the README | `c4eb557` |
| 2026-11-05 | Test | Subscription plans use credits only and never pay-per-use rates | `87ed71d` |
| 2026-11-06 | Phase 4 | Driver route execution endpoints, GPS trail, geofence arrival, evidence signature and stop completion (RF09, RF10, RF13, RF14, RF16, RF24) | `2f900e4` |
| 2026-11-06 | Phase 4 | Driver mobile app: today's route, start and finish, GPS every 5 seconds, geofence, photo evidence and offline queue (RF09, RF10, RF13, RF14, RF16, RF17, RF24) | `6cb03e6` |
| 2026-11-06 | Fix | Demo seed script loads the backend environment variables | `8fe8112` |
| 2026-11-07 | Phase 5 | Socket.IO server, realtime route events, incident chat endpoints and route/stop reassignment (RF07, RF08, RF25, HU-09 to HU-11, HU-31) | `ae28612` |
| 2026-11-07 | Phase 5 | Latest driver location endpoint for the live map | `c085c59` |
| 2026-11-07 | Phase 5 | Web route detail: live driver marker, incident chat and reassignment controls | `f2eab87` |
| 2026-11-09 | Fix | Verified school transport `plan_modules` cleanup: only Free Trial and Premium remain | `d176b38` |
| 2026-11-09 | Realtime | Socket.IO Redis adapter shared across backend instances (RF08, RF25, RNF02) | `e231ef4` |
| 2026-11-09 | Phase 7 | Hosting decided: AWS EC2 ARM64 `t4g.medium` with Docker Compose, Caddy and daily PostgreSQL backups | `7bde605` |
| 2026-11-09 | Phase 7 | Production Docker Compose, backend and web images, Caddy config, env examples, backup script and README deployment steps | `e15231b` |
| 2026-11-09 | Phase 7 | Hosting corrected to AWS EC2 `t4g.medium` after the university requirement | `37e9d24` |
| 2026-11-09 | Phase 7 | Production memory tuned for 4 GB plus swap, with per-service budget | `666635c` |
| 2026-11-09 | Phase 7 | AWS budget alert, EC2/security group and swap steps | `01f2aaf` |
| 2026-11-07 | Phase 5 | Mobile incidents tab and realtime route refresh on reassignment | `b3cdee2` |
| 2026-11-07 | Phase 5 | Expo SDK 58 patch update and `expo-sqlite` dependency | `339f2b4` |
| 2026-11-07 | Phase 5 | Offline queue and route cache moved to SQLite with legacy JSON migration | `ae153f2` |
| 2026-11-08 | Phase 6 | Company and platform reports (RF11, HU-05, HU-12, HU-35) | `c3a8aa1` |
| 2026-11-08 | Phase 6 | Support requests, platform monitoring and system alerts (RF26, HU-02, HU-03, HU-34) | `b3328e5` |
| 2026-11-08 | Phase 6 | Runtime system settings applied to auth and email (HU-23) | `c02d0d2` |
| 2026-11-08 | Phase 6 | School transport students, route stops, tests and non-destructive seed associations (RF12, HU-32) | `20ce704` |
| 2026-11-08 | Phase 6 | Web dashboards, reports, support, monitoring, settings and students screens | `12636c7` |
| 2026-11-08 | Fix | Validation middleware applies parsed defaults and coercions across modules | `d82de2e` |
| 2026-11-08 | Chore | Unused MCP servers disabled, leaving only Context7 | `2c59c37` |
| 2026-11-13 | Mobile | Background GPS with expo-location foreground service, secure-store token hydration, SQLite queue sync and foreground fallback (RF13, RNF02, RNF07, RNF10) | `0646928` |


## Phase 1 — Access, companies and users

Step 2 scope, as built (`/api/v1/platform/*`, Platform Administrator only):
- `POST /companies` registers only the company (HU-01) with its Free Trial subscription (status active, no billing cycle or payment, renewal date = today + 7 days in Colombia) and credit balance, and sends the confirmation email to the company email. It rejects companies without their own fleet (HU-01 R01) and duplicated NIT. It does not create the Company Administrator.
- `GET /companies` with filters (company status, subscription status, plan, search by legal name or NIT) and pagination (HU-20 CA01); `GET /companies/:id` with details, plan, subscription and administrators.
- `PATCH /companies/:id/status` activates or deactivates; deactivating blocks login (HU-20 CA03), revokes refresh tokens and keeps the data (HU-20 CA04).
- `GET` and `POST /companies/:id/admins` (HU-21, sends the invitation) and `PATCH /companies/:id/admins/:adminId/status`.
- Not included on purpose: deleting companies, editing company data (Company Administrator, HU-24) and editing administrators.
- Login errors: unknown email or wrong password return 401 with a generic message; correct credentials with an inactive user or company return 403 with the reason.

As built:
- Login and role-based access for the four roles; the Company Administrator can also do everything the Logistics Supervisor does (RNF04, HU-04, CU-01).
- Multi-company data isolation: each company only accesses its own data (RNF09).
- Company registration with automatic 7-day Free Trial (RF02, RF19, HU-01, CU-02, CU-03).
- Company management, Company Administrators, supervisors, branches and drivers (RF02, RF03, RF23, HU-20, HU-21, HU-24 to HU-27).
- Transactional emails with Resend (RF27).

## Phase 2 — Orders, routes and routing engine

As built:
- Order registration with OpenStreetMap geocoding (RF04, RF15, HU-28).
- Driver suggestion and order assignment (RF05, HU-29).
- Route creation per driver and day (RF01, HU-06).
- Load the Ibagué road network from OpenStreetMap into Neo4j and calculate paths with Dijkstra (RF15).
- Route optimization from the driver's starting point, within 10 seconds (RF06, RNF01, HU-07, HU-08), with nearest neighbor plus 2-opt and metrics stored in `route_optimizations`.
- Keep working with the last available data when the map service is down (RNF08).

## Phase 3 — Plans, credits and payments

As built:
- Plans, pay-per-use rates, credit packages and add-on modules (RF18, RF22, HU-22).
- Credit balance, consumption per successful optimization and monthly reset (RF20, HU-16).
- Credit package purchases (RF21, HU-17, HU-18).
- Plan subscription and online payment with Wompi (RF28, HU-33).
- Pay-per-use: card registration, accumulated charges and spending limit (RF29, RF30, RF31, HU-37, HU-38, HU-39).
- Blocking rules when the Free Trial ends, a plan expires or a charge is rejected (RF19).
- No card data is stored; only the gateway reference (RNF11).

Endpoints:
- Platform Administrator: `GET/POST/PATCH /api/v1/platform/plans`, `/modules` and `/credit-packages`.
- Company Administrator: `GET /api/v1/company/billing`, `/billing/offerings`, `/billing/usage`, `/billing/transactions`, `/billing/payments`, `/billing/usage-charges`; `POST /billing/subscription`, `/billing/credits/purchase`, `/billing/modules/purchase`, `/billing/pay-per-use/setup`, `/billing/pay-per-use/card`; `PATCH /billing/spending-limit`.
- Public Wompi: `POST /api/v1/payments/wompi/events` and `POST /api/v1/payments/wompi/card` (signed setup token).

## Phase 4 — Driver mobile app

Scope:
- View the assigned route and its stops (RF09, HU-13, HU-14).
- Start and end the route (RF24, HU-30).
- GPS location every 5 seconds and complete GPS trail (RF13, RNF02, HU-36).
- Arrival detection by geofencing, with manual marking (RF14, HU-15).
- Delivery or pickup confirmation with at least one photo uploaded to Cloudinary (RF10, RF16, HU-15).
- Offline mode with automatic synchronization (RF17, RNF07, HU-36).
- Simple interface for non-technical users (RNF10).

As built:
- Driver endpoints under `/api/v1/routes/driver/*`: today's route, route detail, start, finish, location batches, geofence or manual arrival, signed Cloudinary evidence and stop completion with at least one photo (backend rejects fewer).
- The driver can only operate their own route, only one route can be in progress at a time, and starting a route requires an active subscription or trial.
- The geofence radius is a provisional 100 m on both backend and mobile `[TO BE DEFINED]`; it must be validated with field tests. Outside that radius the driver can still mark the arrival manually.
- The mobile app requests foreground location permission, sends a GPS sample every 5 seconds and keeps the full trail in `route_locations`.
- When the API is unreachable, start, finish, arrival, completion and location actions are stored in the on-device SQLite queue and retried every 15 seconds, when the app returns to the foreground and on demand. Evidence photos are kept locally and uploaded on synchronization.
- The last route is cached in SQLite so the driver can still see it offline.

## Phase 5 — Real-time tracking, incidents and reassignment

Scope:
- Live driver locations and route status on the map (RF08, HU-09, HU-10).
- Incidents and questions, with driver–supervisor chat (RF25, HU-11, HU-31).
- Order and route reassignment (RF07, HU-10).

As built:
- Socket.IO runs on the same HTTP server as the API. Connections authenticate with the access token, and each socket joins a company room and a user room. The backend emits `route:status`, `route:location`, `route:stop-status`, `route:reassigned`, `route:stop-reassigned`, `incident:created`, `incident:updated` and `incident:message`.
- Web route detail shows the driver marker with the latest location and updates it in real time. Supervisors and Company Administrators can reassign the whole route or a single stop to an active driver of the same company.
- The mobile incidents tab lets a driver report an incident or question on an in-progress route, optionally attached to a stop, and chat with the office. Reassignment events refresh the driver's route.
- `GET /api/v1/routes/:id/locations/latest` returns the last GPS sample for the initial map position.
- Reassignment rules: the target driver must be active and not `unavailable`; an in-progress route cannot move to a driver who already has another route in progress; reassigning the whole route frees the previous driver; a reassigned stop moves to the target driver's active route for the same date, or to a new `created` route. Completed stops cannot be reassigned.
- A driver can only read their own incidents. The office reply moves an `open` incident to `in_progress`, and a `resolved` incident rejects new messages.
- The live map relies on `route_locations` samples sent every 5 seconds by the mobile app; no additional polling is used.
- Live location and chat use the Socket.IO Redis adapter (`@socket.io/redis-adapter`) with the `fastrouteco:socket.io` key prefix, so rooms and events are shared across backend instances. This closed the earlier in-memory adapter deviation before Phase 7 (deployment).

## Phase 6 — Reports, support and school transport

Scope:
- Reports and dashboard (RF11, HU-05, HU-12, HU-35).
- Technical support requests and platform failure and alert history (RF26, HU-02, HU-03, HU-34).
- System settings (HU-23).
- School transport module: students and pickup points (RF12, HU-32).

As built:
- Company dashboards and the monthly report are computed from routes, stops, GPS samples and credit transactions. Company Administrators see company-wide indicators; supervisors see route-level reports for the logistics report (HU-12, HU-35).
- `GET /api/v1/company/reports/dashboard`, `GET /api/v1/company/reports/summary` and `GET /api/v1/company/reports/routes`; reports are limited to 366 days and can be filtered by branch.
- Technical support: Company Administrators create and list requests; Platform Administrators answer, close and generate notifications plus email. `GET/POST /api/v1/company/support` and `GET /api/v1/platform/support`, `POST /api/v1/platform/support/:id/respond`, `POST /api/v1/platform/support/:id/close` (HU-03, HU-34).
- Platform monitoring: aggregated company, subscription, operation, support and alert indicators, with alert history and resolution (`GET /api/v1/platform/monitoring`, `GET /api/v1/platform/alerts`, `POST /api/v1/platform/alerts/:id/resolve`). Unhandled API 5xx errors are recorded as critical alerts (HU-02).
- System settings: editable invitation expiry, refresh token days, access token minutes, minimum password length and bcrypt cost, bounded by safe minimums and maximums. Changes apply without restarting the API (HU-23).
- School transport: students with automatic pickup geocoding, activation/deactivation without deleting history, and inclusion as route stops. The module is included in Free Trial and Premium, purchased separately in Pro and pay-per-use, and not available in Basic (HU-32, RF12).

## Phase 7 - Deployment

Scope:
- Hosting, production stack and deployment steps (RNF03, RNF05, RNF06).

As built:
- Hosting: one AWS EC2 ARM64 (Graviton) `t4g.medium` instance with 2 vCPU, 4 GB RAM, Ubuntu LTS ARM64, a 30 GB disk and a 4 GB swap file. Free plan with credits (up to 200 USD for 6 months); budget 0 USD, at most about 10 USD per month.
- `docker-compose.prod.yml` runs PostgreSQL, Redis, Neo4j with APOC, Nominatim (Tolima extract) and the backend on an internal network; only Caddy publishes ports 80 and 443.
- `backend/Dockerfile` is a multi-stage Node 22 Alpine image that applies Prisma migrations on start. `web/Dockerfile` builds the Vite panel and serves it from Caddy.
- Caddy provides automatic HTTPS for `DOMAIN`, proxies `/api/*` and `/socket.io/*` to the backend, serves the SPA with an `index.html` fallback and adds security headers.
- Production environment examples without real values: `production.env.example`, `backend/production.env.example`, `web/production.env.example` and `mobile/production.env.example`. Real `production.env` files are ignored by Git.
- ARM64 manifests verified with `docker buildx imagetools inspect` for `node:22-alpine`, `postgres:16-alpine`, `redis:7-alpine`, `neo4j:5-community`, `mediagis/nominatim:5.3` and `caddy:2-alpine`. Build images on the ARM VM so Prisma uses the native engine.
- Memory tuned for the 4 GB instance: Neo4j heap 256-512 MB and page cache 512 MB, Nominatim with one import thread and smaller PostgreSQL buffers, PostgreSQL 128 MB shared buffers, Redis capped at 128 MB and Node heap capped at 384 MB. The README documents the expected consumption per service and the Nominatim import peak.
- `scripts/backup-postgres.sh` writes a daily compressed `pg_dump` and keeps the last 7 files; the README includes the cron entry and restore command.
- README deployment section in English: first deployment, migrations, seed, road-network import, backups, updates and mobile release builds.
- Pending external to the repository: VM and domain creation, production Wompi, Resend and Cloudinary credentials, production map tile provider, and Android/iOS builds with EAS.
