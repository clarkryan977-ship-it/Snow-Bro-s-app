import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';

// ─── Generate Contract Modal ──────────────────────────────────────────────────
function GenerateModal({ clients, onClose, onSuccess }) {
  const yr = new Date().getFullYear();
  const [form, setForm] = useState({
    title: `${yr} Lawn Care Service Agreement`,
    client_id: '',
    contract_type: 'lawn_care',
    start_date: `${yr}-04-01`,
    end_date: `${yr}-11-01`,
    rate: '200',
    deposit: '0',
    frequency: 'Weekly',
    service_details: 'Weekly lawn mowing, trimming, and property maintenance.',
  });
  const [step, setStep] = useState('form'); // 'form' | 'preview'
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  const handle = e => {
    const { name, value } = e.target;
    setForm(f => {
      const next = { ...f, [name]: value };
      // Auto-update title when contract_type changes
      if (name === 'contract_type') {
        const typeName = value === 'snow_removal' ? 'Snow Removal' : 'Lawn Care';
        next.title = `${yr} ${typeName} Service Agreement`;
      }
      return next;
    });
  };

  const loadPreview = async () => {
    if (!form.client_id) { setMsg('Please select a client first'); return; }
    setLoading(true); setMsg(null);
    try {
      const res = await api.post('/contracts/preview', {
        client_id: form.client_id,
        contract_type: form.contract_type,
        rate: form.rate,
        start_date: form.start_date,
        end_date: form.end_date,
        deposit: form.deposit,
        frequency: form.frequency,
        service_details: form.service_details,
      }, { responseType: 'text' });
      setPreviewHtml(res.data);
      setStep('preview');
    } catch (err) {
      setMsg('Preview failed: ' + (err.response?.data || err.message));
    } finally { setLoading(false); }
  };

  const send = async () => {
    setSending(true); setMsg(null);
    try {
      await api.post('/contracts/generate', {
        title: form.title,
        client_id: form.client_id,
        contract_type: form.contract_type,
        rate: form.rate,
        start_date: form.start_date,
        end_date: form.end_date,
        deposit: form.deposit,
        frequency: form.frequency,
        service_details: form.service_details,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setMsg('Failed: ' + (err.response?.data?.error || err.message));
      setSending(false);
    }
  };

  const inputStyle = {
    padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 14, width: '100%', boxSizing: 'border-box', minHeight: 42,
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 };
  const groupStyle = { marginBottom: 14 };

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'24px 16px', overflowY:'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth: step==='preview' ? 860 : 560, boxShadow:'0 20px 60px rgba(0,0,0,.25)', position:'relative' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid #e5e7eb' }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>
            {step === 'form' ? '📄 Generate Contract' : '👁️ Contract Preview'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#6b7280', lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:'20px 24px' }}>
          {msg && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', marginBottom:14, color:'#dc2626', fontSize:14 }}>
              {msg}
            </div>
          )}

          {/* ── FORM STEP ── */}
          {step === 'form' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div style={{ gridColumn:'1/-1', ...groupStyle }}>
                  <label style={labelStyle}>Contract Title</label>
                  <input name="title" value={form.title} onChange={handle} style={inputStyle} />
                </div>
                <div style={{ gridColumn:'1/-1', ...groupStyle }}>
                  <label style={labelStyle}>Client *</label>
                  <select name="client_id" value={form.client_id} onChange={handle} style={inputStyle}>
                    <option value="">Select client…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>
                    ))}
                  </select>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Contract Type</label>
                  <select name="contract_type" value={form.contract_type} onChange={handle} style={inputStyle}>
                    <option value="lawn_care">Lawn Care</option>
                    <option value="snow_removal">Snow Removal</option>
                  </select>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Service Frequency</label>
                  <select name="frequency" value={form.frequency} onChange={handle} style={inputStyle}>
                    {['Weekly','Bi-weekly','Monthly','As needed'].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Service Start Date</label>
                  <input type="date" name="start_date" value={form.start_date} onChange={handle} style={inputStyle} />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Service End Date</label>
                  <input type="date" name="end_date" value={form.end_date} onChange={handle} style={inputStyle} />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Rate ($/period)</label>
                  <input type="number" name="rate" value={form.rate} onChange={handle} min="0" step="0.01" style={inputStyle} placeholder="e.g. 200" />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Deposit ($)</label>
                  <input type="number" name="deposit" value={form.deposit} onChange={handle} min="0" step="0.01" style={inputStyle} placeholder="0" />
                </div>
                <div style={{ gridColumn:'1/-1', ...groupStyle }}>
                  <label style={labelStyle}>Service Details / Notes</label>
                  <textarea
                    name="service_details" value={form.service_details} onChange={handle}
                    rows={3} style={{ ...inputStyle, minHeight:80, resize:'vertical' }}
                    placeholder="Describe the services to be provided…"
                  />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={onClose} style={{ padding:'10px 18px', borderRadius:8, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontWeight:600, fontSize:14 }}>
                  Cancel
                </button>
                <button
                  onClick={loadPreview}
                  disabled={loading || !form.client_id}
                  style={{ padding:'10px 20px', borderRadius:8, border:'none', background: form.client_id ? '#2563eb' : '#93c5fd', color:'#fff', cursor: form.client_id ? 'pointer' : 'not-allowed', fontWeight:700, fontSize:14 }}
                >
                  {loading ? '⏳ Loading…' : '👁️ Preview Contract →'}
                </button>
              </div>
            </>
          )}

          {/* ── PREVIEW STEP ── */}
          {step === 'preview' && (
            <>
              <div style={{ marginBottom:14, padding:'10px 14px', background:'#eff6ff', borderRadius:8, border:'1px solid #bfdbfe', fontSize:13, color:'#1e40af' }}>
                ✅ Review the contract below. Click <strong>Send to Client</strong> to save and email the signing link, or go back to edit.
              </div>
              <iframe
                srcDoc={previewHtml}
                title="Contract Preview"
                style={{ width:'100%', height:520, border:'1px solid #e5e7eb', borderRadius:8, marginBottom:16 }}
                sandbox="allow-same-origin"
              />
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => setStep('form')} style={{ padding:'10px 18px', borderRadius:8, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontWeight:600, fontSize:14 }}>
                  ← Edit Fields
                </button>
                <button
                  onClick={send}
                  disabled={sending}
                  style={{ padding:'10px 20px', borderRadius:8, border:'none', background: sending ? '#6b7280' : '#16a34a', color:'#fff', cursor: sending ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:14 }}
                >
                  {sending ? '⏳ Sending…' : '✉️ Send to Client'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Contract Modal ────────────────────────────────────────────────────
function UploadModal({ clients, onClose, onSuccess }) {
  const [form, setForm] = useState({ title:'', description:'', client_id:'' });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

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
      onSuccess();
      onClose();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Upload failed');
    } finally { setLoading(false); }
  };

  const inputStyle = { padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, width:'100%', boxSizing:'border-box', minHeight:42 };
  const labelStyle = { fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:4 };

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'24px 16px', overflowY:'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid #e5e7eb' }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>📎 Upload Contract</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#6b7280' }}>×</button>
        </div>
        <div style={{ padding:'20px 24px' }}>
          {msg && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', marginBottom:14, color:'#dc2626', fontSize:14 }}>{msg}</div>}
          <form onSubmit={upload}>
            <div style={{ marginBottom:14 }}>
              <label style={labelStyle}>Contract Title *</label>
              <input name="title" value={form.title} onChange={handle} required style={inputStyle} placeholder="e.g. 2024 Lawn Service Agreement" />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={labelStyle}>Assign to Client *</label>
              <select name="client_id" value={form.client_id} onChange={handle} required style={inputStyle}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={labelStyle}>Description (optional)</label>
              <textarea name="description" value={form.description} onChange={handle} style={{ ...inputStyle, minHeight:70, resize:'vertical' }} placeholder="Brief description…" />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={labelStyle}>Document File * <span style={{ color:'#9ca3af', fontWeight:400 }}>(PDF, DOC, DOCX, TXT, image — max 20 MB)</span></label>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} style={inputStyle} />
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" onClick={onClose} style={{ padding:'10px 18px', borderRadius:8, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontWeight:600, fontSize:14 }}>Cancel</button>
              <button type="submit" disabled={loading} style={{ padding:'10px 20px', borderRadius:8, border:'none', background:'#2563eb', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:14 }}>
                {loading ? '⏳ Uploading…' : '📎 Upload & Assign'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Main Contracts Page ──────────────────────────────────────────────────────
export default function AdminContracts() {
  const [contracts, setContracts] = useState([]);
  const [clients, setClients]     = useState([]);
  const [modal, setModal]         = useState(null); // null | 'generate' | 'upload'

  const load = useCallback(() => {
    api.get('/contracts').then(r => setContracts(r.data)).catch(() => {});
    api.get('/clients').then(r => setClients(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async id => {
    if (!confirm('Delete this contract?')) return;
    await api.delete(`/contracts/${id}`).catch(() => {});
    load();
  };

  const viewFile = id => {
    window.open(`${window.location.origin}/api/contracts/${id}/view`, '_blank', 'noopener');
  };

  const downloadSigned = id => {
    window.open(`${window.location.origin}/api/contracts/${id}/signed-file`, '_blank', 'noopener');
  };

  return (
    <div style={{ padding:'0 0 40px' }}>
      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800 }}>📄 Contracts</h1>
          <p style={{ margin:'4px 0 0', color:'#6b7280', fontSize:14 }}>Generate and manage client service agreements.</p>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button
            onClick={() => setModal('generate')}
            style={{ padding:'10px 18px', borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 }}
          >
            ✍️ Generate Contract
          </button>
          <button
            onClick={() => setModal('upload')}
            style={{ padding:'10px 18px', borderRadius:8, border:'none', background:'#2563eb', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 }}
          >
            📎 Upload Contract
          </button>
        </div>
      </div>

      {/* Contracts table */}
      <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 1px 6px rgba(0,0,0,.08)', overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
          <thead>
            <tr style={{ background:'#f8fafc' }}>
              {['Title','Client','Type','Status','Signed','Date','Actions'].map(h => (
                <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontWeight:700, color:'#374151', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign:'center', color:'#9ca3af', padding:'2rem' }}>No contracts yet</td></tr>
            )}
            {contracts.map(c => (
              <tr key={c.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ fontWeight:600 }}>{c.title}</div>
                  {c.original_name && c.original_name !== 'Generated Contract' && (
                    <div style={{ fontSize:12, color:'#9ca3af' }}>{c.original_name}</div>
                  )}
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ fontWeight:500 }}>{c.client_name}</div>
                  <div style={{ fontSize:12, color:'#9ca3af' }}>{c.client_email}</div>
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <span style={{
                    background: c.contract_type === 'snow_removal' ? '#eff6ff' : '#f0fdf4',
                    color: c.contract_type === 'snow_removal' ? '#1d4ed8' : '#16a34a',
                    fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:10,
                  }}>
                    {c.contract_type === 'snow_removal' ? '❄️ Snow' : '🌿 Lawn'}
                  </span>
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <span style={{
                    background: c.status === 'signed' ? '#f0fdf4' : '#fefce8',
                    color: c.status === 'signed' ? '#16a34a' : '#ca8a04',
                    fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:10,
                  }}>
                    {c.status === 'signed' ? '✅ Signed' : '⏳ Pending'}
                  </span>
                </td>
                <td style={{ padding:'12px 14px' }}>
                  {c.status === 'signed' ? (
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{c.signer_name}</div>
                      <div style={{ fontSize:12, color:'#9ca3af' }}>{c.signed_at ? new Date(c.signed_at).toLocaleDateString() : ''}</div>
                    </div>
                  ) : <span style={{ color:'#d1d5db' }}>—</span>}
                </td>
                <td style={{ padding:'12px 14px', fontSize:13, color:'#9ca3af', whiteSpace:'nowrap' }}>{c.created_at?.slice(0,10)}</td>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button
                      onClick={() => viewFile(c.id)}
                      style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontWeight:600, fontSize:12 }}
                    >
                      👁️ View
                    </button>
                    {c.status === 'signed' && c.signed_file_path && (
                      <button
                        onClick={() => downloadSigned(c.id)}
                        style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #bfdbfe', background:'#eff6ff', color:'#1d4ed8', cursor:'pointer', fontWeight:600, fontSize:12 }}
                      >
                        ⬇ Signed
                      </button>
                    )}
                    <button
                      onClick={() => del(c.id)}
                      style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', cursor:'pointer', fontWeight:600, fontSize:12 }}
                    >
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal === 'generate' && (
        <GenerateModal clients={clients} onClose={() => setModal(null)} onSuccess={load} />
      )}
      {modal === 'upload' && (
        <UploadModal clients={clients} onClose={() => setModal(null)} onSuccess={load} />
      )}
    </div>
  );
}
