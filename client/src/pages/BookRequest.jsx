import { useState } from 'react';
import { Link } from 'react-router-dom';

const SERVICES = [
  '❄️ Snow Removal',
  '🌿 Lawn Mowing',
  '🌱 Landscaping / Cleanup',
  '🚛 Junk Removal / Construction Clean-Up',
  '🍂 Leaf Removal',
  '🧹 General Cleanup',
  '📋 Other / Not Sure',
];

export default function BookRequest() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    address: '', city: '', state: 'ND', zip: '',
    service_type: '', preferred_date: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.service_type) {
      setError('Please fill in your name, email, and select a service type.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      // Guard against HTML responses (server cold-start or 404)
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server is starting up — please wait a moment and try again.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inp = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e2e8f0', fontSize: 15, boxSizing: 'border-box',
    marginTop: 4,
  };
  const lbl = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: '#374151', marginTop: 14,
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#1e3a5f', margin: '0 0 12px', fontSize: 24 }}>Request Received!</h2>
          <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.6, margin: '0 0 20px' }}>
            Thanks! We'll be in touch shortly to confirm your service. Check your email for a confirmation.
          </p>
          <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 24px' }}>
            If you need to reach us urgently, text or call us directly.
          </p>
          <Link to="/" style={{ display: 'inline-block', background: '#1e3a5f', color: '#fff', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header bar */}
      <div style={{ background: '#1e3a5f', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 18 }}>
          ❄️ Snow Bro's
        </Link>
        <Link to="/client-login" style={{ color: 'rgba(255,255,255,.75)', textDecoration: 'none', fontSize: 13 }}>
          Existing customer? Sign in →
        </Link>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ color: '#1e3a5f', fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>
            Book a One-Time Service
          </h1>
          <p style={{ color: '#64748b', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
            No account needed. Fill out the form below and we'll confirm your appointment.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 16px rgba(0,0,0,.07)' }}>

          {/* Contact info */}
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f', marginBottom: 4, borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>
            📋 Your Information
          </div>

          <label style={lbl}>Full Name *</label>
          <input style={inp} value={form.name} onChange={set('name')} placeholder="Jane Smith" required />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Email *</label>
              <input type="email" style={inp} value={form.email} onChange={set('email')} placeholder="jane@example.com" required />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input type="tel" style={inp} value={form.phone} onChange={set('phone')} placeholder="(701) 555-0100" />
            </div>
          </div>

          {/* Service address */}
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f', marginTop: 20, marginBottom: 4, borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>
            📍 Service Address
          </div>

          <label style={lbl}>Street Address</label>
          <input style={inp} value={form.address} onChange={set('address')} placeholder="123 Main St" />

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>City</label>
              <input style={inp} value={form.city} onChange={set('city')} placeholder="Fargo" />
            </div>
            <div>
              <label style={lbl}>State</label>
              <input style={inp} value={form.state} onChange={set('state')} placeholder="ND" maxLength={2} />
            </div>
            <div>
              <label style={lbl}>ZIP</label>
              <input style={inp} value={form.zip} onChange={set('zip')} placeholder="58102" maxLength={10} />
            </div>
          </div>

          {/* Service details */}
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f', marginTop: 20, marginBottom: 4, borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>
            🛠️ Service Details
          </div>

          <label style={lbl}>Service Type *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
            {SERVICES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setForm(f => ({ ...f, service_type: s }))}
                style={{
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
                  border: '2px solid ' + (form.service_type === s ? '#1e3a5f' : '#e2e8f0'),
                  background: form.service_type === s ? '#1e3a5f' : '#fff',
                  color: form.service_type === s ? '#fff' : '#374151',
                  fontWeight: form.service_type === s ? 700 : 400,
                  textAlign: 'left',
                  transition: 'all .1s',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <label style={lbl}>Preferred Date (optional)</label>
          <input type="date" style={inp} value={form.preferred_date} onChange={set('preferred_date')}
            min={new Date().toISOString().slice(0, 10)} />

          <label style={lbl}>Additional Notes</label>
          <textarea
            style={{ ...inp, height: 90, resize: 'vertical', fontFamily: 'inherit' }}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Gate code, special instructions, what needs to be done…"
          />

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginTop: 14, fontSize: 14, color: '#991b1b' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', marginTop: 20, padding: '14px 0',
              background: submitting ? '#94a3b8' : '#1e3a5f',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 16, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {submitting ? 'Sending Request…' : '📨 Send My Request'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
            We'll confirm via email and reach out to finalize the time.
          </p>
        </form>
      </div>
    </div>
  );
}
