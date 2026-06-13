"""Main dashboard statistics serializer."""
from rest_framework import serializers


class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics response."""
    total_patients = serializers.IntegerField()
    today_encounters = serializers.IntegerField()
    active_alerts = serializers.IntegerField()
    pending_invoices = serializers.IntegerField()
