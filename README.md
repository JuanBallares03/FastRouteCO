# FastRouteCO

## Introduction

FastRouteCO is an intelligent B2B multi-stop assignment and routing 
system for Colombian companies with their own fleet, with dynamic 
optimization for delivery and pickup routes based on the driver's 
starting point, applicable to any economic sector.

Unlike platforms such as Rappi or DidiFood, which connect businesses 
with independent couriers, FastRouteCO is an internal tool that 
companies use to manage and optimize their own employed drivers 
intelligently and automatically.

The platform includes a web panel for administrators and supervisors 
and a mobile app for drivers. The initial rollout is planned for 
Ibagué, Colombia.

## Problem Statement

Colombian companies with their own fleet manage their delivery and 
pickup routes manually. In many cases, orders are assigned via 
WhatsApp, phone calls or in person, while the driver independently 
decides the order of stops. Additionally, the person in charge of 
operations has no real-time information about driver locations and 
no tools to optimize routes.

Companies also lack performance records for each driver and reliable 
evidence that deliveries were completed.

This situation can lead to higher fuel costs, longer delivery times, 
unnecessary travel and limited visibility over the company's operations.

# System Roles

## 1. Platform Administrator

Responsible for managing FastRouteCO as a platform and for managing 
the companies that use the service. This role belongs to the 
FastRouteCO team. In the user stories it appears as "Admin del sistema".

### Main Functions

- Register and manage companies using FastRouteCO.
- Activate or deactivate companies.
- Create and manage administrators for each company.
- Manage subscription plans, pay-per-use rates, credit packages and 
  add-on modules, including their prices and limits.
- View general information about companies.
- Monitor the platform and review the history of system failures and alerts.
- Respond to support requests from companies.
- Manage general system settings.

## 2. Company Administrator

Responsible for managing a company's account within FastRouteCO 
and viewing general information about its operations. In the user 
stories it appears as "Cliente empresa".

### Main Functions

- View and manage company information and settings.
- Manage the company's branches.
- Manage the company's users (logistics supervisors).
- View the contracted plan, subscription status, and the limits 
  and features included in the plan.
- View the credit balance and usage history.
- Choose the service modality (subscription plan or pay-per-use), 
  contract or change it and pay online.
- In pay-per-use, register a payment card, view consumption and charges, 
  and set an optional monthly spending limit.
- Purchase additional credit packages.
- Purchase add-on modules, such as the school transport module (available as an add-on on the Pro plan and in pay-per-use).
- View logistics reports, indicators and general operation statistics.
- Request technical support.
- Manage general system settings.

The Company Administrator can also perform all Logistics Supervisor 
functions, since smaller companies may not have a dedicated supervisor.

## 3. Logistics Supervisor

Responsible for managing and supervising the company's daily 
logistics operations within FastRouteCO.

### Main Functions

- Register and manage drivers.
- Register orders and delivery or pickup points.
- Create and manage routes.
- Assign orders to drivers.
- Execute route optimization.
- Make changes or reassignments to routes when necessary.
- View driver locations and routes on the map in real time.
- Monitor route status and delivery and pickup completion.
- Manage incidents and questions reported by drivers.
- Communicate with drivers about active incidents or questions.
- Generate route reports.
- Manage students and their pickup points (school transport module).

## 4. Driver

The user responsible for completing the deliveries or pickups 
assigned by the logistics supervisor.

### Main Functions

- Log in from the mobile application.
- View the assigned route, its stops and the information for each order.
- Start and end the route.
- Share location via GPS while the route is in progress.
- Allow stop verification via geofencing.
- Mark a delivery or pickup as completed, with photo evidence.
- Report incidents or questions during the route and communicate 
  with the supervisor.
- View the status of the assigned route.
- Keep working without connection and synchronize data when 
  the connection is restored.

# Role Summary

| Role | Main Responsibility |
|---|---|
| **Platform Administrator** | General management of FastRouteCO, companies, plans and support |
| **Company Administrator** | Management of company account, subscription, credits, users and reports. Can also perform supervisor functions |
| **Logistics Supervisor** | Management of drivers, orders, routes and logistics operations |
| **Driver** | Execution of routes and completion of deliveries or pickups |

## Structured prompt (historical)

> This is the original prompt used to generate the first functional 
> requirements. It is kept only as a historical record: its content 
> (actors, plans, constraints, tech stack and optimization approach) 
> has been fully replaced by the current sections of this document, 
> including "System Roles", "Service Modalities", "Payments", 
> "Credit Model", "Tech Stack" and the requirements.


Act as a senior requirements analyst.

Context: B2B web and mobile platform called FastRoute CO for Colombian 
companies with their own driver fleet. The system intelligently assigns 
orders and optimizes multi-stop delivery and pickup routes using AI 
from the driver's real-time starting point. Applicable to any economic 
sector — restaurants, pharmacies, courier services, schools, medical 
delivery, and more. No online payments for now.

Key facts confirmed in real interview with business owner:
- Orders arrive via WhatsApp, phone calls and in-person
- Administrators currently assign orders manually with no visibility 
  of driver location
- Drivers decide their own stop order with no optimization
- No performance records per driver exist
- Drivers are non-technical users (must be simple to use)
- System must work in basic offline mode and sync when reconnected
- Photo evidence required to confirm deliveries
- Business plans to scale to multiple branches in the future

Actors: System Administrator, Client Company, Company Administrator, 
Route Supervisor, Driver, Google Maps API (external)

Modules: role-based login, company and driver management, order and 
pickup point registration, AI multi-stop route optimization (VRP), 
real-time GPS tracking, geofencing stop confirmation, dynamic 
reassignment, logistics reports (basic and advanced), driver-supervisor 
communication, school transport module, subscription plan management

Subscription plans:
- Free Trial: limited time access, up to 3 drivers
- Pro: up to 10 drivers, basic reports, up to 5 branches, chat/email support,
  school module available as an add-on
- Premium: unlimited drivers, advanced reports, multiple branches,
  dedicated support, school module included

Platforms: web panel for administrators and supervisors, 
mobile app for drivers (Android and iOS)

Tech stack: Node.js / Express backend, Google Maps API or 
OpenStreetMap, low-cost cloud hosting

Task: generate 15 functional requirements prioritized with MoSCoW.

Format: markdown table: ID | Priority | Requirement. End with up to 
3 questions whose answers would change the design.

Constraints: each requirement verifies a single capability; no online 
payments, push notifications or chat; mark with [ASSUMED] anything 
the business has not confirmed.

## Service Modalities

Companies can use FastRouteCO under two service modalities: subscription 
plans or pay-per-use. Every new company starts on the Free Trial and then 
chooses one modality. A company has only one active modality at a time.

Prices for both modalities are still to be defined.

### Free Trial

- **Duration:** 7 days, available once per company
- **Drivers:** up to 3
- **Branches:** 1
- **Support:** email or chat
- **School module:** included for testing
- **Credit packages:** not available

### Modality 1: Subscription plans

Fixed monthly or annual price, with everything included in a package.

#### Basic

- **Billing:** monthly or annual
- **Drivers:** up to 3
- **Branches:** 1
- **Support:** email or chat
- **School module:** not available
- **Credit packages:** available

#### Pro

- **Billing:** monthly or annual
- **Drivers:** up to 10
- **Branches:** up to 5
- **Support:** email or chat
- **School module:** available as an add-on
- **Credit packages:** available

#### Premium

- **Billing:** monthly or annual
- **Drivers:** unlimited
- **Branches:** unlimited
- **Support:** dedicated
- **School module:** included
- **Credit packages:** available

### Modality 2: Pay-per-use

A base membership plus charges only for what the company uses.

- **Base membership:** monthly fee that includes platform access, all 
  logistics features and a number of drivers (to be defined)
- **Route optimizations:** charged per successful optimization; failed 
  optimizations are not charged
- **Additional drivers:** monthly fee for each driver above those included
- **Branches:** to be defined
- **Support:** email or chat
- **School module:** available as an add-on
- **Credit packages:** not applicable; each optimization is charged
- **Billing:** consumption is accumulated and charged to the registered 
  card at the end of the month, or earlier when it reaches a defined 
  amount, whichever comes first
- **Spending limit:** optional monthly limit set by the company. It is 
  notified at 80% of the limit; when the limit is reached, new 
  optimizations are blocked until the limit is raised or the next month 
  starts. Routes already optimized can still be completed.

### General rules

- Every new company starts automatically on the Free Trial and can 
  choose a subscription plan or pay-per-use at any time.
- When the Free Trial ends without a chosen modality, the company keeps 
  its data but cannot optimize or start routes.
- When a paid plan is not renewed, or a subscription or pay-per-use 
  charge is rejected, the company keeps its data but cannot optimize or 
  start routes until it pays.
- Paid plans can be billed monthly or annually.
- All modalities include advanced reports.

## Payments

- Payments are made online through Wompi, supporting cards, PSE and Nequi.
- Online payments apply to plan subscriptions (monthly or annual), 
  pay-per-use charges, credit packages and add-on modules.
- In pay-per-use, the card is stored by the payment gateway 
  (tokenization); the platform only keeps a reference to it.
- Purchases are enabled only after the gateway approves the payment.
- On annual plans, credits are still delivered monthly, at a lower 
  total price than 12 monthly payments.
- Cash payments may be added later through the gateway's cash options.

## Credit Model

Applies to the subscription plans and the Free Trial. In pay-per-use, 
each successful optimization is charged instead of consuming credits.

- Each plan includes a number of credits ("solicitudes"): monthly for 
  paid plans, and a fixed amount for the 7-day Free Trial.
- 1 credit = 1 route optimization. Failed optimizations do not consume credits.
- Plan credits are reset every month, also on annual plans.
- Additional credits can be purchased in packages. Unused purchased 
  credits are kept after renewal.
- Each optimization uses plan credits first, then purchased credits.
- The Company Administrator is notified when credits fall below 20%.
- Route optimization is blocked when no credits are available.

## Tech Stack

- **Web panel:** React
- **Mobile app:** React Native (Android and iOS)
- **Backend:** Node.js + Express
- **Main database:** PostgreSQL
- **Real-time data:** Redis (live driver location and live chat)
- **Routing engine:** Neo4j with the OpenStreetMap road network, 
  shortest paths calculated with Dijkstra
- **Map service:** OpenStreetMap
- **Email service:** Resend
- **Payment gateway:** Wompi (cards, PSE, Nequi)
- **Evidence photo storage:** Cloudinary

**TypeScript version:** 6.0.x (TypeScript 7.x not yet supported by typescript-eslint; see [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940))

**Pending:** local storage for the mobile app offline mode, stop-order optimization algorithm and hosting.

**Initial city:** Ibagué, Colombia.

## Setup and Run

### Prerequisites

- Node.js 22+
- pnpm 12.14.0 (`corepack enable && corepack prepare pnpm@12.14.0 --activate`)
- Docker & Docker Compose
- Android Studio (for mobile development build)

### Initial Setup

```bash
# Install dependencies
pnpm install

# Start local infrastructure (PostgreSQL on 5433, Redis, Neo4j)
docker compose up -d

# Run database migrations
pnpm db:migrate
```

### Development (3 terminals)

```bash
# Terminal 1: Backend API on http://localhost:3000
pnpm dev:backend

# Terminal 2: Web panel on http://localhost:5173
pnpm dev:web

# Terminal 3: Mobile (development build)
pnpm dev:mobile
```

### Mobile: API URLs

- **Android emulator:** `http://10.0.2.2:3000` (configured in `.env.example`)
- **Physical Android device:** Use your PC's local IP (e.g., `http://192.168.1.50:3000`)
- **iOS:** Development build not supported locally; use EAS Build (`pnpm --filter mobile ios`)

### Mobile: Development Build

```bash
# First time only
pnpm --filter mobile exec expo install --fix
pnpm --filter mobile android

# Subsequent runs
pnpm dev:mobile
```

### Tests

```bash
# All tests
pnpm test

# Individual apps
pnpm --filter backend test
pnpm --filter web test
pnpm --filter mobile test
```

### Database

```bash
# Run migrations
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio
```

### Notes

- The PostgreSQL container uses port **5433** on the host (mapped to 5432 internally) to avoid conflicts with local PostgreSQL installations.
- JWT secrets and API keys must be set in each app's `.env` file (copied from `.env.example`).
- Mobile development build requires Android Studio; Expo Go is not supported due to native modules.

## Glossary

- **Route (ruta):** the set of orders assigned to one driver for a given 
  day. Each order becomes a stop; optimization defines the order of the stops.
- **Incident (incidencia):** a problem or question reported by a driver 
  during a route. It is not used for platform failures.
- **Failure or alert (fallo o alerta):** a technical problem of the 
  platform, monitored by the Platform Administrator.
- **Credit (solicitud):** the unit consumed by each route optimization 
  in the subscription plans and the Free Trial.
- **Service modality (modalidad de servicio):** the way a company pays for 
  FastRouteCO: a subscription plan or pay-per-use.
- **Pay-per-use (pago por uso):** modality with a base membership plus 
  charges for each successful optimization and each additional driver.
- **Spending limit (tope de gasto):** optional monthly maximum that a 
  pay-per-use company can set to control its charges.
- **Company status (estado de la empresa):** active or inactive. Decided 
  only by the Platform Administrator. An inactive company's users cannot 
  log in. It is independent of the subscription status.
- **Subscription status (estado de la suscripción):** applies to both 
  modalities. Active (current and paid), expired (Free Trial ended without 
  a chosen modality, paid plan not renewed, or a subscription or 
  pay-per-use charge rejected; the company cannot optimize or start routes 
  until it pays) or inactive (replaced by another plan or modality; kept 
  only as history).
- **Company Administrator (cliente empresa):** the user who manages a 
  company's account. Called "Cliente empresa" in the user stories.
- **Platform Administrator (admin del sistema):** a member of the 
  FastRouteCO team. Called "Admin del sistema" in the user stories.
- **Add-on module (módulo adicional):** a sector-specific feature, such as 
  school transport, that can be included in a plan or purchased separately.

## Functional Requirements

| ID | Requirement |
|---|---|
| RF01 | Create routes by grouping the orders assigned to a driver for a given day |
| RF02 | Register and manage client companies in the system |
| RF03 | Register and manage the drivers of each company's fleet |
| RF04 | Register delivery or pickup orders with their type, address, customer data, description, arrival channel and priority (normal or urgent) |
| RF05 | Suggest the most suitable driver for each order based on availability and location, and let the supervisor confirm or change the assignment |
| RF06 | Dynamically optimize the multi-stop route for each driver from their starting point |
| RF07 | Reassign orders or routes in real time when incidents or cancellations occur |
| RF08 | Display the real-time status and location of each driver on the map |
| RF09 | Notify the driver of their assigned route with the stop order through the mobile app |
| RF10 | Confirm completed delivery or pickup by the driver |
| RF11 | Generate operational efficiency reports by route, driver and company |
| RF12 | Manage the school transport module with student pickup points |
| RF13 | Obtain and update the driver's geographic location in real time via GPS integrated in the mobile app, and store the complete GPS trail of each route, including periods without connection |
| RF14 | Automatically detect and record the driver's arrival at each delivery or pickup point using GPS (geofencing), allowing manual marking when arrival is not detected |
| RF15 | Calculate distances and routes with the platform's own routing engine over the OpenStreetMap road network, and use OpenStreetMap to obtain coordinates from addresses and display maps |
| RF16 | Require drivers to upload at least one photo as evidence when confirming a completed delivery or pickup |
| RF17 | Enable basic offline mode on the driver's mobile app, synchronizing data automatically when internet connection is restored |
| RF18 | Manage subscription plans and pay-per-use rates, with their limits (drivers, branches, support, credits, and prices) |
| RF19 | Start every new company on a 7-day Free Trial, and restrict route optimization and route start when the Free Trial ends without a chosen modality, a paid subscription expires or a pay-per-use charge is rejected |
| RF20 | Manage each company's credit balance: consume one credit per successful optimization, reset plan credits monthly and keep a history of all movements |
| RF21 | Allow companies to purchase additional credit packages |
| RF22 | Allow Pro plan and pay-per-use companies to purchase add-on modules (school transport module) |
| RF23 | Manage company users (logistics supervisors) and branches, enforcing the branch limit of the active plan |
| RF24 | Allow drivers to start and end their assigned route from the mobile app |
| RF25 | Allow drivers to report incidents or questions during the route and communicate with the supervisor about them |
| RF26 | Register and respond to technical support requests from companies, and record a history of platform failures and alerts |
| RF27 | Notify users of relevant events: company registration confirmation, access details for new Company Administrators, support responses, driver messages, low credit balance, Free Trial ending (two days before), upcoming renewals, payment results, completed purchases, pay-per-use charges and spending limit alerts |
| RF28 | Allow companies to contract or change their plan and pay online through a payment gateway, with monthly or annual billing |
| RF29 | Allow companies to choose the pay-per-use modality and register a payment card through the payment gateway |
| RF30 | Accumulate pay-per-use charges for each successful optimization and each additional driver, and bill them at the end of the month or when a defined amount is reached |
| RF31 | Show pay-per-use consumption and charge history, indicate whether a subscription plan would have been more convenient for the period's consumption, and allow companies to set an optional monthly spending limit |

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| RNF01 | The system must calculate and generate the optimized route in a maximum of 10 seconds |
| RNF02 | The system must update each driver's GPS location in real time with a maximum interval of 5 seconds |
| RNF03 | The system must be available 99% of the time during client companies' operational hours |
| RNF04 | The system must authenticate all users ensuring each actor only accesses the functions corresponding to their role. The Company Administrator can also access all Logistics Supervisor functions |
| RNF05 | The driver's mobile app must be compatible with Android and iOS devices |
| RNF06 | The system must be scalable to support growth in the number of companies, drivers and orders without degrading performance |
| RNF07 | The driver's mobile app must keep its basic functions (viewing the assigned route, registering arrivals, confirming deliveries with photos, reporting incidents, ending the route and recording the GPS trail) without internet connection, synchronizing data when the connection is restored |
| RNF08 | The system must keep operating with the last available data when the external map service is unavailable |
| RNF09 | Each company must only be able to access its own data |
| RNF10 | The driver's mobile app must be simple enough to be used by non-technical users |
| RNF11 | The system must not store card data; payments are processed entirely by the payment gateway |