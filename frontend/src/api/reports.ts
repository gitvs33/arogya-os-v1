import client from './client';

export const reportsApi = {
  getKPIs: (params = {}) => client.get('/reports/kpis/', { params }),
  
  getRevenueByDepartment: (params = {}) => client.get('/reports/charts/revenue-by-department/', { params }),
  getRevenueBySpecialty: (params = {}) => client.get('/reports/charts/revenue-by-specialty/', { params }),
  getRevenueTrend: (params = {}) => client.get('/reports/charts/revenue-trend/', { params }),
  
  getDepartmentPerformance: (params = {}) => client.get('/reports/tables/department-performance/', { params }),
  getTopDoctors: (params = {}) => client.get('/reports/tables/top-doctors/', { params }),
  
  getInsights: (params = {}) => client.get('/reports/insights/', { params }),
  
  getRecentReports: (params = {}) => client.get('/reports/recent/', { params }),
  generateReport: (data: any) => client.post('/reports/generate/', data),
  
  getScheduledReports: (params = {}) => client.get('/reports/scheduled/', { params }),
  getSavedViews: (params = {}) => client.get('/reports/saved-views/', { params }),
  getReportDefinitions: () => client.get('/reports/definitions/'),
};
