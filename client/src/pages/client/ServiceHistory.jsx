import { useState, useEffect } from 'react';
import api from '../../utils/api';

function Stars({ rating, onSelect }) {
  return (
    <span style={{ cursor: onSelect ? 'pointer' : 'default' }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onSelect && onSelect(n)}
          style={{ color: n <= rating ? '#d97706' : '#d1d5db', fontSize:'1.3rem', letterSpacing:2 }}>★</span>
      ))}
    </span>
  );
}

export default function ClientServiceHistory() {
  const [bookings, setBookings] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/bookings/my').then(r => setBookings(r.data)).catch(() => {});
    api.get('/invoices/my').then(r => setInvoices(r.data)).catch(() => {});
    api.get('/reviews/pending').then(r => setPendingReviews(r.data)).catch(() => {});
  }, []);

  const submitReview = async (bookingId) => {
    if (rating < 1) return;
    try {
      await api.post('/reviews', { booking_id: bookingId, rating, comment });
      setMsg({ type:'success', text:'Thank you for your review!' });
      setReviewForm(null); setRating(0); setComment('');
      setPendingReviews(p => p.filter(b => b.id !== bookingId));
    } catch (e) { setMsg({ type:'error', text:'Failed to submit review' }); }
  };

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'1.5rem 1rem' }}>
      <h1 style={{ fontSize:'1.5rem', fontWeight:700, marginBottom:'.5rem' }}>📋 Service History</h1>
      <p style={{ color:'var(--gray-500)', marginBottom:'1.5rem' }}>Your past jobs, invoices, and reviews.</p>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom:'1rem' }}>{msg.text}</div>}

      {/* Pending Reviews */}
      {pendingReviews.length > 0 && (
        <div className="card" style={{ marginBottom:'1.5rem', borderLeft:'4px solid #d97706' }}>
          <h3 style={{ fontWeight:700, marginBottom:'.75rem' }}>⭐ Leave a Review</h3>
          {pendingReviews.map(b => (
            <div key={b.id} style={{ padding:'.75rem', background:'var(--blue-50)', borderRadius:'var(--radius)', marginBottom:'.5rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <strong>{b.service_name}</strong>
                  <span style={{ fontSize:'.82rem', color:'var(--gray-500)', marginLeft:'.5rem' }}>{b.preferred_date}</span>
                </div>
                {reviewForm !== b.id && (
                  <button className="btn btn-primary btn-sm" onClick={() => { setReviewForm(b.id); setRating(0); setComment(''); }}>Rate</button>
                )}
              </div>
              {reviewForm === b.id && (
                <div style={{ marginTop:'.75rem' }}>
                  <div style={{ marginBottom:'.5rem' }}><Stars rating={rating} onSelect={setRating} /></div>
                  <textarea className="form-control" rows={2} placeholder="Share your experience (optional)..." value={comment} onChange={e => setComment(e.target.value)} style={{ marginBottom:'.5rem' }} />
                  <div style={{ display:'flex', gap:'.5rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => submitReview(b.id)} disabled={rating < 1}>Submit Review</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setReviewForm(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bookings History */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <h3 style={{ fontWeight:700, marginBottom:'.75rem' }}>📅 Past Bookings</h3>
        {bookings.length === 0 ? (
          <p style={{ color:'var(--gray-400)' }}>No bookings yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Service</th><th>Status</th></tr></thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id}>
                    <td>{b.preferred_date}</td>
                    <td><strong>{b.service_name || 'Service'}</strong></td>
                    <td><span className={`badge badge-${b.status === 'completed' ? 'green' : b.status === 'pending' ? 'yellow' : 'gray'}`} style={{ textTransform:'capitalize' }}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="card">
        <h3 style={{ fontWeight:700, marginBottom:'.75rem' }}>🧾 Invoices</h3>
        {invoices.length === 0 ? (
          <p style={{ color:'var(--gray-400)' }}>No invoices yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice #</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoice_number}</strong></td>
                    <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td style={{ fontWeight:600, color:'var(--blue-700)' }}>${inv.total?.toFixed(2)}</td>
                    <td><span className={`badge badge-${inv.status === 'paid' ? 'green' : 'yellow'}`} style={{ textTransform:'capitalize' }}>{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
