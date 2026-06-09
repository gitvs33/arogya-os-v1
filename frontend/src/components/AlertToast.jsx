import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SEVERITY_CONFIG = {
  CRITICAL: {
    icon: '🔴',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    dot: 'bg-red-500',
  },
  WARNING: {
    icon: '🟡',
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
    dot: 'bg-yellow-500',
  },
  INFO: {
    icon: '🔵',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
  },
};

/**
 * An alert toast that slides in from the top-right.
 *
 * Props:
 *   alert    – object { id, severity, alert_type, patient_name, message }
 *   onDismiss – callback when toast is dismissed or auto-closes
 */
export default function AlertToast({ alert, onDismiss }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const config = SEVERITY_CONFIG[alert?.severity] || SEVERITY_CONFIG.INFO;

  // Slide in, then auto-dismiss after 5 s
  useEffect(() => {
    if (!alert) return;

    // Small delay so the DOM can mount before animating
    const showTimer = setTimeout(() => setVisible(true), 50);

    const dismissTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => {
        setVisible(false);
        setLeaving(false);
        onDismiss?.();
      }, 300); // slide-out duration
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [alert, onDismiss]);

  const handleClick = () => {
    navigate('/alerts');
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      setLeaving(false);
      onDismiss?.();
    }, 300);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      setLeaving(false);
      onDismiss?.();
    }, 300);
  };

  if (!visible && !leaving) return null;

  return (
    <div
      onClick={handleClick}
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full cursor-pointer
        transition-all duration-300 ease-in-out
        ${leaving ? 'translate-x-full opacity-0' : visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div
        className={`${config.bg} border ${config.text} rounded-lg shadow-lg p-4 flex items-start gap-3`}
      >
        {/* Severity dot + icon */}
        <div className="flex-shrink-0 mt-0.5">
          <span className="text-lg">{config.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {alert?.severity || 'INFO'}
            </span>
            <span className="text-xs opacity-60">
              {alert?.alert_type?.replace(/_/g, ' ') || 'Alert'}
            </span>
          </div>
          {alert?.patient_name && (
            <p className="text-sm font-medium truncate">{alert.patient_name}</p>
          )}
          <p className="text-sm opacity-90 line-clamp-2">{alert?.message}</p>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
