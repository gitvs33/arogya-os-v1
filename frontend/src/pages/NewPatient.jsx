import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { patientsApi } from '../api/patients';

const INITIAL_STATE = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  abha_id: '',
};

function FormField({ label, name, type = 'text', required, value, onChange, error, children }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children || (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
            error
              ? 'border-red-400 focus:ring-2 focus:ring-red-200 focus:border-red-400'
              : 'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500'
          }`}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function NewPatient() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_STATE);
  const [errors, setErrors] = useState({});

  const mutation = useMutation({
    mutationFn: (data) => patientsApi.create(data).then((res) => res.data),
    onSuccess: (data) => {
      navigate(`/patients/${data.id}`);
    },
    onError: (err) => {
      if (err.response?.data) {
        const serverErrors = {};
        for (const [field, msgs] of Object.entries(err.response.data)) {
          serverErrors[field] = Array.isArray(msgs) ? msgs[0] : msgs;
        }
        setErrors(serverErrors);
      } else {
        setErrors({ _general: err.message || 'Failed to save patient.' });
      }
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    // Convert empty strings to null for optional fields
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') {
        delete payload[key];
      }
    }
    // Ensure first_name stays for validation
    if (!payload.first_name && form.first_name === '') {
      payload.first_name = '';
    }
    setErrors({});
    mutation.mutate(payload);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/patients"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Patient</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        {errors._general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {errors._general}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            name="first_name"
            required
            value={form.first_name}
            onChange={handleChange}
            error={errors.first_name}
          />
          <FormField
            label="Last Name"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            error={errors.last_name}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Date of Birth"
            name="date_of_birth"
            type="date"
            value={form.date_of_birth}
            onChange={handleChange}
            error={errors.date_of_birth}
          />
          <div>
            <FormField
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              error={errors.gender}
            >
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
                  errors.gender
                    ? 'border-red-400 focus:ring-2 focus:ring-red-200 focus:border-red-400'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500'
                }`}
              >
                <option value="">Select gender</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
          />
        </div>

        <FormField
          label="Address"
          name="address"
          value={form.address}
          onChange={handleChange}
          error={errors.address}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            label="City"
            name="city"
            value={form.city}
            onChange={handleChange}
            error={errors.city}
          />
          <FormField
            label="State"
            name="state"
            value={form.state}
            onChange={handleChange}
            error={errors.state}
          />
          <FormField
            label="Pincode"
            name="pincode"
            value={form.pincode}
            onChange={handleChange}
            error={errors.pincode}
          />
        </div>

        <FormField
          label="ABHA ID"
          name="abha_id"
          value={form.abha_id}
          onChange={handleChange}
          error={errors.abha_id}
        />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Saving...' : 'Save Patient'}
          </button>
          <Link
            to="/patients"
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
