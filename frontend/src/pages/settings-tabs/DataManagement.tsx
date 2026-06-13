import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { Database, Download, Save, ShieldAlert, Archive, FileText, HardDrive, Loader2, Check } from 'lucide-react';

interface DataPolicies {
  clinicalRecordsRetentionYears: number;
  financialRecordsRetentionYears: number;
  autoArchiveInactivePatients: boolean;
  anonymizeDataForResearch: boolean;
  enableDailySnapshots: boolean;
}

export default function DataManagement() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<DataPolicies>({
    clinicalRecordsRetentionYears: 10,
    financialRecordsRetentionYears: 7,
    autoArchiveInactivePatients: false,
    anonymizeDataForResearch: false,
    enableDailySnapshots: false,
  });
  const [isSaved, setIsSaved] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings', 'dataPolicies'],
    queryFn: async () => {
      const response = await settingsApi.getDataPolicies();
      return response.data;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData({
        clinicalRecordsRetentionYears: data.clinicalRecordsRetentionYears || 10,
        financialRecordsRetentionYears: data.financialRecordsRetentionYears || 7,
        autoArchiveInactivePatients: data.autoArchiveInactivePatients || false,
        anonymizeDataForResearch: data.anonymizeDataForResearch || false,
        enableDailySnapshots: data.enableDailySnapshots || false,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (updatedData: DataPolicies) => {
      const response = await settingsApi.updateDataPolicies(updatedData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'dataPolicies'] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
  };

  const handleToggle = (name: keyof DataPolicies) => {
    setFormData(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleExport = () => {
    alert('Exporting complete database (CSV/JSON)...');
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0A6253]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-red-500">
          <ShieldAlert className="mx-auto h-8 w-8 mb-2" />
          <p>Failed to load data management settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Data Management & Policies</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure data retention, archiving, and export rules for your facility.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Retention Period Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Database className="w-5 h-5 mr-2 text-[#0A6253]" />
              Data Retention Periods
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="clinicalRecordsRetentionYears" className="block text-sm font-medium text-gray-700 mb-1">
                  Clinical Records (Years)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="clinicalRecordsRetentionYears"
                    name="clinicalRecordsRetentionYears"
                    min="1"
                    max="100"
                    value={formData.clinicalRecordsRetentionYears}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0A6253] focus:border-[#0A6253] sm:text-sm transition-colors"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Duration to keep patient clinical records.</p>
              </div>

              <div>
                <label htmlFor="financialRecordsRetentionYears" className="block text-sm font-medium text-gray-700 mb-1">
                  Financial Records (Years)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    id="financialRecordsRetentionYears"
                    name="financialRecordsRetentionYears"
                    min="1"
                    max="100"
                    value={formData.financialRecordsRetentionYears}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0A6253] focus:border-[#0A6253] sm:text-sm transition-colors"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Duration to keep billing and financial records.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Policies Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <ShieldAlert className="w-5 h-5 mr-2 text-[#0A6253]" />
              Data Policies & Operations
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 flex items-center">
                  <Archive className="w-4 h-4 mr-2 text-gray-500" />
                  Auto-Archive Inactive Patients
                </span>
                <span className="text-sm text-gray-500">Automatically archive patients with no visits in 5 years.</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('autoArchiveInactivePatients')}
                className={`${
                  formData.autoArchiveInactivePatients ? 'bg-[#0A6253]' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2`}
              >
                <span className="sr-only">Toggle auto archive</span>
                <span
                  className={`${
                    formData.autoArchiveInactivePatients ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>

            <div className="h-px bg-gray-200 w-full" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 flex items-center">
                  <Database className="w-4 h-4 mr-2 text-gray-500" />
                  Anonymize Data for Research Export
                </span>
                <span className="text-sm text-gray-500">Strip PII (Personally Identifiable Information) on data exports.</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('anonymizeDataForResearch')}
                className={`${
                  formData.anonymizeDataForResearch ? 'bg-[#0A6253]' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2`}
              >
                <span className="sr-only">Toggle anonymize data</span>
                <span
                  className={`${
                    formData.anonymizeDataForResearch ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>

            <div className="h-px bg-gray-200 w-full" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 flex items-center">
                  <HardDrive className="w-4 h-4 mr-2 text-gray-500" />
                  Enable Daily Database Snapshots
                </span>
                <span className="text-sm text-gray-500">Take automated database backups every 24 hours.</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('enableDailySnapshots')}
                className={`${
                  formData.enableDailySnapshots ? 'bg-[#0A6253]' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2`}
              >
                <span className="sr-only">Toggle daily snapshots</span>
                <span
                  className={`${
                    formData.enableDailySnapshots ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Data Export Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Download className="w-5 h-5 mr-2 text-[#0A6253]" />
              Data Export
            </h3>
          </div>
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-gray-600 max-w-xl">
              Export the complete database to a CSV or JSON format for external analysis or backup purposes. Note that this process may take some time depending on the size of the database.
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A6253] whitespace-nowrap transition-colors"
            >
              <Download className="h-4 w-4 mr-2 text-gray-500" />
              Export Complete Database (CSV/JSON)
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#0A6253] hover:bg-[#084d41] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A6253] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : isSaved ? (
              <Check className="w-5 h-5 mr-2" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            {mutation.isPending ? 'Saving...' : isSaved ? 'Saved Successfully' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
