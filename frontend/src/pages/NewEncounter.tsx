// @ts-nocheck
import { useNavigate } from 'react-router-dom';

export default function NewEncounter() {
  const navigate = useNavigate();
  return (
    <div className="p-12 text-center text-gray-500">
      <h2 className="text-xl font-bold mb-4">Module Disabled</h2>
      <p className="mb-4">This module has been disabled per system configuration.</p>
      <button onClick={() => navigate(-1)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Go Back</button>
    </div>
  );
}
