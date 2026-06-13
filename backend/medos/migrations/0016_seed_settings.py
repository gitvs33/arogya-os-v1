from django.db import migrations


def seed_integrations(apps, schema_editor):
    """Create one IntegrationSetting row per known integration type."""
    IntegrationSetting = apps.get_model('medos', 'IntegrationSetting')
    defaults = [
        {
            'id': 'pacs',
            'name': 'PACS (Picture Archiving)',
            'description': 'Integrate with external Picture Archiving and Communication Systems.',
            'connected': False,
            'client_id': '',
            'client_secret': '',
        },
        {
            'id': 'lis',
            'name': 'External LIS',
            'description': 'Connect with external Laboratory Information Systems for seamless data exchange.',
            'connected': False,
            'client_id': '',
            'client_secret': '',
        },
        {
            'id': 'ndhm',
            'name': 'National Health Registry',
            'description': 'ABDM/NDHM integration for patient health record synchronization.',
            'connected': False,
            'client_id': '',
            'client_secret': '',
        },
        {
            'id': 'tpa',
            'name': 'Insurance TPA Portals',
            'description': 'Direct integration with Third Party Administrators for insurance claims.',
            'connected': False,
            'client_id': '',
            'client_secret': '',
        },
        {
            'id': 'payment',
            'name': 'Payment Gateways',
            'description': 'Stripe, Razorpay or other payment processors for online transactions.',
            'connected': False,
            'client_id': '',
            'client_secret': '',
        },
    ]
    for data in defaults:
        IntegrationSetting.objects.update_or_create(
            id=data['id'],
            defaults=data,
        )


def seed_singletons(apps, schema_editor):
    """Create one row per singleton settings model so load() always works."""
    models_to_seed = [
        'HospitalProfile',
        'BillingSettings',
        'PharmacySettings',
        'LaboratorySettings',
        'TeleICUSettings',
        'NotificationSettings',
        'DataPolicySettings',
        'LocalizationSettings',
    ]
    for model_name in models_to_seed:
        ModelClass = apps.get_model('medos', model_name)
        if not ModelClass.objects.exists():
            ModelClass.objects.create()


class Migration(migrations.Migration):

    dependencies = [
        ('medos', '0015_settings_models'),
    ]

    operations = [
        migrations.RunPython(seed_integrations, migrations.RunPython.noop),
        migrations.RunPython(seed_singletons, migrations.RunPython.noop),
    ]
