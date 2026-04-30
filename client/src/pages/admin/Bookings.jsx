import { useState, useEffect, useRef } from 'react';
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

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

  const uploadPhoto = async (bookingId, type) => {
    if (!fileRef.current?.files?.length) {
      alert('Please select a photo first.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', fileRef.current.files[0]);
      fd.append('photo_type', type);
      fd.append('caption', type === 'before' ? 'Before (admin)' : 'After (admin)');
      await api.post(`/beforeafter/booking/${bookingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      fileRef.current.value = '';
      await loadPhotos(bookingId);
    } catch (e) {
      alert('Upload failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId, bookingId) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await api.delete(`/beforeafter/${photoId}`);
      setPhotos(p => ({ ...p, [bookingId]: (p[bookingId] || []).filter(ph => ph.id !== photoId) }));
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
                    ['Submitted', detailModal.created_at ? new Date(detailModal.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT' : '—'],
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

      {/* Photo Modal — Admin can view AND upload before/after photos for any service type */}
      {photoModal && (
        <div className="modal-overlay" onClick={() => setPhotoModal(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#7c3aed', color: '#fff' }}>
              <h2>📷 Before / After Photos</h2>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setPhotoModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '1rem', fontWeight: 600 }}>
                {photoModal.display_name} — {photoModal.service_name} — {photoModal.preferred_date}
              </div>

              {/* Photo grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--blue-700)', textTransform: 'uppercase', marginBottom: '.5rem', textAlign: 'center', padding: '.3rem', background: 'var(--blue-50)', borderRadius: 6 }}>Before</div>
                  {(photos[photoModal.id] || []).filter(p => p.photo_type === 'before').map(p => (
                    <div key={p.id} style={{ position: 'relative', marginBottom: '.5rem' }}>
                      <img src={p.file_path} alt="Before" style={{ width: '100%', borderRadius: 6, cursor: 'pointer', border: '2px solid var(--blue-200)', objectFit: 'cover', aspectRatio: '4/3' }} onClick={() => setLightbox(p)} />
                      {p.employee_name && <div style={{ fontSize: '.7rem', color: 'var(--gray-400)', textAlign: 'center', marginTop: '.2rem' }}>by {p.employee_name}</div>}
                      <button onClick={() => deletePhoto(p.id, photoModal.id)} style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: '.7rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  {(photos[photoModal.id] || []).filter(p => p.photo_type === 'before').length === 0 && (
                    <div style={{ color: 'var(--gray-300)', fontSize: '.82rem', textAlign: 'center', padding: '1.5rem', border: '2px dashed var(--gray-200)', borderRadius: 8 }}>No before photo</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: '.5rem', textAlign: 'center', padding: '.3rem', background: '#f0fdf4', borderRadius: 6 }}>After</div>
                  {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').map(p => (
                    <div key={p.id} style={{ position: 'relative', marginBottom: '.5rem' }}>
                      <img src={p.file_path} alt="After" style={{ width: '100%', borderRadius: 6, cursor: 'pointer', border: '2px solid #059669', objectFit: 'cover', aspectRatio: '4/3' }} onClick={() => setLightbox(p)} />
                      {p.employee_name && <div style={{ fontSize: '.7rem', color: 'var(--gray-400)', textAlign: 'center', marginTop: '.2rem' }}>by {p.employee_name}</div>}
                      <button onClick={() => deletePhoto(p.id, photoModal.id)} style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: '.7rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').length === 0 && (
                    <div style={{ color: 'var(--gray-300)', fontSize: '.82rem', textAlign: 'center', padding: '1.5rem', border: '2px dashed var(--gray-200)', borderRadius: 8 }}>No after photo</div>
                  )}
                </div>
              </div>

              {/* Admin upload section */}
              <div style={{ borderTop: '2px solid #ede9fe', paddingTop: '1rem', background: '#faf5ff', borderRadius: '0 0 8px 8px', padding: '1rem', marginTop: '.5rem' }}>
                <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: '.75rem' }}>
                  📤 Upload Photo (Admin)
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--gray-500)', marginBottom: '.5rem' }}>
                  Works for all service types: Snow Removal, Lawn Care, Landscaping, Junk Removal, etc.
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="form-control"
                  style={{ marginBottom: '.75rem' }}
                />
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => uploadPhoto(photoModal.id, 'before')}
                    disabled={uploading}
                    style={{ flex: 1 }}
                  >
                    {uploading ? <span className="spinner" /> : '📷 Upload as Before'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => uploadPhoto(photoModal.id, 'after')}
                    disabled={uploading}
                    style={{ flex: 1 }}
                  >
                    {uploading ? <span className="spinner" /> : '📷 Upload as After'}
                  </button>
                </div>
              </div>
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
