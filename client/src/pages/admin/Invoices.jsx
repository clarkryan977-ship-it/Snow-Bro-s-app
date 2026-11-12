import { useState, useEffect } from 'react';
import api from '../../utils/api';
import PaymentSection from '../../components/PaymentSection';
import BusinessHeader from '../../components/BusinessHeader';
import PrintInvoiceButton from '../../components/PrintableInvoice';

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: '' };
const STATUS_COLORS = { draft:'badge-gray', sent:'badge-blue', paid:'badge-green', overdue:'badge-red' };

export default function AdminInvoices() {
  const [invoices, setInvoices]   = useState([]);
  const [clients, setClients]     = useState([]);
  const [modal, setModal]         = useState(null); // null | 'create'
  const [viewInv, setViewInv]     = useState(null);
  const [form, setForm]           = useState({ client_id:'', items:[{ ...EMPTY_ITEM }], tax_rate:0, notes:'', service_date:'', due_date:'' });
  const [msg, setMsg]             = useState(null);
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState({}); // { [invoiceId]: true/false }
  const [sendMsg, setSendMsg]     = useState({}); // { [invoiceId]: 'success' | 'error text' }
  const [tab, setTab]             = useState('all'); // 'all' | 'auto'
  const [autoInvoices, setAutoInvoices] = useState([]);
  const [autoLoading, setAutoLoading]   = useState(false);
  const [smsModal, setSmsModal]   = useState(null); // { invoiceId, smsText, phone }
  const [billingMsg, setBillingMsg] = useState(null);
  const [billingRunning, setBillingRunning] = useState(false);
  const [billingPreview, setBillingPreview] = useState(null);
  const [billingPreviewLoading, setBillingPreviewLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [archiveView, setArchiveView] = useState('active');
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount:'', payment_method:'check', reference:'', notes:'' });
  const [paymentMsg, setPaymentMsg] = useState(null);

  const load = () => api.get('/invoices').then(r => setInvoices(r.data)).catch(() => {});
  const loadSummary = () => api.get('/invoices/summary').then(r => setSummary(r.data)).catch(() => {});
  const loadAuto = () => {
    setAutoLoading(true);
    api.get('/invoices/auto-generated').then(r => setAutoInvoices(r.data)).catch(() => {}).finally(() => setAutoLoading(false));
  };

  useEffect(() => {
    load();
    loadSummary();
    // Fetch ALL clients (not just active) for the client selector
    api.get('/clients').then(r => setClients(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'auto') loadAuto();
  }, [tab]);

  const openCreate = () => { setForm({ client_id:'', items:[{ ...EMPTY_ITEM }], tax_rate:0, notes:'', service_date:'', due_date:'' }); setModal('create'); setMsg(null); };
  const close = () => { setModal(null); setMsg(null); };

  const handleForm = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleItem = (i, e) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [e.target.name]: e.target.value };
    return { ...f, items };
  });
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = i  => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const subtotal = form.items.reduce((s, it) => s + (parseFloat(it.quantity)||0) * (parseFloat(it.unit_price)||0), 0);
  const taxAmt   = subtotal * ((parseFloat(form.tax_rate)||0) / 100);
  const total    = subtotal + taxAmt;

  const create = async e => {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      await api.post('/invoices', {
        ...form,
        items: form.items.map(it => ({ ...it, quantity: parseFloat(it.quantity)||1, unit_price: parseFloat(it.unit_price)||0 }))
      });
      await load(); close();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creating invoice');
    } finally { setLoading(false); }
  };

  const setStatus = async (id, status) => {
    try { await api.put(`/invoices/${id}/status`, { status }); await Promise.all([load(), loadSummary()]); if (viewInv && viewInv.id === id) setViewInv(v => ({ ...v, status })); }
    catch (err) { alert(err.response?.data?.error || 'Could not update invoice status'); }
  };
  const openPayment = inv => { setPaymentMsg(null); setPaymentForm({ amount: Math.max(Number(inv.total)-Number(inv.amount_paid||0),0).toFixed(2), payment_method:'check', reference:'', notes:'' }); setPaymentModal(inv); };
  const payInFull = async inv => {
    if (!window.confirm(`Mark ${inv.invoice_number} paid in full for $${Math.max(Number(inv.total)-Number(inv.amount_paid||0),0).toFixed(2)}? This records the remaining balance as a manual payment.`)) return;
    try { await api.post(`/invoices/${inv.id}/pay-in-full`, { payment_method:'other', notes:'Marked paid in full manually' }); await Promise.all([load(), loadSummary()]); }
    catch (err) { alert(err.response?.data?.error || 'Could not mark invoice paid in full'); }
  };
  const recordPayment = async e => { e.preventDefault(); setPaymentMsg(null); try { await api.post(`/invoices/${paymentModal.id}/payments`, paymentForm); setPaymentModal(null); await Promise.all([load(), loadSummary()]); if (viewInv?.id === paymentModal.id) viewFull(paymentModal); } catch (err) { setPaymentMsg(err.response?.data?.error || 'Could not record payment'); } };
  const remind = async inv => { try { await api.post(`/invoices/${inv.id}/remind`); alert('Payment reminder sent'); load(); } catch (err) { alert(err.response?.data?.error || 'Could not send reminder'); } };
  const archiveThroughYesterday = async () => { const cutoff=new Date(Date.now()-86400000).toISOString().slice(0,10); if(!window.confirm(`Archive all invoices dated on or before ${cutoff}? Nothing will be deleted.`)) return; try { const {data}=await api.post('/invoices/archive-before',{cutoff_date:cutoff}); alert(`${data.archived} invoices archived safely`); load(); } catch(err) { alert(err.response?.data?.error||'Could not archive invoices'); } };
  const exportInvoices = async () => { const token=localStorage.getItem('token')||sessionStorage.getItem('token'); const r=await fetch('/api/invoices/export.csv',{headers:{Authorization:`Bearer ${token}`}}); if(!r.ok)return alert('Could not export invoices'); const b=await r.blob(); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='snowbros-invoices.csv'; a.click(); URL.revokeObjectURL(u); };
  const scanReceipt = inv => { const input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.capture='environment'; input.onchange=async()=>{ if(!input.files?.[0]) return; const fd=new FormData(); fd.append('receipt',input.files[0]); fd.append('name',`Receipt scan for ${inv.invoice_number}`); const token=localStorage.getItem('token')||sessionStorage.getItem('token'); try { const r=await fetch(`/api/invoices/${inv.id}/receipt-scan`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd}); if(!r.ok) throw new Error('Upload failed'); alert('Receipt scan saved to the invoice'); } catch(e) { alert(e.message); } }; input.click(); };

  const viewFull = async inv => {
    const { data } = await api.get(`/invoices/${inv.id}`);
    setViewInv(data);
  };

  const sendInvoice = async (inv, e) => {
    e.stopPropagation();
    setSending(s => ({ ...s, [inv.id]: true }));
    setSendMsg(m => ({ ...m, [inv.id]: null }));
    try {
      await api.post(`/invoices/${inv.id}/send`);
      setSendMsg(m => ({ ...m, [inv.id]: 'success' }));
      load();
      setTimeout(() => setSendMsg(m => ({ ...m, [inv.id]: null })), 4000);
    } catch (err) {
      const errText = err.response?.data?.error || 'Failed to send';
      setSendMsg(m => ({ ...m, [inv.id]: errText }));
      setTimeout(() => setSendMsg(m => ({ ...m, [inv.id]: null })), 5000);
    } finally {
      setSending(s => ({ ...s, [inv.id]: false }));
    }
  };

  const sendSms = async (inv, e) => {
    e.stopPropagation();
    try {
      const { data } = await api.post(`/invoices/${inv.id}/send-sms`);
      setSmsModal({ invoiceId: inv.id, smsText: data.sms_text, phone: data.phone, invoiceNumber: inv.invoice_number });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate SMS');
    }
  };

  const runBilling = async () => {
    setBillingRunning(true);
    setBillingMsg(null);
    try {
      const { data } = await api.post('/invoices/run-billing');
      setBillingMsg(`Billing complete: ${data.generated} invoices generated, ${data.emailed} emailed`);
      load();
      if (tab === 'auto') loadAuto();
    } catch (err) {
      setBillingMsg('Billing failed: ' + (err.response?.data?.error || 'Unknown error'));
    } finally {
      setBillingRunning(false);
    }
  };

  const previewBilling = async () => {
    setBillingPreviewLoading(true);
    try {
      const { data } = await api.get('/invoices/billing-preview');
      setBillingPreview(data);
    } catch (err) {
      setBillingMsg('Preview failed: ' + (err.response?.data?.error || 'Unknown error'));
    } finally { setBillingPreviewLoading(false); }
  };

  const purgeAllInvoices = async () => {
    if (!window.confirm('PERMANENTLY delete every invoice, payment, receipt attachment, and invoice audit record? Contracts, clients, and portal accounts will remain.')) return;
    if (!window.confirm('Final confirmation: start December with zero invoices and reset contract billing timestamps? This cannot be undone.')) return;
    try {
      const { data } = await api.post('/invoices/purge-all');
      const deleted = Object.values(data.deleted || {}).reduce((sum, count) => sum + count, 0);
      setBillingMsg(`Purge complete: ${deleted} invoice and related records deleted. Contracts reset for December.`);
      await Promise.all([load(), loadSummary()]);
      if (tab === 'auto') loadAuto();
    } catch (err) { setBillingMsg('Purge failed: ' + (err.response?.data?.error || 'Unknown error')); }
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice permanently?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      load();
      if (viewInv && viewInv.id === id) setViewInv(null);
      if (tab === 'auto') loadAuto();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  // Sort clients: active first, then by name
  const sortedClients = [...clients].sort((a, b) => {
    if (a.active !== b.active) return b.active - a.active;
    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
  });
  const visibleInvoices = invoices.filter(inv => { if (archiveView==='active' && inv.archived_at) return false; if (archiveView==='archived' && !inv.archived_at) return false; const q=search.toLowerCase().trim(); const match=!q || `${inv.invoice_number} ${inv.client_name} ${inv.client_email}`.toLowerCase().includes(q); const status=inv.display_status||inv.status; return match && (statusFilter==='all' || status===statusFilter); });

  // Printing is intentionally independent of invoice creation validation. This lets
  // staff preview/print a partially completed invoice before saving it.
  const selectedClient = clients.find(c => String(c.id) === String(form.client_id));
  const draftInvoice = {
    invoice_number: 'DRAFT',
    status: 'draft',
    created_at: new Date().toISOString(),
    client_name: selectedClient ? `${selectedClient.first_name || ''} ${selectedClient.last_name || ''}`.trim() : '',
    client_email: selectedClient?.email || '',
    client_phone: selectedClient?.phone || '',
    client_address: selectedClient?.address || '',
    client_city: selectedClient?.city || '',
    client_state: selectedClient?.state || '',
    client_zip: selectedClient?.zip || '',
    service_date: form.service_date,
    due_date: form.due_date,
    items: form.items.map((it, i) => ({
      id: i,
      description: it.description || '',
      quantity: parseFloat(it.quantity) || 0,
      unit_price: parseFloat(it.unit_price) || 0,
      total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
    })),
    subtotal,
    tax_rate: parseFloat(form.tax_rate) || 0,
    tax_amount: taxAmt,
    total,
    notes: form.notes || '',
  };

  return (
    <div>
      <div className="flex-between page-header">
        <div><h1>Invoices</h1><p>Create, manage, and send client invoices.</p></div>
        <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
          <button className="btn btn-secondary" onClick={previewBilling} disabled={billingPreviewLoading}>
            {billingPreviewLoading ? <span className="spinner" style={{ width:14, height:14 }} /> : 'Preview Billing'}
          </button>
          <button className="btn btn-secondary" onClick={runBilling} disabled={billingRunning}>
            {billingRunning ? <span className="spinner" style={{ width:14, height:14 }} /> : 'Run Billing Now'}
          </button>
          <button className="btn btn-secondary" onClick={purgeAllInvoices} style={{ color:'#b91c1c', borderColor:'#fecaca' }}>
            Delete All Invoices
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ New Invoice</button>
        </div>
      </div>

      {billingMsg && (
        <div className={`alert ${billingMsg.includes('failed') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom:'1rem' }}>
          {billingMsg}
        </div>
      )}

      {billingPreview && (
        <div className="card" style={{ marginBottom:'1rem', border:'1px solid #bfdbfe', background:'#eff6ff' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:'.75rem', alignItems:'flex-start', flexWrap:'wrap' }}>
            <div><h3 style={{ margin:0 }}>Billing preview for {billingPreview.run_date}</h3><p style={{ margin:'.35rem 0 0', color:'var(--gray-600)' }}>{billingPreview.eligible.length} ready to bill · {billingPreview.skipped.length} skipped</p></div>
            <button className="btn btn-secondary btn-sm" onClick={() => setBillingPreview(null)}>Close</button>
          </div>
          {billingPreview.skipped.length > 0 && <div style={{ marginTop:'.75rem', background:'#fff', borderRadius:8, padding:'.75rem' }}><strong>Skipped customers</strong>{billingPreview.skipped.map(c => <div key={c.id} style={{ display:'flex', justifyContent:'space-between', gap:'.5rem', padding:'.35rem 0', borderBottom:'1px solid #e5e7eb', fontSize:'.88rem' }}><span>{c.first_name} {c.last_name}</span><span style={{ color:'#b45309' }}>{c.reason}</span></div>)}</div>}
          {billingPreview.eligible.length > 0 && <div style={{ marginTop:'.75rem', color:'#166534', fontSize:'.9rem' }}><strong>Ready:</strong> {billingPreview.eligible.map(c => `${c.first_name} ${c.last_name} ($${Number(c.amount).toFixed(2)})`).join(', ')}</div>}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem' }}>
        <button
          className={`btn ${tab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('all')}
        >All Invoices ({invoices.length})</button>
        <button
          className={`btn ${tab === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('auto')}
        >Auto-Generated Log</button>
      </div>

      {summary && <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'.75rem', marginBottom:'1rem' }}>{[['Outstanding',`$${Number(summary.outstanding||0).toFixed(2)}`,'var(--blue-700)'],['Overdue',summary.overdue,'var(--red-600)'],['Collected this month',`$${Number(summary.collected_this_month||0).toFixed(2)}`,'var(--green-600)'],['Total collected',`$${Number(summary.collected||0).toFixed(2)}`,'var(--gray-700)']].map(([label,value,color])=><div className="card" key={label} style={{padding:'1rem'}}><div style={{color:'var(--gray-500)',fontSize:'.75rem'}}>{label}</div><div style={{fontSize:'1.35rem',fontWeight:800,color}}>{value}</div></div>)}</div>}

      {tab === 'all' && (
        <div className="card">
          <div style={{ display:'flex', gap:'.5rem', padding:'1rem', flexWrap:'wrap' }}><input className="form-control" style={{maxWidth:280}} placeholder="Search invoice or client..." value={search} onChange={e=>setSearch(e.target.value)} /><select className="form-control" style={{maxWidth:160}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="partial">Partial</option><option value="paid">Paid in full</option><option value="overdue">Overdue</option><option value="void">Void</option></select><button className="btn btn-secondary" onClick={exportInvoices}>Export CSV</button><button className="btn btn-secondary" onClick={archiveThroughYesterday}>Archive through yesterday</button><select className="form-control" style={{maxWidth:150}} value={archiveView} onChange={e=>setArchiveView(e.target.value)}><option value="active">Active invoices</option><option value="archived">Archived invoices</option><option value="all">All invoices</option></select></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ minWidth: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No invoices yet</td></tr>
                )}
                {visibleInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.invoice_number}</strong>
                      {inv.auto_generated && (
                        <span style={{ display:'inline-block', marginLeft:'.4rem', background:'#dbeafe', color:'#1e40af', fontSize:'.65rem', padding:'1px 5px', borderRadius:4, fontWeight:700 }}>AUTO</span>
                      )}
                    </td>
                    <td>{inv.client_name}</td>
                    <td><strong>${Number(inv.total).toFixed(2)}</strong></td>
                    <td>
                      <select
                        className="form-control"
                        style={{ fontSize:'.8rem', padding:'.25rem .5rem', width:'auto' }}
                        value={inv.display_status || inv.status}
                        onChange={e => setStatus(inv.id, e.target.value)}
                      >
                        {['draft','sent','partial','paid','overdue','void'].map(s => <option key={s} value={s}>{s === 'paid' ? 'Paid in full' : s}</option>)}
                      </select>
                      {(inv.display_status || inv.status) !== 'paid' && (inv.display_status || inv.status) !== 'void' && (
                        <button className="btn btn-sm" style={{ background:'#16a34a', color:'#fff', marginTop:'.35rem', whiteSpace:'nowrap' }} onClick={() => payInFull(inv)}>
                          Mark paid in full
                        </button>
                      )}
                    </td>
                    <td style={{ color:'var(--gray-400)', fontSize:'.8rem' }}>{inv.created_at?.slice(0,10)}</td>
                    <td>
                      <div style={{ display:'flex', gap:'.4rem', alignItems:'center', flexWrap:'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => viewFull(inv)}>View</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => scanReceipt(inv)}>Scan Receipt</button>
                        {(inv.display_status || inv.status) !== 'paid' && (inv.display_status || inv.status) !== 'void' && <button className="btn btn-sm" style={{background:'#16a34a',color:'#fff'}} onClick={() => payInFull(inv)}>Mark paid in full</button>}
                        {(inv.display_status || inv.status) !== 'paid' && <button className="btn btn-secondary btn-sm" onClick={() => remind(inv)}>Remind</button>}
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ background: sendMsg[inv.id] === 'success' ? 'var(--green-600)' : undefined }}
                          onClick={e => sendInvoice(inv, e)}
                          disabled={sending[inv.id]}
                          title={`Email invoice to ${inv.client_email || 'client'}`}
                        >
                          {sending[inv.id]
                            ? <span className="spinner" style={{ width:14, height:14 }} />
                            : sendMsg[inv.id] === 'success'
                              ? 'Sent!'
                              : 'Email'}
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background:'#16a34a', color:'#fff' }}
                          onClick={e => sendSms(inv, e)}
                          title={`Send invoice via SMS`}
                        >SMS</button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteInvoice(inv.id)}
                          title="Delete invoice"
                        >Del</button>
                      </div>
                      {sendMsg[inv.id] && sendMsg[inv.id] !== 'success' && (
                        <div style={{ color:'var(--red-600)', fontSize:'.75rem', marginTop:'.25rem' }}>
                          {sendMsg[inv.id]}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'auto' && (
        <div className="card">
          <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--gray-200)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <h3 style={{ margin:0 }}>Auto-Generated Invoices</h3>
              <p style={{ margin:'.25rem 0 0', color:'var(--gray-500)', fontSize:'.85rem' }}>
                Invoices automatically created by the monthly billing scheduler from signed contracts.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadAuto} disabled={autoLoading}>
              {autoLoading ? <span className="spinner" style={{ width:14, height:14 }} /> : 'Refresh'}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Contract</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {autoInvoices.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>
                    {autoLoading ? 'Loading...' : 'No auto-generated invoices yet. Set up monthly billing on contracts to enable.'}
                  </td></tr>
                )}
                {autoInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoice_number}</strong></td>
                    <td>{inv.client_name}</td>
                    <td style={{ fontSize:'.8rem', color:'var(--gray-600)' }}>{inv.contract_title || '—'}</td>
                    <td><strong>${Number(inv.total).toFixed(2)}</strong></td>
                    <td><span className={`badge ${STATUS_COLORS[inv.status] || 'badge-gray'}`}>{inv.status}</span></td>
                    <td style={{ fontSize:'.8rem' }}>
                      {inv.sent_at ? (
                        <span style={{ color:'var(--green-600)' }}>{new Date(inv.sent_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      ) : (
                        <span style={{ color:'var(--gray-400)' }}>Not sent</span>
                      )}
                    </td>
                    <td style={{ color:'var(--gray-400)', fontSize:'.8rem' }}>{inv.created_at?.slice(0,10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                    <option value="">Select client...</option>
                    {sortedClients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} — {c.email}{c.active ? '' : ' (inactive)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Service Date</label>
                    <input type="date" name="service_date" value={form.service_date} onChange={handleForm} className="form-control" />
                  </div>
                  <div className="form-group">
                    <label>Due Date</label>
                    <input type="date" name="due_date" value={form.due_date} onChange={handleForm} className="form-control" />
                  </div>
                </div>
                <label style={{ fontSize:'.85rem', fontWeight:600, color:'var(--gray-700)', display:'block', marginBottom:'.5rem' }}>Line Items</label>
                {form.items.map((it, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 100px 36px', gap:'.5rem', marginBottom:'.5rem', alignItems:'center' }}>
                    <input name="description" value={it.description} onChange={e => handleItem(i, e)} placeholder="Description" required className="form-control" />
                    <input name="quantity" type="number" min="0.01" step="0.01" value={it.quantity} onChange={e => handleItem(i, e)} placeholder="Qty" className="form-control" />
                    <input name="unit_price" type="number" min="0" step="0.01" value={it.unit_price} onChange={e => handleItem(i, e)} placeholder="Price" required className="form-control" />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)} disabled={form.items.length === 1}>x</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm mb-2" onClick={addItem}>+ Add Line Item</button>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tax Rate (%)</label>
                    <input type="number" name="tax_rate" value={form.tax_rate} onChange={handleForm} min="0" step="0.1" className="form-control" />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end', paddingBottom:'1rem' }}>
                    <div style={{ fontSize:'.85rem', color:'var(--gray-500)' }}>Subtotal: <strong>${subtotal.toFixed(2)}</strong></div>
                    <div style={{ fontSize:'.85rem', color:'var(--gray-500)' }}>Tax: <strong>${taxAmt.toFixed(2)}</strong></div>
                    <div style={{ fontWeight:700, color:'var(--blue-700)' }}>Total: ${total.toFixed(2)}</div>
                  </div>
                </div>
                <div className="form-group"><label>Notes</label><textarea name="notes" value={form.notes} onChange={handleForm} className="form-control" /></div>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end' }}>
                  <PrintInvoiceButton invoice={draftInvoice} label="🖨️ Print Preview" />
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
              <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: sendMsg[viewInv.id] === 'success' ? 'var(--green-600)' : undefined }}
                  onClick={e => sendInvoice(viewInv, e)}
                  disabled={sending[viewInv.id]}
                  title={`Email invoice to ${viewInv.client_email || 'client'}`}
                >
                  {sending[viewInv.id]
                    ? <span className="spinner" style={{ width:14, height:14 }} />
                    : sendMsg[viewInv.id] === 'success'
                      ? 'Sent!'
                      : 'Email'}
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background:'#16a34a', color:'#fff' }}
                  onClick={e => sendSms(viewInv, e)}
                >SMS</button>
                <PrintInvoiceButton invoice={viewInv} />
                <button className="modal-close" onClick={() => setViewInv(null)}>x</button>
              </div>
            </div>
            {sendMsg[viewInv.id] && sendMsg[viewInv.id] !== 'success' && (
              <div className="alert alert-error" style={{ margin:'0 1.25rem', borderRadius:6 }}>{sendMsg[viewInv.id]}</div>
            )}
            {sendMsg[viewInv.id] === 'success' && (
              <div className="alert alert-success" style={{ margin:'0 1.25rem', borderRadius:6 }}>Invoice emailed to {viewInv.client_email}</div>
            )}
            <div className="modal-body" style={{ padding: 0 }}>
              <BusinessHeader style={{ borderRadius: 0 }} />
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'1.1rem' }}>{viewInv.client_name}</div>
                    <div style={{ color:'var(--gray-500)', fontSize:'.85rem' }}>{viewInv.client_email}</div>
                    {viewInv.client_phone && (
                      <div style={{ color:'var(--gray-500)', fontSize:'.85rem' }}>{viewInv.client_phone}</div>
                    )}
                    {viewInv.client_address && (
                      <div style={{ color:'var(--gray-500)', fontSize:'.85rem' }}>
                        {viewInv.client_address}, {viewInv.client_city} {viewInv.client_state} {viewInv.client_zip}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span className={`badge ${STATUS_COLORS[viewInv.status] || 'badge-gray'}`} style={{ fontSize:'.85rem' }}>{viewInv.status}</span>
                    <div style={{ color:'var(--gray-400)', fontSize:'.8rem', marginTop:'.25rem' }}>{viewInv.created_at?.slice(0,10)}</div>
                    {viewInv.service_date && (
                      <div style={{ color:'var(--gray-600)', fontSize:'.75rem', marginTop:'.15rem' }}>
                        Service: {new Date(viewInv.service_date).toLocaleDateString()}
                      </div>
                    )}
                    {viewInv.due_date && (
                      <div style={{ color:'var(--gray-600)', fontSize:'.75rem', marginTop:'.15rem' }}>
                        Due: {new Date(viewInv.due_date).toLocaleDateString()}
                      </div>
                    )}
                    {viewInv.sent_at && (
                      <div style={{ color:'var(--green-600)', fontSize:'.75rem', marginTop:'.15rem' }}>
                        Last sent: {new Date(viewInv.sent_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
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
                  {viewInv.tax_rate > 0 && (
                    <div style={{ color:'var(--gray-500)', fontSize:'.88rem' }}>
                      Tax ({viewInv.tax_rate}%): ${Number(viewInv.tax_amount).toFixed(2)}
                    </div>
                  )}
                  <div style={{ fontWeight:800, fontSize:'1.2rem', color:'var(--blue-700)' }}>Total: ${Number(viewInv.total).toFixed(2)}</div>
                </div>
                {viewInv.notes && (
                  <div style={{ marginTop:'1rem', padding:'.75rem', background:'var(--gray-50)', borderRadius:'var(--radius)', fontSize:'.88rem', color:'var(--gray-600)' }}>
                    {viewInv.notes}
                  </div>
                )}
                <hr className="divider" />
                <PaymentSection invoiceTotal={viewInv.total} invoiceNumber={viewInv.invoice_number} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && <div className="modal-overlay" onClick={() => setPaymentModal(null)}><div className="modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>Record Payment</h2><button className="modal-close" onClick={()=>setPaymentModal(null)}>x</button></div><div className="modal-body"><p>Invoice <strong>{paymentModal.invoice_number}</strong> · Balance due <strong>${Math.max(Number(paymentModal.total)-Number(paymentModal.amount_paid||0),0).toFixed(2)}</strong></p>{paymentMsg&&<div className="alert alert-error">{paymentMsg}</div>}<form onSubmit={recordPayment}><div className="form-group"><label>Amount paid *</label><input className="form-control" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e=>setPaymentForm(f=>({...f,amount:e.target.value}))} required /></div><div className="form-group"><label>Payment method *</label><select className="form-control" value={paymentForm.payment_method} onChange={e=>setPaymentForm(f=>({...f,payment_method:e.target.value}))}><option value="check">Check</option><option value="cash">Cash</option><option value="venmo">Venmo</option><option value="cash_app">Cash App</option><option value="zelle">Zelle</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></div><div className="form-group"><label>Check number / reference</label><input className="form-control" value={paymentForm.reference} onChange={e=>setPaymentForm(f=>({...f,reference:e.target.value}))} placeholder="e.g. Check #1042" /></div><div className="form-group"><label>Notes</label><textarea className="form-control" value={paymentForm.notes} onChange={e=>setPaymentForm(f=>({...f,notes:e.target.value}))} placeholder="Mailed check, received date, deposit notes..." /></div><div style={{display:'flex',justifyContent:'flex-end',gap:'.5rem'}}><button type="button" className="btn btn-secondary" onClick={()=>setPaymentModal(null)}>Cancel</button><button className="btn btn-primary" type="submit">Save Payment</button></div></form></div></div></div>}

      {/* SMS Modal */}
      {smsModal && (
        <div className="modal-overlay" onClick={() => setSmsModal(null)}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Send Invoice via SMS</h2>
              <button className="modal-close" onClick={() => setSmsModal(null)}>x</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:'.85rem', color:'var(--gray-600)', marginBottom:'.75rem' }}>
                Copy the text below and send it to the client via your preferred messaging app.
              </p>
              {smsModal.phone && (
                <div style={{ marginBottom:'.75rem' }}>
                  <label style={{ fontSize:'.8rem', fontWeight:600, color:'var(--gray-700)' }}>Client Phone:</label>
                  <div style={{ fontWeight:700, fontSize:'1rem' }}>
                    <a href={`sms:${smsModal.phone}?body=${encodeURIComponent(smsModal.smsText)}`} style={{ color:'var(--blue-600)' }}>
                      {smsModal.phone}
                    </a>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Message Text:</label>
                <textarea
                  className="form-control"
                  value={smsModal.smsText}
                  readOnly
                  rows={10}
                  style={{ fontSize:'.85rem', fontFamily:'monospace' }}
                />
              </div>
              <div style={{ display:'flex', gap:'.5rem', justifyContent:'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => { navigator.clipboard.writeText(smsModal.smsText); alert('Copied to clipboard!'); }}
                >Copy Text</button>
                {smsModal.phone && (
                  <a
                    href={`sms:${smsModal.phone}?body=${encodeURIComponent(smsModal.smsText)}`}
                    className="btn"
                    style={{ background:'#16a34a', color:'#fff', textDecoration:'none', display:'inline-flex', alignItems:'center' }}
                  >Open SMS App</a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
