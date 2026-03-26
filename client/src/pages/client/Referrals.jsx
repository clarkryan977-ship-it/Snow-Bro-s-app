import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function ClientReferrals() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/referrals/my').then(r => setData(r.data)).catch(() => {});
  }, []);

  const copyCode = () => {
    if (!data?.referral_code) return;
    const url = `${window.location.origin}/register?ref=${data.referral_code}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const shareLink = () => {
    if (!data?.referral_code) return;
    const url = `${window.location.origin}/register?ref=${data.referral_code}`;
    if (navigator.share) {
      navigator.share({ title: "Snow Bro's Lawn Care", text: 'Sign up and we both get $10 off!', url });
    } else {
      copyCode();
    }
  };

  if (!data) return <div className="flex-center" style={{ height:'60vh' }}><span className="spinner" /></div>;

  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'1.5rem 1rem' }}>
      <h1 style={{ fontSize:'1.5rem', fontWeight:700, marginBottom:'.5rem' }}>🎁 Refer a Friend</h1>
      <p style={{ color:'var(--gray-500)', marginBottom:'1.5rem' }}>Share your referral link and earn $10 credit for each friend who signs up!</p>

      <div className="card" style={{ textAlign:'center', marginBottom:'1.5rem', background:'linear-gradient(135deg, var(--blue-50), #fff)' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>🎁</div>
        <div style={{ fontSize:'.85rem', color:'var(--gray-500)', marginBottom:'.75rem' }}>Your Referral Code</div>
        <div style={{ fontSize:'1.8rem', fontWeight:800, color:'var(--blue-700)', letterSpacing:3, marginBottom:'1rem' }}>{data.referral_code}</div>
        <div style={{ display:'flex', gap:'.75rem', justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn btn-primary" onClick={copyCode}>
            {copied ? '✅ Copied!' : '📋 Copy Link'}
          </button>
          <button className="btn btn-secondary" onClick={shareLink}>📤 Share</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom:'1.5rem', textAlign:'center' }}>
        <div style={{ fontSize:'1.8rem', fontWeight:800, color:'#059669' }}>${data.credits.toFixed(2)}</div>
        <div style={{ fontSize:'.85rem', color:'var(--gray-500)' }}>Total Referral Credits Earned</div>
      </div>

      {data.referrals.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight:700, marginBottom:'.75rem' }}>Your Referrals</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Friend</th><th>Status</th><th>Credit</th></tr></thead>
              <tbody>
                {data.referrals.map(r => (
                  <tr key={r.id}>
                    <td>{r.referred_name || r.referred_email || 'Pending'}</td>
                    <td><span className={`badge badge-${r.status === 'completed' ? 'green' : 'yellow'}`} style={{ textTransform:'capitalize' }}>{r.status}</span></td>
                    <td style={{ fontWeight:600, color:'#059669' }}>${r.discount_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
