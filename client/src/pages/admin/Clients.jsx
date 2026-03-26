import { useState, useEffect } from 'react';
import api from '../../utils/api';

const EMPTY = { first_name:'', last_name:'', email:'', phone:'', address:'', city:'', state:'', zip:'', notes:'', password:'' };

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | client obj
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/clients').then(r => setClients(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setModal('add'); setMsg(null); };
  const openEdit = c  => { setForm({ ...c, password: '' }); setModal(c); setMsg(null); };
  const close    = () => { setModal(null); setMsg(null); };
  const handle   = e  => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const save = async e => {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      if (modal === 'add') await api.post('/clients', form);
      else await api.put(`/clients/${modal.id}`, form);
      await load(); close();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error saving client');
    } finally { setLoading(false); }
  };

  const del = async id => {
    if (!confirm('Delete this client?')) return;
    await api.delete(`/clients/${id}`).catch(() => {});
    load();
  };

  const filtered = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex-between page-header">
        <div><h1>👥 Clients</h1><p>Manage your client list.</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Client</button>
      </div>

      <div className="card mb-2">
        <input className="form-control" placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Since</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No clients found</td></tr>}
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.first_name} {c.last_name}</strong></td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.city}{c.state ? `, ${c.state}` : ''}</td>
                  <td style={{ color:'var(--gray-400)', fontSize:'.8rem' }}>{c.created_at?.slice(0,10)}</td>
                  <td>
                    <div style={{ display:'flex', gap:'.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(c.id)}>Del</button>
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
              <h2>{modal === 'add' ? 'Add Client' : 'Edit Client'}</h2>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <div className="modal-body">
              {msg && <div className="alert alert-error">{msg}</div>}
              <form onSubmit={save}>
                <div className="form-row">
                  <div className="form-group"><label>First Name *</label><input name="first_name" value={form.first_name} onChange={handle} required className="form-control" /></div>
                  <div className="form-group"><label>Last Name *</label><input name="last_name" value={form.last_name} onChange={handle} required className="form-control" /></div>
                </div>
                <div className="form-group"><label>Email *</label><input type="email" name="email" value={form.email} onChange={handle} required className="form-control" /></div>
                <div className="form-group"><label>Phone</label><input name="phone" value={form.phone} onChange={handle} className="form-control" /></div>
                <div className="form-group"><label>Address</label><input name="address" value={form.address} onChange={handle} className="form-control" /></div>
                <div className="form-row">
                  <div className="form-group"><label>City</label><input name="city" value={form.city} onChange={handle} className="form-control" /></div>
                  <div className="form-group"><label>State</label><input name="state" value={form.state} onChange={handle} className="form-control" /></div>
                </div>
                <div className="form-group"><label>ZIP</label><input name="zip" value={form.zip} onChange={handle} className="form-control" /></div>
                <div className="form-group"><label>Notes</label><textarea name="notes" value={form.notes} onChange={handle} className="form-control" /></div>
                {modal === 'add' && <div className="form-group"><label>Password (optional)</label><input type="password" name="password" value={form.password} onChange={handle} className="form-control" /></div>}
                <div className="modal-footer" style={{ padding:0, border:0, marginTop:'1rem' }}>
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
