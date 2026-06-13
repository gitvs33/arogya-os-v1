# Arogya OS — Hospital Management System

A full-stack hospital management platform built with Django (backend) and React/TypeScript (frontend). Includes modules for patient management, encounters/EMR, ward/IPD management, pharmacy, lab, billing, tele-ICU, medical alerts, role-based access control, and admin configuration panels.

## Architecture

```
arogya_os/
├── backend/              # Django REST Framework backend
│   ├── medos/            # Main Django app
│   │   ├── models/       # Domain models (patient, clinical, ward, billing, etc.)
│   │   ├── views/        # ViewSets (hospital-scoped)
│   │   ├── serializers/  # DRF serializers
│   │   ├── services/     # Business logic layer
│   │   └── management/   # Management commands (seed data, etc.)
│   ├── medos_project/    # Django project settings
│   └── manage.py
├── frontend/             # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── api/          # API client modules
│   │   └── ...
│   └── ...
└── README.md
```

## Modules

| Module | Description |
|---|---|
| **Patients** | Registration, demographics, medical history |
| **Encounters / EMR** | Visits, vitals, clinical notes, investigations |
| **Ward / IPD** | Wards, beds, admissions, daily rounds, nursing, discharge |
| **Pharmacy** | Drug catalogue, inventory, dispensing, pharmacy queue |
| **Lab** | Test panels, parameters, lab queue |
| **Billing** | Invoices, payments, refunds, insurance claims |
| **Tele-ICU** | Remote ICU monitoring |
| **Medical Alerts** | DDIs, critical lab alerts |
| **Admin** | User management, roles & permissions, departments, wards, lab panels |

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Edit with your settings
python manage.py migrate
python manage.py seed_departments
python manage.py seed_ward_data
python manage.py seed_roles
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # Edit with your settings
npm run dev
```

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for required environment variables.

## Default Test Accounts

| Role | Username | Password |
|---|---|---|
| Doctor | doctor@medos.com | doctor123 |
| Nurse | nurse@medos.com | nurse123 |

## Tech Stack

- **Backend:** Django 5, Django REST Framework, PostgreSQL, Celery, Redis
- **Frontend:** React 19, TypeScript, Vite, TanStack Query, Tailwind CSS v4, Lucide Icons
- **Auth:** Supabase (optional) + JWT / HttpOnly cookies
- **Testing:** Vitest (frontend), Django TestCase (backend)
