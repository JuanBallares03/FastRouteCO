# FastRouteCO — Deployment and Delivery Plan

Instructions for the coding agent (OpenCode) and the team to deploy FastRouteCO and deliver it for evaluation.

## 1. Target

| Item | Decision |
|---|---|
| Cloud provider | Azure for Students (university requirement: AWS, Google Cloud or Azure) |
| Budget | 49 USD of credit, no credit card, expiring on 2027-02-27. The VM is stopped and deallocated when it is not in use |
| Server | One Azure `Standard_B2pls_v2` ARM64 VM: 2 vCPU, 4 GB of RAM, Ubuntu 24.04 LTS ARM64, 30 GB disk |
| Domain | `<public-ip>.sslip.io` with automatic HTTPS in Caddy; no domain purchase |
| Runtime | Docker Compose with backend, PostgreSQL, Redis, Neo4j + APOC and Nominatim (Tolima extract) |
| Web panel | Served from the same VM by Caddy with automatic HTTPS |
| Mobile app | Android build with EAS Build. iOS is [TO BE DEFINED] (requires a paid Apple developer account) |
| Production map provider | [TO BE DEFINED] |

Important: Azure for Students includes 750 free hours per month of `B1s`, `B2pts_v2` and `B2ats_v2` for new customers during the first 12 months, but the last two have only 1 GB of RAM, so they cannot run this stack. The 4 GB VM is not part of that allowance and is paid from the 49 USD credit. The credit expires on 2027-02-27 and any unused balance is lost, so monitor Cost Management and stop and deallocate the VM when it is not in use. Keep backups outside Azure.

### 1.1 Cost estimate and credit duration

List prices from the Azure Retail Prices API for East US, Linux, on 2026-11-15. They are conservative: student free allowances, taxes or a different region can change them.

| Item | Assumption | Monthly cost |
|---|---|---:|
| `Standard_B2pls_v2` VM | 730 hours running | 24.53 USD |
| Static public IP | Standard SKU, IPv4, 730 hours | 3.65 USD |
| OS disk | 30 GB, billed as Standard SSD E4 32 GiB LRS | 4.48 USD |
| **Total** | **VM running 24/7** | **32.66 USD** |

- The static public IP and the disk keep billing while the VM is deallocated: about **8.13 USD per month**. Only the compute part stops.
- Releasing the static public IP stops its charge, but `<public-ip>.sslip.io` changes and Caddy must issue a new certificate.
- If the account still has the 12-month student allowance for managed disks (P6 64 GiB Premium SSD), the disk line may be covered; check **Cost Management**. This estimate assumes no allowance to stay conservative.
- Outbound bandwidth includes 100 GB per month; excess traffic is billed separately.

Credit duration, using the same prices and 8-hour demo days:

| Demo days per week | Demo hours per month | Compute | Fixed IP + disk | Total per month | Credit lasts |
|---|---:|---:|---:|---:|---|
| 1 | 35 | 1.17 USD | 8.13 USD | 9.30 USD | About 160 days |
| 2 | 69 | 2.33 USD | 8.13 USD | 10.46 USD | About 142 days |
| 3 | 104 | 3.50 USD | 8.13 USD | 11.63 USD | About 128 days |
| 7 (24/7) | 730 | 24.53 USD | 8.13 USD | 32.66 USD | About 46 days |

- Running 24/7, the 49 USD run out after about 46 days, around 2026-12-30.
- With demo-only use (1-3 days per week, 8 hours each) the credit lasts beyond the 2027-02-27 expiry, with about 9-17 USD left unused. The expiry date is the real limit.
- Formula for other schedules: `monthly cost = 8.13 + 0.0336 × demo hours per month`. One demo day of 8 hours adds about 0.27 USD.
- Check the real balance in **Cost Management + Billing → Credits** and keep a reminder for 2027-02-27.

## 2. Preconditions (before deploying)

- [ ] Azure for Students subscription active, with the 49 USD credit visible in Cost Management and expiring on 2027-02-27.
- [ ] `docs/audit/code-audit-report.md` has no open Critical or High findings.
- [ ] Lint, typecheck, test and build green in backend, web and mobile.
- [ ] CI green on `main`.
- [ ] Every [TO BE DEFINED] item that blocks production is decided, or documented as a known limitation.

## 3. Work inside the repository (OpenCode)

1. **Production Docker Compose** (`docker-compose.prod.yml`):
   - All images publish `linux/arm64` (the chosen architecture) and `linux/amd64`. Verify each one with `docker buildx imagetools inspect`, especially Nominatim and Neo4j, before switching architecture or region.
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
2. **Reverse proxy configuration:** HTTPS for `<public-ip>.sslip.io`, web panel as static files, `/api` and Socket.IO routed to the backend.
3. **Production environment examples:** `.env.production.example` for each app, without real values.
4. **Backups:** script that runs `pg_dump` daily on the server and keeps the last 7 copies. Neo4j is rebuilt from OpenStreetMap, so it does not need backups.
5. **Deployment guide:** add a "Deployment" section to the README, in English, with the steps in section 4.

Commits: one per item, for example `chore(deploy): add production docker compose`.

## 4. Azure setup (team, with OpenCode guidance)

1. **Check the subscription.** Open **Cost Management + Billing** and confirm the Azure for Students subscription is active, the remaining credit is 49 USD (or what is left) and the expiry is 2027-02-27. No credit card is needed.
2. **Create the resource group.** Use `rg-fastrouteco-prod` in East US (or the region chosen in the quota check). Keep every resource in the same region: static public IPs and managed disks are regional.
3. **Create the VM.**
   - Size: `Standard_B2pls_v2` (ARM64, 2 vCPU, 4 GiB of RAM).
   - Image: **Ubuntu Server 24.04 LTS (ARM64)**, generation 2.
   - Authentication: SSH public key. Store the private key outside the repository.
   - OS disk: **30 GiB Standard SSD**. Azure bills the next managed-disk size, E4 32 GiB. Use the Premium SSD P6 64 GiB option only if the student disk allowance covers it.
   - Public IP: create a new **Standard SKU, static IPv4** address and associate it with the VM.
   - Network security group: create it with the rules below.
4. **Network security group.** Inbound rules only:

   | Priority | Name | Port | Protocol | Source | Action |
   |---:|---|---|---|---|---|
   | 100 | SSH | 22 | TCP | your public IP `/32` | Allow |
   | 110 | HTTP | 80 | TCP | Internet | Allow |
   | 120 | HTTPS | 443 | TCP | Internet | Allow |
   | 4096 | DenyAllInbound | Any | Any | Any | Deny |

   Remove any default SSH rule open to the world. Keep the default outbound rule (all traffic) so the VM can pull images and reach Resend, Wompi, Cloudinary and the Overpass API. Never open PostgreSQL (5432), Redis (6379), Neo4j (7474/7687), Nominatim (8080) or the backend (3000).
5. **Static public IP.** Confirm the address is Standard SKU with **Assignment: Static** and that it is associated with the VM NIC. It survives deallocation, so `<public-ip>.sslip.io` stays stable while the VM exists. If the IP is released, the hostname changes and Caddy must issue a new certificate.
6. **Budget alert.** In **Cost Management + Billing → Budgets → Add**:
   - Scope the subscription or the resource group.
   - Monthly amount: **40 USD**.
   - Alerts at **50%, 80% and 100% of actual cost**, plus **100% of forecasted cost**, with your email.
   - A budget sends notifications; it does not stop resources. Deallocate the VM manually or use auto-shutdown.
   - Add a calendar reminder for **2027-02-27**; the credit expires and unused balance is lost.
7. **Stop and deallocate when not in use.** Use **Stop (deallocate)** in the portal or:
   ```bash
   az vm deallocate --resource-group rg-fastrouteco-prod --name fastrouteco-vm
   az vm start --resource-group rg-fastrouteco-prod --name fastrouteco-vm
   ```
   A plain stop that keeps the VM allocated still bills compute. Deallocation releases compute; the OS disk and the static public IP keep billing at about **8.13 USD per month**. For demo-only use, enable **Auto-shutdown** (VM → Operations → Auto-shutdown) at a fixed time in `America/Bogota`.
8. **Swap file.** Create a 4 GB swap file and make it persistent:
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
   sudo sysctl --system
   ```
   Verify with `free -h` and `swapon --show`. The swap absorbs the Nominatim import peak; keep swappiness low so normal operation stays in RAM.
9. **Install Docker and security updates.**
   ```bash
   sudo apt update && sudo apt upgrade -y
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker "$USER"
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure --priority=low unattended-upgrades
   ```
   Log out and back in for the Docker group. Verify with `docker version` and `docker compose version`.
10. **Domain.** The hostname is `<public-ip>.sslip.io` (for example `20.123.45.67.sslip.io`). sslip.io resolves it automatically, so do not create a DNS record and do not buy a domain. Set `DOMAIN=<public-ip>.sslip.io` in `production.env`. Caddy requests the Let's Encrypt certificate automatically on the first HTTPS request; ports 80 and 443 must be open. If the public IP changes, update `DOMAIN` and restart the `web` service.
11. **First deployment.** Copy the production `.env` files to the server (`chmod 600`) and start the services; the backend applies Prisma migrations on start. Then load the Ibagué road network into Neo4j, import the Tolima extract into Nominatim and run `pnpm db:seed:admin` to create the first Platform Administrator. Do not run the demo seed in production.
12. **Backups.** Configure the daily backup and copy backups outside Azure regularly.

### 4.1 Quota fallback for `Standard_B2pls_v2`

Check availability and quota before creating the VM:

```bash
az vm list-skus --location eastus --size Standard_B2pls_v2 --all --output table
az vm list-usage --location eastus --output table
```

If the SKU shows `NotAvailableForSubscription`, or the `standardBpsv2Family` quota is zero:

1. Try another region that offers `Bpsv2`: `eastus2`, `westus3`, `centralus`, `westus2`, `northeurope` or `swedencentral`. On 2026-11-15, `brazilsouth` did not list `Standard_B2pls_v2`. Recreate the resource group, VM, static IP and NSG in that region.
2. If ARM quota is unavailable in every region, use an x64 4 GB B-series size:
   - `Standard_B2als_v2` (AMD, 2 vCPU, 4 GiB): about 27.45 USD per month in East US.
   - `Standard_B2s` (2 vCPU, 4 GiB, older generation, widely available): about 30.37 USD per month in East US.
3. Do not use `Standard_B2pts_v2` or `Standard_B2ats_v2`: they have 1 GiB of RAM and do not meet the 4 GB requirement, even though they are in the free 750-hour allowance.
4. If the quota is zero in the student subscription, request an increase in **Subscriptions → Usage + quotas**. Student subscriptions can be denied; the x64 fallback is faster.
5. Every image also publishes `amd64`, so switching from ARM64 to x64 needs no `docker-compose.prod.yml` change. Rebuild the images on the new VM and update the region and size in this plan and the README.

## 5. External services

| Service | Production requirement |
|---|---|
| Domain | `<public-ip>.sslip.io` from sslip.io; no purchase and no DNS record |
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
- [ ] HTTPS valid for `<public-ip>.sslip.io`, no database ports reachable from the internet.

## 7. Rollback

- Tag every deployed version (`v1.0.0`, `v1.0.1`, ...).
- To roll back: deploy the previous tag and, if the database changed, restore the last backup.

## 8. Delivery

- [ ] Git tag `v1.0.0` and a GitHub release with the Android APK.
- [ ] README updated: description, architecture, setup, deployment and test accounts.
- [ ] Public URL of the web panel (`https://<public-ip>.sslip.io`) and test accounts for each role (created for the evaluation, not real data).
- [ ] Documentation in the repository: user stories, data model, use case diagrams, component diagram, build plan and audit report.
- [ ] Known limitations: [TO BE DEFINED] items, iOS build, the 49 USD credit expiring on 2027-02-27, the need to deallocate the VM when it is not in use, and the sslip.io hostname changing if the public IP is released.

## 9. Rules for OpenCode

- Work only inside the repository. Do not create cloud accounts or resources and do not use real keys.
- Stop and ask when you need the Azure subscription, the VM, the `<public-ip>.sslip.io` hostname, production keys, the map provider or the EAS account.
- Never read `.env` files. Never push.
- Save tokens: short progress messages, only failures in command output.
