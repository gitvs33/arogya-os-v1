from django.contrib import admin
from .models import (
    Patient, Encounter, Vitals, Medication, SyncEntry,
    ReconciliationLog, DrugInteraction, Invoice, InvoiceLineItem,
    MedicalAlert,
)


class PatientAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'phone', 'gender', 'age', 'city', 'is_active', 'created_at']
    list_filter = ['gender', 'is_active', 'city']
    search_fields = ['first_name', 'last_name', 'phone', 'hospital_patient_id']
    date_hierarchy = 'created_at'


class EncounterAdmin(admin.ModelAdmin):
    list_display = ['patient', 'encounter_type', 'status', 'doctor', 'department', 'created_at']
    list_filter = ['status', 'encounter_type', 'department']
    search_fields = ['patient__first_name', 'patient__last_name', 'chief_complaint']
    date_hierarchy = 'created_at'


class VitalsInline(admin.TabularInline):
    model = Vitals
    extra = 0


class MedicationInline(admin.TabularInline):
    model = Medication
    extra = 0


class SyncEntryAdmin(admin.ModelAdmin):
    list_display = ['record_id', 'model_name', 'version', 'source', 'created_by', 'created_at']
    list_filter = ['model_name', 'source', 'version']
    date_hierarchy = 'created_at'


class DrugInteractionAdmin(admin.ModelAdmin):
    list_display = ['drug_a', 'drug_b', 'severity', 'source']
    list_filter = ['severity', 'source']
    search_fields = ['drug_a', 'drug_b']


class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'patient', 'invoice_type', 'status', 'total', 'created_at']
    list_filter = ['status', 'invoice_type']
    search_fields = ['invoice_number', 'patient__first_name']
    date_hierarchy = 'created_at'


class InvoiceLineItemInline(admin.TabularInline):
    model = InvoiceLineItem
    extra = 1


class MedicalAlertAdmin(admin.ModelAdmin):
    list_display = ['alert_type', 'severity', 'status', 'patient', 'message', 'created_at']
    list_filter = ['alert_type', 'severity', 'status']
    search_fields = ['message']


admin.site.register(Patient, PatientAdmin)
admin.site.register(Encounter, EncounterAdmin)
admin.site.register(SyncEntry, SyncEntryAdmin)
admin.site.register(DrugInteraction, DrugInteractionAdmin)
admin.site.register(Invoice, InvoiceAdmin)
admin.site.register(MedicalAlert, MedicalAlertAdmin)
