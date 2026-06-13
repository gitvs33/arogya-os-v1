"""
URL configuration for Pharmacy REST endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import pharmacy as pharmacy_views

router = DefaultRouter()
router.register(r'drugs', pharmacy_views.DrugViewSet)
router.register(r'inventory', pharmacy_views.DrugInventoryViewSet)
router.register(r'dispensations', pharmacy_views.DispensationViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # ── Prescription-based Pharmacy Queue ───────────────────────────
    path('queue/', pharmacy_views.PharmacyQueueViewSet.as_view({
        'get': 'list',
    }), name='pharmacy-queue'),
    path('queue/mark-in-progress/', pharmacy_views.PharmacyQueueViewSet.as_view({
        'post': 'mark_in_progress',
    }), name='pharmacy-queue-mark-in-progress'),
    path('queue/dispense-medication/', pharmacy_views.PharmacyQueueViewSet.as_view({
        'post': 'dispense_medication',
    }), name='pharmacy-queue-dispense-medication'),
    path('queue/dispense-prescription/', pharmacy_views.PharmacyQueueViewSet.as_view({
        'post': 'dispense_prescription',
    }), name='pharmacy-queue-dispense-prescription'),
]
