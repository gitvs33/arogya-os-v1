"""
ASGI config for medos_project project.

Exposes both:
- HTTP via Django's ASGIHandler
- WebSocket via Django Channels ProtocolTypeRouter

WebSocket routes are defined in ``medos.routing.websocket_urlpatterns``.
"""
import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medos_project.settings')

# Import here AFTER settings are configured to avoid import-time side effects
from medos.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
