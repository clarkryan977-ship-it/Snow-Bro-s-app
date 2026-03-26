import { useState, useEffect } from 'react';
import api from '../../utils/api';

function Stars({ rating }) {
  return <span style={{ color:'#d97706', letterSpacing:2 }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>;
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/reviews').then(r => setReviews(r.data)).catch(() => {});
    api.get('/reviews/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>⭐ Customer Reviews</h1>
        <p>View all customer ratings and feedback.</p>
      </div>

      {stats && stats.total > 0 && (
        <div className="card" style={{ marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', gap:'2rem', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2.5rem', fontWeight:800, color:'var(--blue-700)' }}>{stats.avg_rating?.toFixed(1)}</div>
              <Stars rating={Math.round(stats.avg_rating || 0)} />
              <div style={{ fontSize:'.8rem', color:'var(--gray-500)', marginTop:'.25rem' }}>{stats.total} reviews</div>
            </div>
            <div style={{ flex:1, minWidth:200 }}>
              {[5,4,3,2,1].map(n => {
                const count = stats[['','one_star','two_star','three_star','four_star','five_star'][n]] || 0;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={n} style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.25rem' }}>
                    <span style={{ fontSize:'.78rem', width:20, textAlign:'right' }}>{n}★</span>
                    <div style={{ flex:1, background:'var(--gray-100)', borderRadius:4, height:12, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:'#d97706', borderRadius:4, transition:'width .3s' }} />
                    </div>
                    <span style={{ fontSize:'.72rem', color:'var(--gray-500)', width:30 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        {reviews.length === 0 && (
          <div className="card text-center" style={{ padding:'3rem' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>⭐</div>
            <p style={{ color:'var(--gray-500)' }}>No reviews yet.</p>
          </div>
        )}
        {reviews.map(r => (
          <div key={r.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'.5rem' }}>
              <div>
                <strong>{r.client_name || 'Anonymous'}</strong>
                <span style={{ marginLeft:'.75rem' }}><Stars rating={r.rating} /></span>
              </div>
              <span style={{ fontSize:'.78rem', color:'var(--gray-400)' }}>{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            {r.service_name && <div style={{ fontSize:'.82rem', color:'var(--blue-600)', marginTop:'.25rem' }}>Service: {r.service_name}</div>}
            {r.comment && <p style={{ marginTop:'.5rem', color:'var(--gray-700)', fontSize:'.92rem' }}>{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
