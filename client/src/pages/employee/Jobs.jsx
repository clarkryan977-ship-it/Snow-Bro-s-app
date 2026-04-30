import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import MapsButton from '../../utils/openInMaps.jsx';

function fmtDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function EmployeeJobs() {
  const [records, setRecords] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Photos per record
  const [photoMap, setPhotoMap] = useState({});
  const [photoModal, setPhotoModal] = useState(null); // { record }
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const photoRef = useRef();

  const load = () => api.get('/time/my-records').then(r => setRecords(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const loadPhotosForRecord = async (recordId) => {
    try {
      const { data } = await api.get(`/jobphotos/record/${recordId}`);
      setPhotoMap(m => ({ ...m, [recordId]: data }));
    } catch (e) { /* ignore */ }
  };

  const openEdit = r => {
    setEditing(r);
    setForm({
      job_address:   r.job_address   || '',
      job_contact:   r.job_contact   || '',
      scope_of_work: r.scope_of_work || '',
      job_notes:     r.job_notes     || '',
    });
    setMsg(null);
  };

  const openPhotos = async (r) => {
    setPhotoModal(r);
    setPhotoFiles([]); setPhotoPreviews([]); setPhotoCaption('');
    if (photoRef.current) photoRef.current.value = '';
    await loadPhotosForRecord(r.id);
  };

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const save = async e => {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      await api.put(`/time/${editing.id}`, form);
      setMsg({ type:'success', text:'✅ Job details updated.' });
      await load();
      setEditing(r => ({ ...r, ...form }));
    } catch (err) {
      setMsg({ type:'error', text: err.response?.data?.error || 'Save failed' });
    } finally { setLoading(false); }
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    setPhotoFiles(files);
    setPhotoPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const uploadPhotos = async () => {
    if (!photoFiles.length || !photoModal?.id) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      for (const f of photoFiles) fd.append('photos', f);
      fd.append('caption', photoCaption);
      await api.post(`/jobphotos/record/${photoModal.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoFiles([]); setPhotoPreviews([]); setPhotoCaption('');
      if (photoRef.current) photoRef.current.value = '';
      await loadPhotosForRecord(photoModal.id);
    } catch (err) {
      setMsg({ type:'error', text: err.response?.data?.error || 'Upload failed' });
    } finally { setPhotoUploading(false); }
  };

  const deletePhoto = async (photoId, recordId) => {
    if (!confirm('Remove this photo?')) return;
    try {
      await api.delete(`/jobphotos/${photoId}`);
      setPhotoMap(m => ({ ...m, [recordId]: (m[recordId] || []).filter(p => p.id !== photoId) }));
    } catch (e) { /* ignore */ }
  };

  return (
    <div>
      <div className="page-header">
        <h1>📋 My Jobs</h1>
        <p>View and edit job site details and photos for all your work sessions.</p>
      </div>

      {records.length === 0 && (
        <div className="card text-center" style={{ padding:'3rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>📋</div>
          <p style={{ color:'var(--gray-500)' }}>No job records yet. Clock in to start a session.</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        {records.map(r => (
          <div key={r.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'.5rem' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'1rem' }}>
                  {r.clock_in ? new Date(r.clock_in + 'Z').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) : '—'}
                </div>
                <div style={{ fontSize:'.82rem', color:'var(--gray-400)', marginTop:'.15rem' }}>
                  {r.clock_in ? new Date(r.clock_in + 'Z').toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }) + ' CT' : ''} — {r.clock_out ? new Date(r.clock_out + 'Z').toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }) + ' CT' : 'In Progress'}
                  {r.duration_minutes > 0 && <span style={{ marginLeft:'.5rem', fontWeight:600, color:'var(--blue-700)' }}>({fmtDuration(r.duration_minutes)})</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:'.5rem', alignItems:'center', flexWrap:'wrap' }}>
                {!r.clock_out && <span className="badge badge-blue">Active</span>}
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏️ Edit Details</button>
                <button className="btn btn-primary btn-sm" onClick={() => openPhotos(r)}>📷 Photos</button>
              </div>
            </div>

            {/* Summary of job site info */}
            {(r.job_address || r.job_contact || r.scope_of_work || r.job_notes) && (
              <div style={{ marginTop:'1rem', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'.75rem' }}>
                {r.job_address && (
                  <div>
                    <div style={{ fontSize:'.72rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.2rem' }}>📍 Address</div>
                    <div style={{ fontSize:'.88rem', display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
                      {r.job_address}
                      <MapsButton address={r.job_address} label="Navigate" />
                    </div>
                  </div>
                )}
                {r.job_contact && (
                  <div>
                    <div style={{ fontSize:'.72rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.2rem' }}>📞 Contact</div>
                    <div style={{ fontSize:'.88rem' }}>{r.job_contact}</div>
                  </div>
                )}
                {r.scope_of_work && (
                  <div>
                    <div style={{ fontSize:'.72rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.2rem' }}>🔧 Scope of Work</div>
                    <div style={{ fontSize:'.88rem' }}>{r.scope_of_work}</div>
                  </div>
                )}
                {r.job_notes && (
                  <div>
                    <div style={{ fontSize:'.72rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.2rem' }}>📝 Notes</div>
                    <div style={{ fontSize:'.88rem' }}>{r.job_notes}</div>
                  </div>
                )}
              </div>
            )}

            {(!r.job_address && !r.job_contact && !r.scope_of_work && !r.job_notes) && (
              <div style={{ marginTop:'.75rem', color:'var(--gray-300)', fontSize:'.85rem' }}>
                No job site details recorded. Tap "Edit Details" to add them.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Edit modal ── */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Edit Job Details</h2>
              <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}
              <div style={{ fontSize:'.82rem', color:'var(--gray-400)', marginBottom:'1rem' }}>
                Session: {editing.clock_in ? new Date(editing.clock_in + 'Z').toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT' : '—'}
              </div>
              <form onSubmit={save}>
                <div className="form-group">
                  <label>📍 Job Address</label>
                  <input name="job_address" value={form.job_address} onChange={handle} className="form-control" placeholder="123 Main St, City, State ZIP" />
                </div>
                <div className="form-group">
                  <label>📞 Contact Info</label>
                  <input name="job_contact" value={form.job_contact} onChange={handle} className="form-control" placeholder="Client name, phone number, or email" />
                </div>
                <div className="form-group">
                  <label>🔧 Scope of Work</label>
                  <textarea name="scope_of_work" value={form.scope_of_work} onChange={handle} className="form-control" rows={4} placeholder="Describe the work performed or to be performed…" />
                </div>
                <div className="form-group">
                  <label>📝 Notes</label>
                  <textarea name="job_notes" value={form.job_notes} onChange={handle} className="form-control" rows={3} placeholder="Special instructions, gate codes, observations…" />
                </div>
                <div style={{ display:'flex', gap:'.75rem', justifyContent:'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Save Details'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Photos modal ── */}
      {photoModal && (
        <div className="modal-overlay" onClick={() => setPhotoModal(null)}>
          <div className="modal" style={{ maxWidth:580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📷 Job Photos</h2>
              <button className="modal-close" onClick={() => setPhotoModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:'.82rem', color:'var(--gray-400)', marginBottom:'1rem' }}>
                Session: {photoModal.clock_in ? new Date(photoModal.clock_in + 'Z').toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT' : '—'}
                {photoModal.job_address && <span style={{ marginLeft:'.5rem' }}>· {photoModal.job_address}</span>}
              </div>

              {/* Existing photos */}
              {(photoMap[photoModal.id] || []).length > 0 && (
                <div style={{ marginBottom:'1.25rem' }}>
                  <div style={{ fontSize:'.8rem', fontWeight:700, color:'var(--blue-700)', textTransform:'uppercase', marginBottom:'.5rem' }}>Uploaded Photos</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'.6rem' }}>
                    {(photoMap[photoModal.id] || []).map(p => (
                      <div key={p.id} style={{ position:'relative' }}>
                        <img
                          src={p.file_path}
                          alt={p.caption || 'Job photo'}
                          style={{ width:90, height:90, objectFit:'cover', borderRadius:6, border:'2px solid var(--blue-200)', cursor:'pointer' }}
                          onClick={() => setLightbox(p)}
                        />
                        {p.caption && <div style={{ fontSize:'.65rem', color:'var(--gray-500)', textAlign:'center', maxWidth:90, marginTop:'.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.caption}</div>}
                        <button
                          onClick={() => deletePhoto(p.id, photoModal.id)}
                          style={{ position:'absolute', top:-6, right:-6, background:'#dc2626', color:'#fff', border:'none', borderRadius:'50%', width:20, height:20, fontSize:'.7rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload new */}
              <div style={{ borderTop:'1px solid var(--blue-100)', paddingTop:'1rem' }}>
                <div style={{ fontSize:'.8rem', fontWeight:700, color:'var(--blue-700)', textTransform:'uppercase', marginBottom:'.75rem' }}>Add Photos</div>
                <div className="form-group">
                  <input ref={photoRef} type="file" accept="image/*" multiple className="form-control" onChange={handlePhotoChange} capture="environment" />
                </div>
                {photoPreviews.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem', marginBottom:'.75rem' }}>
                    {photoPreviews.map((url, i) => (
                      <img key={i} src={url} alt="" style={{ width:70, height:70, objectFit:'cover', borderRadius:6, border:'2px solid var(--blue-300)' }} />
                    ))}
                  </div>
                )}
                <div className="form-group">
                  <label>Caption (optional)</label>
                  <input className="form-control" value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="e.g. Before / After / Completed" />
                </div>
                <button className="btn btn-primary" onClick={uploadPhotos} disabled={photoUploading || !photoFiles.length}>
                  {photoUploading ? <><span className="spinner" /> Uploading…</> : '📤 Upload Photos'}
                </button>
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
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:'1rem', cursor:'pointer' }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth:'90vw', maxHeight:'90vh', position:'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} style={{ position:'absolute', top:-14, right:-14, background:'#fff', border:'none', borderRadius:'50%', width:32, height:32, fontSize:'1.1rem', cursor:'pointer', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,.3)' }}>×</button>
            <img src={lightbox.file_path} alt={lightbox.caption || ''} style={{ maxWidth:'85vw', maxHeight:'80vh', borderRadius:8, display:'block', objectFit:'contain' }} />
            {lightbox.caption && <div style={{ background:'rgba(255,255,255,.95)', padding:'.6rem 1rem', borderRadius:'0 0 8px 8px', fontSize:'.9rem', fontWeight:600 }}>{lightbox.caption}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
