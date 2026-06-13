"""Reports & Analytics — AI Insights sidebar."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import AIInsight
from ..serializers import AIInsightSerializer
from ..subscriptions import require_feature


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('reports')
def reports_insights(request):
    """Return recent AI-generated insights for the right sidebar.

    Returns AIInsight records ordered by generated_at descending.
    """
    insights = AIInsight.objects.all()[:20]
    serializer = AIInsightSerializer(insights, many=True)
    return Response(serializer.data)
