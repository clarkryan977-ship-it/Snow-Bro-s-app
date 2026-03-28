import { useState, useEffect } from 'react';
import api from '../utils/api';
import FirstTimeDiscountBanner from '../components/FirstTimeDiscountBanner';
import SiteFooter from '../components/SiteFooter';

export default function BookService() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    client_type: 'residential',
    service_id: '', preferred_date: '', preferred_time: '',
    client_name: '', client_email: '', client_phone: '',
    property_address: '', notes: ''
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
      // Include client_type and property_address in notes if provided
      const notesWithMeta = [
        form.client_type === 'commercial' ? '🏢 COMMERCIAL CLIENT' : '🏠 Residential Client',
        form.property_address ? `Property Address: ${form.property_address}` : '',
        form.notes
      ].filter(Boolean).join('\n');

      await api.post('/bookings', {
        service_id: form.service_id,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        client_name: form.client_name,
        client_email: form.client_email,
        client_phone: form.client_phone,
        notes: notesWithMeta
      });
      setStatus({ type: 'success', msg: '✅ Booking submitted! We\'ll be in touch to confirm your appointment. Pay easily via Cash App ($snowbros218), Venmo, or Zelle.' });
      setForm({ client_type: 'residential', service_id: '', preferred_date: '', preferred_time: '', client_name: '', client_email: '', client_phone: '', property_address: '', notes: '' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.error || 'Submission failed' });
    } finally { setLoading(false); }
  };

  const isCommercial = form.client_type === 'commercial';

  return (
    <div>
      <div className="container" style={{ maxWidth: 640, padding: '2rem 1rem' }}>
      <div className="page-header">
        <h1>📅 Book a Lawn Care or Snow Removal Service</h1>
        <p>Schedule residential or commercial lawn care and snow removal in Moorhead, MN &amp; Fargo, ND. Fill out the form and we'll confirm your appointment.</p>
      </div>

      <FirstTimeDiscountBanner compact />
      {status && <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`}>{status.msg}</div>}

      <div className="card">
        <form onSubmit={submit}>

          {/* Client Type Toggle */}
          <div className="form-group">
            <label style={{ fontWeight: 700, marginBottom: '.6rem', display: 'block' }}>Client Type *</label>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, client_type: 'residential' }))}
                style={{
                  flex: 1, padding: '.75rem', borderRadius: '8px', fontWeight: 600, fontSize: '.95rem', cursor: 'pointer',
                  border: `2px solid ${!isCommercial ? 'var(--navy)' : 'var(--gray-200)'}`,
                  background: !isCommercial ? 'var(--navy)' : '#fff',
                  color: !isCommercial ? '#fff' : 'var(--gray-600)',
                  transition: 'all .15s'
                }}
              >
                🏠 Residential
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, client_type: 'commercial' }))}
                style={{
                  flex: 1, padding: '.75rem', borderRadius: '8px', fontWeight: 600, fontSize: '.95rem', cursor: 'pointer',
                  border: `2px solid ${isCommercial ? 'var(--navy)' : 'var(--gray-200)'}`,
                  background: isCommercial ? 'var(--navy)' : '#fff',
                  color: isCommercial ? '#fff' : 'var(--gray-600)',
                  transition: 'all .15s'
                }}
              >
                🏢 Commercial
              </button>
            </div>
            {isCommercial && (
              <div style={{ marginTop: '.75rem', padding: '.75rem 1rem', background: 'var(--blue-50)', borderRadius: '8px', border: '1px solid var(--blue-100)', fontSize: '.85rem', color: 'var(--navy)' }}>
                <strong>Commercial clients:</strong> We offer flexible service contracts for businesses, HOAs, parking lots, and multi-family properties. Mention your property details in the notes below and we'll prepare a custom quote.
              </div>
            )}
          </div>

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
          <p style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
            {isCommercial ? 'Your business / contact information' : 'Your contact information'}
          </p>

          <div className="form-group">
            <label>{isCommercial ? 'Business / Contact Name *' : 'Full Name *'}</label>
            <input type="text" name="client_name" value={form.client_name} onChange={handle} required className="form-control"
              placeholder={isCommercial ? 'Acme Corp — Jane Smith' : 'Jane Smith'} />
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
            <label>{isCommercial ? 'Property / Service Address *' : 'Service Address'}</label>
            <input type="text" name="property_address" value={form.property_address} onChange={handle}
              required={isCommercial} className="form-control"
              placeholder={isCommercial ? '123 Business Blvd, Moorhead, MN' : '123 Main St, Moorhead, MN (optional)'} />
          </div>

          <div className="form-group">
            <label>{isCommercial ? 'Property Details / Notes *' : 'Notes / Special Requests'}</label>
            <textarea name="notes" value={form.notes} onChange={handle} className="form-control" rows={4}
              placeholder={isCommercial
                ? 'Describe the property (e.g., parking lot size, number of buildings, HOA community size, frequency needed, etc.)'
                : 'Any special instructions…'} />
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : isCommercial ? '📋 Submit Commercial Quote Request' : '📅 Submit Booking Request'}
          </button>
        </form>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}
