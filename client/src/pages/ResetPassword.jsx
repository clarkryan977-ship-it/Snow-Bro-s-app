import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setMsg(null);
    if (form.new_password.length < 8) {
      return setMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
    }
    if (form.new_password !== form.confirm_password) {
      return setMsg({ type: 'error', text: 'Passwords do not match.' });
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, new_password: form.new_password });
      setMsg({ type: 'success', text: data.message });
      setDone(true);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to reset password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420, padding: '2rem 1rem' }}>
      <div className="page-header text-center">
        <img
          src="/logo.jpg"
          alt="Snow Bro's"
          style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--blue-200)', boxShadow: 'var(--shadow-md)', marginBottom: '.75rem', display: 'block', margin: '0 auto .75rem' }}
        />
        <h1>Set New Password</h1>
        <p>Snow Bro's Admin Portal</p>
      </div>

      <div className="card">
        {msg && (
          <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
            {msg.type === 'success' ? '✅ ' : '❌ '}{msg.text}
          </div>
        )}

        {done ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <p style={{ color: 'var(--gray-600)', marginBottom: '1.5rem' }}>
              Your password has been reset successfully.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="form-group">
              <label style={{ fontWeight: 600 }}>New Password <span style={{ color: 'red' }}>*</span></label>
              <input
                type="password"
                value={form.new_password}
                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                required
                className="form-control"
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              {form.new_password && form.new_password.length < 8 && (
                <p style={{ color: 'var(--red-600)', fontSize: '.8rem', margin: '.25rem 0 0' }}>
                  Must be at least 8 characters
                </p>
              )}
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600 }}>Confirm New Password <span style={{ color: 'red' }}>*</span></label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                required
                className="form-control"
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
              {form.confirm_password && form.new_password !== form.confirm_password && (
                <p style={{ color: 'var(--red-600)', fontSize: '.8rem', margin: '.25rem 0 0' }}>
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Password strength bar */}
            {form.new_password && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: form.new_password.length >= i * 3
                        ? (form.new_password.length >= 12 ? '#16a34a' : form.new_password.length >= 8 ? '#d97706' : '#dc2626')
                        : '#e5e7eb'
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--gray-500)', margin: 0 }}>
                  {form.new_password.length < 8 ? 'Too short' :
                   form.new_password.length < 12 ? 'Fair — consider a longer password' :
                   'Strong password ✓'}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading || !form.new_password || !form.confirm_password}
            >
              {loading ? <span className="spinner" /> : '🔒 Reset Password'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '.88rem' }}>
              <a href="/login" style={{ color: 'var(--blue-600)' }}>← Back to Sign In</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
