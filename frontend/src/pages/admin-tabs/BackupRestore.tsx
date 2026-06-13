import React from 'react';
import { Database, HardDrive, RotateCcw, Download, Calendar as CalendarIcon, Clock } from 'lucide-react';

const BackupRestore = () => {
  const backups: any[] = [];

  return (
    <div className="p-6 bg-[#F8F9FA] min-h-screen font-sans text-gray-800">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Database className="text-[#0A6253]" size={32}/> Backup & Restore</h1>
          <p className="text-gray-500 mt-1">Manage system backups, schedule automated snapshots, and monitor storage</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><HardDrive size={20} className="text-[#0A6253]"/> Storage Usage</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-bold text-gray-900">0.0 <span className="text-lg text-gray-500 font-normal">GB</span></span>
                  <span className="text-sm font-medium text-gray-500">of 100 GB</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-[#0A6253] h-3 rounded-full" style={{ width: '0%' }}></div>
                </div>
                <p className="text-xs text-gray-500 flex justify-between">
                  <span>Databases: 0 GB</span>
                  <span>Files/Media: 0 GB</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><CalendarIcon size={20} className="text-[#0A6253]"/> Schedule Backup</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Frequency</label>
                  <select className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none bg-white">
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Time <span className="text-xs text-gray-400">(24hr)</span></label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="time" defaultValue="02:00" className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0A6253] focus:border-transparent outline-none" />
                  </div>
                </div>
                <button className="w-full bg-[#0A6253] hover:bg-[#084d41] text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm mt-2">
                  Update Schedule
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2"><RotateCcw size={20} className="text-[#0A6253]"/> Available Restore Points</h3>
              <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Create Manual Backup
              </button>
            </div>
            
            <div className="overflow-x-auto flex-1 border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{backup.date}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${backup.type === 'Automated' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {backup.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{backup.size}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-3">
                          <button className="text-gray-500 hover:text-[#0A6253] transition-colors tooltip" title="Download Backup">
                            <Download size={18} />
                          </button>
                          <button className="text-gray-500 hover:text-red-600 transition-colors tooltip" title="Restore Point">
                            <RotateCcw size={18} />
                          </button>
                        </div>
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

export default BackupRestore;
