import pytest
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from medos.models import (
    Patient, Encounter, Vitals, Medication, SyncEntry,
    DrugInteraction, Invoice, InvoiceLineItem, MedicalAlert,
)

User = get_user_model()


@pytest.fixture
def user():
    return User.objects.create_user(
        username='doctor1',
        password='testpass123',
        email='doctor@hospital.com'
    )


@pytest.fixture
def patient(user):
    return Patient.objects.create(
        first_name='Ravi',
        last_name='Sharma',
        date_of_birth=date(1990, 5, 15),
        gender='M',
        phone='9876543210',
        city='Bangalore',
        created_by=user,
    )


@pytest.mark.django_db
class TestPatientModel:
    def test_create_patient(self, user):
        patient = Patient.objects.create(
            first_name='Priya',
            last_name='Patel',
            date_of_birth=date(1985, 3, 10),
            gender='F',
            phone='9876543211',
            created_by=user,
        )
        assert patient.full_name == 'Priya Patel'
        assert patient.age is not None
        assert patient.is_active is True
        assert str(patient) == 'Priya Patel'

    def test_patient_age(self, patient):
        expected_age = date.today().year - 1990 - (
            (date.today().month, date.today().day) < (5, 15)
        )
        assert patient.age == expected_age

    def test_patient_without_dob(self, user):
        patient = Patient.objects.create(
            first_name='Test',
            created_by=user,
        )
        assert patient.age is None

    def test_patient_hospital_id(self, patient):
        patient.hospital_patient_id = 'HMIS-001'
        patient.save()
        assert Patient.objects.filter(hospital_patient_id='HMIS-001').exists()

    def test_patient_search_by_phone(self, patient):
        assert Patient.objects.filter(phone='9876543210').exists()

    def test_patient_abha_id(self, user):
        patient = Patient.objects.create(
            first_name='ABHA', last_name='Test',
            abha_id='91-2345-6789-1234',
            created_by=user,
        )
        assert Patient.objects.filter(abha_id='91-2345-6789-1234').exists()


@pytest.mark.django_db
class TestEncounterModel:
    def test_create_encounter(self, patient, user):
        encounter = Encounter.objects.create(
            patient=patient,
            doctor=user,
            encounter_type='OPD',
            chief_complaint='Fever and cough for 3 days',
        )
        assert encounter.status == 'PLANNED'
        assert str(encounter) is not None
        assert encounter.patient == patient

    def test_encounter_with_vitals(self, patient, user):
        encounter = Encounter.objects.create(
            patient=patient,
            doctor=user,
            encounter_type='OPD',
        )
        vitals = Vitals.objects.create(
            encounter=encounter,
            recorded_by=user,
            systolic_bp=120,
            diastolic_bp=80,
            heart_rate=72,
            temperature=37.5,
            oxygen_saturation=98,
        )
        assert vitals in encounter.vitals.all()

    def test_encounter_with_medications(self, patient, user):
        encounter = Encounter.objects.create(
            patient=patient,
            doctor=user,
            encounter_type='OPD',
        )
        med = Medication.objects.create(
            encounter=encounter,
            drug_name='Paracetamol',
            dosage='500mg',
            frequency='Twice daily',
            duration='5 days',
            prescribed_by=user,
        )
        assert med in encounter.medications.all()
        assert str(med) == 'Paracetamol - 500mg Twice daily'

    def test_complete_encounter(self, patient, user):
        encounter = Encounter.objects.create(
            patient=patient,
            doctor=user,
            encounter_type='OPD',
        )
        encounter.status = 'COMPLETED'
        encounter.diagnosis = 'Upper respiratory tract infection'
        encounter.save()
        assert encounter.status == 'COMPLETED'


@pytest.mark.django_db
class TestSyncEntryModel:
    def test_create_sync_entry(self, user):
        entry = SyncEntry.objects.create(
            record_id='550e8400-e29b-41d4-a716-446655440000',
            model_name='patient',
            jsonb_snapshot={'name': 'Test'},
            version=1,
            source='online',
            created_by=user,
        )
        assert entry.model_name == 'patient'
        assert str(entry) == 'patient:550e8400-e29b-41d4-a716-446655440000 v1'

    def test_offline_sync_entry(self, user):
        entry = SyncEntry.objects.create(
            record_id='550e8400-e29b-41d4-a716-446655440001',
            model_name='patient',
            jsonb_snapshot={'name': 'Offline Patient'},
            version=1,
            source='offline',
            role_snapshot_hash='abc123hash',
            created_by=user,
        )
        assert entry.source == 'offline'
        assert entry.role_snapshot_hash == 'abc123hash'


@pytest.mark.django_db
class TestDrugInteractionModel:
    def test_create_interaction(self):
        interaction = DrugInteraction.objects.create(
            drug_a='Paracetamol',
            drug_b='Warfarin',
            severity='moderate',
            description='Increased bleeding risk',
            source='DDInter',
        )
        assert str(interaction) == 'Paracetamol x Warfarin (moderate)'
        assert DrugInteraction.objects.filter(severity='moderate').count() == 1

    def test_unique_pair(self):
        DrugInteraction.objects.create(
            drug_a='DrugA', drug_b='DrugB', severity='minor'
        )
        with pytest.raises(Exception):  # IntegrityError
            DrugInteraction.objects.create(
                drug_a='DrugA', drug_b='DrugB', severity='major'
            )


@pytest.mark.django_db
class TestInvoiceModel:
    def test_create_invoice(self, patient, user):
        invoice = Invoice.objects.create(
            patient=patient,
            invoice_type='OPD',
            invoice_number='MEDOS-20260609-0001',
            subtotal=500,
            tax=90,
            tax_percent=18,
            total=590,
            created_by=user,
        )
        assert invoice.status == 'DRAFT'
        assert str(invoice) is not None

    def test_invoice_line_items(self, patient, user):
        invoice = Invoice.objects.create(
            patient=patient,
            invoice_type='OPD',
            invoice_number='MEDOS-20260609-0002',
            subtotal=200,
            tax=36,
            total=236,
            created_by=user,
        )
        item = InvoiceLineItem.objects.create(
            invoice=invoice,
            description='Consultation fee',
            quantity=1,
            unit_price=200,
            total_price=200,
        )
        assert item in invoice.line_items.all()
        assert str(item) == 'Consultation fee x 1'

    def test_invoice_status_flow(self, patient, user):
        invoice = Invoice.objects.create(
            patient=patient,
            invoice_type='OPD',
            invoice_number='MEDOS-20260609-0003',
            subtotal=1000,
            tax=180,
            total=1180,
            created_by=user,
        )
        assert invoice.status == 'DRAFT'
        invoice.status = 'ISSUED'
        invoice.save()
        assert Invoice.objects.get(id=invoice.id).status == 'ISSUED'


@pytest.mark.django_db
class TestMedicalAlertModel:
    def test_create_alert(self, patient):
        alert = MedicalAlert.objects.create(
            alert_type='VITALS',
            severity='CRITICAL',
            patient=patient,
            message='Systolic BP > 180: Immediate attention required',
        )
        assert alert.status == 'ACTIVE'
        assert str(alert) is not None

    def test_alert_acknowledge(self, patient, user):
        alert = MedicalAlert.objects.create(
            alert_type='DDI',
            severity='WARNING',
            patient=patient,
            message='Drug interaction detected',
        )
        alert.status = 'ACKNOWLEDGED'
        alert.acknowledged_by = user
        alert.save()
        assert alert.status == 'ACKNOWLEDGED'
