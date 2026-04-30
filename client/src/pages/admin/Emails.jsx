import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminEmails() {
  const [clients, setClients] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ subject:'', body:'', recipient_ids:[] });
  const [allClients, setAllClients] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {});
    api.get('/emails/history').then(r => setHistory(r.data)).catch(() => {});
  }, []);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const toggleClient = id => {
    setForm(f => {
      const ids = f.recipient_ids.includes(id)
        ? f.recipient_ids.filter(x => x !== id)
        : [...f.recipient_ids, id];
      return { ...f, recipient_ids: ids };
    });
  };

  const send = async e => {
    e.preventDefault(); setLoading(true); setResult(null);
    try {
      const payload = { ...form, recipient_ids: allClients ? [] : form.recipient_ids };
      const { data } = await api.post('/emails/send', payload);
      setResult({ type:'success', msg: data.message, recipients: data.recipients });
      setForm({ subject:'', body:'', recipient_ids:[] });
      api.get('/emails/history').then(r => setHistory(r.data)).catch(() => {});
    } catch (err) {
      setResult({ type:'error', msg: err.response?.data?.error || 'Failed to send' });
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>📧 Email Blast</h1>
        <p>Compose and send promotional emails to your client list.</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'1.5rem', alignItems:'start' }}>
        <div>
          <div className="card">
            {result && (
              <div className={`alert alert-${result.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom:'1rem' }}>
                {result.msg}
                {result.recipients && (
                  <ul style={{ marginTop:'.5rem', paddingLeft:'1.2rem', fontSize:'.82rem' }}>
                    {result.recipients.slice(0,5).map(r => <li key={r.email}>{r.name} &lt;{r.email}&gt;</li>)}
                    {result.recipients.length > 5 && <li>…and {result.recipients.length - 5} more</li>}
                  </ul>
                )}
              </div>
            )}
            <form onSubmit={send}>
              <div className="form-group">
                <label>Recipients</label>
                <div style={{ display:'flex', gap:'1rem', marginBottom:'.5rem' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'.4rem', fontWeight:400, cursor:'pointer' }}>
                    <input type="radio" checked={allClients} onChange={() => setAllClients(true)} /> All Clients ({clients.length})
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:'.4rem', fontWeight:400, cursor:'pointer' }}>
                    <input type="radio" checked={!allClients} onChange={() => setAllClients(false)} /> Select Specific
                  </label>
                </div>
                {!allClients && (
                  <div style={{ maxHeight:160, overflowY:'auto', border:'1.5px solid var(--gray-200)', borderRadius:'var(--radius)', padding:'.5rem' }}>
                    {clients.map(c => (
                      <label key={c.id} style={{ display:'flex', alignItems:'center', gap:'.5rem', padding:'.3rem 0', cursor:'pointer', fontWeight:400 }}>
                        <input type="checkbox" checked={form.recipient_ids.includes(c.id)} onChange={() => toggleClient(c.id)} />
                        {c.first_name} {c.last_name} — {c.email}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <input name="subject" value={form.subject} onChange={handle} required className="form-control" placeholder="e.g. Spring Lawn Care Special — 20% Off!" />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea name="body" value={form.body} onChange={handle} required className="form-control" rows={8} placeholder="Write your promotional message here…" />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? <span className="spinner" /> : `📧 Send to ${allClients ? 'All Clients' : `${form.recipient_ids.length} Selected`}`}
              </button>
            </form>
          </div>
        </div>

        <div>
          <div className="card">
            <h3 style={{ fontWeight:700, marginBottom:'1rem' }}>📋 Sent History</h3>
            {history.length === 0 && <p style={{ color:'var(--gray-400)', fontSize:'.88rem' }}>No emails sent yet.</p>}
            {history.map(h => (
              <div key={h.id} style={{ borderBottom:'1px solid var(--gray-100)', paddingBottom:'.75rem', marginBottom:'.75rem' }}>
                <div style={{ fontWeight:600, fontSize:'.9rem' }}>{h.subject}</div>
                <div style={{ fontSize:'.78rem', color:'var(--gray-400)' }}>{h.recipients_count} recipients · {h.sent_at ? new Date(h.sent_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
