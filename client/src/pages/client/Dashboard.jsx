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
    pollRef.current = setInterval(load, 60000);
    return () => clearInterval(pollRef.current);
  }, [load]);

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
    crew_nearby, gps_distance_miles, gps_eta_minutes, gps_updated_at,
    live_session_active, snow_condition,
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

  // ── GPS NEARBY (within 0.5 miles) ────────────────────────────────
  if (crew_nearby && gps_distance_miles !== null) {
    const distLabel = gps_distance_miles < 0.1
      ? 'right around the corner'
      : `${gps_distance_miles} miles away`;
    return (
      <div style={widgetStyle('#7c2d12', '#dc2626')}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🚨</div>
        <div style={{ color: '#fbbf24', fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
          Your crew is nearby!
        </div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 8 }}>
          {gps_eta_minutes !== null && gps_eta_minutes <= 2
            ? 'Arriving any minute!'
            : gps_eta_minutes !== null
              ? `Arrives around ${minsToClockTime(gps_eta_minutes)} (${distLabel})`
              : `Crew is ${distLabel}`}
        </div>
        {gps_updated_at && (
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 8 }}>
            📍 GPS updated {formatTimeAgo(gps_updated_at)}
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 4 }}>
          Stop {stop_number} of {total_stops} · {route_name}
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
          {route_type === 'snow' ? 'Your driveway is NEXT!' : "You're the next stop!"}
        </div>
        {gps_eta_minutes !== null && live_session_active ? (
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginTop: 8 }}>
            Arrives around {minsToClockTime(gps_eta_minutes)}
          </div>
        ) : (
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginTop: 8 }}>
            Arrives around {etaTime}
          </div>
        )}
        {gps_distance_miles !== null && (
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 14, marginTop: 4 }}>
            📍 Crew is {gps_distance_miles} miles away
          </div>
        )}
        {eta_window && !gps_eta_minutes && (
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

  // ── 1 STOP AHEAD ─────────────────────────────────────────────────
  if (stops_ahead === 1) {
    const clockTime1 = gps_eta_minutes !== null && live_session_active
      ? minsToClockTime(gps_eta_minutes)
      : etaTime;
    return (
      <div style={widgetStyle('#1e3a5f', '#2d4f7c')}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>❄️</div>
        <div style={{ color: '#fff', fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>
          1 stop ahead of you
        </div>
        <div style={{ color: '#93c5fd', fontSize: 24, fontWeight: 800, marginTop: 6 }}>
          Arrives around {clockTime1}
        </div>
        {gps_distance_miles !== null && (
          <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, marginTop: 4 }}>
            📍 Crew is {gps_distance_miles} miles away
          </div>
        )}
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

  // ── MULTIPLE STOPS AHEAD ──────────────────────────────────────────
  const clockTimeMulti = gps_eta_minutes !== null && live_session_active
    ? minsToClockTime(gps_eta_minutes)
    : etaTime;
  return (
    <div style={widgetStyle('#1e3a5f', '#2d4f7c')}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>❄️</div>
      <div style={{ color: '#fff', fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>
        {stops_ahead} stops ahead of you
      </div>
      <div style={{ color: '#93c5fd', fontSize: 22, fontWeight: 800, marginTop: 6 }}>
        Arrives around {clockTimeMulti}
      </div>
      {gps_distance_miles !== null && (
        <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, marginTop: 4 }}>
          📍 Crew is {gps_distance_miles} miles away
          {snow_condition && ` · ${snow_condition} conditions`}
        </div>
      )}
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

function minsToClockTime(minutes) {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatTimeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Math.round((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Touch-Up Request Modal ───────────────────────────────────────────────────
function TouchUpModal({ onClose }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/touchup', { note });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '28px 24px',
        maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: '0 0 8px', color: '#14532d', fontSize: '1.3rem' }}>Request Sent!</h2>
            <p style={{ color: '#374151', fontSize: 14, margin: '0 0 20px' }}>
              We've been notified and will follow up with you shortly.
            </p>
            <button
              onClick={onClose}
              style={{
                background: '#1e3a5f', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 28px', fontSize: 15,
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e3a5f' }}>🔁 Request a Touch-Up</h2>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}
              >×</button>
            </div>
            <p style={{ color: '#374151', fontSize: 14, margin: '0 0 14px' }}>
              Did we miss a spot? Need a re-plow or touch-up? Let us know and we'll get back to you.
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Describe what needs attention (e.g. missed back driveway, need re-plow after city plow came through)..."
              rows={4}
              style={{
                width: '100%', borderRadius: 8, border: '1px solid #d1d5db',
                padding: '10px 12px', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, background: '#f1f5f9', color: '#374151', border: 'none',
                  borderRadius: 8, padding: '10px 0', fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 2, background: '#1e3a5f', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '10px 0', fontSize: 14,
                  fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Sending…' : 'Submit Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [showTouchUp, setShowTouchUp] = useState(false);

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

      {/* ETA Widget */}
      <EtaWidget />

      {/* Touch-Up Request Button */}
      <button
        onClick={() => setShowTouchUp(true)}
        style={{
          width: '100%', background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
          color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px',
          fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 4px 14px rgba(30,58,95,.3)',
        }}
      >
        <span style={{ fontSize: 20 }}>🔁</span>
        Request a Touch-Up
        <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>— missed spot, re-plow, etc.</span>
      </button>

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

      {/* Touch-Up Modal */}
      {showTouchUp && <TouchUpModal onClose={() => setShowTouchUp(false)} />}
    </div>
  );
}
