# TeleICU — Architecture Problems & Research Paths

## Current State

The TeleICU module is built with mock data for development. The vitals generation runs
as a Celery Beat task (`start_vitals_stream` every 5s) that reads a patient registry
from the Django cache and fans out `generate_mock_vitals` tasks. This was always a
stand-in for real device data.

---

## Known Problems

### 1. Registry vs Database Drift (FIXED)

- **`monitored_patients/`** previously read from `get_registry().list_all()` (Django cache,
  per-process memory). The stats card queried the database. They showed different counts.
- **Fix applied:** `monitored_patients/` now queries `TeleICUSession.objects.filter(is_active=True)`
  directly — same source as the stats card.

### 2. Hospital FK Missing on New Entities (FIXED)

- `EncounterViewSet.perform_create()` and `PatientViewSet.perform_create()` overrode the
  parent but forgot to pass `hospital=self.get_hospital()`. New encounters and patients
  were created with `hospital=NULL`, making them invisible to all hospital-scoped views.
- **Fix applied:** Both now pass `hospital=self.get_hospital()` in `save()`.

### 3. Celery Beat Dependency (NOT FIXED — Architectural)

- `start_vitals_stream` runs every 5 seconds via Celery Beat. Without Beat running,
  mock vitals only fire once (the one-shot `generate_mock_vitals.delay()` in
  `start_monitoring`).
- **Production path:** Replace with real device data pipeline. No Celery Beat needed.

### 4. No Vendor Agnostic Device Gateway

- Current architecture has no abstraction layer between device protocols and the Django backend.
- Different hospitals use different vendors (GE, Philips, Mindray, Drager) each with
  different protocols (HL7 v2, MQTT, REST, serial TCP, proprietary binary).
- **Research needed:** See Section A below.

### 5. Bed ↔ Patient ↔ Device Mapping

- The registry maps `patient_id → encounter_id`. There's no `bed_id → device_id` or
  `device_id → encounter_id` mapping.
- In a real ICU, a patient is assigned to a bed, and the bed has a monitor. The monitor
  sends a stream of vitals. The system needs to know which device stream belongs to
  which patient.
- **Research needed:** See Section B below.

### 6. No HL7 / FHIR Integration

- Many hospitals have an existing HL7 v2 feed or a FHIR server that already aggregates
  device data. MedOS should be able to consume from these rather than talking to devices
  directly.
- **Research needed:** See Section C below.

### 7. Alert Fatigue & Threshold Configuration

- Current alert engine (`alerts/engine.py`) checks hardcoded thresholds per vitals field.
- In practice, thresholds vary by patient (a COPD patient has different baseline SpO₂
  than a healthy patient), by time of day, and by clinical context.
- **Research needed:** See Section D below.

### 8. No Offline / Disconnect Handling

- If the device gateway loses connection to a monitor, the UI shows stale data silently.
- There's no "data stale" indicator, no reconnection backoff strategy documented, no
  alarm when the device goes offline.
- **Research needed:** See Section E below.

### 9. Single-Server Bottleneck

- WebSocket groups are per Django process. With hundreds of ICU beds, a single server
  won't scale.
- Redis channel layers help (already configured via `CHANNEL_LAYERS`), but the rest
  of the stack (DB writes, alert engine) needs horizontal scaling consideration.
- **Research needed:** See Section F below.

### 10. No Audit Trail for Device Data

- `generate_mock_vitals` logs to `SystemActivityLog` once per minute. A real device
  generates 100+ readings per second per patient. Logging every reading is impractical.
- Need a strategy: sample-and-store at configurable intervals, log only anomalies,
  keep raw data in a time-series DB (TimescaleDB / InfluxDB).
- **Research needed:** See Section G below.

---

## Things to Resolve

### A. Device Gateway Architecture

Investigate and decide:

- **Protocol support:** Which vendors does the target hospital use? Do they expose
  HL7 v2 over TCP? MQTT? REST API? Serial?
- **Gateway language:** Python (fast to prototype, async with `asyncio`) or Go (better
  for concurrent device connections, lower resource usage)?
- **Deployment:** Run as a sidecar container next to each bedside monitor? Centralized
  on a ward server? Cloud gateway?
- **Existing open-source:** Can we use [OpenICE](https://openice.info/) or
  [HAPI FHIR](https://hapifhir.io/) as a starting point?

**Output:** Decision record (ADR) on gateway architecture.

---

### B. Bed-Patient-Device Mapping Model

Design the data model:

- Does every ICU bed have a fixed device? Or do devices get wheeled in/out?
- Does the hospital use ADT (Admission, Discharge, Transfer) feeds to know which
  patient is in which bed?
- Does the device broadcast its own identifier, or does the gateway need to know
  which IP/port corresponds to which bed?

**Output:** Model changes (new `Device`, `BedDeviceMapping`, or extend `ICUBed`)
and migration plan.

---

### C. FHIR / HL7 Integration

Research:

- Does the hospital have an existing FHIR server? If so, which version (DSTU2, STU3, R4)?
- Does the hospital have an HL7 v2 feed? What segments (OBX for observations, PID for
  patient identity)?
- Can we use [HAPI FHIR](https://hapifhir.io/) (Java) or
  [fhir.resources](https://github.com/nazrulworld/fhir.resources) (Python) for parsing?
- Or build a lightweight HL7 v2 parser with [python-hl7](https://github.com/johnpaulett/python-hl7)
  or [HL7apy](https://github.com/aleri/HL7apy)?

**Output:** Integration specification for each target hospital type.

---

### D. Configurable Threshold Engine

Design:

- Per-patient threshold overrides (e.g., COPD patient: SpO₂ baseline 88% instead of 95%).
- Per-vitals-type severity levels.
- Escalation rules: bedside alarm → nurse notification → doctor alert.
- Time-window thresholds (e.g., "HR > 120 for 5+ minutes" rather than single reading).

**Output:** Threshold configuration schema + serializer + admin UI spec.

---

### E. Device Health Monitoring

Requirements:

- Heartbeat from each device/gateway (every N seconds).
- "Data stale" indicator on the frontend (last reading age > threshold).
- Automatic alert when device disconnects.
- Graceful reconnection with exponential backoff.

**Output:** Health check model + WebSocket heartbeat protocol + frontend stale-data
indicator spec.

---

### F. Horizontal Scaling

Research:

- Can the backend handle 100+ simultaneous WebSocket connections per server?
- What's the bottleneck: DB writes, alert engine CPU, WebSocket memory?
- Do we need a separate WebSocket server (e.g., a Node.js or Go relay)?
- Can we use [Django Channels](https://channels.readthedocs.io/) with Redis channel
  layer across multiple Daphne workers?

**Output:** Load testing plan + scaling ADR.

---

### G. Time-Series Data Strategy

Research:

- Store every vitals reading in PostgreSQL (`Vitals` table) or use a dedicated
  time-series DB (TimescaleDB, InfluxDB, ClickHouse)?
- If PostgreSQL: indexing strategy for time-range queries (BRIN index on
  `recorded_at`)? Partitioning by time?
- Retention policy: raw data for 7 days, aggregated (1-min averages) for 90 days,
  daily summaries for 1 year?
- Downsampling pipeline: Celery task that runs hourly and aggregates raw vitals
  into 1-minute buckets?

**Output:** Data retention ADR + migration plan for time-series partitioning.

---

## Summary Table

| # | Problem | Status | Priority |
|---|---|---|---|
| 1 | Registry vs DB drift | **FIXED** | — |
| 2 | Hospital FK missing | **FIXED** | — |
| 3 | Celery Beat dependency | Architectural — device data replaces mocks | Low |
| 4 | No device gateway | **RESEARCH** (Section A) | High |
| 5 | Bed ↔ Patient ↔ Device mapping | **RESEARCH** (Section B) | High |
| 6 | FHIR / HL7 integration | **RESEARCH** (Section C) | Medium |
| 7 | Alert threshold configurability | **RESEARCH** (Section D) | Medium |
| 8 | Offline / disconnect handling | **RESEARCH** (Section E) | High |
| 9 | Horizontal scaling | **RESEARCH** (Section F) | Medium |
| 10 | Time-series data strategy | **RESEARCH** (Section G) | Medium |
