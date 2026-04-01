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

  const loadTouchUps = () => {
    api.get('/touchup?status=pending').then(r => setTouchUps(r.data || [])).catch(() => {});
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
    const interval = setInterval(loadTouchUps, 60000); // refresh every minute
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
                  {new Date(t.created_at).toLocaleString()}
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
