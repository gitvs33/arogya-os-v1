"""Admin user management — Create, list, update, delete users, reset passwords, toggle active."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...permissions import HasAdminManageUsers
from ...models import Role, HospitalUserProfile, SystemActivityLog, UserLoginActivity
from ...admin_serializers import AdminUserCreateSerializer, AdminUserSerializer
from ..base import HospitalScopedViewSet, get_hospital_from_user

User = get_user_model()


class AdminUserViewSet(HospitalScopedViewSet):
    """User Management CRUD."""
    queryset = User.objects.all().order_by('-date_joined')
    permission_classes = [IsAuthenticated, HasAdminManageUsers]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['date_joined', 'last_login', 'username']

    def get_serializer_class(self):
        if self.action == 'create':
            return AdminUserCreateSerializer
        return AdminUserSerializer

    def get_queryset(self):
        # NOTE: Must NOT call super().get_queryset() here because
        # HospitalScopedViewSet adds .filter(hospital=hospital) which
        # fails on User model (no direct hospital FK — uses hospital_profile).
        qs = User.objects.all().order_by('-date_joined')
        hospital = get_hospital_from_user(self.request.user)
        qs = qs.filter(hospital_profile__hospital=hospital)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        role_id = self.request.query_params.get('role_id')
        if role_id:
            qs = qs.filter(hospital_profile__role_id=role_id)
        department = self.request.query_params.get('department')
        if department:
            qs = qs.filter(hospital_profile__department__iexact=department)
        return qs.select_related('hospital_profile__role')

    def get_object(self):
        """Override to avoid HospitalScopedViewSet's hospital_id check (User has none)."""
        from rest_framework.generics import get_object_or_404
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        obj = get_object_or_404(queryset, **filter_kwargs)
        self.check_object_permissions(self.request, obj)
        return obj

    @transaction.atomic
    def perform_create(self, serializer):
        data = serializer.validated_data
        hospital = get_hospital_from_user(self.request.user)
        user = User.objects.create_user(
            username=data['username'],
            email=data.get('email', ''),
            password=data['password'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            is_active=data.get('is_active', True),
        )
        role_id = data.get('role_id')
        role = Role.objects.filter(id=role_id, hospital=hospital).first() if role_id else None
        try:
            HospitalUserProfile.objects.create(
                user=user,
                hospital=hospital,
                role=role,
                employee_id=data.get('employee_id', ''),
                department=data.get('department', ''),
                designation=data.get('designation', ''),
                phone=data.get('phone', ''),
            )
        except IntegrityError:
            transaction.set_rollback(True)
            raise serializers.ValidationError({
                'error': 'A profile already exists for this user.'
            })
        return user

    def perform_update(self, serializer):
        instance = serializer.save()
        SystemActivityLog.objects.create(
            event_type='USER_UPDATED',
            description=f"User updated: {instance.username}",
            author_name=self.request.user.get_full_name() or self.request.user.username,
            timestamp=timezone.now(),
        )

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('password')
        if not new_password:
            return Response(
                {'error': 'password is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'status': 'Password reset successfully'})

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        SystemActivityLog.objects.create(
            event_type='USER_STATUS_CHANGE',
            description=f"User {'activated' if user.is_active else 'deactivated'}: {user.username}",
            author_name=request.user.get_full_name() or request.user.username,
            timestamp=timezone.now(),
        )
        return Response({'status': 'success', 'is_active': user.is_active})

    @action(detail=False, methods=['get'])
    def activity_stats(self, request):
        hospital = get_hospital_from_user(request.user)
        user_base = User.objects.filter(hospital_profile__hospital=hospital)
        total = user_base.count()
        active = user_base.filter(is_active=True).count()
        with_logins_last_30d = UserLoginActivity.objects.filter(
            login_timestamp__gte=timezone.now() - timedelta(days=30),
            was_successful=True,
            user__hospital_profile__hospital=hospital,
        ).values('user_id').distinct().count()
        return Response({
            'total_users': total,
            'active_users': active,
            'active_pct': round((active / total * 100), 1) if total > 0 else 0,
            'users_logged_in_30d': with_logins_last_30d,
        })
