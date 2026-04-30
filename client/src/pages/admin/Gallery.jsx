import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

export default function AdminGallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editForm, setEditForm] = useState({ caption: '', description: '' });
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();

  const [uploadForm, setUploadForm] = useState({ caption: '', description: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/gallery'); setPhotos(data); }
    catch (e) { setErr('Failed to load gallery'); }
    finally { setLoading(false); }
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFiles.length) return setErr('Please select at least one image');
    setUploading(true); setMsg(''); setErr('');
    try {
      for (const file of selectedFiles) {
        const fd = new FormData();
        fd.append('photo', file);
        fd.append('caption', uploadForm.caption);
        fd.append('description', uploadForm.description);
        await api.post('/gallery', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setMsg(`${selectedFiles.length} photo(s) uploaded successfully!`);
      setSelectedFiles([]); setPreviews([]);
      setUploadForm({ caption: '', description: '' });
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this photo from the gallery?')) return;
    try { await api.delete(`/gallery/${id}`); load(); setMsg('Photo deleted.'); }
    catch (e) { setErr('Delete failed'); }
  }

  async function handleEditSave() {
    try {
      await api.put(`/gallery/${editPhoto.id}`, editForm);
      setMsg('Photo updated.'); setEditPhoto(null);
      load();
    } catch (e) { setErr('Update failed'); }
  }

  if (loading) return <div className="flex-center" style={{ height: '60vh' }}><span className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>🖼️ Photo Gallery</h1>
        <p>Manage publicly visible photos of your completed work.</p>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {/* ── Upload form ── */}
      <div className="card mb-2">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Upload New Photos</h2>
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label>Select Images (JPG, PNG, WebP — up to 10 MB each)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="form-control"
              onChange={handleFileChange}
            />
          </div>
          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {previews.map((url, i) => (
                <img key={i} src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '2px solid var(--blue-200)' }} />
              ))}
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Caption (optional)</label>
              <input className="form-control" value={uploadForm.caption} onChange={e => setUploadForm(f => ({ ...f, caption: e.target.value }))} placeholder="e.g. Front lawn mowing — Oak Street" />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <input className="form-control" value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the work" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={uploading || !selectedFiles.length}>
            {uploading ? <><span className="spinner" /> Uploading…</> : '📤 Upload Photos'}
          </button>
        </form>
      </div>

      {/* ── Gallery grid ── */}
      <div className="card">
        <div className="flex-between mb-2">
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Gallery ({photos.length} photos)</h2>
          <a href="/gallery" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">View Public Gallery ↗</a>
        </div>

        {photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>
            No photos yet. Upload some above to populate the public gallery.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {photos.map(photo => (
              <div key={photo.id} style={{ border: '1px solid var(--blue-100)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <div
                  style={{ aspectRatio: '4/3', overflow: 'hidden', background: 'var(--gray-100)', cursor: 'pointer' }}
                  onClick={() => setLightbox(photo)}
                >
                  <img
                    src={photo.file_path}
                    alt={photo.caption || 'Gallery photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{ padding: '.6rem .75rem' }}>
                  {photo.caption && <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: '.15rem' }}>{photo.caption}</div>}
                  {photo.description && <div style={{ fontSize: '.75rem', color: 'var(--gray-500)', marginBottom: '.4rem' }}>{photo.description}</div>}
                  <div style={{ fontSize: '.72rem', color: 'var(--gray-400)', marginBottom: '.5rem' }}>
                    {new Date(photo.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setEditPhoto(photo); setEditForm({ caption: photo.caption, description: photo.description }); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleDelete(photo.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit caption modal ── */}
      {editPhoto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditPhoto(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>Edit Photo</h2>
              <button className="modal-close" onClick={() => setEditPhoto(null)}>×</button>
            </div>
            <div className="modal-body">
              <img src={editPhoto.file_path} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 6, marginBottom: '1rem' }} />
              <div className="form-group">
                <label>Caption</label>
                <input className="form-control" value={editForm.caption} onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditPhoto(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem', cursor: 'pointer' }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: -14, right: -14, background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: '1.1rem', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)' }}>×</button>
            <img src={lightbox.file_path} alt={lightbox.caption || ''} style={{ maxWidth: '85vw', maxHeight: '80vh', borderRadius: 8, display: 'block', objectFit: 'contain' }} />
          </div>
        </div>
      )}
    </div>
  );
}
