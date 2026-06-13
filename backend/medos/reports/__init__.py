"""Reports & Analytics — Domain Package.

Backward-compatible re-exports so existing `from .reports import ...` still works.
"""
from .helpers import (
    _parse_global_filters,
    _get_current_period,
    _get_previous_period,
    _apply_encounter_filters,
    _apply_invoice_filters,
    _compute_growth,
    _get_period_bounds,
)
from .kpi import reports_kpis
from .charts import (
    chart_revenue_by_department,
    chart_revenue_by_specialty,
    chart_revenue_trend,
)
from .tables import table_department_performance, table_top_doctors
from .insights import reports_insights
from .management import (
    recent_reports,
    generate_report,
    scheduled_reports,
    saved_dashboard_views,
    reports_report_definitions,
)

__all__ = [
    '_parse_global_filters',
    '_get_current_period',
    '_get_previous_period',
    '_apply_encounter_filters',
    '_apply_invoice_filters',
    '_compute_growth',
    '_get_period_bounds',
    'reports_kpis',
    'chart_revenue_by_department',
    'chart_revenue_by_specialty',
    'chart_revenue_trend',
    'table_department_performance',
    'table_top_doctors',
    'reports_insights',
    'recent_reports',
    'generate_report',
    'scheduled_reports',
    'saved_dashboard_views',
    'reports_report_definitions',
]
