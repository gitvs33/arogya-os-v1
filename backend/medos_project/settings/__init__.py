"""
Django settings for medos_project.

Selects the appropriate environment module based on DJANGO_ENV.
- DJANGO_ENV=production → settings.production
- any other value       → settings.development
"""
import os

DJANGO_ENV = os.environ.get('DJANGO_ENV', 'development')

if DJANGO_ENV == 'production':
    from .production import *  # noqa: F401, F403
else:
    from .development import *  # noqa: F401, F403
