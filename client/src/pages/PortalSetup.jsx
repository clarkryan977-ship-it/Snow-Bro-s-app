import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function PortalSetup() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [status, setStatus] = useState('loading'); // loading | valid | invalid | submitting | done
  const [clientInfo, setClientInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/auth/portal-setup/${token}`)
      .then(r => { setClientInfo(r.data); setStatus('valid'); })
      .catch(err => { setError(err.response?.data?.error || 'Invalid or expired link.'); setStatus('invalid'); });
  }, [token]);

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setStatus('submitting');
    try {
      const { data } = await api.post(`/auth/portal-setup/${token}`, { password });
      login(data.token, data.user, true);
      setStatus('done');
      setTimeout(() => navigate('/client'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to activate account.');
      setStatus('valid');
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f2557 0%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  };
  const cardStyle = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    padding: '2.5rem 2rem',
    maxWidth: 440,
    width: '100%',
  };

  if (status === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '1.1rem' }}>
            ❄️ Verifying your invite link…
          </div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ color: '#dc2626', marginBottom: 12 }}>Link Expired or Invalid</h2>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>{error}</p>
            <a href="/login" style={{ color: '#1d4ed8', fontWeight: 600 }}>← Back to Login</a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: '#16a34a', marginBottom: 8 }}>Account Activated!</h2>
            <p style={{ color: '#6b7280' }}>Redirecting you to your portal…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>❄️</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f2557' }}>Snow Bro's Client Portal</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '.95rem' }}>
            Welcome, <strong>{clientInfo?.first_name}</strong>! Set your password to activate your account.
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: '.9rem' }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#374151', fontSize: '.9rem' }}>
              Email
            </label>
            <input
              type="email"
              value={clientInfo?.email || ''}
              disabled
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#f9fafb', color: '#6b7280', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#374151', fontSize: '.9rem' }}>
              Choose a Password <span style={{ color: '#6b7280', fontWeight: 400 }}>(min. 8 characters)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="Enter a strong password"
              style={{ width: '100%', padding: '10px 12px', border: '2px solid #d1d5db', borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#374151', fontSize: '.9rem' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              placeholder="Re-enter your password"
              style={{ width: '100%', padding: '10px 12px', border: `2px solid ${confirm && confirm !== password ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box', outline: 'none' }}
            />
            {confirm && confirm !== password && (
              <p style={{ color: '#ef4444', fontSize: '.82rem', marginTop: 4 }}>Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            style={{
              width: '100%', padding: '13px', background: status === 'submitting' ? '#93c5fd' : '#1d4ed8',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem',
              fontWeight: 700, cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
              letterSpacing: '.3px',
            }}
          >
            {status === 'submitting' ? '⏳ Activating…' : '✅ Activate My Account & Enter Portal'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, color: '#9ca3af', fontSize: '.8rem' }}>
          Already have a password? <a href="/login" style={{ color: '#1d4ed8' }}>Log in here</a>
        </p>
      </div>
    </div>
  );
}
