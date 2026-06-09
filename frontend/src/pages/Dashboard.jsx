import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard';

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      <span className="ml-3 text-gray-500">Loading dashboard...</span>
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {message || 'Something went wrong. Please try again.'}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.stats().then((res) => res.data),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error.message} />;
  if (!data) return null;

  const stats = [
    {
      title: 'Total Patients',
      value: data.total_patients?.toLocaleString() || 0,
      icon: '👥',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: "Today's Encounters",
      value: data.today_encounters || 0,
      icon: '📋',
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Active Alerts',
      value: data.active_alerts || 0,
      icon: '🔔',
      color: 'bg-yellow-50 text-yellow-600',
    },
    {
      title: 'Pending Invoices',
      value: data.pending_invoices || 0,
      icon: '💰',
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Recent Encounters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Encounters</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
                <th className="text-left px-6 py-3">Patient</th>
                <th className="text-left px-6 py-3">Doctor</th>
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.recent_encounters?.map((encounter) => (
                <tr key={encounter.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/patients/${encounter.patient_id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {encounter.patient_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{encounter.doctor}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-blue-50 text-blue-700">
                      {encounter.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(encounter.time).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!data.recent_encounters || data.recent_encounters.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                    No recent encounters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/patients/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            New Patient
          </Link>
          <Link
            to="/encounters/new"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            New Encounter
          </Link>
          <Link
            to="/billing"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            View Billing
          </Link>
        </div>
      </div>
    </div>
  );
}
