import { useState, useEffect } from 'react';
import api from '../../utils/api';

const STATUS_COLORS = { pending:'badge-yellow', confirmed:'badge-green', completed:'badge-blue', cancelled:'badge-red' };

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');

  const load = () => api.get('/bookings').then(r => setBookings(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await api.put(`/bookings/${id}`, { status }).catch(() => {});
    load();
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  return (
    <div>
      <div className="page-header">
        <h1>📅 Bookings</h1>
        <p>Manage incoming service requests.</p>
      </div>

      <div className="card mb-2" style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
        {['all','pending','confirmed','completed','cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform:'capitalize' }}>{s}</button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No bookings</td></tr>}
              {filtered.map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight:600 }}>{b.display_name}</div>
                    <div style={{ fontSize:'.78rem', color:'var(--gray-400)' }}>{b.display_email}</div>
                  </td>
                  <td>{b.service_name}</td>
                  <td>{b.preferred_date}</td>
                  <td>{b.preferred_time || '—'}</td>
                  <td><span className={`badge ${STATUS_COLORS[b.status] || 'badge-gray'}`}>{b.status}</span></td>
                  <td>
                    <select className="form-control" style={{ fontSize:'.8rem', padding:'.25rem .5rem', width:'auto' }}
                      value={b.status} onChange={e => setStatus(b.id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
