# FastRouteCO — Deployment and Delivery Plan

Instructions for the coding agent (OpenCode) and the team to deploy FastRouteCO and deliver it for evaluation.

## 1. Target

| Item | Decision |
|---|---|
| Cloud provider | AWS (university requirement: AWS, Google Cloud or Azure) |
| Budget | AWS Free plan credits (up to 200 USD, 6 months). Team budget: 0 USD, at most about 10 USD per month |
| Server | One EC2 ARM64 (Graviton) instance with 4 GB of RAM, type t4g.medium |
| Runtime | Docker Compose with backend, PostgreSQL, Redis, Neo4j + APOC and Nominatim (Tolima extract) |
| Web panel | Served from the same instance by a reverse proxy with automatic HTTPS |
| Mobile app | Android build with EAS Build. iOS is [TO BE DEFINED] (requires a paid Apple developer account) |
| Production map provider | [TO BE DEFINED] |

Important: the AWS Free plan closes the account after 6 months or when the credits run out, and data is deleted 90 days later. Create the AWS account only when the deployment is ready, and keep backups outside AWS.

## 2. Preconditions (before deploying)

- [ ] `docs/audit/code-audit-report.md` has no open Critical or High findings.
- [ ] Lint, typecheck, test and build green in backend, web and mobile.
- [ ] CI green on `main`.
- [ ] Every [TO BE DEFINED] item that blocks production is decided, or documented as a known limitation.

## 3. Work inside the repository (OpenCode)

1. **Production Docker Compose** (`docker-compose.prod.yml`):
   - All images available for `linux/arm64`. Verify each one, especially Nominatim and Neo4j.
   - Memory limits so everything fits in 4 GB. Starting budget, to be validated on the server:

     | Service | Memory limit |
     |---|---|
     | PostgreSQL | 768 MB |
     | Neo4j (heap + page cache) | 1.2 GB |
     | Nominatim (Tolima) | 1 GB |
     | Backend | 512 MB |
     | Redis | 128 MB |
     | Reverse proxy | 64 MB |

   - `restart: unless-stopped` on every service and health checks.
   - Only the reverse proxy publishes ports (80 and 443). Databases are never exposed.
   - Log rotation for every container.
2. **Reverse proxy configuration:** HTTPS for the domain, web panel as static files, `/api` and Socket.IO routed to the backend.
3. **Production environment examples:** `.env.production.example` for each app, without real values.
4. **Backups:** script that runs `pg_dump` daily on the server and keeps the last 7 copies. Neo4j is rebuilt from OpenStreetMap, so it does not need backups.
5. **Deployment guide:** add a "Deployment" section to the README, in English, with the steps in section 4.

Commits: one per item, for example `chore(deploy): add production docker compose`.

## 4. Server setup (team, with OpenCode guidance)

1. Create the AWS account and set a **budget alert** (for example at 10, 50 and 150 USD of credits used).
2. Create the t4g.medium instance with Ubuntu LTS (ARM64), a 30 GB disk and an SSH key.
3. Security group: SSH (22) only from the team's IP, HTTP (80) and HTTPS (443) open. Nothing else.
4. Add a 4 GB swap file (needed for the Nominatim import).
5. Install Docker and the Docker Compose plugin. Enable automatic security updates.
6. Point the domain DNS to the instance IP.
7. Copy the production `.env` files to the server (`chmod 600`). Never commit them.
8. Start the services, run `prisma migrate deploy`, load the Ibagué road network into Neo4j, import the Tolima extract into Nominatim and run `pnpm db:seed:admin` to create the first Platform Administrator. Do not run the demo seed in production.
9. Configure the daily backup and copy backups outside AWS regularly.

## 5. External services

| Service | Production requirement |
|---|---|
| Resend | Verified domain (in development it only delivers to the account email) |
| Wompi | Production keys and webhook URL pointing to the deployed backend |
| Cloudinary | Production account and keys |
| Map tiles | Provider [TO BE DEFINED] (OpenFreeMap is only for development) |
| EAS Build | Expo account; Android build with the production API URL |

## 6. Smoke tests after deployment

- [ ] Platform Administrator: log in, register a company, invite its Company Administrator.
- [ ] Company Administrator: accept the invitation, create a branch, a supervisor and a driver.
- [ ] Logistics Supervisor: register orders, create a route, optimize it (under 10 s, RNF01), see the driver on the live map.
- [ ] Driver (Android app): log in, start the route, arrival by geofence, delivery with photo, offline mode and sync, end the route.
- [ ] Incident with chat between driver and supervisor.
- [ ] Payment in Wompi sandbox: plan purchase and credit package.
- [ ] Support request answered by the Platform Administrator, with email notification.
- [ ] HTTPS valid, no database ports reachable from the internet.

## 7. Rollback

- Tag every deployed version (`v1.0.0`, `v1.0.1`, ...).
- To roll back: deploy the previous tag and, if the database changed, restore the last backup.

## 8. Delivery

- [ ] Git tag `v1.0.0` and a GitHub release with the Android APK.
- [ ] README updated: description, architecture, setup, deployment and test accounts.
- [ ] Public URL of the web panel and test accounts for each role (created for the evaluation, not real data).
- [ ] Documentation in the repository: user stories, data model, use case diagrams, component diagram, build plan and audit report.
- [ ] Known limitations: [TO BE DEFINED] items, iOS build and the 6-month hosting period.

## 9. Rules for OpenCode

- Work only inside the repository. Do not create cloud accounts or resources and do not use real keys.
- Stop and ask when you need the server, the domain, production keys, the map provider or the EAS account.
- Never read `.env` files. Never push.
- Save tokens: short progress messages, only failures in command output.
