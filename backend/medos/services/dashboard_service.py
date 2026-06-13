"""Dashboard service — all query logic behind dashboard endpoints.

Every function returns a plain dict (no Serializer dependency). The views
are thin adapters that call these and wrap the result in a Response.
"""
from datetime import date, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from ..models import (
    Patient, Encounter, MedicalAlert, Invoice,
    Department, SystemActivityLog, Appointment,
    Role, HospitalUserProfile, Medication,
)



# ═══════════════════════════════════════════════════════════════════════════════
#  KPI CARDS  — 6 stat cards for the top row
# ═══════════════════════════════════════════════════════════════════════════════


def get_dashboard_kpis(hospital):
    """Return 6 KPI cards: total patients, today's encounters, active alerts,
    pending invoices, today's appointments, active staff today."""
    today = date.today()
    yesterday = today - timedelta(days=1)

    total_patients = Patient.objects.filter(hospital=hospital).count()
    patients_yesterday = Patient.objects.filter(
        hospital=hospital, created_at__date=yesterday
    ).count()
    patients_today = Patient.objects.filter(
        hospital=hospital, created_at__date=today
    ).count()

    today_encounters = Encounter.objects.filter(
        hospital=hospital, created_at__date=today
    ).count()
    yesterday_encounters = Encounter.objects.filter(
        hospital=hospital, created_at__date=yesterday
    ).count()

    active_alerts = MedicalAlert.objects.filter(
        hospital=hospital, status__in=['ACTIVE', 'ACKNOWLEDGED']
    ).count()
    yesterday_alerts = MedicalAlert.objects.filter(
        hospital=hospital, created_at__date=yesterday
    ).count()

    pending_invoices = Invoice.objects.filter(
        hospital=hospital, status__in=['DRAFT', 'PENDING']
    ).count()
    yesterday_invoices = Invoice.objects.filter(
        hospital=hospital, created_at__date=yesterday
    ).count()

    today_appointments = Appointment.objects.filter(
        hospital=hospital, appointment_date=today
    ).count()
    yesterday_appointments = Appointment.objects.filter(
        hospital=hospital, appointment_date=yesterday
    ).count()

    active_staff = HospitalUserProfile.objects.filter(
        hospital=hospital, is_active=True
    ).count()

    def pct_change(today_val, yesterday_val):
        if yesterday_val == 0:
            return 100 if today_val > 0 else 0
        return round(((today_val - yesterday_val) / yesterday_val) * 100, 1)

    return {
        "total_patients": {
            "value": total_patients,
            "change": f"{pct_change(patients_today, patients_yesterday)}%",
            "direction": "up" if patients_today >= patients_yesterday else "down",
        },
        "today_encounters": {
            "value": today_encounters,
            "change": f"{pct_change(today_encounters, yesterday_encounters)}%",
            "direction": "up" if today_encounters >= yesterday_encounters else "down",
        },
        "active_alerts": {
            "value": active_alerts,
            "change": f"{pct_change(yesterday_alerts, max(active_alerts, 1))}%",
            "direction": "neutral" if active_alerts == yesterday_alerts else ("down" if active_alerts < yesterday_alerts else "up"),
        },
        "pending_invoices": {
            "value": pending_invoices,
            "change": f"{pct_change(yesterday_invoices, max(pending_invoices, 1))}%",
            "direction": "neutral",
        },
        "today_appointments": {
            "value": today_appointments,
            "change": f"{pct_change(today_appointments, yesterday_appointments)}%",
            "direction": "up" if today_appointments >= yesterday_appointments else "down",
        },
        "active_staff": {
            "value": active_staff,
            "change": "Today",
            "direction": "neutral",
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  LIVE ACTIVITY FEED
# ═══════════════════════════════════════════════════════════════════════════════


def get_live_activity(hospital, limit=15):
    """Return recent activity events (encounters created, patients registered,
    invoices issued, alerts triggered)."""
    today = date.today()
    events = []

    # Recent encounters
    for enc in Encounter.objects.filter(
        hospital=hospital, created_at__date=today
    ).select_related('patient', 'doctor').order_by('-created_at')[:5]:
        events.append({
            "type": "encounter",
            "title": f"New {enc.get_encounter_type_display()} Encounter",
            "description": f"{enc.patient} — {enc.chief_complaint or 'Checkup'}",
            "detail": f"Dr. {enc.doctor.get_full_name() if enc.doctor else 'Unassigned'}",
            "time": enc.created_at.strftime("%I:%M %p"),
            "icon": "activity",
        })

    # Recent patient registrations
    for pat in Patient.objects.filter(
        hospital=hospital, created_at__date=today
    ).order_by('-created_at')[:5]:
        events.append({
            "type": "registration",
            "title": "New Patient Registered",
            "description": f"{pat.first_name} {pat.last_name}",
            "detail": f"ID: {pat.hospital_patient_id or pat.id}",
            "time": pat.created_at.strftime("%I:%M %p"),
            "icon": "user-plus",
        })

    # Recent invoices
    for inv in Invoice.objects.filter(
        hospital=hospital, created_at__date=today
    ).select_related('patient').order_by('-created_at')[:3]:
        events.append({
            "type": "invoice",
            "title": f"Invoice {inv.invoice_number}",
            "description": f"{inv.patient} — ₹{inv.total or 0:,.0f}",
            "detail": inv.status.title(),
            "time": inv.created_at.strftime("%I:%M %p"),
            "icon": "file-text",
        })

    # Recent alerts
    for alert in MedicalAlert.objects.filter(
        hospital=hospital, created_at__date=today
    ).select_related('patient').order_by('-created_at')[:3]:
        events.append({
            "type": "alert",
            "title": f"Alert: {alert.get_alert_type_display()}",
            "description": f"{alert.patient} — {alert.message[:80]}",
            "detail": alert.get_severity_display(),
            "time": alert.created_at.strftime("%I:%M %p"),
            "icon": "alert-triangle",
        })

    # Sort by time descending
    events.sort(key=lambda e: e["time"], reverse=True)
    return events[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
#  PATIENT FLOW (Today)
# ═══════════════════════════════════════════════════════════════════════════════


def get_patient_flow(hospital):
    """Return today's patient flow metrics."""
    today = date.today()
    yesterday = today - timedelta(days=1)

    admissions = Encounter.objects.filter(
        hospital=hospital,
        created_at__date=today,
        encounter_type__in=['IPD', 'EMERGENCY'],
    ).count()
    admissions_yesterday = Encounter.objects.filter(
        hospital=hospital,
        created_at__date=yesterday,
        encounter_type__in=['IPD', 'EMERGENCY'],
    ).count()

    opd_visits = Encounter.objects.filter(
        hospital=hospital,
        created_at__date=today,
        encounter_type__in=['OPD', 'HOME'],
    ).count()
    opd_yesterday = Encounter.objects.filter(
        hospital=hospital,
        created_at__date=yesterday,
        encounter_type__in=['OPD', 'HOME'],
    ).count()

    discharges = Encounter.objects.filter(
        hospital=hospital,
        status='COMPLETED',
        completed_at__date=today,
    ).count()
    discharges_yesterday = Encounter.objects.filter(
        hospital=hospital,
        status='COMPLETED',
        completed_at__date=yesterday,
    ).count()

    total_beds = 0  # Placeholder — bed management not in scope yet
    occupied_beds = Encounter.objects.filter(
        hospital=hospital,
        status__in=['IN_PROGRESS', 'PLANNED'],
        bed_number__isnull=False,
    ).exclude(bed_number='').count()

    def fmt_change(today_val, yesterday_val):
        if yesterday_val == 0:
            return f"+{today_val}" if today_val > 0 else "0"
        diff = today_val - yesterday_val
        pct = round(abs(diff) / yesterday_val * 100, 0)
        return f"+{int(pct)}%" if diff > 0 else f"-{int(pct)}%"

    return {
        "admissions": {
            "value": admissions,
            "change": fmt_change(admissions, admissions_yesterday),
            "direction": "up" if admissions >= admissions_yesterday else "down",
        },
        "opd_visits": {
            "value": opd_visits,
            "change": fmt_change(opd_visits, opd_yesterday),
            "direction": "up" if opd_visits >= opd_yesterday else "down",
        },
        "discharges": {
            "value": discharges,
            "change": fmt_change(discharges, discharges_yesterday),
            "direction": "up" if discharges >= discharges_yesterday else "down",
        },
        "bed_occupancy": {
            "value": f"{occupied_beds}/{total_beds}" if total_beds > 0 else str(occupied_beds),
            "change": f"{round(occupied_beds / max(total_beds, 1) * 100, 0) if total_beds > 0 else 0}%",
            "direction": "neutral",
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  DEPARTMENT OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════


def get_department_overview(hospital):
    """Return department-level patient counts with occupancy percentages."""
    today = date.today()
    dept_stats = []

    departments = Department.objects.filter(hospital=hospital)
    total_encounters_today = max(
        Encounter.objects.filter(hospital=hospital, created_at__date=today).count(),
        1,
    )

    for dept in departments:
        dept_encounters = Encounter.objects.filter(
            hospital=hospital, department=dept.name, created_at__date=today
        ).count()
        pct = round((dept_encounters / total_encounters_today) * 100, 1)

        staff_count = HospitalUserProfile.objects.filter(
            hospital=hospital,
            department=dept.name if hasattr(dept, 'name') else '',
        ).count()

        dept_stats.append({
            "name": dept.name,
            "sub": f"{staff_count} staff" if staff_count > 0 else "No staff",
            "pct": pct,
            "stat": str(dept_encounters),
            "statLabel": "patients",
        })

    # Sort by count descending
    dept_stats.sort(key=lambda d: int(d["stat"]), reverse=True)
    return dept_stats


# ═══════════════════════════════════════════════════════════════════════════════
#  AI INSIGHTS
# ═══════════════════════════════════════════════════════════════════════════════


def get_ai_insights(hospital):
    """Return AI-generated insights based on current hospital data.

    In a production system this would call an ML service. For now
    we generate rule-based insights from the available data.
    """
    today = date.today()
    insights = []

    # Insight 1: Alert volume
    active_alerts = MedicalAlert.objects.filter(
        hospital=hospital, status__in=['ACTIVE', 'ACKNOWLEDGED']
    ).count()
    if active_alerts > 5:
        insights.append({
            "title": "High Alert Volume",
            "description": f"{active_alerts} active alerts require attention. Consider reviewing triage protocols.",
            "severity": "red",
            "icon": "alert-triangle",
        })

    # Insight 2: Registration trend
    week_ago = today - timedelta(days=7)
    registrations_7d = Patient.objects.filter(
        hospital=hospital, created_at__date__gte=week_ago
    ).count()
    prev_7d = Patient.objects.filter(
        hospital=hospital,
        created_at__date__gte=week_ago - timedelta(days=7),
        created_at__date__lt=week_ago,
    ).count()
    if registrations_7d > prev_7d and prev_7d > 0:
        pct = round((registrations_7d - prev_7d) / prev_7d * 100, 0)
        insights.append({
            "title": f"Patient Growth +{int(pct)}%",
            "description": f"{registrations_7d} new patients this week vs {prev_7d} last week.",
            "severity": "green",
            "icon": "trending-up",
        })

    # Insight 3: Encounter load
    encounters_today = Encounter.objects.filter(
        hospital=hospital, created_at__date=today
    ).count()
    if encounters_today > 30:
        insights.append({
            "title": "High Patient Volume Today",
            "description": f"{encounters_today} encounters today — above average. Consider allocating additional staff.",
            "severity": "orange",
            "icon": "users",
        })
    elif encounters_today < 5 and registrations_7d > 10:
        # Low encounter rate despite many registrations
        insights.append({
            "title": "Follow-up Opportunity",
            "description": f"Only {encounters_today} encounters today despite {registrations_7d} recent registrations.",
            "severity": "orange",
            "icon": "clipboard-list",
        })

    # Insight 4: Invoice backlog
    pending_invoices = Invoice.objects.filter(
        hospital=hospital, status__in=['DRAFT', 'PENDING']
    ).count()
    if pending_invoices > 10:
        insights.append({
            "title": "Invoice Backlog",
            "description": f"{pending_invoices} invoices pending. Consider batch processing to improve cash flow.",
            "severity": "orange",
            "icon": "file-text",
        })

    # Insight 5: Positive trend
    if registrations_7d > 0 and prev_7d == 0:
        insights.append({
            "title": "Steady Patient Inflow",
            "description": f"{registrations_7d} new patients this week — the hospital is seeing consistent growth.",
            "severity": "green",
            "icon": "trending-up",
        })

    return insights[:5]
