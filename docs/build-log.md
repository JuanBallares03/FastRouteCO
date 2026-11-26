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
| 2026-11-13 | Backend | Configurable Nominatim URL with public development default, identifying user agent, Colombia-only results, cache and one request per second (HU-28, RF15) | `158fc0f` |
| 2026-11-13 | Fix | Orders with an address not found on the map are rejected with `ADDRESS_NOT_FOUND` and not stored without coordinates (HU-28 R01) | `260a280` |
| 2026-11-13 | Backend | Re-geocode command for existing orders without coordinates (HU-28, RF15) | `9ec0dd0` |
| 2026-11-24 | Mobile | Notification permission requested on route start, persistent notice when denied and clearer tracking notification text (RF13, RF24, RNF10) | `dedf94c`, `76f0844`, `93a90e2` |


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
- On Android 13+ the tracking notification only appears with `POST_NOTIFICATIONS`. The `expo-location` config plugin already declares it in the manifest; the app asks for it at runtime with `PermissionsAndroid` and a Spanish explanation when the driver taps "Iniciar ruta", after the location permission. The route starts whatever the answer. On Android 12 and lower and on iOS no request is made. If it is denied, "Mi ruta" shows a persistent notice while the route is in progress, explaining that the location is still recorded, with an "Abrir ajustes" button; the permission is checked again when the app returns to the foreground. Notifications turned off by hand in the system settings are not detected. No native rebuild is needed (RF13, RF24, RNF10).
- Tracking notification text: title "FastRouteCO está registrando tu recorrido", body "Tu ubicación se registra mientras la ruta del día está en curso. Se detiene al finalizar la ruta."
- When the API is unreachable, start, finish, arrival, completion and location actions are stored in the on-device SQLite queue and retried every 15 seconds, when the app returns to the foreground and on demand. Evidence photos are kept locally and uploaded on synchronization.
- The last route is cached in SQLite so the driver can still see it offline.
- The driver route screen offers Lista and Mapa views while keeping the three bottom tabs. The map shows the numbered stops in optimized order and the driver's current location, using the style from `EXPO_PUBLIC_MAP_STYLE_URL` (OpenFreeMap only in development). When offline or when the map cannot load, the app shows the stop list with a Spanish notice (CU-32, RF09, RNF08, RNF10).
- The map component already accepts route geometry and draws it when present. The backend does not return it yet: it must calculate the Dijkstra geometry over the Ibagué road network, pending the road-network import `[TO BE DEFINED]`.

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

## Invitation delivery feedback

Scope:
- Make failed invitation emails visible and keep the account usable through the invitation link (HU-19, HU-25, HU-27, RF27).

As built:
- Company Administrator, supervisor and driver creation responses include `emailSent` and `invitationUrl`. The invitation URL is built from `WEB_APP_URL`, and `docker-compose.prod.yml` sets it to `https://${DOMAIN}`.
- `POST /api/v1/auth/resend-invitation/:userId` returns `emailSent` and `invitationUrl`, and its message differs when the email could not be sent. Permissions are unchanged: a Platform Administrator can resend to anyone, and a Company Administrator only to supervisors and drivers of their own company.
- The web shows the current success message when `emailSent` is `true`. Otherwise it shows "No pudimos enviar el correo. Comparte este enlace con la persona:", the invitation link and a "Copiar enlace" button.
- Company Administrator, supervisor and driver lists include `hasActivated` and offer "Reenviar invitación" only while the account has no password.

## Supervisor panel fixes

Scope:
- Load the supervisor dashboard and expose the Phase 5 live map and incidents to the Logistics Supervisor and the Company Administrator (RF08, RF25, HU-12).

As built:
- `GET /api/v1/company/reports/dashboard` returned 403 for supervisors because the billing router applied `company_admin` authorization to every `/api/v1/company/*` request. Authentication and authorization are now scoped to `/billing`, and a regression test covers supervisor, Company Administrator and driver access.
- The supervisor menu connects "Mapa en vivo" and "Incidencias" to real pages backed by the Phase 5 APIs. The Company Administrator sees the same two entries under `/company/live-map` and `/company/incidents`.
- The live map lists in-progress routes, draws their stops and driver locations on one map, and updates with `route:location` and route status events. The incidents page lists and filters company incidents, marks them resolved, and links to the route detail chat.
- "Cobros y pagos" remains the only "Próximamente" item; the Platform Administrator billing page is not implemented.

## Authenticated API rate limiting

Scope:
- Rate-limit every authenticated `/api/v1` request per user and per IP (RNF04, RNF06).

As built:
- A shared middleware built on the existing Redis rate-limit store applies a generous limit to requests with a bearer token: 1200 requests per 15 minutes per user and 2400 per 15 minutes per IP. Requests without a bearer token keep their route-specific limits (login, refresh and invitations), and Socket.IO is outside `/api/v1`.
- The limit allows the mobile GPS sample every 5 seconds and normal panel polling. Exceeding it returns 429 with the existing Spanish message and `RATE_LIMITED` code.

## Driver route refresh

Scope:
- Keep the driver's "Mi ruta" tab up to date when the Logistics Supervisor changes the route of the day (RF07, RF09).

As built:
- The backend emits the targeted event `driver:route-updated` to the `user:<driverId>` room after the database change is committed. The payload only carries `routeId` and a reason (`created`, `assigned`, `updated`, `optimized`, `reassigned`, `stop-reassigned` or `cancelled`). Reassigning a route or a stop notifies both the previous and the new driver.
- The mobile app connects to Socket.IO and joins its user room while the driver is signed in, even when there is no route or it is not in progress. It reloads the route when the event arrives, when the app returns to the foreground and on pull-to-refresh, available with or without a route.
- Simultaneous triggers are grouped into one request. If the reload fails, the cached route is kept and the offline notice is shown. When the server no longer returns the route (deleted or reassigned) but there are pending offline actions, the app keeps the local route and warns the driver instead of discarding those actions. If the queued actions belong to that route and the driver endpoint answers 404, the warning says they can no longer sync and asks the driver to contact the supervisor; otherwise it asks the driver to sync.
- `mergeRouteUpdate` keeps locally arrived or completed stops, their evidence photos and notes only for stops still present in the server response and only while an arrival or completion for that stop is still queued. Once the action syncs or is dropped, the server state wins. GPS tracking is not restarted because it depends on the route id and status, not on the route object.
- After flushing the offline queue, the screen reloads the route when actions synced and also when actions were dropped, then shows the sync result.
- Tests cover backend emission to the correct drivers and mobile reload on event, foreground and pull, concurrent grouping, cache preservation and stop merging.

## Live map driver location

Scope:
- Show the driver of an in-progress route on "Mapa en vivo" as soon as the route starts, as the route detail does (RF08, RF13).

As built:
- Starting a route with coordinates stores the start position as a `route_locations` row in the same transaction that sets the route in progress, so `GET /routes/:id/locations/latest` returns it before the first GPS sample (`1dca016`).
- `POST /routes/driver/:id/start` accepts an optional `capturedAt`. When present it is used for both `routes.started_at` and the start trail point, so a start synced from the offline queue keeps its real time; when absent both use the server time.
- `capturedAt` validation (`424b10b`): only a non-empty ISO date string is accepted, so `null` or an empty value returns 400 instead of being read as 1970-01-01. A time before 00:00 of the route date in America/Bogota returns 400 with `INVALID_START_TIME`. A time more than 2 minutes ahead of the server (`START_CLOCK_SKEW_MS`, phone clock skew) returns 400. In every rejected case the route is not started and no trail point is stored.
- A GPS sample with the same `capturedAt` as the start point is skipped by the existing duplicate check, and repeating the start of an in-progress route does not add a row.
- The web live map and route detail merge fetched and socket positions with the shared helpers in `web/src/lib/route-location.ts`: the newest position by `capturedAt` wins, socket batches use their newest point, and the live map drops routes that are no longer in progress (`f342c47`, `3a48fbe`).

Resolved in the offline queue branch (`5e1f96c`, see "Offline queue errors"):
- The queued `start` action did not carry a time. It now stores the time the driver tapped start and sends it as `capturedAt` in ISO format; starts stored before the change use the queue `created_at`.

## Offline queue errors

Scope:
- Queue only real network errors, keep permanent rejections on the phone without blocking the queue, keep GPS samples flowing, and keep offline actions when the session expires (RF13, RF16, RF17, RNF07, HU-36).

As built:
- Backend: `createEvidenceSignature` answers 503 `EVIDENCE_STORAGE_NOT_CONFIGURED` when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` or `CLOUDINARY_API_SECRET` is empty, instead of signing with empty values (`4c51258`).
- The route screen queues start, arrival, delivery and finish only when the request got no response (axios without response or a failed upload `fetch`). Any other error is shown with its real message; Cloudinary rejections read "Cloudinary rechazó la foto: …" (`6672d1d`).
- SQLite schema version 1 (`PRAGMA user_version`) adds to `offline_queue` the lane (`kind`), `status` (`pending` or `rejected`), `rejected_at`, `reject_reason`, `reject_code`, `reject_status`, `reported_at` and `owner_user_id`, an owner on `route_cache` and the `offline_meta` table. ADD COLUMN with constant defaults keeps stored actions pending; the GPS lane of existing rows is filled in JS in the same transaction, and a failed step leaves version 0 so it runs again (`1206c49`).
- Error classification during sync: no response is `network`; 401, 408, 429 and 5xx (also from Cloudinary) are temporary and keep the action pending; 403 and other 4xx, Cloudinary 4xx, a missing photo or an unknown error are `rejected`; `STOP_ALREADY_COMPLETED` counts as synced. Rejected actions keep their photos and reason and no longer block the queue (`8fe84cf`).
- Fixed while rewriting the queue: actions stored by `enqueueAction` had no id in their payload, so the flush skipped them and they never synced. The store now reads the id from the row.
- GPS batches run in their own lane. Actions keep strict FIFO order and stop at the first network or temporary error; GPS batches still sync. Batches of a route whose start is still pending wait for it, and a finish first sends the batches of its route captured before it (`8388558`).
- "Mi ruta" shows a persistent notice with the number of rejected actions and a "Ver detalle" modal: one row per action (GPS grouped per route) with its time, the real reason and "Reintentar". The driver cannot delete rejected actions (`07d6662`).
- Session handling (`b7dcc86`): an expired session (failed refresh, or 401/403 from `/auth/me` on start) stops tracking and clears the tokens but keeps the queue and photos, with the notice "Tu sesión venció. Inicia sesión de nuevo para enviar las acciones pendientes." Each row stores the driver who created it and `offline_meta.current_owner` keeps the signed-in driver, so queue, counts, rejected list and route cache only see that driver's rows, and nothing is sent without a session. Rows stored before owners existed are adopted by the driver who signs in. When another driver signs in, the previous driver's tracking stops and the cached route is removed; the previous driver's actions stay hidden and unsent until that driver signs in again.
- Manual sign-out asks for confirmation with the number of pending and rejected actions that would be lost, then removes only the current driver's rows, photos and cached route (`c92c9b2`).

Fixes after the manual test:
- One rejected notice: the sync error counted queue rows (a GPS trail of 20 batches read "20 acciones") next to the persistent notice that counted the grouped rows of the detail. Rejections now appear only in the persistent notice, whose text comes from the grouped rows: one row names the action and its reason, several rows give the count (`6eab4e2`).
- Tracking kept recording a closed route for two reasons:
  - The pending summary counted GPS rows as local changes. A route the server no longer returned stayed on screen as in progress, so its tracking kept adding the rows that kept it there. The summary now counts only actions, and a route kept only for its pending actions (`isRouteStale`) is not tracked (`653b5e1`).
  - The background task records for the stored active route until the route screen loads. A route finished or reassigned on the panel with the app closed kept being tracked. The flush now reports `closedRouteIds` (GPS refused with `ROUTE_NOT_IN_PROGRESS` or `ROUTE_NOT_FOUND`), and the task stops the service when the active route is among them (`352e0e6`).
- GPS points refused with `ROUTE_NOT_IN_PROGRESS` or `ROUTE_NOT_FOUND` are dropped instead of kept as rejected, because a retry can never succeed; GPS rows already rejected with those codes are removed on the next flush. Only the code decides: a 404 with another code or none stays rejected, and actions and evidence are never discarded on their own (`7c1dace`).

Prepared for the reassignment branch:
- `getRejectedActions()` returns each rejected action with its type, route, stop, times, reason, backend `code`, HTTP or Cloudinary `status` and `reportedAt`; `offline_queue.reported_at` is reserved to mark when the supervisor was notified.

Pending:
- `[TO BE DEFINED]` How long the actions of a driver who never signs in again on the same phone are kept. Proposal: the supervisor decides in the reassignment branch.
- A phone clock more than 2 minutes ahead makes the backend reject the offline start (`capturedAt` in the future); the start is shown as rejected with its reason, and there is no automatic retry without `capturedAt`.
- The route cache is saved only after a successful refresh, so a finish done offline is not in it. Opening the app offline shows the cached route as in progress and tracking starts again. Its points are dropped once the server closes the route, but the cache should keep local changes.


## Pending decisions — reassignment and overdue routes

Decided on 2026-11-22 after the manual test of the driver route refresh. Each one will be built in its own branch.

Reassigning an in-progress route (RF07, HU-10 CA03, HU-36 CA04 and CA05), built in "Reassignment pending actions" below:
- Reassigning a route that is already in progress stays allowed, as RF07 and HU-10 CA03 require.
- The mobile app must not discard the previous driver's offline actions when the server rejects them because the route was reassigned. It keeps them as rejected and creates a notice or incident for the supervisor, so no delivery evidence is lost silently.
- The web panel warns before reassigning an in-progress route when the driver's last sync is old.

Undelivered orders and overdue routes (RF07, HU-10, HU-36):
- Handling is manual. The panel marks overdue routes (past date and not completed or cancelled), and the supervisor decides for each order whether to reassign it, cancel it or return it to pending.
- Routes from past days are excluded from the `pendingStops` count used to suggest the most suitable driver.

## Reassignment pending actions

Built on 2026-11-24 for issue #26 (RF07, HU-10 CA03, HU-36 CA04 and CA05).

As built:
- Data model:
  - `route_reassignments` stores every route and stop reassignment with the previous and new driver, the target route and who reassigned it.
  - `route_sync_rejections` and `route_sync_rejection_photos` store the reports (`b695e79`, migration `20261125010959_add_route_sync_rejections`).
  - Foreign keys to `routes` are `ON DELETE RESTRICT`. `cancelOrder` cancels, instead of deleting, an emptied route that has history or reports (`4dbaa80`, `64f003f`, `becfff4`).
- `POST /routes/driver/sync-rejections` and `POST /routes/driver/sync-rejections/evidence-signature` accept a report only when the driver had the route:
  1. their own route, already closed;
  2. a whole-route reassignment away from them (`stop_id IS NULL` and `target_route_id = route_id`);
  3. a reassignment of that stop.
  Any other driver gets 404 `ROUTE_NOT_FOUND`; their own route still in progress gets 409 `SYNC_REJECTION_NOT_APPLICABLE`. Reports are idempotent per driver and queue row id. Photos go to the stop folder `.../pending` and must come from it (`c1bc7b4`).
- `GET /routes/:id/sync-rejections`, `PATCH /routes/:id/sync-rejections/:rejectionId/review`, `pendingSyncRejections` in `GET /routes`, and the events `route:sync-rejected` and `route:sync-rejection-reviewed` (`dbabc73`).
- `GET /routes/:id` returns `lastSyncedAt`, the latest `route_locations.synced_at`: the server receive time, not the capture time (`8587015`).
- Mobile reporting (`c1e90fa`):
  - After each flush with a session, the app reports actions rejected with `ROUTE_NOT_FOUND`, `ROUTE_NOT_IN_PROGRESS` or `STOP_NOT_FOUND`, uploads the photos of a rejected delivery as pending evidence and sets `offline_queue.reported_at`.
  - The rows and photos stay on the phone, and the detail shows "Informado al supervisor".
  - A refused report is not retried until the app restarts.
- Panel:
  - "Acciones no sincronizadas" on the route detail with "Marcar revisada", and a badge in the route list (`5e4fd5b`).
  - "Última sincronización del conductor", and a confirmation before reassigning a route in progress whose last sync is older than 5 minutes or missing (`0cc089f`).

Decisions:
- The stale-sync threshold is 5 minutes (about 60 missed GPS samples), a constant in `web/src/lib/sync-status.ts`.
- A report never completes the stop: the supervisor decides by hand.

Pending:
- Reassignments made before migration `20261125010959_add_route_sync_rejections` have no history, so reports about them are refused.
- A report about a stop deleted by `cancelOrder` is refused, because the stop no longer exists.
- `reassignStop` refuses to move a stop to a driver who already has another route in progress (`DRIVER_HAS_ACTIVE_ROUTE`); unchanged.

## Pull request workflow

Added on 2026-11-24.

As built:
- `.github/pull_request_template.md`: summary with HU/RF/RNF/CU traceability, changes grouped by Backend, Web, Mobile and Docs, verification checklist (lint/typecheck/tests, build, manual test), out of scope / pending and `Closes #` (`0d3240d`).
- `.github/ISSUE_TEMPLATE/`: `bug_report.yml` and `task.yml` issue forms with a required traceability field; blank issues are disabled (`af49afa`). The forms use the `bug` and `task` labels, which must exist in the repository to be applied.

Required status checks:
- Required checks once stayed in "Expected" on pull requests not targeting `main` because CI and Secret Scanning had a `pull_request` base-branch filter; it was removed in `20244f0`. No workflow has `paths` filters, so every pull request, including docs-only ones, reports all checks.
- Rule: never add `paths`, `paths-ignore` or base-branch filters to the `pull_request` trigger of a workflow that produces a required check. A skipped workflow never reports a status and blocks the merge. If a job must skip work, it has to run and decide inside its steps.
- Required checks on `main`: `test`, `web`, `mobile`, `audit` (CI), `Analyze JavaScript/TypeScript` (CodeQL), `gitleaks` (Secret Scanning) and `dependency-review`, all with source GitHub Actions. Renaming a job changes its check name, so the branch protection must be updated in the same change.

## Local Docker memory limits

Added on 2026-11-25. Development tooling only; no HU/RF change. `docker-compose.prod.yml` is unchanged.

As built:
- Neo4j exited with code 137 (out of memory) under Docker Desktop limited to 4 GB by `.wslconfig`, because heap and page cache were sized by Neo4j's startup heuristics.
- `docker-compose.yml` sets `mem_limit` on every service: PostgreSQL 512m, Redis 256m, Neo4j 1280m, Nominatim 2g (`8554184`).
- Neo4j: heap 512m (initial = max, as the Neo4j 5 memory guide recommends), page cache 256m, transaction total max 256m. The Ibagué road network (88,931 intersections, 175,910 segments) needs well under 100 MB of store. Measured idle usage after start: about 880 MiB of 1.25 GiB.
- Nominatim: `THREADS` 2, `shared_buffers` 256MB, `maintenance_work_mem` 512MB, `work_mem` 16MB, `effective_cache_size` 512MB, `shm_size` 512m.
- README "Windows: Docker Desktop memory (WSL 2)" documents `.wslconfig` (`memory=4GB`, `swap=4GB`) and the memory budget (`83404e0`).

Pending:
- The Nominatim import has not been rerun with the lower settings; run it with Neo4j stopped.
