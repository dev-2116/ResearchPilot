import React, { useState } from 'react';
import { Eye, EyeOff, FlaskConical, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    setIsLoading(true);
    try {
      await login({ email: form.email, password: form.password });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-bg-overlay" />

      <div className="auth-card">
        {/* Logo / Brand */}
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <FlaskConical size={28} color="#ffffff" />
          </div>
          <div>
            <div className="auth-brand-name">ResearchPilot</div>
            <div className="auth-brand-tagline">Evidence-Verified AI Research</div>
          </div>
        </div>

        <h1 className="auth-heading">Welcome back</h1>
        <p className="auth-subheading">Sign in to your researcher account</p>

        {error && (
          <div className="auth-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Email address</label>
            <input
              id="login-email"
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
            <label className="auth-label" htmlFor="login-password">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                className="auth-input auth-input-with-icon"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
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

          <button
            id="login-submit-btn"
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="auth-spinner" />
            ) : (
              <>
                <LogIn size={17} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-divider"><span>New to ResearchPilot?</span></div>

        <button
          id="switch-to-register-btn"
          className="auth-switch-btn"
          onClick={onSwitchToRegister}
        >
          <Sparkles size={15} />
          <span>Create a free account</span>
        </button>
      </div>
    </div>
  );
};
