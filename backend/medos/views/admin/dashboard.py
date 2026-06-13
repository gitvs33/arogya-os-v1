"""Admin dashboard overview — KPI cards, charts, module status, alerts, storage, license, system info."""
import platform
import sys
from datetime import date, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...permissions import HasAdminRead
from ...models import (
    AdminModule, LicenseInfo, SecurityPolicy, StorageMetrics,
    SystemActivityLog, UserLoginActivity,
)
from ...admin_serializers import (
    AdminKPISerializer, AdminModuleSerializer,
    AuditSummarySerializer, DatabaseStorageSerializer,
    LicenseInfoSerializer, RecentActivitySerializer,
    SecurityOverviewSerializer, SystemAlertSerializer,
    SystemInfoSerializer, SystemOverviewPointSerializer,
    UserActivitySerializer,
)
from ..base import get_hospital_from_user

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_kpis(request):
    """High-level KPI cards for the admin dashboard."""
    hospital = get_hospital_from_user(request.user)
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    sixty_days_ago = today - timedelta(days=60)

    user_base = User.objects.filter(hospital_profile__hospital=hospital)
    total_users_count = user_base.count()
    users_last_month = user_base.filter(date_joined__gte=thirty_days_ago).count()
    users_prev_month = user_base.filter(
        date_joined__gte=sixty_days_ago,
        date_joined__lt=thirty_days_ago
    ).count()
    growth_num = users_last_month - users_prev_month
    users_growth = f'+{growth_num} this month' if growth_num > 0 else ''

    active_user_ids = UserLoginActivity.objects.filter(
        login_timestamp__gte=thirty_days_ago,
        was_successful=True,
        user__hospital_profile__hospital=hospital,
    ).values_list('user_id', flat=True).distinct()
    active_users_count = len(set(active_user_ids))
    active_users_pct = round(
        (active_users_count / total_users_count * 100) if total_users_count > 0 else 0.0, 1
    )

    departments_count = 0  # imported inline below if needed
    from ...models import Department
    departments_count = Department.objects.filter(hospital=hospital).count()
    depts_created_last_month = Department.objects.filter(
        hospital=hospital, created_at__gte=thirty_days_ago
    ).count()
    depts_growth = f'+{depts_created_last_month} this month' if depts_created_last_month > 0 else ''

    from ...models import Role
    roles_count = Role.objects.filter(hospital=hospital).count()

    offline_modules = AdminModule.objects.filter(hospital=hospital, status='Offline').count()
    total_modules = max(AdminModule.objects.filter(hospital=hospital).count(), 1)
    uptime_pct = round(
        ((total_modules - offline_modules) / total_modules) * 100, 2
    )

    latest_storage = StorageMetrics.objects.filter(hospital=hospital).order_by('-recorded_at').first()
    if latest_storage:
        used_tb = round(latest_storage.storage_used_gb / 1024, 2)
        total_tb = round(latest_storage.storage_total_gb / 1024, 2)
        used_pct = round(
            (latest_storage.storage_used_gb / latest_storage.storage_total_gb * 100)
            if latest_storage.storage_total_gb > 0 else 0.0, 1
        )
    else:
        used_tb = 0.0
        total_tb = 1.0
        used_pct = 0.0

    data = {
        'total_users': {'count': total_users_count, 'growth': users_growth},
        'active_users': {'count': active_users_count, 'percentage': active_users_pct},
        'departments': {'count': departments_count, 'growth': depts_growth},
        'roles': {'count': roles_count},
        'system_uptime': {'percentage': uptime_pct},
        'storage_used': {
            'used': f'{used_tb} TB',
            'total': f'{total_tb} TB',
            'percentage': used_pct,
        },
    }
    serializer = AdminKPISerializer(data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_system_overview_chart(request):
    """Time-series data for the line chart."""
    hospital = get_hospital_from_user(request.user)
    period = request.query_params.get('period', 'last_7_days')
    num_days = 30 if period == 'last_30_days' else 7
    today = date.today()
    start_date = today - timedelta(days=num_days - 1)
    data = []

    from ...models import Payment

    for i in range(num_days):
        day = start_date + timedelta(days=i)
        logins = UserLoginActivity.objects.filter(
            login_timestamp__date=day,
            was_successful=True,
            user__hospital_profile__hospital=hospital,
        ).count()
        transactions = Payment.objects.filter(
            transaction_time__date=day,
            status='SUCCESS',
            hospital=hospital,
        ).count()
        errors = SystemActivityLog.objects.filter(
            timestamp__date=day,
            event_type__icontains='error',
        ).count()
        data.append({
            'date': day.isoformat(),
            'logins': logins,
            'transactions': transactions,
            'errors': errors,
        })

    serializer = SystemOverviewPointSerializer(data, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_module_status(request):
    """Real-time operational status of system modules."""
    hospital = get_hospital_from_user(request.user)
    modules = AdminModule.objects.filter(hospital=hospital)
    if not modules.exists():
        default_modules = [
            ('emr', 'EMR', True),
            ('patient_registration', 'Patient Registration', True),
            ('billing', 'Billing', True),
            ('pharmacy', 'Pharmacy', True),
            ('laboratory', 'Laboratory', True),
            ('teleicu', 'TeleICU', True),
            ('ai_services', 'AI Services', False),
        ]
        for name, label, critical in default_modules:
            AdminModule.objects.get_or_create(
                name=name,
                hospital=hospital,
                defaults={'label': label, 'is_critical': critical},
            )
        modules = AdminModule.objects.filter(hospital=hospital)

    serializer = AdminModuleSerializer(modules, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_system_alerts(request):
    """Current system-level alerts and notifications."""
    hospital = get_hospital_from_user(request.user)
    from ...models import SystemAlert
    alerts = SystemAlert.objects.filter(hospital=hospital, is_resolved=False)[:50]
    serializer = SystemAlertSerializer(alerts, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_user_activity(request):
    """Top active users by login count (last 30 days)."""
    hospital = get_hospital_from_user(request.user)
    thirty_days_ago = timezone.now() - timedelta(days=30)

    activity_counts = (
        UserLoginActivity.objects
        .filter(
            login_timestamp__gte=thirty_days_ago, was_successful=True,
            user__hospital_profile__hospital=hospital,
        )
        .values('user_id')
        .annotate(logins_count=Count('id'))
        .order_by('-logins_count')[:10]
    )

    results = []
    for entry in activity_counts:
        try:
            user = User.objects.get(id=entry['user_id'])
            profile = getattr(user, 'hospital_profile', None)
            results.append({
                'user_id': user.id,
                'name': user.get_full_name() or user.username,
                'avatar_url': '',
                'role': profile.role.name if profile and profile.role else '',
                'logins_count': entry['logins_count'],
                'last_login_timestamp': user.last_login,
            })
        except User.DoesNotExist:
            continue

    serializer = UserActivitySerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_audit_summary(request):
    """Aggregated audit log data for the donut chart."""
    event_counts = (
        SystemActivityLog.objects
        .values('event_type')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    total_logs = sum(e['count'] for e in event_counts)
    categories = []
    for e in event_counts:
        percentage = round(
            (e['count'] / total_logs * 100), 1
        ) if total_logs > 0 else 0.0
        categories.append({
            'name': e['event_type'].replace('_', ' ').title(),
            'count': e['count'],
            'percentage': percentage,
        })

    data = {
        'total_logs': total_logs,
        'categories': categories,
    }
    serializer = AuditSummarySerializer(data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_security_overview(request):
    """Current security configuration status."""
    hospital = get_hospital_from_user(request.user)
    policies = {
        p.policy_type: p.settings
        for p in SecurityPolicy.objects.filter(hospital=hospital)
    }
    password_policy = policies.get('password_policy', {}).get('strength', 'Strong')
    two_factor = policies.get('two_factor', {}).get('enforcement', 'Disabled')
    session_timeout = policies.get('session', {}).get('timeout_minutes', 30)
    data = {
        'password_policy': str(password_policy),
        'two_factor_enforcement': str(two_factor),
        'session_timeout': f'{session_timeout} min',
    }
    serializer = SecurityOverviewSerializer(data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_recent_activities(request):
    """Recent administrative actions timeline."""
    ACTION_TYPE_MAP = {
        'USER_CREATED': 'user',
        'USER_STATUS_CHANGE': 'user',
        'USER_UPDATE': 'user',
        'ROLE_CREATED': 'role',
        'ROLE_UPDATED': 'role',
        'DEPARTMENT_ADDED': 'department',
        'DEPARTMENT_UPDATED': 'department',
        'BACKUP': 'database',
        'RESTORE': 'database',
        'CONSULT': 'system',
        'DISCHARGE': 'system',
        'LOGIN': 'user',
        'LOGOUT': 'user',
        'SETTINGS_CHANGE': 'system',
        'SECURITY_CHANGE': 'system',
    }
    activities = SystemActivityLog.objects.order_by('-timestamp')[:20]
    results = []
    for act in activities:
        results.append({
            'id': act.id,
            'action_type': ACTION_TYPE_MAP.get(act.event_type.upper(), 'system'),
            'description': act.description or f'{act.event_type} action',
            'timestamp': act.timestamp.strftime('%b %d, %Y %I:%M %p') if act.timestamp else '',
            'author_name': act.author_name or 'System',
        })
    serializer = RecentActivitySerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_database_storage(request):
    """Database health and storage metrics."""
    hospital = get_hospital_from_user(request.user)
    latest = StorageMetrics.objects.filter(hospital=hospital).order_by('-recorded_at').first()
    if latest:
        data = {
            'storage_used_tb': round(latest.storage_used_gb / 1024, 2),
            'storage_total_tb': round(latest.storage_total_gb / 1024, 2),
            'database_status': latest.database_status,
            'last_backup': latest.last_backup,
            'next_backup': latest.next_backup,
        }
    else:
        data = {
            'storage_used_tb': 0.0,
            'storage_total_tb': 1.0,
            'database_status': 'Healthy',
            'last_backup': None,
            'next_backup': None,
        }
    serializer = DatabaseStorageSerializer(data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_license_info(request):
    """Software license and subscription details."""
    hospital = get_hospital_from_user(request.user)
    lic = LicenseInfo.objects.filter(hospital=hospital, is_active=True).first()
    if lic:
        serializer = LicenseInfoSerializer(lic)
        return Response(serializer.data)
    default_data = {
        'edition': 'Enterprise',
        'valid_from': date(2026, 1, 1),
        'valid_till': date(2027, 1, 1),
        'registered_modules': 8,
        'total_modules': 10,
        'active_users': User.objects.filter(is_active=True, hospital_profile__hospital=hospital).count(),
        'user_limit': 500,
        'is_active': True,
    }
    return Response(default_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_system_info(request):
    """Server and environment information."""
    import django
    data = {
        'version': 'v3.2.1',
        'environment': getattr(settings, 'ENVIRONMENT', 'Production'),
        'server_name': platform.node(),
        'server_time': timezone.now(),
        'timezone': str(settings.TIME_ZONE),
        'python_version': sys.version.split()[0],
        'django_version': django.get_version(),
        'database': settings.DATABASES.get('default', {}).get('ENGINE', 'postgresql'),
    }
    serializer = SystemInfoSerializer(data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminRead])
def admin_stats(request):
    """Summary stats for the admin panel dashboard."""
    hospital = get_hospital_from_user(request.user)
    today = date.today()

    from ...models import Patient, Encounter, Invoice, SystemAlert

    return Response({
        'total_users': User.objects.filter(hospital_profile__hospital=hospital).count(),
        'total_patients': Patient.objects.filter(hospital=hospital).count(),
        'today_encounters': Encounter.objects.filter(hospital=hospital, created_at__date=today).count(),
        'active_alerts': SystemAlert.objects.filter(hospital=hospital, is_resolved=False).count(),
        'pending_invoices': Invoice.objects.filter(hospital=hospital, status__in=['DRAFT', 'PENDING']).count(),
        'active_staff': User.objects.filter(
            hospital_profile__hospital=hospital,
            hospital_profile__is_active=True,
        ).count(),
    })
