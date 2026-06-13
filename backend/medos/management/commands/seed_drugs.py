"""Seed common Indian drugs into the Drug catalog and add sample inventory."""
import uuid
from decimal import Decimal
from django.core.management.base import BaseCommand
from medos.models.hospital import Hospital
from medos.models.pharmacy import Drug, DrugInventory


DRUGS = [
    # (name, generic_name, brand_names, category)
    ("Paracetamol 500mg", "Paracetamol", "Calpol, Crocin, Dolo", "ANALGESIC"),
    ("Amoxicillin 500mg", "Amoxicillin", "Amoxil, Mox, Novamox", "ANTIBIOTIC"),
    ("Amoxicillin 250mg", "Amoxicillin", "Amoxil, Mox", "ANTIBIOTIC"),
    ("Amox Clav 625mg", "Amoxicillin + Clavulanic Acid", "Augmentin, Clavam, Moxikind-CV", "ANTIBIOTIC"),
    ("Azithromycin 500mg", "Azithromycin", "Azee, Zithrocin, Azibest", "ANTIBIOTIC"),
    ("Cefixime 200mg", "Cefixime", "Taxim-O, Cefolac, Zifi", "ANTIBIOTIC"),
    ("Pantoprazole 40mg", "Pantoprazole", "Pantocid, Pentab, Pan", "GASTROINTESTINAL"),
    ("Omeprazole 20mg", "Omeprazole", "Omez, Ocid, Losec", "GASTROINTESTINAL"),
    ("Ondansetron 4mg", "Ondansetron", "Emeset, Ondem, Zofran", "GASTROINTESTINAL"),
    ("Metformin 500mg", "Metformin", "Glycomet, Riomet, Bigomet", "DIABETIC"),
    ("Amlodipine 5mg", "Amlodipine", "Amlodac, Amlogard, Starpress", "CARDIOVASCULAR"),
    ("Telmisartan 40mg", "Telmisartan", "Telma, Telvas, Telsarta", "CARDIOVASCULAR"),
    ("Atorvastatin 10mg", "Atorvastatin", "Atorva, Storvas, Lipitor", "CARDIOVASCULAR"),
    ("Cetirizine 10mg", "Cetirizine", "Cetzine, Alerid, Zyrtec", "RESPIRATORY"),
    ("Salbutamol 100mcg Inhaler", "Salbutamol", "Asthalin, Ventolin, Salmol", "RESPIRATORY"),
    ("Vitamin D3 60K IU", "Cholecalciferol", "D3-60K, Arachitol, Calcirol", "VITAMIN"),
    ("Mecobalamin 500mcg", "Mecobalamin", "Mecob,Nervica, Neurobion", "VITAMIN"),
    ("Iron+Sucrose Injection", "Iron Sucrose", "Ferrivit, Orofer, Ironate", "VITAMIN"),
    ("ORS Powder (Lemon)", "ORS", "Electral, Enerlyte, Orslip", "GASTROINTESTINAL"),
    ("Diclofenac Gel 30gm", "Diclofenac", "Voveran, Omnigel, Dynapar", "ANALGESIC"),
]

INVENTORY = [
    # (drug_name, batch, qty, unit, unit_price, expiry_months_ahead, reorder)
    ("Paracetamol 500mg", "BATCH-001", 500, "Tablets", Decimal("1.50"), 18, 50),
    ("Amoxicillin 500mg", "BATCH-002", 200, "Capsules", Decimal("3.00"), 12, 30),
    ("Pantoprazole 40mg", "BATCH-003", 150, "Tablets", Decimal("2.00"), 14, 20),
    ("Ondansetron 4mg", "BATCH-004", 8, "Tablets", Decimal("1.20"), 10, 20),  # LOW STOCK
    ("Amlodipine 5mg", "BATCH-005", 300, "Tablets", Decimal("1.80"), 16, 40),
    ("Cetirizine 10mg", "BATCH-006", 5, "Tablets", Decimal("0.80"), 8, 20),   # LOW STOCK
    ("ORS Powder (Lemon)", "BATCH-007", 100, "Sachets", Decimal("5.00"), 24, 30),
    ("Salbutamol 100mcg Inhaler", "BATCH-008", 3, "Inhalers", Decimal("95.00"), 20, 5),  # LOW STOCK
]


class Command(BaseCommand):
    help = "Seed the Drug catalog with common Indian drugs and sample inventory."

    def handle(self, *args, **options):
        existing = Drug.objects.count()
        if existing > 0:
            self.stdout.write(f"Drug catalog already has {existing} drugs — skipping seed.")
            return

        hospital = Hospital.objects.first()
        if not hospital:
            self.stdout.write("No hospitals found — skipping seed.")
            return

        drugs_created = 0
        drug_map = {}
        for name, generic, brands, cat in DRUGS:
            drug, created = Drug.objects.get_or_create(
                hospital=hospital,
                name=name,
                defaults={
                    "generic_name": generic,
                    "brand_names": brands,
                    "category": cat,
                },
            )
            drug_map[name] = drug
            if created:
                drugs_created += 1

        self.stdout.write(f"Created {drugs_created} drugs in catalog for hospital '{hospital.name}'.")

        # ── Seed inventory ──

        from datetime import date
        from dateutil.relativedelta import relativedelta

        inv_count = 0
        for name, batch, qty, unit, price, exp_months, reorder in INVENTORY:
            drug = drug_map.get(name)
            if not drug:
                continue
            expiry = date.today() + relativedelta(months=exp_months)
            DrugInventory.objects.get_or_create(
                drug=drug,
                hospital=hospital,
                batch_number=batch,
                defaults={
                    "quantity": qty,
                    "unit": unit,
                    "unit_price": price,
                    "expiry_date": expiry,
                    "reorder_level": reorder,
                    "is_active": True,
                },
            )
            inv_count += 1

        self.stdout.write(f"Added {inv_count} inventory items to hospital '{hospital.name}'.")
        self.stdout.write(self.style.SUCCESS("Seed complete."))
