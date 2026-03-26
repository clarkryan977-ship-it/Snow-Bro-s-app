import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import PaymentSection from '../../components/PaymentSection';
import BusinessHeader from '../../components/BusinessHeader';

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: '' };
const STATUS_COLORS = { draft:'badge-gray', sent:'badge-blue', paid:'badge-green', overdue:'badge-red' };

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | invoice obj
  const [viewInv, setViewInv] = useState(null);
  const [form, setForm] = useState({ client_id:'', items:[{ ...EMPTY_ITEM }], tax_rate:0, notes:'' });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/invoices').then(r => setInvoices(r.data)).catch(() => {});
  useEffect(() => {
    load();
    api.get('/clients').then(r => setClients(r.data)).catch(() => {});
  }, []);

  const openCreate = () => { setForm({ client_id:'', items:[{ ...EMPTY_ITEM }], tax_rate:0, notes:'' }); setModal('create'); setMsg(null); };
  const close = () => { setModal(null); setMsg(null); };

  const handleForm = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleItem = (i, e) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [e.target.name]: e.target.value };
    return { ...f, items };
  });
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const subtotal = form.items.reduce((s, it) => s + (parseFloat(it.quantity)||0) * (parseFloat(it.unit_price)||0), 0);
  const taxAmt   = subtotal * ((parseFloat(form.tax_rate)||0) / 100);
  const total    = subtotal + taxAmt;

  const create = async e => {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      await api.post('/invoices', { ...form, items: form.items.map(it => ({ ...it, quantity: parseFloat(it.quantity)||1, unit_price: parseFloat(it.unit_price)||0 })) });
      await load(); close();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creating invoice');
    } finally { setLoading(false); }
  };

  const setStatus = async (id, status) => {
    await api.put(`/invoices/${id}/status`, { status }).catch(() => {});
    load();
    if (viewInv && viewInv.id === id) setViewInv(v => ({ ...v, status }));
  };

  const viewFull = async inv => {
    const { data } = await api.get(`/invoices/${inv.id}`);
    setViewInv(data);
  };

  return (
    <div>
      <div className="flex-between page-header">
        <div><h1>🧾 Invoices</h1><p>Create and manage client invoices.</p></div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Invoice</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice #</th><th>Client</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {invoices.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No invoices yet</td></tr>}
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td><strong>{inv.invoice_number}</strong></td>
                  <td>{inv.client_name}</td>
                  <td><strong>${Number(inv.total).toFixed(2)}</strong></td>
                  <td>
                    <select className="form-control" style={{ fontSize:'.8rem', padding:'.25rem .5rem', width:'auto' }}
                      value={inv.status} onChange={e => setStatus(inv.id, e.target.value)}>
                      {['draft','sent','paid','overdue'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ color:'var(--gray-400)', fontSize:'.8rem' }}>{inv.created_at?.slice(0,10)}</td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => viewFull(inv)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {modal === 'create' && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" style={{ maxWidth:680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>New Invoice</h2><button className="modal-close" onClick={close}>×</button></div>
            <div className="modal-body">
              {msg && <div className="alert alert-error">{msg}</div>}
              <form onSubmit={create}>
                <div className="form-group">
                  <label>Client *</label>
                  <select name="client_id" value={form.client_id} onChange={handleForm} required className="form-control">
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
                  </select>
                </div>
                <label style={{ fontSize:'.85rem', fontWeight:600, color:'var(--gray-700)', display:'block', marginBottom:'.5rem' }}>Line Items</label>
                {form.items.map((it, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 100px 36px', gap:'.5rem', marginBottom:'.5rem', alignItems:'center' }}>
                    <input name="description" value={it.description} onChange={e => handleItem(i, e)} placeholder="Description" required className="form-control" />
                    <input name="quantity" type="number" min="0.01" step="0.01" value={it.quantity} onChange={e => handleItem(i, e)} placeholder="Qty" className="form-control" />
                    <input name="unit_price" type="number" min="0" step="0.01" value={it.unit_price} onChange={e => handleItem(i, e)} placeholder="Price" required className="form-control" />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)} disabled={form.items.length === 1}>×</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm mb-2" onClick={addItem}>+ Add Line Item</button>
                <div className="form-row">
                  <div className="form-group"><label>Tax Rate (%)</label><input type="number" name="tax_rate" value={form.tax_rate} onChange={handleForm} min="0" step="0.1" className="form-control" /></div>
                  <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end', paddingBottom:'1rem' }}>
                    <div style={{ fontSize:'.85rem', color:'var(--gray-500)' }}>Subtotal: <strong>${subtotal.toFixed(2)}</strong></div>
                    <div style={{ fontSize:'.85rem', color:'var(--gray-500)' }}>Tax: <strong>${taxAmt.toFixed(2)}</strong></div>
                    <div style={{ fontWeight:700, color:'var(--blue-700)' }}>Total: ${total.toFixed(2)}</div>
                  </div>
                </div>
                <div className="form-group"><label>Notes</label><textarea name="notes" value={form.notes} onChange={handleForm} className="form-control" /></div>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Create Invoice'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View invoice modal */}
      {viewInv && (
        <div className="modal-overlay" onClick={() => setViewInv(null)}>
          <div className="modal" style={{ maxWidth:680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Invoice {viewInv.invoice_number}</h2>
              <button className="modal-close" onClick={() => setViewInv(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <BusinessHeader style={{ borderRadius: 0 }} />
              <div style={{ padding: '1.25rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:'.5rem' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:'1.1rem' }}>{viewInv.client_name}</div>
                  <div style={{ color:'var(--gray-500)', fontSize:'.85rem' }}>{viewInv.client_email}</div>
                  {viewInv.client_address && <div style={{ color:'var(--gray-500)', fontSize:'.85rem' }}>{viewInv.client_address}, {viewInv.client_city} {viewInv.client_state} {viewInv.client_zip}</div>}
                </div>
                <div style={{ textAlign:'right' }}>
                  <span className={`badge ${STATUS_COLORS[viewInv.status] || 'badge-gray'}`} style={{ fontSize:'.85rem' }}>{viewInv.status}</span>
                  <div style={{ color:'var(--gray-400)', fontSize:'.8rem', marginTop:'.25rem' }}>{viewInv.created_at?.slice(0,10)}</div>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                  <tbody>
                    {(viewInv.items||[]).map(it => (
                      <tr key={it.id}>
                        <td>{it.description}</td>
                        <td>{it.quantity}</td>
                        <td>${Number(it.unit_price).toFixed(2)}</td>
                        <td>${Number(it.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign:'right', marginTop:'1rem' }}>
                <div style={{ color:'var(--gray-500)', fontSize:'.88rem' }}>Subtotal: ${Number(viewInv.subtotal).toFixed(2)}</div>
                {viewInv.tax_rate > 0 && <div style={{ color:'var(--gray-500)', fontSize:'.88rem' }}>Tax ({viewInv.tax_rate}%): ${Number(viewInv.tax_amount).toFixed(2)}</div>}
                <div style={{ fontWeight:800, fontSize:'1.2rem', color:'var(--blue-700)' }}>Total: ${Number(viewInv.total).toFixed(2)}</div>
              </div>
              {viewInv.notes && <div style={{ marginTop:'1rem', padding:'.75rem', background:'var(--gray-50)', borderRadius:'var(--radius)', fontSize:'.88rem', color:'var(--gray-600)' }}>{viewInv.notes}</div>}

              {/* Payment section */}
              <hr className="divider" />
              <PaymentSection invoiceTotal={viewInv.total} invoiceNumber={viewInv.invoice_number} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
