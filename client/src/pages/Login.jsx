// v2 - eye toggle + remember-me fix
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// Simple eye / eye-off SVG icons (inline, no dependency needed)
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('staff'); // 'staff' | 'client'
  const [form, setForm] = useState({ email: '', password: '', remember_me: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handle = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const endpoint = tab === 'client' ? '/auth/client-login' : '/auth/login';
      const { data } = await api.post(endpoint, form);
      login(data.token, data.user, form.remember_me);
      if (data.user.role === 'admin' || data.user.role === 'manager') navigate('/admin');
      else if (data.user.role === 'employee') navigate('/employee');
      else navigate('/client');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const sendForgotPassword = async e => {
    e.preventDefault();
    if (!forgotEmail) return setForgotMsg({ type: 'error', text: 'Please enter your email address.' });
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: forgotEmail, type: tab });
      setForgotMsg({ type: 'success', text: data.message });
    } catch (err) {
      setForgotMsg({ type: 'error', text: err.response?.data?.error || 'Failed to send reset email.' });
    } finally {
      setForgotLoading(false);
    }
  };

  if (showForgot) {
    return (
      <div className="container" style={{ maxWidth: 420, padding: '2rem 1rem' }}>
        <div className="page-header text-center">
          <img
            src="/logo.jpg"
            alt="Snow Bro's"
            style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--blue-200)', boxShadow: 'var(--shadow-md)', marginBottom: '.75rem', display: 'block', margin: '0 auto .75rem' }}
          />
          <h1>Reset Password</h1>
          <p>Enter your {tab === 'client' ? 'client' : 'staff'} email to receive a reset link</p>
        </div>

        <div className="card">
          {forgotMsg && (
            <div className={`alert alert-${forgotMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
              {forgotMsg.type === 'success' ? '✅ ' : '❌ '}{forgotMsg.text}
            </div>
          )}

          {(!forgotMsg || forgotMsg.type !== 'success') && (
            <form onSubmit={sendForgotPassword}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                  className="form-control"
                  placeholder={`Enter your ${tab === 'client' ? 'client' : 'admin'} email`}
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={forgotLoading}>
                {forgotLoading ? <span className="spinner" /> : '📧 Send Reset Link'}
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '.88rem' }}>
            <button
              onClick={() => { setShowForgot(false); setForgotMsg(null); setForgotEmail(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--blue-600)', cursor: 'pointer', textDecoration: 'underline', fontSize: '.88rem' }}
            >
              ← Back to Sign In
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 420, padding: '2rem 1rem' }}>
      <div className="page-header text-center">
        <img
          src="/logo.jpg"
          alt="Snow Bro's"
          style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--blue-200)', boxShadow: 'var(--shadow-md)', marginBottom: '.75rem', display: 'block', margin: '0 auto .75rem' }}
        />
        <h1>Sign In</h1>
        <p>Snow Bro's Portal</p>
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 'var(--radius)', padding: '4px', marginBottom: '1.5rem' }}>
        {[['staff', '👷 Staff / Admin'], ['client', '👤 Client']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '.45rem', border: 'none', borderRadius: 'calc(var(--radius) - 2px)',
            background: tab === key ? '#fff' : 'transparent',
            fontWeight: tab === key ? 600 : 400, fontSize: '.88rem',
            color: tab === key ? 'var(--blue-700)' : 'var(--gray-500)',
            boxShadow: tab === key ? 'var(--shadow-sm)' : 'none',
            transition: 'all .15s'
          }}>{label}</button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handle}
              required
              className="form-control"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.35rem' }}>
              <label style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                style={{
                  background: 'none', border: 'none', color: 'var(--blue-600)',
                  cursor: 'pointer', fontSize: '.8rem', textDecoration: 'underline', padding: 0
                }}
              >
                Forgot Password?
              </button>
            </div>
            {/* Password field with show/hide toggle */}
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handle}
                required
                className="form-control"
                autoComplete="current-password"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--gray-400)', display: 'flex', alignItems: 'center', padding: 0,
                  lineHeight: 1
                }}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.25rem' }}>
            <input
              type="checkbox"
              id="remember_me"
              name="remember_me"
              checked={form.remember_me}
              onChange={handle}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--blue-600)', flexShrink: 0 }}
            />
            <label htmlFor="remember_me" style={{ margin: 0, fontSize: '.88rem', color: 'var(--gray-600)', cursor: 'pointer', userSelect: 'none' }}>
              Remember me for 30 days
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        {tab === 'client' && (
          <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)' }}>
            <p style={{ fontSize: '.88rem', color: 'var(--gray-500)', margin: '0 0 .6rem' }}>
              New here, or already a Snow Bro's customer?
            </p>
            <Link
              to="/register"
              className="btn btn-secondary btn-block"
              style={{ display: 'block', textAlign: 'center' }}
            >
              ✨ Create a Portal Account
            </Link>
            <p style={{ fontSize: '.78rem', color: 'var(--gray-400)', margin: '.5rem 0 0' }}>
              Existing customers: use your email on file to link your account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
