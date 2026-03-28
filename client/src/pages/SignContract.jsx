import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import api from '../utils/api';
import BusinessHeader from '../components/BusinessHeader';
import SiteFooter from '../components/SiteFooter';

export default function SignContract() {
  const { token } = useParams();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [sigMode, setSigMode] = useState('draw'); // 'draw' | 'type'
  const [typedName, setTypedName] = useState('');
  const [signerName, setSignerName] = useState('');
  const sigRef = useRef();

  useEffect(() => {
    api.get(`/contracts/public/${token}`)
      .then(r => {
        setContract(r.data);
        setSignerName(r.data.client_name || '');
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Contract not found or expired.');
        setLoading(false);
      });
  }, [token]);

  const clearSig = () => sigRef.current?.clear();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!signerName.trim()) return alert('Please enter your full legal name.');

    let signature_data, signature_type;
    if (sigMode === 'draw') {
      if (!sigRef.current || sigRef.current.isEmpty()) return alert('Please draw your signature.');
      signature_data = sigRef.current.toDataURL('image/png');
      signature_type = 'drawn';
    } else {
      if (!typedName.trim()) return alert('Please type your name as signature.');
      signature_data = typedName.trim();
      signature_type = 'typed';
    }

    setSubmitting(true);
    try {
      await api.post(`/contracts/public/${token}/sign`, {
        signature_data,
        signature_type,
        signer_name: signerName
      });
      setSuccess(true);
      window.scrollTo(0, 0);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to sign contract.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="container text-center" style={{padding:'5rem'}}><span className="spinner" /></div>;
  if (error) return <div className="container text-center" style={{padding:'5rem'}}><div className="alert alert-error">{error}</div></div>;
  
  if (success) return (
    <div className="container" style={{maxWidth:800, padding:'4rem 1rem'}}>
      <div className="card text-center" style={{padding:'4rem 2rem'}}>
        <div style={{fontSize:'4rem', marginBottom:'1rem'}}>✅</div>
        <h1 style={{color:'var(--green-700)'}}>Contract Signed Successfully!</h1>
        <p style={{fontSize:'1.1rem', color:'var(--gray-600)', marginTop:'1rem'}}>
          Thank you, {signerName}. Your signed agreement for <strong>{contract.title}</strong> has been received.
        </p>
        <p style={{color:'var(--gray-500)', marginTop:'0.5rem'}}>
          A copy has been sent to your email and our office.
        </p>
        <button className="btn btn-primary mt-2" onClick={() => window.location.href = '/'}>Return to Home</button>
      </div>
    </div>
  );

  return (
    <div className="container" style={{maxWidth:900, padding:'2rem 1rem'}}>
      <BusinessHeader />
      
      <div className="card mt-2" style={{padding:'2rem'}}>
        <div className="flex-between" style={{borderBottom:'2px solid var(--gray-100)', paddingBottom:'1rem', marginBottom:'1.5rem'}}>
          <div>
            <h1 style={{margin:0, fontSize:'1.75rem'}}>{contract.title}</h1>
            <p style={{margin:0, color:'var(--gray-500)'}}>Service Agreement</p>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontWeight:700}}>Snow Bro's</div>
            <div style={{fontSize:'.85rem', color:'var(--gray-500)'}}>Moorhead, MN</div>
          </div>
        </div>

        <div className="contract-content" style={{
          maxHeight:'500px', 
          overflowY:'auto', 
          padding:'1.5rem', 
          background:'var(--gray-50)', 
          borderRadius:'var(--radius)',
          border:'1px solid var(--gray-200)',
          fontSize:'.95rem',
          lineHeight:'1.6',
          color:'#333'
        }}>
          <div dangerouslySetInnerHTML={{ __html: contract.contract_html }} />
        </div>

        <form onSubmit={handleSubmit} className="mt-2" style={{borderTop:'1px solid var(--gray-200)', paddingTop:'2rem'}}>
          <h3 style={{marginBottom:'1.5rem'}}>✍️ Sign Agreement</h3>
          
          <div className="form-group">
            <label style={{fontWeight:600}}>Full Legal Name *</label>
            <input 
              className="form-control" 
              value={signerName} 
              onChange={e => setSignerName(e.target.value)} 
              required 
              placeholder="Enter your full name"
            />
          </div>

          <div style={{display:'flex', background:'var(--gray-100)', borderRadius:'var(--radius)', padding:'4px', marginBottom:'1rem', maxWidth:400}}>
            {[['draw','✍️ Draw Signature'],['type','⌨️ Type Name']].map(([key,label]) => (
              <button key={key} type="button" onClick={() => setSigMode(key)} style={{
                flex:1, padding:'.5rem', border:'none', borderRadius:'calc(var(--radius) - 2px)',
                background: sigMode === key ? '#fff' : 'transparent',
                fontWeight: sigMode === key ? 600 : 400, fontSize:'.88rem',
                color: sigMode === key ? 'var(--blue-700)' : 'var(--gray-500)',
                boxShadow: sigMode === key ? 'var(--shadow-sm)' : 'none',
                transition:'all .15s'
              }}>{label}</button>
            ))}
          </div>

          {sigMode === 'draw' ? (
            <div style={{maxWidth:500}}>
              <div style={{marginBottom:'.5rem', fontSize:'.85rem', color:'var(--gray-500)'}}>Draw your signature below:</div>
              <div style={{border:'2px dashed var(--gray-300)', borderRadius:'var(--radius)', background:'#fff'}}>
                <SignatureCanvas 
                  ref={sigRef}
                  penColor="#1a1a2e"
                  canvasProps={{height: 180, style: {width:'100%', borderRadius:'var(--radius)'}}}
                />
              </div>
              <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={clearSig}>Clear</button>
            </div>
          ) : (
            <div style={{maxWidth:500}}>
              <div style={{marginBottom:'.5rem', fontSize:'.85rem', color:'var(--gray-500)'}}>Type your name as signature:</div>
              <input 
                className="form-control" 
                value={typedName} 
                onChange={e => setTypedName(e.target.value)} 
                placeholder="Type your name"
                style={{fontSize:'1.8rem', fontStyle:'italic', color:'#1a1a8e', fontFamily:'cursive'}}
              />
            </div>
          )}

          <div style={{marginTop:'2rem', padding:'1rem', background:'var(--blue-50)', borderRadius:'var(--radius)', fontSize:'.85rem', color:'var(--blue-800)', border:'1px solid var(--blue-100)'}}>
            By clicking "Sign & Submit", I agree that this electronic signature is as legally binding as a handwritten signature and that I have read and agree to the terms of this {contract.title}.
          </div>

          <div className="mt-2">
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} style={{width:'100%', padding:'1rem'}}>
              {submitting ? <span className="spinner" /> : '✅ Sign & Submit Agreement'}
            </button>
          </div>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
}
