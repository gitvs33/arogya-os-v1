"""Pharmacy / drug inventory and dispensing models."""
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Drug(models.Model):
    """Master catalogue of drugs available in the pharmacy."""
    CATEGORY_CHOICES = [
        ('ANALGESIC', 'Analgesic'),
        ('ANTIBIOTIC', 'Antibiotic'),
        ('ANTIVIRAL', 'Antiviral'),
        ('CARDIOVASCULAR', 'Cardiovascular'),
        ('CNS', 'Central Nervous System'),
        ('DIABETIC', 'Diabetic'),
        ('GASTROINTESTINAL', 'Gastrointestinal'),
        ('RESPIRATORY', 'Respiratory'),
        ('VITAMIN', 'Vitamin & Supplement'),
        ('VACCINE', 'Vaccine'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200, blank=True, default='')
    brand_names = models.CharField(max_length=500, blank=True, default='', help_text='Comma-separated')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='OTHER')
    dosage_form = models.CharField(max_length=50, blank=True, default='', help_text='e.g. Tablet, Capsule, Syrup, Injection')
    strength = models.CharField(max_length=100, blank=True, default='', help_text='e.g. 500mg, 10mg/5ml')
    is_controlled = models.BooleanField(default=False, help_text='Controlled / scheduled substance')
    requires_prescription = models.BooleanField(default=True)

    # DDI reference
    known_interactions = models.TextField(blank=True, default='', help_text='Comma-separated drug names this interacts with')

    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='drugs',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['hospital', 'name', 'strength']
        ordering = ['name']

    def __str__(self):
        return f"{self.name} {self.strength}".strip()


class DrugInventory(models.Model):
    """Stock level for a drug at a hospital pharmacy."""
    drug = models.ForeignKey(
        Drug, on_delete=models.CASCADE,
        related_name='inventory_items',
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='drug_inventory',
    )
    batch_number = models.CharField(max_length=100, blank=True, default='')
    expiry_date = models.DateField(null=True, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(max_length=20, default='units', help_text='Tablets, ml, vials, etc.')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=10)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'drug inventories'
        indexes = [
            models.Index(fields=['hospital', 'drug']),
            models.Index(fields=['expiry_date']),
        ]

    def __str__(self):
        return f"{self.drug.name} x {self.quantity} {self.unit}"

    @property
    def is_low_stock(self):
        return self.quantity <= self.reorder_level

    @property
    def is_expired(self):
        return self.expiry_date and self.expiry_date < timezone.now().date()


class Dispensation(models.Model):
    """Record of a medication being dispensed to a patient."""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('DISPENSED', 'Dispensed'),
        ('PARTIAL', 'Partially Dispensed'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medication = models.ForeignKey(
        'Medication', on_delete=models.CASCADE,
        related_name='dispensations',
        null=True, blank=True,
        help_text='Link to the prescribed medication (optional for ad-hoc)',
    )
    encounter = models.ForeignKey(
        'Encounter', on_delete=models.CASCADE,
        related_name='dispensations',
        null=True, blank=True,
    )
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE,
        related_name='dispensations',
    )
    hospital = models.ForeignKey(
        'Hospital', on_delete=models.CASCADE,
        related_name='dispensations',
    )

    drug_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100, blank=True, default='')
    quantity_dispensed = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, default='units')

    # Inventory tracking
    inventory_item = models.ForeignKey(
        DrugInventory, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='dispensations',
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    dispensed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='dispensations_made',
    )
    dispensed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Dispense {self.drug_name} x {self.quantity_dispensed} for {self.patient}"

    def dispense(self, user):
        """Mark as dispensed and decrement inventory."""
        self.status = 'DISPENSED'
        self.dispensed_by = user
        self.dispensed_at = timezone.now()
        self.save()

        if self.inventory_item:
            self.inventory_item.quantity -= self.quantity_dispensed
            self.inventory_item.save(update_fields=['quantity'])
