"""Dashboard views — KPI cards, activity feed, patient flow, department overview, AI insights.

Thin adapters calling into ``services.dashboard_service``.
"""
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..services.dashboard_service import (
    get_dashboard_kpis,
    get_live_activity,
    get_patient_flow,
    get_department_overview,
    get_ai_insights,
)
from .base import get_hospital_from_user


class DashboardView(generics.GenericAPIView):
    """Dashboard KPIs — 6 stat cards for the top row."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hospital = get_hospital_from_user(request.user)
        data = get_dashboard_kpis(hospital)
        return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_activity(request):
    """Live Activity Feed — recent encounters, registrations, invoices, alerts."""
    hospital = get_hospital_from_user(request.user)
    limit = int(request.query_params.get('limit', 15))
    data = get_live_activity(hospital, limit=limit)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_patient_flow(request):
    """Patient Flow (Today) — admissions, OPD visits, discharges, bed occupancy."""
    hospital = get_hospital_from_user(request.user)
    data = get_patient_flow(hospital)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_department_overview(request):
    """Department Overview — per-department patient count and occupancy."""
    hospital = get_hospital_from_user(request.user)
    data = get_department_overview(hospital)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_insights(request):
    """AI Insights — rule-based insights from current hospital data."""
    hospital = get_hospital_from_user(request.user)
    data = get_ai_insights(hospital)
    return Response(data)
