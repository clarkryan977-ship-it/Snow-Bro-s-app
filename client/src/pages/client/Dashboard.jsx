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
    
    // Initial load
    loadEta().then(() => setEtaLoading(false));
    
    // Poll every 2-3 minutes for live updates
    etaPollRef.current = setInterval(loadEta, 150000); // 2.5 minutes
    
    return () => {
      if (etaPollRef.current) clearInterval(etaPollRef.current);
    };
  }, []);

  const pending = contracts.filter(c => c.status !== 'signed').length;

  const cards = [
    { to:'/client/history', icon:'📋', title:'Service History', desc:'View past jobs and leave reviews' },
    { to:'/client/contracts', icon:'📄', title:'Contracts', desc:'View and sign your contracts' },
    { to:'/client/invoices', icon:'🧾', title:'Invoices', desc:'View and pay your invoices' },
    { to:'/client/recurring', icon:'🔄', title:'Recurring Services', desc:'Set up automatic scheduling' },
    { to:'/client/referrals', icon:'🎁', title:'Refer a Friend', desc:'Earn $10 for each referral' },
    { to:'/pay', icon:'💳', title:'Make Payment', desc:'Pay via Venmo or Zelle' },
    { to:'/book', icon:'📅', title:'Book Service', desc:'Schedule a new service' },
    { to:'/reviews', icon:'⭐', title:'Reviews', desc:'See what customers say' },
  ];

  return (
    <div className="container" style={{ maxWidth:800, padding:'2rem 1rem' }}>
      <div className="page-header">
        <h1>👋 Welcome, {user?.name?.split(' ')[0]}!</h1>
        <p>Your Snow Bro's client portal.</p>
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
                <div style={{ display: 'flex', gap: '1rem', marginTop: '.5rem', fontSize: '.85rem', color: 'var(--blue-700)' }}>
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

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'1rem' }}>
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
