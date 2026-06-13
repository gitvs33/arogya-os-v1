import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { Key, Link as LinkIcon, Plus, Trash2, Loader2, X, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'failing';
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsed: string | null;
}

const AVAILABLE_EVENTS = [
  { id: 'patient.created', label: 'Patient Created' },
  { id: 'patient.updated', label: 'Patient Updated' },
  { id: 'appointment.scheduled', label: 'Appointment Scheduled' },
  { id: 'appointment.cancelled', label: 'Appointment Cancelled' },
  { id: 'invoice.created', label: 'Invoice Created' },
  { id: 'invoice.paid', label: 'Invoice Paid' },
];

const MOCK_API_KEYS: ApiKey[] = [];

export default function APIWebhooksSettings() {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'webhooks'>('api-keys');
  const queryClient = useQueryClient();

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(MOCK_API_KEYS);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Webhooks State
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookForm, setWebhookForm] = useState({
    url: '',
    secret: '',
    events: [] as string[],
  });

  const { data: webhooks, isLoading: isLoadingWebhooks, isError: isErrorWebhooks } = useQuery<Webhook[]>({
    queryKey: ['webhooks'],
    queryFn: () => settingsApi.getWebhooks().then((res) => res.data),
  });

  const createWebhookMutation = useMutation({
    mutationFn: (newWebhook: any) => settingsApi.createWebhook(newWebhook),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsWebhookModalOpen(false);
      setWebhookForm({ url: '', secret: '', events: [] });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setConfirmDialog(p => ({ ...p, isOpen: false }));
    },
  });

  const handleGenerateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const newKeyVal = `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const newKey: ApiKey = {
      id: `key_${Date.now()}`,
      name: newApiKeyName,
      keyPrefix: newKeyVal.substring(0, 12) + '...',
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };
    setApiKeys([newKey, ...apiKeys]);
    setGeneratedKey(newKeyVal);
  };

  const handleRevokeApiKey = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Revoke API Key',
      message: 'Are you sure you want to revoke this API key? This action cannot be undone.',
      onConfirm: () => {
        setApiKeys(apiKeys.filter(k => k.id !== id));
        setConfirmDialog(p => ({ ...p, isOpen: false }));
      }
    });
  };

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    createWebhookMutation.mutate({
      url: webhookForm.url,
      secret: webhookForm.secret,
      events: webhookForm.events,
      status: 'active',
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">API &amp; Webhooks</h1>
        <p className="mt-1 text-sm text-gray-500">Manage API keys and webhook endpoints for integrations.</p>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
        <div className="border-b border-gray-200 px-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('api-keys')}
              className={`${
                activeTab === 'api-keys'
                  ? 'border-[#0A6253] text-[#0A6253]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Key className="mr-2 h-4 w-4" />
              API Keys
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`${
                activeTab === 'webhooks'
                  ? 'border-[#0A6253] text-[#0A6253]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Webhooks
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'api-keys' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Active API Keys</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Use these keys to authenticate API requests from your application.
                  </p>
                </div>
                <button
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-[#0A6253] hover:bg-[#084e42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A6253] transition-colors"
                >
                  <Plus className="-ml-1 mr-2 h-4 w-4" />
                  Generate New API Key
                </button>
              </div>

              {apiKeys.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                  <Key className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No API keys</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating a new API key.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Key Prefix
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Used
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {apiKeys.map((key) => (
                        <tr key={key.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {key.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded border border-gray-200">
                              {key.keyPrefix}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(key.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleRevokeApiKey(key.id)}
                              className="text-red-600 hover:text-red-900 flex items-center justify-end w-full"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Registered Webhooks</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Webhooks allow you to receive real-time HTTP notifications for events.
                  </p>
                </div>
                <button
                  onClick={() => setIsWebhookModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-[#0A6253] hover:bg-[#084e42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A6253] transition-colors"
                >
                  <Plus className="-ml-1 mr-2 h-4 w-4" />
                  Add Webhook
                </button>
              </div>

              {isLoadingWebhooks ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#0A6253]" />
                </div>
              ) : isErrorWebhooks ? (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">Error loading webhooks. Please try again.</p>
                    </div>
                  </div>
                </div>
              ) : !webhooks || webhooks.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                  <LinkIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No webhooks</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating a new webhook.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          URL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Events
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {webhooks.map((webhook) => (
                        <tr key={webhook.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {webhook.url}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {webhook.events.map((ev, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {ev}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                              webhook.status === 'active' ? 'bg-green-100 text-green-800' :
                              webhook.status === 'failing' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {webhook.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Delete Webhook',
                                  message: 'Are you sure you want to delete this webhook?',
                                  onConfirm: () => deleteWebhookMutation.mutate(webhook.id)
                                });
                              }}
                              disabled={deleteWebhookMutation.isPending}
                              className="text-red-600 hover:text-red-900 flex items-center justify-end w-full disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generate API Key Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => {
                if (!generatedKey) setIsApiKeyModalOpen(false);
              }}
            />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 border border-gray-200">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none"
                  onClick={() => {
                    setIsApiKeyModalOpen(false);
                    setGeneratedKey(null);
                    setNewApiKeyName('');
                  }}
                >
                  <span className="sr-only">Close</span>
                  <X className="w-6 h-6" />
                </button>
              </div>

              {!generatedKey ? (
                <div className="sm:flex sm:items-start">
                  <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-green-50 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                    <Key className="w-6 h-6 text-[#0A6253]" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Generate New API Key</h3>
                    <div className="mt-4">
                      <form onSubmit={handleGenerateApiKey} className="space-y-4">
                        <div>
                          <label htmlFor="keyName" className="block text-sm font-medium text-gray-700">
                            Key Name
                          </label>
                          <input
                            type="text"
                            id="keyName"
                            required
                            value={newApiKeyName}
                            onChange={(e) => setNewApiKeyName(e.target.value)}
                            placeholder="e.g. Production App"
                            className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-[#0A6253] focus:border-[#0A6253] sm:text-sm"
                          />
                        </div>
                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                          <button
                            type="submit"
                            className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-[#0A6253] text-base font-medium text-white hover:bg-[#084e42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A6253] sm:ml-3 sm:w-auto sm:text-sm"
                          >
                            Generate Key
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsApiKeyModalOpen(false)}
                            className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">API Key Generated</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 mb-4">
                        Please copy this API key and save it somewhere safe. For security reasons, <strong>we cannot show it to you again</strong>.
                      </p>
                      <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                        <code className="text-sm text-gray-800 break-all text-left">{generatedKey}</code>
                        <button
                          onClick={copyToClipboard}
                          className="ml-3 flex-shrink-0 text-[#0A6253] hover:text-[#084e42] p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copied ? <CheckCircle2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6">
                    <button
                      type="button"
                      className="inline-flex justify-center w-full rounded-xl border border-transparent shadow-sm px-4 py-2 bg-[#0A6253] text-base font-medium text-white hover:bg-[#084e42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A6253] sm:text-sm"
                      onClick={() => {
                        setIsApiKeyModalOpen(false);
                        setGeneratedKey(null);
                        setNewApiKeyName('');
                      }}
                    >
                      I have saved my key
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Webhook Modal */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setIsWebhookModalOpen(false)}
            />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 border border-gray-200">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none"
                  onClick={() => setIsWebhookModalOpen(false)}
                >
                  <span className="sr-only">Close</span>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-green-50 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                  <LinkIcon className="w-6 h-6 text-[#0A6253]" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Add Webhook</h3>
                  <div className="mt-4 w-full">
                    <form onSubmit={handleCreateWebhook} className="space-y-4">
                      <div>
                        <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                          Payload URL
                        </label>
                        <div className="mt-1">
                          <input
                            type="url"
                            name="url"
                            id="url"
                            required
                            value={webhookForm.url}
                            onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:ring-[#0A6253] focus:border-[#0A6253] sm:text-sm"
                            placeholder="https://example.com/webhook"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="secret" className="block text-sm font-medium text-gray-700">
                          Secret (Optional)
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="secret"
                            id="secret"
                            value={webhookForm.secret}
                            onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                            className="block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:ring-[#0A6253] focus:border-[#0A6253] sm:text-sm"
                            placeholder="Used to sign webhook payloads"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Events to send</label>
                        <div className="space-y-2 border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto bg-gray-50">
                          {AVAILABLE_EVENTS.map((event) => (
                            <div key={event.id} className="flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  id={`event-${event.id}`}
                                  name={`event-${event.id}`}
                                  type="checkbox"
                                  checked={webhookForm.events.includes(event.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setWebhookForm({
                                        ...webhookForm,
                                        events: [...webhookForm.events, event.id],
                                      });
                                    } else {
                                      setWebhookForm({
                                        ...webhookForm,
                                        events: webhookForm.events.filter((id) => id !== event.id),
                                      });
                                    }
                                  }}
                                  className="focus:ring-[#0A6253] h-4 w-4 text-[#0A6253] border-gray-300 rounded"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor={`event-${event.id}`} className="font-medium text-gray-700">
                                  {event.label}
                                </label>
                                <p className="text-gray-500 text-xs">{event.id}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={createWebhookMutation.isPending || webhookForm.events.length === 0}
                          className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-[#0A6253] border border-transparent rounded-xl shadow-sm hover:bg-[#084e42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A6253] sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {createWebhookMutation.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            'Add Webhook'
                          )}
                        </button>
                        <button
                          type="button"
                          className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                          onClick={() => setIsWebhookModalOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        {...confirmDialog} 
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} 
      />
    </div>
  );
}
