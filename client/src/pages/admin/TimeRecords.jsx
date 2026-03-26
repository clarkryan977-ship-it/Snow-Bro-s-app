import { useState, useEffect } from 'react';
import api from '../../utils/api';

function fmtDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminTimeRecords() {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    api.get('/time/all').then(r => setRecords(r.data)).catch(() => {});
  }, []);

  const openDetails = async (r) => {
    setSelected(r);
    setPhotos([]);
    setPhotosLoading(true);
    try {
      const { data } = await api.get(`/jobphotos/record/${r.id}`);
      setPhotos(data);
    } catch (e) { /* ignore */ }
    finally { setPhotosLoading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>⏱ Time Records</h1>
        <p>All employee clock-in/out sessions with job site details and photos.</p>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Duration</th>
                <th>Job Address</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--gray-400)', padding:'2rem' }}>No records yet</td></tr>
              )}
              {records.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.employee_name}</strong></td>
                  <td style={{ fontSize:'.85rem' }}>{r.clock_in ? new Date(r.clock_in).toLocaleString() : '—'}</td>
                  <td style={{ fontSize:'.85rem' }}>{r.clock_out ? new Date(r.clock_out).toLocaleString() : '—'}</td>
                  <td><strong>{fmtDuration(r.duration_minutes)}</strong></td>
                  <td style={{ fontSize:'.82rem', color:'var(--gray-600)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {r.job_address || <span style={{ color:'var(--gray-300)' }}>—</span>}
                  </td>
                  <td>
                    {!r.clock_out
                      ? <span className="badge badge-blue">Clocked In</span>
                      : <span className="badge badge-gray">Completed</span>}
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openDetails(r)}>Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth:580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Job Details — {selected.employee_name}</h2>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
                <div>
                  <div style={{ fontSize:'.75rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.2rem' }}>Clock In</div>
                  <div style={{ fontWeight:600 }}>{selected.clock_in ? new Date(selected.clock_in).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize:'.75rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.2rem' }}>Clock Out</div>
                  <div style={{ fontWeight:600 }}>{selected.clock_out ? new Date(selected.clock_out).toLocaleString() : 'Still clocked in'}</div>
                </div>
                <div>
                  <div style={{ fontSize:'.75rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.2rem' }}>Duration</div>
                  <div style={{ fontWeight:600, color:'var(--blue-700)' }}>{fmtDuration(selected.duration_minutes)}</div>
                </div>
              </div>
              <hr className="divider" />
              {[
                { label:'📍 Job Address',    value: selected.job_address },
                { label:'📞 Contact Info',   value: selected.job_contact },
                { label:'🔧 Scope of Work',  value: selected.scope_of_work },
                { label:'📝 Notes',          value: selected.job_notes },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom:'.9rem' }}>
                  <div style={{ fontSize:'.75rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.25rem' }}>{label}</div>
                  <div style={{ background:'var(--gray-50)', borderRadius:'var(--radius)', padding:'.6rem .75rem', fontSize:'.9rem', color: value ? 'var(--gray-800)' : 'var(--gray-300)', minHeight:'2.2rem' }}>
                    {value || 'Not provided'}
                  </div>
                </div>
              ))}

              {/* ── Job Photos ── */}
              <hr className="divider" />
              <div style={{ fontSize:'.75rem', color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', marginBottom:'.75rem' }}>📷 Job Photos</div>
              {photosLoading && <div className="flex-center" style={{ padding:'1rem' }}><span className="spinner" /></div>}
              {!photosLoading && photos.length === 0 && (
                <div style={{ color:'var(--gray-300)', fontSize:'.88rem', padding:'.5rem 0' }}>No photos uploaded for this session.</div>
              )}
              {!photosLoading && photos.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'.6rem' }}>
                  {photos.map(p => (
                    <div key={p.id} style={{ cursor:'pointer' }} onClick={() => setLightbox(p)}>
                      <img
                        src={p.file_path}
                        alt={p.caption || 'Job photo'}
                        style={{ width:100, height:100, objectFit:'cover', borderRadius:6, border:'2px solid var(--blue-200)', transition:'transform .2s' }}
                        onMouseEnter={e => e.target.style.transform='scale(1.05)'}
                        onMouseLeave={e => e.target.style.transform=''}
                      />
                      {p.caption && (
                        <div style={{ fontSize:'.68rem', color:'var(--gray-500)', textAlign:'center', maxWidth:100, marginTop:'.2rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.caption}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
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
            {lightbox.caption && (
              <div style={{ background:'rgba(255,255,255,.95)', padding:'.6rem 1rem', borderRadius:'0 0 8px 8px', fontSize:'.9rem', fontWeight:600 }}>{lightbox.caption}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
