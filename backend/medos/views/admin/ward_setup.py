"""Admin ward & bed setup — CRUD for wards with bulk bed management."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.shortcuts import get_object_or_404

from ...permissions import HasAdminWrite
from ...models import Ward, Bed, Encounter
from ...serializers.admin.ward_setup import (
    AdminWardSerializer,
    AdminWardDetailSerializer,
    AdminBedSerializer,
    AdminBedCreateSerializer,
)
from ..base import HospitalScopedViewSet


class AdminWardSetupViewSet(HospitalScopedViewSet):
    """Admin CRUD for hospital wards with bed management.

    Extends the clinical WardViewSet with admin-specific features:
    - Bulk bed creation
    - Occupancy statistics
    - Activate/deactivate beds
    """
    queryset = Ward.objects.all()
    serializer_class = AdminWardSerializer
    permission_classes = [IsAuthenticated, HasAdminWrite]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['ward_type', 'is_active', 'floor']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AdminWardDetailSerializer
        return AdminWardSerializer

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())

    # ── Statistics ──────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Aggregate ward/bed statistics for the admin dashboard."""
        hospital = self.get_hospital()
        wards = Ward.objects.filter(hospital=hospital)
        total_beds = Bed.objects.filter(ward__hospital=hospital).count()
        occupied_beds = Bed.objects.filter(
            ward__hospital=hospital,
            status__iexact='occupied',
        ).count()
        available_beds = Bed.objects.filter(
            ward__hospital=hospital,
            status__iexact='available',
        ).count()
        maintenance_beds = Bed.objects.filter(
            ward__hospital=hospital,
            status__iexact='maintenance',
        ).count()
        total_wards = wards.count()
        active_wards = wards.filter(is_active=True).count()
        occupancy_pct = round((occupied_beds / total_beds * 100), 1) if total_beds else 0

        return Response({
            'total_wards': total_wards,
            'active_wards': active_wards,
            'total_beds': total_beds,
            'occupied_beds': occupied_beds,
            'available_beds': available_beds,
            'maintenance_beds': maintenance_beds,
            'occupancy_pct': occupancy_pct,
        })

    # ── Bed management ──────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def beds(self, request, pk=None):
        """List all beds for a specific ward."""
        ward = self.get_object()
        beds = Bed.objects.filter(ward=ward).select_related(
            'current_encounter__patient'
        ).order_by('bed_number')
        serializer = AdminBedSerializer(beds, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def bulk_create_beds(self, request, pk=None):
        """Create multiple beds in a ward at once.

        Request body:
        {
            "count": 10,
            "bed_number_start": 1,
            "prefix": "gen "         // optional — e.g. "gen 01", "gen 02"…
        }

        If bed_number_start is omitted, auto-detects from existing
        beds in the ward (max existing number + 1).
        """
        ward = self.get_object()
        count = request.data.get('count', 1)
        start = request.data.get('bed_number_start')
        prefix = request.data.get('prefix', '')

        try:
            count = int(count)
            if start is not None:
                start = int(start)
        except (ValueError, TypeError):
            return Response(
                {'error': 'count and bed_number_start must be integers'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if count < 1 or count > 100:
            return Response(
                {'error': 'count must be between 1 and 100'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Auto-detect next bed number if not specified
        if start is None:
            existing = Bed.objects.filter(ward=ward).values_list('bed_number', flat=True)
            nums = []
            for bn in existing:
                # Strip prefix before parsing
                if prefix and bn.startswith(prefix):
                    rest = bn[len(prefix):]
                else:
                    rest = bn
                try:
                    nums.append(int(rest))
                except ValueError:
                    pass
            start = max(nums) + 1 if nums else 1

        # Build bed numbers with prefix + zero-padded number
        existing_numbers = set(
            Bed.objects.filter(ward=ward).values_list('bed_number', flat=True)
        )
        digits = len(str(start + count - 1))
        numbers_to_create = []
        for i in range(count):
            num = start + i
            bn = f'{prefix}{str(num).zfill(digits)}'
            if bn in existing_numbers:
                return Response(
                    {'error': f'Bed number "{bn}" already exists in this ward. Use a different bed_number_start or prefix.'},
                    status=status.HTTP_409_CONFLICT,
                )
            numbers_to_create.append(bn)

        created = []
        with transaction.atomic():
            for bn in numbers_to_create:
                bed = Bed.objects.create(
                    ward=ward,
                    bed_number=bn,
                    status='available',
                    hospital=ward.hospital,
                )
                created.append({
                    'id': str(bed.id),
                    'bed_number': bn,
                    'status': bed.status,
                })

        return Response(
            {'created': len(created), 'beds': created},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def update_bed_status(self, request, pk=None):
        """Update status of an individual bed.

        Request body:
        {
            "bed_id": "<uuid>",
            "status": "available" | "maintenance"
        }
        """
        ward = self.get_object()
        bed_id = request.data.get('bed_id')
        new_status = request.data.get('status')

        if new_status not in ['available', 'maintenance']:
            return Response(
                {'error': 'status must be "available" or "maintenance"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bed = get_object_or_404(Bed, id=bed_id, ward=ward)
        if bed.status == 'occupied' and new_status != 'occupied':
            return Response(
                {'error': 'Cannot change status of an occupied bed. Discharge patient first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bed.status = new_status.lower()
        bed.save(update_fields=['status'])
        serializer = AdminBedSerializer(bed, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def delete_bed(self, request, pk=None):
        """Delete a single bed from a ward.

        Request body:
        {
            "bed_id": "<uuid>"
        }

        Only beds with status 'available' or 'maintenance' can be deleted.
        Occupied beds must be discharged first.
        """
        ward = self.get_object()
        bed_id = request.data.get('bed_id')

        if not bed_id:
            return Response(
                {'error': 'bed_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bed = get_object_or_404(Bed, id=bed_id, ward=ward)

        if bed.status == 'occupied':
            return Response(
                {'error': 'Cannot delete an occupied bed. Discharge the patient first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bed_id_str = str(bed.id)
        bed_number = bed.bed_number
        bed.delete()
        return Response(
            {'deleted': bed_id_str, 'bed_number': bed_number},
            status=status.HTTP_200_OK,
        )
