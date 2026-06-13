from django.apps import AppConfig


class MedosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'medos'

    def ready(self):
        import medos.models  # noqa: F401
        import medos.settings_models  # noqa: F401
