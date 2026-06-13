import React from 'react';
import { 
  Monitor, 
  Activity, 
  Fingerprint, 
  Wifi, 
  WifiOff, 
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  Server
} from 'lucide-react';

const DEVICES: any[] = [];

const STATS = [
  { label: 'Total Devices', value: '0', color: 'text-gray-900' },
  { label: 'Online', value: '0', color: 'text-emerald-600' },
  { label: 'Offline', value: '0', color: 'text-gray-500' },
  { label: 'Error State', value: '0', color: 'text-red-600' },
];

export default function DeviceIntegration() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Online':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Wifi className="w-3.5 h-3.5" />
            Online
          </span>
        );
      case 'Offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            <WifiOff className="w-3.5 h-3.5" />
            Offline
          </span>
        );
      case 'Error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-[#F8F9FA] flex flex-col">
      {/* Header & Stats */}
      <div className="bg-white px-8 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Server className="w-6 h-6 text-[#0A6253]" />
              Hardware Integration
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Monitor and manage connected hospital devices in real-time</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw className="w-4 h-4" />
              Sync All
            </button>
            <button className="bg-[#0A6253] hover:bg-[#084f43] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-[#0A6253]/20">
              Add Device
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {STATS.map((stat, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search devices by name, IP, or ID..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] shadow-sm transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
              <Filter className="w-4 h-4 text-gray-400" />
              Filter
            </button>
          </div>
        </div>

        {/* Device Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEVICES.map((device) => {
            const Icon = device.icon;
            return (
              <div key={device.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
                <div className="p-5 border-b border-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${
                      device.status === 'Online' ? 'bg-[#0A6253]/10 text-[#0A6253]' :
                      device.status === 'Error' ? 'bg-red-50 text-red-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <button className="text-gray-400 hover:text-gray-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate" title={device.name}>
                    {device.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 font-medium">{device.type}</p>
                    {getStatusBadge(device.status)}
                  </div>
                </div>
                
                <div className="bg-gray-50/50 p-5 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">ID / Network</span>
                    <div className="text-right">
                      <span className="block font-medium text-gray-900">{device.id}</span>
                      <span className="block text-gray-500 font-mono text-xs">{device.ipAddress}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Location</span>
                    <span className="font-medium text-gray-900">{device.department}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <RefreshCw className={`w-3.5 h-3.5 ${device.status === 'Online' ? 'animate-spin-slow text-[#0A6253]' : ''}`} />
                      Last Sync
                    </span>
                    <span className="font-medium text-gray-900">{device.lastSync}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
