import { useState, useEffect } from 'react';
import api from '../utils/api';
import SiteFooter from '../components/SiteFooter';

const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJTl55Hg2qT4cR3iZyb4-KV1Q';

function Stars({ rating }) {
  return <span style={{ color:'#d97706', letterSpacing:2, fontSize:'1.1rem' }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>;
}

export default function PublicReviews() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/reviews').then(r => setReviews(r.data)).catch(() => {});
    api.get('/reviews/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ maxWidth:800, margin:'0 auto', padding:'2rem 1rem' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <h1 style={{ fontSize:'1.8rem', fontWeight:800, color:'var(--blue-800)' }}>⭐ Customer Reviews — Snow Bro's</h1>
          <p style={{ color:'var(--gray-500)' }}>
            See what Moorhead, MN and Fargo, ND customers say about Snow Bro's lawn care and snow removal services.
          </p>
          {/* Google Review CTA */}
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '.4rem',
              background: '#fbc02d',
              color: '#1a1a1a',
              padding: '.55rem 1.4rem',
              borderRadius: '2rem',
              fontWeight: 700,
              fontSize: '.92rem',
              textDecoration: 'none',
              marginTop: '1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
            }}
          >
            ⭐ Leave us a Google Review
          </a>
        </div>

        {stats && stats.total > 0 && (
          <div className="card" style={{ textAlign:'center', marginBottom:'2rem', background:'linear-gradient(135deg, var(--blue-50), #fff)' }}>
            <div style={{ fontSize:'3rem', fontWeight:800, color:'var(--blue-700)' }}>{stats.avg_rating?.toFixed(1)}</div>
            <Stars rating={Math.round(stats.avg_rating || 0)} />
            <div style={{ fontSize:'.85rem', color:'var(--gray-500)', marginTop:'.25rem' }}>Based on {stats.total} review{stats.total > 1 ? 's' : ''} from Moorhead MN &amp; Fargo ND clients</div>
          </div>
        )}

        {reviews.length === 0 && (
          <div className="card text-center" style={{ padding:'3rem' }}>
            <p style={{ color:'var(--gray-400)' }}>No reviews yet. Be the first to leave a review!</p>
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.4rem',
                background: '#fbc02d',
                color: '#1a1a1a',
                padding: '.5rem 1.25rem',
                borderRadius: '2rem',
                fontWeight: 700,
                fontSize: '.88rem',
                textDecoration: 'none',
                marginTop: '1rem'
              }}
            >
              ⭐ Leave a Google Review
            </a>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          {reviews.map(r => (
            <div key={r.id} className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'.5rem' }}>
                <div>
                  <strong style={{ fontSize:'1rem' }}>{r.client_name || 'Customer'}</strong>
                  <div style={{ marginTop:'.2rem' }}><Stars rating={r.rating} /></div>
                </div>
                <span style={{ fontSize:'.78rem', color:'var(--gray-400)' }}>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.service_name && <div style={{ fontSize:'.82rem', color:'var(--blue-600)', marginTop:'.25rem' }}>Service: {r.service_name}</div>}
              {r.comment && <p style={{ marginTop:'.5rem', color:'var(--gray-700)', fontSize:'.92rem', lineHeight:1.5 }}>{r.comment}</p>}
            </div>
          ))}
        </div>

        {reviews.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ color: 'var(--gray-500)', marginBottom: '.75rem', fontSize: '.9rem' }}>
              Happy with our lawn care or snow removal service in Moorhead MN or Fargo ND?
            </p>
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.4rem',
                background: '#fbc02d',
                color: '#1a1a1a',
                padding: '.55rem 1.4rem',
                borderRadius: '2rem',
                fontWeight: 700,
                fontSize: '.92rem',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >
              ⭐ Leave us a Google Review
            </a>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
