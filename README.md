# MedOS — Hospital Management System

A modern hospital management platform with offline-first CRDT sync, AI-powered clinical workflows, and comprehensive billing.

## Architecture

```
medos/
├── backend/          # Django REST API (Python 3.14, Django 6.0)
│   └── medos/        # Core app: models, views, serializers, tests
├── frontend/         # React SPA (Vite + React 19 + Tailwind)
│   └── src/
│       ├── api/      # API client modules
│       ├── pages/    # Route page components
│       └── components/ # Shared components
└── sync-gateway/     # Y.js CRDT sync gateway (Node.js)
```

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_ddi
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Sync Gateway

```bash
cd sync-gateway
npm install
npm run dev
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard/` | Dashboard statistics |
| `GET/POST /api/patients/` | Patient CRUD |
| `GET/POST /api/encounters/` | Encounter CRUD |
| `POST /api/encounters/:id/add_vitals/` | Add vitals |
| `POST /api/encounters/:id/add_medication/` | Add medication |
| `POST /api/encounters/:id/complete/` | Complete encounter |
| `POST /api/sync/push/` | Push offline sync entries |
| `GET /api/sync/` | Pull sync entries |
| `POST /api/ddi/check/` | Check drug-drug interactions |
| `GET/POST /api/invoices/` | Invoice CRUD |
| `GET /api/invoices/day_end_report/` | Day-end revenue report |
| `GET/POST /api/alerts/` | Medical alerts |

## Testing

```bash
# Backend
cd backend && pytest -v

# Frontend
cd frontend && npm test
```

## Key Features

- **Offline-first CRDT sync** — Y.js-based conflict-free replication
- **AI Scribe** — Local Whisper transcription + LLM template fill
- **DDI Engine** — Multi-source drug-drug interaction checking
- **GST Billing** — GST-compliant invoicing with day-end reports
- **RBAC** — Role-based access control with offline signing
- **TeleICU** — Real-time vitals pipeline with threshold alerts
