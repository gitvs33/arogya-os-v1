from django.core.management.base import BaseCommand
from medos.models import DrugInteraction


INTERACTIONS = [
    # Major interactions
    {"drug_a": "Warfarin", "drug_b": "Aspirin", "severity": "major",
     "description": "Increased risk of bleeding when used with aspirin.", "source": "DDInter"},
    {"drug_a": "Warfarin", "drug_b": "Ibuprofen", "severity": "major",
     "description": "NSAIDs increase bleeding risk with anticoagulants.", "source": "DDInter"},
    {"drug_a": "ACE Inhibitors", "drug_b": "Potassium Supplements", "severity": "major",
     "description": "Risk of hyperkalemia. Monitor potassium levels.", "source": "DDInter"},
    {"drug_a": "Metformin", "drug_b": "Contrast Dye", "severity": "major",
     "description": "Risk of lactic acidosis. Withhold metformin before contrast procedures.", "source": "DDInter"},
    {"drug_a": "Cisapride", "drug_b": "Erythromycin", "severity": "contraindicated",
     "description": "Contraindicated: Risk of fatal cardiac arrhythmias.", "source": "DDInter"},

    # Moderate interactions
    {"drug_a": "Paracetamol", "drug_b": "Warfarin", "severity": "moderate",
     "description": "Increased INR. Monitor closely with chronic paracetamol use.", "source": "DDInter"},
    {"drug_a": "Metformin", "drug_b": "Furosemide", "severity": "moderate",
     "description": "Furosemide may increase metformin levels. Monitor blood glucose.", "source": "DDInter"},
    {"drug_a": "Amoxicillin", "drug_b": "Methotrexate", "severity": "moderate",
     "description": "Penicillins may reduce methotrexate clearance.", "source": "DDInter"},
    {"drug_a": "Atorvastatin", "drug_b": "Grapefruit Juice", "severity": "moderate",
     "description": "Grapefruit increases statin levels. Avoid combination.", "source": "OpenFDA"},
    {"drug_a": "Omeprazole", "drug_b": "Clopidogrel", "severity": "moderate",
     "description": "PPIs may reduce clopidogrel effectiveness.", "source": "DDInter"},
    {"drug_a": "Digoxin", "drug_b": "Furosemide", "severity": "moderate",
     "description": "Hypokalemia from diuretics increases digoxin toxicity risk.", "source": "DDInter"},
    {"drug_a": "Metformin", "drug_b": "Corticosteroids", "severity": "moderate",
     "description": "Corticosteroids may reduce metformin efficacy. Monitor glucose.", "source": "OpenFDA"},
    {"drug_a": "Warfarin", "drug_b": "Ciprofloxacin", "severity": "moderate",
     "description": "Fluoroquinolones potentiate warfarin effect. Monitor INR.", "source": "DDInter"},

    # Minor interactions
    {"drug_a": "Paracetamol", "drug_b": "Caffeine", "severity": "minor",
     "description": "Caffeine may enhance analgesic effect of paracetamol.", "source": "DrugBank"},
    {"drug_a": "Amoxicillin", "drug_b": "Oral Contraceptives", "severity": "minor",
     "description": "May reduce contraceptive efficacy. Use backup method.", "source": "OpenFDA"},
    {"drug_a": "Cetirizine", "drug_b": "Alcohol", "severity": "minor",
     "description": "Increased sedation risk. Avoid alcohol.", "source": "DrugBank"},
    {"drug_a": "Ibuprofen", "drug_b": "Aspirin", "severity": "minor",
     "description": "Increased GI irritation risk. Avoid concurrent use.", "source": "DDInter"},
    {"drug_a": "Vitamin D", "drug_b": "Thiazide Diuretics", "severity": "minor",
     "description": "Risk of hypercalcemia with high-dose vitamin D.", "source": "DrugBank"},
]


class Command(BaseCommand):
    help = "Seed the database with common drug-drug interactions"

    def handle(self, *args, **options):
        created = 0
        skipped = 0
        for data in INTERACTIONS:
            _, was_created = DrugInteraction.objects.get_or_create(
                drug_a__iexact=data["drug_a"],
                drug_b__iexact=data["drug_b"],
                defaults=data,
            )
            if was_created:
                created += 1
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done! Created {created} interactions, {skipped} already existed."
        ))
