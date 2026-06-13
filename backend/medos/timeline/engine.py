"""TimelineEngine — aggregate all clinical events for a patient.

Each event source (encounters, vitals, medications, labs, imaging,
alerts) has its own ``_fetch_*`` method.  The ``get_timeline`` method
merges, sorts, and paginates the combined stream — no ORM queries leak
into views.

Usage::

    engine = TimelineEngine()
    page = engine.get_timeline(patient_id, page=1, page_size=20)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Iterable
from uuid import UUID

from django.utils import timezone

from ..models import (
    Encounter,
    ImagingResult,
    LabOrder,
    MedicalAlert,
    Medication,
    Vitals,
)


# ── Value Objects ─────────────────────────────────────────────────────────────


@dataclass
class TimelineEntry:
    """A single event in the patient timeline."""

    id: str
    type: str  # 'encounter' | 'vitals' | 'medication' | 'lab' | 'imaging' | 'alert'
    title: str
    description: str
    timestamp: datetime
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class TimelinePage:
    """A paginated slice of a patient's timeline."""

    count: int
    page: int
    page_size: int
    results: list[TimelineEntry]


# ══════════════════════════════════════════════════════════════════════════════
# Engine
# ══════════════════════════════════════════════════════════════════════════════


class TimelineEngine:
    """Collect, sort, and paginate clinical timeline events for a patient."""

    # Maximum entries per source (prevent unbounded queries).
    SOURCE_LIMITS: dict[str, int] = {
        'encounters': 200,
        'vitals': 100,
        'medications': 50,
        'labs': 50,
        'imaging': 30,
        'alerts': 30,
    }

    # ── Public API ─────────────────────────────────────────────────────────

    def get_timeline(
        self,
        patient_id: str | UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> TimelinePage:
        """Build a sorted, paginated timeline for *patient_id*.

        All event types are fetched, merged into a single list sorted by
        ``timestamp`` descending, then sliced according to *page*/*page_size*.
        """
        events = list(self._all_events(patient_id))
        events.sort(key=lambda e: e.timestamp, reverse=True)

        total = len(events)
        start = (page - 1) * page_size
        end = start + page_size
        page_events = events[start:end]

        return TimelinePage(
            count=total,
            page=page,
            page_size=page_size,
            results=page_events,
        )

    # ── Event Source Fetchers ──────────────────────────────────────────────

    def _all_events(self, patient_id: str | UUID) -> Iterable[TimelineEntry]:
        """Yield entries from every source."""
        limit = self.SOURCE_LIMITS
        yield from self._fetch_encounters(patient_id, limit['encounters'])
        yield from self._fetch_vitals(patient_id, limit['vitals'])
        yield from self._fetch_medications(patient_id, limit['medications'])
        yield from self._fetch_labs(patient_id, limit['labs'])
        yield from self._fetch_imaging(patient_id, limit['imaging'])
        yield from self._fetch_alerts(patient_id, limit['alerts'])

    @staticmethod
    def _fetch_encounters(
        patient_id: str | UUID, limit: int,
    ) -> Iterable[TimelineEntry]:
        qs = Encounter.objects.filter(patient_id=patient_id) \
                              .order_by('-created_at')[:limit]
        for enc in qs:
            yield TimelineEntry(
                id=str(enc.id),
                type='encounter',
                title=f"{enc.get_encounter_type_display()} Visit",
                description=enc.chief_complaint or '',
                timestamp=enc.created_at,
                data={
                    'status': enc.status,
                    'department': enc.department,
                    'doctor': enc.doctor.get_full_name() if enc.doctor else '',
                },
            )

    @staticmethod
    def _fetch_vitals(
        patient_id: str | UUID, limit: int,
    ) -> Iterable[TimelineEntry]:
        qs = Vitals.objects.filter(encounter__patient_id=patient_id) \
                           .order_by('-recorded_at')[:limit]
        for v in qs:
            yield TimelineEntry(
                id=str(v.id),
                type='vitals',
                title='Vitals Recorded',
                description=f"HR {v.heart_rate} | BP {v.systolic_bp}/{v.diastolic_bp}",
                timestamp=v.recorded_at,
            )

    @staticmethod
    def _fetch_medications(
        patient_id: str | UUID, limit: int,
    ) -> Iterable[TimelineEntry]:
        qs = Medication.objects.filter(encounter__patient_id=patient_id) \
                               .order_by('-prescribed_at')[:limit]
        for m in qs:
            yield TimelineEntry(
                id=str(m.id),
                type='medication',
                title=f"Medication: {m.drug_name}",
                description=f"{m.dosage}",
                timestamp=m.prescribed_at,
            )

    @staticmethod
    def _fetch_labs(
        patient_id: str | UUID, limit: int,
    ) -> Iterable[TimelineEntry]:
        qs = LabOrder.objects.filter(patient_id=patient_id) \
                             .order_by('-ordered_at')[:limit]
        for lab in qs:
            yield TimelineEntry(
                id=str(lab.id),
                type='lab',
                title=f"Lab: {lab.test_panel.name if lab.test_panel else 'N/A'}",
                description=f"Status: {lab.get_status_display()}",
                timestamp=lab.ordered_at,
                data={'lab_id': lab.lab_id},
            )

    @staticmethod
    def _fetch_imaging(
        patient_id: str | UUID, limit: int,
    ) -> Iterable[TimelineEntry]:
        qs = ImagingResult.objects.filter(patient_id=patient_id) \
                                  .order_by('-ordered_at')[:limit]
        for img in qs:
            yield TimelineEntry(
                id=str(img.id),
                type='imaging',
                title=f"Imaging: {img.get_modality_display() if hasattr(img, 'modality') else 'Study'}",
                description=img.findings or '',
                timestamp=img.ordered_at,
            )

    @staticmethod
    def _fetch_alerts(
        patient_id: str | UUID, limit: int,
    ) -> Iterable[TimelineEntry]:
        qs = MedicalAlert.objects.filter(patient_id=patient_id) \
                                 .order_by('-created_at')[:limit]
        for alert in qs:
            yield TimelineEntry(
                id=str(alert.id),
                type='alert',
                title=f"Alert: {alert.get_alert_type_display() if hasattr(alert, 'alert_type') else 'Alert'}",
                description=alert.message or '',
                timestamp=alert.created_at,
                data={'severity': alert.severity},
            )
