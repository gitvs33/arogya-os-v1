import React from 'react';
import { Shield, Key, Clock, Plus, Trash2 } from 'lucide-react';

const SecurityAccess = () => {
  const whitelist = [
    { id: 1, ip: '192.168.1.100', desc: 'Main Office - Reception', added: '2026-05-10' },
    { id: 2, ip: '10.0.0.5', desc: 'IT Dept VPN', added: '2026-05-15' },
    { id: 3, ip: '172.16.254.1', desc: 'Admin Remote Access', added: '2026-06-01' },
  ];

  return (
    <div className="p-6 bg-[#F8F9FA] min-h-screen font-sans text-gray-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Security & Access</h1>
          <p className="text-gray-500 mt-1">Manage authentication policies and network restrictions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-3"><Shield size={20} className="text-[#0A6253]"/> Access Policies</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Enforce Two-Factor Authentication (2FA)</p>
                <p className="text-sm text-gray-500">Require all staff to use 2FA for login</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6253]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Strict Password Policy</p>
                <p className="text-sm text-gray-500">Min 12 chars, symbols, numbers, upper/lowercase</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6253]"></div>
              </label>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
               <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Clock size={16}/> Global Session Timeout (Minutes)</label>
                  <input type="number" defaultValue="30" className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none transition-all" />
                  <p className="text-xs text-gray-500">Auto-logout users after period of inactivity</p>
                </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Key size={20} className="text-[#0A6253]"/> IP Whitelist</h3>
              <button className="text-sm text-[#0A6253] hover:text-[#084d41] font-medium flex items-center gap-1"><Plus size={16}/> Add IP</button>
            </div>
            
            <p className="text-sm text-gray-500">Only these IP addresses can access the admin dashboard.</p>

            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {whitelist.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.ip}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.desc}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-red-500 hover:text-red-700 transition-colors"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityAccess;
