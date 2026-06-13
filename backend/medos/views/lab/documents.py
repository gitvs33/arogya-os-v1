"""Lab documents — upload / manage attachments on lab orders."""
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from ...models import LabDocument
from ...serializers import LabDocumentSerializer
from ...subscriptions import HasFeatureAccess
from ..base import HospitalScopedViewSet


class LabDocumentViewSet(HospitalScopedViewSet):
    """Upload / manage documents attached to a lab order."""
    queryset = LabDocument.objects.select_related('uploaded_by').all()
    serializer_class = LabDocumentSerializer
    permission_classes = [IsAuthenticated, HasFeatureAccess]
    required_feature = 'laboratory'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order', 'document_type']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user, hospital=self.get_hospital())
