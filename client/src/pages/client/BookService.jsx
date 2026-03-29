import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function ClientBookService() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    service_id: '', preferred_date: '', preferred_time: '',
    address: '', city: '', state: '', zip: '', notes: ''
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateBlocked, setDateBlocked] = useState(null);
  const [checkingDate, setCheckingDate] = useState(false);

  useEffect(() => {
    api.get('/services').then(r => setServices(r.data)).catch(() => {});
  }, []);

  const checkAvailability = useCallback(async (date, time) => {
    if (!date) { setDateBlocked(null); return; }
    setCheckingDate(true);
    try {
      const params = time ? `?date=${date}&time=${time}` : `?date=${date}`;
      const { data } = await api.get(`/availability/check${params}`);
      setDateBlocked(data);
    } catch { setDateBlocked(null); }
    finally { setCheckingDate(false); }
  }, []);

  const handle = e => {
    const { name, value } = e.target;
    setForm(f => {
      const updated = { ...f, [name]: value };
      if (name === 'preferred_date' || name === 'preferred_time') {
        const date = name === 'preferred_date' ? value : f.preferred_date;
        const time = name === 'preferred_time' ? value : f.preferred_time;
        checkAvailability(date, time);
      }
      return updated;
    });
  };

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setStatus(null);
    try {
      await api.post('/bookings/client', {
        service_id: form.service_id,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        notes: form.notes,
      });
      setStatus({ type: 'success', msg: '✅ Booking submitted! We\'ll review and confirm your appointment shortly. You\'ll receive a confirmation email once accepted.' });
      setForm({ service_id: '', preferred_date: '', preferred_time: '', address: '', city: '', state: '', zip: '', notes: '' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Submission failed. Please try again.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="container" style={{ maxWidth: 640, padding: '2rem 1rem' }}>
      <div className="page-header">
        <h1>📅 Book a Service</h1>
        <p>Schedule lawn care or snow removal. No contract required — just pick a service and date.</p>
      </div>

      <div className="card mb-2" style={{ background: '#f0fdf4', borderLeft: '4px solid #16a34a', padding: '.75rem 1rem' }}>
        <div style={{ fontSize: '.88rem', color: '#166534' }}>
          <strong>👋 Booking as {user?.name}</strong> — No contract needed. Submit your request and we'll confirm within 24 hours.
        </div>
      </div>

      {status && (
        <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {status.msg}
          {status.type === 'success' && (
            <div style={{ marginTop: '.5rem' }}>
              <Link to="/client/history" style={{ color: '#166534', fontWeight: 700 }}>View your bookings →</Link>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Service *</label>
            <select name="service_id" value={form.service_id} onChange={handle} required className="form-control">
              <option value="">Select a service…</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.price > 0 ? ` — $${s.price}` : ''}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Preferred Date *</label>
              <input type="date" name="preferred_date" value={form.preferred_date} onChange={handle} required className="form-control" min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="form-group">
              <label>Preferred Time</label>
              <input type="time" name="preferred_time" value={form.preferred_time} onChange={handle} className="form-control" />
            </div>
          </div>

          {checkingDate && (
            <div style={{ padding: '.6rem 1rem', background: '#f1f5f9', borderRadius: 8, fontSize: '.85rem', color: '#64748b', marginBottom: '.75rem' }}>
              ⏳ Checking availability...
            </div>
          )}
          {!checkingDate && dateBlocked?.blocked && (
            <div style={{ padding: '.75rem 1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: '.88rem', color: '#dc2626', fontWeight: 600, marginBottom: '.75rem' }}>
              🚫 {dateBlocked.all_day
                ? `This date is not available${dateBlocked.reason ? ` — ${dateBlocked.reason}` : ''}. Please choose a different date.`
                : `This time slot is not available${dateBlocked.reason ? ` — ${dateBlocked.reason}` : ''}. Please choose a different time.`}
            </div>
          )}
          {!checkingDate && form.preferred_date && dateBlocked && !dateBlocked.blocked && (
            <div style={{ padding: '.6rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: '.85rem', color: '#16a34a', fontWeight: 600, marginBottom: '.75rem' }}>
              ✅ This date is available!
            </div>
          )}

          <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '.5rem', marginTop: '.5rem' }}>Service Address (optional — leave blank to use your account address)</div>
          <div className="form-group">
            <label>Street Address</label>
            <input type="text" name="address" value={form.address} onChange={handle} className="form-control" placeholder="123 Main St" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input type="text" name="city" value={form.city} onChange={handle} className="form-control" placeholder="Moorhead" />
            </div>
            <div className="form-group">
              <label>State</label>
              <input type="text" name="state" value={form.state} onChange={handle} className="form-control" placeholder="MN" style={{ maxWidth: 80 }} />
            </div>
            <div className="form-group">
              <label>ZIP</label>
              <input type="text" name="zip" value={form.zip} onChange={handle} className="form-control" placeholder="56560" style={{ maxWidth: 100 }} />
            </div>
          </div>

          <div className="form-group">
            <label>Notes / Special Requests</label>
            <textarea name="notes" value={form.notes} onChange={handle} className="form-control" rows={3} placeholder="Any special instructions, gate codes, or details about the property…" />
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading || dateBlocked?.blocked}>
            {loading ? <span className="spinner" /> : '📅 Submit Booking Request'}
          </button>
        </form>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link to="/client" style={{ color: 'var(--gray-500)', fontSize: '.88rem' }}>← Back to Dashboard</Link>
      </div>
    </div>
  );
}
