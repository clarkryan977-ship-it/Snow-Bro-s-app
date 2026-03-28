import { useState, useEffect } from 'react';
import api from '../../utils/api';

const EMPTY = { first_name:'', last_name:'', email:'', phone:'', address:'', city:'', state:'', zip:'', notes:'', password:'' };

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | client obj
  const [contractModal, setContractModal] = useState(null); // null | client obj
  const [form, setForm] = useState(EMPTY);
  const [contractForm, setContractForm] = useState({
    type: 'snow',
    rate: '',
    start_date: new Date().toISOString().split('T')[0],
    details: ''
  });
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

  const toggleActive = async (id, currentActive) => {
    try {
      await api.put(`/clients/${id}`, { active: !currentActive });
      load();
    } catch (e) { console.error(e); }
  };

  const openContract = c => {
    setContractModal(c);
    setContractForm({
      type: 'snow',
      rate: '',
      start_date: new Date().toISOString().split('T')[0],
      details: c.service_type === 'commercial' ? 'Commercial property maintenance' : 'Residential property maintenance'
    });
    setMsg(null);
  };

  const sendContract = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const client = contractModal;
      const isSnow = contractForm.type === 'snow';
      const title = isSnow ? 'Snow Removal Service Agreement' : 'Lawn Care Service Agreement';
      
      const contractHtml = `
        <div style="font-family: serif; line-height: 1.5;">
          <h2 style="text-align: center; text-transform: uppercase;">${title}</h2>
          <p>This Agreement is dated this ${new Date().toLocaleDateString()} between:</p>
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div>
              <strong>Client:</strong><br/>
              ${client.first_name} ${client.last_name}<br/>
              ${client.address}<br/>
              ${client.city}, ${client.state} ${client.zip}
            </div>
            <div style="text-align: right;">
              <strong>Contractor:</strong><br/>
              Snow Bro's (Ryan Clark)<br/>
              1812 33rd St S<br/>
              Moorhead, MN 56560
            </div>
          </div>

          <h3>1. Services Provided</h3>
          <p>${isSnow 
            ? "Snow removal services will be performed after snowfall accumulation reaches 2 inches or more, unless service is specifically requested by the Client. The Contractor reserves 12 hours from the end of the snowfall event to reach the Client's property."
            : "Lawn care services including weekly/bi-weekly mowing, trimming, and property maintenance as scheduled between April and November."
          }</p>
          <p>Additional details: ${contractForm.details || 'Standard service agreement.'}</p>

          <h3>2. Term of Agreement</h3>
          <p>This Agreement will begin on ${contractForm.start_date} and remain in effect until ${isSnow ? 'April 30th' : 'November 30th'}, subject to earlier termination with 30 days written notice.</p>

          <h3>3. Compensation</h3>
          <p>The Contractor will charge the Client for the Services at the rate of <strong>$${contractForm.rate}</strong> per month.</p>
          <p>Invoices are due within 15 days of receipt. Late payments may be subject to interest charges.</p>

          <h3>4. Performance & Liability</h3>
          <p>The Contractor will provide all necessary equipment and tools. The Contractor is an independent contractor and not an employee of the Client. The Contractor agrees to indemnify and hold harmless the Client against claims arising from the Contractor's gross negligence.</p>

          <h3>5. Governing Law</h3>
          <p>This Agreement will be governed by and construed in accordance with the laws of the State of Minnesota.</p>
        </div>
      `;

      const res = await api.post('/contracts/generate', {
        title,
        client_id: client.id,
        contract_type: 'generated',
        service_category: isSnow ? 'snow' : 'lawn',
        rate: contractForm.rate,
        start_date: contractForm.start_date,
        contract_html: contractHtml
      });

      const signUrl = `${window.location.origin}/sign-contract/${res.data.sign_token}`;
      
      // Send email notification (mocked via existing email route)
      await api.post('/emails/send', {
        subject: `Action Required: Your Snow Bro's Service Contract`,
        body: `Hello ${client.first_name},\n\nPlease review and sign your ${title} by clicking the link below:\n\n${signUrl}\n\nThank you,\nSnow Bro's`,
        recipient_ids: [client.id]
      });

      alert(`Contract generated and sent! Link: ${signUrl}`);
      setContractModal(null);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to generate contract');
    } finally {
      setLoading(false);
    }
  };

  const filtered = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = clients.filter(c => c.active).length;
  const inactiveCount = clients.length - activeCount;

  return (
    <div>
      <div className="flex-between page-header">
        <div><h1>👥 Clients</h1><p>Manage your client list.</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Client</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: '8px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#166534' }}>
          {activeCount} Active
        </div>
        <div style={{ padding: '8px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#991b1b' }}>
          {inactiveCount} Inactive
        </div>
        <div style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#475569' }}>
          {clients.length} Total
        </div>
      </div>

      <div className="card mb-2">
        <input className="form-control" placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Status</th><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No clients found</td></tr>}
              {filtered.map(c => (
                <tr key={c.id} style={{ background: c.active ? '#f0fdf4' : '#fef2f2', borderLeft: `4px solid ${c.active ? '#22c55e' : '#ef4444'}` }}>
                  <td>
                    <button
                      onClick={() => toggleActive(c.id, c.active)}
                      style={{
                        background: c.active ? '#22c55e' : '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        minWidth: 70,
                      }}
                    >
                      {c.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td><strong>{c.first_name} {c.last_name}</strong></td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.city}</td>
                  <td>
                    <div style={{ display:'flex', gap:'.4rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => openContract(c)}>📄 Contract</button>
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

      {/* Client Edit Modal */}
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
                <div className="modal-footer" style={{ padding:0, border:0, marginTop:'1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Contract Generation Modal */}
      {contractModal && (
        <div className="modal-overlay" onClick={() => setContractModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📄 Send Contract: {contractModal.first_name}</h2>
              <button className="modal-close" onClick={() => setContractModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {msg && <div className="alert alert-error">{msg}</div>}
              <form onSubmit={sendContract}>
                <div className="form-group">
                  <label>Contract Type</label>
                  <select 
                    className="form-control" 
                    value={contractForm.type} 
                    onChange={e => setContractForm({...contractForm, type: e.target.value})}
                  >
                    <option value="snow">Snow Removal Contract</option>
                    <option value="lawn">Lawn Care Contract</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Monthly Rate ($) *</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={contractForm.rate} 
                    onChange={e => setContractForm({...contractForm, rate: e.target.value})} 
                    required 
                    placeholder="e.g. 225"
                  />
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={contractForm.start_date} 
                    onChange={e => setContractForm({...contractForm, start_date: e.target.value})} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Service Details / Notes</label>
                  <textarea 
                    className="form-control" 
                    value={contractForm.details} 
                    onChange={e => setContractForm({...contractForm, details: e.target.value})} 
                    placeholder="Any specific property details..."
                  />
                </div>
                <div className="modal-footer" style={{ padding:0, border:0, marginTop:'1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setContractModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <span className="spinner" /> : '🚀 Generate & Send Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
