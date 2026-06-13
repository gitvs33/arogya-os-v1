"""Helpers for TeleICU views — aggregation, dashboard stats, patient monitoring list."""
from datetime import date, timedelta

from django.db.models import Avg
from django.db.models.functions import TruncHour
from django.utils import timezone

from ..models import (
    Encounter, ICUBed, MedicalAlert, Patient,
    TeleConsultSession, TeleICUSession, Vitals,
)


def compute_dashboard_stats(hospital):
    """Compute top-level KPIs for the TeleICU dashboard."""
    today = date.today()

    active_sessions = TeleICUSession.objects.filter(is_active=True, hospital=hospital)
    total_patients = active_sessions.count()

    critical_alerts_count = MedicalAlert.objects.filter(
        hospital=hospital, severity='CRITICAL', status='ACTIVE'
    ).count()

    new_alerts_today = MedicalAlert.objects.filter(
        hospital=hospital, created_at__date=today
    ).count()

    active_consults = TeleConsultSession.objects.filter(
        hospital=hospital, status='ACTIVE'
    ).count()

    total_beds = ICUBed.objects.filter(hospital=hospital).count()
    occupied_beds = ICUBed.objects.filter(hospital=hospital, status='OCCUPIED').count()
    devices_online_pct = round(
        (occupied_beds / total_beds * 100) if total_beds > 0 else 0.0, 1
    )

    return {
        'total_patients': total_patients,
        'critical_alerts_count': critical_alerts_count,
        'new_alerts_today': new_alerts_today,
        'devices_online_pct': devices_online_pct,
        'active_consults': active_consults,
        'occupied_beds': occupied_beds,
        'total_beds': total_beds,
    }


def build_monitored_patients_list(monitored, hospital):
    """Build the list of actively monitored patients with bed info + latest vitals."""
    if not monitored:
        return []

    STATUS_MAP = {
        'CRITICAL': 'critical',
        'UNSTABLE': 'warning',
        'STABLE': 'stable',
        'Critical': 'critical',
        'Observation': 'warning',
    }

    results = []
    for patient_id, encounter_id in monitored.items():
        try:
            patient = Patient.objects.get(id=patient_id, hospital=hospital)
            encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)
        except (Patient.DoesNotExist, Encounter.DoesNotExist):
            continue

        latest_vitals = Vitals.objects.filter(
            encounter_id=encounter_id
        ).order_by('-recorded_at').first()

        try:
            session = TeleICUSession.objects.get(
                encounter_id=encounter_id, is_active=True
            )
            session_id = session.id
            bed_label = str(session.bed) if session.bed else ''
            ward_name = session.bed.ward.name if session.bed and session.bed.ward else ''
            support_type = session.get_support_type_display() if session.support_type else ''
            acuity = session.acuity_status
        except TeleICUSession.DoesNotExist:
            session_id = None
            bed_label = encounter.bed_number or ''
            ward_name = encounter.location or ''
            support_type = encounter.care_sub_status or ''
            acuity = encounter.clinical_acuity or 'STABLE'

        vitals_data = {}
        if latest_vitals:
            vitals_data = {
                'systolic_bp': latest_vitals.systolic_bp,
                'diastolic_bp': latest_vitals.diastolic_bp,
                'heart_rate': latest_vitals.heart_rate,
                'respiratory_rate': latest_vitals.respiratory_rate,
                'temperature': latest_vitals.temperature,
                'oxygen_saturation': latest_vitals.oxygen_saturation,
                'recorded_at': latest_vitals.recorded_at.isoformat() if latest_vitals.recorded_at else None,
            }

        results.append({
            'id': str(patient.id),
            'name': patient.full_name or str(patient.id),
            'bed': bed_label,
            'ward': ward_name,
            'status': STATUS_MAP.get(acuity, 'stable'),
            'support_type': support_type,
            'vitals': vitals_data,
            'encounter_id': str(encounter_id),
            'session_id': str(session_id) if session_id else None,
        })

    return results


def compute_vitals_trend(patient_id, hospital, period='1H', encounter_id=None):
    """Compute time-series vitals data for trend charts."""
    now = timezone.now()
    period_map = {
        '1H': timedelta(hours=1),
        '6H': timedelta(hours=6),
        '24H': timedelta(hours=24),
        '7D': timedelta(days=7),
    }
    delta = period_map.get(period.upper(), timedelta(hours=1))
    start_time = now - delta

    qs = Vitals.objects.filter(
        encounter__patient_id=patient_id,
        encounter__hospital=hospital,
        recorded_at__gte=start_time,
        recorded_at__lte=now,
    ).select_related('encounter').order_by('recorded_at')

    if encounter_id:
        qs = qs.filter(encounter_id=encounter_id)

    if period.upper() == '7D':
        qs = (
            qs.annotate(hour=TruncHour('recorded_at'))
            .values('hour')
            .annotate(
                heart_rate=Avg('heart_rate'),
                systolic_bp=Avg('systolic_bp'),
                diastolic_bp=Avg('diastolic_bp'),
                respiratory_rate=Avg('respiratory_rate'),
                oxygen_saturation=Avg('oxygen_saturation'),
                temperature=Avg('temperature'),
            )
            .order_by('hour')
        )
        data = [
            {
                'timestamp': entry['hour'],
                'heart_rate': round(entry['heart_rate'], 1) if entry['heart_rate'] else None,
                'systolic_bp': round(entry['systolic_bp'], 1) if entry['systolic_bp'] else None,
                'diastolic_bp': round(entry['diastolic_bp'], 1) if entry['diastolic_bp'] else None,
                'respiratory_rate': round(entry['respiratory_rate'], 1) if entry['respiratory_rate'] else None,
                'oxygen_saturation': round(entry['oxygen_saturation'], 1) if entry['oxygen_saturation'] else None,
                'temperature': round(entry['temperature'], 1) if entry['temperature'] else None,
            }
            for entry in qs
        ]
    else:
        data = [
            {
                'timestamp': v.recorded_at,
                'heart_rate': v.heart_rate,
                'systolic_bp': v.systolic_bp,
                'diastolic_bp': v.diastolic_bp,
                'respiratory_rate': v.respiratory_rate,
                'oxygen_saturation': v.oxygen_saturation,
                'temperature': v.temperature,
            }
            for v in qs
        ]

    return {
        'patient_id': patient_id,
        'period': period.upper(),
        'data': data,
    }
