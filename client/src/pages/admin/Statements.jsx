import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function Statements() {
  const [statements, setStatements] = useState([]);
  const [form, setForm] = useState({ statement_type:'bank', institution:'', account_name:'', account_last4:'', period_start:'', period_end:'', ending_balance:'', total_inflows:'', total_outflows:'', notes:'' });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.get('/statements').then(r=>setStatements(r.data)).catch(()=>{});
  useEffect(()=>{ load(); }, []);
  const change = e => setForm(f=>({...f,[e.target.name]:e.target.value}));
  const submit = async e => { e.preventDefault(); if(!file) return setMsg('Choose a statement PDF or image first.'); const data=new FormData(); Object.entries(form).forEach(([k,v])=>data.append(k,v)); data.append('statement',file); try { await api.post('/statements',data,{headers:{'Content-Type':'multipart/form-data'}}); setMsg('Statement saved securely.'); setFile(null); setForm({ statement_type:'bank',institution:'',account_name:'',account_last4:'',period_start:'',period_end:'',ending_balance:'',total_inflows:'',total_outflows:'',notes:'' }); load(); } catch(err) { setMsg(err.response?.data?.error||'Could not save statement'); } };
  const remove = async id => { if(!window.confirm('Delete this statement?')) return; await api.delete(`/statements/${id}`); load(); };
  return <div>
    <div className="page-header"><h1>Financial Statements</h1><p>Private bookkeeping vault for bank and credit-card statements.</p></div>
    {msg && <div className={`alert ${msg.includes('saved')?'alert-success':'alert-error'}`}>{msg}</div>}
    <div className="card" style={{padding:'1.25rem',marginBottom:'1rem'}}><h2 style={{marginTop:0}}>Scan or upload a statement</h2><p style={{color:'var(--gray-500)',fontSize:'.85rem'}}>On your phone, choose the camera to scan a paper statement, or upload a PDF. Files are restricted to admin/manager access.</p>
      <form onSubmit={submit}><div className="form-row"><div className="form-group"><label>Statement type</label><select name="statement_type" value={form.statement_type} onChange={change} className="form-control"><option value="bank">Bank statement</option><option value="credit_card">Credit-card statement</option><option value="other">Other</option></select></div><div className="form-group"><label>Institution</label><input name="institution" value={form.institution} onChange={change} className="form-control" placeholder="Bank or card issuer" required /></div></div>
      <div className="form-row"><div className="form-group"><label>Account name</label><input name="account_name" value={form.account_name} onChange={change} className="form-control" placeholder="Business checking" /></div><div className="form-group"><label>Last 4 digits</label><input name="account_last4" value={form.account_last4} onChange={change} className="form-control" inputMode="numeric" maxLength="4" placeholder="1234" /></div></div>
      <div className="form-row"><div className="form-group"><label>Period start</label><input type="date" name="period_start" value={form.period_start} onChange={change} className="form-control" /></div><div className="form-group"><label>Period end</label><input type="date" name="period_end" value={form.period_end} onChange={change} className="form-control" /></div></div>
      <div className="form-row"><div className="form-group"><label>Ending balance</label><input type="number" step="0.01" name="ending_balance" value={form.ending_balance} onChange={change} className="form-control" /></div><div className="form-group"><label>Total inflows</label><input type="number" step="0.01" name="total_inflows" value={form.total_inflows} onChange={change} className="form-control" /></div><div className="form-group"><label>Total outflows</label><input type="number" step="0.01" name="total_outflows" value={form.total_outflows} onChange={change} className="form-control" /></div></div>
      <div className="form-group"><label>Notes</label><textarea name="notes" value={form.notes} onChange={change} className="form-control" placeholder="Reconciliation notes, missing transactions, etc." /></div>
      <div className="form-group"><label>Statement file</label><input type="file" accept="application/pdf,image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)} className="form-control" required /></div>
      <button className="btn btn-primary" type="submit">Save Statement</button></form>
    </div>
    <div className="card"><div className="table-wrap"><table><thead><tr><th>Type</th><th>Institution</th><th>Account</th><th>Period</th><th>Ending balance</th><th>File</th><th></th></tr></thead><tbody>{statements.length===0?<tr><td colSpan="7" style={{textAlign:'center',padding:'2rem',color:'var(--gray-500)'}}>No statements uploaded yet.</td></tr>:statements.map(s=><tr key={s.id}><td>{s.statement_type==='credit_card'?'Credit card':s.statement_type==='bank'?'Bank':'Other'}</td><td>{s.institution}</td><td>{s.account_name}{s.account_last4&&` ••••${s.account_last4}`}</td><td>{s.period_start||'—'} to {s.period_end||'—'}</td><td>{s.ending_balance==null?'—':`$${Number(s.ending_balance).toFixed(2)}`}</td><td><a href={`/api/statements/${s.id}/file?token=${localStorage.getItem('token')||sessionStorage.getItem('token')}`} target="_blank" rel="noreferrer">View</a></td><td><button className="btn btn-danger btn-sm" onClick={()=>remove(s.id)}>Delete</button></td></tr>)}</tbody></table></div></div>
  </div>;
}
