import React, { useState } from 'react';
import { 
  Zap, 
  Activity, 
  ShoppingCart, 
  Users, 
  AlertCircle,
  Mail,
  Smartphone,
  CheckCircle2,
  Plus,
  Settings2,
  ArrowRight
} from 'lucide-react';

const WORKFLOWS: any[] = [];

export default function WorkflowSetup() {
  const [workflows, setWorkflows] = useState(WORKFLOWS);

  const toggleWorkflow = (id: number) => {
    setWorkflows(workflows.map(wf => 
      wf.id === id ? { ...wf, enabled: !wf.enabled } : wf
    ));
  };

  return (
    <div className="h-full bg-[#F8F9FA] p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Zap className="w-6 h-6 text-[#0A6253]" />
              Workflow Automation
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Configure event-driven rules and automated actions</p>
          </div>
          <button className="flex items-center gap-2 bg-[#0A6253] hover:bg-[#084f43] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-[#0A6253]/20">
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        </div>

        {/* Workflow List */}
        <div className="space-y-4">
          {workflows.map((wf) => {
            const TriggerIcon = wf.triggerIcon;
            const ActionIcon = wf.actionIcon;

            return (
              <div 
                key={wf.id} 
                className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${
                  wf.enabled 
                    ? 'border-[#0A6253]/20 shadow-md shadow-[#0A6253]/5' 
                    : 'border-gray-200 opacity-75 grayscale-[0.2]'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-6">
                    {/* Left: Info & Flow */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{wf.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{wf.description}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {wf.lastRun}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {wf.successRate} success
                          </span>
                        </div>
                      </div>

                      <div className="flex items-stretch gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        {/* Trigger */}
                        <div className="flex-1 flex flex-col">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">When this happens</span>
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-lg ${wf.triggerBg} ${wf.triggerColor}`}>
                              <TriggerIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{wf.condition}</p>
                            </div>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center justify-center px-4">
                          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex-1 flex flex-col">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Do this</span>
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-gray-100 text-gray-600">
                              <ActionIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{wf.action}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex flex-col items-end gap-4 border-l border-gray-100 pl-6 min-w-[120px]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={wf.enabled}
                          onChange={() => toggleWorkflow(wf.id)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#0A6253]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A6253]"></div>
                        <span className="ml-3 text-sm font-medium text-gray-700">{wf.enabled ? 'On' : 'Off'}</span>
                      </label>

                      <button className="text-gray-400 hover:text-[#0A6253] flex items-center gap-1.5 text-sm font-medium transition-colors mt-auto">
                        <Settings2 className="w-4 h-4" />
                        Configure
                      </button>
                    </div>
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

function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
