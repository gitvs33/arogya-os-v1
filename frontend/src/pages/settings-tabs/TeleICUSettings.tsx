import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { Activity, Video, Bell, Save, AlertCircle, RefreshCw, Loader2, Check } from 'lucide-react';

interface TeleICUSettingsData {
  autoRecordVideoConsults: boolean;
  enableContinuousBedsideMonitoringSync: boolean;
  alertEscalationToOnCallDoctor: boolean;
  defaultVitalsRefreshRate: number;
  highHeartRateAlertThreshold: number;
  lowSpO2AlertThreshold: number;
  defaultCameraQuality: '720p' | '1080p' | '4K';
}

export default function TeleICUSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<TeleICUSettingsData | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['teleICUSettings'],
    queryFn: async () => {
      const response = await settingsApi.getTeleICUSettings();
      return response.data as TeleICUSettingsData;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData(data);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (newData: TeleICUSettingsData) => settingsApi.updateTeleICUSettings(newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teleICUSettings'] });
    },
  });

  const handleSave = () => {
    if (formData) {
      mutation.mutate(formData);
    }
  };

  const handleToggle = (field: keyof TeleICUSettingsData) => {
    if (formData) {
      setFormData({ ...formData, [field]: !formData[field as keyof TeleICUSettingsData] });
    }
  };

  const handleNumberChange = (field: keyof TeleICUSettingsData, value: string) => {
    if (formData) {
      setFormData({ ...formData, [field]: parseInt(value) || 0 });
    }
  };

  const handleSelectChange = (field: keyof TeleICUSettingsData, value: string) => {
    if (formData) {
      setFormData({ ...formData, [field]: value });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#0A6253] animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load TeleICU settings</h3>
        <p className="text-gray-500 mb-6">There was an error communicating with the server.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (!formData) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">TeleICU Settings</h2>
          <p className="text-gray-500 mt-1">Manage remote monitoring, alerts, and consult configurations.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="flex items-center px-4 py-2 bg-[#0A6253] hover:bg-[#084f43] text-white rounded-lg font-medium transition-colors disabled:opacity-70 cursor-pointer"
        >
          {mutation.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {mutation.isSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center">
          <Check className="w-5 h-5 mr-3 text-green-500" />
          Settings saved successfully.
        </div>
      )}

      {mutation.isError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center">
          <AlertCircle className="w-5 h-5 mr-3 text-red-500" />
          Failed to save settings: {(mutation.error as Error).message}
        </div>
      )}

      <div className="space-y-8">
        {/* Video & Sync Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center space-x-3">
            <div className="bg-[#0A6253]/10 p-2 rounded-lg text-[#0A6253]">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Video & Synchronization</h3>
          </div>
          <div className="p-6 space-y-6">
            <ToggleRow
              label="Auto-Record Video Consults"
              description="Automatically start recording when joining a teleconsultation session."
              checked={formData.autoRecordVideoConsults}
              onChange={() => handleToggle('autoRecordVideoConsults')}
            />
            <ToggleRow
              label="Enable Continuous Bedside Monitoring Sync"
              description="Stream patient vitals continuously from connected bedside monitors."
              checked={formData.enableContinuousBedsideMonitoringSync}
              onChange={() => handleToggle('enableContinuousBedsideMonitoringSync')}
            />
            
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Camera Quality
              </label>
              <select
                value={formData.defaultCameraQuality}
                onChange={(e) => handleSelectChange('defaultCameraQuality', e.target.value)}
                className="w-full md:w-1/2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all outline-none text-gray-900"
              >
                <option value="720p">720p (Standard HD)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="4K">4K (Ultra HD)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Vitals & Thresholds Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center space-x-3">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Vitals & Alert Thresholds</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Vitals Refresh Rate (seconds)
              </label>
              <input
                type="number"
                value={formData.defaultVitalsRefreshRate}
                onChange={(e) => handleNumberChange('defaultVitalsRefreshRate', e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all outline-none"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                High Heart Rate Alert Threshold (bpm)
              </label>
              <input
                type="number"
                value={formData.highHeartRateAlertThreshold}
                onChange={(e) => handleNumberChange('highHeartRateAlertThreshold', e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all outline-none"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Low SpO2 Alert Threshold (%)
              </label>
              <input
                type="number"
                value={formData.lowSpO2AlertThreshold}
                onChange={(e) => handleNumberChange('lowSpO2AlertThreshold', e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all outline-none"
                min="0"
                max="100"
              />
            </div>
          </div>
        </section>

        {/* Escalation Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center space-x-3">
            <div className="bg-red-50 p-2 rounded-lg text-red-600">
              <Bell className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Alert Escalation</h3>
          </div>
          <div className="p-6">
            <ToggleRow
              label="Alert Escalation to On-Call Doctor"
              description="Automatically page or notify the on-call physician when critical thresholds are crossed and not acknowledged within 5 minutes."
              checked={formData.alertEscalationToOnCallDoctor}
              onChange={() => handleToggle('alertEscalationToOnCallDoctor')}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="pr-8">
        <h4 className="text-base font-medium text-gray-900">{label}</h4>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-transparent ${
          checked ? 'bg-[#0A6253]' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
