import { useState, useEffect } from 'react';
import api from '../../utils/api';

const DOC_TYPES = {
  drivers_license: "Driver's License",
  w4: 'W-4', i9: 'I-9',
  direct_deposit: 'Direct Deposit Form',
  certification: 'Certification / License',
  other: 'Other',
};

export default function EmployeeDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/documents/all').then(r => setDocs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleView = (id) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const baseURL = api.defaults.baseURL || '';
    window.open(`${baseURL}/documents/${id}/download?token=${token}`, '_blank');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch { alert('Failed to delete'); }
  };

  const filtered = docs.filter(d => {
    if (filter !== 'all' && d.doc_type !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (d.first_name + ' ' + d.last_name).toLowerCase().includes(s)
        || d.file_name.toLowerCase().includes(s)
        || d.email.toLowerCase().includes(s);
    }
    return true;
  });

  // Group by employee
  const grouped = {};
  filtered.forEach(d => {
    const key = d.employee_id;
    if (!grouped[key]) grouped[key] = { name: `${d.first_name} ${d.last_name}`, email: d.email, docs: [] };
    grouped[key].docs.push(d);
  });

  return (
    <div>
      <div className="page-header">
        <h1>Employee Documents</h1>
        <p>View and manage all employee HR documents.</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>
              Search Employee
            </label>
            <input className="form-control" placeholder="Name or email..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>
              Document Type
            </label>
            <select className="form-control" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? <p>Loading...</p> : Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
          No documents found.
        </div>
      ) : (
        Object.entries(grouped).map(([empId, emp]) => (
          <div key={empId} className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{emp.name}</span>
                <span style={{ marginLeft: '.75rem', fontSize: '.85rem', color: 'var(--gray-500)' }}>{emp.email}</span>
              </div>
              <span style={{
                background: '#e0f2fe', color: '#0369a1', padding: '2px 10px',
                borderRadius: 12, fontSize: '.8rem', fontWeight: 700,
              }}>{emp.docs.length} doc{emp.docs.length !== 1 ? 's' : ''}</span>
            </div>
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
                  {emp.docs.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <span style={{
                          background: '#fef3c7', color: '#92400e', padding: '2px 8px',
                          borderRadius: 4, fontSize: '.8rem', fontWeight: 600,
                        }}>{DOC_TYPES[doc.doc_type] || doc.doc_type}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{doc.file_name}</td>
                      <td style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>
                        {doc.mime_type === 'application/pdf' ? 'PDF' : doc.mime_type.includes('png') ? 'PNG' : 'JPG'}
                      </td>
                      <td style={{ fontSize: '.85rem' }}>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '.5rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleView(doc.id)}>View</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
