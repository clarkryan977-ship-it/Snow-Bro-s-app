import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import BusinessHeader from '../../components/BusinessHeader';

export default function AdminContracts() {
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title:'', description:'', client_id:'' });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const load = () => {
    api.get('/contracts').then(r => setContracts(r.data)).catch(() => {});
    api.get('/clients').then(r => setClients(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const upload = async e => {
    e.preventDefault();
    if (!file) return setMsg('Please select a file');
    setLoading(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('client_id', form.client_id);
      await api.post('/contracts/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      load(); setModal(false); setForm({ title:'', description:'', client_id:'' }); setFile(null);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Upload failed');
    } finally { setLoading(false); }
  };

  const del = async id => {
    if (!confirm('Delete this contract?')) return;
    await api.delete(`/contracts/${id}`).catch(() => {});
    load();
  };

  const downloadSigned = id => {
    window.open(`${window.location.origin}/api/contracts/${id}/signed-file`, '_blank', 'noopener');
  };

  const viewFile = id => {
    // Use absolute URL so the PWA service worker NavigationRoute does not
    // intercept this as a SPA navigation and serve index.html instead.
    window.open(`${window.location.origin}/api/contracts/${id}/view`, '_blank', 'noopener');
  };

  return (
    <div>
      <div className="flex-between page-header">
        <div><h1>📄 Contracts</h1><p>Upload and manage client contracts.</p></div>
        <button className="btn btn-primary" onClick={() => { setModal(true); setMsg(null); }}>+ Upload Contract</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Client</th><th>Status</th><th>Signed</th><th>Uploaded</th><th>Actions</th></tr></thead>
            <tbody>
              {contracts.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No contracts yet</td></tr>}
              {contracts.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight:600 }}>{c.title}</div>
                    <div style={{ fontSize:'.75rem', color:'var(--gray-400)' }}>{c.original_name}</div>
                  </td>
                  <td>
                    <div>{c.client_name}</div>
                    <div style={{ fontSize:'.75rem', color:'var(--gray-400)' }}>{c.client_email}</div>
                  </td>
                  <td>
                    <span className={`badge ${c.status === 'signed' ? 'badge-green' : 'badge-yellow'}`}>
                      {c.status === 'signed' ? '✅ Signed' : '⏳ Pending'}
                    </span>
                  </td>
                  <td>
                    {c.status === 'signed' ? (
                      <div>
                        <div style={{ fontSize:'.8rem', fontWeight:600 }}>{c.signer_name}</div>
                        <div style={{ fontSize:'.75rem', color:'var(--gray-400)' }}>{c.signed_at ? new Date(c.signed_at).toLocaleString() : ''}</div>
                      </div>
                    ) : <span style={{ color:'var(--gray-300)' }}>—</span>}
                  </td>
                  <td style={{ fontSize:'.8rem', color:'var(--gray-400)' }}>{c.created_at?.slice(0,10)}</td>
                  <td>
                    <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => viewFile(c.id)}>View</button>
                      {c.status === 'signed' && c.signed_file_path && (
                        <button className="btn btn-outline btn-sm" onClick={() => downloadSigned(c.id)}>⬇ Signed</button>
                      )}
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
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Upload Contract</h2><button className="modal-close" onClick={() => setModal(false)}>×</button></div>
            <BusinessHeader style={{ borderRadius: 0 }} />
            <div className="modal-body">
              {msg && <div className="alert alert-error">{msg}</div>}
              <form onSubmit={upload}>
                <div className="form-group">
                  <label>Contract Title *</label>
                  <input name="title" value={form.title} onChange={handle} required className="form-control" placeholder="e.g. 2024 Lawn Service Agreement" />
                </div>
                <div className="form-group">
                  <label>Assign to Client *</label>
                  <select name="client_id" value={form.client_id} onChange={handle} required className="form-control">
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Description (optional)</label>
                  <textarea name="description" value={form.description} onChange={handle} className="form-control" placeholder="Brief description of the contract…" />
                </div>
                <div className="form-group">
                  <label>Document File * <span style={{ color:'var(--gray-400)', fontWeight:400 }}>(PDF, DOC, DOCX, TXT, image — max 20 MB)</span></label>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} className="form-control" />
                </div>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Upload & Assign'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
