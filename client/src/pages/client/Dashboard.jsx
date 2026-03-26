import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    api.get('/contracts/my').then(r => setContracts(r.data)).catch(() => {});
  }, []);

  const pending = contracts.filter(c => c.status !== 'signed').length;

  const cards = [
    { to:'/client/history', icon:'📋', title:'Service History', desc:'View past jobs and leave reviews' },
    { to:'/client/contracts', icon:'📄', title:'Contracts', desc:'View and sign your contracts' },
    { to:'/client/invoices', icon:'🧾', title:'Invoices', desc:'View and pay your invoices' },
    { to:'/client/recurring', icon:'🔄', title:'Recurring Services', desc:'Set up automatic scheduling' },
    { to:'/client/referrals', icon:'🎁', title:'Refer a Friend', desc:'Earn $10 for each referral' },
    { to:'/pay', icon:'💳', title:'Make Payment', desc:'Pay via Venmo or Zelle' },
    { to:'/book', icon:'📅', title:'Book Service', desc:'Schedule a new service' },
    { to:'/reviews', icon:'⭐', title:'Reviews', desc:'See what customers say' },
  ];

  return (
    <div className="container" style={{ maxWidth:800, padding:'2rem 1rem' }}>
      <div className="page-header">
        <h1>👋 Welcome, {user?.name?.split(' ')[0]}!</h1>
        <p>Your Snow Bro's client portal.</p>
      </div>

      {pending > 0 && (
        <div className="alert alert-info mb-2">
          📄 You have <strong>{pending}</strong> contract{pending > 1 ? 's' : ''} awaiting your signature.{' '}
          <Link to="/client/contracts">Review & Sign →</Link>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'1rem' }}>
        {cards.map(c => (
          <Link key={c.to} to={c.to} style={{ textDecoration:'none' }}>
            <div className="card" style={{ textAlign:'center', cursor:'pointer', height:'100%' }}>
              <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>{c.icon}</div>
              <div style={{ fontWeight:700 }}>{c.title}</div>
              <div style={{ fontSize:'.85rem', color:'var(--gray-500)', marginTop:'.25rem' }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
