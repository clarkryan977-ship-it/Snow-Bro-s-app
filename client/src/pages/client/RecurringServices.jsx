import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function ClientRecurringServices() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ service_id:'', frequency:'weekly', preferred_day:'Monday', preferred_time:'09:00', start_date:'', end_date:'', notes:'' });

  useEffect(() => {
    api.get('/recurring/my').then(r => setItems(r.data)).catch(() => {});
    api.get('/services').then(r => setServices(r.data)).catch(() => {});
  }, []);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const create = async e => {
    e.preventDefault();
    try {
      await api.post('/recurring', form);
      setMsg({ type:'success', text:'Recurring service set up! We\'ll take care of the rest.' });
      setShowForm(false);
      setForm({ service_id:'', frequency:'weekly', preferred_day:'Monday', preferred_time:'09:00', start_date:'', end_date:'', notes:'' });
      api.get('/recurring/my').then(r => setItems(r.data));
    } catch (err) { setMsg({ type:'error', text: err.response?.data?.error || 'Failed' }); }
  };

  return (
    <div style={{ maxWidth:700, margin:'0 auto', padding:'1.5rem 1rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'.75rem' }}>
        <div>
          <h1 style={{ fontSize:'1.5rem', fontWeight:700 }}>🔄 Recurring Services</h1>
          <p style={{ color:'var(--gray-500)', fontSize:'.88rem' }}>Set up automatic recurring service schedules.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Set Up Recurring</button>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom:'1rem' }}>{msg.text}</div>}

      {items.length === 0 && !showForm && (
        <div className="card text-center" style={{ padding:'3rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>🔄</div>
          <p style={{ color:'var(--gray-500)' }}>No recurring services set up yet.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ marginTop:'1rem' }}>Set Up Your First</button>
        </div>
      )}

      {items.map(i => (
        <div key={i.id} className="card" style={{ marginBottom:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'.5rem' }}>
            <div>
              <strong>{i.service_name}</strong>
              <span style={{ marginLeft:'.5rem', fontSize:'.82rem', color:'var(--gray-500)', textTransform:'capitalize' }}>({i.frequency})</span>
            </div>
            <span className={`badge badge-${i.active ? 'blue' : 'gray'}`}>{i.active ? 'Active' : 'Paused'}</span>
          </div>
          <div style={{ fontSize:'.85rem', color:'var(--gray-600)', marginTop:'.25rem' }}>
            {i.preferred_day}s at {i.preferred_time} · Next: {i.next_date}
          </div>
          {i.service_price && <div style={{ fontSize:'.85rem', color:'var(--blue-700)', fontWeight:600, marginTop:'.25rem' }}>${i.service_price}/visit</div>}
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth:500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔄 Set Up Recurring Service</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={create}>
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
                <div className="form-group"><label>Notes</label><textarea name="notes" value={form.notes} onChange={handle} className="form-control" rows={2} placeholder="Any special instructions..." /></div>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Set Up Recurring</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
