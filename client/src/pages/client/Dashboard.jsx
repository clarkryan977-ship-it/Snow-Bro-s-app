import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [eta, setEta] = useState(null);
  const [etaLoading, setEtaLoading] = useState(true);
  const etaPollRef = useRef(null);

  const loadEta = async () => {
    try {
      const r = await api.get('/routes/my-eta');
      setEta(r.data);
    } catch (e) {
      setEta({ found: false, message: 'Unable to load ETA' });
    }
  };

  useEffect(() => {
    api.get('/contracts/my').then(r => setContracts(r.data)).catch(() => {});
    loadEta().then(() => setEtaLoading(false));
    etaPollRef.current = setInterval(loadEta, 150000);
    return () => { if (etaPollRef.current) clearInterval(etaPollRef.current); };
  }, []);

  const pending = contracts.filter(c => c.status !== 'signed').length;

  const cards = [
    { to:'/client/book', icon:'📅', title:'Book a Service', desc:'Schedule lawn care or snow removal — no contract needed' },
    { to:'/client/history', icon:'📋', title:'Service History', desc:'View past jobs and before/after photos' },
    { to:'/client/invoices', icon:'🧾', title:'Invoices', desc:'View and pay your invoices' },
    { to:'/client/recurring', icon:'🔄', title:'Recurring Services', desc:'Set up automatic scheduling' },
    { to:'/client/contracts', icon:'📄', title:'Contracts', desc:'View and sign your contracts' },
    { to:'/client/referrals', icon:'🎁', title:'Refer a Friend', desc:'Earn $10 for each referral' },
    { to:'/pay', icon:'💳', title:'Make Payment', desc:'Pay via Venmo or Zelle' },
    { to:'/reviews', icon:'⭐', title:'Reviews', desc:'See what customers say' },
  ];

  return (
    <div className="container" style={{ maxWidth:800, padding:'2rem 1rem' }}>
      <div className="page-header">
        <h1>👋 Welcome, {user?.name?.split(' ')[0]}!</h1>
        <p>Your Snow Bro's client portal.</p>
      </div>

      {/* Prominent Book Service CTA */}
      <div className="card mb-2" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)', color: '#fff', borderRadius: 12, padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>📅 Need a Service?</h2>
            <p style={{ margin: '.4rem 0 0', opacity: .9, fontSize: '.92rem' }}>Book lawn care or snow removal — no contract required.</p>
          </div>
          <Link to="/client/book" style={{ background: '#fff', color: '#1e3a5f', padding: '.75rem 1.5rem', borderRadius: 8, textDecoration: 'none', fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
            Book Now →
          </Link>
        </div>
      </div>

      {pending > 0 && (
        <div className="alert alert-info mb-2">
          📄 You have <strong>{pending}</strong> contract{pending > 1 ? 's' : ''} awaiting your signature.{' '}
          <Link to="/client/contracts">Review & Sign →</Link>
        </div>
      )}

      {/* ETA Widget */}
      <div className="card mb-2" style={{ borderLeft: '4px solid var(--blue-600)', background: '#f0f7ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>{eta?.session_active ? '📍' : '🕒'}</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--blue-800)' }}>
              {eta?.session_active ? 'Live Service Schedule' : 'Service Schedule'}
            </h3>
            {etaLoading ? (
              <p style={{ margin: 0, fontSize: '.9rem', color: 'var(--gray-500)' }}>Checking today's schedule...</p>
            ) : eta?.found ? (
              <div>
                {eta.eta_window_start && eta.eta_window_end ? (
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue-900)' }}>
                    Estimated arrival: {eta.eta_window_start} — {eta.eta_window_end}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue-900)' }}>
                    Estimated arrival: {eta.refined_eta || eta.eta}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '.5rem', fontSize: '.85rem', color: 'var(--blue-700)', flexWrap: 'wrap' }}>
                  <span>{eta.snow_day ? '❄️ Snow Removal' : '🌱 Lawn Care'}</span>
                  <span>•</span>
                  <span>Stop #{eta.stop_number} of {eta.total_stops || '?'}</span>
                  {eta.stops_ahead !== undefined && (
                    <>
                      <span>•</span>
                      <span>{eta.stops_ahead} stop{eta.stops_ahead !== 1 ? 's' : ''} ahead</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{eta.route_name}</span>
                </div>
                {eta.session_active && (
                  <div style={{ marginTop: '.5rem', padding: '.4rem .6rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 4, fontSize: '.8rem', color: '#166534', fontWeight: 600 }}>
                    ✓ Live GPS tracking active — ETA updates every 2-3 minutes
                  </div>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '.9rem', color: 'var(--gray-600)' }}>
                {eta?.message || 'No service scheduled today'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'1rem' }}>
        {cards.map(c => (
          <Link key={c.to} to={c.to} style={{ textDecoration:'none' }}>
            <div className="card" style={{ textAlign:'center', cursor:'pointer', height:'100%' }}>
              <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>{c.icon}</div>
              <div style={{ fontWeight:700 }}>{c.title}</div>
              <div style={{ fontSize:'.85rem', color:'var(--gray-500)', marginTop:'.25rem' }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
