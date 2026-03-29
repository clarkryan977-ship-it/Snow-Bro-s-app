import { useState, useEffect } from 'react';
import api from '../../utils/api';

const STATUS_COLORS = { pending:'badge-yellow', confirmed:'badge-blue', completed:'badge-green', cancelled:'badge-red' };
const STATUS_LABELS = { pending:'⏳ Pending', confirmed:'✓ Confirmed', completed:'✅ Completed', cancelled:'✗ Cancelled' };

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [photoModal, setPhotoModal] = useState(null);
  const [photos, setPhotos] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [accepting, setAccepting] = useState({});

  const load = () => api.get('/bookings').then(r => setBookings(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await api.put(`/bookings/${id}`, { status }).catch(() => {});
    load();
  };

  // Accept booking: set confirmed + send client email
  const acceptBooking = async (booking) => {
    setAccepting(a => ({ ...a, [booking.id]: 'accepting' }));
    try {
      await api.put(`/bookings/${booking.id}`, { status: 'confirmed' });
      // Send confirmation email to client
      await api.post(`/bookings/${booking.id}/confirm-email`).catch(() => {});
      load();
    } catch (e) {
      alert('Failed to accept booking');
    } finally {
      setAccepting(a => ({ ...a, [booking.id]: null }));
    }
  };

  const declineBooking = async (booking) => {
    if (!confirm(`Decline booking from ${booking.display_name}?`)) return;
    setAccepting(a => ({ ...a, [booking.id]: 'declining' }));
    try {
      await api.put(`/bookings/${booking.id}`, { status: 'cancelled' });
      load();
    } catch (e) {
      alert('Failed to decline booking');
    } finally {
      setAccepting(a => ({ ...a, [booking.id]: null }));
    }
  };

  const loadPhotos = async (bookingId) => {
    try {
      const { data } = await api.get(`/beforeafter/booking/${bookingId}`);
      setPhotos(p => ({ ...p, [bookingId]: data }));
    } catch (e) {}
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);
  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  return (
    <div>
      <div className="page-header">
        <h1>📅 Bookings</h1>
        <p>Manage incoming service requests. Accept or decline pending bookings.</p>
      </div>

      {pendingCount > 0 && (
        <div className="alert alert-info mb-2" style={{ fontWeight: 600 }}>
          ⏳ You have <strong>{pendingCount}</strong> pending booking{pendingCount !== 1 ? 's' : ''} awaiting review.
        </div>
      )}

      <div className="card mb-2" style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
        {['all','pending','confirmed','completed','cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform:'capitalize' }}>
            {s}{s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {/* Mobile-friendly card layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem' }}>No bookings found</div>
        )}
        {filtered.map(b => {
          const photoCount = (photos[b.id] || []).length;
          const addr = [b.job_address, b.job_city, b.job_state, b.job_zip].filter(Boolean).join(', ');
          return (
            <div key={b.id} className="card" style={{
              borderLeft: b.status === 'pending' ? '4px solid #f59e0b' : b.status === 'completed' ? '4px solid #16a34a' : b.status === 'cancelled' ? '4px solid #dc2626' : '4px solid var(--blue-600)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{b.display_name}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--gray-500)' }}>{b.display_email}</div>
                  {b.display_phone && <div style={{ fontSize: '.82rem', color: 'var(--gray-500)' }}>📞 {b.display_phone}</div>}
                </div>
                <span className={`badge ${STATUS_COLORS[b.status] || 'badge-gray'}`}>{STATUS_LABELS[b.status] || b.status}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.5rem', marginTop: '.75rem' }}>
                <div>
                  <div style={{ fontSize: '.7rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Service</div>
                  <div style={{ fontSize: '.88rem', fontWeight: 600 }}>{b.service_name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.7rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Date / Time</div>
                  <div style={{ fontSize: '.88rem' }}>{b.preferred_date}{b.preferred_time ? ` at ${b.preferred_time}` : ''}</div>
                </div>
                {addr && (
                  <div>
                    <div style={{ fontSize: '.7rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Address</div>
                    <div style={{ fontSize: '.82rem' }}>{addr}</div>
                  </div>
                )}
              </div>

              {b.notes && (
                <div style={{ marginTop: '.5rem', fontSize: '.82rem', color: 'var(--gray-600)', background: 'var(--gray-50)', borderRadius: 6, padding: '.4rem .75rem', borderLeft: '3px solid var(--gray-200)' }}>
                  📝 {b.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: '.4rem', marginTop: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Accept/Decline for pending */}
                {b.status === 'pending' && (
                  <>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#16a34a', color: '#fff', fontWeight: 700, border: 'none' }}
                      onClick={() => acceptBooking(b)}
                      disabled={accepting[b.id]}
                    >
                      {accepting[b.id] === 'accepting' ? <span className="spinner" /> : '✅ Accept'}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#dc2626', color: '#fff', fontWeight: 700, border: 'none' }}
                      onClick={() => declineBooking(b)}
                      disabled={accepting[b.id]}
                    >
                      {accepting[b.id] === 'declining' ? <span className="spinner" /> : '✗ Decline'}
                    </button>
                  </>
                )}

                {/* Status dropdown for non-pending */}
                <select className="form-control" style={{ fontSize: '.8rem', padding: '.25rem .5rem', width: 'auto' }}
                  value={b.status} onChange={e => setStatus(b.id, e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Photos button */}
                <button
                  className="btn btn-sm"
                  style={{ background: '#7c3aed', color: '#fff', position: 'relative' }}
                  onClick={() => { setPhotoModal(b); loadPhotos(b.id); }}
                >
                  📷 Photos{photoCount > 0 ? ` (${photoCount})` : ''}
                </button>

                {/* Detail button */}
                <button className="btn btn-secondary btn-sm" onClick={() => setDetailModal(b)}>
                  Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Booking Details</h2>
              <button className="modal-close" onClick={() => setDetailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
                <tbody>
                  {[
                    ['Client', detailModal.display_name],
                    ['Email', detailModal.display_email],
                    ['Phone', detailModal.display_phone || '—'],
                    ['Service', detailModal.service_name || '—'],
                    ['Date', detailModal.preferred_date],
                    ['Time', detailModal.preferred_time || '—'],
                    ['Status', detailModal.status],
                    ['Address', [detailModal.job_address, detailModal.job_city, detailModal.job_state, detailModal.job_zip].filter(Boolean).join(', ') || '—'],
                    ['Notes', detailModal.notes || '—'],
                    ['Submitted', detailModal.created_at ? new Date(detailModal.created_at).toLocaleString() : '—'],
                  ].map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '.5rem .75rem', fontWeight: 600, color: 'var(--gray-500)', width: 100 }}>{label}</td>
                      <td style={{ padding: '.5rem .75rem' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {photoModal && (
        <div className="modal-overlay" onClick={() => setPhotoModal(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#7c3aed', color: '#fff' }}>
              <h2>📷 Before / After Photos</h2>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setPhotoModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                {photoModal.display_name} — {photoModal.service_name} — {photoModal.preferred_date}
              </div>
              {(photos[photoModal.id] || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>📷</div>
                  <p>No photos uploaded yet for this job.</p>
                  <p style={{ fontSize: '.82rem' }}>Employees can upload before/after photos from their Assigned Jobs page.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--blue-700)', textTransform: 'uppercase', marginBottom: '.5rem', textAlign: 'center' }}>Before</div>
                    {(photos[photoModal.id] || []).filter(p => p.photo_type === 'before').map(p => (
                      <div key={p.id} style={{ marginBottom: '.5rem' }}>
                        <img src={p.file_path} alt="Before" style={{ width: '100%', borderRadius: 6, cursor: 'pointer', border: '2px solid var(--blue-200)' }} onClick={() => setLightbox(p)} />
                        {p.employee_name && <div style={{ fontSize: '.72rem', color: 'var(--gray-400)', textAlign: 'center', marginTop: '.2rem' }}>by {p.employee_name}</div>}
                      </div>
                    ))}
                    {(photos[photoModal.id] || []).filter(p => p.photo_type === 'before').length === 0 && (
                      <div style={{ color: 'var(--gray-300)', fontSize: '.82rem', textAlign: 'center', padding: '1rem', border: '2px dashed var(--gray-200)', borderRadius: 8 }}>No before photo</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: '.5rem', textAlign: 'center' }}>After</div>
                    {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').map(p => (
                      <div key={p.id} style={{ marginBottom: '.5rem' }}>
                        <img src={p.file_path} alt="After" style={{ width: '100%', borderRadius: 6, cursor: 'pointer', border: '2px solid #059669' }} onClick={() => setLightbox(p)} />
                        {p.employee_name && <div style={{ fontSize: '.72rem', color: 'var(--gray-400)', textAlign: 'center', marginTop: '.2rem' }}>by {p.employee_name}</div>}
                      </div>
                    ))}
                    {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').length === 0 && (
                      <div style={{ color: 'var(--gray-300)', fontSize: '.82rem', textAlign: 'center', padding: '1rem', border: '2px dashed var(--gray-200)', borderRadius: 8 }}>No after photo</div>
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
              {lightbox.employee_name && <span style={{ fontWeight: 400, color: 'var(--gray-500)', marginLeft: '.5rem' }}>by {lightbox.employee_name}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
