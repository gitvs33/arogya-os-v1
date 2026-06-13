import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { 
  FlaskConical, 
  Save, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Activity, 
  Clock, 
  Smartphone,
  ShieldCheck,
  Globe
} from 'lucide-react';

interface LaboratorySettingsData {
  autoApproveNormalResults: boolean;
  criticalValueSmsAlerts: boolean;
  enableExternalPortalAccess: boolean;
  defaultTurnaroundTimeHours: number;
  qualityControlCheckFreq: number;
}

export default function LaboratorySettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<LaboratorySettingsData>({
    autoApproveNormalResults: false,
    criticalValueSmsAlerts: true,
    enableExternalPortalAccess: false,
    defaultTurnaroundTimeHours: 24,
    qualityControlCheckFreq: 1,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['laboratorySettings'],
    queryFn: async () => {
      const response = await settingsApi.getLaboratorySettings();
      return response.data;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData({
        autoApproveNormalResults: data.autoApproveNormalResults ?? false,
        criticalValueSmsAlerts: data.criticalValueSmsAlerts ?? true,
        enableExternalPortalAccess: data.enableExternalPortalAccess ?? false,
        defaultTurnaroundTimeHours: data.defaultTurnaroundTimeHours ?? 24,
        qualityControlCheckFreq: data.qualityControlCheckFreq ?? 1,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (newSettings: LaboratorySettingsData) => settingsApi.updateLaboratorySettings(newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratorySettings'] });
    },
  });

  const handleToggle = (field: keyof LaboratorySettingsData) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleNumberChange = (field: keyof LaboratorySettingsData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: parseInt(value, 10) || 0,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-200">
        <Loader2 className="h-8 w-8 animate-spin text-[#0A6253]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-200 text-red-500">
        <AlertCircle className="h-10 w-10 mb-4" />
        <p className="text-lg font-medium">Failed to load settings.</p>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['laboratorySettings'] })}
          className="mt-4 px-4 py-2 text-sm font-medium bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 px-8 py-6 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0A6253]/10 text-[#0A6253] rounded-xl">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Laboratory Settings</h2>
            <p className="text-sm text-gray-500 mt-1">Manage rules and configurations for the hospital laboratory.</p>
          </div>
        </div>
        {mutation.isSuccess && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            <span>Saved successfully</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        
        {/* Number Inputs Section */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Metrics &amp; Frequency</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label htmlFor="defaultTurnaroundTimeHours" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Clock className="h-4 w-4 text-gray-400" />
                Default Turnaround Time (hours)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="defaultTurnaroundTimeHours"
                  min="1"
                  value={formData.defaultTurnaroundTimeHours}
                  onChange={(e) => handleNumberChange('defaultTurnaroundTimeHours', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-[#0A6253] focus:ring-[#0A6253] focus:ring-1 sm:text-sm outline-none transition-all shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-500 text-sm">
                  hrs
                </div>
              </div>
              <p className="text-xs text-gray-500">Standard expected time for lab results.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="qualityControlCheckFreq" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Activity className="h-4 w-4 text-gray-400" />
                QC Check Frequency (per week)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="qualityControlCheckFreq"
                  min="1"
                  value={formData.qualityControlCheckFreq}
                  onChange={(e) => handleNumberChange('qualityControlCheckFreq', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-[#0A6253] focus:ring-[#0A6253] focus:ring-1 sm:text-sm outline-none transition-all shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-500 text-sm">
                  / wk
                </div>
              </div>
              <p className="text-xs text-gray-500">Number of mandatory equipment calibrations.</p>
            </div>

          </div>
        </div>

        <div className="h-px bg-gray-200 w-full"></div>

        {/* Toggles Section */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Automation &amp; Access</h3>
          
          <div className="space-y-4">
            
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Auto-Approve Normal Results</h4>
                  <p className="text-sm text-gray-500 mt-1">Automatically sign off tests that fall within normal reference ranges.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.autoApproveNormalResults}
                onClick={() => handleToggle('autoApproveNormalResults')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 ${
                  formData.autoApproveNormalResults ? 'bg-[#0A6253]' : 'bg-gray-200'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.autoApproveNormalResults ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 bg-orange-100 text-orange-600 rounded-lg">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Critical Value SMS Alerts</h4>
                  <p className="text-sm text-gray-500 mt-1">Send immediate SMS notifications to assigned doctors for abnormal lab values.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.criticalValueSmsAlerts}
                onClick={() => handleToggle('criticalValueSmsAlerts')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 ${
                  formData.criticalValueSmsAlerts ? 'bg-[#0A6253]' : 'bg-gray-200'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.criticalValueSmsAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Enable External Portal Access</h4>
                  <p className="text-sm text-gray-500 mt-1">Allow partner clinics to submit requests and view results securely via portal.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.enableExternalPortalAccess}
                onClick={() => handleToggle('enableExternalPortalAccess')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 ${
                  formData.enableExternalPortalAccess ? 'bg-[#0A6253]' : 'bg-gray-200'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.enableExternalPortalAccess ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>
        </div>

        <div className="pt-6 flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0A6253] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#0A6253]/90 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 disabled:opacity-70 transition-all"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </form>
    </div>
  );
}
