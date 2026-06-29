# PMPlanner

A preventative maintenance scheduling tool for service businesses. Tracks customers, sites, and assets; generates monthly job lists; and integrates with ServiceM8 for dispatching and completion tracking.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Integrations | ServiceM8 API, AssetTracker API |

---

## Features

### Core scheduling
- **Customer → Site → Asset → Schedule hierarchy** — full CRUD with search and filtering
- **Maintenance schedule engine** — define a service template + frequency (monthly interval) per asset; the system projects due dates forward automatically
- **Monthly job generation** — initialize any month to create draft job instances for all schedules due that month; safe to re-run (idempotent)
- **Largest-interval-wins skip logic** — when multiple schedules for the same asset (or linked group) fall in the same month, only the highest-frequency service runs; shorter-interval jobs are automatically skipped and their due date advanced

### Dashboard
- **Spreadsheet-style monthly grid** — virtualised for performance across large job lists
- **Status workflow** — Pending Approval → Approved → Sent to SM8 → Job in Progress → Completed (plus Refused by Customer and Done without SM8)
- **Job detail drawer** — notes, comments, actual labor hours, prior incomplete job warnings
- **Workload forecast footer** — estimated vs actual hours with monthly capacity tracking

### Linked service calendar
- **Same-asset calendar** — when an asset has multiple schedules (e.g. 3-monthly, 6-monthly, 12-monthly), the schedule edit form shows an 18-month grid visualising which months each service runs, which months it gets superseded, and a warning if the selected start date causes the first occurrence to be skipped
- **Service link groups** — location services (not tied to a specific asset) can be linked together by assigning the same group name; the calendar visualization and skip logic then apply across those services, scoped per site so the same group name at different locations does not interfere

### Scheduling tools
- **Pull-forward** — bring a future service forward to the current month while preserving the original cadence for the next cycle
- **SM8 group tag** — mark schedules to be dispatched as a single combined ServiceM8 job rather than one job per asset

### Location services
- **Catch-all assets** — create a site-wide service not tied to a specific asset (e.g., "All Air Conditioners"), useful for location-level tasks

### ServiceM8 integration
- Link customers and sites to ServiceM8 company records
- Dispatch approved jobs to ServiceM8 with configurable job templates, badges, and attachments
- Sync job status and labor hours back from ServiceM8
- Preview changes before confirming a sync

### AssetTracker integration
- Link PMPlanner assets to AssetTracker records by UUID
- Dispatch completed work order records to AssetTracker
- Pull completion data from AssetTracker for jobs serviced outside PMPlanner

### Reporting
- Generate per-customer PDF and Excel reports covering asset inventory, service schedule, completed/refused history, and upcoming forecast
- Configurable forecast horizon (3, 6, or 12 months)
- Business name and logo branding on report headers

### Projects
- Lightweight ad-hoc project tracker for work outside the regular PM schedule
- Contributes to the monthly workload forecast alongside scheduled jobs

### Administration
- Three user roles: Admin, Staff, Worker
- Database backup and restore via `pg_dump` with download and server-side storage
- Labor hours consolidation to update historical averages on service templates
- Monthly capacity setting for workload planning

---

## Quick Start

### Local development

See [`LOCAL_SETUP.txt`](LOCAL_SETUP.txt) for full step-by-step instructions.

**Summary:**

```bash
# 1 — Backend
cd backend
uv venv --python 3.12 && source .venv/bin/activate
uv pip install -r requirements.txt
# create .env with DATABASE_URL, SECRET_KEY, etc.
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2 — Frontend (new terminal)
cd frontend
npm install
npm run dev
```

App: http://localhost:5173  
API docs: http://localhost:8000/docs  
Default login: `admin` / `admin123`

### Production deployment (Ubuntu VM / Proxmox)

```bash
sudo bash setup-prod.sh
```

The script prompts for the git repository URL, then installs all dependencies, sets up PostgreSQL, builds the frontend, and configures nginx + systemd in one pass. See [`docs/installation-proxmox.md`](docs/installation-proxmox.md) for prerequisites and post-install steps (HTTPS, backups, updates).

---

## Project Structure

```
PMPlanner/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # FastAPI route handlers
│   │   ├── crud/               # Database query logic
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── reports/            # PDF and Excel generation
│   │   ├── servicem8/          # ServiceM8 API client and sync logic
│   │   └── assettracker/       # AssetTracker API client and sync logic
│   └── alembic/versions/       # Database migrations
├── frontend/
│   └── src/
│       ├── api/                # API client functions
│       ├── components/         # Shared UI components
│       ├── pages/              # Page-level components
│       ├── hooks/              # Custom React hooks
│       └── types/              # TypeScript type definitions
└── docs/
    ├── user-guide.md           # End-user documentation
    └── installation-proxmox.md # Production deployment guide
```

---

## Key Concepts

**Schedule vs Job Instance** — A `MaintenanceSchedule` is the recurring rule (asset + service + frequency). A `JobInstance` is one occurrence of that rule in a specific month. The schedule's `date_next_due` advances after each completed instance.

**Link group** — A string tag on a schedule that opts it into cross-asset interval coordination. Schedules sharing the same `link_group` within a site participate in the largest-interval-wins skip logic together, regardless of which asset they belong to.

**Location service** — An asset with `is_catch_all = true`. Represents a site-wide service with no specific equipment record (e.g., general fire safety checks). Has the same schedule and job instance mechanics as a regular asset.
