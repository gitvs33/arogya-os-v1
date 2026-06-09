"""
URL configuration for TeleICU REST endpoints.
"""
from django.urls import path
from . import views

urlpatterns = [
    path(
        'start_monitoring/',
        views.start_monitoring,
        name='teleicu-start-monitoring',
    ),
    path(
        'stop_monitoring/',
        views.stop_monitoring,
        name='teleicu-stop-monitoring',
    ),
]
