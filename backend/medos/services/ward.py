"""
Ward/IPD service layer — bed assignment, round management, discharge, transfer.

All business logic lives here. Views are thin adapters (3-10 lines).
Every significant state change writes to SystemActivityLog.
"""
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from django.core.exceptions import ValidationError

from ..models import (
    Bed, Ward, DailyRound, NursingNote, MedicationAdministration,
    Encounter, Prescription, Medication, SystemActivityLog,
    BillingAccrual,
)
from ..pharmacy import services as pharmacy_services


# ═══════════════════════════════════════════════════════════════════════════════
#  BED MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════


def get_bed_map(hospital, ward_id=None):
    """Return full bed map for a hospital, optionally filtered by ward.

    Returns a list of wards with their beds and patient info.
    """
    qs = Ward.objects.filter(hospital=hospital, is_active=True).prefetch_related(
        Prefetch(
            'beds',
            queryset=Bed.objects.select_related(
                'current_encounter__patient',
                'current_encounter__doctor',
            ).order_by('bed_number'),
        ),
    ).order_by('name')

    if ward_id:
        qs = qs.filter(id=ward_id)

    result = []
    for ward in qs:
        beds_data = []
        for bed in ward.beds.all():
            bed_entry = {
                'id': str(bed.id),
                'bed_number': bed.bed_number,
                'status': bed.status,
                'status_label': bed.get_status_display(),
                'notes': bed.notes,
            }
            if bed.current_encounter:
                enc = bed.current_encounter
                patient = enc.patient
                bed_entry['patient'] = {
                    'id': str(patient.id),
                    'name': patient.full_name,
                    'gender': patient.get_gender_display() if patient.gender else '',
                    'age': patient.age,
                    'phone': patient.phone,
                }
                bed_entry['encounter'] = {
                    'id': str(enc.id),
                    'encounter_type': enc.encounter_type,
                    'clinical_acuity': enc.clinical_acuity,
                    'admitted_at': enc.created_at.isoformat() if enc.created_at else '',
                    'days_admitted': (timezone.now().date() - enc.created_at.date()).days if enc.created_at else 0,
                    'diagnosis': enc.diagnosis,
                    'doctor_name': enc.doctor.get_full_name() or str(enc.doctor) if enc.doctor else '',
                }
            beds_data.append(bed_entry)

        result.append({
            'id': str(ward.id),
            'name': ward.name,
            'ward_type': ward.ward_type,
            'ward_type_label': ward.get_ward_type_display(),
            'bed_charge_per_day': str(ward.bed_charge_per_day),
            'floor': ward.floor,
            'total_beds': ward.total_beds,
            'available_beds': ward.available_beds,
            'occupied_beds': ward.occupied_beds,
            'beds': beds_data,
        })

    return result


@transaction.atomic
def assign_bed(encounter_id, bed_id, hospital):
    """Assign a patient (encounter) to a bed.

    - Validates bed is available
    - Sets bed status to OCCUPIED
    - Links encounter to bed
    - Updates encounter to IPD type and IN_PROGRESS status
    - Logs the activity

    Uses select_for_update() to prevent double-assignment.
    """
    encounter = Encounter.objects.select_for_update().get(
        id=encounter_id,
        hospital=hospital,
    )
    bed = Bed.objects.select_for_update().get(
        id=bed_id,
        ward__hospital=hospital,
    )

    if bed.status != Bed.Status.AVAILABLE:
        raise ValidationError(
            f"Bed {bed.bed_number} is currently {bed.get_status_display()}. "
            f"Only available beds can be assigned."
        )

    if bed.current_encounter:
        raise ValidationError(
            f"Bed {bed.bed_number} already has an active encounter assigned."
        )

    # Assign bed
    bed.status = Bed.Status.OCCUPIED
    bed.current_encounter = encounter
    bed.save(update_fields=['status', 'current_encounter', 'updated_at'])

    # Update encounter
    encounter.encounter_type = 'IPD'
    encounter.status = 'IN_PROGRESS'
    encounter.bed_number = bed.bed_number
    encounter.save(update_fields=['encounter_type', 'status', 'bed_number'])

    # Log activity
    SystemActivityLog.objects.create(
        hospital=hospital,
        event_type='ADMISSION',
        patient=encounter.patient,
        encounter=encounter,
        description=f"Patient admitted to {bed.ward.name}, Bed {bed.bed_number}",
        author_name=encounter.doctor.get_full_name() if encounter.doctor else 'System',
        metadata={
            'ward_id': str(bed.ward.id),
            'ward_name': bed.ward.name,
            'bed_id': str(bed.id),
            'bed_number': bed.bed_number,
        },
    )

    return bed


@transaction.atomic
def release_bed(bed_id, hospital):
    """Release a bed — used during discharge or transfer.

    Sets bed to AVAILABLE, clears the encounter link.
    """
    bed = Bed.objects.select_for_update().get(
        id=bed_id,
        ward__hospital=hospital,
        status=Bed.Status.OCCUPIED,
    )

    encounter = bed.current_encounter

    bed.status = Bed.Status.AVAILABLE
    bed.current_encounter = None
    bed.save(update_fields=['status', 'current_encounter', 'updated_at'])

    return bed, encounter


@transaction.atomic
def transfer_patient(encounter_id, destination_bed_id, hospital, requested_by, reason=''):
    """Transfer a patient from their current bed to a destination bed.

    - Releases current bed
    - Assigns destination bed
    - Logs the transfer activity
    - Same encounter continues (no restart)
    """
    encounter = Encounter.objects.select_for_update().get(
        id=encounter_id,
        hospital=hospital,
    )

    # Find current bed
    current_bed = Bed.objects.filter(
        current_encounter=encounter,
        ward__hospital=hospital,
        status=Bed.Status.OCCUPIED,
    ).first()

    if not current_bed:
        raise ValidationError("Patient is not currently assigned to any bed.")

    # Find and validate destination bed
    dest_bed = Bed.objects.select_for_update().get(
        id=destination_bed_id,
        ward__hospital=hospital,
    )

    if dest_bed.status != Bed.Status.AVAILABLE:
        raise ValidationError(
            f"Destination bed {dest_bed.bed_number} is not available "
            f"(currently {dest_bed.get_status_display()})."
        )

    if dest_bed.current_encounter:
        raise ValidationError(
            f"Destination bed {dest_bed.bed_number} already has an encounter assigned."
        )

    # Release current bed
    current_bed.status = Bed.Status.AVAILABLE
    current_bed.current_encounter = None
    current_bed.save(update_fields=['status', 'current_encounter', 'updated_at'])

    # Assign destination bed
    dest_bed.status = Bed.Status.OCCUPIED
    dest_bed.current_encounter = encounter
    dest_bed.save(update_fields=['status', 'current_encounter', 'updated_at'])

    # Update encounter
    encounter.bed_number = dest_bed.bed_number
    encounter.save(update_fields=['bed_number'])

    # Log transfer activity
    SystemActivityLog.objects.create(
        hospital=hospital,
        event_type='ADMISSION',
        patient=encounter.patient,
        encounter=encounter,
        description=(
            f"Patient transferred from {current_bed.ward.name} Bed {current_bed.bed_number} "
            f"to {dest_bed.ward.name} Bed {dest_bed.bed_number}"
            + (f" — {reason}" if reason else "")
        ),
        author_name=requested_by.get_full_name() or requested_by.username,
        metadata={
            'from_ward_id': str(current_bed.ward.id),
            'from_ward_name': current_bed.ward.name,
            'from_bed_id': str(current_bed.id),
            'from_bed_number': current_bed.bed_number,
            'to_ward_id': str(dest_bed.ward.id),
            'to_ward_name': dest_bed.ward.name,
            'to_bed_id': str(dest_bed.id),
            'to_bed_number': dest_bed.bed_number,
            'reason': reason,
        },
    )

    return dest_bed


# ═══════════════════════════════════════════════════════════════════════════════
#  DAILY ROUNDS
# ═══════════════════════════════════════════════════════════════════════════════


def get_or_create_daily_round(encounter_id, hospital, conducted_by):
    """Get today's draft round for an encounter, or create one."""
    today = timezone.localdate()
    encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)

    round_obj, created = DailyRound.objects.get_or_create(
        encounter=encounter,
        round_date=today,
        defaults={
            'hospital': hospital,
            'conducted_by': conducted_by,
            'status': 'draft',
        },
    )
    return round_obj, created


def get_patient_rounds(encounter_id, hospital):
    """Get all daily rounds for a patient encounter."""
    return DailyRound.objects.filter(
        encounter_id=encounter_id,
        encounter__hospital=hospital,
    ).select_related(
        'conducted_by', 'prescription',
    ).prefetch_related(
        'prescription__medications',
    ).order_by('-round_date', '-created_at')


@transaction.atomic
def finalise_round(round_id, hospital, prescription_data=None, notes=None):
    """Finalise a daily round.

    When a doctor clicks "Submit Round":
    1. Validates the round is in draft state
    2. Creates/submits a Prescription (if medications given)
    3. Links the prescription to the round
    4. Sets round status to finalised
    5. Logs the activity
    """
    round_obj = DailyRound.objects.select_related('encounter').get(
        id=round_id,
        encounter__hospital=hospital,
    )

    if round_obj.status == 'finalised':
        raise ValidationError("This round has already been finalised.")

    encounter = round_obj.encounter

    # If there's prescription data, create and submit a prescription
    prescription = None
    if prescription_data and prescription_data.get('medications'):
        # Create a new Prescription via pharmacy service
        prescription = Prescription.objects.create(
            encounter=encounter,
            hospital=hospital,
            status='ORDERED',
            version=getattr(
                Prescription.objects.filter(encounter=encounter).order_by('-version').first(),
                'version', 0
            ) + 1,
            ordered_by=round_obj.conducted_by,
            ordered_at=timezone.now(),
            notes=prescription_data.get('notes', ''),
        )

        for med_data in prescription_data['medications']:
            Medication.objects.create(
                encounter=encounter,
                prescription=prescription,
                hospital=hospital,
                drug_name=med_data['drug_name'],
                dosage=med_data.get('dosage', ''),
                frequency=med_data.get('frequency', ''),
                route=med_data.get('route', 'Oral'),
                quantity=med_data.get('quantity', 1),
                instructions=med_data.get('instructions', ''),
                is_active=True,
                prescribed_by=round_obj.conducted_by,
            )

        # Update encounter
        encounter.status = 'IN_PROGRESS'
        encounter.save(update_fields=['status'])

    # Update notes if provided
    if notes is not None:
        round_obj.notes = notes

    # Finalise round
    round_obj.finalise(prescription)

    # Log activity
    SystemActivityLog.objects.create(
        hospital=hospital,
        event_type='MEDICATION',
        patient=encounter.patient,
        encounter=encounter,
        description=(
            f"Daily round completed for {encounter.patient.full_name} "
            f"by Dr. {round_obj.conducted_by.get_full_name() or round_obj.conducted_by.username}"
            + (f" — {len(prescription_data['medications'])} medications ordered" if prescription_data and prescription_data.get('medications') else "")
        ),
        author_name=round_obj.conducted_by.get_full_name() or round_obj.conducted_by.username,
        metadata={
            'round_id': str(round_obj.id),
            'round_date': str(round_obj.round_date),
            'prescription_id': str(prescription.id) if prescription else None,
            'medication_count': len(prescription_data['medications']) if prescription_data and prescription_data.get('medications') else 0,
        },
    )

    return round_obj


# ═══════════════════════════════════════════════════════════════════════════════
#  DISCHARGE WORKFLOW
# ═══════════════════════════════════════════════════════════════════════════════


def get_discharge_readiness(encounter_id, hospital):
    """Check if a patient can be discharged.

    Returns dict with:
    - can_discharge: bool
    - blocks: list of reasons discharge is blocked
    - summary: discharge summary fields
    """
    encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)
    blocks = []

    # Check 1: Pending lab results
    pending_labs = encounter.lab_results.filter(
        status__in=['ORDERED', 'IN_PROGRESS'],
    ).count()
    if pending_labs > 0:
        blocks.append({
            'type': 'pending_labs',
            'message': f'{pending_labs} lab result(s) still pending.',
        })

    # Check 2: Pending pharmacy items
    pending_meds = Medication.objects.filter(
        encounter=encounter,
        is_active=True,
        prescription__status__in=['ORDERED', 'IN_PROGRESS', 'DRAFT'],
    ).count()
    if pending_meds > 0:
        blocks.append({
            'type': 'pending_medications',
            'message': f'{pending_meds} medication(s) not yet dispensed.',
        })

    # Check 3: Unpaid invoices
    from ..models import Invoice
    unpaid_invoices = Invoice.objects.filter(
        encounter=encounter,
    ).exclude(status='PAID').exclude(status='CANCELLED').count()
    if unpaid_invoices > 0:
        blocks.append({
            'type': 'unpaid_invoices',
            'message': f'{unpaid_invoices} invoice(s) not yet paid.',
        })

    # Check 4: Active alerts
    from ..models import MedicalAlert
    active_alerts = MedicalAlert.objects.filter(
        encounter=encounter,
        status='ACTIVE',
    ).count()
    if active_alerts > 0:
        blocks.append({
            'type': 'active_alerts',
            'message': f'{active_alerts} active alert(s) require attention.',
        })

    return {
        'can_discharge': len(blocks) == 0,
        'blocks': blocks,
        'encounter_id': str(encounter.id),
        'patient_name': encounter.patient.full_name,
    }


@transaction.atomic
def discharge_patient(encounter_id, hospital, discharged_by, discharge_data):
    """Execute the discharge workflow.

    Steps:
    1. Check discharge readiness (all blocks cleared)
    2. Release the bed
    3. Update encounter status to DISCHARGED (or COMPLETED)
    4. Record discharge summary
    5. Generate discharge summary
    6. Log activity
    """
    readiness = get_discharge_readiness(encounter_id, hospital)
    if not readiness['can_discharge']:
        raise ValidationError(
            "Cannot discharge: " + "; ".join(
                b['message'] for b in readiness['blocks']
            )
        )

    encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)

    # Release bed if assigned
    bed = Bed.objects.filter(
        current_encounter=encounter,
        ward__hospital=hospital,
    ).first()
    if bed:
        bed.status = Bed.Status.AVAILABLE
        bed.current_encounter = None
        bed.save(update_fields=['status', 'current_encounter', 'updated_at'])

    # Update encounter
    encounter.status = 'COMPLETED'
    encounter.completed_at = timezone.now()
    encounter.diagnosis = discharge_data.get('discharge_diagnosis', encounter.diagnosis)
    encounter.clinical_notes = discharge_data.get('follow_up_instructions', encounter.clinical_notes)
    encounter.save(update_fields=[
        'status', 'completed_at', 'diagnosis', 'clinical_notes',
    ])

    # Generate discharge summary (stored as a PatientDocument)
    from ..models import PatientDocument
    discharge_summary_text = (
        f"Discharge Summary\n"
        f"=================\n"
        f"Patient: {encounter.patient.full_name}\n"
        f"Admitted: {encounter.created_at.date() if encounter.created_at else 'N/A'}\n"
        f"Discharged: {timezone.now().date()}\n"
        f"Discharge Diagnosis: {discharge_data.get('discharge_diagnosis', '')}\n"
        f"Condition at Discharge: {discharge_data.get('condition_at_discharge', '')}\n"
        f"Follow-up Instructions: {discharge_data.get('follow_up_instructions', '')}\n"
        f"Discharge Medications: {discharge_data.get('discharge_medications', '')}\n"
    )
    PatientDocument.objects.create(
        patient=encounter.patient,
        encounter=encounter,
        document_type='DISCHARGE_SUMMARY',
        title=f'Discharge Summary — {timezone.now().date()}',
        description=discharge_summary_text,
        file_url='',
        notes=f'Discharged by {discharged_by.get_full_name() or discharged_by.username}',
        uploaded_by=discharged_by,
        hospital=hospital,
    )

    # Log discharge activity
    SystemActivityLog.objects.create(
        hospital=hospital,
        event_type='DISCHARGE',
        patient=encounter.patient,
        encounter=encounter,
        description=(
            f"Patient {encounter.patient.full_name} discharged. "
            f"Diagnosis: {discharge_data.get('discharge_diagnosis', 'Not specified')}"
        ),
        author_name=discharged_by.get_full_name() or discharged_by.username,
        metadata={
            'discharge_diagnosis': discharge_data.get('discharge_diagnosis', ''),
            'condition_at_discharge': discharge_data.get('condition_at_discharge', ''),
            'bed_released': bool(bed),
        },
    )

    return encounter


# ═══════════════════════════════════════════════════════════════════════════════
#  NURSING STATION
# ═══════════════════════════════════════════════════════════════════════════════


def get_nursing_station(hospital, ward_id=None):
    """Get the nursing station view data.

    Returns:
    - Pending medication administrations
    - Vitals due (not recorded in last 4 hours)
    - Pending nursing tasks
    - Alerts
    """
    from ..models import Vitals, MedicalAlert

    now = timezone.now()
    four_hours_ago = now - timedelta(hours=4)

    # Build base query
    bed_qs = Bed.objects.filter(
        hospital=hospital,
        status=Bed.Status.OCCUPIED,
    ).select_related(
        'current_encounter__patient',
        'current_encounter__doctor',
        'ward',
    )

    if ward_id:
        bed_qs = bed_qs.filter(ward_id=ward_id)

    pending_medications = []
    vitals_due = []
    alerts = []

    for bed in bed_qs:
        encounter = bed.current_encounter
        patient = encounter.patient

        # Pending medication administrations
        active_meds = Medication.objects.filter(
            encounter=encounter,
            is_active=True,
        ).exclude(
            id__in=MedicationAdministration.objects.filter(
                encounter=encounter,
                administered_at__date=now.date(),
            ).values('medication_id'),
        )

        for med in active_meds[:3]:  # Limit per patient
            pending_medications.append({
                'bed_number': bed.bed_number,
                'patient_name': patient.full_name,
                'patient_id': str(patient.id),
                'encounter_id': str(encounter.id),
                'medication_id': str(med.id),
                'drug_name': med.drug_name,
                'dosage': med.dosage,
                'route': med.route,
                'frequency': med.frequency,
            })

        # Vitals due (not recorded in last 4 hours)
        last_vitals = Vitals.objects.filter(
            encounter=encounter,
        ).order_by('-recorded_at').first()

        if not last_vitals or last_vitals.recorded_at < four_hours_ago:
            since = (
                'Never recorded'
                if not last_vitals
                else f'Last recorded {int((now - last_vitals.recorded_at).total_seconds() / 3600)} hours ago'
            )
            vitals_due.append({
                'bed_number': bed.bed_number,
                'patient_name': patient.full_name,
                'patient_id': str(patient.id),
                'encounter_id': str(encounter.id),
                'last_recorded': since,
                'needs_vitals': True,
            })

        # Active alerts for this patient
        patient_alerts = MedicalAlert.objects.filter(
            encounter=encounter,
            status='ACTIVE',
        )[:2]
        for alert in patient_alerts:
            alerts.append({
                'bed_number': bed.bed_number,
                'patient_name': patient.full_name,
                'patient_id': str(patient.id),
                'encounter_id': str(encounter.id),
                'alert_id': str(alert.id),
                'severity': alert.severity,
                'message': alert.message,
                'created_at': alert.created_at.isoformat(),
            })

    return {
        'pending_medications': pending_medications,
        'vitals_due': vitals_due,
        'alerts': alerts,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  NURSING NOTES
# ═══════════════════════════════════════════════════════════════════════════════


def create_nursing_note(encounter_id, hospital, recorded_by, note_text):
    """Create a nursing note for an encounter."""
    encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)

    note = NursingNote.objects.create(
        hospital=hospital,
        encounter=encounter,
        recorded_by=recorded_by,
        note=note_text,
    )

    SystemActivityLog.objects.create(
        hospital=hospital,
        event_type='SYSTEM',
        patient=encounter.patient,
        encounter=encounter,
        description=f"Nursing note recorded by {recorded_by.get_full_name() or recorded_by.username}",
        author_name=recorded_by.get_full_name() or recorded_by.username,
        metadata={'note_id': str(note.id)},
    )

    return note


# ═══════════════════════════════════════════════════════════════════════════════
#  MEDICATION ADMINISTRATION (Nurse → Patient)
# ═══════════════════════════════════════════════════════════════════════════════


@transaction.atomic
def administer_medication(encounter_id, medication_id, hospital, administered_by, data):
    """Record a nurse administering a medication to a patient."""
    encounter = Encounter.objects.get(id=encounter_id, hospital=hospital)
    medication = Medication.objects.get(id=medication_id, encounter=encounter, hospital=hospital)

    admin_record = MedicationAdministration.objects.create(
        hospital=hospital,
        encounter=encounter,
        medication=medication,
        administered_by=administered_by,
        administered_at=data.get('administered_at', timezone.now()),
        dose_given=data.get('dose_given', medication.dosage),
        route=data.get('route', medication.route),
        notes=data.get('notes', ''),
    )

    SystemActivityLog.objects.create(
        hospital=hospital,
        event_type='MEDICATION',
        patient=encounter.patient,
        encounter=encounter,
        description=(
            f"Medication administered: {medication.drug_name} {admin_record.dose_given} "
            f"by {administered_by.get_full_name() or administered_by.username}"
        ),
        author_name=administered_by.get_full_name() or administered_by.username,
        metadata={
            'medication_id': str(medication.id),
            'drug_name': medication.drug_name,
            'dose_given': admin_record.dose_given,
            'administration_id': str(admin_record.id),
        },
    )

    return admin_record


# ═══════════════════════════════════════════════════════════════════════════════
#  BED CHARGE ACCRUAL (Called by Celery)
# ═══════════════════════════════════════════════════════════════════════════════


def accrue_daily_bed_charges(hospital=None):
    """Accrue bed charges for all active IPD encounters.

    Creates BillingAccrual records for each occupied bed.
    Called by Celery beat at midnight.

    If hospital is None, processes all hospitals.
    """
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    beds = Bed.objects.filter(
        status=Bed.Status.OCCUPIED,
        current_encounter__isnull=False,
    ).select_related(
        'current_encounter',
        'ward',
        'hospital',
    )

    if hospital:
        beds = beds.filter(hospital=hospital)

    created_count = 0
    for bed in beds:
        encounter = bed.current_encounter
        ward = bed.ward

        # Avoid duplicate accruals for the same encounter+type+date
        _, was_created = BillingAccrual.objects.get_or_create(
            encounter=encounter,
            accrual_type='bed_charge',
            date=yesterday,
            defaults={
                'hospital': bed.hospital,
                'description': f"Bed Charge — {ward.name} ({bed.bed_number})",
                'amount': ward.bed_charge_per_day,
                'is_invoiced': False,
            },
        )
        if was_created:
            created_count += 1

    return created_count
