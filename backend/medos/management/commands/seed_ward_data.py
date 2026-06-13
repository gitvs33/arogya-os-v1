"""
Seed Ward/IPD test data — creates wards, beds, assigns patients,
and creates a doctor user for testing the Morning Round flow.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.hashers import make_password
from medos.models import (
    Hospital, Ward, Bed, Patient, Encounter, User, Role, HospitalUserProfile
)
from datetime import datetime, timedelta
import uuid


class Command(BaseCommand):
    help = "Seed Ward/IPD test data"

    def handle(self, *args, **options):
        hospital = Hospital.objects.filter(name__icontains="city").first()
        if not hospital:
            hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No hospitals found!")
            return

        self.stdout.write(f"Using hospital: {hospital.name} ({hospital.id})")

        # ── 1. Create Doctor user ─────────────────────────────────────
        # Helper to get or create a role
        def get_or_create_role(name):
            role = Role.objects.filter(name=name, hospital=hospital).first()
            if role:
                return role
            return Role.objects.create(
                name=name,
                hospital=hospital,
                is_active=True,
            )

        def get_or_create_user(email, first_name, last_name, password, is_staff=True):
            user = User.objects.filter(username=email).first()
            if user:
                return user, False
            return User.objects.create_user(
                username=email,
                email=email,
                first_name=first_name,
                last_name=last_name,
                password=password,
                is_staff=is_staff,
            ), True

        doctor_email = "doctor@medos.com"
        doctor, dc = get_or_create_user(
            doctor_email, "Ravi", "Kumar", "doctor123"
        )
        doctor_role = get_or_create_role("Doctor")
        HospitalUserProfile.objects.get_or_create(
            user=doctor,
            hospital=hospital,
            defaults={"role": doctor_role},
        )
        self.stdout.write(f"  {'✅ Created' if dc else 'ℹ️  Already exists'} doctor: {doctor_email} / doctor123")

        # ── 2. Create Nurse user ──────────────────────────────────────
        nurse_email = "nurse@medos.com"
        nurse, nc = get_or_create_user(
            nurse_email, "Anita", "Sharma", "nurse123"
        )
        nurse_role = get_or_create_role("Nurse")
        HospitalUserProfile.objects.get_or_create(
            user=nurse,
            hospital=hospital,
            defaults={"role": nurse_role},
        )
        self.stdout.write(f"  {'✅ Created' if nc else 'ℹ️  Already exists'} nurse: {nurse_email} / nurse123")

        # ── 3. Create Wards ───────────────────────────────────────────
        wards_data = [
            {"name": "General Ward A", "ward_type": "GENERAL", "bed_charge": "500.00", "floor": "1st Floor"},
            {"name": "General Ward B", "ward_type": "GENERAL", "bed_charge": "500.00", "floor": "1st Floor"},
            {"name": "Semi-Private",    "ward_type": "SEMI_PRIVATE", "bed_charge": "1500.00", "floor": "2nd Floor"},
            {"name": "Private Suite",   "ward_type": "PRIVATE", "bed_charge": "3500.00", "floor": "3rd Floor"},
            {"name": "ICU",             "ward_type": "ICU", "bed_charge": "8000.00", "floor": "4th Floor"},
            {"name": "Maternity Ward",  "ward_type": "MATERNITY", "bed_charge": "2000.00", "floor": "2nd Floor"},
        ]

        created_wards = []
        for wd in wards_data:
            ward, was_created = Ward.objects.get_or_create(
                name=wd["name"],
                hospital=hospital,
                defaults={
                    "ward_type": wd["ward_type"],
                    "bed_charge_per_day": wd["bed_charge"],
                    "floor": wd["floor"],
                    "is_active": True,
                },
            )
            created_wards.append(ward)
            if was_created:
                self.stdout.write(f"  ✅ Created ward: {ward.name} ({ward.ward_type})")

        # ── 4. Create Beds per Ward ───────────────────────────────────
        bed_counts = {
            "General Ward A": 8,
            "General Ward B": 8,
            "Semi-Private": 6,
            "Private Suite": 4,
            "ICU": 6,
            "Maternity Ward": 6,
        }

        total_beds = 0
        for ward in created_wards:
            count = bed_counts.get(ward.name, 4)
            for i in range(1, count + 1):
                bed_number = f"{ward.name[:3].upper()}{i:02d}"[:10]
                _, was_created = Bed.objects.get_or_create(
                    bed_number=bed_number,
                    ward=ward,
                    defaults={
                        "hospital": hospital,
                        "status": "available",
                        "notes": "",
                    },
                )
                if was_created:
                    total_beds += 1
        self.stdout.write(f"  ✅ Created {total_beds} beds")

        # ── 5. Assign active encounters to some beds ──────────────────
        active_encounters = list(
            Encounter.objects.filter(
                hospital=hospital,
                status="ACTIVE",
            ).select_related("patient")[:10]
        )

        # Get available beds
        available_beds = list(
            Bed.objects.filter(
                ward__hospital=hospital,
                status="available",
            ).select_related("ward")[:8]
        )

        assigned_count = 0
        for i, encounter in enumerate(active_encounters):
            if i >= len(available_beds):
                break
            bed = available_beds[i]
            bed.current_encounter = encounter
            bed.status = "occupied"
            bed.save(update_fields=["current_encounter", "status"])
            # Update encounter with doctor info
            if not encounter.doctor or encounter.doctor == "test":
                encounter.doctor = "Dr. Ravi Kumar"
                encounter.clinical_acuity = (
                    "Critical" if bed.ward.ward_type == "ICU"
                    else "Stable" if bed.ward.ward_type in ("SEMI_PRIVATE", "PRIVATE")
                    else "Observation"
                )
                encounter.diagnosis = (
                    ["Hypertension with complications", "Type 2 Diabetes Mellitus"]
                    if encounter.patient.first_name in ("visnno", "abhijith")
                    else ["Community acquired pneumonia", "Acute gastroenteritis"]
                    if encounter.patient.first_name in ("salahudeen", "jijhons")
                    else ["Fractured femur", "Post-operative monitoring"]
                )[i % 3]
                encounter.save(update_fields=["doctor", "clinical_acuity", "diagnosis"])
            assigned_count += 1
            self.stdout.write(
                f"  🛏️  Assigned {encounter.patient.first_name} {encounter.patient.last_name}"
                f" → {bed.bed_number} ({bed.ward.name})"
            )

        self.stdout.write(f"  ✅ Assigned {assigned_count} patients to beds")

        # ── 6. Unassign remaining beds for variety ────────────────────
        total_wards = Ward.objects.filter(hospital=hospital).count()
        total_beds_db = Bed.objects.filter(ward__hospital=hospital).count()
        occupied = Bed.objects.filter(ward__hospital=hospital, status="occupied").count()
        available = Bed.objects.filter(ward__hospital=hospital, status="available").count()

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("✅ SEED COMPLETE")
        self.stdout.write("=" * 50)
        self.stdout.write(f"   Wards:         {total_wards}")
        self.stdout.write(f"   Total beds:    {total_beds_db}")
        self.stdout.write(f"   Occupied:      {occupied}")
        self.stdout.write(f"   Available:     {available}")
        self.stdout.write(f"   Doctor login:  doctor@medos.com / doctor123")
        self.stdout.write(f"   Nurse login:   nurse@medos.com / nurse123")
        self.stdout.write("=" * 50)
