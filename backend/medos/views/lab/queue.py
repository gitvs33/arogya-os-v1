"""Lab queue view — prescription-grouped lab order queue."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...lab import services as lab_services
from ...lab.workflow import LabOrderWorkflow, InvalidTransition
from ...models import LabOrder, Prescription
from ..base import get_hospital_from_user


class LabQueueViewSet(viewsets.ViewSet):
    """Prescription-based lab queue — grouped, prioritised."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Get the lab queue grouped by priority."""
        hospital = get_hospital_from_user(request.user)
        queue = lab_services.get_lab_queue(hospital)
        return Response(queue)

    @action(detail=False, methods=['post'], url_path='collect-samples')
    def collect_samples(self, request):
        """Mark all samples for a patient as collected."""
        group_id = request.data.get('group_id')
        if not group_id:
            return Response({'detail': 'group_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        hospital = get_hospital_from_user(request.user)
        count = lab_services.collect_all_samples(group_id, hospital, request.user)
        return Response({'detail': f'Marked {count} samples as collected.'})

    @action(detail=False, methods=['post'])
    def receive_in_lab(self, request):
        """Mark a single lab order as received in lab."""
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'detail': 'order_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        hospital = get_hospital_from_user(request.user)
        workflow = LabOrderWorkflow()
        try:
            order = LabOrder.objects.get(id=order_id, hospital=hospital)
            order = workflow.receive_in_lab(order, request.user)
            from ...serializers import LabOrderListSerializer
            return Response(LabOrderListSerializer(order, context={'request': request}).data)
        except LabOrder.DoesNotExist:
            return Response({'detail': 'Lab order not found.'}, status=status.HTTP_404_NOT_FOUND)
        except InvalidTransition as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
