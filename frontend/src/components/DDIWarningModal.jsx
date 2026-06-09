export default function DDIWarningModal({ interactions, drugName, onProceed, onCancel, isPending }) {
  if (!interactions || interactions.length === 0) return null;

  const severityConfig = {
    contraindicated: { bg: 'bg-red-100', text: 'text-red-700', badge: 'bg-red-600', label: 'Contraindicated', icon: '🚫' },
    major: { bg: 'bg-orange-100', text: 'text-orange-700', badge: 'bg-orange-500', label: 'Major', icon: '⚠️' },
    moderate: { bg: 'bg-yellow-100', text: 'text-yellow-700', badge: 'bg-yellow-500', label: 'Moderate', icon: '⚡' },
    minor: { bg: 'bg-blue-100', text: 'text-blue-700', badge: 'bg-blue-500', label: 'Minor', icon: 'ℹ️' },
  };

  // Sort by severity severity ordinal
  const severityOrder = ['contraindicated', 'major', 'moderate', 'minor'];
  const sorted = [...interactions].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-lg shrink-0">
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Drug Interaction Detected</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {drugName ? (
                <>
                  Adding <span className="font-medium text-gray-700">{drugName}</span> may interact with existing medications
                </>
              ) : (
                'Potential interactions found between medications'
              )}
            </p>
          </div>
        </div>

        {/* Interactions list */}
        <div className="px-6 py-4 overflow-y-auto space-y-3">
          {sorted.map((interaction, idx) => {
            const config = severityConfig[interaction.severity] || severityConfig.moderate;
            return (
              <div key={idx} className={`rounded-lg border p-4 ${config.bg} border-transparent`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {interaction.drug_a} ↔ {interaction.drug_b}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${config.badge}`}>
                        {config.label}
                      </span>
                    </div>
                    {interaction.effect && (
                      <p className="text-sm font-medium text-gray-700 mt-1">{interaction.effect}</p>
                    )}
                    {interaction.recommendation && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        <span className="font-medium">Recommendation:</span> {interaction.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {sorted.length === 1 ? (
            <p className="text-sm text-gray-500 text-center pt-1">{sorted.length} interaction found</p>
          ) : (
            <p className="text-sm text-gray-500 text-center pt-1">{sorted.length} interactions found</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onProceed}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Adding...
              </>
            ) : (
              'Proceed Anyway'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
