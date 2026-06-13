"""Seed common hospital departments for each hospital."""
from django.core.management.base import BaseCommand
from medos.models import Hospital, Department

DEPARTMENTS = [
    # (name, code, description)
    ("General Medicine", "GENMED", "Internal medicine & primary care"),
    ("Cardiology", "CARD", "Heart & cardiovascular system"),
    ("Orthopedics", "ORTHO", "Bones, joints & musculoskeletal system"),
    ("Neurology", "NEURO", "Brain, spine & nervous system"),
    ("Pediatrics", "PED", "Child & adolescent healthcare"),
    ("Gynecology & Obstetrics", "OBGYN", "Women's health & maternity"),
    ("Dermatology", "DERMA", "Skin, hair & nails"),
    ("Ophthalmology", "OPHTH", "Eye care & vision"),
    ("ENT", "ENT", "Ear, nose & throat"),
    ("Psychiatry", "PSYCH", "Mental health & behavioral disorders"),
    ("Pulmonology", "PULMO", "Respiratory system & lung diseases"),
    ("Gastroenterology", "GASTRO", "Digestive system"),
    ("Nephrology", "NEPHRO", "Kidney diseases & dialysis"),
    ("Urology", "URO", "Urinary tract & male reproductive system"),
    ("Endocrinology", "ENDO", "Hormones, diabetes & metabolic disorders"),
    ("Oncology", "ONCO", "Cancer diagnosis & treatment"),
    ("Emergency Medicine", "EMERG", "Acute & emergency care"),
    ("Anesthesiology", "ANES", "Surgical anesthesia & pain management"),
    ("Radiology", "RAD", "Medical imaging & diagnostics"),
    ("Pathology", "PATH", "Laboratory medicine & diagnostics"),
]


class Command(BaseCommand):
    help = "Seed common hospital departments."

    def handle(self, *args, **options):
        hospitals = Hospital.objects.all()
        if not hospitals.exists():
            self.stdout.write("No hospitals found — skipping seed.")
            return

        for hospital in hospitals:
            existing = Department.objects.filter(hospital=hospital).count()
            if existing > 0:
                self.stdout.write(
                    f"'{hospital.name}' already has {existing} departments — skipping."
                )
                continue

            created = 0
            for name, code, desc in DEPARTMENTS:
                Department.objects.create(
                    hospital=hospital,
                    name=name,
                    code=code,
                    description=desc,
                    is_active=True,
                )
                created += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Seeded {created} departments for hospital '{hospital.name}'."
                )
            )
