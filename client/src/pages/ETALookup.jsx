import { useState } from 'react';
import SiteFooter from '../components/SiteFooter';

export default function ETALookup() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const r = await fetch(`${baseUrl}/api/routes/eta/lookup?name=${encodeURIComponent(query)}&address=${encodeURIComponent(query)}`);
      const data = await r.json();
      setResult(data);
    } catch (e) { setResult({ found: false, message: 'Error looking up ETA' }); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🕐</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>When Will We Arrive?</h1>
          <p style={{ color: '#6b7280', fontSize: 15, marginTop: 8 }}>
            Enter your name or address to see your estimated arrival time.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input
            placeholder="Your name or address..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            style={{ flex: 1, padding: '14px 18px', border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 16, outline: 'none', transition: 'border 0.2s' }}
            onFocus={e => e.target.style.borderColor = '#2563eb'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />
          <button onClick={lookup} disabled={loading}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontWeight: 700, fontSize: 16, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {loading ? 'Looking up...' : 'Check ETA'}
          </button>
        </div>

        {result && !result.found && (
          <div style={{ padding: 20, background: '#fef2f2', borderRadius: 12, color: '#991b1b', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>😕</div>
            <p style={{ margin: 0, fontWeight: 600 }}>We couldn't find you on today's route.</p>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#b91c1c' }}>Please check your name or address and try again, or contact us at 218-331-5145.</p>
          </div>
        )}

        {result && result.found && (
          <div style={{ padding: 24, background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', borderRadius: 12 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#6b7280' }}>Hello, {result.client_name}!</div>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#2563eb', margin: '8px 0' }}>
                {result.refined_eta || result.eta}
              </div>
              <div style={{ fontSize: 14, color: '#6b7280' }}>Estimated Arrival Time</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div style={{ background: '#fff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>#{result.stop_number}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Your Position</div>
              </div>
              <div style={{ background: '#fff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{result.total_stops}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Total Stops</div>
              </div>
              <div style={{ background: '#fff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>Crew {result.crew_number}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Assigned Crew</div>
              </div>
              <div style={{ background: '#fff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: result.snow_day ? '#2563eb' : '#22c55e' }}>
                  {result.snow_day ? '❄️ Snow' : '🌿 Lawn'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Service Type</div>
              </div>
            </div>

            {result.refined_eta && (
              <div style={{ marginTop: 16, padding: 12, background: '#dbeafe', borderRadius: 8, textAlign: 'center', fontSize: 14, color: '#1e40af' }}>
                📍 <strong>Live tracking active</strong> — ETA is being refined based on real-time crew location.
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
              Route: {result.route_name} · {result.num_crews} crew{result.num_crews > 1 ? 's' : ''} active
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
          <strong>Snow Bro's</strong> · Lawn Care &amp; Snow Removal · Moorhead, MN &amp; Fargo, ND<br />
          1812 33rd St S, Moorhead MN 56560 · <a href="tel:2183315145" style={{ color: '#6b7280' }}>218-331-5145</a>
        </div>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}
