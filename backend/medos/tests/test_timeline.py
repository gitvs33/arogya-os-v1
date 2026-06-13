"""Unit tests for TimelineEngine.

Since the engine queries 6+ models, these are integration tests against
the test database.  Each test creates one event and verifies it appears
in the timeline.
"""
from __future__ import annotations

from datetime import date

import pytest
from django.utils import timezone

from medos.timeline.engine import TimelineEngine, TimelineEntry, TimelinePage
from medos.models import (
    Patient, Encounter, Vitals, Medication,
    LabOrder, TestPanel, ImagingResult, MedicalAlert,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        first_name='Test', last_name='Patient',
        date_of_birth=date(1990, 1, 1), gender='M',
        phone='9999999999',
    )


@pytest.fixture
def panel(db):
    return TestPanel.objects.create(
        name='CBC', category='HEMATOLOGY', is_panel=True,
    )


@pytest.fixture
def engine() -> TimelineEngine:
    return TimelineEngine()


# ══════════════════════════════════════════════════════════════════════════════
# Data Classes
# ══════════════════════════════════════════════════════════════════════════════


class TestTimelineEntry:
    def test_minimal_entry(self):
        e = TimelineEntry(id='1', type='encounter', title='Visit', description='', timestamp=timezone.now())
        assert e.type == 'encounter'

    def test_with_data(self):
        e = TimelineEntry(id='1', type='lab', title='CBC', description='Done', timestamp=timezone.now(), data={'lab_id': 'LAB-001'})
        assert e.data['lab_id'] == 'LAB-001'


class TestTimelinePage:
    def test_empty_page(self):
        p = TimelinePage(count=0, page=1, page_size=20, results=[])
        assert p.count == 0
        assert len(p.results) == 0

    def test_single_page(self):
        p = TimelinePage(count=1, page=1, page_size=20, results=[TimelineEntry(id='1', type='encounter', title='Visit', description='', timestamp=timezone.now())])
        assert p.count == 1
        assert p.results[0].type == 'encounter'


# ══════════════════════════════════════════════════════════════════════════════
# Engine — per source
# ══════════════════════════════════════════════════════════════════════════════


class TestEngineEncounters:
    def test_encounter_appears_in_timeline(self, patient, engine):
        enc = Encounter.objects.create(
            patient=patient, encounter_type='OPD',
            chief_complaint='Cough',
        )
        page = engine.get_timeline(patient.id)
        assert page.count >= 1
        assert any(e.id == str(enc.id) for e in page.results)

    def test_encounter_data_in_entry(self, patient, engine):
        Encounter.objects.create(
            patient=patient, encounter_type='ER',
            chief_complaint='Fever',
        )
        page = engine.get_timeline(patient.id)
        enc_entries = [e for e in page.results if e.type == 'encounter']
        assert len(enc_entries) >= 1
        assert enc_entries[0].title == 'ER Visit'
        assert enc_entries[0].description == 'Fever'


class TestEngineVitals:
    def test_vitals_appear(self, patient, engine):
        enc = Encounter.objects.create(patient=patient, encounter_type='OPD')
        Vitals.objects.create(
            encounter=enc, heart_rate=80, systolic_bp=120, diastolic_bp=80,
        )
        page = engine.get_timeline(patient.id)
        vitals_entries = [e for e in page.results if e.type == 'vitals']
        assert len(vitals_entries) >= 1


class TestEngineMedications:
    def test_medication_appears(self, patient, engine):
        enc = Encounter.objects.create(patient=patient, encounter_type='OPD')
        Medication.objects.create(
            encounter=enc,
            drug_name='Paracetamol', dosage='500mg',
        )
        page = engine.get_timeline(patient.id)
        med_entries = [e for e in page.results if e.type == 'medication']
        assert len(med_entries) >= 1
        assert 'Paracetamol' in med_entries[0].title


class TestEngineLabs:
    def test_lab_appears(self, patient, engine, panel):
        LabOrder.objects.create(
            patient=patient, test_panel=panel, status='ORDERED',
        )
        page = engine.get_timeline(patient.id)
        lab_entries = [e for e in page.results if e.type == 'lab']
        assert len(lab_entries) >= 1
        assert 'CBC' in lab_entries[0].title


class TestEngineImaging:
    def test_imaging_appears(self, patient, engine):
        enc = Encounter.objects.create(patient=patient, encounter_type='OPD')
        ImagingResult.objects.create(
            patient=patient, encounter=enc,
            modality='XRAY', findings='Normal chest', title='Chest XR',
        )
        page = engine.get_timeline(patient.id)
        entries = [e for e in page.results if e.type == 'imaging']
        assert len(entries) >= 1


class TestEngineAlerts:
    def test_alert_appears(self, patient, engine):
        MedicalAlert.objects.create(
            patient=patient, alert_type='ALLERGY', severity='MODERATE',
            message='Penicillin allergy',
        )
        page = engine.get_timeline(patient.id)
        entries = [e for e in page.results if e.type == 'alert']
        assert len(entries) >= 1
        assert entries[0].description == 'Penicillin allergy'


# ══════════════════════════════════════════════════════════════════════════════
# Engine — pagination & sorting
# ══════════════════════════════════════════════════════════════════════════════


class TestPagination:
    def test_empty_timeline(self, patient, engine):
        page = engine.get_timeline(patient.id)
        assert page.count == 0
        assert page.results == []

    def test_page_size_respected(self, patient, engine):
        Encounter.objects.create(patient=patient, encounter_type='OPD')
        Encounter.objects.create(patient=patient, encounter_type='ER')
        Encounter.objects.create(patient=patient, encounter_type='IPD')

        page = engine.get_timeline(patient.id, page=1, page_size=2)
        assert len(page.results) == 2
        assert page.count == 3
        assert page.page_size == 2

    def test_second_page(self, patient, engine):
        Encounter.objects.create(patient=patient, encounter_type='OPD')
        Encounter.objects.create(patient=patient, encounter_type='ER')
        Encounter.objects.create(patient=patient, encounter_type='IPD')

        page1 = engine.get_timeline(patient.id, page=1, page_size=2)
        page2 = engine.get_timeline(patient.id, page=2, page_size=2)
        # Second page should have the remaining item
        assert len(page2.results) == 1
        # IDs should differ
        assert page1.results[0].id != page2.results[0].id

    def test_events_sorted_descending(self, patient, engine):
        e1 = Encounter.objects.create(patient=patient, encounter_type='OPD')
        e2 = Encounter.objects.create(patient=patient, encounter_type='ER')

        page = engine.get_timeline(patient.id)
        timestamps = [e.timestamp for e in page.results]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_mixed_types_all_appear(self, patient, engine, panel):
        Encounter.objects.create(patient=patient, encounter_type='OPD')
        LabOrder.objects.create(patient=patient, test_panel=panel, status='ORDERED')

        page = engine.get_timeline(patient.id)
        types = {e.type for e in page.results}
        assert 'encounter' in types
        assert 'lab' in types
