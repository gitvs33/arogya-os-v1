"""
URL configuration for TeleICU REST endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import teleicu as teleicu_views

# ── Router for TeleICU ViewSets ─────────────────────────────────────────────
router = DefaultRouter()
router.register(r'wards', teleicu_views.ICUWardViewSet)
router.register(r'beds', teleicu_views.ICUBedViewSet)
router.register(r'sessions', teleicu_views.TeleICUSessionViewSet)
router.register(r'consults', teleicu_views.TeleConsultSessionViewSet)
router.register(r'activity-log', teleicu_views.SystemActivityLogViewSet)

urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),

    # Monitoring lifecycle
    path(
        'start_monitoring/',
        teleicu_views.start_monitoring,
        name='teleicu-start-monitoring',
    ),
    path(
        'stop_monitoring/',
        teleicu_views.stop_monitoring,
        name='teleicu-stop-monitoring',
    ),

    # Dashboard
    path(
        'dashboard-stats/',
        teleicu_views.teleicu_dashboard_stats,
        name='teleicu-dashboard-stats',
    ),
    path(
        'monitored_patients/',
        teleicu_views.teleicu_monitored_patients,
        name='teleicu-monitored-patients',
    ),

    # Vitals trend
    path(
        'vitals-trend/<uuid:patient_id>/',
        teleicu_views.teleicu_vitals_trend,
        name='teleicu-vitals-trend',
    ),

    # Cameras
    path(
        'cameras/',
        teleicu_views.teleicu_cameras,
        name='teleicu-cameras',
    ),

    # Timeline & Alerts
    path(
        'timeline/',
        teleicu_views.teleicu_timeline,
        name='teleicu-timeline',
    ),
    path(
        'alerts/',
        teleicu_views.teleicu_alerts,
        name='teleicu-alerts',
    ),
]
