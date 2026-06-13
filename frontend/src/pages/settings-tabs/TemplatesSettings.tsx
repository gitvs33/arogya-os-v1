import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { FileText, Edit2, Trash2, Plus, X, Loader2, Save } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
}

const CATEGORIES = [
  { id: 'invoices', label: 'Invoices' },
  { id: 'prescriptions', label: 'Prescriptions' },
  { id: 'discharge_summaries', label: 'Discharge Summaries' },
  { id: 'lab_reports', label: 'Lab Reports' },
];

export default function TemplatesSettings() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['templates'],
    queryFn: () => settingsApi.getTemplates(),
  });

  const templatesData = response?.data;
  const templates: Template[] = Array.isArray(templatesData) ? templatesData : (templatesData?.results || []);
  const activeTemplates = templates.filter((t) => t.category === activeCategory);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newTemplate: Partial<Template>) => settingsApi.createTemplate(newTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Template> }) => settingsApi.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      category: activeCategory,
      content: '',
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    if (editingTemplate.id) {
      updateMutation.mutate({
        id: editingTemplate.id,
        data: {
          name: editingTemplate.name,
          category: editingTemplate.category,
          content: editingTemplate.content,
        },
      });
    } else {
      createMutation.mutate({
        name: editingTemplate.name,
        category: editingTemplate.category,
        content: editingTemplate.content,
      });
    }
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
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
        Failed to load templates. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Print & Email Templates</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage the content and layout of various generated documents and emails.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Categories Sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? 'bg-[#0A6253]/10 text-[#0A6253]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <FileText className={`mr-2 h-4 w-4 ${activeCategory === category.id ? 'text-[#0A6253]' : 'text-gray-400'}`} />
                {category.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Templates List */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              {CATEGORIES.find((c) => c.id === activeCategory)?.label}
            </h3>
            <button
              onClick={handleCreate}
              className="inline-flex items-center rounded-xl bg-[#0A6253] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0A6253]/90 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </button>
          </div>

          {activeTemplates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No templates found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new template for this category.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-200">
                {activeTemplates.map((template) => (
                  <li key={template.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#0A6253]/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-[#0A6253]" />
                        </div>
                        <div className="ml-4 truncate">
                          <p className="text-sm font-medium text-gray-900 truncate">{template.name}</p>
                          <p className="text-sm text-gray-500 truncate">HTML/Text Document</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-xl hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(template.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-xl hover:bg-red-50"
                          title="Delete"
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending && template.id === deleteMutation.variables ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTemplate.id ? 'Edit Template' : 'New Template'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-4 space-y-4 overflow-y-auto">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Template Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#0A6253] focus:ring-[#0A6253] sm:text-sm shadow-sm"
                    required
                  />
                </div>
                <div className="flex-1 flex flex-col min-h-[300px]">
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                    HTML/Text Content
                  </label>
                  <textarea
                    id="content"
                    value={editingTemplate.content}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                    className="flex-1 block w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#0A6253] focus:ring-[#0A6253] sm:text-sm font-mono shadow-sm min-h-[200px]"
                    required
                    placeholder="Enter HTML or text here..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="inline-flex items-center rounded-xl bg-[#0A6253] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0A6253]/90 focus:outline-none focus:ring-2 focus:ring-[#0A6253] focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Save className="mr-2 h-4 w-4" />
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
