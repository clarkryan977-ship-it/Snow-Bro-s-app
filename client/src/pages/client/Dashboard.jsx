import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

// ─── ETA Widget ───────────────────────────────────────────────────────────────
function EtaWidget() {
  const [eta, setEta] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/routes/my-eta');
      setEta(r.data);
    } catch {
      setEta({ found: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 60000); // refresh every 60 seconds
    return () => clearInterval(pollRef.current);
  }, [load]);

  // ── Determine display state ──────────────────────────────────────
  if (loading) {
    return (
      <div style={widgetStyle('#1e3a5f', '#2d4f7c')}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>❄️</div>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 15 }}>Checking today's route…</div>
      </div>
    );
  }

  if (!eta || !eta.found) {
    return (
      <div style={widgetStyle('#374151', '#4b5563')}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>🗓️</div>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>No service scheduled today</div>
        <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, marginTop: 4 }}>
          {eta?.message || 'Check back on your next service day.'}
        </div>
      </div>
    );
  }

  const {
    my_stop_completed, all_done, stops_ahead, eta: etaTime,
    eta_window, stop_number, total_stops, route_name, route_type,
    minutes_per_stop,
  } = eta;

  // ── DONE ────────────────────────────────────────────────────────
  if (my_stop_completed || all_done) {
    return (
      <div style={widgetStyle('#14532d', '#166534')}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
          Your {route_type === 'snow' ? 'driveway has been cleared!' : 'service is complete!'}
        </div>
        <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 14, marginTop: 8 }}>
          {route_name && `Route: ${route_name}`}
        </div>
        <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 4 }}>
          This page refreshes automatically.
        </div>
      </div>
    );
  }

  // ── NEXT STOP ────────────────────────────────────────────────────
  if (stops_ahead === 0) {
    return (
      <div style={widgetStyle('#1e3a5f', '#1d4ed8')}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🚨</div>
        <div style={{ color: '#fbbf24', fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
          {route_type === 'snow' ? 'Your driveway is NEXT!' : 'You\'re the next stop!'}
        </div>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginTop: 8 }}>
          Arriving ~{etaTime}
        </div>
        {eta_window && (
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginTop: 4 }}>
            Window: {eta_window}
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 8 }}>
          Stop {stop_number} of {total_stops} · {route_name}
        </div>
      </div>
    );
  }

  // ── 1 STOP AHEAD ────────────────────────────────────────────────
  if (stops_ahead === 1) {
    const minAway = minutes_per_stop || 15;
    return (
      <div style={widgetStyle('#1e3a5f', '#2d4f7c')}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>❄️</div>
        <div style={{ color: '#fff', fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>
          1 stop ahead of you
        </div>
        <div style={{ color: '#93c5fd', fontSize: 24, fontWeight: 800, marginTop: 6 }}>
          About {minAway} min away
        </div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 4 }}>
          Estimated arrival: {etaTime}
        </div>
        {eta_window && (
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 4 }}>
            Window: {eta_window}
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 8 }}>
          Stop {stop_number} of {total_stops} · {route_name}
        </div>
      </div>
    );
  }

  // ── MULTIPLE STOPS AHEAD ─────────────────────────────────────────
  const minAway = (stops_ahead * (minutes_per_stop || 15));
  const hrAway  = minAway >= 60 ? `${Math.floor(minAway / 60)}h ${minAway % 60}m` : `${minAway} min`;
  return (
    <div style={widgetStyle('#1e3a5f', '#2d4f7c')}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>❄️</div>
      <div style={{ color: '#fff', fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>
        {stops_ahead} stops ahead of you
      </div>
      <div style={{ color: '#93c5fd', fontSize: 22, fontWeight: 800, marginTop: 6 }}>
        About {hrAway} away
      </div>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 4 }}>
        Estimated arrival: {etaTime}
      </div>
      {eta_window && (
        <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 4 }}>
          Window: {eta_window}
        </div>
      )}
      <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 8 }}>
        Stop {stop_number} of {total_stops} · {route_name}
      </div>
      <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginTop: 4 }}>
        Updates every 60 seconds
      </div>
    </div>
  );
}

function widgetStyle(bg1, bg2) {
  return {
    background: `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`,
    borderRadius: 16,
    padding: '28px 24px',
    textAlign: 'center',
    marginBottom: 20,
    boxShadow: '0 4px 20px rgba(0,0,0,.18)',
  };
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    api.get('/contracts/my').then(r => setContracts(r.data)).catch(() => {});
  }, []);

  const pending = contracts.filter(c => c.status !== 'signed').length;

  const cards = [
    { to: '/client/book',      icon: '📅', title: 'Book a Service',     desc: 'Schedule lawn care or snow removal' },
    { to: '/client/history',   icon: '📋', title: 'Service History',    desc: 'View past jobs and photos' },
    { to: '/client/invoices',  icon: '🧾', title: 'Invoices',           desc: 'View and pay your invoices' },
    { to: '/client/recurring', icon: '🔄', title: 'Recurring Services', desc: 'Set up automatic scheduling' },
    { to: '/client/contracts', icon: '📄', title: 'Contracts',          desc: 'View and sign your contracts' },
    { to: '/client/referrals', icon: '🎁', title: 'Refer a Friend',     desc: 'Earn $10 for each referral' },
    { to: '/pay',              icon: '💳', title: 'Make Payment',       desc: 'Pay via Venmo or Zelle' },
    { to: '/reviews',          icon: '⭐', title: 'Reviews',            desc: 'See what customers say' },
  ];

  return (
    <div className="container" style={{ maxWidth: 800, padding: '1.5rem 1rem' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#1e3a5f' }}>
          👋 Welcome, {user?.name?.split(' ')[0]}!
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Your Snow Bro's client portal</p>
      </div>

      {/* ETA Widget — always first, most prominent */}
      <EtaWidget />

      {/* Pending contracts alert */}
      {pending > 0 && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: 14,
        }}>
          📄 You have <strong>{pending}</strong> contract{pending > 1 ? 's' : ''} awaiting your signature.{' '}
          <Link to="/client/contracts" style={{ color: '#1e3a5f', fontWeight: 700 }}>Review & Sign →</Link>
        </div>
      )}

      {/* Quick links grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {cards.map(c => (
          <Link key={c.to} to={c.to} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: '18px 14px', textAlign: 'center', cursor: 'pointer',
              transition: 'box-shadow .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>{c.title}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
