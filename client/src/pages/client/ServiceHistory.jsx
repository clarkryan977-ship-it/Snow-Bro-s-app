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
  const [photos, setPhotos] = useState({});
  const [photoModal, setPhotoModal] = useState(null);
  const [lightbox, setLightbox] = useState(null);

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

  const loadPhotos = async (bookingId) => {
    if (photos[bookingId]) return; // already loaded
    try {
      const { data } = await api.get(`/beforeafter/booking/${bookingId}`);
      setPhotos(p => ({ ...p, [bookingId]: data }));
    } catch (e) {
      setPhotos(p => ({ ...p, [bookingId]: [] }));
    }
  };

  const openPhotos = (booking) => {
    setPhotoModal(booking);
    loadPhotos(booking.id);
  };

  // Pre-load photo counts for all bookings when they load
  useEffect(() => {
    if (bookings.length > 0) {
      bookings.forEach(b => {
        if (!photos[b.id]) loadPhotos(b.id);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'1.5rem 1rem' }}>
      <h1 style={{ fontSize:'1.5rem', fontWeight:700, marginBottom:'.5rem' }}>📋 Service History</h1>
      <p style={{ color:'var(--gray-500)', marginBottom:'1.5rem' }}>Your past jobs, invoices, and before/after photos.</p>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {bookings.map(b => (
              <div key={b.id} style={{
                padding: '.75rem 1rem',
                background: b.status === 'completed' ? '#f0fdf4' : b.status === 'confirmed' ? '#eff6ff' : 'var(--gray-50)',
                borderRadius: 8,
                borderLeft: `3px solid ${b.status === 'completed' ? '#16a34a' : b.status === 'confirmed' ? 'var(--blue-600)' : '#d1d5db'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem'
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{b.service_name || 'Service'}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--gray-500)' }}>{b.preferred_date}{b.preferred_time ? ` at ${b.preferred_time}` : ''}</div>
                  {b.notes && <div style={{ fontSize: '.78rem', color: 'var(--gray-400)', marginTop: '.15rem', fontStyle: 'italic' }}>{b.notes.substring(0, 80)}{b.notes.length > 80 ? '…' : ''}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span className={`badge badge-${b.status === 'completed' ? 'green' : b.status === 'confirmed' ? 'blue' : b.status === 'pending' ? 'yellow' : 'gray'}`} style={{ textTransform:'capitalize' }}>{b.status}</span>
                  {/* Show Photos button for all service types and all statuses (not just completed) */}
                  {(b.status === 'completed' || (photos[b.id] && photos[b.id].length > 0)) && (
                    <button
                      className="btn btn-sm"
                      style={{ background: '#7c3aed', color: '#fff', fontSize: '.78rem', padding: '.25rem .6rem' }}
                      onClick={() => openPhotos(b)}
                    >
                      📷 Photos{photos[b.id] && photos[b.id].length > 0 ? ` (${photos[b.id].length})` : ''}
                    </button>
                  )}
                </div>
              </div>
            ))}
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

      {/* Photo Modal */}
      {photoModal && (
        <div className="modal-overlay" onClick={() => setPhotoModal(null)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#7c3aed', color: '#fff' }}>
              <h2>📷 Job Photos</h2>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setPhotoModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '.88rem', color: 'var(--gray-600)', marginBottom: '1rem', fontWeight: 600 }}>
                {photoModal.service_name} — {photoModal.preferred_date}
              </div>
              {(photos[photoModal.id] || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>📷</div>
                  <p>No photos have been uploaded for this job yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--blue-700)', textTransform: 'uppercase', marginBottom: '.5rem', textAlign: 'center', padding: '.3rem', background: 'var(--blue-50)', borderRadius: 6 }}>Before</div>
                    {(photos[photoModal.id] || []).filter(p => p.photo_type === 'before').map(p => (
                      <div key={p.id} style={{ marginBottom: '.5rem' }}>
                        <img src={p.file_path} alt="Before" style={{ width: '100%', borderRadius: 8, cursor: 'pointer', border: '2px solid var(--blue-200)', objectFit: 'cover', aspectRatio: '4/3' }} onClick={() => setLightbox(p)} />
                      </div>
                    ))}
                    {(photos[photoModal.id] || []).filter(p => p.photo_type === 'before').length === 0 && (
                      <div style={{ color: 'var(--gray-300)', fontSize: '.82rem', textAlign: 'center', padding: '1.5rem', border: '2px dashed var(--gray-200)', borderRadius: 8 }}>No before photo</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: '.5rem', textAlign: 'center', padding: '.3rem', background: '#f0fdf4', borderRadius: 6 }}>After</div>
                    {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').map(p => (
                      <div key={p.id} style={{ marginBottom: '.5rem' }}>
                        <img src={p.file_path} alt="After" style={{ width: '100%', borderRadius: 8, cursor: 'pointer', border: '2px solid #059669', objectFit: 'cover', aspectRatio: '4/3' }} onClick={() => setLightbox(p)} />
                      </div>
                    ))}
                    {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').length === 0 && (
                      <div style={{ color: 'var(--gray-300)', fontSize: '.82rem', textAlign: 'center', padding: '1.5rem', border: '2px dashed var(--gray-200)', borderRadius: 8 }}>No after photo</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPhotoModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1rem' }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: -14, right: -14, background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: '1.1rem', cursor: 'pointer', zIndex: 10 }}>×</button>
            <img src={lightbox.file_path} alt="" style={{ maxWidth: '85vw', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }} />
            <div style={{ background: 'rgba(255,255,255,.95)', padding: '.5rem 1rem', borderRadius: '0 0 8px 8px', fontSize: '.85rem', fontWeight: 600, textTransform: 'capitalize' }}>
              {lightbox.photo_type} photo
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
