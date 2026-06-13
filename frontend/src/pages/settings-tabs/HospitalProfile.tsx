import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  BadgeCheck, 
  Image as ImageIcon,
  Edit2,
  Save,
  X,
  Upload,
  Plus,
  Tag as TagIcon
} from 'lucide-react';
import { settingsApi } from '../../api/settings';

interface HospitalProfileData {
  id?: string;
  name: string;
  address: string;
  registrationNumber: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string;
  facilities: string[];
}

export default function HospitalProfile() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newFacility, setNewFacility] = useState('');
  
  const [formData, setFormData] = useState<HospitalProfileData>({
    name: '',
    address: '',
    registrationNumber: '',
    contactEmail: '',
    contactPhone: '',
    logoUrl: '',
    facilities: []
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hospitalProfile'],
    queryFn: async () => {
      const response = await settingsApi.getHospitalProfile();
      return {
        ...response.data,
        facilities: response.data?.facilities || []
      } as HospitalProfileData;
    }
  });

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name || '',
        address: data.address || '',
        registrationNumber: data.registrationNumber || '',
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        logoUrl: data.logoUrl || '',
        facilities: data.facilities || []
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (updatedData: HospitalProfileData) => {
      const response = await settingsApi.updateHospitalProfile(updatedData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitalProfile'] });
      setIsEditing(false);
    }
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, logoUrl: url }));
    }
  };

  const addFacility = () => {
    if (newFacility.trim() && !formData.facilities.includes(newFacility.trim())) {
      setFormData(prev => ({
        ...prev,
        facilities: [...prev.facilities, newFacility.trim()]
      }));
      setNewFacility('');
    }
  };

  const removeFacility = (facilityToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      facilities: prev.facilities.filter(f => f !== facilityToRemove)
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0A6253]/20 border-t-[#0A6253] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
        <p>Failed to load hospital profile. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Hospital Profile</h2>
          <p className="text-gray-500 text-sm mt-1">Manage your hospital's core identity and contact information.</p>
        </div>
        <div className="flex space-x-3">
          {isEditing ? (
            <>
              <button 
                onClick={() => {
                  setIsEditing(false);
                  if (data) {
                     setFormData({
                       name: data.name || '',
                       address: data.address || '',
                       registrationNumber: data.registrationNumber || '',
                       contactEmail: data.contactEmail || '',
                       contactPhone: data.contactPhone || '',
                       logoUrl: data.logoUrl || '',
                       facilities: data.facilities || []
                     });
                  }
                }}
                className="px-4 py-2 flex items-center text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button 
                onClick={() => mutation.mutate(formData)}
                disabled={mutation.isPending}
                className="px-4 py-2 flex items-center text-white bg-[#0A6253] rounded-xl hover:bg-[#084e42] transition-colors shadow-sm disabled:opacity-50 font-medium text-sm"
              >
                {mutation.isPending ? (
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 flex items-center text-white bg-[#0A6253] rounded-xl hover:bg-[#084e42] transition-colors shadow-sm font-medium text-sm"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start space-x-6">
            <div className="relative group shrink-0">
              <div className={`w-32 h-32 rounded-2xl border-2 border-dashed ${isEditing ? 'border-gray-300 group-hover:border-[#0A6253]' : 'border-transparent bg-gray-50'} flex flex-col items-center justify-center overflow-hidden transition-colors`}>
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Hospital Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-xs text-gray-500 font-medium">No logo</span>
                  </div>
                )}
                
                {isEditing && (
                  <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload className="w-6 h-6 text-white mb-1" />
                    <span className="text-xs text-white font-medium">Upload</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                  </label>
                )}
              </div>
            </div>
            
            <div className="flex-1 pt-2">
              <h3 className="text-lg font-medium text-gray-900 mb-1">Hospital Logo</h3>
              <p className="text-sm text-gray-500 max-w-md">
                This logo will be displayed on reports, invoices, and the patient portal. Recommended size is 256x256 pixels in PNG or SVG format.
              </p>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">General Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Hospital Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] focus:outline-none transition-all bg-gray-50/50 sm:text-sm ${!isEditing ? 'opacity-70 cursor-not-allowed bg-gray-100' : 'hover:bg-white'}`}
                  placeholder="e.g. City General Hospital"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Registration Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})}
                  className={`block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] focus:outline-none transition-all bg-gray-50/50 sm:text-sm ${!isEditing ? 'opacity-70 cursor-not-allowed bg-gray-100' : 'hover:bg-white'}`}
                  placeholder="e.g. REG-2023-XXXX"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Contact Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  disabled={!isEditing}
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                  className={`block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] focus:outline-none transition-all bg-gray-50/50 sm:text-sm ${!isEditing ? 'opacity-70 cursor-not-allowed bg-gray-100' : 'hover:bg-white'}`}
                  placeholder="contact@hospital.com"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Phone className="h-5 w-5" />
                </div>
                <input
                  type="tel"
                  disabled={!isEditing}
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                  className={`block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] focus:outline-none transition-all bg-gray-50/50 sm:text-sm ${!isEditing ? 'opacity-70 cursor-not-allowed bg-gray-100' : 'hover:bg-white'}`}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Physical Address</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none text-gray-400">
                <MapPin className="h-5 w-5" />
              </div>
              <textarea
                disabled={!isEditing}
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                rows={3}
                className={`block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] focus:outline-none transition-all bg-gray-50/50 sm:text-sm resize-none ${!isEditing ? 'opacity-70 cursor-not-allowed bg-gray-100' : 'hover:bg-white'}`}
                placeholder="Full street address, city, state, zip code"
              />
            </div>
          </div>
        </div>

        {/* Facilities Tags */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Hospital Facilities</h3>
            {isEditing && (
              <span className="text-xs text-gray-500">Press Enter to add</span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {formData.facilities.map((facility, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-[#0A6253]/10 text-[#0A6253] border border-[#0A6253]/20"
              >
                <TagIcon className="w-3.5 h-3.5 mr-1.5" />
                {facility}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => removeFacility(facility)}
                    className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-[#0A6253]/20 transition-colors focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
            {formData.facilities.length === 0 && !isEditing && (
              <p className="text-sm text-gray-500 italic">No facilities added yet.</p>
            )}
          </div>

          {isEditing && (
            <div className="flex items-center space-x-2">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  value={newFacility}
                  onChange={(e) => setNewFacility(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addFacility();
                    }
                  }}
                  placeholder="Add a facility (e.g. 24/7 Emergency)"
                  className="block w-full pl-3 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0A6253]/20 focus:border-[#0A6253] focus:outline-none transition-all bg-gray-50/50 sm:text-sm hover:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={addFacility}
                disabled={!newFacility.trim()}
                className="px-3 py-2 inline-flex items-center text-sm font-medium text-white bg-[#0A6253] rounded-xl hover:bg-[#084e42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
