"""Development settings — relaxed defaults for local work."""
# isort: skip_file
import os
from .base import *  # noqa: F401, F403

# ── Debug ────────────────────────────────────────────────────────────────────
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')

# ── Database ─────────────────────────────────────────────────────────────────
# Default stays as SQLite; override via env vars for PostgreSQL
# DB_ENGINE=django.db.backends.postgresql
# DB_NAME=medos  DB_USER=vishnus  DB_HOST=localhost  DB_PORT=5432
DATABASES['default']['ENGINE'] = os.environ.get('DB_ENGINE', 'django.db.backends.sqlite3')
DATABASES['default']['NAME'] = os.environ.get('DB_NAME', str(BASE_DIR / 'db.sqlite3'))

# ── Celery (eager — no Redis needed) ─────────────────────────────────────────
CELERY_TASK_ALWAYS_EAGER = True
