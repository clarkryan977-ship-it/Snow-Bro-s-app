import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ clients: 0, bookings: 0, invoices: 0, employees: 0, contracts: 0 });

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
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>📊 Admin Dashboard</h1>
        <p>Welcome back! Here's an overview of your business.</p>
      </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {[
          { icon: '👥', title: 'Manage Clients',    desc: 'View, add, and edit client records.',       link: '/admin/clients' },
          { icon: '🧾', title: 'Create Invoice',     desc: 'Generate invoices for clients.',            link: '/admin/invoices' },
          { icon: '📄', title: 'Contracts',          desc: 'Upload and manage client contracts.',       link: '/admin/contracts' },
          { icon: '📍', title: 'GPS Tracking',       desc: 'See where your crew is right now.',         link: '/admin/gps' },
          { icon: '📧', title: 'Send Email Blast',   desc: 'Promote services to your client list.',     link: '/admin/emails' },
          { icon: '⚙️', title: 'Manage Services',    desc: 'Add or edit services in the booking form.', link: '/admin/services' },
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
