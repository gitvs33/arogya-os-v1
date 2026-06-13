import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { encountersApi } from '../api/encounters';
import client from '../api/client';
import {
  Search, SlidersHorizontal, Plus, LayoutGrid, List,
  FileText, FlaskConical, Pill, MoreVertical,
  ChevronDown, AlertTriangle, Eye, Activity, Calendar, UserPlus, Bed,
  Printer, Download, Headset, ShieldAlert, Clock, CheckCircle2, Ambulance,
  X
} from 'lucide-react';

export default function Encounters() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All'); // chip state only
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Filter state ────────────────────────────────────────────────────
  const [locationFilter, setLocationFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [visitTypeFilter, setVisitTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Close dropdown when clicking outside
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Fetch filter options ────────────────────────────────────────────
  const { data: filterOptions } = useQuery({
    queryKey: ['encounter-filter-options'],
    queryFn: () => encountersApi.listFilterOptions().then(res => res.data),
  });

  // ── Build API params ────────────────────────────────────────────────
  const apiParams: Record<string, any> = { search, page, page_size: pageSize };
  if (locationFilter) apiParams.location = locationFilter;
  if (departmentFilter) apiParams.department = departmentFilter;
  if (visitTypeFilter) apiParams.encounter_type = visitTypeFilter;
  if (statusFilter) apiParams.status = statusFilter;
  if (doctorFilter) apiParams.doctor = doctorFilter;
  // Chip overrides dropdown if set (and vice versa)
  const effectiveVisitType = visitTypeFilter || (typeFilter !== 'All' ? typeFilter : '');
  if (effectiveVisitType) apiParams.encounter_type = effectiveVisitType;

  // ── Fetch Encounters ────────────────────────────────────────────────
  const { data: encountersData, isLoading } = useQuery({
    queryKey: ['encounters', apiParams],
    queryFn: () => encountersApi.list(apiParams).then(res => res.data),
  });

  // Fetch Alerts for AI Insights
  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => client.get('/alerts/').then(res => res.data)
  });

  const encounters = encountersData?.results || encountersData || [];
  const alerts = alertsData?.results || alertsData || [];

  // Derived stats — from total_count in API response
  const totalCount = encountersData?.count || encounters.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Client-side stat counts (approximate from current page)
  const opdCount = encounters.filter((e: any) => e.encounter_type === 'OPD').length;
  const ipdCount = encounters.filter((e: any) => e.encounter_type === 'IPD').length;
  const icuCount = encounters.filter((e: any) => e.bed_number?.includes('ICU')).length;
  const erCount = encounters.filter((e: any) => e.encounter_type === 'EMERGENCY').length;
  const dischargedCount = encounters.filter((e: any) => e.status === 'COMPLETED').length;

  const ddiAlertsCount = alerts.filter((a: any) => a.alert_type === 'DDI' && a.status === 'ACTIVE').length;
  const highRiskCount = alerts.filter((a: any) => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length;
  const followUpCount = encounters.filter((e: any) => e.status === 'PLANNED').length;
  const labPendingCount = 0;

  // ── Dropdown toggle helper ──────────────────────────────────────────
  const toggleDropdown = (name: string) => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  // ── Filter label helpers ────────────────────────────────────────────
  const filterLabel = (key: string, val: string) => {
    if (!val) return 'All';
    // Look up in filter options
    if (key === 'encounter_type') {
      const found = filterOptions?.encounter_types?.find((o: any) => o.value === val);
      return found?.label || val;
    }
    if (key === 'status') {
      const found = filterOptions?.statuses?.find((o: any) => o.value === val);
      return found?.label || val;
    }
    if (key === 'clinical_acuity') {
      const found = filterOptions?.clinical_acuties?.find((o: any) => o.value === val);
      return found?.label || val;
    }
    if (key === 'doctor') {
      const found = filterOptions?.doctors?.find((o: any) => o.id === val);
      return found?.name || val;
    }
    return val;
  };

  const renderAcuityBadge = (acuity: string) => {
    switch (acuity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="flex items-center gap-1 text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full text-xs font-semibold"><Activity size={12} /> Critical</span>;
      case 'OBSERVATION':
        return <span className="flex items-center gap-1 text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full text-xs font-semibold"><Eye size={12} /> Observation</span>;
      case 'STABLE':
      default:
        return <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full text-xs font-semibold"><CheckCircle2 size={12} /> Stable</span>;
    }
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-140px)]">
      
      {/* ── MAIN CONTENT (Left side) ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Patients</h1>
            <p className="text-sm text-gray-500 mt-1">View and manage all patient records across the hospital</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <SlidersHorizontal size={16} /> Hide Filters
            </button>
            <Link to="/patients/new" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0A6253] rounded-lg hover:bg-[#084e42] transition-colors">
              <Plus size={16} /> New Patient
            </Link>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search within results..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:border-transparent"
            />
          </div>
          
          {/* Location Filter */}
          <FilterDropdown
            label="Location"
            value={locationFilter}
            displayValue={filterLabel('location', locationFilter)}
            isOpen={openDropdown === 'location'}
            onToggle={() => toggleDropdown('location')}
            onSelect={(val) => { setLocationFilter(val); setOpenDropdown(null); }}
            options={(filterOptions?.departments || []).map((d: string) => ({ value: d, label: d }))}
            placeholder="All Locations"
          />

          {/* Department Filter */}
          <FilterDropdown
            label="Department"
            value={departmentFilter}
            displayValue={filterLabel('department', departmentFilter)}
            isOpen={openDropdown === 'department'}
            onToggle={() => toggleDropdown('department')}
            onSelect={(val) => { setDepartmentFilter(val); setOpenDropdown(null); }}
            options={(filterOptions?.departments || []).map((d: string) => ({ value: d, label: d }))}
            placeholder="All Departments"
          />

          {/* Visit Type Filter */}
          <FilterDropdown
            label="Visit Type"
            value={visitTypeFilter}
            displayValue={filterLabel('encounter_type', visitTypeFilter)}
            isOpen={openDropdown === 'visitType'}
            onToggle={() => toggleDropdown('visitType')}
            onSelect={(val) => { setVisitTypeFilter(val); setOpenDropdown(null); }}
            options={filterOptions?.encounter_types || []}
            placeholder="All"
          />

          {/* Status Filter */}
          <FilterDropdown
            label="Status"
            value={statusFilter}
            displayValue={filterLabel('status', statusFilter)}
            isOpen={openDropdown === 'status'}
            onToggle={() => toggleDropdown('status')}
            onSelect={(val) => { setStatusFilter(val); setOpenDropdown(null); }}
            options={filterOptions?.statuses || []}
            placeholder="All Status"
          />

          {/* Doctor Filter */}
          <FilterDropdown
            label="Doctor"
            value={doctorFilter}
            displayValue={filterLabel('doctor', doctorFilter)}
            isOpen={openDropdown === 'doctor'}
            onToggle={() => toggleDropdown('doctor')}
            onSelect={(val) => { setDoctorFilter(val); setOpenDropdown(null); }}
            options={filterOptions?.doctors?.map((d: any) => ({ value: d.id, label: d.name })) || []}
            placeholder="All Doctors"
          />

          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <SlidersHorizontal size={14} /> More Filters
          </button>
        </div>

        {/* Chips & View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'All', label: 'All Patients', count: totalCount },
              { id: 'OPD', label: 'OPD', count: opdCount },
              { id: 'IPD', label: 'IPD', count: ipdCount },
              { id: 'ICU', label: 'ICU', count: icuCount, color: 'text-red-500' },
              { id: 'Emergency', label: 'Emergency', count: erCount, color: 'text-orange-500' },
              { id: 'Discharged', label: 'Discharged', count: dischargedCount },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => {
                  setTypeFilter(tab.id);
                  if (tab.id === 'All') setVisitTypeFilter('');
                  else setVisitTypeFilter(tab.id);
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border ${
                  effectiveVisitType
                    ? tab.id === effectiveVisitType
                      ? 'bg-[#E8F5F0] text-[#0A6253] border-[#0A6253]'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    : tab.id === 'All'
                    ? 'bg-[#E8F5F0] text-[#0A6253] border-[#0A6253]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label} <span className={tab.color || (typeFilter === tab.id ? 'text-[#0A6253]' : 'text-gray-400')}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              Sort by <span className="font-semibold text-gray-900 flex items-center cursor-pointer">Last Visit (Recent) <ChevronDown size={14} className="ml-1" /></span>
            </div>
            <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
              <button className="p-1 text-gray-400 hover:text-gray-800 rounded"><LayoutGrid size={16} /></button>
              <button className="p-1 bg-[#E8F5F0] text-[#0A6253] rounded shadow-sm"><List size={16} /></button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 flex-1 overflow-hidden flex flex-col shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-gray-500 text-xs uppercase font-semibold border-b border-gray-200">
                  <th className="px-6 py-4 font-semibold tracking-wider">Patient</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">MRN / ID</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Visit Details</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Doctor / Department</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Last Visit</th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading patients...</td></tr>
                ) : encounters.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500">No patients found.</td></tr>
                ) : (
                  encounters.map((enc: any) => (
                    <tr 
                      key={enc.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${enc.patient}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {enc.patient?.profile_picture ? (
                            <img src={enc.patient.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg">
                              {enc.patient_name?.charAt(0) || 'P'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-gray-900">{enc.patient_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                              {enc.patient?.age || 'N/A'} Y / {enc.patient?.gender === 'M' ? 'Male' : enc.patient?.gender === 'F' ? 'Female' : 'Other'}
                              {enc.patient?.blood_group && (
                                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{enc.patient.blood_group}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-700">MRN: {enc.patient?.hospital_patient_id || 'N/A'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{enc.encounter_number || `ENC-${enc.id?.substring(0,8)}`}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-xs font-bold inline-block px-1.5 py-0.5 rounded ${
                          enc.encounter_type === 'IPD' ? 'bg-blue-50 text-blue-600' : 
                          enc.encounter_type === 'EMERGENCY' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {enc.encounter_type}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{enc.department || 'General'}</div>
                        {enc.bed_number && <div className="text-xs text-gray-500 mt-0.5">Bed: {enc.bed_number}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                          {enc.doctor || 'Unassigned'} <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{enc.department}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          {renderAcuityBadge(enc.clinical_acuity || 'STABLE')}
                          <span className="text-[10px] text-gray-500 font-medium ml-1">{enc.care_sub_status || 'Under Care'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-800">{new Date(enc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{new Date(enc.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-gray-400">
                          <button className="p-1.5 hover:text-[#0A6253] hover:bg-teal-50 rounded border border-gray-200 transition-colors" title="Records"><FileText size={16} /></button>
                          <button className="p-1.5 hover:text-[#0A6253] hover:bg-teal-50 rounded border border-gray-200 transition-colors" title="Prescriptions"><Pill size={16} /></button>
                          <button className="p-1.5 hover:text-[#0A6253] hover:bg-teal-50 rounded border border-gray-200 transition-colors" title="Labs"><FlaskConical size={16} /></button>
                          <button className="p-1.5 hover:text-gray-800 hover:bg-gray-100 rounded border border-transparent transition-colors"><MoreVertical size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm text-gray-600 mt-auto">
            <div>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} patients</div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-50"
              >&lt;</button>
              <button className="px-3 py-1 bg-white border border-[#0A6253] text-[#0A6253] rounded font-semibold">{page}</button>
              <span className="px-2 text-gray-400">of {totalPages}</span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >&gt;</button>
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-gray-200 rounded p-1 bg-white outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ── */}
      <div className="w-80 flex flex-col gap-6">
        
        {/* AI Insights */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">AI Insights</h2>
            <button className="text-xs font-semibold text-[#0A6253] hover:underline">View all</button>
          </div>
          <div className="p-5 flex flex-col gap-3">
            
            <div className="flex items-start gap-4 p-3 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-red-500 mt-0.5"><AlertTriangle size={20} /></div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">High Risk Patients</h3>
                <p className="text-xs text-gray-600 mt-0.5">{highRiskCount} patients require immediate attention</p>
              </div>
              <ChevronDown size={16} className="text-gray-400 -rotate-90" />
            </div>

            <div className="flex items-start gap-4 p-3 rounded-lg bg-orange-50 border border-orange-100 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-orange-500 mt-0.5"><Clock size={20} /></div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">Follow-up Due</h3>
                <p className="text-xs text-gray-600 mt-0.5">{followUpCount} patients have follow-up pending</p>
              </div>
              <ChevronDown size={16} className="text-gray-400 -rotate-90" />
            </div>

            <div className="flex items-start gap-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-emerald-500 mt-0.5"><FlaskConical size={20} /></div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">Lab Results Pending</h3>
                <p className="text-xs text-gray-600 mt-0.5">{labPendingCount} reports are awaiting review</p>
              </div>
              <ChevronDown size={16} className="text-gray-400 -rotate-90" />
            </div>

            <div className="flex items-start gap-4 p-3 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-blue-500 mt-0.5"><Pill size={20} /></div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">Drug Interaction Alerts</h3>
                <p className="text-xs text-gray-600 mt-0.5">{ddiAlertsCount} patients have potential medication interactions</p>
              </div>
              <ChevronDown size={16} className="text-gray-400 -rotate-90" />
            </div>

          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-5 grid grid-cols-3 gap-3">
            <button 
              onClick={() => navigate('/patients/new', { state: { visitType: 'OPD Consultation' } })}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-100 hover:border-[#0A6253] hover:bg-teal-50 transition-colors gap-2 text-[#0A6253]"
            >
              <UserPlus size={24} />
              <span className="text-xs font-semibold text-gray-700">New OPD</span>
            </button>
            <button 
              onClick={() => navigate('/patients/new', { state: { visitType: 'Inpatient' } })}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-100 hover:border-[#0A6253] hover:bg-teal-50 transition-colors gap-2 text-[#0A6253]"
            >
              <Bed size={24} />
              <span className="text-xs font-semibold text-gray-700">New IPD</span>
            </button>
            <button 
              onClick={() => navigate('/patients/new', { state: { visitType: 'Emergency' } })}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-100 hover:border-red-500 hover:bg-red-50 transition-colors gap-2 text-red-500"
            >
              <Ambulance size={24} />
              <span className="text-xs font-semibold text-gray-700">Emergency</span>
            </button>
            <button 
              onClick={() => navigate('/appointments')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-100 hover:border-[#0A6253] hover:bg-teal-50 transition-colors gap-2 text-[#0A6253]"
            >
              <Calendar size={24} />
              <span className="text-xs font-semibold text-gray-700">Schedule</span>
            </button>
            <button 
              onClick={() => alert('Sending print job to local label printer...')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-100 hover:border-[#0A6253] hover:bg-teal-50 transition-colors gap-2 text-gray-500"
            >
              <Printer size={24} />
              <span className="text-xs font-semibold text-gray-700">Print Labels</span>
            </button>
            <button 
              onClick={() => alert('Exporting patient list to CSV...')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-100 hover:border-[#0A6253] hover:bg-teal-50 transition-colors gap-2 text-[#0A6253]"
            >
              <Download size={24} />
              <span className="text-xs font-semibold text-gray-700">Export List</span>
            </button>
          </div>
        </div>

        {/* Need Help */}
        <div className="bg-[#F0FDF4] rounded-xl border border-[#bbf7d0] p-5 flex items-start gap-4">
          <div className="bg-white p-2 rounded-full text-emerald-600 shadow-sm">
            <Headset size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Need Help?</h3>
            <p className="text-xs text-gray-600 mt-1">Open support ticket or chat with our team</p>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FilterDropdown — reusable dropdown component
   ═══════════════════════════════════════════════════════════════════════════ */

interface FilterOption {
  value: string;
  label: string;
}

function FilterDropdown({
  label,
  value,
  displayValue,
  isOpen,
  onToggle,
  onSelect,
  options,
  placeholder,
  searchable = false,
}: {
  label: string;
  value: string;
  displayValue: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  options: FilterOption[];
  placeholder: string;
  searchable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${
          value ? 'border-[#0A6253] bg-teal-50' : 'border-gray-200'
        }`}
      >
        <div className="flex flex-col text-left">
          <span className="text-[10px] text-gray-400 font-semibold uppercase leading-tight">{label}</span>
          <span className={`text-sm font-medium leading-tight ${value ? 'text-[#0A6253]' : 'text-gray-800'}`}>
            {displayValue || placeholder}
          </span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-hidden flex flex-col">
          {/* Search input for long lists */}
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-[#0A6253]"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto flex-1">
            {/* Clear / All option */}
            <button
              onClick={() => { onSelect(''); setSearch(''); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                !value ? 'bg-[#E8F5F0] text-[#0A6253] font-semibold' : 'text-gray-600'
              }`}
            >
              {!value && <CheckCircle2 size={14} className="text-[#0A6253]" />}
              {placeholder || 'All'}
            </button>

            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400 text-center">No options found</div>
            )}

            {filtered.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onSelect(opt.value); setSearch(''); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  value === opt.value ? 'bg-[#E8F5F0] text-[#0A6253] font-semibold' : 'text-gray-700'
                }`}
              >
                {value === opt.value && <CheckCircle2 size={14} className="text-[#0A6253]" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
