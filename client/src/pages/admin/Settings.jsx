import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Change password state
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/settings');
      const map = {};
      data.forEach(s => { map[s.key] = s.value; });
      setSettings(data);
      setForm(map);
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to load settings.' });
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.put('/settings', form);
      setMsg({ type: 'success', text: 'Settings saved successfully.' });
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const changePassword = async () => {
    setPwMsg(null);
    const { current_password, new_password, confirm_password } = pwForm;
    if (!current_password || !new_password || !confirm_password) {
      return setPwMsg({ type: 'error', text: 'All password fields are required.' });
    }
    if (new_password.length < 8) {
      return setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
    }
    if (new_password !== confirm_password) {
      return setPwMsg({ type: 'error', text: 'New passwords do not match.' });
    }
    setPwSaving(true);
    try {
      const { data } = await api.post('/auth/change-password', { current_password, new_password });
      setPwMsg({ type: 'success', text: data.message || 'Password updated successfully.' });
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) {
      setPwMsg({ type: 'error', text: e.response?.data?.error || 'Failed to update password.' });
    } finally {
      setPwSaving(false);
    }
  };

  const discountEnabled = form.first_time_discount_enabled === '1';
  const discountType = form.first_time_discount_type || 'fixed';
  const discountAmount = form.first_time_discount_amount || '10';
  const discountMessage = form.first_time_discount_message || '';
  const discountCode = form.first_time_discount_code || '';

  const previewMsg = discountType === 'fixed'
    ? `Welcome to Snow Bro's! Get $${discountAmount} off your first service.`
    : `Welcome to Snow Bro's! Get ${discountAmount}% off your first service.`;

  return (
    <div className="container" style={{ maxWidth: 720, padding: '2rem 1rem' }}>
      <div className="page-header">
        <h1>⚙️ App Settings</h1>
        <p>Configure promotions, business preferences, and account security.</p>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1.5rem' }}>
          {msg.text}
        </div>
      )}

      {/* First-Time Customer Discount */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '.25rem' }}>🎉 First-Time Customer Discount</h2>
            <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', margin: 0 }}>
              Show a promotional offer to new customers when they register or book their first service.
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', flexShrink: 0 }}>
            <div
              onClick={() => set('first_time_discount_enabled', discountEnabled ? '0' : '1')}
              style={{
                width: 48, height: 26, borderRadius: 13, cursor: 'pointer', transition: 'background .2s',
                background: discountEnabled ? 'var(--blue-600)' : 'var(--gray-300)',
                position: 'relative', flexShrink: 0
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: discountEnabled ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)'
              }} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '.9rem', color: discountEnabled ? 'var(--blue-700)' : 'var(--gray-400)' }}>
              {discountEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {discountEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Discount Type</label>
                <select
                  className="form-control"
                  value={discountType}
                  onChange={e => {
                    set('first_time_discount_type', e.target.value);
                    const newMsg = e.target.value === 'fixed'
                      ? `Welcome to Snow Bro's! Get $${discountAmount} off your first service when you book today.`
                      : `Welcome to Snow Bro's! Get ${discountAmount}% off your first service when you book today.`;
                    set('first_time_discount_message', newMsg);
                  }}
                >
                  <option value="fixed">Fixed Amount ($)</option>
                  <option value="percent">Percentage (%)</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>
                  Discount Amount&nbsp;
                  <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>
                    ({discountType === 'fixed' ? 'dollars' : 'percent'})
                  </span>
                </label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  step={discountType === 'fixed' ? '1' : '0.5'}
                  value={discountAmount}
                  onChange={e => {
                    set('first_time_discount_amount', e.target.value);
                    const newMsg = discountType === 'fixed'
                      ? `Welcome to Snow Bro's! Get $${e.target.value} off your first service when you book today.`
                      : `Welcome to Snow Bro's! Get ${e.target.value}% off your first service when you book today.`;
                    set('first_time_discount_message', newMsg);
                  }}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Discount Code <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(shown to customers, optional)</span></label>
              <input
                className="form-control"
                value={discountCode}
                onChange={e => set('first_time_discount_code', e.target.value.toUpperCase())}
                placeholder="e.g. NEWCUSTOMER10"
                style={{ fontFamily: 'monospace', letterSpacing: '.05em', textTransform: 'uppercase' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Promo Message <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(shown on registration and booking pages)</span></label>
              <textarea
                className="form-control"
                rows={3}
                value={discountMessage}
                onChange={e => set('first_time_discount_message', e.target.value)}
                placeholder="e.g. Welcome! Get $10 off your first service."
              />
            </div>

            <div style={{
              background: 'linear-gradient(135deg, var(--blue-600), var(--blue-800))',
              borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem', color: '#fff'
            }}>
              <div style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.08em', opacity: .75, marginBottom: '.5rem' }}>
                Preview — what new customers will see:
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.35rem' }}>
                🎉 {discountType === 'fixed' ? `$${discountAmount} Off` : `${discountAmount}% Off`} Your First Service!
              </div>
              <div style={{ fontSize: '.9rem', opacity: .9, marginBottom: discountCode ? '.5rem' : 0 }}>
                {discountMessage || previewMsg}
              </div>
              {discountCode && (
                <div style={{ marginTop: '.5rem', background: 'rgba(255,255,255,.15)', borderRadius: 6, padding: '.35rem .75rem', display: 'inline-block', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.1em', fontSize: '.95rem' }}>
                  Code: {discountCode}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2.5rem' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ minWidth: 140 }}>
          {saving ? <span className="spinner" /> : '💾 Save Settings'}
        </button>
      </div>

      {/* ── Change Password ── */}
      <div className="card" style={{ marginBottom: '1.5rem', borderTop: '3px solid var(--blue-600)' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '.25rem' }}>🔒 Change Password</h2>
          <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', margin: 0 }}>
            Update your admin account password. Minimum 8 characters required.
          </p>
        </div>

        {pwMsg && (
          <div
            className={`alert alert-${pwMsg.type === 'success' ? 'success' : 'error'}`}
            style={{ marginBottom: '1rem' }}
          >
            {pwMsg.type === 'success' ? '✅ ' : '❌ '}{pwMsg.text}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontWeight: 600 }}>Current Password <span style={{ color: 'red' }}>*</span></label>
            <input
              className="form-control"
              type="password"
              value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 600 }}>New Password <span style={{ color: 'red' }}>*</span></label>
              <input
                className="form-control"
                type="password"
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              {pwForm.new_password && pwForm.new_password.length < 8 && (
                <p style={{ color: 'var(--red-600)', fontSize: '.8rem', margin: '.25rem 0 0' }}>
                  Must be at least 8 characters
                </p>
              )}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 600 }}>Confirm New Password <span style={{ color: 'red' }}>*</span></label>
              <input
                className="form-control"
                type="password"
                value={pwForm.confirm_password}
                onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
              {pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                <p style={{ color: 'var(--red-600)', fontSize: '.8rem', margin: '.25rem 0 0' }}>
                  Passwords do not match
                </p>
              )}
            </div>
          </div>

          {/* Password strength indicator */}
          {pwForm.new_password && (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: pwForm.new_password.length >= i * 3
                      ? (pwForm.new_password.length >= 12 ? '#16a34a' : pwForm.new_password.length >= 8 ? '#d97706' : '#dc2626')
                      : '#e5e7eb'
                  }} />
                ))}
              </div>
              <p style={{ fontSize: '.78rem', color: 'var(--gray-500)', margin: 0 }}>
                {pwForm.new_password.length < 8 ? 'Too short' :
                 pwForm.new_password.length < 12 ? 'Fair — consider a longer password' :
                 'Strong password ✓'}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={changePassword}
              disabled={pwSaving || !pwForm.current_password || !pwForm.new_password || !pwForm.confirm_password}
              style={{ minWidth: 160 }}
            >
              {pwSaving ? <span className="spinner" /> : '🔒 Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
