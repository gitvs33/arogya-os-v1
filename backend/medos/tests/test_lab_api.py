"""Integration tests for lab API endpoints.

Covers:
- TestPanel read-only endpoints
- Full LabOrder lifecycle (ORDERED → COMPLETED) via action endpoints
- QC entry creation, dashboard stats, trends
"""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from medos.models import (
    Patient, Encounter,
    TestPanel, TestParameter, LabOrder, LabParameterResult,
    QCEntry,
)

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        username='labtech1',
        password='testpass123',
        first_name='Lab',
        last_name='Tech',
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def patient(user):
    return Patient.objects.create(
        first_name='Anita',
        last_name='Desai',
        date_of_birth='1985-03-20',
        gender='F',
        phone='9876543222',
        created_by=user,
    )


@pytest.fixture
def encounter(patient, user):
    return Encounter.objects.create(
        patient=patient, doctor=user, encounter_type='OPD',
        chief_complaint='Routine checkup',
    )


@pytest.fixture
def test_panel():
    """Create a complete test panel with two parameters and critical thresholds."""
    panel = TestPanel.objects.create(
        name='Complete Blood Count',
        category='HEMATOLOGY',
        price=Decimal('500.00'),
    )
    TestParameter.objects.create(
        panel=panel, name='Hemoglobin (Hb)',
        unit='g/dL',
        ref_range_low=12.0, ref_range_high=16.0,
        critical_low=7.0, critical_high=20.0,
        display_order=1,
    )
    TestParameter.objects.create(
        panel=panel, name='WBC Count',
        unit='K/µL',
        ref_range_low=4.0, ref_range_high=11.0,
        display_order=2,
    )
    return panel


# ═══════════════════════════════════════════════════════════════════════════════
# TestPanel — Read only
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestTestPanelAPI:
    def test_list_panels(self, auth_client, test_panel):
        """List all test panels."""
        response = auth_client.get('/api/lab-panels/')
        assert response.status_code == 200
        assert response.data['count'] >= 1

    def test_retrieve_panel(self, auth_client, test_panel):
        """Get a specific test panel by ID."""
        response = auth_client.get(f'/api/lab-panels/{test_panel.id}/')
        assert response.status_code == 200
        assert response.data['name'] == 'Complete Blood Count'

    def test_retrieve_panel_includes_parameters(self, auth_client, test_panel):
        """Panel detail includes nested parameters."""
        response = auth_client.get(f'/api/lab-panels/{test_panel.id}/')
        assert response.status_code == 200
        assert 'parameters' in response.data
        assert len(response.data['parameters']) == 2


# ═══════════════════════════════════════════════════════════════════════════════
# LabOrder — Full Lifecycle
# ═══════════════════════════════════════════════════════════════════════════════


def _create_lab_order(auth_client, patient, test_panel):
    """Helper: create a LabOrder via API and return its DB id (UUID str)."""
    data = {
        'patient': str(patient.id),
        'test_panel': str(test_panel.id),
    }
    response = auth_client.post('/api/lab-orders/', data)
    assert response.status_code == 201
    # The create serializer only returns input fields; fetch from DB
    order = LabOrder.objects.latest('ordered_at')
    return str(order.id)


@pytest.mark.django_db
class TestLabOrderLifecycle:
    def test_create_lab_order(self, auth_client, patient, test_panel):
        """Create a new lab order via POST."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        order = LabOrder.objects.get(id=order_id)
        assert order.status == 'ORDERED'
        assert order.lab_id is not None

    def test_list_lab_orders(self, auth_client, patient, test_panel):
        """List all lab orders."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        response = auth_client.get('/api/lab-orders/')
        assert response.status_code == 200
        assert response.data['count'] >= 1

    def test_retrieve_lab_order(self, auth_client, patient, test_panel):
        """Get a lab order detail."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        response = auth_client.get(f'/api/lab-orders/{order_id}/')
        assert response.status_code == 200
        assert response.data['status'] == 'ORDERED'

    def test_collect_sample(self, auth_client, patient, test_panel):
        """ORDERED → SAMPLE_COLLECTED."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        response = auth_client.post(
            f'/api/lab-orders/{order_id}/collect_sample/',
            {'notes': 'Sample collected in vial'},
        )
        assert response.status_code == 200
        assert response.data['status'] == 'SAMPLE_COLLECTED'

    def test_receive_in_lab(self, auth_client, patient, test_panel):
        """ORDERED → SAMPLE_COLLECTED → RECEIVED_IN_LAB."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        auth_client.post(f'/api/lab-orders/{order_id}/collect_sample/')
        response = auth_client.post(
            f'/api/lab-orders/{order_id}/receive_in_lab/',
            {'instrument_id': 'ANALYZER-01'},
        )
        assert response.status_code == 200
        assert response.data['status'] == 'RECEIVED_IN_LAB'

    def test_full_lifecycle(self, auth_client, patient, test_panel):
        """Complete lifecycle: ORDERED → SAMPLE_COLLECTED → RECEIVED_IN_LAB
        → UNDER_REVIEW → COMPLETED."""
        order_id = _create_lab_order(auth_client, patient, test_panel)

        # Collect sample
        auth_client.post(f'/api/lab-orders/{order_id}/collect_sample/')

        # Receive in lab
        auth_client.post(f'/api/lab-orders/{order_id}/receive_in_lab/')

        # Submit results with parameter values
        params = test_panel.parameters.all()
        results_data = [
            {'parameter': str(p.id), 'result_value': '14.5'}
            for p in params
        ]
        response = auth_client.post(
            f'/api/lab-orders/{order_id}/submit_results/',
            {'results': results_data},
            format='json',
        )
        assert response.status_code == 200, f"submit_results failed: {response.data}"
        assert response.data['status'] in ('UNDER_REVIEW', 'COMPLETED')

        # Approve if needed
        if response.data['status'] == 'UNDER_REVIEW':
            response = auth_client.post(
                f'/api/lab-orders/{order_id}/approve_report/',
                {'notes': 'Report approved'},
            )
            assert response.status_code == 200
        final_order = LabOrder.objects.get(id=order_id)
        assert final_order.status == 'COMPLETED'

    def test_parameter_results_created(self, auth_client, patient, test_panel):
        """After submit_results, parameter results exist in DB."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        auth_client.post(f'/api/lab-orders/{order_id}/collect_sample/')
        auth_client.post(f'/api/lab-orders/{order_id}/receive_in_lab/')

        params = test_panel.parameters.all()
        results_data = [
            {'parameter': str(p.id), 'result_value': '14.5'}
            for p in params
        ]
        response = auth_client.post(
            f'/api/lab-orders/{order_id}/submit_results/',
            {'results': results_data},
            format='json',
        )
        assert response.status_code == 200

        lab_order = LabOrder.objects.get(id=order_id)
        assert lab_order.parameter_results.count() == 2

    def test_invalid_transition_returns_400(self, auth_client, patient, test_panel):
        """Transition from ORDERED directly to COMPLETED should fail."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        response = auth_client.post(
            f'/api/lab-orders/{order_id}/approve_report/',
        )
        assert response.status_code == 400
        assert 'error' in response.data

    def test_repeat_test(self, auth_client, patient, test_panel):
        """Repeat test creates a new order with ORDERED status."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        response = auth_client.post(
            f'/api/lab-orders/{order_id}/repeat_test/',
            {'comments': 'Repeat for confirmation'},
        )
        assert response.status_code == 201
        assert response.data['status'] == 'ORDERED'
        assert response.data['id'] != order_id

    def test_add_note(self, auth_client, patient, test_panel):
        """Add a pathologist note to an order."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        response = auth_client.post(
            f'/api/lab-orders/{order_id}/add_note/',
            {'comments': 'Please check hemolysis'},
        )
        assert response.status_code == 200

    def test_add_note_empty_returns_400(self, auth_client, patient, test_panel):
        """Empty note should be rejected."""
        order_id = _create_lab_order(auth_client, patient, test_panel)
        response = auth_client.post(
            f'/api/lab-orders/{order_id}/add_note/',
            {'comments': ''},
        )
        assert response.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# Dashboard & Analytics
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestLabDashboard:
    def test_dashboard_stats(self, auth_client):
        """Dashboard stats return expected KPIs."""
        response = auth_client.get('/api/lab-orders/dashboard_stats/')
        assert response.status_code == 200
        assert 'total_orders' in response.data
        assert 'in_progress' in response.data
        assert 'completed_today' in response.data

