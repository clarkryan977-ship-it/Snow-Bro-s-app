import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import FirstTimeDiscountBanner from '../components/FirstTimeDiscountBanner';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', password: '', confirm: '',
    referral_code: ''
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [referrerName, setReferrerName] = useState('');

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setForm(f => ({ ...f, referral_code: ref }));
      api.post('/referrals/validate', { code: ref })
        .then(r => setReferrerName(r.data.referrer))
        .catch(() => {});
    }
  }, [searchParams]);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const validateRef = async () => {
    if (!form.referral_code) { setReferrerName(''); return; }
    try {
      const { data } = await api.post('/referrals/validate', { code: form.referral_code });
      setReferrerName(data.referrer);
    } catch (e) { setReferrerName(''); setStatus({ type: 'error', msg: 'Invalid referral code' }); }
  };

  const submit = async e => {
    e.preventDefault();
    if (form.password !== form.confirm) return setStatus({ type: 'error', msg: 'Passwords do not match' });
    if (form.password.length < 8) return setStatus({ type: 'error', msg: 'Password must be at least 8 characters' });
    setLoading(true); setStatus(null);
    try {
      const { data } = await api.post('/auth/register', form);

      // Redeem referral if applicable
      if (form.referral_code && data.id) {
        try { await api.post('/referrals/redeem', { referral_code: form.referral_code, new_client_id: data.id }); } catch (_) {}
      }

      // Auto-login: the backend now returns a JWT token on successful registration
      if (data.token && data.user) {
        login(data.token, data.user, true); // rememberMe=true → localStorage, 30-day token
        setStatus({ type: 'success', msg: `✅ ${data.message || 'Account created!'} Taking you to your portal…` });
        setTimeout(() => navigate('/client/dashboard'), 1500);
      } else {
        // Fallback: redirect to login if no token returned
        setStatus({ type: 'success', msg: '✅ Account created! Please sign in.' });
        setTimeout(() => navigate('/login'), 1800);
      }
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.error === 'account_exists') {
        setStatus({
          type: 'error',
          msg: errData.message || 'An account already exists for this email. Please sign in instead.'
        });
      } else {
        setStatus({ type: 'error', msg: errData?.error || errData?.message || 'Registration failed. Please try again.' });
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="container" style={{ maxWidth: 600, padding: '2rem 1rem' }}>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <img
          src="/logo.jpg"
          alt="Snow Bro's"
          style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--blue-200)', boxShadow: 'var(--shadow-md)', display: 'block', margin: '0 auto .75rem' }}
        />
        <h1>Create Your Account</h1>
        <p>Sign up to book services, view invoices, and manage your account.</p>
      </div>

      {/* No-contract callout */}
      <div className="card mb-2" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderLeft: '4px solid #16a34a', padding: '1rem 1.25rem' }}>
        <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '.25rem' }}>✅ No Contract Required</div>
        <div style={{ fontSize: '.88rem', color: '#166534' }}>
          Already a Snow Bro's customer? Enter the email we have on file and we'll link your portal
          account to your existing records — no duplicate needed.
        </div>
      </div>

      <FirstTimeDiscountBanner />

      {status && (
        <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`}>
          {status.msg}
        </div>
      )}

      {/* Show sign-in link prominently when account already exists */}
      {status?.type === 'error' && status.msg?.includes('already exists') && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Link to="/login" className="btn btn-primary">Sign In to Your Account</Link>
        </div>
      )}

      <div className="card">
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group"><label>First Name *</label><input name="first_name" value={form.first_name} onChange={handle} required className="form-control" /></div>
            <div className="form-group"><label>Last Name *</label><input name="last_name" value={form.last_name} onChange={handle} required className="form-control" /></div>
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" name="email" value={form.email} onChange={handle} required className="form-control" />
            <small style={{ color: 'var(--gray-500)', fontSize: '.8rem' }}>
              If you're already a Snow Bro's customer, use the same email we have on file.
            </small>
          </div>
          <div className="form-group"><label>Phone</label><input type="tel" name="phone" value={form.phone} onChange={handle} className="form-control" /></div>
          <div className="form-group"><label>Street Address</label><input name="address" value={form.address} onChange={handle} className="form-control" placeholder="123 Main St" /></div>
          <div className="form-row">
            <div className="form-group"><label>City</label><input name="city" value={form.city} onChange={handle} className="form-control" placeholder="Moorhead" /></div>
            <div className="form-group"><label>State</label><input name="state" value={form.state} onChange={handle} className="form-control" placeholder="MN" /></div>
          </div>
          <div className="form-group"><label>ZIP</label><input name="zip" value={form.zip} onChange={handle} className="form-control" style={{ maxWidth: 140 }} placeholder="56560" /></div>
          <hr className="divider" />
          <div className="form-group">
            <label>Referral Code (optional)</label>
            <input name="referral_code" value={form.referral_code} onChange={handle} onBlur={validateRef} className="form-control" placeholder="e.g. SNOW1A2B3C" />
            {referrerName && (
              <div style={{ fontSize: '.82rem', color: '#059669', marginTop: '.25rem', fontWeight: 600 }}>
                🎁 Referred by {referrerName} — you both get $10 credit!
              </div>
            )}
          </div>
          <hr className="divider" />
          <div className="form-row">
            <div className="form-group">
              <label>Password *</label>
              <input type="password" name="password" value={form.password} onChange={handle} required className="form-control" autoComplete="new-password" />
              <small style={{ color: 'var(--gray-500)', fontSize: '.8rem' }}>Minimum 8 characters</small>
            </div>
            <div className="form-group">
              <label>Confirm Password *</label>
              <input type="password" name="confirm" value={form.confirm} onChange={handle} required className="form-control" autoComplete="new-password" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : '🚀 Create Account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '.88rem', color: 'var(--gray-500)' }}>
          Already have an account? <Link to="/login">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}
