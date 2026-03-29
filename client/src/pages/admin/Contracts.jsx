import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp = {
  padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: 14, width: '100%', boxSizing: 'border-box',
};
const lbl = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 };
const grp = { marginBottom: 14 };
const btn = (bg, col = '#fff') => ({
  padding: '10px 18px', borderRadius: 8, border: 'none', background: bg,
  color: col, fontWeight: 700, cursor: 'pointer', fontSize: 14,
});

// ─── Step 1: Type Selector ────────────────────────────────────────────────────
function TypeSelector({ onSelect }) {
  const types = [
    {
      value: 'snow_removal',
      icon: '❄️',
      label: 'Snow Removal',
      desc: 'Seasonal snow plowing & removal. Rate per visit or monthly flat rate.',
      bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8',
    },
    {
      value: 'lawn_care',
      icon: '🌿',
      label: 'Lawn Care',
      desc: 'Recurring mowing & maintenance. Weekly, bi-weekly, or monthly.',
      bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a',
    },
    {
      value: 'landscape',
      icon: '🌱',
      label: 'Landscape Project',
      desc: 'One-time project with materials, labor, and payment milestones.',
      bg: '#fef9c3', border: '#fde68a', color: '#92400e',
    },
    {
      value: 'junk_removal',
      icon: '🚛',
      label: 'Junk Removal / Construction Clean-Up',
      desc: 'One-time haul-away of junk, debris, or construction waste. Flat rate or hourly.',
      bg: '#fdf4ff', border: '#e9d5ff', color: '#7c3aed',
    },
  ];
  return (
    <div>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
        Choose the type of agreement to generate:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {types.map(t => (
          <button
            key={t.value}
            onClick={() => onSelect(t.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px', borderRadius: 10,
              border: `2px solid ${t.border}`, background: t.bg,
              cursor: 'pointer', textAlign: 'left', width: '100%',
            }}
          >
            <span style={{ fontSize: 32 }}>{t.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.color }}>{t.label}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{t.desc}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 18, color: t.color }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Snow Removal Fields ─────────────────────────────────────────────
function SnowFields({ form, handle }) {
  const yr = new Date().getFullYear();
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={grp}>
          <label style={lbl}>Season Start</label>
          <input type="date" name="start_date" value={form.start_date} onChange={handle} style={inp} />
        </div>
        <div style={grp}>
          <label style={lbl}>Season End</label>
          <input type="date" name="end_date" value={form.end_date} onChange={handle} style={inp} />
        </div>
        <div style={grp}>
          <label style={lbl}>Rate Per Visit ($)</label>
          <input type="number" name="rate_per_visit" value={form.rate_per_visit} onChange={handle} min="0" step="0.01" style={inp} placeholder="e.g. 75" />
        </div>
        <div style={grp}>
          <label style={lbl}>Monthly Rate ($) <span style={{ color: '#9ca3af', fontWeight: 400 }}>optional</span></label>
          <input type="number" name="monthly_rate" value={form.monthly_rate} onChange={handle} min="0" step="0.01" style={inp} placeholder="flat monthly rate" />
        </div>
        <div style={{ gridColumn: '1/-1', ...grp }}>
          <label style={lbl}>Payment Terms</label>
          <input name="payment_terms" value={form.payment_terms} onChange={handle} style={inp} placeholder="e.g. Due within 7 days of invoice" />
        </div>
        <div style={{ gridColumn: '1/-1', ...grp }}>
          <label style={lbl}>Services Included</label>
          <textarea name="service_details" value={form.service_details} onChange={handle} rows={3} style={{ ...inp, resize: 'vertical' }} />
        </div>
      </div>
    </>
  );
}

// ─── Step 2: Lawn Care Fields ─────────────────────────────────────────────────
function LawnFields({ form, handle }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={grp}>
          <label style={lbl}>Service Start Date</label>
          <input type="date" name="start_date" value={form.start_date} onChange={handle} style={inp} />
        </div>
        <div style={grp}>
          <label style={lbl}>Service End Date</label>
          <input type="date" name="end_date" value={form.end_date} onChange={handle} style={inp} />
        </div>
        <div style={grp}>
          <label style={lbl}>Frequency</label>
          <select name="frequency" value={form.frequency} onChange={handle} style={inp}>
            {['Weekly', 'Bi-weekly', 'Monthly', 'As needed'].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div style={grp}>
          <label style={lbl}>Monthly Rate ($)</label>
          <input type="number" name="monthly_rate" value={form.monthly_rate} onChange={handle} min="0" step="0.01" style={inp} placeholder="e.g. 200" />
        </div>
        <div style={{ gridColumn: '1/-1', ...grp }}>
          <label style={lbl}>Payment Terms</label>
          <input name="payment_terms" value={form.payment_terms} onChange={handle} style={inp} placeholder="e.g. Due on the 1st of each month" />
        </div>
        <div style={{ gridColumn: '1/-1', ...grp }}>
          <label style={lbl}>Services Included</label>
          <textarea name="service_details" value={form.service_details} onChange={handle} rows={3} style={{ ...inp, resize: 'vertical' }} />
        </div>
      </div>
    </>
  );
}

// ─── Step 2: Landscape Fields ─────────────────────────────────────────────────
function LandscapeFields({ form, handle, lineItems, setLineItems }) {
  const addItem = () => setLineItems(prev => [...prev, { name: '', qty: 1, unitCost: 0 }]);
  const removeItem = i => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setLineItems(prev => {
    const next = [...prev];
    next[i] = { ...next[i], [field]: val };
    return next;
  });
  const materialTotal = lineItems.reduce((s, it) => s + (parseFloat(it.qty || 0) * parseFloat(it.unitCost || 0)), 0);
  const laborTotal = parseFloat(form.labor_hours || 0) * parseFloat(form.labor_rate || 0);
  const projectTotal = materialTotal + laborTotal;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={grp}>
          <label style={lbl}>Project Start Date</label>
          <input type="date" name="start_date" value={form.start_date} onChange={handle} style={inp} />
        </div>
        <div style={grp}>
          <label style={lbl}>Estimated Completion</label>
          <input type="date" name="end_date" value={form.end_date} onChange={handle} style={inp} />
        </div>
        <div style={{ gridColumn: '1/-1', ...grp }}>
          <label style={lbl}>Project Description / Scope of Work</label>
          <textarea name="project_description" value={form.project_description} onChange={handle} rows={3} style={{ ...inp, resize: 'vertical' }} />
        </div>
      </div>

      {/* Materials Line Items */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ ...lbl, margin: 0 }}>Materials</label>
          <button onClick={addItem} style={{ ...btn('#2563eb'), padding: '5px 12px', fontSize: 12 }}>+ Add Item</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '7px 8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 700 }}>Item / Material</th>
              <th style={{ padding: '7px 8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', fontWeight: 700, width: 70 }}>Qty</th>
              <th style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', fontWeight: 700, width: 100 }}>Unit Cost</th>
              <th style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', fontWeight: 700, width: 90 }}>Total</th>
              <th style={{ width: 32, borderBottom: '2px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((it, i) => (
              <tr key={i}>
                <td style={{ padding: '4px 4px' }}>
                  <input value={it.name} onChange={e => updateItem(i, 'name', e.target.value)} style={{ ...inp, padding: '6px 8px' }} placeholder="e.g. Topsoil (cu yd)" />
                </td>
                <td style={{ padding: '4px 4px' }}>
                  <input type="number" value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} min="0" style={{ ...inp, padding: '6px 8px', textAlign: 'center' }} />
                </td>
                <td style={{ padding: '4px 4px' }}>
                  <input type="number" value={it.unitCost} onChange={e => updateItem(i, 'unitCost', e.target.value)} min="0" step="0.01" style={{ ...inp, padding: '6px 8px', textAlign: 'right' }} placeholder="0.00" />
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>
                  ${(parseFloat(it.qty || 0) * parseFloat(it.unitCost || 0)).toFixed(2)}
                </td>
                <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                  <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1 }}>×</button>
                </td>
              </tr>
            ))}
            {lineItems.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '10px 8px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>No materials added yet</td></tr>
            )}
          </tbody>
          {lineItems.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f0f4f8' }}>
                <td colSpan={3} style={{ padding: '7px 8px', fontWeight: 700, textAlign: 'right' }}>Materials Subtotal</td>
                <td style={{ padding: '7px 8px', fontWeight: 700, textAlign: 'right' }}>${materialTotal.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Labor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={grp}>
          <label style={lbl}>Labor Hours</label>
          <input type="number" name="labor_hours" value={form.labor_hours} onChange={handle} min="0" style={inp} placeholder="e.g. 20" />
        </div>
        <div style={grp}>
          <label style={lbl}>Labor Rate ($/hr)</label>
          <input type="number" name="labor_rate" value={form.labor_rate} onChange={handle} min="0" step="0.01" style={inp} placeholder="e.g. 65" />
        </div>
        <div style={{ ...grp, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={lbl}>Labor Total</label>
          <div style={{ ...inp, background: '#f8fafc', color: '#1e3a5f', fontWeight: 700 }}>${laborTotal.toFixed(2)}</div>
        </div>
      </div>

      {/* Project Total */}
      <div style={{ background: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 15 }}>PROJECT TOTAL</span>
        <span style={{ fontWeight: 800, color: '#1d4ed8', fontSize: 18 }}>${projectTotal.toFixed(2)}</span>
      </div>

      {/* Payment Schedule */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Payment Schedule</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={grp}>
            <label style={{ ...lbl, fontWeight: 500 }}>Deposit Amount ($)</label>
            <input type="number" name="deposit_amount" value={form.deposit_amount} onChange={handle} min="0" step="0.01" style={inp} placeholder="0.00" />
          </div>
          <div style={grp}>
            <label style={{ ...lbl, fontWeight: 500 }}>Final Payment ($)</label>
            <input type="number" name="final_payment_amount" value={form.final_payment_amount} onChange={handle} min="0" step="0.01" style={inp} placeholder="0.00" />
          </div>
          <div style={grp}>
            <label style={{ ...lbl, fontWeight: 500 }}>Progress Payment ($)</label>
            <input type="number" name="milestone1_amount" value={form.milestone1_amount} onChange={handle} min="0" step="0.01" style={inp} placeholder="0.00" />
          </div>
          <div style={grp}>
            <label style={{ ...lbl, fontWeight: 500 }}>Progress Payment Description</label>
            <input name="milestone1_desc" value={form.milestone1_desc} onChange={handle} style={inp} placeholder="e.g. Upon 50% completion" />
          </div>
        </div>
      </div>

      <div style={grp}>
        <label style={lbl}>Payment Terms</label>
        <input name="payment_terms" value={form.payment_terms} onChange={handle} style={inp} placeholder="e.g. All payments due per schedule above" />
      </div>
    </>
  );
}

// ─── Step 2: Junk Removal Fields ────────────────────────────────────────────
function JunkFields({ form, handle }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={grp}>
          <label style={lbl}>Service Date</label>
          <input type="date" name="start_date" value={form.start_date} onChange={handle} style={inp} />
        </div>
        <div style={grp}>
          <label style={lbl}>Estimated Completion Date</label>
          <input type="date" name="end_date" value={form.end_date} onChange={handle} style={inp} />
        </div>
        <div style={grp}>
          <label style={lbl}>Flat Rate ($) <span style={{ color: '#9ca3af', fontWeight: 400 }}>optional</span></label>
          <input type="number" name="rate_per_visit" value={form.rate_per_visit} onChange={handle} min="0" step="0.01" style={inp} placeholder="e.g. 250" />
        </div>
        <div style={grp}>
          <label style={lbl}>Hourly Rate ($/hr) <span style={{ color: '#9ca3af', fontWeight: 400 }}>optional</span></label>
          <input type="number" name="monthly_rate" value={form.monthly_rate} onChange={handle} min="0" step="0.01" style={inp} placeholder="e.g. 85" />
        </div>
        <div style={{ gridColumn: '1/-1', ...grp }}>
          <label style={lbl}>Payment Terms</label>
          <input name="payment_terms" value={form.payment_terms} onChange={handle} style={inp} placeholder="e.g. Due upon completion" />
        </div>
        <div style={{ gridColumn: '1/-1', ...grp }}>
          <label style={lbl}>Scope of Work / Items to Remove</label>
          <textarea name="service_details" value={form.service_details} onChange={handle} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Describe items to be removed, location, access notes…" />
        </div>
      </div>
    </>
  );
}

// ─── Generate Contract Modal ──────────────────────────────────────────────────
function GenerateModal({ clients, onClose, onSuccess }) {
  const yr = new Date().getFullYear();
  const [step, setStep] = useState('type');   // 'type' | 'fields' | 'preview'
  const [contractType, setContractType] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [lineItems, setLineItems] = useState([
    { name: 'Topsoil (cubic yard)', qty: 5, unitCost: 45 },
    { name: 'Mulch (cubic yard)', qty: 3, unitCost: 38 },
    { name: 'Perennial plants', qty: 12, unitCost: 18 },
  ]);

  const defaultsByType = {
    snow_removal: {
      title: `${yr} Snow Removal Service Agreement`,
      client_id: '', start_date: `${yr}-11-01`, end_date: `${yr + 1}-04-01`,
      rate_per_visit: '75', monthly_rate: '',
      service_details: 'Snow plowing of driveway and walkways. Salting/sanding of entry points. Services triggered by 2+ inch snowfall.',
      payment_terms: 'Due within 7 days of invoice.',
    },
    lawn_care: {
      title: `${yr} Lawn Care Service Agreement`,
      client_id: '', start_date: `${yr}-04-01`, end_date: `${yr}-11-01`,
      monthly_rate: '200', frequency: 'Weekly',
      service_details: 'Weekly lawn mowing, edging, trimming, and blowing off hard surfaces.',
      payment_terms: 'Due on the 1st of each month.',
    },
    landscape: {
      title: `${yr} Landscape Service Agreement`,
      client_id: '', start_date: `${yr}-05-01`, end_date: `${yr}-06-30`,
      project_description: 'Full landscape installation including grading, planting, and hardscape.',
      labor_hours: '20', labor_rate: '65',
      deposit_amount: '500', milestone1_desc: 'Upon 50% project completion',
      milestone1_amount: '500', final_payment_amount: '0',
      payment_terms: 'All payments due per schedule. Late payments subject to 1.5% monthly finance charge.',
    },
    junk_removal: {
      title: `${yr} Junk Removal / Construction Clean-Up Agreement`,
      client_id: '', start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10),
      rate_per_visit: '150', monthly_rate: '',
      service_details: 'Haul-away of junk, debris, and construction waste as described. All items to be removed from designated area. Client responsible for ensuring access.',
      payment_terms: 'Due upon completion of service.',
    },
  };

  const [form, setForm] = useState({});

  const selectType = type => {
    setContractType(type);
    setForm(defaultsByType[type] || {});
    setStep('fields');
  };

  const handle = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const loadPreview = async () => {
    if (!form.client_id) { setMsg('Please select a client first'); return; }
    setLoading(true); setMsg(null);
    try {
      const payload = {
        ...form,
        contract_type: contractType,
        line_items: JSON.stringify(lineItems),
      };
      const res = await api.post('/contracts/preview', payload, { responseType: 'text' });
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
        ...form,
        contract_type: contractType,
        line_items: JSON.stringify(lineItems),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setMsg('Failed: ' + (err.response?.data?.error || err.message));
      setSending(false);
    }
  };

  const typeLabel = { snow_removal: '❄️ Snow Removal', lawn_care: '🌿 Lawn Care', landscape: '🌱 Landscape', junk_removal: '🚛 Junk Removal' };
  const stepTitle = step === 'type' ? '📄 Generate Contract' : step === 'preview' ? '👁️ Contract Preview' : `✍️ ${typeLabel[contractType] || ''} Agreement`;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: step === 'preview' ? 880 : 600, boxShadow: '0 20px 60px rgba(0,0,0,.25)', position: 'relative', marginBottom: 24 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step !== 'type' && (
              <button onClick={() => setStep(step === 'preview' ? 'fields' : 'type')} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                ← Back
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{stepTitle}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {msg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#dc2626', fontSize: 14 }}>
              {msg}
            </div>
          )}

          {/* STEP: TYPE SELECTOR */}
          {step === 'type' && <TypeSelector onSelect={selectType} />}

          {/* STEP: FIELDS FORM */}
          {step === 'fields' && (
            <>
              {/* Client + Title always shown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
                <div style={{ gridColumn: '1/-1', ...grp }}>
                  <label style={lbl}>Contract Title</label>
                  <input name="title" value={form.title || ''} onChange={handle} style={inp} />
                </div>
                <div style={{ gridColumn: '1/-1', ...grp }}>
                  <label style={lbl}>Client *</label>
                  <select name="client_id" value={form.client_id || ''} onChange={handle} style={inp}>
                    <option value="">Select client…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Per-type fields */}
              {contractType === 'snow_removal' && <SnowFields form={form} handle={handle} />}
              {contractType === 'lawn_care' && <LawnFields form={form} handle={handle} />}
              {contractType === 'landscape' && <LandscapeFields form={form} handle={handle} lineItems={lineItems} setLineItems={setLineItems} />}
              {contractType === 'junk_removal' && <JunkFields form={form} handle={handle} />}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={onClose} style={{ ...btn('#f9fafb', '#374151'), border: '1px solid #d1d5db' }}>Cancel</button>
                <button
                  onClick={loadPreview}
                  disabled={loading || !form.client_id}
                  style={{ ...btn(form.client_id ? '#2563eb' : '#93c5fd'), cursor: form.client_id ? 'pointer' : 'not-allowed' }}
                >
                  {loading ? '⏳ Loading…' : '👁️ Preview Contract →'}
                </button>
              </div>
            </>
          )}

          {/* STEP: PREVIEW */}
          {step === 'preview' && (
            <>
              <div style={{ marginBottom: 14, padding: '10px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, color: '#1e40af' }}>
                ✅ Review the contract below. Click <strong>Send to Client</strong> to save and email the signing link.
              </div>
              <iframe
                srcDoc={previewHtml}
                title="Contract Preview"
                style={{ width: '100%', height: 560, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 }}
                sandbox="allow-same-origin"
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setStep('fields')} style={{ ...btn('#f9fafb', '#374151'), border: '1px solid #d1d5db' }}>← Edit Fields</button>
                <button
                  onClick={send}
                  disabled={sending}
                  style={{ ...btn(sending ? '#6b7280' : '#16a34a'), cursor: sending ? 'not-allowed' : 'pointer' }}
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
  const [form, setForm] = useState({ title: '', description: '', client_id: '' });
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

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>📎 Upload Contract</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {msg && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#dc2626', fontSize: 14 }}>{msg}</div>}
          <form onSubmit={upload}>
            <div style={grp}>
              <label style={lbl}>Contract Title *</label>
              <input name="title" value={form.title} onChange={handle} required style={inp} placeholder="e.g. 2024 Lawn Service Agreement" />
            </div>
            <div style={grp}>
              <label style={lbl}>Assign to Client *</label>
              <select name="client_id" value={form.client_id} onChange={handle} required style={inp}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
              </select>
            </div>
            <div style={grp}>
              <label style={lbl}>Description (optional)</label>
              <textarea name="description" value={form.description} onChange={handle} style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Brief description…" />
            </div>
            <div style={grp}>
              <label style={lbl}>Document File * <span style={{ color: '#9ca3af', fontWeight: 400 }}>(PDF, DOC, DOCX, TXT, image — max 20 MB)</span></label>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} style={inp} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={onClose} style={{ ...btn('#f9fafb', '#374151'), border: '1px solid #d1d5db' }}>Cancel</button>
              <button type="submit" disabled={loading} style={btn('#2563eb')}>
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
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(null); // null | 'generate' | 'upload'

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

  const resend = async (id, clientName) => {
    if (!confirm(`Resend the signing link email to ${clientName}?`)) return;
    try {
      await api.post(`/contracts/${id}/resend`);
      alert('✅ Signing link resent successfully.');
    } catch (err) {
      alert('Failed to resend: ' + (err.response?.data?.error || err.message));
    }
  };

  const viewFile = id => window.open(`${window.location.origin}/api/contracts/${id}/view`, '_blank', 'noopener');
  const downloadSigned = id => window.open(`${window.location.origin}/api/contracts/${id}/signed-file`, '_blank', 'noopener');

  const typeBadge = type => {
    if (type === 'snow_removal') return { bg: '#eff6ff', color: '#1d4ed8', label: '❄️ Snow' };
    if (type === 'landscape')    return { bg: '#fef9c3', color: '#92400e', label: '🌱 Landscape' };
    if (type === 'junk_removal') return { bg: '#fdf4ff', color: '#7c3aed', label: '🚛 Junk' };
    return { bg: '#f0fdf4', color: '#16a34a', label: '🌿 Lawn' };
  };

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📄 Contracts</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Generate Snow Removal, Lawn Care, Landscape, or Junk Removal agreements and manage client contracts.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setModal('generate')} style={btn('#16a34a')}>✍️ Generate Contract</button>
          <button onClick={() => setModal('upload')} style={btn('#2563eb')}>📎 Upload Contract</button>
        </div>
      </div>

      {/* Contracts table */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,.08)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Title', 'Client', 'Type', 'Status', 'Signed', 'Date', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>No contracts yet</td></tr>
            )}
            {contracts.map(c => {
              const badge = typeBadge(c.contract_type);
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{c.title}</div>
                    {c.original_name && c.original_name !== 'Generated Contract' && (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.original_name}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 500 }}>{c.client_name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.client_email}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      background: c.status === 'signed' ? '#f0fdf4' : '#fefce8',
                      color: c.status === 'signed' ? '#16a34a' : '#ca8a04',
                      fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    }}>
                      {c.status === 'signed' ? '✅ Signed' : '⏳ Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.status === 'signed' ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.signer_name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.signed_at ? new Date(c.signed_at).toLocaleDateString() : ''}</div>
                      </div>
                    ) : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af', whiteSpace: 'nowrap' }}>{c.created_at?.slice(0, 10)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => viewFile(c.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        👁️ View
                      </button>
                      {c.status !== 'signed' && c.original_name === 'Generated Contract' && (
                        <button onClick={() => resend(c.id, c.client_name)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                          📧 Resend
                        </button>
                      )}
                      {c.status === 'signed' && c.signed_file_path && (
                        <button onClick={() => downloadSigned(c.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                          ⬇ Signed
                        </button>
                      )}
                      <button onClick={() => del(c.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal === 'generate' && <GenerateModal clients={clients} onClose={() => setModal(null)} onSuccess={load} />}
      {modal === 'upload' && <UploadModal clients={clients} onClose={() => setModal(null)} onSuccess={load} />}
    </div>
  );
}
