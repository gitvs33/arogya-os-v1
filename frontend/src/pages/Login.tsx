import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, Cloud, ShieldCheck, Fingerprint } from 'lucide-react';
// @ts-ignore - Supabase might not be fully configured yet
import { supabase, clearAuth } from '../api/client';

/* ────────────────────────────────────────────────
   Arogya OS — Login Page
   Pixel-accurate match to ui/login.png
   ──────────────────────────────────────────────── */

export default function Login() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof clearAuth === 'function') {
      clearAuth();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Send email + password to our backend — it handles Supabase internally
      console.log('Login attempt:', { email: employeeId });

      const response = await fetch('/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: employeeId, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('Login error:', response.status, data);
        setError(data.error || data.detail || 'Invalid Employee ID or password');
        setLoading(false);
        return;
      }

      const userData = await response.json();
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('medos_user', JSON.stringify(userData));
      navigate('/');
    } catch (err) {
      console.error('Login network error:', err);
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .login-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          background: linear-gradient(160deg, #e8f5f0 0%, #f8faf9 20%, #fffcf8 50%, #fef0e0 80%, #fde0c2 100%);
        }

        /* ── Mandala corner decorations ── */
        .mandala-tl,
        .mandala-bl,
        .mandala-br-warm {
          position: absolute;
          pointer-events: none;
          z-index: 0;
        }

        .mandala-tl {
          top: -80px;
          left: -80px;
          width: 460px;
          height: 460px;
          opacity: 0.35;
        }

        .mandala-bl {
          bottom: -100px;
          left: -60px;
          width: 400px;
          height: 400px;
          opacity: 0.25;
        }

        .mandala-br-warm {
          bottom: -40px;
          right: -60px;
          width: 380px;
          height: 380px;
          opacity: 0.22;
        }

        /* ── Orange warm glow top-right ── */
        .orange-glow {
          position: absolute;
          top: -100px;
          right: -100px;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(232,135,30,0.25) 0%, rgba(253,224,194,0.15) 40%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── Circuit pattern bottom-right ── */
        .circuit-pattern {
          position: absolute;
          bottom: 20px;
          right: 20px;
          width: 220px;
          height: 220px;
          pointer-events: none;
          z-index: 0;
          opacity: 0.18;
        }

        /* ── Content wrapper ── */
        .login-content {
          width: 100%;
          max-width: 460px;
          padding: 0 24px;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ── Logo ── */
        .login-logo {
          height: 240px;
          object-fit: contain;
          margin-bottom: 4px;
          filter: drop-shadow(0 2px 8px rgba(10,98,83,0.06));
        }

        /* ── Divider with dot ── */
        .ornament-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }
        .ornament-divider .line {
          width: 50px;
          height: 1.5px;
        }
        .ornament-divider .line-left {
          background: linear-gradient(to right, transparent, #0A6253);
        }
        .ornament-divider .line-right {
          background: linear-gradient(to left, transparent, #0A6253);
        }
        .ornament-divider .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #E8871E;
        }

        /* ── Module tags ── */
        .module-tags {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.85rem;
          color: #4B5563;
          margin-bottom: 6px;
          letter-spacing: 0.02em;
        }
        .module-tags .sep {
          color: #E8871E;
          font-size: 8px;
        }

        /* ── Tagline ── */
        .tagline {
          font-size: 0.9rem;
          font-style: italic;
          color: #0A6253;
          margin-bottom: 8px;
        }

        /* ── Lotus leaf ── */
        .lotus-leaf {
          width: 28px;
          height: 28px;
          margin-bottom: 20px;
          opacity: 0.4;
        }

        /* ── Form ── */
        .login-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .field-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: #1F2937;
          margin-bottom: 6px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: #9CA3AF;
          display: flex;
          align-items: center;
          pointer-events: none;
        }

        .login-input {
          width: 100%;
          padding: 14px 14px 14px 44px;
          background: #fff;
          border: 1.5px solid #D1D5DB;
          border-radius: 10px;
          font-size: 0.875rem;
          color: #1F2937;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-input::placeholder {
          color: #9CA3AF;
        }
        .login-input:focus {
          border-color: #0A6253;
          box-shadow: 0 0 0 3px rgba(10,98,83,0.08);
        }

        .login-input-password {
          padding-right: 44px;
        }

        .toggle-password {
          position: absolute;
          right: 14px;
          color: #9CA3AF;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
          transition: color 0.2s;
        }
        .toggle-password:hover {
          color: #6B7280;
        }

        /* ── Remember / Forgot row ── */
        .remember-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .remember-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.875rem;
          color: #4B5563;
        }
        .remember-label:hover {
          color: #1F2937;
        }
        .remember-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #0A6253;
          cursor: pointer;
          border-radius: 3px;
        }

        .forgot-link {
          font-size: 0.875rem;
          font-weight: 500;
          color: #E8871E;
          text-decoration: none;
          transition: color 0.2s;
        }
        .forgot-link:hover {
          color: #C67318;
        }

        /* ── Sign In button ── */
        .sign-in-btn {
          width: 100%;
          padding: 14px 0;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #0A6253 0%, #0D7A68 100%);
          color: #fff;
          font-size: 0.95rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(10,98,83,0.3);
          transition: all 0.2s;
          margin-top: 4px;
        }
        .sign-in-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #085544 0%, #0A6253 100%);
          box-shadow: 0 6px 22px rgba(10,98,83,0.4);
          transform: translateY(-1px);
        }
        .sign-in-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* ── OR divider ── */
        .or-divider {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          margin: 18px 0;
        }
        .or-divider::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, #D1D5DB, transparent);
        }
        .or-divider span {
          position: relative;
          padding: 0 16px;
          font-size: 0.75rem;
          color: #9CA3AF;
          letter-spacing: 0.05em;
          background: transparent;
        }

        /* ── SSO button ── */
        .sso-btn {
          width: 100%;
          padding: 13px 0;
          border: 1.5px solid #D1D5DB;
          border-radius: 10px;
          background: #fff;
          color: #374151;
          font-size: 0.875rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sso-btn:hover {
          border-color: #0A6253;
          background: #F0FDF9;
          box-shadow: 0 2px 10px rgba(10,98,83,0.08);
        }

        /* ── Footer ── */
        .login-footer {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding-bottom: 24px;
        }
        .footer-cloud {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #0A6253;
        }
        .footer-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: #6B7280;
        }
        .footer-badges .badge-sep {
          color: #D1D5DB;
        }

        /* ── Error alert ── */
        .error-alert {
          padding: 12px 16px;
          border-radius: 10px;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          font-size: 0.875rem;
          text-align: center;
          font-weight: 500;
        }

        /* ── Spinner ── */
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          width: 20px;
          height: 20px;
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div className="login-page">
        {/* ── Background elements ── */}

        {/* Mandala top-left */}
        <svg className="mandala-tl" viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="190" stroke="#0A6253" strokeWidth="0.6" />
          <circle cx="200" cy="200" r="160" stroke="#0A6253" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="130" stroke="#0A6253" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="100" stroke="#0A6253" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="70" stroke="#0A6253" strokeWidth="0.4" />
          {[...Array(16)].map((_, i) => (
            <g key={i} transform={`rotate(${i * 22.5} 200 200)`}>
              <ellipse cx="200" cy="110" rx="14" ry="40" stroke="#0A6253" strokeWidth="0.5" fill="none" />
              <ellipse cx="200" cy="130" rx="7" ry="22" stroke="#0A6253" strokeWidth="0.4" fill="none" />
              <line x1="200" y1="10" x2="200" y2="50" stroke="#0A6253" strokeWidth="0.3" />
            </g>
          ))}
          {[...Array(32)].map((_, i) => {
            const a = (i * 11.25 * Math.PI) / 180;
            return <circle key={i} cx={200 + 185 * Math.cos(a)} cy={200 + 185 * Math.sin(a)} r="2.5" fill="#0A6253" opacity="0.3" />;
          })}
        </svg>

        {/* Mandala bottom-left */}
        <svg className="mandala-bl" viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="180" stroke="#0A6253" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="150" stroke="#0A6253" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="120" stroke="#0A6253" strokeWidth="0.4" />
          {[...Array(12)].map((_, i) => (
            <g key={i} transform={`rotate(${i * 30} 200 200)`}>
              <ellipse cx="200" cy="115" rx="12" ry="36" stroke="#0A6253" strokeWidth="0.4" fill="none" />
            </g>
          ))}
          {[...Array(24)].map((_, i) => {
            const a = (i * 15 * Math.PI) / 180;
            return <circle key={i} cx={200 + 175 * Math.cos(a)} cy={200 + 175 * Math.sin(a)} r="2" fill="#0A6253" opacity="0.25" />;
          })}
        </svg>

        {/* Orange glow top-right */}
        <div className="orange-glow" />

        {/* Mandala bottom-right (warm) */}
        <svg className="mandala-br-warm" viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="180" stroke="#C8956C" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="150" stroke="#C8956C" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="120" stroke="#C8956C" strokeWidth="0.4" />
          {[...Array(12)].map((_, i) => (
            <g key={i} transform={`rotate(${i * 30} 200 200)`}>
              <ellipse cx="200" cy="120" rx="10" ry="32" stroke="#C8956C" strokeWidth="0.4" fill="none" />
            </g>
          ))}
        </svg>

        {/* Circuit pattern */}
        <svg className="circuit-pattern" viewBox="0 0 200 200" fill="none">
          {[...Array(6)].map((_, row) =>
            [...Array(6)].map((_, col) => (
              <g key={`${row}-${col}`}>
                <rect x={col * 32 + 4} y={row * 32 + 4} width="10" height="10" rx="2" stroke="#0A6253" strokeWidth="0.6" />
                {col < 5 && <line x1={col * 32 + 14} y1={row * 32 + 9} x2={(col + 1) * 32 + 4} y2={row * 32 + 9} stroke="#0A6253" strokeWidth="0.4" />}
                {row < 5 && <line x1={col * 32 + 9} y1={row * 32 + 14} x2={col * 32 + 9} y2={(row + 1) * 32 + 4} stroke="#0A6253" strokeWidth="0.4" />}
              </g>
            ))
          )}
          {[1, 3, 5].map(row =>
            [1, 3, 5].map(col => (
              <circle key={`n-${row}-${col}`} cx={col * 32 + 9} cy={row * 32 + 9} r="5" stroke="#0A6253" strokeWidth="0.5" fill="none" />
            ))
          )}
        </svg>

        {/* ── Main content ── */}
        <div className="login-content">

          {/* Logo — already contains the full Arogya OS branding */}
          <img
            src="/logo.png"
            alt="Arogya OS — Healthcare Operating System"
            className="login-logo"
          />

          {/* Ornament divider */}
          <div className="ornament-divider">
            <div className="line line-left" />
            <div className="dot" />
            <div className="line line-right" />
          </div>

          {/* Module tags */}
          <div className="module-tags">
            <span>EMR</span>
            <span className="sep">•</span>
            <span>TeleICU</span>
            <span className="sep">•</span>
            <span>Billing</span>
            <span className="sep">•</span>
            <span>Pharmacy</span>
            <span className="sep">•</span>
            <span>AI Insights</span>
          </div>

          {/* Tagline */}
          <p className="tagline">One Platform. Every Care. Better Health for India.</p>

          {/* Lotus leaf */}
          <svg className="lotus-leaf" viewBox="0 0 32 32" fill="none">
            <path d="M16 8c-3 2-5 5-6 8 2 0 4-1 6-3 2 2 4 3 6 3-1-3-3-6-6-8z" fill="#0A6253" opacity="0.35" />
            <path d="M16 13c-2 2-3 4-3 6 1 0 2-1 3-2 1 1 2 2 3 2 0-2-1-4-3-6z" fill="#0A6253" opacity="0.25" />
          </svg>

          {/* ── Login Form ── */}
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="error-alert">{error}</div>}

            {/* Employee ID */}
            <div>
              <label htmlFor="employee-id" className="field-label">Employee ID</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <User size={18} strokeWidth={1.8} />
                </div>
                <input
                  id="employee-id"
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="login-input"
                  placeholder="Enter your Employee ID"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="field-label">Password</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <Lock size={18} strokeWidth={1.8} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input login-input-password"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                </button>
              </div>
            </div>

            {/* Remember me + Forgot Password */}
            <div className="remember-row">
              <label className="remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <a href="#" className="forgot-link">Forgot Password?</a>
            </div>

            {/* Sign In */}
            <button
              id="sign-in-button"
              type="submit"
              disabled={loading}
              className="sign-in-btn"
            >
              {loading ? (
                <>
                  <svg className="spinner" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Signing In...
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="or-divider">
            <span>or</span>
          </div>

          {/* Hospital SSO */}
          <button id="sso-button" type="button" className="sso-btn">
            <Fingerprint size={20} color="#E8871E" />
            Sign in with Hospital SSO
          </button>

          {/* Footer */}
          <div className="login-footer">
            <div className="footer-cloud">
              <Cloud size={16} />
              Connected to Arogya Cloud
            </div>
            <div className="footer-badges">
              <ShieldCheck size={14} color="#9CA3AF" />
              Secure
              <span className="badge-sep">•</span>
              Compliant
              <span className="badge-sep">•</span>
              Made in India
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
