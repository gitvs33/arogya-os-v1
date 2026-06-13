import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { 
  Save, 
  Pill, 
  AlertTriangle, 
  ClipboardList, 
  Settings2,
  Clock,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface PharmacySettingsData {
  autoReorderAlerts: boolean;
  strictExpiryEnforcement: boolean;
  requirePrescriptionForAll: boolean;
  defaultExpiryWarningDays: number;
  minStockThresholdPercent: number;
}

export default function PharmacySettings() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState('');
  
  // Local state to manage form changes
  const [formData, setFormData] = useState<PharmacySettingsData>({
    autoReorderAlerts: true,
    strictExpiryEnforcement: true,
    requirePrescriptionForAll: false,
    defaultExpiryWarningDays: 60,
    minStockThresholdPercent: 20,
  });

  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: ['pharmacySettings'],
    queryFn: settingsApi.getPharmacySettings,
  });

  // Sync state when data is loaded
  useEffect(() => {
    if (response?.data) {
      setFormData({
        autoReorderAlerts: response.data.autoReorderAlerts ?? true,
        strictExpiryEnforcement: response.data.strictExpiryEnforcement ?? true,
        requirePrescriptionForAll: response.data.requirePrescriptionForAll ?? false,
        defaultExpiryWarningDays: response.data.defaultExpiryWarningDays ?? 60,
        minStockThresholdPercent: response.data.minStockThresholdPercent ?? 20,
      });
    }
  }, [response]);

  const mutation = useMutation({
    mutationFn: (data: PharmacySettingsData) => settingsApi.updatePharmacySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacySettings'] });
      setSuccessMessage('Pharmacy settings updated successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
  });

  const handleToggle = (field: keyof PharmacySettingsData) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] as boolean }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value ? Number(value) : 0,
    }));
  };

  const handleSave = () => {
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#0A6253]">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading pharmacy settings...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center border border-red-100">
          <AlertTriangle className="w-5 h-5 mr-3" />
          <p>Error loading settings: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl p-6 mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Pill className="w-6 h-6 text-[#0A6253]" />
            Pharmacy Settings
          </h1>
          <p className="text-gray-500 mt-1">Configure inventory management, alerts, and dispensing rules.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="flex items-center px-4 py-2 bg-[#0A6253] hover:bg-[#084b40] text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </button>
      </div>

      {successMessage && (
        <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-xl flex items-center border border-green-100 shadow-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 mr-3" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Toggles Section */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-orange-500" />
            General Rules
          </h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Auto-Reorder Alerts</label>
                <p className="text-xs text-gray-500 mt-1">Notify staff when stock falls below threshold.</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('autoReorderAlerts')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 ${
                  formData.autoReorderAlerts ? 'bg-[#0A6253]' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={formData.autoReorderAlerts}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.autoReorderAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Strict Expiry Enforcement</label>
                <p className="text-xs text-gray-500 mt-1">Prevent dispensing of expired medications.</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('strictExpiryEnforcement')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 ${
                  formData.strictExpiryEnforcement ? 'bg-[#0A6253]' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={formData.strictExpiryEnforcement}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.strictExpiryEnforcement ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Require Prescription</label>
                <p className="text-xs text-gray-500 mt-1">Mandate a valid prescription for all dispenses.</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('requirePrescriptionForAll')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 ${
                  formData.requirePrescriptionForAll ? 'bg-[#0A6253]' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={formData.requirePrescriptionForAll}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.requirePrescriptionForAll ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Inputs Section */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#0A6253]" />
            Thresholds & Warnings
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Expiry Warning (Days)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  name="defaultExpiryWarningDays"
                  min="0"
                  value={formData.defaultExpiryWarningDays}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-[#0A6253] focus:border-[#0A6253] sm:text-sm shadow-sm"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Number of days before expiry to trigger a warning.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Stock Threshold (%)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AlertTriangle className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  name="minStockThresholdPercent"
                  min="0"
                  max="100"
                  value={formData.minStockThresholdPercent}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-[#0A6253] focus:border-[#0A6253] sm:text-sm shadow-sm"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Percentage of capacity at which to alert low stock.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
