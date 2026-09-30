# TrackFlow AI — Production Backend

A high-performance, modular TypeScript backend for **TrackFlow AI** — the application intelligence and workflow tracking platform powered by Supabase.

> **Track. Explain. Predict. Act.**

---

## 1. Architecture Overview

TrackFlow AI Backend is architected as a production-grade modular system:

```text
trackflow-backend/
├── src/
│   ├── config/             # Environment, Supabase client, service definitions & SLAs
│   ├── docs/               # OpenAPI/Swagger specification
│   ├── middleware/         # Auth (JWT & Supabase), Role Guard, Validation (Zod), Errors
│   ├── modules/
│   │   ├── admin/          # Admin intelligence, bottleneck analytics, case management
│   │   ├── applications/   # Application lifecycle, tracking ID generator, digital twin
│   │   ├── auth/           # Supabase Auth, login/register/reset, profiles
│   │   ├── dev/            # Working-day simulation engine (Requirement #22)
│   │   ├── documents/      # Supabase Storage bucket integration & file verification
│   │   └── notifications/  # Persistent user activity notifications & reminders
│   ├── services/           # AI Delay Detective, SLA Engine, Prediction, Audit logging
│   ├── types/              # Centralized TypeScript domain models
│   ├── utils/              # Standard JSON responses, logging, tracking ID utilities
│   ├── app.ts              # Express application configuration & routing
│   └── server.ts           # Server bootstrap
├── supabase/
│   ├── migrations/         # 20260930000000_initial_schema.sql (RLS, Triggers, Tables)
│   └── seed/               # seed.sql (Initial realistic demo datasets)
├── tests/                  # Automated integration & unit test suites (Vitest)
└── scripts/seed.ts         # Automated seeding script
```

---

## 2. Key Features

- **Supabase Authentication & RLS**: Fully secure role-based access for Citizens, Officers, and Administrators with PostgreSQL Row Level Security.
- **AI Delay Detective**: Deterministic explainability engine that computes excess waiting days, primary bottleneck cause, required user actions, and responsible department contact. Pluggable architecture ready for LLM integration.
- **Application Digital Twin**: Real-time structured model representing state, dependencies, stage checkpoints, and predicted transitions.
- **Processing Prediction Engine**: Calculates dynamic delay risk percentage, estimated next update ETA, and weighted contributing factors (Workload, Waiting time, Missing documents).
- **Supabase Document Storage**: Secure file management (`application-documents` bucket) supporting PDF, JPG, and PNG files up to 10 MB with signed URLs.
- **Admin Case Operations**: Review queue, stage transitions, officer assignment, internal case notes, info requests, and escalation workflows.
- **Immutable Audit Trail**: Structured event logging for every stage progression, upload, assignment, and status update.
- **Working Day Simulation Engine**: Endpoint `/api/dev/simulate-day` simulating daily workflow progression, SLA breach evaluation, and automated reminders.

---

## 3. Quick Start

### Prerequisites
- Node.js >= 18 (Tested on v24.19.0)
- npm >= 9

### Installation

```bash
cd trackflow-backend
npm install
```

### Run in Development Mode

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

- **Swagger API Docs**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`
- **Status Endpoint**: `http://localhost:3000/status`

### Run Tests

```bash
npm run test
```

### Build & Run Production

```bash
npm run build
npm start
```

---

## 4. Supabase Setup & Migrations

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Run the schema migration from `supabase/migrations/20260930000000_initial_schema.sql`.
4. (Optional) Run `supabase/seed/seed.sql` to populate sample applications and users.
5. In your Supabase Project Settings -> **API**, copy:
   - Project URL
   - `anon` / `public` key
   - `service_role` secret key
6. Add them to `.env`:

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

FRONTEND_URL=*
JWT_SECRET=your-secure-jwt-secret-min-32-chars
```

> **Note**: If run without Supabase credentials, the backend automatically runs in embedded development mode with pre-seeded in-memory data, enabling instant testing out-of-the-box!

---

## 5. Demo Accounts

| Role | Email | Password |
|---|---|---|
| **Citizen** | `demo@trackflow.ai` | `demoPassword123!` |
| **Admin / Officer** | `admin@trackflow.ai` | `adminPassword123!` |

---

## 6. API Reference

### Authentication
- `POST /api/auth/register` — Create citizen or admin profile
- `POST /api/auth/login` — Sign in and receive token
- `POST /api/auth/logout` — Invalidate session
- `POST /api/auth/reset-password` — Password recovery
- `GET /api/auth/me` — Get current profile *(Authenticated)*

### Applications & Tracking
- `POST /api/applications` — Submit new application & generate tracking ID *(Citizen)*
- `GET /api/applications` — List user's applications *(Citizen / Admin)*
- `GET /api/applications/:id` — Get full application details
- `GET /api/applications/track/:trackingId` — Public / authorized tracking lookup
- `GET /api/applications/:id/twin` — Application Digital Twin
- `GET /api/applications/:id/intelligence` — AI Delay Detective analysis
- `GET /api/applications/:id/prediction` — Processing delay risk prediction
- `POST /api/applications/:id/fix` — Resolve pending attention item

### Document Management
- `POST /api/documents/upload/:applicationId` — Upload documents (Multipart, up to 10MB)
- `GET /api/documents/application/:applicationId` — List documents for application
- `PATCH /api/documents/:documentId/status` — Verify / reject document *(Admin)*

### Notifications
- `GET /api/notifications` — List notifications for user
- `PATCH /api/notifications/:id/read` — Mark notification as read

### Admin Intelligence & Operations
- `GET /api/admin/overview` — Operational overview, delayed counts, top bottlenecks
- `GET /api/admin/trends` — Delay percentage weekly trends
- `GET /api/admin/bottlenecks` — Stage bottleneck breakdown
- `GET /api/admin/causes` — Top delay root causes & recommendations
- `GET /api/admin/delayed-cases` — All cases exceeding SLA
- `GET /api/admin/cases` — Full case management review queue
- `GET /api/admin/cases/:id` — Case detail view
- `PATCH /api/admin/cases/:id` — Update stage, assign officer, internal note
- `POST /api/admin/cases/:id/request-information` — Request info from applicant
- `POST /api/admin/cases/:id/assign` — Assign reviewing officer
- `POST /api/admin/cases/:id/escalate` — Escalate case to supervisor

### Development Day Simulation
- `POST /api/dev/simulate-day` — Advance 1 working day, evaluate SLAs, trigger notices
