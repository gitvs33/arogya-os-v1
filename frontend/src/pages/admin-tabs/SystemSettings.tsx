import React, { useState } from 'react';
import { Save, Building, Image as ImageIcon, Mail, Bell, Check } from 'lucide-react';

const SystemSettings = () => {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 bg-[#F8F9FA] min-h-screen font-sans text-gray-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-500 mt-1">Configure your hospital management system preferences</p>
          </div>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-[#0A6253] hover:bg-[#084d41] text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            {saved ? <Check size={18} /> : <Save size={18} />}
            {saved ? 'Saved Successfully' : 'Save Changes'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Building size={20} className="text-[#0A6253]"/> Hospital Profile</h3>
            <p className="text-sm text-gray-500">Update your institution's core details and contact information.</p>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Hospital Name</label>
                <input type="text" defaultValue="Medos General Hospital" className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Registration Number</label>
                <input type="text" defaultValue="REG-99281-2026" className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none transition-all" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Primary Address</label>
              <textarea defaultValue="124 Health Ave, Medical District, NY 10001" rows={2} className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none transition-all"></textarea>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2"><ImageIcon size={20} className="text-[#0A6253]"/> Branding & Logo</h3>
            <p className="text-sm text-gray-500">Customize the look and feel of the patient portal and internal tools.</p>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex gap-6 items-center">
            <div className="h-24 w-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
               <ImageIcon size={32} className="text-gray-400" />
            </div>
            <div className="space-y-2">
              <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Upload New Logo</button>
              <p className="text-xs text-gray-500">Recommended size: 512x512px. Max 2MB.</p>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Mail size={20} className="text-[#0A6253]"/> SMTP Configuration</h3>
            <p className="text-sm text-gray-500">Set up email servers for automated notifications and password resets.</p>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">SMTP Server</label>
                <input type="text" defaultValue="smtp.medos-health.org" className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Port</label>
                <input type="text" defaultValue="587" className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Username</label>
                <input type="text" defaultValue="admin@medos-health.org" className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <input type="password" defaultValue="********" className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none transition-all" />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Bell size={20} className="text-[#0A6253]"/> Notification Preferences</h3>
            <p className="text-sm text-gray-500">Manage system-wide alerts and communication channels.</p>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <div>
                <p className="font-medium text-gray-800">Email Alerts</p>
                <p className="text-sm text-gray-500">Receive daily summaries and critical alerts via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6253]"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <div>
                <p className="font-medium text-gray-800">SMS Notifications</p>
                <p className="text-sm text-gray-500">Urgent alerts for system downtime or security breaches</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6253]"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
