import { useState, useEffect } from 'react';
import api from '../utils/api';
import FirstTimeDiscountBanner from '../components/FirstTimeDiscountBanner';

export default function BookService() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    service_id: '', preferred_date: '', preferred_time: '',
    client_name: '', client_email: '', client_phone: '', notes: ''
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/services').then(r => setServices(r.data)).catch(() => {});
  }, []);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setStatus(null);
    try {
      await api.post('/bookings', form);
      setStatus({ type: 'success', msg: '✅ Booking submitted! We\'ll be in touch to confirm your appointment.' });
      setForm({ service_id: '', preferred_date: '', preferred_time: '', client_name: '', client_email: '', client_phone: '', notes: '' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Submission failed' });
    } finally { setLoading(false); }
  };

  return (
    <div className="container" style={{ maxWidth: 640, padding: '2rem 1rem' }}>
      <div className="page-header">
        <h1>📅 Book a Service</h1>
        <p>Fill out the form below and we'll confirm your appointment.</p>
      </div>

      <FirstTimeDiscountBanner compact />
      {status && <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`}>{status.msg}</div>}

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

          <hr className="divider" />
          <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Your contact information</p>

          <div className="form-group">
            <label>Full Name *</label>
            <input type="text" name="client_name" value={form.client_name} onChange={handle} required className="form-control" placeholder="Jane Smith" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email *</label>
              <input type="email" name="client_email" value={form.client_email} onChange={handle} required className="form-control" placeholder="jane@email.com" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" name="client_phone" value={form.client_phone} onChange={handle} className="form-control" placeholder="555-000-0000" />
            </div>
          </div>
          <div className="form-group">
            <label>Notes / Special Requests</label>
            <textarea name="notes" value={form.notes} onChange={handle} className="form-control" placeholder="Any special instructions…" />
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : '📅 Submit Booking Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
