"""Admin permission metadata endpoint.

Returns the canonical list of permission modules and their actions
so the frontend can render the permission matrix dynamically.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...permission_registry import PERMISSION_MODULES, all_actions
from ...permissions import HasAdminManageRoles


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAdminManageRoles])
def permission_metadata(request):
    """Return the permission module registry for the permission matrix UI.

    The frontend uses this to render module rows and action columns
    dynamically instead of hardcoding them.
    """
    return Response({
        'modules': [
            {
                'id': m.id,
                'name': m.name,
                'actions': m.actions,
            }
            for m in PERMISSION_MODULES
        ],
        'all_actions': all_actions(),
    })
