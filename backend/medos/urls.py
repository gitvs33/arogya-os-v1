from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'patients', views.PatientViewSet)
router.register(r'encounters', views.EncounterViewSet)
router.register(r'sync', views.SyncViewSet, basename='sync')
router.register(r'ddi', views.DDIViewSet, basename='ddi')
router.register(r'invoices', views.InvoiceViewSet)
router.register(r'alerts', views.MedicalAlertViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
]
