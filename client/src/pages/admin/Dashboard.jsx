import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import ClockWidget from '../../components/ClockWidget';
import DispatchMap from '../../components/DispatchMap';
import { subscribeToPush } from '../../utils/pushNotifications';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ clients: 0, bookings: 0, invoices: 0, employees: 0, contracts: 0 });
  const [pushStatus, setPushStatus] = useState(null); // null | 'subscribed' | 'denied' | 'unsupported'
  const [touchUps, setTouchUps] = useState([]);
  const [dismissedTouchUps, setDismissedTouchUps] = useState(new Set());
  const [activeRoutes, setActiveRoutes] = useState([]);

  const loadTouchUps = () => {
    api.get('/touchup?status=pending').then(r => setTouchUps(r.data || [])).catch(() => {});
  };

  const loadActiveRoutes = () => {
    // Fetch today's routes that have at least one stop (active/in-progress)
    const today = new Date().toISOString().slice(0, 10);
    api.get(`/routes?date=${today}`).then(r => {
      const routes = (r.data || []).filter(rt => rt.stop_count > 0);
      setActiveRoutes(routes);
    }).catch(() => {});
  };

  const handleAckTouchUp = async (id) => {
    try {
      await api.put(`/touchup/${id}/status`, { status: 'acknowledged' });
      setDismissedTouchUps(prev => new Set([...prev, id]));
      loadTouchUps();
    } catch { alert('Failed to acknowledge request'); }
  };

  useEffect(() => {
    loadTouchUps();
    loadActiveRoutes();
    const interval = setInterval(() => { loadTouchUps(); loadActiveRoutes(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/clients'),
      api.get('/bookings'),
      api.get('/invoices'),
      api.get('/employees'),
      api.get('/contracts'),
    ]).then(([c, b, i, e, ct]) => {
      setStats({
        clients: c.data.length,
        bookings: b.data.length,
        invoices: i.data.length,
        employees: e.data.length,
        contracts: ct.data.length,
      });
    }).catch(() => {});

    // Auto-subscribe to push notifications (silently on first visit)
    if (!('Notification' in window)) {
      setPushStatus('unsupported');
    } else if (Notification.permission === 'granted') {
      subscribeToPush().then(ok => setPushStatus(ok ? 'subscribed' : 'denied'));
    } else if (Notification.permission !== 'denied') {
      setPushStatus('prompt'); // Show the enable button
    } else {
      setPushStatus('denied');
    }
  }, []);

  const handleEnablePush = async () => {
    const ok = await subscribeToPush();
    setPushStatus(ok ? 'subscribed' : 'denied');
  };

  return (
    <div>
      <div className="page-header">
        <h1>📊 Admin Dashboard</h1>
        <p>Welcome back! Here's an overview of your business.</p>
      </div>

      {/* ── Touch-Up Request Alerts ── */}
      {touchUps.filter(t => !dismissedTouchUps.has(t.id)).length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          {touchUps.filter(t => !dismissedTouchUps.has(t.id)).map(t => (
            <div key={t.id} style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#fff', borderRadius: 10, padding: '1rem 1.25rem',
              marginBottom: '.75rem', display: 'flex', alignItems: 'flex-start',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem',
              boxShadow: '0 2px 8px rgba(220,38,38,.3)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>🔧 Touch-Up Request</div>
                <div style={{ fontSize: '.9rem', marginTop: 4, fontWeight: 600 }}>
                  {t.client_name} — {t.client_address || 'Address on file'}
                </div>
                {t.note && <div style={{ fontSize: '.85rem', opacity: .9, marginTop: 4 }}>Note: {t.note}</div>}
                <div style={{ fontSize: '.75rem', opacity: .75, marginTop: 4 }}>
                  {new Date(t.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} CT
                </div>
              </div>
              <button
                onClick={() => handleAckTouchUp(t.id)}
                style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem', whiteSpace: 'nowrap' }}
              >✓ Acknowledge</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Push Notification Banner ── */}
      {pushStatus === 'prompt' && (
        <div style={{
          background: 'linear-gradient(135deg, #1e40af, #1d4ed8)',
          color: '#fff',
          borderRadius: 10,
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '.75rem',
          boxShadow: '0 2px 8px rgba(30,64,175,.3)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>🔔 Enable Push Notifications</div>
            <div style={{ fontSize: '.85rem', opacity: .9, marginTop: 2 }}>
              Get instant alerts when clients book services or submit estimate requests.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button
              className="btn"
              style={{ background: '#fff', color: '#1e40af', fontWeight: 700, fontSize: '.9rem' }}
              onClick={handleEnablePush}
            >
              Enable Notifications
            </button>
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: '.85rem' }}
              onClick={() => setPushStatus('dismissed')}
            >
              Not Now
            </button>
          </div>
        </div>
      )}
      {pushStatus === 'subscribed' && (
        <div style={{
          background: '#dcfce7', color: '#14532d', borderRadius: 8,
          padding: '.6rem 1rem', marginBottom: '1rem', fontSize: '.85rem', fontWeight: 600,
          border: '1px solid #86efac',
        }}>
          ✅ Push notifications are active — you'll be alerted for new bookings and estimates.
        </div>
      )}

      {/* ── Clock In / Out Widget ── */}
      <ClockWidget />

      {/* ── Live Dispatch Map ── */}
      <DispatchMap />

      {/* ── Active Routes Widget ── */}
      {activeRoutes.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '.75rem' }}>
            🚦 Today's Routes
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '.75rem' }}>
            {activeRoutes.map(rt => {
              const pct = rt.stop_count > 0 ? Math.round((rt.completed_count / rt.stop_count) * 100) : 0;
              const allDone = rt.completed_count === rt.stop_count && rt.stop_count > 0;
              const inProgress = rt.completed_count > 0 && !allDone;
              return (
                <Link key={rt.id} to={`/admin/routes?routeId=${rt.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: allDone ? '#f0fdf4' : inProgress ? '#eff6ff' : '#fff',
                    border: `1.5px solid ${allDone ? '#86efac' : inProgress ? '#93c5fd' : '#e5e7eb'}`,
                    borderRadius: '12px', padding: '1rem', cursor: 'pointer',
                    transition: 'box-shadow .15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#1e3a5f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {rt.name}
                        </div>
                        <div style={{ fontSize: '.75rem', color: '#6b7280', marginTop: '2px' }}>
                          {new Date(rt.route_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' · '}{(rt.type || 'snow').toUpperCase()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', shrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: allDone ? '#16a34a' : '#1d4ed8' }}>
                          {rt.completed_count}/{rt.stop_count}
                        </div>
                        <div style={{ fontSize: '.7rem', color: '#9ca3af' }}>stops</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: '.75rem', height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px', transition: 'width .3s',
                        background: allDone ? '#22c55e' : '#3b82f6',
                        width: `${pct}%`,
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '.7rem', color: '#9ca3af' }}>
                      <span>{allDone ? '✅ Complete' : inProgress ? '🟡 In Progress' : '⏳ Not started'}</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="stats-grid">
        {[
          { value: stats.clients,   label: 'Total Clients',   link: '/admin/clients' },
          { value: stats.bookings,  label: 'Bookings',        link: '/admin/bookings' },
          { value: stats.invoices,  label: 'Invoices',        link: '/admin/invoices' },
          { value: stats.contracts, label: 'Contracts',       link: '/admin/contracts' },
          { value: stats.employees, label: 'Employees',       link: '/admin/employees' },
        ].map(s => (
          <Link key={s.label} to={s.link} style={{ textDecoration: 'none' }}>
            <div className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {[
          { icon: '👥', title: 'Manage Clients',    desc: 'View, add, and edit client records.',       link: '/admin/clients' },
          { icon: '🧾', title: 'Create Invoice',     desc: 'Generate invoices for clients.',            link: '/admin/invoices' },
          { icon: '📄', title: 'Contracts',          desc: 'Upload and manage client contracts.',       link: '/admin/contracts' },
          { icon: '📍', title: 'GPS Tracking',       desc: 'See where your crew is right now.',         link: '/admin/gps' },
          { icon: '📧', title: 'Send Email Blast',   desc: 'Promote services to your client list.',     link: '/admin/emails' },
          { icon: '⚙️', title: 'Manage Services',    desc: 'Add or edit services in the booking form.', link: '/admin/services' },
          { icon: '💰', title: 'Payroll',            desc: 'View hours worked and calculate pay.',      link: '/admin/payroll' },
          { icon: '🗓️', title: 'Availability',       desc: 'Block or open dates for booking.',          link: '/admin/availability' },
          { icon: '📁', title: 'Employee Docs',      desc: 'View uploaded HR documents and IDs.',       link: '/admin/documents' },
        ].map(c => (
          <Link key={c.title} to={c.link} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow .15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}>
              <div style={{ fontSize: '1.8rem', marginBottom: '.5rem' }}>{c.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>{c.title}</div>
              <div style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
