import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminRecurring() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ client_id:'', service_id:'', frequency:'weekly', preferred_day:'Monday', preferred_time:'09:00', start_date:'', end_date:'', notes:'' });

  const load = () => {
    api.get('/recurring').then(r => setItems(r.data)).catch(() => {});
    api.get('/clients').then(r => setClients(r.data)).catch(() => {});
    api.get('/services').then(r => setServices(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const create = async e => {
    e.preventDefault();
    try {
      await api.post('/recurring', form);
      setMsg({ type:'success', text:'Recurring service created!' });
      setShowForm(false);
      setForm({ client_id:'', service_id:'', frequency:'weekly', preferred_day:'Monday', preferred_time:'09:00', start_date:'', end_date:'', notes:'' });
      load();
    } catch (err) { setMsg({ type:'error', text: err.response?.data?.error || 'Failed' }); }
  };

  const generate = async () => {
    try {
      const { data } = await api.post('/recurring/generate');
      setMsg({ type:'success', text: data.message });
      load();
    } catch (e) { setMsg({ type:'error', text:'Failed to generate' }); }
  };

  const toggle = async (id, active) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    try {
      await api.put(`/recurring/${id}`, { ...item, active: active ? 1 : 0 });
      load();
    } catch (e) {}
  };

  const remove = async (id) => {
    if (!confirm('Delete this recurring service?')) return;
    try { await api.delete(`/recurring/${id}`); load(); } catch (e) {}
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'.75rem' }}>
          <div>
            <h1>🔄 Recurring Services</h1>
            <p>Set up weekly, bi-weekly, or monthly recurring service schedules.</p>
          </div>
          <div style={{ display:'flex', gap:'.5rem' }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Recurring</button>
            <button className="btn btn-secondary" onClick={generate}>⚡ Generate Due Bookings</button>
          </div>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom:'1rem' }}>{msg.text}</div>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Service</th><th>Frequency</th><th>Day / Time</th><th>Next Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No recurring services</td></tr>}
              {items.map(i => (
                <tr key={i.id}>
                  <td><strong>{i.client_name}</strong></td>
                  <td>{i.service_name}</td>
                  <td style={{ textTransform:'capitalize' }}>{i.frequency}</td>
                  <td>{i.preferred_day} {i.preferred_time}</td>
                  <td>{i.next_date}</td>
                  <td>{i.active ? <span className="badge badge-blue">Active</span> : <span className="badge badge-gray">Paused</span>}</td>
                  <td style={{ display:'flex', gap:'.3rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggle(i.id, !i.active)}>{i.active ? 'Pause' : 'Resume'}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => remove(i.id)} style={{ color:'#dc2626' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth:500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔄 New Recurring Service</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={create}>
                <div className="form-group">
                  <label>Client</label>
                  <select name="client_id" value={form.client_id} onChange={handle} className="form-control" required>
                    <option value="">Select client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Service</label>
                  <select name="service_id" value={form.service_id} onChange={handle} className="form-control" required>
                    <option value="">Select service</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
                  <div className="form-group">
                    <label>Frequency</label>
                    <select name="frequency" value={form.frequency} onChange={handle} className="form-control">
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Preferred Day</label>
                    <select name="preferred_day" value={form.preferred_day} onChange={handle} className="form-control">
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'.75rem' }}>
                  <div className="form-group"><label>Start Date</label><input type="date" name="start_date" value={form.start_date} onChange={handle} className="form-control" required /></div>
                  <div className="form-group"><label>End Date (opt)</label><input type="date" name="end_date" value={form.end_date} onChange={handle} className="form-control" /></div>
                  <div className="form-group"><label>Time</label><input type="time" name="preferred_time" value={form.preferred_time} onChange={handle} className="form-control" /></div>
                </div>
                <div className="form-group"><label>Notes</label><textarea name="notes" value={form.notes} onChange={handle} className="form-control" rows={2} /></div>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Recurring Service</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
