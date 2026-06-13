"""Lab views package — one module per section.

Re-exports all viewsets and standalone view functions for URL routing.
"""
from .panels import TestPanelViewSet
from .orders import LabOrderViewSet
from .results import LabParameterResultViewSet
from .trend import lab_trend, lab_history
from .documents import LabDocumentViewSet
from .qc import QCEntryViewSet, lab_create_qc_entry, lab_qc_overview
from .inventory import LabInventoryViewSet
from .alerts import LabAlertViewSet
from .queue import LabQueueViewSet

__all__ = [
    'TestPanelViewSet',
    'LabOrderViewSet',
    'LabParameterResultViewSet',
    'lab_trend',
    'lab_history',
    'LabDocumentViewSet',
    'QCEntryViewSet',
    'lab_create_qc_entry',
    'LabInventoryViewSet',
    'LabAlertViewSet',
    'LabQueueViewSet',
    'lab_qc_overview',
]
