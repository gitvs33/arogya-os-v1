import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { Globe, Clock, Banknote, Calendar, CheckCircle2, AlertCircle, Loader2, Save, ChevronDown } from 'lucide-react';

interface LocalizationData {
  defaultLanguage: string;
  timezone: string;
  defaultCurrency: string;
  dateFormat: string;
  timeFormat: string;
  enableMultiCurrency: boolean;
}

const LocalizationSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<LocalizationData>({
    defaultLanguage: 'English',
    timezone: 'Asia/Kolkata',
    defaultCurrency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12-hour',
    enableMultiCurrency: false,
  });
  
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['settings', 'localization'],
    queryFn: async () => {
      const response = await settingsApi.getLocalization();
      return response.data;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData({
        defaultLanguage: data.default_language ?? data.defaultLanguage ?? 'English',
        timezone: data.timezone ?? 'Asia/Kolkata',
        defaultCurrency: data.default_currency ?? data.defaultCurrency ?? 'INR',
        dateFormat: data.date_format ?? data.dateFormat ?? 'DD/MM/YYYY',
        timeFormat: data.time_format ?? data.timeFormat ?? '12-hour',
        enableMultiCurrency: data.enable_multi_currency ?? data.enableMultiCurrency ?? false,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (updatedData: LocalizationData) => {
      const payload = {
        default_language: updatedData.defaultLanguage,
        timezone: updatedData.timezone,
        default_currency: updatedData.defaultCurrency,
        date_format: updatedData.dateFormat,
        time_format: updatedData.timeFormat,
        enable_multi_currency: updatedData.enableMultiCurrency,
      };
      const response = await settingsApi.updateLocalization(payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'localization'] });
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleToggle = () => {
    setFormData(prev => ({ ...prev, enableMultiCurrency: !prev.enableMultiCurrency }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#0A6253] animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center p-4 text-red-800 bg-red-50 rounded-xl">
        <AlertCircle className="w-5 h-5 mr-3" />
        <p>Error loading localization settings: {(error as Error).message}</p>
      </div>
    );
  }

  // Define options based on instructions
  const languageOptions = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Chinese'];
  const timezoneOptions = ['Asia/Kolkata', 'UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];
  const currencyOptions = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];
  const dateFormatOptions = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
  const timeFormatOptions = ['12-hour', '24-hour'];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Localization Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure your region, language, and display formats</p>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="flex items-center gap-2 bg-[#0A6253] hover:bg-[#084F43] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-70"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="p-6">
        {showSuccessMessage && (
          <div className="mb-6 flex items-center p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
            <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-600" />
            <p className="font-medium">Localization settings updated successfully!</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Regional Settings */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0A6253]" />
              Regional Details
            </h3>
            
            {/* Language Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Language</label>
              <div className="relative">
                <select
                  name="defaultLanguage"
                  value={formData.defaultLanguage}
                  onChange={handleChange}
                  className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-[#0A6253] focus:border-[#0A6253] block p-3 pr-10 shadow-sm transition-colors"
                >
                  {languageOptions.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Timezone Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <div className="relative">
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-[#0A6253] focus:border-[#0A6253] block p-3 pr-10 shadow-sm transition-colors"
                >
                  {timezoneOptions.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Formatting & Currency */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0A6253]" />
              Formatting & Currency
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Date Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                <div className="relative">
                  <select
                    name="dateFormat"
                    value={formData.dateFormat}
                    onChange={handleChange}
                    className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-[#0A6253] focus:border-[#0A6253] block p-3 pr-10 shadow-sm transition-colors"
                  >
                    {dateFormatOptions.map(fmt => (
                      <option key={fmt} value={fmt}>{fmt}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Time Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Format</label>
                <div className="relative">
                  <select
                    name="timeFormat"
                    value={formData.timeFormat}
                    onChange={handleChange}
                    className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-[#0A6253] focus:border-[#0A6253] block p-3 pr-10 shadow-sm transition-colors"
                  >
                    {timeFormatOptions.map(fmt => (
                      <option key={fmt} value={fmt}>{fmt}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Currency Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
              <div className="relative">
                <select
                  name="defaultCurrency"
                  value={formData.defaultCurrency}
                  onChange={handleChange}
                  className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-[#0A6253] focus:border-[#0A6253] block p-3 pr-10 shadow-sm transition-colors"
                >
                  {currencyOptions.map(currency => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Multi-Currency Toggle */}
            <div className="pt-2">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 text-[#0A6253]">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Multi-Currency Support</p>
                    <p className="text-xs text-gray-500">Allow transactions in multiple currencies</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleToggle}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 ${
                    formData.enableMultiCurrency ? 'bg-[#0A6253]' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={formData.enableMultiCurrency}
                >
                  <span className="sr-only">Enable Multi-Currency Support</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData.enableMultiCurrency ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalizationSettings;
