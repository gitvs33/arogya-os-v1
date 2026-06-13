import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { Save, Bell, Mail, MessageSquare, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface NotificationsData {
  smsGatewayApiKey: string;
  emailSmtpServer: string;
  emailSmtpPort: string;
  emailUsername: string;
  emailPassword: string;
  sendSmsOnAppointmentBooking: boolean;
  sendEmailOnDischarge: boolean;
  sendSmsForCriticalLabResults: boolean;
  sendEmailForDailyReports: boolean;
}

export default function NotificationsSettings() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notificationsSettings'],
    queryFn: async () => {
      const res = await settingsApi.getNotifications();
      return res.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (newData: NotificationsData) => {
      const res = await settingsApi.updateNotifications(newData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsSettings'] });
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  });

  const [formData, setFormData] = useState<NotificationsData>({
    smsGatewayApiKey: '',
    emailSmtpServer: '',
    emailSmtpPort: '',
    emailUsername: '',
    emailPassword: '',
    sendSmsOnAppointmentBooking: false,
    sendEmailOnDischarge: false,
    sendSmsForCriticalLabResults: false,
    sendEmailForDailyReports: false,
  });

  useEffect(() => {
    if (data) {
      setFormData((prev) => ({ ...prev, ...data }));
    }
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleToggle = (name: keyof NotificationsData) => {
    setFormData((prev) => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-[#0A6253]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-5 h-5" />
        <p>Error loading settings: {(error as Error).message}</p>
      </div>
    );
  }

  const Toggle = ({ enabled, onChange, label, description }: { enabled: boolean, onChange: () => void, label: string, description: string }) => (
    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 ${
          enabled ? 'bg-[#0A6253]' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#0A6253]" />
            Notifications
          </h2>
          <p className="text-gray-500 mt-1">Configure gateways and event triggers for automated messages.</p>
        </div>
        {successMsg && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg font-medium transition-opacity">
            <CheckCircle2 className="w-5 h-5" />
            {successMsg}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Gateways Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-500" />
              Gateways
            </h3>
            <p className="text-sm text-gray-500 mt-1">Setup external services used to deliver notifications.</p>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMS Gateway API Key
              </label>
              <input
                type="text"
                name="smsGatewayApiKey"
                value={formData.smsGatewayApiKey}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:border-transparent transition-all"
                placeholder="Enter your SMS gateway API key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email SMTP Server
              </label>
              <input
                type="text"
                name="emailSmtpServer"
                value={formData.emailSmtpServer}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:border-transparent transition-all"
                placeholder="smtp.example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email SMTP Port
              </label>
              <input
                type="number"
                name="emailSmtpPort"
                value={formData.emailSmtpPort}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:border-transparent transition-all"
                placeholder="587"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Username
              </label>
              <input
                type="text"
                name="emailUsername"
                value={formData.emailUsername}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:border-transparent transition-all"
                placeholder="alerts@hospital.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Password
              </label>
              <input
                type="password"
                name="emailPassword"
                value={formData.emailPassword}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
        </section>

        {/* Event Triggers Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gray-500" />
              Event Triggers
            </h3>
            <p className="text-sm text-gray-500 mt-1">Select which events trigger automated communications.</p>
          </div>
          
          <div className="p-6 space-y-4">
            <Toggle
              label="Send SMS on Appointment Booking"
              description="Patients receive an SMS confirmation when an appointment is scheduled."
              enabled={formData.sendSmsOnAppointmentBooking}
              onChange={() => handleToggle('sendSmsOnAppointmentBooking')}
            />
            <Toggle
              label="Send Email on Discharge"
              description="Automatically email discharge summary and instructions to patients."
              enabled={formData.sendEmailOnDischarge}
              onChange={() => handleToggle('sendEmailOnDischarge')}
            />
            <Toggle
              label="Send SMS for Critical Lab Results"
              description="Notify doctors immediately via SMS if lab results fall in critical ranges."
              enabled={formData.sendSmsForCriticalLabResults}
              onChange={() => handleToggle('sendSmsForCriticalLabResults')}
            />
            <Toggle
              label="Send Email for Daily Reports"
              description="Send automated daily hospital performance reports to administration."
              enabled={formData.sendEmailForDailyReports}
              onChange={() => handleToggle('sendEmailForDailyReports')}
            />
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#0A6253] text-white font-medium rounded-xl hover:bg-[#084e42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A6253] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {mutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
