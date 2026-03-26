import { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import BusinessHeader from '../../components/BusinessHeader';

export default function ClientContracts() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [signing, setSigning] = useState(null);
  const [sigMode, setSigMode] = useState('draw'); // 'draw' | 'type'
  const [typedName, setTypedName] = useState('');
  const [signerName, setSignerName] = useState(user?.name || '');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const sigRef = useRef();

  const load = () => api.get('/contracts/my').then(r => setContracts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openSign = c => {
    setSigning(c);
    setSigMode('draw');
    setTypedName('');
    setSignerName(user?.name || '');
    setMsg(null);
    setTimeout(() => sigRef.current?.clear(), 100);
  };

  const clearSig = () => sigRef.current?.clear();

  const submitSign = async () => {
    if (!signerName.trim()) return setMsg({ type:'error', text:'Please enter your full name.' });

    let signature_data, signature_type;

    if (sigMode === 'draw') {
      if (!sigRef.current || sigRef.current.isEmpty()) {
        return setMsg({ type:'error', text:'Please draw your signature.' });
      }
      signature_data = sigRef.current.toDataURL('image/png');
      signature_type = 'drawn';
    } else {
      if (!typedName.trim()) return setMsg({ type:'error', text:'Please type your name as signature.' });
      signature_data = typedName.trim();
      signature_type = 'typed';
    }

    setLoading(true); setMsg(null);
    try {
      await api.post(`/contracts/${signing.id}/sign`, { signature_data, signature_type, signer_name: signerName });
      setMsg({ type:'success', text:'✅ Contract signed successfully!' });
      await load();
      setTimeout(() => setSigning(null), 1800);
    } catch (err) {
      setMsg({ type:'error', text: err.response?.data?.error || 'Signing failed' });
    } finally { setLoading(false); }
  };

  const viewFile = id => window.open(`/api/contracts/${id}/file`, '_blank');

  return (
    <div className="container" style={{ maxWidth:800, padding:'2rem 1rem' }}>
      <div className="page-header">
        <h1>📄 My Contracts</h1>
        <p>Review and electronically sign your service agreements.</p>
      </div>

      {contracts.length === 0 && (
        <div className="card text-center" style={{ padding:'3rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>📄</div>
          <p style={{ color:'var(--gray-500)' }}>No contracts assigned to your account yet.</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        {contracts.map(c => (
          <div key={c.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'.75rem' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'1.05rem' }}>{c.title}</div>
                {c.description && <div style={{ color:'var(--gray-500)', fontSize:'.88rem', marginTop:'.2rem' }}>{c.description}</div>}
                <div style={{ fontSize:'.78rem', color:'var(--gray-400)', marginTop:'.4rem' }}>
                  Received: {c.created_at?.slice(0,10)}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'.5rem' }}>
                <span className={`badge ${c.status === 'signed' ? 'badge-green' : 'badge-yellow'}`}>
                  {c.status === 'signed' ? '✅ Signed' : '⏳ Awaiting Signature'}
                </span>
                {c.status === 'signed' && (
                  <div style={{ fontSize:'.78rem', color:'var(--gray-400)', textAlign:'right' }}>
                    Signed by {c.signer_name}<br />
                    {c.signed_at ? new Date(c.signed_at).toLocaleString() : ''}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display:'flex', gap:'.75rem', marginTop:'1rem', flexWrap:'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => viewFile(c.id)}>
                👁 View Document
              </button>
              {c.status !== 'signed' && (
                <button className="btn btn-primary btn-sm" onClick={() => openSign(c)}>
                  ✍️ Sign Contract
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Signature modal */}
      {signing && (
        <div className="modal-overlay" onClick={() => setSigning(null)}>
          <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✍️ Sign: {signing.title}</h2>
              <button className="modal-close" onClick={() => setSigning(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <BusinessHeader compact={true} style={{ borderRadius: 0 }} />
              <div style={{ padding: '1.25rem' }}>
              {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}

              <div className="form-group">
                <label>Your Full Legal Name *</label>
                <input
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  className="form-control"
                  placeholder="Enter your full name"
                />
              </div>

              {/* Signature mode tabs */}
              <div style={{ display:'flex', background:'var(--gray-100)', borderRadius:'var(--radius)', padding:'4px', marginBottom:'1rem' }}>
                {[['draw','✍️ Draw Signature'],['type','⌨️ Type Name']].map(([key,label]) => (
                  <button key={key} onClick={() => setSigMode(key)} style={{
                    flex:1, padding:'.4rem', border:'none', borderRadius:'calc(var(--radius) - 2px)',
                    background: sigMode === key ? '#fff' : 'transparent',
                    fontWeight: sigMode === key ? 600 : 400, fontSize:'.88rem',
                    color: sigMode === key ? 'var(--blue-700)' : 'var(--gray-500)',
                    boxShadow: sigMode === key ? 'var(--shadow-sm)' : 'none',
                    transition:'all .15s'
                  }}>{label}</button>
                ))}
              </div>

              {sigMode === 'draw' ? (
                <div>
                  <div style={{ marginBottom:'.4rem', fontSize:'.82rem', color:'var(--gray-500)' }}>
                    Draw your signature below using your finger or mouse:
                  </div>
                  <div className="sig-canvas-wrap" style={{ height:160 }}>
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="#1a1a2e"
                      canvasProps={{ height: 160, style: { width:'100%', borderRadius:'var(--radius)' } }}
                    />
                  </div>
                  <button className="btn btn-secondary btn-sm mt-1" onClick={clearSig}>Clear</button>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom:'.4rem', fontSize:'.82rem', color:'var(--gray-500)' }}>
                    Type your name to use as your electronic signature:
                  </div>
                  <input
                    value={typedName}
                    onChange={e => setTypedName(e.target.value)}
                    className="form-control"
                    placeholder="Type your full name"
                    style={{ fontSize:'1.5rem', fontStyle:'italic', color:'#1a1a8e', letterSpacing:'.05em' }}
                  />
                  {typedName && (
                    <div style={{ marginTop:'.75rem', padding:'1rem', background:'var(--gray-50)', borderRadius:'var(--radius)', textAlign:'center' }}>
                      <div style={{ fontSize:'1.6rem', fontStyle:'italic', color:'#1a1a8e', letterSpacing:'.05em' }}>{typedName}</div>
                      <div style={{ fontSize:'.72rem', color:'var(--gray-400)', marginTop:'.3rem' }}>Preview of typed signature</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop:'1rem', padding:'.75rem', background:'var(--blue-50)', borderRadius:'var(--radius)', fontSize:'.8rem', color:'var(--blue-800)' }}>
                By clicking "Sign Contract" you agree that this electronic signature is legally binding and represents your agreement to the terms of this document. Timestamp: {new Date().toLocaleString()}
              </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSigning(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitSign} disabled={loading}>
                {loading ? <span className="spinner" /> : '✅ Sign Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
