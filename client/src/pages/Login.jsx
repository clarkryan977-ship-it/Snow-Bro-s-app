import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('staff'); // 'staff' | 'client'
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const endpoint = tab === 'client' ? '/auth/client-login' : '/auth/login';
      const { data } = await api.post(endpoint, form);
      login(data.token, data.user);
      if (data.user.role === 'admin' || data.user.role === 'manager') navigate('/admin');
      else if (data.user.role === 'employee') navigate('/employee');
      else navigate('/client');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

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
            <input type="email" name="email" value={form.email} onChange={handle} required className="form-control" autoComplete="email" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" value={form.password} onChange={handle} required className="form-control" autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        {tab === 'client' && (
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '.88rem', color: 'var(--gray-500)' }}>
            No account? <Link to="/register">Create one free</Link>
          </p>
        )}

        {tab === 'staff' && (
          <div className="alert alert-info mt-2" style={{ fontSize: '.8rem' }}>
            <strong>Demo credentials:</strong><br />
            Admin: admin@snowbros.com / admin123<br />
            Employee: john@snowbros.com / employee123
          </div>
        )}
      </div>
    </div>
  );
}
