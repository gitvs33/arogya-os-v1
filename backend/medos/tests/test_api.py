import pytest
import json
from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from medos.models import Patient, Encounter, Vitals, Medication, Invoice

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        username='doctor1',
        password='testpass123',
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def patient(user):
    return Patient.objects.create(
        first_name='Ravi',
        last_name='Sharma',
        date_of_birth=date(1990, 5, 15),
        gender='M',
        phone='9876543210',
        created_by=user,
    )


@pytest.mark.django_db
class TestPatientAPI:
    def test_list_patients_empty(self, auth_client):
        response = auth_client.get('/api/patients/')
        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_create_patient(self, auth_client):
        data = {
            'first_name': 'Priya',
            'last_name': 'Patel',
            'gender': 'F',
            'phone': '9876543211',
            'city': 'Mumbai',
        }
        response = auth_client.post('/api/patients/', data)
        assert response.status_code == 201
        assert response.data['first_name'] == 'Priya'
        assert response.data['phone'] == '9876543211'

    def test_list_patients(self, auth_client, patient):
        response = auth_client.get('/api/patients/')
        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_get_patient_detail(self, auth_client, patient):
        response = auth_client.get(f'/api/patients/{patient.id}/')
        assert response.status_code == 200
        assert response.data['full_name'] == 'Ravi Sharma'
        assert response.data['age'] is not None

    def test_update_patient(self, auth_client, patient):
        response = auth_client.patch(
            f'/api/patients/{patient.id}/',
            {'phone': '8888888888'}
        )
        assert response.status_code == 200
        assert response.data['phone'] == '8888888888'

    def test_search_patient(self, auth_client, patient):
        response = auth_client.get('/api/patients/?search=Ravi')
        assert response.status_code == 200
        assert response.data['count'] >= 1

    def test_patient_encounters_endpoint(self, auth_client, patient, user):
        Encounter.objects.create(patient=patient, doctor=user, encounter_type='OPD')
        response = auth_client.get(f'/api/patients/{patient.id}/encounters/')
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_unauthenticated_access(self, api_client):
        response = api_client.get('/api/patients/')
        # DRF returns 403 Forbidden when no auth credentials provided
        assert response.status_code in (401, 403)


@pytest.mark.django_db
class TestEncounterAPI:
    def test_create_encounter(self, auth_client, patient):
        data = {
            'patient': str(patient.id),
            'encounter_type': 'OPD',
            'chief_complaint': 'Headache for 2 days',
        }
        response = auth_client.post('/api/encounters/', data)
        assert response.status_code == 201
        assert 'id' in response.data
        assert response.data['encounter_type'] == 'OPD'

    def test_list_encounters(self, auth_client, patient, user):
        Encounter.objects.create(patient=patient, doctor=user, encounter_type='OPD')
        response = auth_client.get('/api/encounters/')
        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_add_vitals(self, auth_client, patient, user):
        encounter = Encounter.objects.create(
            patient=patient, doctor=user, encounter_type='OPD'
        )
        data = {
            'systolic_bp': 120,
            'diastolic_bp': 80,
            'heart_rate': 72,
            'temperature': 37.5,
        }
        response = auth_client.post(
            f'/api/encounters/{encounter.id}/add_vitals/', data
        )
        assert response.status_code == 201
        assert response.data['systolic_bp'] == 120

    def test_complete_encounter(self, auth_client, patient, user):
        encounter = Encounter.objects.create(
            patient=patient, doctor=user, encounter_type='OPD'
        )
        data = {'diagnosis': 'Migraine', 'clinical_notes': 'Patient responded to treatment'}
        response = auth_client.post(
            f'/api/encounters/{encounter.id}/complete/', data
        )
        assert response.status_code == 200
        assert response.data['status'] == 'COMPLETED'
        assert response.data['diagnosis'] == 'Migraine'


@pytest.mark.django_db
class TestSyncAPI:
    def test_sync_push(self, auth_client):
        data = {
            'entries': [{
                'record_id': '550e8400-e29b-41d4-a716-446655440000',
                'model_name': 'patient',
                'jsonb_snapshot': {'name': 'Test Patient'},
                'version': 1,
            }]
        }
        response = auth_client.post('/api/sync/push/', data, format='json')
        assert response.status_code == 201
        assert len(response.data) == 1

    def test_sync_pull(self, auth_client):
        response = auth_client.get('/api/sync/')
        assert response.status_code == 200


@pytest.mark.django_db
class TestInvoiceAPI:
    def test_create_invoice(self, auth_client, patient):
        data = {
            'patient': str(patient.id),
            'invoice_type': 'OPD',
        }
        response = auth_client.post('/api/invoices/', data)
        assert response.status_code == 201
        assert response.data['invoice_number'].startswith('MEDOS-')

    def test_issue_invoice(self, auth_client, patient, user):
        invoice = Invoice.objects.create(
            patient=patient,
            invoice_type='OPD',
            invoice_number='MEDOS-20260609-TEST',
            subtotal=500, tax=90, total=590,
            created_by=user,
        )
        response = auth_client.post(f'/api/invoices/{invoice.id}/issue/')
        assert response.status_code == 200
        assert response.data['status'] == 'ISSUED'

    def test_mark_paid(self, auth_client, patient, user):
        invoice = Invoice.objects.create(
            patient=patient,
            invoice_type='OPD',
            invoice_number='MEDOS-20260609-TEST2',
            subtotal=500, tax=90, total=590,
            created_by=user,
        )
        invoice.status = 'ISSUED'
        invoice.save()
        response = auth_client.post(f'/api/invoices/{invoice.id}/mark_paid/')
        assert response.status_code == 200
        assert response.data['status'] == 'PAID'


@pytest.mark.django_db
class TestDashboardAPI:
    def test_dashboard_stats(self, auth_client):
        response = auth_client.get('/api/dashboard/')
        assert response.status_code == 200
        assert 'total_patients' in response.data
        assert 'today_encounters' in response.data
        assert 'active_alerts' in response.data
        assert 'pending_invoices' in response.data
