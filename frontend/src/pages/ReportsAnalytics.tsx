import React, { useState } from 'react';
import { 
  Download, Clock, PieChart as PieChartIcon,
  Calendar as CalendarIcon, MapPin, Building, Stethoscope, CreditCard, Star, ChevronRight, Eye
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reports';
import './reports-tabs/ReportsPanels.css';

import OverviewPanel from './reports-tabs/OverviewPanel';
import BillingReportsPanel from './reports-tabs/BillingReportsPanel';
import PharmacyReportsPanel from './reports-tabs/PharmacyReportsPanel';
import LaboratoryReportsPanel from './reports-tabs/LaboratoryReportsPanel';
import EMRReportsPanel from './reports-tabs/EMRReportsPanel';
import TeleICUReportsPanel from './reports-tabs/TeleICUReportsPanel';
import AppointmentsReportsPanel from './reports-tabs/AppointmentsReportsPanel';
import DoctorsReportsPanel from './reports-tabs/DoctorsReportsPanel';
import OperationsReportsPanel from './reports-tabs/OperationsReportsPanel';
import AIInsightsPanel from './reports-tabs/AIInsightsPanel';

export default function ReportsAnalytics() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [trendInterval, setTrendInterval] = useState('Daily');
  
  const filters = {};

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const { data: kpisData } = useQuery({ queryKey: ['reports-kpis', filters], queryFn: () => reportsApi.getKPIs(filters).then(r => r.data) });
  const { data: revDeptData } = useQuery({ queryKey: ['reports-rev-dept', filters], queryFn: () => reportsApi.getRevenueByDepartment(filters).then(r => r.data) });
  const { data: revSpecData } = useQuery({ queryKey: ['reports-rev-spec', filters], queryFn: () => reportsApi.getRevenueBySpecialty(filters).then(r => r.data) });
  const { data: revTrendData } = useQuery({ queryKey: ['reports-rev-trend', trendInterval, filters], queryFn: () => reportsApi.getRevenueTrend({ ...filters, interval: trendInterval.toLowerCase() }).then(r => r.data) });
  const { data: deptPerfData } = useQuery({ queryKey: ['reports-dept-perf', filters], queryFn: () => reportsApi.getDepartmentPerformance(filters).then(r => r.data) });
  const { data: topDocsData } = useQuery({ queryKey: ['reports-top-docs', filters], queryFn: () => reportsApi.getTopDoctors(filters).then(r => r.data) });
  const { data: insightsData } = useQuery({ queryKey: ['reports-insights'], queryFn: () => reportsApi.getInsights().then(r => r.data) });
  const { data: recentReportsData } = useQuery({ queryKey: ['reports-recent'], queryFn: () => reportsApi.getRecentReports().then(r => r.data) });
  const { data: scheduledReportsData } = useQuery({ queryKey: ['reports-scheduled'], queryFn: () => reportsApi.getScheduledReports().then(r => r.data) });
  const { data: savedViewsData } = useQuery({ queryKey: ['reports-saved-views'], queryFn: () => reportsApi.getSavedViews().then(r => r.data) });

  const data = {
    kpis: kpisData || {},
    revDept: revDeptData || [],
    revSpec: revSpecData || [],
    revTrend: revTrendData || [],
    deptPerf: deptPerfData || [],
    topDocs: topDocsData || [],
    insights: insightsData || [],
    recentReports: recentReportsData || [],
    scheduledReports: scheduledReportsData || [],
    savedViews: savedViewsData || []
  };

  const TABS = [
    'Overview', 'Billing Reports', 'Pharmacy Reports', 'Laboratory Reports', 
    'EMR Reports', 'TeleICU Reports', 'Appointments Reports', 'Doctors Reports', 
    'Operations Reports', 'AI Insights'
  ];

  return (
    <div className="flex h-full -mx-4 -mt-4 bg-[#F8F9FA] min-h-[calc(100vh-80px)]">
      
      {/* ── Left Sidebar (Vertical Tabs) ── */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col py-4">
        <div className="px-4 mb-2">
          <h2 className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Categories</h2>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 px-2">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === tab 
                  ? 'bg-emerald-50 text-[#0A6253]' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab}
              {activeTab === tab && <div className="w-1.5 h-1.5 rounded-full bg-[#0A6253]" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 max-w-[1600px] mx-auto w-full">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">Hospital-wide operational and clinical intelligence</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
                <Download size={16} /> Export
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
                <Clock size={16} /> Schedule Report
              </button>
              <button className="flex items-center gap-2 px-5 py-2 bg-[#0A6253] text-white rounded-lg text-sm font-bold hover:bg-[#084d41] shadow-md transition-colors">
                <PieChartIcon size={16} /> Create Dashboard
              </button>
            </div>
          </div>

          {/* Global Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 mb-6 flex items-center gap-3 shadow-sm flex-wrap">
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 hover:bg-white hover:border-[#0A6253] cursor-pointer">
              <CalendarIcon size={16} className="text-gray-400" />
              <span className="font-semibold">20 Jun 2026 – 20 Jun 2026</span>
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 hover:bg-white hover:border-[#0A6253] cursor-pointer">
              <MapPin size={16} className="text-gray-400" />
              <span className="font-semibold">All Locations</span>
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 hover:bg-white hover:border-[#0A6253] cursor-pointer">
              <Building size={16} className="text-gray-400" />
              <span className="font-semibold">All Departments</span>
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 hover:bg-white hover:border-[#0A6253] cursor-pointer">
              <Stethoscope size={16} className="text-gray-400" />
              <span className="font-semibold">All Doctors</span>
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 hover:bg-white hover:border-[#0A6253] cursor-pointer">
              <CreditCard size={16} className="text-gray-400" />
              <span className="font-semibold">All Payers</span>
            </div>
            
            <div className="flex-1 flex justify-end gap-3">
              <button className="text-xs font-bold text-gray-500 hover:text-gray-700">Reset Filters</button>
              <button className="flex items-center gap-1.5 text-xs font-bold text-[#0A6253] bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100">
                <Star size={14} /> Save View
              </button>
            </div>
          </div>

          {/* Dynamic Panel Rendering */}
          {activeTab === 'Overview' && <OverviewPanel data={data} state={{ trendInterval }} setState={{ setTrendInterval }} />}
          {activeTab === 'Billing Reports' && <BillingReportsPanel />}
          {activeTab === 'Pharmacy Reports' && <PharmacyReportsPanel />}
          {activeTab === 'Laboratory Reports' && <LaboratoryReportsPanel />}
          {activeTab === 'EMR Reports' && <EMRReportsPanel />}
          {activeTab === 'TeleICU Reports' && <TeleICUReportsPanel />}
          {activeTab === 'Appointments Reports' && <AppointmentsReportsPanel />}
          {activeTab === 'Doctors Reports' && <DoctorsReportsPanel />}
          {activeTab === 'Operations Reports' && <OperationsReportsPanel />}
          {activeTab === 'AI Insights' && <AIInsightsPanel />}

        </div>
      </div>
    </div>
  );
}
