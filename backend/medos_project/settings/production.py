"""Production settings — strict and secure."""
# isort: skip_file
import os
from .base import *  # noqa: F401, F403

# ── Debug ────────────────────────────────────────────────────────────────────
DEBUG = False

# ── Database (PostgreSQL required in production) ─────────────────────────────
DATABASES['default']['ENGINE'] = os.environ.get('DB_ENGINE', 'django.db.backends.postgresql')
DATABASES['default']['NAME'] = os.environ.get('DB_NAME', '')
DATABASES['default']['USER'] = os.environ.get('DB_USER', '')
DATABASES['default']['PASSWORD'] = os.environ.get('DB_PASSWORD', '')
DATABASES['default']['HOST'] = os.environ.get('DB_HOST', '')
DATABASES['default']['PORT'] = os.environ.get('DB_PORT', '')

# ── Celery (requires Redis) ──────────────────────────────────────────────────
CELERY_TASK_ALWAYS_EAGER = False

# ── Security hardening ───────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() in ('true', '1')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# ── Sentry ───────────────────────────────────────────────────────────────────
if os.environ.get('SENTRY_DSN'):
    import sentry_sdk
    sentry_sdk.init(
        dsn=os.environ['SENTRY_DSN'],
        traces_sample_rate=0.2,
    )
