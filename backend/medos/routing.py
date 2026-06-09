"""
WebSocket routing for TeleICU real-time streams.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/vitals/(?P<patient_id>[^/]+)/$', consumers.VitalsConsumer.as_asgi()),
    re_path(r'ws/alerts/$', consumers.AlertsConsumer.as_asgi()),
    re_path(r'ws/signal/$', consumers.SignalConsumer.as_asgi()),
]
