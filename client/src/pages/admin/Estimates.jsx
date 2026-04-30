import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../utils/api';
import BusinessHeader from '../../components/BusinessHeader';

const STATUS_COLORS = {
  draft: 'badge-gray', sent: 'badge-blue', accepted: 'badge-green',
  declined: 'badge-red', expired: 'badge-yellow'
};

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: '', total: 0 };

function calcItem(it) {
  return { ...it, total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0) };
}

export default function AdminEstimates() {
  const [estimates, setEstimates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEst, setEditEst] = useState(null);
  const [viewEst, setViewEst] = useState(null);
  const [convertModal, setConvertModal] = useState(null);
  const [convertClientId, setConvertClientId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [saveClientStatus, setSaveClientStatus] = useState(null); // null | 'saving' | 'saved'

  const location = useLocation();
  const prefill = location.state?.prefill || null;

  const saveEstimateAsClient = async (est) => {
    setSaveClientStatus('saving');
    try {
      const nameParts = (est.customer_name || '').trim().split(' ');
      const first_name = nameParts[0] || 'Unknown';
      const last_name = nameParts.slice(1).join(' ') || '.';
      const addrParts = (est.customer_address || '').split(',').map(p => p.trim());
      await api.post('/clients', {
        first_name,
        last_name,
        email: est.customer_email || '',
        phone: est.customer_phone || '',
        address: addrParts[0] || '',
        city: addrParts[1] || '',
        state: addrParts[2] || '',
        zip: addrParts[3] || '',
        notes: `Added from estimate ${est.estimate_number}`,
        active: 0,
      });
      setSaveClientStatus('saved');
      await load();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to save client');
      setSaveClientStatus(null);
    }
  };

  const [form, setForm] = useState({
    client_id: '', customer_name: '', customer_email: '', customer_phone: '',
    customer_address: '', tax_rate: 0, notes: '', valid_until: '',
    items: [{ ...EMPTY_ITEM }]
  });

  // No autocomplete state needed — using a plain dropdown

  useEffect(() => { load(); }, []);

  // Auto-open new estimate form if navigated here with prefill data
  useEffect(() => {
    if (prefill) {
      setEditEst(null);
      setForm({
        client_id: prefill.client_id || '',
        customer_name: prefill.customer_name || '',
        customer_email: prefill.customer_email || '',
        customer_phone: prefill.customer_phone || '',
        customer_address: prefill.customer_address || '',
        tax_rate: 0, notes: '', valid_until: '',
        items: [{ ...EMPTY_ITEM }]
      });
      setShowForm(true);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const [eRes, cRes] = await Promise.all([api.get('/estimates'), api.get('/clients')]);
      setEstimates(eRes.data);
      setClients(cRes.data);
    } catch (e) { setErr('Failed to load estimates'); }
    finally { setLoading(false); }
  }

  function openNew() {
    setEditEst(null);
    setForm({ client_id: '', customer_name: '', customer_email: '', customer_phone: '', customer_address: '', tax_rate: 0, notes: '', valid_until: '', items: [{ ...EMPTY_ITEM }] });
    setShowForm(true);
  }

  // Auto-fill form when a client is selected from dropdown
  function selectClient(clientId) {
    if (!clientId) {
      setForm(f => ({ ...f, client_id: '', customer_name: '', customer_email: '', customer_phone: '', customer_address: '' }));
      return;
    }
    const client = clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ');
    const fullAddress = [client.address, client.city, client.state, client.zip].filter(Boolean).join(', ');
    setForm(f => ({
      ...f,
      client_id: client.id,
      customer_name: fullName,
      customer_email: client.email || '',
      customer_phone: client.phone || '',
      customer_address: fullAddress,
    }));
  }

  async function openEdit(id) {
    try {
      const { data } = await api.get(`/estimates/${id}`);
      setEditEst(data);
      setForm({
        client_id: data.client_id || '',
        customer_name: data.customer_name, customer_email: data.customer_email,
        customer_phone: data.customer_phone, customer_address: data.customer_address,
        tax_rate: data.tax_rate, notes: data.notes, valid_until: data.valid_until || '',
        items: data.items.length ? data.items.map(it => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price, total: it.total })) : [{ ...EMPTY_ITEM }]
      });
      setShowForm(true);
    } catch (e) { setErr('Failed to load estimate'); }
  }

  async function openView(id) {
    try {
      setSaveClientStatus(null);
      const { data } = await api.get(`/estimates/${id}`);
      setViewEst(data);
      setPreviewUrl('');
    } catch (e) { setErr('Failed to load estimate'); }
  }

  function handleField(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleItem(idx, field, value) {
    setForm(f => {
      const items = f.items.map((it, i) => i === idx ? calcItem({ ...it, [field]: value }) : it);
      return { ...f, items };
    });
  }

  function addItem() { setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })); }
  function removeItem(idx) { setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })); }

  function calcTotals() {
    const subtotal = form.items.reduce((s, it) => s + (it.total || 0), 0);
    const taxRate = parseFloat(form.tax_rate) || 0;
    const taxAmount = subtotal * taxRate / 100;
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }

  async function submit(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    const { subtotal, taxAmount, total } = calcTotals();
    const payload = { ...form, subtotal, tax_amount: taxAmount, total,
      client_id: form.client_id || null };
    try {
      if (editEst) {
        await api.put(`/estimates/${editEst.id}`, payload);
        setMsg('Estimate updated.');
      } else {
        await api.post('/estimates', payload);
        setMsg('Estimate created.');
      }
      setShowForm(false);
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Save failed'); }
  }

  async function deleteEst(id) {
    if (!confirm('Delete this estimate?')) return;
    try { await api.delete(`/estimates/${id}`); load(); }
    catch (e) { setErr('Delete failed'); }
  }

  async function emailEst(id) {
    setEmailLoading(true); setMsg(''); setErr(''); setPreviewUrl('');
    try {
      const { data } = await api.post(`/estimates/${id}/email`);
      setMsg('Estimate emailed successfully!');
      if (data.previewUrl) setPreviewUrl(data.previewUrl);
      load();
      if (viewEst) openView(id);
    } catch (e) { setErr(e.response?.data?.error || 'Email failed'); }
    finally { setEmailLoading(false); }
  }

  async function convertEst() {
    if (!convertClientId) return setErr('Please select a client');
    try {
      const { data } = await api.post(`/estimates/${convertModal.id}/convert`, { client_id: convertClientId });
      setMsg(`Converted to invoice ${data.invoice_number}!`);
      setConvertModal(null); setConvertClientId('');
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Conversion failed'); }
  }

  const { subtotal, taxAmount, total } = calcTotals();

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><span className="spinner" /></div>;

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1>📋 Estimates</h1>
          <p>Create and manage customer estimates.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ New Estimate</button>
      </div>

      {msg && <div className="alert alert-success">{msg}{previewUrl && <> — <a href={previewUrl} target="_blank" rel="noopener noreferrer">Preview email</a></>}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {/* ── Estimates list ── */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estimate #</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {estimates.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem' }}>No estimates yet</td></tr>
              )}
              {estimates.map(est => (
                <tr key={est.id}>
                  <td><strong>{est.estimate_number}</strong></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{est.customer_name}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--gray-500)' }}>{est.customer_email}</div>
                    {est.client_id && (
                      <div style={{ fontSize: '.72rem', color: '#166534', background: '#dcfce7', borderRadius: 4, padding: '1px 6px', display: 'inline-block', marginTop: 2 }}>
                        🔗 Client record
                      </div>
                    )}
                  </td>
                  <td><strong>${Number(est.total).toFixed(2)}</strong></td>
                  <td><span className={`badge ${STATUS_COLORS[est.status] || 'badge-gray'}`}>{est.status}</span></td>
                  <td style={{ fontSize: '.82rem', color: 'var(--gray-500)' }}>{new Date(est.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openView(est.id)}>View</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(est.id)}>Edit</button>
                      <button className="btn btn-primary btn-sm" onClick={() => emailEst(est.id)} disabled={emailLoading || !est.customer_email}>Email</button>
                      {est.status !== 'accepted' && (
                        <button className="btn btn-outline btn-sm" onClick={() => { setConvertModal(est); setConvertClientId(est.client_id ? String(est.client_id) : ''); }}>→ Invoice</button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => deleteEst(est.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit form modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h2>{editEst ? 'Edit Estimate' : 'New Estimate'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                {err && <div className="alert alert-error">{err}</div>}
                {form.client_id && (
                  <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '8px 14px', marginBottom: 12, fontSize: '.85rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🔗</span>
                    <span><strong>Linked to client record</strong> — changes to the form below are for this estimate only and will not update the client record.</span>
                  </div>
                )}
                <h3 style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--blue-700)', marginBottom: '.75rem' }}>Customer Information</h3>

                {/* Client dropdown — import from existing client */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>👤 Import from existing client</label>
                  <select
                    className="form-control"
                    value={form.client_id || ''}
                    onChange={e => selectClient(e.target.value)}
                  >
                    <option value="">— Select a client to auto-fill —</option>
                    {[...clients]
                      .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
                      .map(c => {
                        const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ');
                        const addr = [c.address, c.city].filter(Boolean).join(', ');
                        return (
                          <option key={c.id} value={c.id}>
                            {fullName}{addr ? ` — ${addr}` : ''}
                          </option>
                        );
                      })
                    }
                  </select>
                </div>

                <div className="form-row">
  
                  <div className="form-group">
                    <label>Customer Name *</label>
                    <input className="form-control" name="customer_name" value={form.customer_name} onChange={handleField} required />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input className="form-control" name="customer_email" type="email" value={form.customer_email} onChange={handleField} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input className="form-control" name="customer_phone" value={form.customer_phone} onChange={handleField} />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <input className="form-control" name="customer_address" value={form.customer_address} onChange={handleField} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Valid Until</label>
                    <input className="form-control" name="valid_until" type="date" value={form.valid_until} onChange={handleField} />
                  </div>
                  <div className="form-group">
                    <label>Tax Rate (%)</label>
                    <input className="form-control" name="tax_rate" type="number" min="0" max="100" step="0.1" value={form.tax_rate} onChange={handleField} />
                  </div>
                </div>

                <hr className="divider" />
                <div className="flex-between mb-1">
                  <h3 style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--blue-700)' }}>Line Items</h3>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--blue-50)' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--blue-800)', fontWeight: 600 }}>Description</th>
                        <th style={{ padding: '6px 8px', width: 70, color: 'var(--blue-800)', fontWeight: 600 }}>Qty</th>
                        <th style={{ padding: '6px 8px', width: 100, color: 'var(--blue-800)', fontWeight: 600 }}>Unit Price</th>
                        <th style={{ padding: '6px 8px', width: 90, color: 'var(--blue-800)', fontWeight: 600 }}>Total</th>
                        <th style={{ padding: '6px 8px', width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '4px 4px' }}>
                            <input className="form-control" value={it.description} onChange={e => handleItem(idx, 'description', e.target.value)} required placeholder="Service or item description" />
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <input className="form-control" type="number" min="0.01" step="0.01" value={it.quantity} onChange={e => handleItem(idx, 'quantity', e.target.value)} />
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <input className="form-control" type="number" min="0" step="0.01" value={it.unit_price} onChange={e => handleItem(idx, 'unit_price', e.target.value)} placeholder="0.00" />
                          </td>
                          <td style={{ padding: '4px 8px', fontWeight: 600 }}>${Number(it.total).toFixed(2)}</td>
                          <td style={{ padding: '4px 4px' }}>
                            {form.items.length > 1 && (
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)} style={{ padding: '.2rem .5rem' }}>×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <div style={{ minWidth: 220, fontSize: '.88rem' }}>
                    <div className="flex-between mb-1"><span style={{ color: 'var(--gray-500)' }}>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
                    {parseFloat(form.tax_rate) > 0 && (
                      <div className="flex-between mb-1"><span style={{ color: 'var(--gray-500)' }}>Tax ({form.tax_rate}%)</span><strong>${taxAmount.toFixed(2)}</strong></div>
                    )}
                    <div className="flex-between" style={{ borderTop: '2px solid var(--blue-200)', paddingTop: '.5rem', fontWeight: 800, fontSize: '1rem', color: 'var(--blue-700)' }}>
                      <span>Total</span><span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="form-group mt-2">
                  <label>Notes</label>
                  <textarea className="form-control" name="notes" value={form.notes} onChange={handleField} rows={3} placeholder="Any additional notes for the customer..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editEst ? 'Save Changes' : 'Create Estimate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View estimate modal ── */}
      {viewEst && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewEst(null)}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h2>Estimate {viewEst.estimate_number}</h2>
              <button className="modal-close" onClick={() => setViewEst(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <BusinessHeader style={{ borderRadius: 0 }} />
              <div style={{ padding: '1.25rem' }}>
              {msg && <div className="alert alert-success">{msg}{previewUrl && <> — <a href={previewUrl} target="_blank" rel="noopener noreferrer">Preview email</a></>}</div>}
              {err && <div className="alert alert-error">{err}</div>}

              {/* Header info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--blue-700)', letterSpacing: '.05em' }}>Customer</div>
                  <div style={{ fontWeight: 700, marginTop: '.25rem' }}>{viewEst.customer_name}</div>
                  {viewEst.customer_address && <div style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>{viewEst.customer_address}</div>}
                  {viewEst.customer_email && <div style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>{viewEst.customer_email}</div>}
                  {viewEst.customer_phone && <div style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>{viewEst.customer_phone}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--blue-700)', letterSpacing: '.05em' }}>Status</div>
                  <div style={{ marginTop: '.25rem' }}><span className={`badge ${STATUS_COLORS[viewEst.status] || 'badge-gray'}`}>{viewEst.status}</span></div>
                  <div style={{ fontSize: '.82rem', color: 'var(--gray-400)', marginTop: '.5rem' }}>Created: {new Date(viewEst.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  {viewEst.emailed_at && <div style={{ fontSize: '.82rem', color: 'var(--gray-400)' }}>Emailed: {new Date(viewEst.emailed_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                  {viewEst.valid_until && <div style={{ fontSize: '.82rem', color: 'var(--gray-400)' }}>Valid until: {new Date(viewEst.valid_until).toLocaleDateString()}</div>}
                </div>
              </div>

              {/* Line items */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewEst.items || []).map((it, i) => (
                      <tr key={i}>
                        <td>{it.description}</td>
                        <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right' }}>${Number(it.unit_price).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(it.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <div style={{ minWidth: 220, fontSize: '.9rem' }}>
                  <div className="flex-between mb-1"><span style={{ color: 'var(--gray-500)' }}>Subtotal</span><span>${Number(viewEst.subtotal).toFixed(2)}</span></div>
                  {viewEst.tax_rate > 0 && <div className="flex-between mb-1"><span style={{ color: 'var(--gray-500)' }}>Tax ({viewEst.tax_rate}%)</span><span>${Number(viewEst.tax_amount).toFixed(2)}</span></div>}
                  <div className="flex-between" style={{ borderTop: '2px solid var(--blue-200)', paddingTop: '.5rem', fontWeight: 800, fontSize: '1.1rem', color: 'var(--blue-700)' }}>
                    <span>Total</span><span>${Number(viewEst.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {viewEst.notes && (
                <div className="alert alert-info mt-2"><strong>Notes:</strong> {viewEst.notes}</div>
              )}
              </div>
            </div>
            <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setViewEst(null)}>Close</button>
              <button className="btn btn-secondary" onClick={() => { setViewEst(null); openEdit(viewEst.id); }}>Edit</button>
              <button className="btn btn-primary" onClick={() => emailEst(viewEst.id)} disabled={emailLoading || !viewEst.customer_email}>
                {emailLoading ? <span className="spinner" /> : '📧 Email to Customer'}
              </button>
              {!viewEst.client_id && (
                saveClientStatus === 'saved' ? (
                  <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '6px 12px', fontSize: '.88rem', fontWeight: 700 }}>✅ Saved to Clients</span>
                ) : (
                  <button
                    className="btn btn-outline"
                    style={{ background: '#dbeafe', color: '#1e40af', border: 'none' }}
                    onClick={() => saveEstimateAsClient(viewEst)}
                    disabled={saveClientStatus === 'saving'}
                  >
                    {saveClientStatus === 'saving' ? '⏳ Saving…' : '👤 Save as New Client'}
                  </button>
                )
              )}
              {viewEst.status !== 'accepted' && (
                <button className="btn btn-outline" onClick={() => { setViewEst(null); setConvertModal(viewEst); setConvertClientId(viewEst.client_id ? String(viewEst.client_id) : ''); }}>
                  → Convert to Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Convert to invoice modal ── */}
      {convertModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConvertModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>Convert to Invoice</h2>
              <button className="modal-close" onClick={() => setConvertModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error">{err}</div>}
              <p style={{ marginBottom: '1rem', fontSize: '.9rem', color: 'var(--gray-600)' }}>
                Converting estimate <strong>{convertModal.estimate_number}</strong> for <strong>{convertModal.customer_name}</strong> to an invoice. Select the client account to link it to:
              </p>
              <div className="form-group">
                <label>Client Account *</label>
                <select className="form-control" value={convertClientId} onChange={e => setConvertClientId(e.target.value)}>
                  <option value="">Select a client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConvertModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={convertEst}>Convert to Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
