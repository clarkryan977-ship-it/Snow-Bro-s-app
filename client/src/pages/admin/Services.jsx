import { useState, useEffect } from 'react';
import api from '../../utils/api';

const EMPTY = { name:'', description:'', price:0, starting_price:'', active:1 };

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/services/all').then(r => setServices(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setModal('add'); setMsg(null); };
  const openEdit = s  => { setForm(s); setModal(s); setMsg(null); };
  const close    = () => { setModal(null); setMsg(null); };
  const handle   = e  => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const save = async e => {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      if (modal === 'add') await api.post('/services', form);
      else await api.put(`/services/${modal.id}`, form);
      await load(); close();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error saving service');
    } finally { setLoading(false); }
  };

  const deactivate = async id => {
    if (!confirm('Deactivate this service?')) return;
    await api.delete(`/services/${id}`).catch(() => {});
    load();
  };

  return (
    <div>
      <div className="flex-between page-header">
        <div><h1>⚙️ Services</h1><p>Manage the services available in the booking form.</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Service</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Service</th><th>Description</th><th>Price</th><th>Starting Price</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td style={{ color:'var(--gray-500)', fontSize:'.88rem' }}>{s.description}</td>
                  <td>${Number(s.price).toFixed(2)}</td>
                  <td style={{ fontWeight: 600, color: '#16a34a' }}>{s.starting_price ? `Starting at ${s.starting_price}` : '—'}</td>
                  <td><span className={`badge ${s.active ? 'badge-green' : 'badge-gray'}`}>{s.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:'.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                      {s.active ? <button className="btn btn-danger btn-sm" onClick={() => deactivate(s.id)}>Deactivate</button>
                        : <button className="btn btn-outline btn-sm" onClick={() => { api.put(`/services/${s.id}`, { ...s, active:1 }); load(); }}>Activate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Add Service' : 'Edit Service'}</h2>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <div className="modal-body">
              {msg && <div className="alert alert-error">{msg}</div>}
              <form onSubmit={save}>
                <div className="form-group"><label>Service Name *</label><input name="name" value={form.name} onChange={handle} required className="form-control" /></div>
                <div className="form-group"><label>Description</label><textarea name="description" value={form.description} onChange={handle} className="form-control" /></div>
                <div className="form-row">
                  <div className="form-group"><label>Internal Price ($)</label><input type="number" name="price" value={form.price} onChange={handle} min="0" step="0.01" className="form-control" /></div>
                  <div className="form-group"><label>Public Starting Price (e.g. $65)</label><input name="starting_price" value={form.starting_price} onChange={handle} placeholder="$65" className="form-control" /></div>
                </div>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
