"""
Celery tasks for TeleICU vitals streaming.

Architecture
------------
- ``start_vitals_stream`` is invoked by Celery Beat every 5 seconds.
  It reads the set of currently-monitored patients from the Django cache
  (backed by Redis) and fans out one ``generate_mock_vitals`` subtask per
  patient.
- ``generate_mock_vitals`` produces a single realistic vitals snapshot,
  persists it, publishes it over WebSocket, and runs the threshold alert
  engine.
- The monitoring set is managed by the REST API endpoints
  ``teleicu/start_monitoring`` and ``teleicu/stop_monitoring`` via the
  Django cache.
"""
import logging
import random

from celery import shared_task
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.utils import timezone

from .alert_engine import check_vitals_thresholds
from .models import Vitals

logger = logging.getLogger(__name__)

# ── Cache key stored in Redis ────────────────────────────────────────────────
# Value is a dict mapping patient_id (str) → encounter_id (str).
TELEICU_MONITORED_KEY = 'teleicu:monitored_patients'

# ── Base vitals (realistic resting values) ───────────────────────────────────
BASE_VITALS = {
    'systolic_bp': 120,
    'diastolic_bp': 80,
    'heart_rate': 72,
    'temperature': 37.0,
    'oxygen_saturation': 98,
    'respiratory_rate': 16,
}

# Variation windows (± around base)
VARIATION = {
    'systolic_bp': 10,       # 110–130
    'diastolic_bp': 10,      # 70–90
    'heart_rate': 10,        # 62–82
    'temperature': 0.5,      # 36.5–37.5
    'oxygen_saturation': 3,  # 95–100 (capped at 100)
    'respiratory_rate': 4,   # 12–20
}


def _generate_vitals_snapshot():
    """Return a dict with one realistic vitals reading.

    Each value is the base plus a small random offset so the stream looks
    like live data rather than a static snapshot.
    """
    snapshot = {}
    for field, base in BASE_VITALS.items():
        delta = VARIATION[field]
        if field == 'temperature':
            raw = base + random.uniform(-delta, delta)
            snapshot[field] = round(raw, 1)
        else:
            raw = base + random.randint(-delta, delta)
            # Clamp oxygen saturation to a valid range
            if field == 'oxygen_saturation':
                raw = max(90, min(100, raw))
            snapshot[field] = raw
    return snapshot


@shared_task(bind=True, max_retries=3, default_retry_delay=2)
def generate_mock_vitals(self, patient_id, encounter_id):
    """Generate a single vitals reading for the given patient/encounter.

    Steps
    -----
    1. Abort early if monitoring was stopped (verified against cache).
    2. Generate a realistic vitals snapshot.
    3. Persist to the ``Vitals`` table.
    4. Broadcast the snapshot over the patient's WebSocket group.
    5. Run thresholds — any breached thresholds create a ``MedicalAlert``
       and broadcast over the alerts WebSocket group.

    This task is light enough to fire every 5 s per patient.
    """
    # ── Guard: skip if monitoring was stopped ────────────────────────────
    monitored = cache.get(TELEICU_MONITORED_KEY, {})
    if patient_id not in monitored:
        logger.debug('generate_mock_vitals: patient %s no longer monitored', patient_id)
        return

    # ── Generate snapshot ────────────────────────────────────────────────
    snapshot = _generate_vitals_snapshot()
    now = timezone.now()

    # ── Persist to database ──────────────────────────────────────────────
    try:
        vitals = Vitals.objects.create(
            encounter_id=encounter_id,
            recorded_at=now,
            systolic_bp=snapshot['systolic_bp'],
            diastolic_bp=snapshot['diastolic_bp'],
            heart_rate=snapshot['heart_rate'],
            respiratory_rate=snapshot['respiratory_rate'],
            temperature=snapshot['temperature'],
            oxygen_saturation=snapshot['oxygen_saturation'],
        )
    except Exception as exc:
        logger.error(
            'Failed to save vitals for patient %s: %s', patient_id, exc,
        )
        raise self.retry(exc=exc)

    # ── Build payload for WebSocket ──────────────────────────────────────
    vitals_payload = {
        'id': str(vitals.id),
        'patient_id': patient_id,
        'encounter_id': encounter_id,
        'systolic_bp': snapshot['systolic_bp'],
        'diastolic_bp': snapshot['diastolic_bp'],
        'heart_rate': snapshot['heart_rate'],
        'respiratory_rate': snapshot['respiratory_rate'],
        'temperature': snapshot['temperature'],
        'oxygen_saturation': snapshot['oxygen_saturation'],
        'recorded_at': now.isoformat(),
    }

    # ── Broadcast to patient's WebSocket group ───────────────────────────
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'vitals_{patient_id}',
            {
                'type': 'vitals_update',
                'data': vitals_payload,
            },
        )
    except Exception as exc:
        logger.error(
            'Failed to broadcast vitals for patient %s: %s', patient_id, exc,
        )

    # ── Threshold check & alert broadcast ────────────────────────────────
    try:
        check_vitals_thresholds(snapshot, patient_id, encounter_id)
    except Exception as exc:
        logger.error(
            'Threshold check failed for patient %s: %s', patient_id, exc,
        )

    logger.debug(
        'Generated vitals for patient %s (HR=%s, BP=%s/%s)',
        patient_id,
        snapshot['heart_rate'],
        snapshot['systolic_bp'],
        snapshot['diastolic_bp'],
    )


@shared_task
def start_vitals_stream():
    """Celery Beat task — runs every 5 seconds.

    Reads the currently-monitored patients from the cache and enqueues a
    ``generate_mock_vitals`` task for each one.
    """
    monitored = cache.get(TELEICU_MONITORED_KEY, {})
    if not monitored:
        return  # Nothing to stream

    for patient_id, encounter_id in monitored.items():
        generate_mock_vitals.delay(patient_id, encounter_id)

    logger.debug('start_vitals_stream: enqueued %d patient(s)', len(monitored))
