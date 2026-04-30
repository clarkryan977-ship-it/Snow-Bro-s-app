import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

const DOC_TYPES = {
  drivers_license:  "Driver's License",
  insurance_cert:   'Insurance Certificate',
  w4:               'W-4',
  i9:               'I-9',
  direct_deposit:   'Direct Deposit Form',
  signed_agreement: 'Signed Agreement',
  certification:    'Certification / License',
  background_check: 'Background Check',
  other:            'Other',
};

function getFileIcon(mime) {
  if (!mime) return '📄';
  if (mime === 'application/pdf') return '📕';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('word')) return '📝';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
  if (mime === 'text/plain') return '📃';
  return '📄';
}

export default function EmployeeDocuments() {
  const [docs,       setDocs]       = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [msg,        setMsg]        = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ employee_id: '', doc_type: 'other', label: '' });
  const fileRef = useRef();

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const load = async () => {
    setLoading(true);
    try {
      const [docsRes, empRes] = await Promise.all([
        api.get('/documents/all'),
        api.get('/employees'),
      ]);
      setDocs(docsRes.data);
      setEmployees(empRes.data);
    } catch { flash('error', 'Failed to load documents'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleView = (id) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const baseURL = api.defaults.baseURL || '';
    window.open(`${baseURL}/documents/${id}/download?token=${token}`, '_blank');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocs(prev => prev.filter(d => d.id !== id));
      flash('success', 'Document deleted');
    } catch { flash('error', 'Failed to delete document'); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files[0];
    if (!file) { flash('error', 'Please select a file'); return; }
    if (!uploadForm.employee_id) { flash('error', 'Please select an employee'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', uploadForm.doc_type);
      fd.append('label', uploadForm.label);
      await api.post(`/documents/admin-upload/${uploadForm.employee_id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      flash('success', 'Document uploaded successfully');
      setShowUpload(false);
      setUploadForm({ employee_id: '', doc_type: 'other', label: '' });
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const filtered = docs.filter(d => {
    if (filter !== 'all' && d.doc_type !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (`${d.first_name} ${d.last_name}`).toLowerCase().includes(s)
        || d.file_name.toLowerCase().includes(s)
        || (d.label || '').toLowerCase().includes(s)
        || (d.email || '').toLowerCase().includes(s);
    }
    return true;
  });

  const grouped = {};
  filtered.forEach(d => {
    const key = d.employee_id;
    if (!grouped[key]) grouped[key] = { name: `${d.first_name} ${d.last_name}`, email: d.email, docs: [] };
    grouped[key].docs.push(d);
  });

  const inputStyle = {
    padding: '.5rem .8rem', border: '1.5px solid #d1d5db', borderRadius: 8,
    fontSize: '.9rem', outline: 'none', fontFamily: 'inherit', background: '#fff', color: '#1e293b',
  };

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1>📁 Employee Documents</h1>
          <p>Upload and manage HR documents for all employees.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(s => !s)}>
          {showUpload ? '✕ Cancel' : '⬆️ Upload Document'}
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {showUpload && (
        <div className="card" style={{ marginBottom: '1.25rem', background: '#f0f9ff', border: '2px solid #1d4ed8' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#1d4ed8', fontSize: '1rem' }}>Upload Document for Employee</h3>
          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 600, color: '#374151', marginBottom: '.3rem' }}>Employee *</label>
                <select style={{ ...inputStyle, width: '100%' }} value={uploadForm.employee_id}
                  onChange={e => setUploadForm(f => ({ ...f, employee_id: e.target.value }))} required>
                  <option value="">— Select employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 600, color: '#374151', marginBottom: '.3rem' }}>Document Type *</label>
                <select style={{ ...inputStyle, width: '100%' }} value={uploadForm.doc_type}
                  onChange={e => setUploadForm(f => ({ ...f, doc_type: e.target.value }))}>
                  {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 600, color: '#374151', marginBottom: '.3rem' }}>Label / Description</label>
                <input style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} type="text"
                  placeholder="e.g. 2024 W-4, CDL Class A" value={uploadForm.label}
                  onChange={e => setUploadForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 600, color: '#374151', marginBottom: '.3rem' }}>File *</label>
                <input ref={fileRef} type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt"
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', padding: '.4rem .6rem' }} required />
                <div style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: '.25rem' }}>PDF, images, Word, Excel, text — max 15MB</div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? '⏳ Uploading...' : '⬆️ Upload Document'}
            </button>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem', padding: '.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="Search by name, file, or label..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, minWidth: 220 }} />
          <select style={inputStyle} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Types ({docs.length})</option>
            {Object.entries(DOC_TYPES).map(([k, v]) => {
              const count = docs.filter(d => d.doc_type === k).length;
              return count > 0 ? <option key={k} value={k}>{v} ({count})</option> : null;
            })}
          </select>
          <span style={{ fontSize: '.85rem', color: '#64748b' }}>
            {filtered.length} doc{filtered.length !== 1 ? 's' : ''} · {Object.keys(grouped).length} employee{Object.keys(grouped).length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          {docs.length === 0
            ? 'No documents uploaded yet. Use the "Upload Document" button to add HR documents for employees.'
            : 'No documents match your search.'}
        </div>
      ) : (
        Object.values(grouped).map(group => (
          <div key={group.name} className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', paddingBottom: '.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>{group.name}</span>
                <span style={{ color: '#94a3b8', fontSize: '.82rem', marginLeft: '.5rem' }}>{group.email}</span>
              </div>
              <span style={{ fontSize: '.8rem', color: '#64748b', background: '#f1f5f9', padding: '.2rem .6rem', borderRadius: 12 }}>
                {group.docs.length} doc{group.docs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {group.docs.map(doc => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem .85rem', background: '#f8fafc', borderRadius: 8, gap: '.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', minWidth: 0 }}>
                    <span style={{ fontSize: '1.3rem' }}>{getFileIcon(doc.mime_type)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.label || doc.file_name}
                      </div>
                      <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>
                        {DOC_TYPES[doc.doc_type] || doc.doc_type}
                        {doc.label && doc.label !== doc.file_name && <span> · {doc.file_name}</span>}
                        {' · '}{new Date(doc.uploaded_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}
                        {doc.uploaded_by_name && <span> · by {doc.uploaded_by_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleView(doc.id)}>👁 View</button>
                    <button className="btn btn-sm"
                      style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                      onClick={() => handleDelete(doc.id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
