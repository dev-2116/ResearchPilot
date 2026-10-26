import React, { useState } from 'react';
import { Eye, EyeOff, FlaskConical, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

const ROLES = [
  { value: 'researcher', label: 'Researcher' },
  { value: 'professor', label: 'Professor / Faculty' },
  { value: 'student', label: 'PhD / Graduate Student' },
  { value: 'engineer', label: 'Research Engineer' },
];

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'researcher',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim()) { setError('Please enter your full name.'); return; }
    if (!form.email) { setError('Please enter your email address.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-bg-overlay" />

      <div className="auth-card auth-card-wide">
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <FlaskConical size={28} color="#131007" />
          </div>
          <div>
            <div className="auth-brand-name">ResearchPilot</div>
            <div className="auth-brand-tagline">Evidence-Verified AI Research</div>
          </div>
        </div>

        <h1 className="auth-heading">Create your account</h1>
        <p className="auth-subheading">Join the ResearchPilot research platform</p>

        {error && (
          <div className="auth-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-name">Full name</label>
            <input
              id="reg-name"
              type="text"
              className="auth-input"
              placeholder="Dr. Jane Smith"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              autoComplete="name"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-email">Institutional email</label>
            <input
              id="reg-email"
              type="email"
              className="auth-input"
              placeholder="researcher@university.edu"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-role">Role</label>
            <select
              id="reg-role"
              className="auth-input auth-select"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="auth-row">
            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label" htmlFor="reg-password">Password</label>
              <div className="auth-input-wrapper">
                <input
                  id="reg-password"
                  type={showPass ? 'text' : 'password'}
                  className="auth-input auth-input-with-icon"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="auth-field" style={{ flex: 1 }}>
              <label className="auth-label" htmlFor="reg-confirm">Confirm password</label>
              <div className="auth-input-wrapper">
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className={`auth-input auth-input-with-icon ${
                    form.confirm_password && form.password !== form.confirm_password ? 'auth-input-error' : ''
                  }`}
                  placeholder="Repeat password"
                  value={form.confirm_password}
                  onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          </div>

          {/* Password strength indicator */}
          {form.password && (
            <div className="auth-strength-row">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="auth-strength-bar"
                  style={{
                    background: form.password.length >= (i + 1) * 3
                      ? i < 2 ? '#f59e0b' : '#10b981'
                      : 'var(--border-medium)'
                  }}
                />
              ))}
              <span className="auth-strength-label">
                {form.password.length < 6 ? 'Too short' : form.password.length < 10 ? 'Moderate' : 'Strong'}
              </span>
            </div>
          )}

          <button
            id="register-submit-btn"
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="auth-spinner" />
            ) : (
              <>
                <UserPlus size={17} />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-divider"><span>Already have an account?</span></div>

        <button
          id="switch-to-login-btn"
          className="auth-switch-btn"
          onClick={onSwitchToLogin}
        >
          <Sparkles size={15} />
          <span>Sign in instead</span>
        </button>
      </div>
    </div>
  );
};
