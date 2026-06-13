import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { settingsApi } from '../../api/settings';

interface BillingSettingsData {
  taxInclusion: boolean;
  automaticInvoiceGeneration: boolean;
  allowPartialPayments: boolean;
  requireApprovalForDiscounts: boolean;
  defaultPaymentTerms: number;
  defaultTaxRate: number;
  acceptablePaymentMethods: string[];
}

const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'UPI',
  'Insurance',
  'Bank Transfer'
];

export default function BillingSettings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BillingSettingsData>({
    taxInclusion: false,
    automaticInvoiceGeneration: false,
    allowPartialPayments: false,
    requireApprovalForDiscounts: true,
    defaultPaymentTerms: 30,
    defaultTaxRate: 0,
    acceptablePaymentMethods: ['Cash', 'Credit Card'],
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['billingSettings'],
    queryFn: async () => {
      const response = await settingsApi.getBillingSettings();
      return response.data as BillingSettingsData;
    },
  });

  useEffect(() => {
    if (data) {
      setFormData({
        taxInclusion: data.taxInclusion ?? false,
        automaticInvoiceGeneration: data.automaticInvoiceGeneration ?? false,
        allowPartialPayments: data.allowPartialPayments ?? false,
        requireApprovalForDiscounts: data.requireApprovalForDiscounts ?? true,
        defaultPaymentTerms: data.defaultPaymentTerms ?? 30,
        defaultTaxRate: data.defaultTaxRate ?? 0,
        acceptablePaymentMethods: data.acceptablePaymentMethods ?? ['Cash', 'Credit Card'],
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (updatedData: BillingSettingsData) => {
      const response = await settingsApi.updateBillingSettings(updatedData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billingSettings'] });
    },
  });

  const handleToggle = (field: keyof BillingSettingsData) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleNumberChange = (field: keyof BillingSettingsData, value: string) => {
    // Allows decimal if Default Tax Rate, otherwise parseInt
    const parsed = field === 'defaultTaxRate' ? parseFloat(value) : parseInt(value, 10);
    setFormData((prev) => ({
      ...prev,
      [field]: isNaN(parsed) ? 0 : parsed,
    }));
  };

  const handlePaymentMethodToggle = (method: string) => {
    setFormData((prev) => {
      const currentMethods = prev.acceptablePaymentMethods;
      if (currentMethods.includes(method)) {
        return {
          ...prev,
          acceptablePaymentMethods: currentMethods.filter((m) => m !== method),
        };
      } else {
        return {
          ...prev,
          acceptablePaymentMethods: [...currentMethods, method],
        };
      }
    });
  };

  const handleSave = () => {
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
      <div className="flex flex-col items-center justify-center h-64 text-red-600 space-y-4">
        <AlertCircle className="w-12 h-12" />
        <p>Error loading billing settings: {(error as Error).message}</p>
        <button
          onClick={() => refetch()}
          className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing Settings</h2>
          <p className="text-gray-500 mt-1">Manage invoicing, taxes, and payment preferences.</p>
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
        {/* Toggle Switches Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">General Policies</h3>
          </div>
          <div className="p-6 space-y-6">
            <ToggleRow
              label="Tax Inclusion"
              description="Prices displayed and entered include applicable taxes by default."
              checked={formData.taxInclusion}
              onChange={() => handleToggle('taxInclusion')}
            />
            <ToggleRow
              label="Automatic Invoice Generation"
              description="Automatically generate an invoice when an encounter or lab order is completed."
              checked={formData.automaticInvoiceGeneration}
              onChange={() => handleToggle('automaticInvoiceGeneration')}
            />
            <ToggleRow
              label="Allow Partial Payments"
              description="Permit patients to pay invoices in multiple partial installments."
              checked={formData.allowPartialPayments}
              onChange={() => handleToggle('allowPartialPayments')}
            />
            <ToggleRow
              label="Require Approval for Discounts"
              description="Discounts above standard limits must be approved by an administrator."
              checked={formData.requireApprovalForDiscounts}
              onChange={() => handleToggle('requireApprovalForDiscounts')}
            />
          </div>
        </section>

        {/* Input Fields Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Defaults & Rates</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Payment Terms (Days)
              </label>
              <input
                type="number"
                value={formData.defaultPaymentTerms}
                onChange={(e) => handleNumberChange('defaultPaymentTerms', e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all outline-none"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                value={formData.defaultTaxRate}
                onChange={(e) => handleNumberChange('defaultTaxRate', e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] transition-all outline-none"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </section>

        {/* Payment Methods Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Acceptable Payment Methods</h3>
            <p className="text-sm text-gray-500 mt-1">Select the payment methods supported by your facility.</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method}
                  className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                    formData.acceptablePaymentMethods.includes(method)
                      ? 'border-[#0A6253] bg-[#0A6253]/5'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formData.acceptablePaymentMethods.includes(method)}
                    onChange={() => handlePaymentMethodToggle(method)}
                  />
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 border transition-colors ${
                    formData.acceptablePaymentMethods.includes(method)
                      ? 'bg-[#0A6253] border-[#0A6253]'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {formData.acceptablePaymentMethods.includes(method) && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <span className={`font-medium ${
                    formData.acceptablePaymentMethods.includes(method) ? 'text-[#0A6253]' : 'text-gray-700'
                  }`}>
                    {method}
                  </span>
                </label>
              ))}
            </div>
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
