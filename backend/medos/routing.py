"""
WebSocket routing for TeleICU real-time streams and queue updates.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Per-patient vitals stream
    re_path(r'ws/vitals/(?P<patient_id>[^/]+)/$', consumers.VitalsConsumer.as_asgi()),
    # Aggregated vitals stream for TeleICU dashboard
    re_path(r'ws/teleicu/vitals/$', consumers.VitalsConsumer.as_asgi()),
    # Alert broadcast
    re_path(r'ws/alerts/$', consumers.AlertsConsumer.as_asgi()),
    # WebRTC signaling (with optional room name)
    re_path(r'ws/signal/$', consumers.SignalConsumer.as_asgi()),
    re_path(r'ws/signal/(?P<room_name>[^/]+)/$', consumers.SignalConsumer.as_asgi()),
    # Pharmacy queue real-time updates
    re_path(r'ws/pharmacy-queue/(?P<hospital_id>[^/]+)/$', consumers.PharmacyQueueConsumer.as_asgi()),
    # Lab queue real-time updates
    re_path(r'ws/lab-queue/(?P<hospital_id>[^/]+)/$', consumers.LabQueueConsumer.as_asgi()),
]
