# MedOS API Reference

Base URL: `/api/`

Authentication: Most endpoints require a valid auth token passed as `Authorization: Token <token>` or `Authorization: Bearer <supabase-jwt>`.

---

## Authentication

### POST /api/login/

Authenticate with Supabase JWT or local username/password.

**Request (Supabase flow):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Request (dev fallback):**
```json
{
  "username": "doctor1",
  "password": "testpass123",
  "remember_me": true
}
```

**Response (200):**
```json
{
  "id": 1,
  "username": "doctor1",
  "email": "doctor@hospital.com",
  "employee_id": "EMP001",
  "role": "Doctor",
  "role_snapshot_hash": "abc123def...",
  "is_staff": false,
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
}
```

**Response (401):**
```json
{ "error": "Invalid credentials" }
```

### GET /api/auth/me/

Get the current authenticated user's profile.

**Headers:** `Authorization: Token <token>`

**Response (200):**
```json
{
  "id": 1,
  "username": "doctor1",
  "email": "doctor@hospital.com",
  "first_name": "Ravi",
  "last_name": "Sharma",
  "is_staff": false,
  "employee_id": "EMP001",
  "role": "Doctor",
  "role_permissions": {
    "patients": ["read", "write"],
    "encounters": ["read", "write", "complete"]
  },
  "role_snapshot_hash": "abc123def...",
  "department": "Cardiology",
  "designation": "Senior Consultant"
}
```

---

## Dashboard

### GET /api/dashboard/

**Headers:** `Authorization: Token <token>`

**Response (200):**
```json
{
  "total_patients": 42,
  "today_encounters": 12,
  "active_alerts": 3,
  "pending_invoices": 5
}
```

---

## Patients

### GET /api/patients/

List patients with search, filter, pagination.

**Query params:** `?search=Ravi&gender=M&city=Mumbai&page=1&page_size=50`

**Response (200):**
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "full_name": "Ravi Sharma",
      "phone": "9876543210",
      "gender": "M",
      "age": 36,
      "city": "Mumbai",
      "is_active": true
    }
  ]
}
```

### POST /api/patients/

Create a new patient.

```json
{
  "first_name": "Priya",
  "last_name": "Patel",
  "gender": "F",
  "phone": "9876543211",
  "date_of_birth": "1990-05-15",
  "email": "priya@example.com",
  "city": "Mumbai"
}
```

### GET /api/patients/{id}/

Get patient details (includes full fields).

### PATCH /api/patients/{id}/

Update patient fields.

### DELETE /api/patients/{id}/

Delete a patient.

### GET /api/patients/{id}/encounters/

List all encounters for a patient.

### GET /api/patients/{id}/alerts/

List all alerts for a patient.

### GET /api/patients/{id}/invoices/

List all invoices for a patient.

---

## Encounters

### GET /api/encounters/

List encounters with filters. `?status=IN_PROGRESS&encounter_type=OPD&department=Cardiology`

### POST /api/encounters/

Create a new encounter.

```json
{
  "patient": "uuid",
  "encounter_type": "OPD",
  "department": "Cardiology",
  "chief_complaint": "Chest pain for 2 days"
}
```

### GET /api/encounters/{id}/

Get encounter detail (includes vitals + medications).

### PATCH /api/encounters/{id}/

Update encounter fields.

### POST /api/encounters/{id}/add_vitals/

Add vitals to encounter.

```json
{
  "systolic_bp": 120,
  "diastolic_bp": 80,
  "heart_rate": 72,
  "temperature": 37.5,
  "oxygen_saturation": 98
}
```

### POST /api/encounters/{id}/add_medication/

Add medication to encounter.

```json
{
  "drug_name": "Paracetamol",
  "dosage": "500mg",
  "frequency": "Twice daily",
  "duration": "5 days",
  "route": "Oral"
}
```

### POST /api/encounters/{id}/complete/

Complete an encounter.

```json
{
  "diagnosis": "Migraine",
  "clinical_notes": "Patient responded to treatment"
}
```

---

## Sync (Offline CRDT)

### GET /api/sync/

Pull sync entries. `?since=2024-01-01T00:00:00Z&model_name=patient`

### POST /api/sync/push/

Push offline sync entries.

```json
{
  "entries": [
    {
      "record_id": "550e8400-e29b-41d4-a716-446655440000",
      "model_name": "patient",
      "jsonb_snapshot": {"name": "Test", "age": 30},
      "version": 1,
      "role_snapshot_hash": "abc123..."
    }
  ]
}
```

---

## Drug-Drug Interactions

### GET /api/ddi/

List cached interactions. `?search=Aspirin`

### POST /api/ddi/check/

Check interactions between drugs.

```json
{
  "drugs": ["Aspirin", "Warfarin", "Paracetamol"]
}
```

**Response:**
```json
{
  "drugs": ["Aspirin", "Warfarin", "Paracetamol"],
  "interactions": [
    {
      "drug_a": "Aspirin",
      "drug_b": "Warfarin",
      "severity": "major",
      "description": "Increased bleeding risk"
    }
  ],
  "total_interactions": 1
}
```

---

## Invoices

### GET /api/invoices/

List invoices. `?status=DRAFT&invoice_type=OPD`

### POST /api/invoices/

Create a new invoice (auto-generates invoice number).

```json
{
  "patient": "uuid",
  "invoice_type": "OPD",
  "encounter": "uuid (optional)"
}
```

### POST /api/invoices/{id}/add_line_item/

Add a line item.

```json
{
  "description": "Consultation fee",
  "quantity": 1,
  "unit_price": 500.00,
  "total_price": 500.00
}
```

### POST /api/invoices/{id}/issue/

Mark invoice as issued.

### POST /api/invoices/{id}/mark_paid/

Mark invoice as paid.

### GET /api/invoices/day_end_report/

Get day-end revenue summary.

```json
{
  "date": "2024-06-09",
  "total_invoices": 15,
  "total_revenue": "45000.00",
  "by_type": [...],
  "by_doctor": [...]
}
```

---

## Alerts

### GET /api/alerts/

List alerts. `?alert_type=VITALS&severity=CRITICAL&status=ACTIVE`

### POST /api/alerts/{id}/acknowledge/

Acknowledge an alert.

### POST /api/alerts/{id}/resolve/

Resolve an alert.

---

## TeleICU

### POST /api/teleicu/start_monitoring/

Start vitals monitoring for a patient.

```json
{
  "patient_id": "uuid",
  "encounter_id": "uuid"
}
```

### POST /api/teleicu/stop_monitoring/

Stop vitals monitoring.

```json
{
  "patient_id": "uuid"
}
```

---

## WebSocket Endpoints

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `ws://host/ws/vitals/{patient_id}/` | WebSocket | Live vitals stream for one patient |
| `ws://host/ws/alerts/` | WebSocket | Real-time alert broadcast |
| `ws://host/ws/signal/` | WebSocket | WebRTC signaling relay |

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no content) |
| 400 | Bad request (validation error) |
| 401 | Unauthenticated |
| 403 | Forbidden (wrong role) |
| 404 | Not found |
| 500 | Server error |
