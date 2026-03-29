import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

const DOC_TYPES = [
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'w4', label: 'W-4' },
  { value: 'i9', label: 'I-9' },
  { value: 'direct_deposit', label: 'Direct Deposit Form' },
  { value: 'certification', label: 'Certification / License' },
  { value: 'other', label: 'Other' },
];

export default function MyDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('other');
  const [msg, setMsg] = useState(null);
  const fileRef = useRef();

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000); };

  const loadDocs = async () => {
    try {
      const { data } = await api.get('/documents/my');
      setDocs(data);
    } catch { flash('error', 'Failed to load documents'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDocs(); }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return flash('error', 'Please select a file');
    if (file.size > 10 * 1024 * 1024) return flash('error', 'File must be under 10MB');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', docType);

    setUploading(true);
    try {
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      flash('success', 'Document uploaded successfully!');
      fileRef.current.value = '';
      setDocType('other');
      await loadDocs();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      flash('success', 'Document deleted');
      await loadDocs();
    } catch { flash('error', 'Failed to delete'); }
  };

  const handleView = (id) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const baseURL = api.defaults.baseURL || '';
    window.open(`${baseURL}/documents/${id}/download?token=${token}`, '_blank');
  };

  const typeLabel = (val) => DOC_TYPES.find(d => d.value === val)?.label || val;

  return (
    <div>
      <div className="page-header">
        <h1>My Documents</h1>
        <p>Upload and manage your HR documents securely.</p>
      </div>

      {msg && (
        <div style={{
          padding: '.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontWeight: 600,
          background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'success' ? '#14532d' : '#991b1b',
          border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>{msg.text}</div>
      )}

      {/* Upload Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Upload New Document</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>
              Document Type
            </label>
            <select className="form-control" value={docType} onChange={e => setDocType(e.target.value)}>
              {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>
              File (PDF, JPG, PNG — max 10MB)
            </label>
            <input type="file" ref={fileRef} className="form-control" accept=".pdf,.jpg,.jpeg,.png" />
          </div>
          <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}
            style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>My Uploaded Documents</h3>
        {loading ? <p>Loading...</p> : docs.length === 0 ? (
          <p style={{ color: 'var(--gray-500)' }}>No documents uploaded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>File Name</th>
                  <th>Format</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <span style={{
                        background: '#e0f2fe', color: '#0369a1', padding: '2px 8px',
                        borderRadius: 4, fontSize: '.8rem', fontWeight: 600,
                      }}>{typeLabel(doc.doc_type)}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{doc.file_name}</td>
                    <td style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>
                      {doc.mime_type === 'application/pdf' ? 'PDF' : doc.mime_type.includes('png') ? 'PNG' : 'JPG'}
                    </td>
                    <td style={{ fontSize: '.85rem' }}>
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleView(doc.id)}>
                          View
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
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
