# MedOS Backend — Django REST API

The backend for MedOS Hospital Management System, built with Django 6.0 and Django REST Framework.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Django 6.0 + Django REST Framework 3.17 |
| **Auth** | Supabase Auth (JWT) + Token Authentication |
| **Async** | Django Channels 4 (WebSocket) + Celery 5 (tasks) |
| **Database** | PostgreSQL (production) / SQLite (dev) |
| **Cache** | Redis (Celery broker + caching) |
| **Real-time** | WebSocket via Channels (vitals + alerts) |
| **Testing** | pytest + pytest-django |

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment variables
cp .env.example .env   # Edit with your values
# Get SUPABASE_URL and SUPABASE_ANON_KEY from supabase.com dashboard

# 4. Run migrations
python manage.py migrate

# 5. Seed default roles
python manage.py seed_roles

# 6. Seed drug interaction data (optional)
python manage.py seed_ddi

# 7. Create a superuser
python manage.py createsuperuser

# 8. Start development server
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | Yes | *(dev key)* | Django secret key |
| `DJANGO_DEBUG` | No | `True` | Debug mode |
| `DJANGO_ALLOWED_HOSTS` | No | `localhost,127.0.0.1` | Comma-separated |
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | — | Supabase anon public key |
| `DB_ENGINE` | No | `sqlite3` | `django.db.backends.postgresql` for prod |
| `DB_NAME` | No | `db.sqlite3` | Database name |
| `DB_USER` | No | — | DB user (PostgreSQL) |
| `DB_PASSWORD` | No | — | DB password |
| `DB_HOST` | No | — | DB host |
| `DB_PORT` | No | — | DB port |
| `CELERY_BROKER_URL` | No | `redis://localhost:6379/0` | Redis URL |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3000,http://localhost:5173` | CORS origins |

## Architecture

```
┌──────────────┐   HTTP/REST    ┌──────────────────────┐
│  React SPA   │ ──────────────►│   Django REST API    │
│  (Frontend)  │◄──────────────│   (DRF ViewSets)     │
└──────┬───────┘    JSON        └──────┬───────────────┘
       │                               │
       │ WebSocket                     │ Celery Tasks
       ▼                               ▼
┌──────────────┐              ┌──────────────────────┐
│  Channels    │              │  Celery Workers      │
│  (Vitals,    │              │  (vitals, alerts,    │
│   Alerts)    │              │   reconciliation)    │
└──────────────┘              └──────────────────────┘
                                        │
                                        ▼
                               ┌──────────────────────┐
                               │  Redis / PostgreSQL  │
                               └──────────────────────┘
```

## Project Structure

```
backend/
├── medos/                    # Core Django app
│   ├── models.py             # All database models
│   ├── views.py              # API views & endpoints
│   ├── serializers.py        # DRF serializers
│   ├── urls.py               # URL routing
│   ├── admin.py              # Django admin config
│   ├── supabase_auth.py      # Supabase JWT auth backend
│   ├── auth_backends.py      # Keycloak JWT (legacy, kept for reference)
│   ├── alert_engine.py       # Vitals threshold alerts
│   ├── consumers.py          # WebSocket consumers
│   ├── tasks.py              # Celery async tasks
│   ├── routing.py            # WebSocket URL routing
│   ├── teleicu_urls.py       # TeleICU REST endpoints
│   ├── management/
│   │   └── commands/
│   │       ├── seed_roles.py # Seed default staff roles
│   │       └── seed_ddi.py   # Seed drug interaction data
│   └── tests/
│       ├── test_models.py    # Model unit tests
│       └── test_api.py       # API integration tests
├── medos_project/            # Django project config
│   ├── settings.py           # Settings & configuration
│   ├── urls.py               # Root URL config
│   ├── asgi.py               # ASGI entry point
│   ├── wsgi.py               # WSGI entry point
│   └── celery.py             # Celery app config
├── manage.py                 # Django management script
├── requirements.txt           # Python dependencies
└── .env                      # Environment variables (not in git)
```

## Key Features

- **Supabase Auth** — Email/password login with JWT validation
- **RBAC** — Role-based access control with offline-signing support
- **Patient Management** — Full CRUD with search and filtering
- **Encounter Management** — OPD/IPD/ER encounters with vitals & medications
- **Offline Sync** — Y.js CRDT-based replication with conflict resolution
- **DDI Engine** — Drug-drug interaction checking (multi-source)
- **GST Billing** — GST-compliant invoices with day-end reports
- **TeleICU** — Real-time vitals monitoring with threshold alerts
- **WebSocket** — Live vitals streaming + alert broadcast
