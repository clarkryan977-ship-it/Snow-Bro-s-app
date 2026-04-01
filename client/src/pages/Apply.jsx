import { useState } from 'react';
import axios from 'axios';

const POSITIONS = [
  'Snow Plow Driver',
  'Snow Removal Crew',
  'Lawn Care Technician',
  'Junk Removal Crew',
  'General Labor',
  'Route Driver',
  'Seasonal Help',
  'Other',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const inputStyle = {
  width: '100%',
  padding: '.6rem .85rem',
  border: '1.5px solid #d1d5db',
  borderRadius: 8,
  fontSize: '.95rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: '#fff',
  color: '#1e293b',
};

const labelStyle = {
  display: 'block',
  fontWeight: 600,
  fontSize: '.88rem',
  color: '#374151',
  marginBottom: '.3rem',
};

const fieldStyle = { marginBottom: '1.1rem' };

export default function Apply() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', address: '', city: '', state: '', zip: '',
    position: '', availability: '', experience: '', references_info: '', notes: '',
  });
  const [availDays, setAvailDays] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleDay = (day) => {
    setAvailDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.full_name || !form.email || !form.position) {
      setError('Please fill in your name, email, and the position you are applying for.');
      return;
    }
    setLoading(true);
    try {
      const availText = availDays.length > 0
        ? `Available days: ${availDays.join(', ')}. ${form.availability}`
        : form.availability;
      await axios.post('/api/applications/public', { ...form, availability: availText });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '3rem 2.5rem', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ color: '#1d4ed8', margin: '0 0 .75rem', fontSize: '1.6rem' }}>Application Received!</h2>
          <p style={{ color: '#374151', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Thank you for applying to Snow Bro's! We've received your application and will be in touch soon.
          </p>
          <p style={{ color: '#6b7280', fontSize: '.9rem' }}>
            If you have questions, you can reach us at <strong>snowbrosllc@gmail.com</strong>.
          </p>
          <a href="/" style={{ display: 'inline-block', marginTop: '1.5rem', padding: '.7rem 2rem', background: '#1d4ed8', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', color: '#fff', marginBottom: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>❄️</div>
        <h1 style={{ margin: '0 0 .5rem', fontSize: '2rem', fontWeight: 800 }}>Join the Snow Bro's Team</h1>
        <p style={{ margin: 0, opacity: .85, fontSize: '1.05rem' }}>
          We're hiring! Fill out the form below and we'll be in touch.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, padding: '2.5rem 2rem', maxWidth: 680, margin: '0 auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <h2 style={{ margin: '0 0 1.5rem', color: '#1e293b', fontSize: '1.2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '.75rem' }}>
          📋 Employment Application
        </h2>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '.75rem 1rem', color: '#dc2626', marginBottom: '1.25rem', fontSize: '.9rem' }}>
            {error}
          </div>
        )}

        {/* Personal Info */}
        <h3 style={{ margin: '0 0 1rem', color: '#374151', fontSize: '.95rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Personal Information</h3>

        <div style={fieldStyle}>
          <label style={labelStyle}>Full Name <span style={{ color: '#dc2626' }}>*</span></label>
          <input style={inputStyle} type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="John Smith" required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email Address <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" required />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Phone Number</label>
            <input style={inputStyle} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="701-555-0100" />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Street Address</label>
          <input style={inputStyle} type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Fargo" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>State</label>
            <input style={inputStyle} type="text" value={form.state} onChange={e => set('state', e.target.value)} placeholder="ND" maxLength={2} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Zip</label>
            <input style={inputStyle} type="text" value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="58102" maxLength={10} />
          </div>
        </div>

        {/* Position */}
        <h3 style={{ margin: '1.5rem 0 1rem', color: '#374151', fontSize: '.95rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Position & Availability</h3>

        <div style={fieldStyle}>
          <label style={labelStyle}>Position Applying For <span style={{ color: '#dc2626' }}>*</span></label>
          <select style={inputStyle} value={form.position} onChange={e => set('position', e.target.value)} required>
            <option value="">— Select a position —</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Available Days</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.25rem' }}>
            {DAYS.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                style={{
                  padding: '.4rem .85rem',
                  borderRadius: 20,
                  border: '1.5px solid',
                  borderColor: availDays.includes(day) ? '#1d4ed8' : '#d1d5db',
                  background: availDays.includes(day) ? '#eff6ff' : '#fff',
                  color: availDays.includes(day) ? '#1d4ed8' : '#6b7280',
                  fontWeight: availDays.includes(day) ? 700 : 400,
                  fontSize: '.85rem',
                  cursor: 'pointer',
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Hours / Additional Availability Notes</label>
          <input style={inputStyle} type="text" value={form.availability} onChange={e => set('availability', e.target.value)} placeholder="e.g. Mornings only, Weekends preferred, Available 5am–2pm" />
        </div>

        {/* Experience */}
        <h3 style={{ margin: '1.5rem 0 1rem', color: '#374151', fontSize: '.95rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Experience & References</h3>

        <div style={fieldStyle}>
          <label style={labelStyle}>Work Experience</label>
          <textarea
            style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }}
            value={form.experience}
            onChange={e => set('experience', e.target.value)}
            placeholder="Describe any relevant work experience (snow removal, lawn care, driving, etc.)"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>References</label>
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
            value={form.references_info}
            onChange={e => set('references_info', e.target.value)}
            placeholder="Name, relationship, phone number (at least one reference preferred)"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Additional Notes</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Anything else you'd like us to know?"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '.9rem',
            background: loading ? '#93c5fd' : '#1d4ed8',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '.5rem',
            letterSpacing: '.02em',
          }}
        >
          {loading ? 'Submitting...' : '📨 Submit Application'}
        </button>

        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '.8rem', marginTop: '1rem', marginBottom: 0 }}>
          By submitting this form, you agree that Snow Bro's may contact you regarding employment opportunities.
        </p>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <a href="/" style={{ color: 'rgba(255,255,255,.7)', fontSize: '.9rem', textDecoration: 'none' }}>← Back to snowbros.com</a>
      </div>
    </div>
  );
}
