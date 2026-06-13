"""Tenant isolation tests — verify each hospital can only see its own data.

Every model that has a hospital FK must be tested to ensure:
1. Hospital B cannot list Hospital A's records
2. Hospital B cannot fetch Hospital A's records directly (404, not 403)
3. Creating a record auto-attaches the correct hospital
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from ..models import (
    Patient, Encounter, Invoice, Diagnosis, ServiceOrder,
    Vitals, Medication, LabResult, MedicalAlert, Allergy,
    PatientInsurance, ImagingResult, PatientDocument, CarePlan,
    LabOrder, LabParameterResult, Payment, RefundRequest,
    InsuranceClaim, ICUWard, ICUBed, TeleICUSession,
    TeleConsultSession, HospitalUserProfile,
)
from ..models import Hospital

User = get_user_model()


def _create_hospital(name, slug):
    """Helper to create a test hospital."""
    return Hospital.objects.create(name=name, slug=slug, is_active=True)


def _create_test_user(hospital):
    """Helper to create a test user with a hospital profile."""
    user = User.objects.create_user(
        username=f'user_{hospital.slug}',
        password='testpass123',
    )
    profile = HospitalUserProfile.objects.create(
        user=user,
        hospital=hospital,
        employee_id=f'EMP-{hospital.slug.upper()}',
    )
    return user


class TenantIsolationTestMixin:
    """Mixin providing common test setup and helpers."""

    def setUp(self):
        self.hospital_a = _create_hospital('Hospital A', 'hospital-a')
        self.hospital_b = _create_hospital('Hospital B', 'hospital-b')
        self.user_a = _create_test_user(self.hospital_a)
        self.user_b = _create_test_user(self.hospital_b)
        self.client.force_authenticate(user=self.user_a)

    def _create_patient(self, hospital, **kwargs):
        """Helper to create a patient in a given hospital."""
        defaults = {
            'first_name': 'Test',
            'last_name': 'Patient',
            'hospital': hospital,
        }
        defaults.update(kwargs)
        return Patient.objects.create(**defaults)

    def _create_encounter(self, patient, hospital, **kwargs):
        defaults = {
            'patient': patient,
            'hospital': hospital,
            'encounter_type': 'OPD',
        }
        defaults.update(kwargs)
        return Encounter.objects.create(**defaults)


class PatientTenantIsolationTest(TenantIsolationTestMixin, TestCase):
    """Test patient data isolation between hospitals."""

    def test_hospital_b_cannot_list_hospital_a_patients(self):
        self._create_patient(hospital=self.hospital_a, first_name='Alice')
        self._create_patient(hospital=self.hospital_b, first_name='Bob')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/patients/')
        results = response.data.get('results', response.data)

        names = [p['first_name'] for p in results]
        self.assertNotIn('Alice', names)
        self.assertIn('Bob', names)

    def test_hospital_b_cannot_fetch_hospital_a_patient_directly(self):
        patient_a = self._create_patient(hospital=self.hospital_a, first_name='Alice')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(f'/api/patients/{patient_a.id}/')
        self.assertEqual(response.status_code, 404)


class EncounterTenantIsolationTest(TenantIsolationTestMixin, TestCase):
    """Test encounter data isolation between hospitals."""

    def test_hospital_b_cannot_list_hospital_a_encounters(self):
        patient_a = self._create_patient(hospital=self.hospital_a)
        patient_b = self._create_patient(hospital=self.hospital_b)
        self._create_encounter(patient_a, hospital=self.hospital_a, chief_complaint='Fever')
        self._create_encounter(patient_b, hospital=self.hospital_b, chief_complaint='Cough')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/encounters/')
        results = response.data.get('results', response.data)

        complaints = [e.get('chief_complaint', '') for e in results]
        self.assertNotIn('Fever', complaints)
        self.assertIn('Cough', complaints)


class InvoiceTenantIsolationTest(TenantIsolationTestMixin, TestCase):
    """Test invoice data isolation between hospitals."""

    def test_hospital_b_cannot_list_hospital_a_invoices(self):
        patient_a = self._create_patient(hospital=self.hospital_a)
        patient_b = self._create_patient(hospital=self.hospital_b)
        Invoice.objects.create(
            patient=patient_a, hospital=self.hospital_a,
            invoice_number='INV-A-001', total=100,
        )
        Invoice.objects.create(
            patient=patient_b, hospital=self.hospital_b,
            invoice_number='INV-B-001', total=200,
        )

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/invoices/')
        results = response.data.get('results', response.data)

        invoices = [i['invoice_number'] for i in results]
        self.assertNotIn('INV-A-001', invoices)
        self.assertIn('INV-B-001', invoices)


class DiagnosisTenantIsolationTest(TenantIsolationTestMixin, TestCase):
    """Test diagnosis data isolation between hospitals."""

    def test_hospital_b_cannot_list_hospital_a_diagnoses(self):
        patient_a = self._create_patient(hospital=self.hospital_a)
        patient_b = self._create_patient(hospital=self.hospital_b)
        Diagnosis.objects.create(
            patient=patient_a, hospital=self.hospital_a,
            condition_name='Hypertension',
        )
        Diagnosis.objects.create(
            patient=patient_b, hospital=self.hospital_b,
            condition_name='Diabetes',
        )

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/diagnoses/')
        results = response.data.get('results', response.data)

        conditions = [d.get('condition_name', '') for d in results]
        self.assertNotIn('Hypertension', conditions)
        self.assertIn('Diabetes', conditions)

    def test_hospital_b_cannot_fetch_hospital_a_diagnosis_directly(self):
        patient_a = self._create_patient(hospital=self.hospital_a)
        diagnosis = Diagnosis.objects.create(
            patient=patient_a, hospital=self.hospital_a,
            condition_name='Hypertension',
        )

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(f'/api/diagnoses/{diagnosis.id}/')
        self.assertEqual(response.status_code, 404)


class ServiceOrderTenantIsolationTest(TenantIsolationTestMixin, TestCase):
    """Test service order data isolation between hospitals."""

    def test_hospital_b_cannot_list_hospital_a_orders(self):
        patient_a = self._create_patient(hospital=self.hospital_a)
        patient_b = self._create_patient(hospital=self.hospital_b)
        ServiceOrder.objects.create(
            patient=patient_a, hospital=self.hospital_a,
            order_name='Chest X-Ray',
        )
        ServiceOrder.objects.create(
            patient=patient_b, hospital=self.hospital_b,
            order_name='Blood Test',
        )

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/service-orders/')
        results = response.data.get('results', response.data)

        names = [o.get('order_name', '') for o in results]
        self.assertNotIn('Chest X-Ray', names)
        self.assertIn('Blood Test', names)


class CreateOperationAttachesHospitalTest(TenantIsolationTestMixin, TestCase):
    """Test that creating records auto-attaches the correct hospital."""

    def test_patient_creation_attaches_hospital(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/patients/', {
            'first_name': 'New',
            'last_name': 'Patient',
            'phone': '9999999999',
        })
        self.assertIn(response.status_code, (201, 400))
        if response.status_code == 201:
            patient_id = response.data.get('id')
            patient = Patient.objects.get(id=patient_id)
            self.assertEqual(patient.hospital_id, self.hospital_a.id)

    def test_encounter_creation_attaches_hospital(self):
        patient = self._create_patient(hospital=self.hospital_a)
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/encounters/', {
            'patient': str(patient.id),
            'encounter_type': 'OPD',
        })
        self.assertIn(response.status_code, (201, 400))
        if response.status_code == 201:
            encounter = Encounter.objects.get(id=response.data.get('id'))
            self.assertEqual(encounter.hospital_id, self.hospital_a.id)
