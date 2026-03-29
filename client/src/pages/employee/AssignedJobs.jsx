import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

export default function EmployeeAssignedJobs() {
  const [jobs, setJobs] = useState([]);
  const [photos, setPhotos] = useState({});
  const [photoModal, setPhotoModal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [completing, setCompleting] = useState({});
  const fileRef = useRef();

  const load = () => {
    api.get('/calendar/my-jobs').then(r => setJobs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const markDone = async (jobId) => {
    if (!confirm('Mark this job as completed?')) return;
    setCompleting(c => ({ ...c, [jobId]: true }));
    try {
      await api.patch(`/bookings/${jobId}/complete`);
      setJobs(prev => prev.map(j =>
        j.id === jobId ? { ...j, status: 'completed' } : j
      ));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark job as done');
    } finally {
      setCompleting(c => ({ ...c, [jobId]: false }));
    }
  };

  const loadPhotos = async (bookingId) => {
    try {
      const { data } = await api.get(`/beforeafter/record/${bookingId}`);
      setPhotos(p => ({ ...p, [bookingId]: data }));
    } catch (e) {}
  };

  const openGoogleMaps = (job) => {
    const addr = [job.address, job.city, job.state, job.zip].filter(Boolean).join(', ');
    if (!addr) { alert('No address available for this job.'); return; }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
    window.open(url, '_blank');
  };

  const getRouteUrl = () => {
    const addresses = jobs
      .filter(j => j.status !== 'completed' && j.address)
      .map(j => [j.address, j.city, j.state, j.zip].filter(Boolean).join(', '));
    if (addresses.length === 0) return null;
    if (addresses.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addresses[0])}`;
    const dest = addresses[addresses.length - 1];
    const waypoints = addresses.slice(0, -1).join('|');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&waypoints=${encodeURIComponent(waypoints)}`;
  };

  const uploadPhoto = async (bookingId, type) => {
    if (!fileRef.current?.files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', fileRef.current.files[0]);
      fd.append('photo_type', type);
      fd.append('caption', type === 'before' ? 'Before' : 'After');
      await api.post(`/beforeafter/record/${bookingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      fileRef.current.value = '';
      await loadPhotos(bookingId);
    } catch (e) { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  const deletePhoto = async (photoId, bookingId) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await api.delete(`/beforeafter/${photoId}`);
      setPhotos(p => ({ ...p, [bookingId]: (p[bookingId] || []).filter(ph => ph.id !== photoId) }));
    } catch (e) {}
  };

  const routeUrl = getRouteUrl();
  const activeJobs = jobs.filter(j => j.status !== 'completed');
  const completedJobs = jobs.filter(j => j.status === 'completed');

  const renderJob = (job, idx) => {
    const addr = [job.address, job.city, job.state, job.zip].filter(Boolean).join(', ');
    const isDone = job.status === 'completed';
    return (
      <div
        key={job.id}
        className="card"
        style={isDone ? {
          background: '#f0fdf4',
          borderLeft: '4px solid #16a34a',
          opacity: 0.88,
        } : {}}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'.5rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.25rem' }}>
              <span style={{
                background: isDone ? '#16a34a' : 'var(--blue-700)',
                color: '#fff', borderRadius: '50%', width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '.82rem', fontWeight: 700
              }}>
                {isDone ? '✓' : idx + 1}
              </span>
              <strong style={{
                fontSize: '1.05rem',
                textDecoration: isDone ? 'line-through' : 'none',
                color: isDone ? 'var(--gray-500)' : 'inherit'
              }}>
                {job.service_name || 'Service'}
              </strong>
            </div>
            <div style={{ fontSize:'.85rem', color:'var(--gray-600)' }}>
              📅 {job.preferred_date} {job.preferred_time && `at ${job.preferred_time}`}
            </div>
          </div>
          <span className={`badge ${isDone ? 'badge-green' : job.status === 'confirmed' ? 'badge-blue' : 'badge-yellow'}`}
            style={{ textTransform:'capitalize' }}>
            {isDone ? '✅ Completed' : job.status}
          </span>
        </div>

        <div style={{ marginTop:'.75rem', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'.75rem' }}>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase' }}>👤 Client</div>
            <div style={{ fontSize:'.88rem' }}>{job.full_client_name || 'N/A'}</div>
            {job.client_phone && <div style={{ fontSize:'.82rem', color:'var(--gray-500)' }}>📞 {job.client_phone}</div>}
          </div>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase' }}>📍 Address</div>
            <div style={{ fontSize:'.88rem' }}>{addr || 'No address'}</div>
          </div>
          {isDone && job.completed_at && (
            <div>
              <div style={{ fontSize:'.72rem', color:'#16a34a', fontWeight:600, textTransform:'uppercase' }}>✅ Completed At</div>
              <div style={{ fontSize:'.82rem', color:'#16a34a' }}>{new Date(job.completed_at).toLocaleString()}</div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem', flexWrap:'wrap' }}>
          {!isDone && addr && (
            <button className="btn btn-primary btn-sm" onClick={() => openGoogleMaps(job)}>
              🗺️ Navigate
            </button>
          )}
          {!isDone && job.client_phone && (
            <a href={`tel:${job.client_phone}`} className="btn btn-secondary btn-sm">📞 Call Client</a>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => { setPhotoModal(job); loadPhotos(job.id); }}>
            📷 Before/After Photos
          </button>
          {!isDone ? (
            <button
              className="btn btn-sm"
              style={{ background: '#16a34a', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              onClick={() => markDone(job.id)}
              disabled={completing[job.id]}
            >
              {completing[job.id] ? <span className="spinner" /> : '✅ Mark as Done'}
            </button>
          ) : (
            <span style={{ fontSize:'.82rem', color:'#16a34a', fontWeight:600, alignSelf:'center' }}>
              ✅ Job Complete
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'.75rem' }}>
          <div>
            <h1>🗺️ Assigned Jobs</h1>
            <p>Your job assignments. Tap <strong>✅ Mark as Done</strong> when a job is finished.</p>
          </div>
          {routeUrl && (
            <a href={routeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              🗺️ Optimized Route (Active Jobs)
            </a>
          )}
        </div>
      </div>

      {jobs.length === 0 && (
        <div className="card text-center" style={{ padding:'3rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>📋</div>
          <p style={{ color:'var(--gray-500)' }}>No assigned jobs at this time.</p>
        </div>
      )}

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem', marginBottom: completedJobs.length > 0 ? '1.5rem' : 0 }}>
          {activeJobs.map((job, idx) => renderJob(job, idx))}
        </div>
      )}

      {/* Completed jobs section */}
      {completedJobs.length > 0 && (
        <>
          <div style={{ fontSize:'.8rem', fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'.75rem', paddingTop: activeJobs.length > 0 ? '.5rem' : 0 }}>
            ✅ Completed Jobs ({completedJobs.length})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {completedJobs.map(job => renderJob(job, 0))}
          </div>
        </>
      )}

      {/* Before/After Photo Modal */}
      {photoModal && (
        <div className="modal-overlay" onClick={() => setPhotoModal(null)}>
          <div className="modal" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📷 Before & After Photos</h2>
              <button className="modal-close" onClick={() => setPhotoModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:'.85rem', color:'var(--gray-500)', marginBottom:'1rem' }}>
                {photoModal.service_name} — {photoModal.preferred_date}
              </div>

              {(photos[photoModal.id] || []).length > 0 && (
                <div style={{ marginBottom:'1.25rem' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                    <div>
                      <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--blue-700)', textTransform:'uppercase', marginBottom:'.5rem', textAlign:'center' }}>Before</div>
                      {(photos[photoModal.id] || []).filter(p => p.photo_type === 'before').map(p => (
                        <div key={p.id} style={{ position:'relative', marginBottom:'.5rem' }}>
                          <img src={p.file_path} alt="Before" style={{ width:'100%', borderRadius:6, cursor:'pointer', border:'2px solid var(--blue-200)' }} onClick={() => setLightbox(p)} />
                          <button onClick={() => deletePhoto(p.id, photoModal.id)} style={{ position:'absolute', top:-6, right:-6, background:'#dc2626', color:'#fff', border:'none', borderRadius:'50%', width:22, height:22, fontSize:'.7rem', cursor:'pointer' }}>×</button>
                        </div>
                      ))}
                      {(photos[photoModal.id] || []).filter(p => p.photo_type === 'before').length === 0 && (
                        <div style={{ color:'var(--gray-300)', fontSize:'.82rem', textAlign:'center', padding:'1rem' }}>No before photo</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize:'.75rem', fontWeight:700, color:'#059669', textTransform:'uppercase', marginBottom:'.5rem', textAlign:'center' }}>After</div>
                      {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').map(p => (
                        <div key={p.id} style={{ position:'relative', marginBottom:'.5rem' }}>
                          <img src={p.file_path} alt="After" style={{ width:'100%', borderRadius:6, cursor:'pointer', border:'2px solid #059669' }} onClick={() => setLightbox(p)} />
                          <button onClick={() => deletePhoto(p.id, photoModal.id)} style={{ position:'absolute', top:-6, right:-6, background:'#dc2626', color:'#fff', border:'none', borderRadius:'50%', width:22, height:22, fontSize:'.7rem', cursor:'pointer' }}>×</button>
                        </div>
                      ))}
                      {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').length === 0 && (
                        <div style={{ color:'var(--gray-300)', fontSize:'.82rem', textAlign:'center', padding:'1rem' }}>No after photo</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ borderTop:'1px solid var(--blue-100)', paddingTop:'1rem' }}>
                <div style={{ fontSize:'.8rem', fontWeight:700, color:'var(--blue-700)', textTransform:'uppercase', marginBottom:'.75rem' }}>Upload Photo</div>
                <input ref={fileRef} type="file" accept="image/*" className="form-control" capture="environment" style={{ marginBottom:'.75rem' }} />
                <div style={{ display:'flex', gap:'.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => uploadPhoto(photoModal.id, 'before')} disabled={uploading}>
                    {uploading ? <span className="spinner" /> : '📷 Upload as Before'}
                  </button>
                  <button className="btn btn-primary" onClick={() => uploadPhoto(photoModal.id, 'after')} disabled={uploading}>
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
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:'1rem' }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth:'90vw', maxHeight:'90vh', position:'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} style={{ position:'absolute', top:-14, right:-14, background:'#fff', border:'none', borderRadius:'50%', width:32, height:32, fontSize:'1.1rem', cursor:'pointer', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            <img src={lightbox.file_path} alt="" style={{ maxWidth:'85vw', maxHeight:'80vh', borderRadius:8, objectFit:'contain' }} />
            <div style={{ background:'rgba(255,255,255,.95)', padding:'.5rem 1rem', borderRadius:'0 0 8px 8px', fontSize:'.85rem', fontWeight:600, textTransform:'capitalize' }}>{lightbox.photo_type} photo</div>
          </div>
        </div>
      )}
    </div>
  );
}
