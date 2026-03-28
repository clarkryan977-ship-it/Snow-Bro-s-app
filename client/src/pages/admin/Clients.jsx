import { useState, useEffect } from 'react';
import api from '../../utils/api';

const EMPTY = { first_name:'', last_name:'', email:'', phone:'', address:'', city:'', state:'', zip:'', notes:'', password:'' };

const BUSINESS_INFO = {
  name: "Snow Bro's",
  owner: "Ryan Clark",
  address: "1812 33rd St S",
  city: "Moorhead",
  state: "MN",
  zip: "56560",
  phone: "218-331-5145",
  email: "clarkryan977@gmail.com",
  website: "https://snowbros-production.up.railway.app"
};

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | client obj
  const [contractModal, setContractModal] = useState(null); // null | client obj
  const [form, setForm] = useState(EMPTY);
  const [contractForm, setContractForm] = useState({
    type: 'snow',
    frequency: 'weekly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '', // No default — must be explicitly set
    rate: '',
    deposit: '',
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
    // NO default end date — admin must explicitly choose
    setContractForm({
      type: 'snow',
      frequency: 'weekly',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '', // Empty — required field
      rate: '',
      deposit: '',
      details: c.service_type === 'commercial' ? 'Commercial property maintenance' : 'Residential property maintenance'
    });
    setMsg(null);
  };

  const handleContractForm = e => {
    const { name, value } = e.target;
    setContractForm(f => ({ ...f, [name]: value }));
  };

  const sendContract = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const client = contractModal;
      const isSnow = contractForm.type === 'snow';
      const title = isSnow ? 'Snow Removal Service Agreement' : 'Lawn Care Service Agreement';
      
      // Build contract HTML with professional header and all editable fields
      const contractHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: linear-gradient(135deg, #0f2557 0%, #1d4ed8 100%); color: white; padding: 24px; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 4px 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 24px; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #0f2557; padding-bottom: 6px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .party { flex: 1; }
    .party strong { display: block; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f4f8; font-weight: bold; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 12px; color: #666; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${BUSINESS_INFO.name}</h1>
    <p>${BUSINESS_INFO.address}, ${BUSINESS_INFO.city}, ${BUSINESS_INFO.state} ${BUSINESS_INFO.zip}</p>
    <p>${BUSINESS_INFO.phone} • ${BUSINESS_INFO.email}</p>
  </div>

  <div class="content">
    <h1 style="text-align: center; text-transform: uppercase; margin-bottom: 24px;">${title}</h1>

    <div class="section">
      <h2>Agreement Parties</h2>
      <div class="parties">
        <div class="party">
          <strong>Client:</strong>
          ${client.first_name} ${client.last_name}<br/>
          ${client.address || '(Address not provided)'}<br/>
          ${client.city}, ${client.state} ${client.zip}<br/>
          Phone: ${client.phone || '(Not provided)'}<br/>
          Email: ${client.email || '(Not provided)'}
        </div>
        <div class="party">
          <strong>Contractor:</strong>
          ${BUSINESS_INFO.name} (${BUSINESS_INFO.owner})<br/>
          ${BUSINESS_INFO.address}<br/>
          ${BUSINESS_INFO.city}, ${BUSINESS_INFO.state} ${BUSINESS_INFO.zip}<br/>
          Phone: ${BUSINESS_INFO.phone}<br/>
          Email: ${BUSINESS_INFO.email}
        </div>
      </div>
    </div>

    <div class="section">
      <h2>1. Services Provided</h2>
      <p>${isSnow 
        ? "Snow removal services will be performed after snowfall accumulation reaches 2 inches or more, unless service is specifically requested by the Client. The Contractor reserves 12 hours from the end of the snowfall event to reach the Client's property."
        : "Lawn care services including mowing, trimming, and property maintenance as scheduled."
      }</p>
      <p><strong>Service Frequency:</strong> ${contractForm.frequency}</p>
      <p><strong>Service Details:</strong> ${contractForm.details || 'Standard service agreement.'}</p>
    </div>

    <div class="section">
      <h2>2. Term of Agreement</h2>
      <p><strong>Effective Date:</strong> ${new Date(contractForm.start_date).toLocaleDateString()}</p>
      <p><strong style="color: #dc2626; font-size: 16px;">Agreement Termination Date: ${new Date(contractForm.end_date).toLocaleDateString()}</strong></p>
      <p>This Service Agreement will commence on the Effective Date above and will terminate on the Agreement Termination Date specified above, unless earlier terminated by either party with 30 days written notice.</p>
    </div>

    <div class="section">
      <h2>3. Compensation & Payment Terms</h2>
      <table>
        <tr><th>Service Rate</th><td>$${contractForm.rate || '0.00'} per ${contractForm.frequency}</td></tr>
        ${contractForm.deposit ? `<tr><th>Deposit Required</th><td>$${contractForm.deposit}</td></tr>` : ''}
        <tr><th>Payment Terms</th><td>Due upon completion of service</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>4. Cancellation Policy</h2>
      <p>Either party may terminate this agreement with 24 hours notice. Late cancellations may be subject to a service charge.</p>
    </div>

    <div class="section">
      <h2>5. Liability & Indemnification</h2>
      <p>The Contractor will provide all necessary equipment and tools. The Contractor is an independent contractor and not an employee of the Client. The Contractor agrees to indemnify and hold harmless the Client against claims arising from the Contractor's gross negligence or willful misconduct.</p>
    </div>

    <div class="section">
      <h2>6. Service Area</h2>
      <p>Services are provided in Moorhead, MN and Fargo, ND and surrounding areas.</p>
    </div>

    <div class="section">
      <h2>7. Governing Law</h2>
      <p>This Agreement will be governed by and construed in accordance with the laws of the State of Minnesota.</p>
    </div>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd;">
      <p style="margin-bottom: 40px;">By signing below, both parties agree to the terms and conditions of this Service Agreement.</p>
      <div style="display: flex; justify-content: space-between;">
        <div>
          <p style="margin-bottom: 40px;">_______________________________</p>
          <p><strong>Client Signature</strong></p>
          <p style="margin-top: 20px;">_______________________________</p>
          <p><strong>Date</strong></p>
        </div>
        <div>
          <p style="margin-bottom: 40px;">_______________________________</p>
          <p><strong>Contractor Signature</strong></p>
          <p style="margin-top: 20px;">_______________________________</p>
          <p><strong>Date</strong></p>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <strong>${BUSINESS_INFO.name}</strong> • ${BUSINESS_INFO.address}, ${BUSINESS_INFO.city}, ${BUSINESS_INFO.state} ${BUSINESS_INFO.zip}<br/>
    ${BUSINESS_INFO.phone} • ${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}
  </div>
</body>
</html>
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
      
      // Send email notification
      await api.post('/emails/send', {
        subject: `Action Required: Your Snow Bro's Service Contract`,
        body: `Hello ${client.first_name},\n\nPlease review and sign your ${title} by clicking the link below:\n\n${signUrl}\n\nThank you,\nSnow Bro's Team`,
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
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c)} style={{ marginRight: 8 }}>Edit</button>
                    <button className="btn btn-sm btn-info" onClick={() => openContract(c)} style={{ marginRight: 8 }}>📄 Contract</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Client Modal */}
      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Add Client' : `Edit ${modal.first_name} ${modal.last_name}`}</h2>
              <button className="close-btn" onClick={close}>×</button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.includes('Error') ? 'error' : 'success'}`}>{msg}</div>}
              <form onSubmit={save}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>First Name *</label>
                    <input name="first_name" value={form.first_name} onChange={handle} required className="form-control" />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input name="last_name" value={form.last_name} onChange={handle} required className="form-control" />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input name="email" type="email" value={form.email} onChange={handle} required className="form-control" />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input name="phone" value={form.phone} onChange={handle} className="form-control" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Address</label>
                    <input name="address" value={form.address} onChange={handle} className="form-control" />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input name="city" value={form.city} onChange={handle} className="form-control" />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input name="state" value={form.state} onChange={handle} className="form-control" />
                  </div>
                  <div className="form-group">
                    <label>ZIP</label>
                    <input name="zip" value={form.zip} onChange={handle} className="form-control" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Notes</label>
                    <textarea name="notes" value={form.notes} onChange={handle} className="form-control" rows={3} />
                  </div>
                  {modal !== 'add' && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>New Password (leave blank to keep current)</label>
                      <input name="password" type="password" value={form.password} onChange={handle} className="form-control" />
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Generate Contract Modal */}
      {contractModal && (
        <div className="modal-overlay" onClick={() => setContractModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>📄 Generate Contract for {contractModal.first_name} {contractModal.last_name}</h2>
              <button className="close-btn" onClick={() => setContractModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.includes('Error') ? 'error' : 'success'}`}>{msg}</div>}
              <form onSubmit={sendContract}>
                <div className="form-group">
                  <label>Contract Type *</label>
                  <select name="type" value={contractForm.type} onChange={handleContractForm} className="form-control">
                    <option value="snow">Snow Removal Service Agreement</option>
                    <option value="lawn">Lawn Care Service Agreement</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af', marginBottom: '12px' }}>📅 Agreement Term</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label>Start Date *</label>
                      <input name="start_date" type="date" value={contractForm.start_date} onChange={handleContractForm} required className="form-control" />
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: '700', color: '#dc2626' }}>End Date * (Required)</label>
                      <input name="end_date" type="date" value={contractForm.end_date} onChange={handleContractForm} required className="form-control" style={{ borderColor: contractForm.end_date ? '#22c55e' : '#dc2626', borderWidth: '2px' }} />
                      <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>Admin must explicitly choose the contract termination date</small>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Service Frequency *</label>
                  <select name="frequency" value={contractForm.frequency} onChange={handleContractForm} className="form-control">
                    <option value="one-time">One-time</option>
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="as-needed">As-needed</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Service Rate ($) *</label>
                    <input name="rate" type="number" step="0.01" value={contractForm.rate} onChange={handleContractForm} required className="form-control" placeholder="e.g., 150.00" />
                  </div>
                  <div className="form-group">
                    <label>Deposit Amount ($)</label>
                    <input name="deposit" type="number" step="0.01" value={contractForm.deposit} onChange={handleContractForm} className="form-control" placeholder="Optional" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Service Details</label>
                  <textarea name="details" value={contractForm.details} onChange={handleContractForm} className="form-control" rows={4} placeholder="Describe specific services, equipment, scope, etc." />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setContractModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Generating...' : '📧 Generate & Send Contract'}
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
