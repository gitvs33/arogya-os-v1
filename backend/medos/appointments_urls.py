"""
URL configuration for Appointment REST endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import appointments as appointment_views

router = DefaultRouter()
router.register(r'', appointment_views.AppointmentViewSet, basename='appointment')

urlpatterns = [
    path('', include(router.urls)),
    path('doctors/<int:doctor_id>/availability/',
         appointment_views.doctor_availability,
         name='doctor-availability'),
]
