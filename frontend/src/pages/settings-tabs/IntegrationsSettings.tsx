import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { 
  Activity, 
  Database, 
  HeartPulse, 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  X,
  Settings,
  Plug
} from 'lucide-react';

interface IntegrationConfig {
  connected: boolean;
  clientId: string;
  clientSecret: string;
}

interface IntegrationsData {
  pacs: IntegrationConfig;
  lis: IntegrationConfig;
  ndhm: IntegrationConfig;
  tpa: IntegrationConfig;
  payment: IntegrationConfig;
  [key: string]: IntegrationConfig;
}

const defaultIntegrations: IntegrationsData = {
  pacs: { connected: false, clientId: '', clientSecret: '' },
  lis: { connected: false, clientId: '', clientSecret: '' },
  ndhm: { connected: false, clientId: '', clientSecret: '' },
  tpa: { connected: false, clientId: '', clientSecret: '' },
  payment: { connected: false, clientId: '', clientSecret: '' },
};

const integrationsConfig = [
  {
    id: 'pacs',
    title: 'PACS (Picture Archiving)',
    description: 'Integrate with external Picture Archiving and Communication Systems.',
    icon: Database,
  },
  {
    id: 'lis',
    title: 'External LIS',
    description: 'Connect with external Laboratory Information Systems for seamless data exchange.',
    icon: Activity,
  },
  {
    id: 'ndhm',
    title: 'National Health Registry',
    description: 'ABDM/NDHM integration for patient health record synchronization.',
    icon: HeartPulse,
  },
  {
    id: 'tpa',
    title: 'Insurance TPA Portals',
    description: 'Direct integration with Third Party Administrators for insurance claims.',
    icon: ShieldCheck,
  },
  {
    id: 'payment',
    title: 'Payment Gateways',
    description: 'Stripe, Razorpay or other payment processors for online transactions.',
    icon: CreditCard,
  },
];

export default function IntegrationsSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIntegration, setActiveIntegration] = useState<string | null>(null);
  
  // For the modal inputs
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: async () => {
      const response = await settingsApi.getIntegrations();
      return { ...defaultIntegrations, ...response.data } as IntegrationsData;
    },
  });

  const mutation = useMutation({
    mutationFn: async (newData: IntegrationsData) => {
      const response = await settingsApi.updateIntegrations(newData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
    },
  });

  const handleConfigureClick = (id: string) => {
    setActiveIntegration(id);
    if (data) {
      setClientId(data[id]?.clientId || '');
      setClientSecret(data[id]?.clientSecret || '');
    } else {
      setClientId('');
      setClientSecret('');
    }
    setModalOpen(true);
  };

  const handleSaveModal = () => {
    if (!activeIntegration || !data) return;
    
    const updatedIntegration = {
      ...data[activeIntegration],
      clientId,
      clientSecret,
      connected: true, // Assuming saving config connects it
    };

    const newData = {
      ...data,
      [activeIntegration]: updatedIntegration,
    };

    mutation.mutate(newData);
    setModalOpen(false);
  };

  const handleDisconnect = (id: string) => {
    if (!data) return;
    const newData = {
      ...data,
      [id]: { ...data[id], connected: false },
    };
    mutation.mutate(newData);
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
      <div className="flex h-64 items-center justify-center text-red-500">
        Failed to load integrations. Please try again.
      </div>
    );
  }

  const integrations = data || defaultIntegrations;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Third-Party Integrations</h2>
          <p className="mt-1 text-sm text-gray-500">Manage connections to external services and APIs.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {integrationsConfig.map((config) => {
          const Icon = config.icon;
          const status = integrations[config.id];
          const isConnected = status?.connected;

          return (
            <div 
              key={config.id} 
              className="flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="p-6 flex-grow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <Icon className="h-6 w-6 text-[#0A6253]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{config.title}</h3>
                      <div className="mt-1 flex items-center space-x-2">
                        {isConnected ? (
                          <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Connected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Disconnected</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  {config.description}
                </p>
              </div>
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-end space-x-3">
                {isConnected && (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(config.id)}
                    disabled={mutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleConfigureClick(config.id)}
                  disabled={mutation.isPending}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${
                    isConnected
                      ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-[#0A6253]'
                      : 'text-white bg-[#0A6253] hover:bg-[#084f43] focus:ring-[#0A6253]'
                  }`}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Configure {integrationsConfig.find(c => c.id === activeIntegration)?.title}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0A6253] focus:outline-none focus:ring-1 focus:ring-[#0A6253] transition-colors"
                  placeholder="Enter client ID"
                />
              </div>
              
              <div>
                <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <input
                  type="password"
                  id="clientSecret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0A6253] focus:outline-none focus:ring-1 focus:ring-[#0A6253] transition-colors"
                  placeholder="Enter client secret"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-1 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={mutation.isPending}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#0A6253] border border-transparent rounded-xl hover:bg-[#084f43] focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending && activeIntegration ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4 mr-2" />
                )}
                Connect & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
