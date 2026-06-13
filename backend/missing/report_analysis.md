# Reports & Analytics Backend Requirements

The following endpoints are required in the backend to fully support the Reports & Analytics tabs. Some exist in `reports_views.py` but may need updating to return proper array lists instead of generic paginated wrappers, while others are entirely missing.

## 1. Overview Panel
- `GET /reports/kpis/`: High-level summary metrics (Revenue, Admissions, etc.)
- `GET /reports/charts/revenue-by-department/`: Departmental revenue split
- `GET /reports/charts/revenue-by-specialty/`: Specialty revenue split
- `GET /reports/charts/revenue-trend/`: Time-series revenue, collections, outstanding
- `GET /reports/tables/department-performance/`: Tabular department performance
- `GET /reports/tables/top-doctors/`: Top performing doctors
- `GET /reports/insights/`: AI-generated business insights

## 2. Billing Reports
- `GET /reports/billing/summary/`: Overall billing totals
- `GET /reports/billing/aging/`: AR aging analysis
- `GET /reports/billing/insurance-claims/`: Claim status and rejection analysis

## 3. Pharmacy Reports
- `GET /reports/pharmacy/dispensation/`: Drug dispensation volume
- `GET /reports/pharmacy/inventory-valuation/`: Current stock valuation
- `GET /reports/pharmacy/expiring-stock/`: Drugs nearing expiry

## 4. Laboratory Reports
- `GET /reports/lab/test-volumes/`: Test count by panel/category
- `GET /reports/lab/turnaround-time/`: Average TAT by test type

## 5. EMR Reports
- `GET /reports/emr/diagnoses/`: Top ICD-10 diagnoses
- `GET /reports/emr/admissions/`: Admission rates and sources

## 6. TeleICU Reports
- `GET /reports/teleicu/consults/`: Tele-consultation volumes and duration
- `GET /reports/teleicu/alerts-summary/`: Breakdown of ICU device alerts

## 7. Appointments Reports
- `GET /reports/appointments/no-show-rates/`: Patient no-show analysis
- `GET /reports/appointments/wait-times/`: Average wait times by department

## 8. Doctors Reports
- `GET /reports/doctors/utilization/`: Doctor schedule utilization
- `GET /reports/doctors/patient-satisfaction/`: Average rating/satisfaction score

## 9. Operations Reports
- `GET /reports/operations/bed-occupancy/`: Ward/bed occupancy rates
- `GET /reports/operations/resource-utilization/`: OT and Equipment utilization

## 10. AI Insights
- `GET /reports/ai/predictive-analytics/`: Forecasted admissions and revenue
- `GET /reports/ai/anomalies/`: Detected operational anomalies

**Global Filters Note:** All endpoints must support the following global query parameters: `date_from`, `date_to`, `location_id`, `department`, `doctor_id`, `payer`.
