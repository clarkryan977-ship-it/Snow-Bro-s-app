import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

export default function EmployeeAssignedJobs() {
  const [jobs, setJobs] = useState([]);
  const [myRoutes, setMyRoutes] = useState([]);
  const [routeTab, setRouteTab] = useState('jobs'); // 'jobs' | 'routes'
  const [photos, setPhotos] = useState({});
  const [photoModal, setPhotoModal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [completing, setCompleting] = useState({});
  const [stopPhotoModal, setStopPhotoModal] = useState(null); // { stop, routeName, routeDate }
  const [stopPhotos, setStopPhotos] = useState({});
  const [stopUploading, setStopUploading] = useState(false);
  const fileRef = useRef();
  const stopFileRef = useRef();

  // Confirmation & Undo State
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'job'|'stop', id, routeId, label }
  const [undoToast, setUndoToast] = useState(null); // { type: 'job'|'stop', id, routeId, label, timer }

  const load = () => {
    api.get('/calendar/my-jobs').then(r => setJobs(r.data)).catch(() => {});
    api.get('/routes/my-routes').then(r => setMyRoutes(r.data || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const [routeCompleteMsg, setRouteCompleteMsg] = useState(false);

  const openMapsToAddress = (addr) => {
    if (!addr) return;
    const encoded = encodeURIComponent(addr);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const url = isIOS
      ? `maps://maps.apple.com/?daddr=${encoded}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    window.open(url, '_blank');
  };

  const showUndoToast = (type, id, label, routeId = null) => {
    if (undoToast?.timer) clearTimeout(undoToast.timer);
    
    const timer = setTimeout(() => {
      setUndoToast(null);
    }, 8000);

    setUndoToast({ type, id, label, routeId, timer });
  };

  const markDone = async (jobId) => {
    setCompleting(c => ({ ...c, [jobId]: true }));
    try {
      await api.patch(`/bookings/${jobId}/complete`);
      const job = jobs.find(j => j.id === jobId);
      const label = job?.service_name || 'Job';
      
      // Update local state
      const updatedJobs = jobs.map(j =>
        j.id === jobId ? { ...j, status: 'completed' } : j
      );
      setJobs(updatedJobs);
      showUndoToast('job', jobId, label);

      // Find the next incomplete job after the one just completed
      const currentIndex = jobs.findIndex(j => j.id === jobId);
      const remaining = updatedJobs.filter((j, idx) => idx > currentIndex && j.status !== 'completed');
      const nextJob = remaining[0];

      if (nextJob) {
        const addr = [nextJob.address, nextJob.city, nextJob.state, nextJob.zip].filter(Boolean).join(', ');
        if (addr) {
          setTimeout(() => openMapsToAddress(addr), 400);
        }
      } else {
        const anyRemaining = updatedJobs.some(j => j.status !== 'completed');
        if (!anyRemaining) {
          setRouteCompleteMsg(true);
          setTimeout(() => setRouteCompleteMsg(false), 6000);
        }
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark job as done');
    } finally {
      setCompleting(c => ({ ...c, [jobId]: false }));
    }
  };

  const undoMarkDone = async () => {
    if (!undoToast) return;
    const { type, id, routeId } = undoToast;
    clearTimeout(undoToast.timer);
    setUndoToast(null);

    try {
      if (type === 'job') {
        await api.patch(`/bookings/${id}/uncomplete`);
        setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'confirmed' } : j));
      } else {
        await api.patch(`/routes/${routeId}/stops/${id}/uncomplete`);
        setMyRoutes(prev => prev.map(r => r.id === routeId ? {
          ...r,
          stops: r.stops.map(s => s.id === id ? { ...s, completed: false } : s)
        } : r));
      }
    } catch (err) {
      alert('Failed to undo completion');
    }
  };

  const markStopDone = async (routeId, stopId) => {
    setCompleting(c => ({ ...c, [`stop-${stopId}`]: true }));
    try {
      await api.patch(`/routes/${routeId}/stops/${stopId}/complete`);
      
      let stopLabel = 'Stop';
      setMyRoutes(prev => prev.map(r => {
        if (r.id === routeId) {
          const stop = r.stops.find(s => s.id === stopId);
          stopLabel = stop?.first_name ? `${stop.first_name} ${stop.last_name}` : (stop?.stop_label || 'Stop');
          return {
            ...r,
            stops: r.stops.map(s => s.id === stopId ? { ...s, completed: true } : s)
          };
        }
        return r;
      }));

      showUndoToast('stop', stopId, stopLabel, routeId);
    } catch (err) {
      alert('Failed to mark stop as done');
    } finally {
      setCompleting(c => ({ ...c, [`stop-${stopId}`]: false }));
    }
  };

  const loadPhotos = async (bookingId) => {
    try {
      const { data } = await api.get(`/beforeafter/booking/${bookingId}`);
      setPhotos(p => ({ ...p, [bookingId]: data }));
    } catch (e) {}
  };

  const loadStopPhotos = async (stopId) => {
    try {
      const { data } = await api.get(`/beforeafter/stop/${stopId}`);
      setStopPhotos(p => ({ ...p, [stopId]: data }));
    } catch (e) {}
  };

  const uploadStopPhoto = async (stopId, type) => {
    if (!stopFileRef.current?.files?.length) return;
    setStopUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', stopFileRef.current.files[0]);
      fd.append('photo_type', type);
      fd.append('caption', type === 'before' ? 'Before' : 'After');
      await api.post(`/beforeafter/stop/${stopId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      stopFileRef.current.value = '';
      await loadStopPhotos(stopId);
    } catch (e) { alert('Upload failed'); }
    finally { setStopUploading(false); }
  };

  const deleteStopPhoto = async (photoId, stopId) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await api.delete(`/beforeafter/${photoId}`);
      setStopPhotos(p => ({ ...p, [stopId]: (p[stopId] || []).filter(ph => ph.id !== photoId) }));
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
      await api.post(`/beforeafter/booking/${bookingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
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
              <div style={{ fontSize:'.82rem', color:'#16a34a' }}>{new Date(job.completed_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} CT</div>
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
              onClick={() => setConfirmModal({ type: 'job', id: job.id, label: job.service_name || 'Job' })}
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

  const renderRoute = (route) => {
    const stops = route.stops || [];
    const stopAddrs = stops
      .filter(s => (s.stop_address || s.address))
      .map(s => [s.stop_address || s.address, s.stop_city || s.city, s.stop_state || s.state, s.stop_zip || s.zip].filter(Boolean).join(', '));
    let mapsUrl = null;
    if (stopAddrs.length === 1) {
      mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(stopAddrs[0]);
    } else if (stopAddrs.length > 1) {
      const origin = encodeURIComponent(stopAddrs[0]);
      const dest   = encodeURIComponent(stopAddrs[stopAddrs.length - 1]);
      const wps    = stopAddrs.slice(1, -1).map(a => encodeURIComponent(a)).join('|');
      mapsUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + dest + (wps ? '&waypoints=' + wps : '');
    }
    return (
      <div key={route.id} className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--blue-700)' }}>{route.name}</div>
            <div style={{ fontSize: '.82rem', color: 'var(--gray-500)', marginTop: 2 }}>
              {route.route_date ? new Date(route.route_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'No date set'}
              {' · '}{stops.length} stop{stops.length !== 1 ? 's' : ''}
            </div>
          </div>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
              🗺️ Open Full Route
            </a>
          )}
        </div>
        {stops.length === 0 ? (
          <div style={{ color: 'var(--gray-400)', fontSize: '.85rem', textAlign: 'center', padding: '1rem' }}>No stops on this route.</div>
        ) : (
          stops.map((stop, idx) => {
            const clientName = stop.first_name ? stop.first_name + ' ' + stop.last_name : (stop.stop_label || ('Stop ' + (idx + 1)));
            const addr = [stop.stop_address || stop.address, stop.stop_city || stop.city, stop.stop_state || stop.state, stop.stop_zip || stop.zip].filter(Boolean).join(', ');
            const navUrl = addr ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr) : null;
            const stopPhotoCount = (stopPhotos[stop.id] || []).length;
            const isStopDone = stop.completed;

            return (
              <div key={stop.id} style={{ background: isStopDone ? '#f0fdf4' : '#f8fafc', borderRadius: 8, marginBottom: 6, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem .75rem' }}>
                  <div style={{ background: isStopDone ? '#16a34a' : 'var(--blue-700)', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.78rem', fontWeight: 700, flexShrink: 0 }}>{isStopDone ? '✓' : idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.9rem', textDecoration: isStopDone ? 'line-through' : 'none', color: isStopDone ? 'var(--gray-500)' : 'inherit' }}>{clientName}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr || 'No address'}</div>
                    {stop.booking_service_type && <div style={{ fontSize: '.72rem', color: '#7c3aed' }}>📋 {stop.booking_service_type}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '.35rem', flexShrink: 0 }}>
                    {!isStopDone && navUrl && (
                      <a href={navUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '.25rem .5rem', fontSize: '.75rem' }}>🗺️</a>
                    )}
                    <button
                      className="btn btn-sm"
                      style={{ background: '#7c3aed', color: '#fff', padding: '.25rem .5rem', fontSize: '.75rem' }}
                      onClick={() => { setStopPhotoModal({ stop, routeName: route.name, routeDate: route.route_date }); loadStopPhotos(stop.id); }}
                    >
                      📷{stopPhotoCount > 0 ? ` (${stopPhotoCount})` : ''}
                    </button>
                    {!isStopDone ? (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#16a34a', color: '#fff', padding: '.25rem .5rem', fontSize: '.75rem', fontWeight: 700 }}
                        onClick={() => setConfirmModal({ type: 'stop', id: stop.id, routeId: route.id, label: clientName })}
                        disabled={completing[`stop-${stop.id}`]}
                      >
                        {completing[`stop-${stop.id}`] ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '✅'}
                      </button>
                    ) : (
                      <span style={{ color: '#16a34a', fontSize: '1.1rem', padding: '0 .25rem' }}>✅</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: undoToast ? '80px' : '20px' }}>
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

      {/* Tab bar: Jobs vs Routes */}
      {myRoutes.length > 0 && (
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 3, marginBottom: '1rem' }}>
          <button
            onClick={() => setRouteTab('jobs')}
            style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, background: routeTab === 'jobs' ? '#1e3a5f' : 'transparent', color: routeTab === 'jobs' ? '#fff' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            📋 My Jobs ({jobs.length})
          </button>
          <button
            onClick={() => setRouteTab('routes')}
            style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, background: routeTab === 'routes' ? '#1e3a5f' : 'transparent', color: routeTab === 'routes' ? '#fff' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            🗺️ My Routes ({myRoutes.length})
          </button>
        </div>
      )}

      {/* Routes tab content */}
      {routeTab === 'routes' && (
        <div>
          {myRoutes.length === 0 ? (
            <div className="card text-center" style={{ padding: '3rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>🗺️</div>
              <p style={{ color: 'var(--gray-500)' }}>No routes assigned to you today.</p>
            </div>
          ) : (
            myRoutes.map(r => renderRoute(r))
          )}
        </div>
      )}

      {/* Jobs tab content */}
      {routeTab === 'jobs' && (
        <div>
          {routeCompleteMsg && (
            <div style={{
              background: '#16a34a', color: '#fff', borderRadius: 10, padding: '1rem 1.5rem',
              marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.75rem',
              fontSize: '1rem', fontWeight: 700, boxShadow: '0 4px 16px rgba(22,163,74,.35)',
              animation: 'fadeIn .3s ease'
            }}>
              <span style={{ fontSize: '1.75rem' }}>🎉</span>
              <div>
                <div>Route Complete! All jobs done.</div>
                <div style={{ fontWeight: 400, fontSize: '.85rem', opacity: .9 }}>Great work today — all assigned jobs are finished.</div>
              </div>
            </div>
          )}

          {jobs.length === 0 && (
            <div className="card text-center" style={{ padding:'3rem' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>📋</div>
              <p style={{ color:'var(--gray-500)' }}>No assigned jobs at this time.</p>
            </div>
          )}

          {activeJobs.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem', marginBottom: completedJobs.length > 0 ? '1.5rem' : 0 }}>
              {activeJobs.map((job, idx) => renderJob(job, idx))}
            </div>
          )}

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
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: '2rem 1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
              <h3 style={{ fontWeight: 700, marginBottom: '.5rem' }}>Mark as Done?</h3>
              <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
                Are you sure you want to mark <strong>{confirmModal.label}</strong> as completed?
              </p>
              <div style={{ display: 'flex', gap: '.75rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmModal(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, background: '#16a34a' }} onClick={() => {
                  if (confirmModal.type === 'job') markDone(confirmModal.id);
                  else markStopDone(confirmModal.routeId, confirmModal.id);
                  setConfirmModal(null);
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', padding: '.75rem 1.25rem',
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: '1rem',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', zIndex: 3000,
          width: '90%', maxWidth: 400, animation: 'slideUp 0.3s ease'
        }}>
          <div style={{ flex: 1, fontSize: '.9rem' }}>
            ✅ <strong>{undoToast.label}</strong> marked done
          </div>
          <button 
            onClick={undoMarkDone}
            style={{ 
              background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', 
              padding: '.4rem .8rem', borderRadius: 6, fontSize: '.85rem', 
              fontWeight: 700, cursor: 'pointer' 
            }}
          >
            Undo
          </button>
        </div>
      )}

      {/* Photo Modals & Lightbox (Original) */}
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
                    </div>
                    <div>
                      <div style={{ fontSize:'.75rem', fontWeight:700, color:'#059669', textTransform:'uppercase', marginBottom:'.5rem', textAlign:'center' }}>After</div>
                      {(photos[photoModal.id] || []).filter(p => p.photo_type === 'after').map(p => (
                        <div key={p.id} style={{ position:'relative', marginBottom:'.5rem' }}>
                          <img src={p.file_path} alt="After" style={{ width:'100%', borderRadius:6, cursor:'pointer', border:'2px solid #059669' }} onClick={() => setLightbox(p)} />
                          <button onClick={() => deletePhoto(p.id, photoModal.id)} style={{ position:'absolute', top:-6, right:-6, background:'#dc2626', color:'#fff', border:'none', borderRadius:'50%', width:22, height:22, fontSize:'.7rem', cursor:'pointer' }}>×</button>
                        </div>
                      ))}
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

      {stopPhotoModal && (
        <div className="modal-overlay" onClick={() => setStopPhotoModal(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#7c3aed', color: '#fff' }}>
              <h2>📷 Before & After Photos</h2>
              <button className="modal-close" style={{ color: '#fff' }} onClick={() => setStopPhotoModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
                {stopPhotoModal.stop.first_name ? stopPhotoModal.stop.first_name + ' ' + stopPhotoModal.stop.last_name : (stopPhotoModal.stop.stop_label || 'Stop')}
                {stopPhotoModal.stop.booking_service_type ? ' — ' + stopPhotoModal.stop.booking_service_type : ''}
                {stopPhotoModal.routeDate ? ' — ' + stopPhotoModal.routeDate : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--blue-700)', textTransform: 'uppercase', marginBottom: '.5rem', textAlign: 'center' }}>Before</div>
                  {(stopPhotos[stopPhotoModal.stop.id] || []).filter(p => p.photo_type === 'before').map(p => (
                    <div key={p.id} style={{ position: 'relative', marginBottom: '.5rem' }}>
                      <img src={p.file_path} alt="Before" style={{ width: '100%', borderRadius: 6, cursor: 'pointer', border: '2px solid var(--blue-200)' }} onClick={() => setLightbox(p)} />
                      <button onClick={() => deleteStopPhoto(p.id, stopPhotoModal.stop.id)} style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: '.7rem', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: '.5rem', textAlign: 'center' }}>After</div>
                  {(stopPhotos[stopPhotoModal.stop.id] || []).filter(p => p.photo_type === 'after').map(p => (
                    <div key={p.id} style={{ position: 'relative', marginBottom: '.5rem' }}>
                      <img src={p.file_path} alt="After" style={{ width: '100%', borderRadius: 6, cursor: 'pointer', border: '2px solid #059669' }} onClick={() => setLightbox(p)} />
                      <button onClick={() => deleteStopPhoto(p.id, stopPhotoModal.stop.id)} style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: '.7rem', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--blue-100)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--blue-700)', textTransform: 'uppercase', marginBottom: '.75rem' }}>Upload Photo</div>
                <input ref={stopFileRef} type="file" accept="image/*" className="form-control" capture="environment" style={{ marginBottom: '.75rem' }} />
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => uploadStopPhoto(stopPhotoModal.stop.id, 'before')} disabled={stopUploading}>
                    {stopUploading ? <span className="spinner" /> : '📷 Upload as Before'}
                  </button>
                  <button className="btn btn-primary" onClick={() => uploadStopPhoto(stopPhotoModal.stop.id, 'after')} disabled={stopUploading}>
                    {stopUploading ? <span className="spinner" /> : '📷 Upload as After'}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStopPhotoModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

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

      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
