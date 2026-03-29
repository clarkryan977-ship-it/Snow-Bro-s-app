import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import MapsButton from '../../utils/openInMaps.jsx';

export default function ClockInOut() {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ job_address:'', job_contact:'', scope_of_work:'', job_notes:'' });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState('');

  // Photo upload state
  const [photos, setPhotos] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoCaption, setPhotoCaption] = useState('');
  const photoRef = useRef();

  const gpsInterval = useRef(null);
  const clockInterval = useRef(null);

  const loadStatus = async () => {
    const { data } = await api.get('/time/status');
    setStatus(data);
    if (data.record) {
      setForm({
        job_address:    data.record.job_address    || '',
        job_contact:    data.record.job_contact    || '',
        scope_of_work:  data.record.scope_of_work  || '',
        job_notes:      data.record.job_notes      || '',
      });
      loadPhotos(data.record.id);
    }
  };

  const loadPhotos = async (recordId) => {
    try {
      const { data } = await api.get(`/jobphotos/record/${recordId}`);
      setPhotos(data);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { loadStatus(); }, []);

  // Elapsed time ticker
  useEffect(() => {
    if (status?.clocked_in && status?.record?.clock_in) {
      const tick = () => {
        const diff = Date.now() - new Date(status.record.clock_in + 'Z').getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      };
      tick();
      clockInterval.current = setInterval(tick, 1000);
    } else {
      setElapsed('');
      clearInterval(clockInterval.current);
    }
    return () => clearInterval(clockInterval.current);
  }, [status]);

  // GPS sharing while clocked in
  useEffect(() => {
    if (status?.clocked_in) {
      const sendGPS = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(pos => {
          api.post('/gps/update', { latitude: pos.coords.latitude, longitude: pos.coords.longitude }).catch(() => {});
        }, () => {});
      };
      sendGPS();
      gpsInterval.current = setInterval(sendGPS, 30000);
    } else {
      clearInterval(gpsInterval.current);
    }
    return () => clearInterval(gpsInterval.current);
  }, [status?.clocked_in]);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const clockIn = async () => {
    setLoading(true); setMsg(null);
    try {
      await api.post('/time/clock-in', form);
      setMsg({ type:'success', text:'✅ Clocked in! GPS sharing is active.' });
      await loadStatus();
    } catch (err) {
      setMsg({ type:'error', text: err.response?.data?.error || 'Clock-in failed' });
    } finally { setLoading(false); }
  };

  const clockOut = async () => {
    if (!confirm('Clock out now?')) return;
    setLoading(true); setMsg(null);
    try {
      await api.post('/time/clock-out');
      setMsg({ type:'success', text:'✅ Clocked out successfully.' });
      clearInterval(gpsInterval.current);
      await loadStatus();
    } catch (err) {
      setMsg({ type:'error', text: err.response?.data?.error || 'Clock-out failed' });
    } finally { setLoading(false); }
  };

  const saveJobDetails = async () => {
    setLoading(true); setMsg(null);
    try {
      await api.put('/time/current', form);
      setMsg({ type:'success', text:'✅ Job details saved.' });
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
    if (!photoFiles.length || !status?.record?.id) return;
    setPhotoUploading(true); setMsg(null);
    try {
      const fd = new FormData();
      for (const f of photoFiles) fd.append('photos', f);
      fd.append('caption', photoCaption);
      await api.post(`/jobphotos/record/${status.record.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMsg({ type:'success', text:`✅ ${photoFiles.length} photo(s) uploaded.` });
      setPhotoFiles([]); setPhotoPreviews([]); setPhotoCaption('');
      if (photoRef.current) photoRef.current.value = '';
      loadPhotos(status.record.id);
    } catch (err) {
      setMsg({ type:'error', text: err.response?.data?.error || 'Photo upload failed' });
    } finally { setPhotoUploading(false); }
  };

  const deletePhoto = async (photoId) => {
    if (!confirm('Remove this photo?')) return;
    try {
      await api.delete(`/jobphotos/${photoId}`);
      setPhotos(p => p.filter(x => x.id !== photoId));
    } catch (e) { setMsg({ type:'error', text:'Delete failed' }); }
  };

  const isClockedIn = status?.clocked_in;

  return (
    <div>
      <div className="page-header">
        <h1>⏱ Clock In / Out</h1>
        <p>Manage your shift and job site information.</p>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}

      {/* Status card */}
      <div className="card mb-2" style={{ textAlign:'center', padding:'2rem' }}>
        <div style={{ fontSize:'3rem', marginBottom:'.5rem' }}>{isClockedIn ? '🟢' : '⚫'}</div>
        <div style={{ fontSize:'1.3rem', fontWeight:700, color: isClockedIn ? 'var(--blue-700)' : 'var(--gray-500)' }}>
          {isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
        </div>
        {isClockedIn && elapsed && (
          <div style={{ fontSize:'2rem', fontWeight:800, color:'var(--blue-600)', marginTop:'.5rem', fontVariantNumeric:'tabular-nums' }}>
            {elapsed}
          </div>
        )}
        {isClockedIn && status?.record?.clock_in && (
          <div style={{ color:'var(--gray-400)', fontSize:'.85rem', marginTop:'.25rem' }}>
            Since {new Date(status.record.clock_in + 'Z').toLocaleTimeString()}
          </div>
        )}
        <div style={{ marginTop:'1.5rem' }}>
          {isClockedIn ? (
            <button className="btn btn-danger btn-lg" onClick={clockOut} disabled={loading}>
              {loading ? <span className="spinner" /> : '⏹ Clock Out'}
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={clockIn} disabled={loading}>
              {loading ? <span className="spinner" /> : '▶ Clock In'}
            </button>
          )}
        </div>
      </div>

      {/* Job site fields */}
      <div className="card mb-2">
        <div className="flex-between mb-2">
          <h2 style={{ fontSize:'1rem', fontWeight:700 }}>📋 Job Site Information</h2>
          {isClockedIn && (
            <button className="btn btn-primary btn-sm" onClick={saveJobDetails} disabled={loading}>
              Save Details
            </button>
          )}
        </div>
        {!isClockedIn && (
          <div className="alert alert-info mb-2">Fill in job details before clocking in, or update them after.</div>
        )}
        <div className="form-group">
          <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'.5rem' }}>
            <span>📍 Job Address</span>
            {form.job_address && <MapsButton address={form.job_address} label="Open in Maps" />}
          </label>
          <input name="job_address" value={form.job_address} onChange={handle} className="form-control" placeholder="123 Main St, Springfield, IL 62701" />
        </div>
        <div className="form-group">
          <label>📞 Contact Info</label>
          <input name="job_contact" value={form.job_contact} onChange={handle} className="form-control" placeholder="Client name, phone, or email" />
        </div>
        <div className="form-group">
          <label>🔧 Scope of Work</label>
          <textarea name="scope_of_work" value={form.scope_of_work} onChange={handle} className="form-control" rows={3} placeholder="Describe the work to be performed (e.g. Mow front and back lawn, edge driveway, blow clippings)" />
        </div>
        <div className="form-group">
          <label>📝 Notes</label>
          <textarea name="job_notes" value={form.job_notes} onChange={handle} className="form-control" rows={3} placeholder="Any special instructions, gate codes, hazards, etc." />
        </div>
        {!isClockedIn && (
          <p style={{ fontSize:'.82rem', color:'var(--gray-400)' }}>
            📌 GPS location will be shared automatically while you are clocked in.
          </p>
        )}
      </div>

      {/* ── Job Photos ── */}
      {isClockedIn && status?.record?.id && (
        <div className="card">
          <h2 style={{ fontSize:'1rem', fontWeight:700, marginBottom:'1rem' }}>📷 Job Photos</h2>
          <p style={{ fontSize:'.85rem', color:'var(--gray-500)', marginBottom:'1rem' }}>
            Upload photos of the job site or completed work. These will be visible to the admin.
          </p>

          {/* Existing photos */}
          {photos.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.6rem', marginBottom:'1rem' }}>
              {photos.map(p => (
                <div key={p.id} style={{ position:'relative', width:90, height:90 }}>
                  <img src={p.file_path} alt={p.caption || 'Job photo'} style={{ width:90, height:90, objectFit:'cover', borderRadius:6, border:'2px solid var(--blue-200)' }} />
                  <button
                    onClick={() => deletePhoto(p.id)}
                    style={{ position:'absolute', top:-6, right:-6, background:'#dc2626', color:'#fff', border:'none', borderRadius:'50%', width:20, height:20, fontSize:'.7rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Upload new photos */}
          <div className="form-group">
            <label>Select Photos</label>
            <input ref={photoRef} type="file" accept="image/*" multiple className="form-control" onChange={handlePhotoChange} capture="environment" />
          </div>
          {photoPreviews.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.5rem', marginBottom:'.75rem' }}>
              {photoPreviews.map((url, i) => (
                <img key={i} src={url} alt="" style={{ width:70, height:70, objectFit:'cover', borderRadius:6, border:'2px solid var(--blue-300)' }} />
              ))}
            </div>
          )}
          <div className="form-group">
            <label>Caption (optional)</label>
            <input className="form-control" value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="e.g. Before / After / Completed work" />
          </div>
          <button className="btn btn-primary" onClick={uploadPhotos} disabled={photoUploading || !photoFiles.length}>
            {photoUploading ? <><span className="spinner" /> Uploading…</> : '📤 Upload Photos'}
          </button>
        </div>
      )}

      {!isClockedIn && (
        <div className="card">
          <h2 style={{ fontSize:'1rem', fontWeight:700, marginBottom:'.5rem' }}>📷 Job Photos</h2>
          <p style={{ fontSize:'.85rem', color:'var(--gray-400)' }}>Clock in to upload photos for this job session.</p>
        </div>
      )}
    </div>
  );
}
