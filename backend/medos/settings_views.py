"""Settings views — singleton, integrations, webhooks, templates."""
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .views.base import HospitalScopedViewSet

from .settings_models import (
    HospitalProfile,
    BillingSettings,
    PharmacySettings,
    LaboratorySettings,
    TeleICUSettings,
    NotificationSettings,
    IntegrationSetting,
    Webhook,
    DataPolicySettings,
    LocalizationSettings,
    Template,
)
from .settings_serializers import (
    HospitalProfileSerializer,
    BillingSettingsSerializer,
    PharmacySettingsSerializer,
    LaboratorySettingsSerializer,
    TeleICUSettingsSerializer,
    NotificationSettingsSerializer,
    IntegrationSettingSerializer,
    WebhookSerializer,
    DataPolicySettingsSerializer,
    LocalizationSettingsSerializer,
    TemplateSerializer,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Singleton settings — one generic view backed by a registry
# ═══════════════════════════════════════════════════════════════════════════════

_SINGLETON_SETTINGS = {
    'hospital-profile': (HospitalProfile, HospitalProfileSerializer),
    'billing': (BillingSettings, BillingSettingsSerializer),
    'pharmacy': (PharmacySettings, PharmacySettingsSerializer),
    'laboratory': (LaboratorySettings, LaboratorySettingsSerializer),
    'teleicu': (TeleICUSettings, TeleICUSettingsSerializer),
    'notifications': (NotificationSettings, NotificationSettingsSerializer),
    'data-policies': (DataPolicySettings, DataPolicySettingsSerializer),
    'localization': (LocalizationSettings, LocalizationSettingsSerializer),
}


def _get_hospital(user):
    """Resolve the hospital for a user via their profile."""
    profile = getattr(user, 'hospital_profile', None)
    if profile is None:
        return None
    return profile.hospital


def _get_or_create_settings_instance(model_cls, hospital):
    """Get-or-create a singleton settings instance for the given hospital."""
    instance, _ = model_cls.objects.get_or_create(hospital=hospital)
    return instance


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def singleton_settings_view(request, setting_name):
    """Generic GET/PATCH for any per-hospital singleton setting.

    The ``setting_name`` slug is looked up in ``_SINGLETON_SETTINGS``
    to find the model and serializer.  This avoids 8 nearly-identical
    view functions.
    """
    try:
        model_cls, serializer_cls = _SINGLETON_SETTINGS[setting_name]
    except KeyError:
        return Response(
            {'error': f'Unknown setting: {setting_name}'},
            status=status.HTTP_404_NOT_FOUND,
        )

    hospital = _get_hospital(request.user)
    if hospital is None:
        return Response(
            {'error': 'User has no hospital association'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    instance = _get_or_create_settings_instance(model_cls, hospital)

    if request.method == 'GET':
        serializer = serializer_cls(instance)
        return Response(serializer.data)

    # PATCH
    serializer = serializer_cls(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════════════════
# Integrations (multi-instance, not singleton)
# ═══════════════════════════════════════════════════════════════════════════════


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def integration_settings(request):
    """GET / PATCH all integrations as a dict keyed by integration type.

    GET  -> { "pacs": { "connected": bool, "clientId": str, ... }, ... }
    PATCH -> same structure; only supplied keys are updated.
    """
    if request.method == 'GET':
        integrations = IntegrationSetting.objects.all()
        result = {}
        for integ in integrations:
            ser = IntegrationSettingSerializer(integ)
            result[integ.id] = ser.data
        return Response(result)

    # PATCH — update only the integrations supplied in the request body
    data = request.data
    if not isinstance(data, dict):
        return Response(
            {'error': 'Expected a dict keyed by integration type'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    for key, cfg in data.items():
        if not isinstance(cfg, dict):
            continue
        try:
            integ = IntegrationSetting.objects.get(pk=key)
        except IntegrationSetting.DoesNotExist:
            continue
        ser = IntegrationSettingSerializer(integ, data=cfg, partial=True)
        if ser.is_valid():
            ser.save()
        else:
            return Response(
                {key: ser.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # Re-read and return the full map
    integrations = IntegrationSetting.objects.all()
    result = {}
    for integ in integrations:
        ser = IntegrationSettingSerializer(integ)
        result[integ.id] = ser.data
    return Response(result)


# ═══════════════════════════════════════════════════════════════════════════════
# Webhooks — CRUD ViewSet
# ═══════════════════════════════════════════════════════════════════════════════


class WebhookViewSet(viewsets.ModelViewSet):
    """CRUD for webhook endpoints.

    GET  /settings/webhooks/   -> list all webhooks
    POST /settings/webhooks/   -> create a webhook
    DELETE /settings/webhooks/<id>/ -> delete a webhook
    PATCH /settings/webhooks/<id>/ -> update partial
    """
    queryset = Webhook.objects.all()
    serializer_class = WebhookSerializer
    permission_classes = [IsAuthenticated]


# ═══════════════════════════════════════════════════════════════════════════════
# Templates — CRUD ViewSet
# ═══════════════════════════════════════════════════════════════════════════════


class TemplateViewSet(HospitalScopedViewSet):
    """CRUD for print/email templates (hospital-scoped).

    GET    /settings/templates/       -> list hospital's templates
    POST   /settings/templates/       -> create a template (auto-sets hospital)
    PATCH  /settings/templates/<id>/  -> update a template
    DELETE /settings/templates/<id/  -> delete a template
    """
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(hospital=self.get_hospital())
