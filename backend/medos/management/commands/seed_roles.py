"""
Management command to seed default hospital staff roles.

Seeds roles for EVERY hospital in the system, ensuring no hospital
is left without default role templates.

Usage::

    python manage.py seed_roles
    python manage.py seed_roles --hospital=<hospital_id>
"""
from django.core.management.base import BaseCommand, CommandError
from medos.models import Role, Hospital
from medos.permission_registry import get_module_ids, get_module


# ── Default Role Definitions ────────────────────────────────────────────────
# Each role defines which modules it can access and what actions per module.
# The list of known modules and their valid actions comes from
# permission_registry.py — add modules there, not here.

DEFAULT_ROLES = [
    {
        'name': 'Admin',
        'description': 'Full system access — manages users, settings, and all modules.',
        'permissions': {
            'patients':     ['read', 'write', 'delete'],
            'encounters':   ['read', 'write', 'delete'],
            'appointments': ['read', 'write', 'delete'],
            'billing':      ['read', 'write', 'delete'],
            'pharmacy':     ['read', 'write', 'delete'],
            'lab':          ['read', 'write', 'delete', 'approve'],
            'ward':         ['read', 'write'],
            'nursing':      ['read', 'write'],
            'teleicu':      ['read', 'write', 'monitor'],
            'alerts':       ['read', 'write', 'acknowledge', 'resolve'],
            'reports':      ['read', 'export'],
            'dashboard':    ['read'],
            'sync':         ['read', 'write'],
            'admin':        ['read', 'write', 'manage_users', 'manage_roles'],
        },
    },
    {
        'name': 'Doctor',
        'description': 'Clinical access — manages encounters, prescriptions, and patient care.',
        'permissions': {
            'patients':     ['read', 'write'],
            'encounters':   ['read', 'write', 'complete'],
            'appointments': ['read'],
            'billing':      ['read'],
            'pharmacy':     ['read'],
            'lab':          ['read', 'write'],
            'ward':         ['read', 'write'],
            'nursing':      ['read'],
            'teleicu':      ['read', 'monitor'],
            'alerts':       ['read', 'acknowledge', 'resolve'],
            'reports':      ['read'],
            'dashboard':    ['read'],
            'sync':         ['read', 'write'],
            'admin':        [],
        },
    },
    {
        'name': 'Nurse',
        'description': 'Records vitals, administers medications, and monitors patients.',
        'permissions': {
            'patients':     ['read'],
            'encounters':   ['read', 'write'],
            'appointments': ['read'],
            'billing':      [],
            'pharmacy':     ['read'],
            'lab':          ['read'],
            'ward':         ['read', 'write'],
            'nursing':      ['read', 'write'],
            'teleicu':      ['read', 'monitor'],
            'alerts':       ['read', 'acknowledge'],
            'reports':      [],
            'dashboard':    ['read'],
            'sync':         ['read', 'write'],
            'admin':        [],
        },
    },
    {
        'name': 'Receptionist',
        'description': 'Patient registration, appointment scheduling, and billing intake.',
        'permissions': {
            'patients':     ['read', 'write'],
            'encounters':   ['read'],
            'appointments': ['read', 'write'],
            'billing':      ['read', 'write'],
            'pharmacy':     [],
            'lab':          [],
            'ward':         ['read'],
            'nursing':      [],
            'teleicu':      [],
            'alerts':       ['read'],
            'reports':      ['read'],
            'dashboard':    ['read'],
            'sync':         ['read', 'write'],
            'admin':        [],
        },
    },
    {
        'name': 'Pharmacist',
        'description': 'Medication dispensing and drug interaction checks.',
        'permissions': {
            'patients':     ['read'],
            'encounters':   ['read'],
            'appointments': [],
            'billing':      ['read'],
            'pharmacy':     ['read', 'write', 'delete'],
            'lab':          ['read'],
            'ward':         ['read'],
            'nursing':      [],
            'teleicu':      [],
            'alerts':       ['read', 'acknowledge'],
            'reports':      [],
            'dashboard':    ['read'],
            'sync':         ['read', 'write'],
            'admin':        [],
        },
    },
    {
        'name': 'Lab Technician',
        'description': 'Processes lab samples and manages test results.',
        'permissions': {
            'patients':     ['read'],
            'encounters':   ['read'],
            'appointments': [],
            'billing':      [],
            'pharmacy':     [],
            'lab':          ['read', 'write', 'approve'],
            'ward':         ['read'],
            'nursing':      [],
            'teleicu':      [],
            'alerts':       ['read'],
            'reports':      [],
            'dashboard':    ['read'],
            'sync':         ['read', 'write'],
            'admin':        [],
        },
    },
]


def validate_roles():
    """Check every role's permissions against the canonical registry.

    Warns about unknown modules or actions but does not block seeding.
    """
    known_ids = set(get_module_ids())
    for role_data in DEFAULT_ROLES:
        for module_id in role_data['permissions']:
            if module_id not in known_ids:
                mod_name = role_data['name']
                print(f'  ⚠️  Role "{mod_name}" references unknown module "{module_id}"')
            else:
                mod = get_module(module_id)
                if mod:
                    for action in role_data['permissions'][module_id]:
                        if action not in mod.actions:
                            print(f'  ⚠️  Role "{mod_name}" — module "{module_id}" has unknown action "{action}"')


class Command(BaseCommand):
    help = 'Seed default hospital staff roles for all hospitals.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hospital',
            type=str,
            help='Hospital ID to seed roles for (seeds all if omitted)',
        )

    def handle(self, *args, **options):
        hospital_id = options.get('hospital')

        if hospital_id:
            hospitals = Hospital.objects.filter(id=hospital_id)
            if not hospitals.exists():
                raise CommandError(f'Hospital with id "{hospital_id}" not found.')
        else:
            hospitals = Hospital.objects.all()

        if not hospitals.exists():
            self.stdout.write(self.style.WARNING('No hospitals found. Create a hospital first.'))
            return

        # Validate role definitions against registry
        validate_roles()

        total_created = 0
        total_updated = 0

        for hospital in hospitals:
            self.stdout.write(f'\n🏥  {hospital.name} ({hospital.id})')

            for role_data in DEFAULT_ROLES:
                role, created = Role.objects.update_or_create(
                    name=role_data['name'],
                    hospital=hospital,
                    defaults={
                        'description': role_data['description'],
                        'permissions': role_data['permissions'],
                        'is_active': True,
                    },
                )
                if created:
                    total_created += 1
                    self.stdout.write(self.style.SUCCESS(f'    ✅ Created role: {role.name}'))
                else:
                    total_updated += 1
                    self.stdout.write(f'    🔄 Updated role: {role.name}')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone — {total_created} created, {total_updated} updated across {hospitals.count()} hospital(s).'
        ))
