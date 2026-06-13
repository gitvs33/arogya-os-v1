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
from django.db.models import F
from django.utils import timezone

from .alerts.engine import check_vitals_thresholds
from .models import Vitals, SystemActivityLog, Encounter, Patient
from .teleicu.registry import get_registry

logger = logging.getLogger(__name__)

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
    if not get_registry().is_monitored(patient_id):
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

    # ── Broadcast to aggregated TeleICU dashboard group ───────────────────
    try:
        async_to_sync(channel_layer.group_send)(
            'teleicu_vitals',
            {
                'type': 'vitals_update',
                'data': {
                    'type': 'vitals_update',
                    'patient_id': patient_id,
                    'encounter_id': encounter_id,
                    'vitals': {
                        'systolic_bp': snapshot['systolic_bp'],
                        'diastolic_bp': snapshot['diastolic_bp'],
                        'heart_rate': snapshot['heart_rate'],
                        'respiratory_rate': snapshot['respiratory_rate'],
                        'temperature': snapshot['temperature'],
                        'oxygen_saturation': snapshot['oxygen_saturation'],
                        'recorded_at': now.isoformat(),
                    },
                },
            },
        )
    except Exception as exc:
        logger.error(
            'Failed to broadcast to teleicu_vitals group: %s', exc,
        )

    # ── Log to SystemActivityLog (throttled: every 60s) ───────────────────
    try:
        # Only log once per minute per encounter to avoid flooding
        log_key = f'teleicu:vitals_log:{encounter_id}'
        last_log = cache.get(log_key)
        if not last_log:
            encounter = Encounter.objects.only('patient_id').get(id=encounter_id)
            SystemActivityLog.objects.create(
                patient_id=encounter.patient_id,
                encounter_id=encounter_id,
                event_type='VITALS_UPDATE',
                description=(
                    f"HR {snapshot['heart_rate']} bpm | "
                    f"BP {snapshot['systolic_bp']}/{snapshot['diastolic_bp']} | "
                    f"SpO2 {snapshot['oxygen_saturation']}% | "
                    f"RR {snapshot['respiratory_rate']} | "
                    f"Temp {snapshot['temperature']}°C"
                ),
                author_name='System',
                metadata=snapshot,
            )
            cache.set(log_key, True, 60)  # Throttle: 60 seconds
    except Exception as exc:
        logger.error('Failed to log vitals activity: %s', exc)

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
    monitored = get_registry().list_all()
    if not monitored:
        return  # Nothing to stream

    for patient_id, encounter_id in monitored.items():
        generate_mock_vitals.delay(patient_id, encounter_id)

    logger.debug('start_vitals_stream: enqueued %d patient(s)', len(monitored))


# ═══════════════════════════════════════════════════════════════════════════════
# LABORATORY — Background Tasks
# ═══════════════════════════════════════════════════════════════════════════════


@shared_task
def auto_compute_tat_status():
    """Every 5 minutes, flag IN_PROGRESS orders that have exceeded their TAT.

    Updates the order's comments to note overdue status.
    This does NOT change the status field — we just log the overage
    so the UI can display it via tat_deadline comparison.
    """
    from .models import LabOrder

    now = timezone.now()
    overdue = LabOrder.objects.filter(
        tat_deadline__lt=now,
        status__in=['ORDERED', 'SAMPLE_COLLECTED', 'RECEIVED_IN_LAB', 'IN_PROGRESS'],
    )

    count = 0
    for order in overdue.iterator():
        hours_over = int((now - order.tat_deadline).total_seconds() / 3600)
        note = f'[TAT BREACH] {hours_over}h overdue as of {now.strftime("%Y-%m-%d %H:%M")}'
        existing = order.comments or ''
        if note not in existing:  # Avoid duplicate entries
            order.comments = f'{existing}\n{note}' if existing else note
            order.save(update_fields=['comments', 'updated_at'])
        count += 1

    logger.info('auto_compute_tat_status: flagged %d overdue order(s)', count)
    return count


@shared_task
def auto_create_critical_alert(order_id):
    """When a LabParameterResult is saved with status=CRITICAL,
    create a LabAlert entry if one doesn't already exist.

    Called synchronously from the view when results are submitted,
    or can be triggered asynchronously for batch processing.
    """
    from .models import LabOrder, LabAlert

    try:
        order = LabOrder.objects.prefetch_related('parameter_results__parameter').get(id=order_id)
    except LabOrder.DoesNotExist:
        logger.error('auto_create_critical_alert: order %s not found', order_id)
        return

    critical_results = order.parameter_results.filter(status='CRITICAL')
    created = 0
    for cr in critical_results:
        _, was_created = LabAlert.objects.get_or_create(
            order=order,
            parameter_result=cr,
            patient=order.patient,
            severity='CRITICAL',
            defaults={
                'alert_message': (
                    f"{order.test_panel.name} — {cr.parameter.name}: "
                    f"{cr.result_value} {cr.parameter.unit} (Critical)"
                ),
            },
        )
        if was_created:
            created += 1

    logger.info('auto_create_critical_alert: created %d alert(s) for order %s', created, order.lab_id)
    return created


@shared_task
def low_stock_alert():
    """Daily check on LabInventory items below min_stock_threshold.

    Logs to SystemActivityLog for notification visibility.
    """
    from .models import LabInventory, SystemActivityLog

    low_items = LabInventory.objects.filter(
        min_stock_threshold__gt=0,
        current_stock__lte=F('min_stock_threshold'),
    )

    count = 0
    for item in low_items.iterator():
        SystemActivityLog.objects.create(
            event_type='SYSTEM',
            description=f'Low stock alert: {item.item_name} ({item.current_stock} {item.unit}, '
                       f'threshold: {item.min_stock_threshold})',
            author_name='Lab System',
            metadata={
                'item_id': str(item.id),
                'item_name': item.item_name,
                'current_stock': item.current_stock,
                'threshold': item.min_stock_threshold,
            },
        )
        count += 1

    logger.info('low_stock_alert: created %d low-stock alert(s)', count)
    return count


@shared_task
def generate_pdf_report(order_id):
    """Async task to generate a PDF report for a lab order after approval.

    Uses WeasyPrint to render an HTML template with test results,
    reference ranges, pathologist signature, and lab header/footer.

    Currently a stub — returns the template context for integration.
    """
    from django.template.loader import render_to_string
    from .models import LabOrder

    try:
        order = LabOrder.objects.select_related(
            'patient', 'test_panel', 'ordered_by', 'reviewed_by'
        ).prefetch_related(
            'parameter_results__parameter',
        ).get(id=order_id)
    except LabOrder.DoesNotExist:
        logger.error('generate_pdf_report: order %s not found', order_id)
        return None

    results = order.parameter_results.select_related('parameter').order_by(
        'parameter__group', 'parameter__display_order'
    )

    # Build grouped results for the template
    grouped = {}
    for r in results:
        group = r.parameter.group or 'Results'
        if group not in grouped:
            grouped[group] = []
        grouped[group].append({
            'name': r.parameter.name,
            'value': r.result_value,
            'unit': r.parameter.unit,
            'ref_range': f"{r.parameter.ref_range_low} — {r.parameter.ref_range_high}"
                         if r.parameter.ref_range_low and r.parameter.ref_range_high else '-',
            'status': r.get_status_display(),
        })

    context = {
        'lab_name': 'MedOS Laboratory',
        'lab_address': 'Main Hospital Building',
        'report_title': 'Laboratory Test Report',
        'lab_id': order.lab_id,
        'barcode': order.barcode,
        'patient_name': str(order.patient),
        'patient_age': order.patient.age,
        'patient_gender': order.patient.get_gender_display() if order.patient.gender else '',
        'patient_id': order.patient.hospital_patient_id or '',
        'test_name': order.test_panel.name,
        'sample_type': order.get_sample_type_display() if order.sample_type else '',
        'ordered_at': order.ordered_at,
        'reported_at': order.reported_at,
        'ordered_by': str(order.ordered_by) if order.ordered_by else '',
        'reviewed_by': str(order.reviewed_by) if order.reviewed_by else '',
        'grouped_results': grouped,
        'comments': order.comments,
        'generated_at': timezone.now(),
    }

    # Render HTML (template should be created at lab_templates/report.html)
    try:
        html_content = render_to_string('lab_report.html', context)
        logger.info('generate_pdf_report: rendered HTML for order %s (%d results)',
                    order.lab_id, len(results))

        # To produce actual PDF with WeasyPrint:
        # from weasyprint import HTML
        # pdf = HTML(string=html_content).write_pdf()
        # Store file and create LabDocument entry
        #
        # For now, return the context dict
        return context

    except Exception as exc:
        logger.error('generate_pdf_report: failed to render template: %s', exc)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# REPORTS & ANALYTICS — Background Tasks
# ═══════════════════════════════════════════════════════════════════════════════


@shared_task
def calculate_daily_kpis():
    """Nightly pre-aggregation of daily KPI metrics.

    Computes daily snapshots of revenue, encounters, admissions, lab tests,
    prescriptions, and tele-consults, and stores them as AIInsight records
    for fast dashboard loading.

    Scheduled: nightly at 12:05 AM via Celery Beat.
    """
    from .models import Encounter, Invoice, LabOrder, Medication, TeleConsultSession, AIInsight

    yesterday = timezone.now().date() - timedelta(days=1)

    # Aggregate yesterday's metrics
    revenue = Invoice.objects.filter(
        created_at__date=yesterday
    ).exclude(status='CANCELLED').aggregate(t=Sum('total'))['t'] or 0

    patients_seen = Encounter.objects.filter(
        created_at__date=yesterday
    ).count()

    admissions = Encounter.objects.filter(
        created_at__date=yesterday, encounter_type='IPD'
    ).count()

    lab_tests = LabOrder.objects.filter(
        created_at__date=yesterday
    ).count()

    prescriptions = Medication.objects.filter(
        prescribed_at__date=yesterday
    ).count()

    tele_consults = TeleConsultSession.objects.filter(
        created_at__date=yesterday
    ).count()

    # Store as AIInsight (INFO level daily summary)
    AIInsight.objects.create(
        insight_type='REVENUE',
        title=f'Daily Summary — {yesterday}',
        description=(
            f"Revenue: ₹{float(revenue):,.2f} | "
            f"Patients: {patients_seen} | "
            f"Admissions: {admissions} | "
            f"Lab Tests: {lab_tests} | "
            f"Prescriptions: {prescriptions} | "
            f"TeleICU: {tele_consults}"
        ),
        severity='INFO',
        metadata={
            'date': yesterday.isoformat(),
            'revenue': float(revenue),
            'patients_seen': patients_seen,
            'admissions': admissions,
            'lab_tests': lab_tests,
            'prescriptions': prescriptions,
            'tele_consults': tele_consults,
        },
    )

    logger.info(
        'calculate_daily_kpis: cached metrics for %s — revenue=%.2f, patients=%d, admissions=%d',
        yesterday, float(revenue), patients_seen, admissions,
    )
    return {
        'date': yesterday.isoformat(),
        'revenue': float(revenue),
        'patients_seen': patients_seen,
        'admissions': admissions,
        'lab_tests': lab_tests,
        'prescriptions': prescriptions,
        'tele_consults': tele_consults,
    }


@shared_task
def generate_ai_insights():
    """Hourly rules engine to detect anomalies and create AIInsight records.

    Rules:
      - ICU occupancy > 80% → CRITICAL occupancy alert
      - Average lab TAT > 24 hours → WARNING lab backlog alert
      - Revenue drop > 30% vs same period last week → WARNING revenue anomaly
      - High no-show rate → INFO utilization alert

    Scheduled: hourly via Celery Beat.
    """
    from .models import AIInsight, ICUBed, LabOrder, Invoice, Encounter, TeleICUSession

    today = timezone.now().date()
    now = timezone.now()
    created_count = 0

    # ── Rule 1: ICU Occupancy > 80% ────────────────────────────────────
    total_beds = ICUBed.objects.count()
    if total_beds > 0:
        occupied = ICUBed.objects.filter(status='OCCUPIED').count()
        occupancy_pct = round((occupied / total_beds) * 100, 1)
        if occupancy_pct > 80:
            existing = AIInsight.objects.filter(
                insight_type='OCCUPANCY',
                generated_at__date=today,
                severity='CRITICAL',
            ).exists()
            if not existing:
                AIInsight.objects.create(
                    insight_type='OCCUPANCY',
                    title='ICU Occupancy Critical',
                    description=f'ICU occupancy at {occupancy_pct}% ({occupied}/{total_beds} beds occupied). Immediate attention required.',
                    severity='CRITICAL',
                    metadata={'occupancy_pct': occupancy_pct, 'occupied': occupied, 'total_beds': total_beds},
                )
                created_count += 1
        elif occupancy_pct > 60:
            existing = AIInsight.objects.filter(
                insight_type='OCCUPANCY',
                generated_at__date=today,
                severity='WARNING',
            ).exists()
            if not existing:
                AIInsight.objects.create(
                    insight_type='OCCUPANCY',
                    title='ICU Occupancy High',
                    description=f'ICU occupancy at {occupancy_pct}% ({occupied}/{total_beds} beds occupied). Monitor closely.',
                    severity='WARNING',
                    metadata={'occupancy_pct': occupancy_pct, 'occupied': occupied, 'total_beds': total_beds},
                )
                created_count += 1

    # ── Rule 2: Lab TAT Breach Rate > 50% ──────────────────────────────
    completed_orders = LabOrder.objects.filter(
        status='COMPLETED',
        reported_at__isnull=False,
        tat_deadline__isnull=False,
        reported_at__date__gte=today - timedelta(days=7),
    )
    total_completed = completed_orders.count()
    if total_completed > 10:
        breached = completed_orders.filter(reported_at__gt=F('tat_deadline')).count()
        breach_pct = round((breached / total_completed) * 100, 1)
        if breach_pct > 50:
            existing = AIInsight.objects.filter(
                insight_type='TAT_BREACH',
                generated_at__date=today,
            ).exists()
            if not existing:
                AIInsight.objects.create(
                    insight_type='TAT_BREACH',
                    title='Lab TAT Breach Rate High',
                    description=f'{breach_pct}% of lab orders ({breached}/{total_completed}) exceeded TAT in the last 7 days.',
                    severity='WARNING',
                    metadata={'breach_pct': breach_pct, 'breached': breached, 'total': total_completed},
                )
                created_count += 1

    # ── Rule 3: Revenue Drop > 30% vs same period last week ────────────
    last_week_start = today - timedelta(days=7)
    last_week_end = today - timedelta(days=1)
    week_before_start = today - timedelta(days=14)
    week_before_end = today - timedelta(days=8)

    revenue_this_week = Invoice.objects.filter(
        created_at__date__gte=last_week_start,
        created_at__date__lte=last_week_end,
    ).exclude(status='CANCELLED').aggregate(t=Sum('total'))['t'] or 0

    revenue_last_week = Invoice.objects.filter(
        created_at__date__gte=week_before_start,
        created_at__date__lte=week_before_end,
    ).exclude(status='CANCELLED').aggregate(t=Sum('total'))['t'] or 0

    if revenue_last_week > 0:
        drop_pct = round(
            (float(revenue_last_week) - float(revenue_this_week)) / float(revenue_last_week) * 100, 1
        )
        if drop_pct > 30:
            existing = AIInsight.objects.filter(
                insight_type='REVENUE',
                generated_at__date=today,
                severity='WARNING',
            ).exists()
            if not existing:
                AIInsight.objects.create(
                    insight_type='REVENUE',
                    title='Revenue Drop Detected',
                    description=f'Revenue dropped {drop_pct}% this week compared to last week (₹{float(revenue_this_week):,.0f} vs ₹{float(revenue_last_week):,.0f}).',
                    severity='WARNING',
                    metadata={
                        'drop_pct': drop_pct,
                        'revenue_this_week': float(revenue_this_week),
                        'revenue_last_week': float(revenue_last_week),
                    },
                )
                created_count += 1

    # ── Rule 4: Low TeleICU Utilization ─────────────────────────────────
    active_sessions = TeleICUSession.objects.filter(is_active=True).count()
    if total_beds > 0:
        utilization_pct = round((active_sessions / total_beds) * 100, 1) if total_beds > 0 else 0
        if utilization_pct < 30 and active_sessions > 0:
            existing = AIInsight.objects.filter(
                insight_type='UTILIZATION',
                generated_at__date=today,
            ).exists()
            if not existing:
                AIInsight.objects.create(
                    insight_type='UTILIZATION',
                    title='Low ICU Utilization',
                    description=f'ICU utilization at {utilization_pct}% ({active_sessions} active sessions out of {total_beds} beds).',
                    severity='INFO',
                    metadata={'utilization_pct': utilization_pct, 'active_sessions': active_sessions, 'total_beds': total_beds},
                )
                created_count += 1

    logger.info('generate_ai_insights: created %d new insight(s)', created_count)
    return created_count


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_report_generation(self, generated_report_id):
    """Async worker that takes a GeneratedReport request, runs complex SQL,
    generates PDF/Excel via Pandas/WeasyPrint, and uploads to S3.

    Currently a stub that simulates processing and marks the report as COMPLETED.
    In production, this would:
      1. Query the relevant data based on report_definition + parameters
      2. Render a template or build a DataFrame
      3. Generate the file (PDF via WeasyPrint / Excel via openpyxl / CSV)
      4. Upload to S3 / file storage
      5. Update file_url and status = COMPLETED
    """
    from .models import GeneratedReport

    try:
        report = GeneratedReport.objects.select_related('report_definition').get(id=generated_report_id)
    except GeneratedReport.DoesNotExist:
        logger.error('process_report_generation: report %s not found', generated_report_id)
        return

    # Mark as PROCESSING
    report.status = 'PROCESSING'
    report.save(update_fields=['status'])

    try:
        # ── Simulate heavy query + file generation ──────────────────────
        logger.info(
            'process_report_generation: generating %s report "%s" with params %s',
            report.format_type,
            report.report_definition.name,
            report.parameters_used,
        )

        # In production, this is where the actual generation logic goes:
        #   - Fetch data based on report_definition.query_logic
        #   - Build a pandas DataFrame
        #   - Export to PDF (WeasyPrint), Excel (openpyxl), or CSV
        #   - Upload to S3 via django-storages / boto3
        #   - Set report.file_url to the uploaded URL

        # Mark as COMPLETED
        report.status = 'COMPLETED'
        report.file_url = f'/media/reports/{report.id}/{report.report_definition.name}_{report.format_type.lower()}'
        report.save(update_fields=['status', 'file_url'])

        logger.info(
            'process_report_generation: completed report %s (%s)',
            report.id, report.report_definition.name,
        )

    except Exception as exc:
        logger.error('process_report_generation: failed for report %s: %s', report.id, exc)
        report.status = 'FAILED'
        report.save(update_fields=['status'])
        raise self.retry(exc=exc)


@shared_task
def run_scheduled_reports():
    """Periodic task that checks the ScheduledReport table.

    For each active scheduled report where next_run_at <= now:
      1. Create a GeneratedReport record
      2. Trigger process_report_generation
      3. Update last_run_at and compute next_run_at
      4. Email the resulting file to recipients (stub)

    Scheduled: every 15 minutes via Celery Beat.
    """
    from .models import ScheduledReport, GeneratedReport

    now = timezone.now()
    due = ScheduledReport.objects.filter(
        is_active=True,
        next_run_at__lte=now,
    ).select_related('report_definition')

    triggered = 0
    for scheduled in due:
        # Create a GeneratedReport
        generated = GeneratedReport.objects.create(
            report_definition=scheduled.report_definition,
            generated_by=scheduled.user,
            parameters_used={
                'frequency': scheduled.frequency,
                'schedule_time': str(scheduled.schedule_time),
            },
            format_type='PDF',  # Default format for scheduled reports
            status='PENDING',
        )

        # Trigger async generation
        process_report_generation.delay(str(generated.id))

        # Update schedule timestamps
        scheduled.last_run_at = now
        if scheduled.frequency == 'DAILY':
            scheduled.next_run_at = now + timedelta(days=1)
        elif scheduled.frequency == 'WEEKLY':
            scheduled.next_run_at = now + timedelta(weeks=1)
        elif scheduled.frequency == 'MONTHLY':
            scheduled.next_run_at = now + timedelta(days=30)
        scheduled.save(update_fields=['last_run_at', 'next_run_at'])

        # ── In production: email the report to recipients ──────────────
        logger.info(
            'run_scheduled_reports: triggered report "%s" for %s (recipients: %s)',
            scheduled.report_definition.name,
            scheduled.user.get_full_name() or scheduled.user.username,
            scheduled.recipients,
        )

        triggered += 1

    if triggered:
        logger.info('run_scheduled_reports: triggered %d scheduled report(s)', triggered)
    return triggered


# ═══════════════════════════════════════════════════════════════════════════════
# WARD / IPD — Background Tasks
# ═══════════════════════════════════════════════════════════════════════════════


@shared_task
def run_daily_bed_charge_accrual():
    """Runs at midnight every day (Celery Beat).

    Adds bed charge line item to every active IPD encounter.
    Delegates to ward service module.
    """
    from .services.ward import accrue_daily_bed_charges

    count = accrue_daily_bed_charges()
    logger.info('run_daily_bed_charge_accrual: created %d bed charge accrual(s)', count)
    return count
