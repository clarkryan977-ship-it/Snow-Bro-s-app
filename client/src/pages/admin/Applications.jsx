import { useState, useEffect } from 'react';
import api from '../../utils/api';

const STATUS_COLORS = {
  pending:  { bg: '#fef9c3', color: '#92400e', label: '⏳ Pending' },
  reviewed: { bg: '#dbeafe', color: '#1e40af', label: '👁 Reviewed' },
  approved: { bg: '#dcfce7', color: '#166534', label: '✅ Approved' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rejected' },
  hired:    { bg: '#f3e8ff', color: '#6b21a8', label: '🎉 Hired' },
};

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '.2rem .65rem', borderRadius: 20, fontSize: '.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

export default function Applications() {
  const [apps, setApps]           = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState(null);
  const [filter, setFilter]       = useState('all');
  const [converting, setConverting] = useState(false);
  const [convertMsg, setConvertMsg] = useState('');

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/applications');
      setApps(data);
    } catch { flash('error', 'Failed to load applications'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/applications/${id}/status`, { status });
      setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
      flash('success', `Status updated to ${status}`);
    } catch { flash('error', 'Failed to update status'); }
  };

  const addNote = async (id, notes) => {
    try {
      await api.put(`/applications/${id}/notes`, { notes });
      setApps(prev => prev.map(a => a.id === id ? { ...a, admin_notes: notes } : a));
      if (selected?.id === id) setSelected(prev => ({ ...prev, admin_notes: notes }));
      flash('success', 'Notes saved');
    } catch { flash('error', 'Failed to save notes'); }
  };

  const convertToEmployee = async (app) => {
    if (!window.confirm(`Convert ${app.full_name} to an employee record? This will create a new employee profile.`)) return;
    setConverting(true);
    setConvertMsg('');
    try {
      const { data } = await api.post(`/applications/${app.id}/convert`);
      setConvertMsg(`✅ Employee record created! ID: ${data.employee_id}`);
      await updateStatus(app.id, 'hired');
    } catch (err) {
      setConvertMsg(`❌ ${err.response?.data?.error || 'Failed to convert'}`);
    } finally { setConverting(false); }
  };

  const deleteApp = async (id) => {
    if (!window.confirm('Delete this application? This cannot be undone.')) return;
    try {
      await api.delete(`/applications/${id}`);
      setApps(prev => prev.filter(a => a.id !== id));
      if (selected?.id === id) setSelected(null);
      flash('success', 'Application deleted');
    } catch { flash('error', 'Failed to delete application'); }
  };

  const filtered = filter === 'all' ? apps : apps.filter(a => a.status === filter);

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1>📋 Job Applications</h1>
          <p>Review and manage employment applications submitted through the website.</p>
        </div>
        <a
          href="/apply"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
        >
          🔗 View Public Form
        </a>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: '1rem', padding: '.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '.85rem', color: '#64748b', fontWeight: 600 }}>Filter:</span>
          {['all', 'pending', 'reviewed', 'approved', 'rejected', 'hired'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? `All (${apps.length})` : `${STATUS_COLORS[s]?.label || s} (${apps.filter(a => a.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.4fr' : '1fr', gap: '1rem' }}>
        {/* Application list */}
        <div>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              {filter === 'all' ? 'No applications yet. Share the application link with job seekers.' : `No ${filter} applications.`}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {filtered.map(app => (
                <div
                  key={app.id}
                  className="card"
                  onClick={() => { setSelected(app); setConvertMsg(''); }}
                  style={{
                    cursor: 'pointer',
                    border: selected?.id === app.id ? '2px solid #1d4ed8' : '1.5px solid #e2e8f0',
                    padding: '1rem 1.25rem',
                    transition: 'border-color .15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>{app.full_name}</div>
                      <div style={{ fontSize: '.82rem', color: '#64748b', marginTop: '.15rem' }}>
                        {app.position} &middot; {app.email}
                      </div>
                      {app.phone && <div style={{ fontSize: '.82rem', color: '#64748b' }}>{app.phone}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.35rem' }}>
                      <Badge status={app.status} />
                      <span style={{ fontSize: '.75rem', color: '#94a3b8' }}>
                        {new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ position: 'sticky', top: '1rem', alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>{selected.full_name}</h2>
                <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: '.2rem' }}>{selected.position}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
            </div>

            {/* Status actions */}
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
              {Object.entries(STATUS_COLORS).map(([s, info]) => (
                <button
                  key={s}
                  className="btn btn-sm"
                  style={{
                    background: selected.status === s ? info.bg : '#f1f5f9',
                    color: selected.status === s ? info.color : '#64748b',
                    border: `1.5px solid ${selected.status === s ? info.color : '#e2e8f0'}`,
                    fontWeight: selected.status === s ? 700 : 400,
                  }}
                  onClick={() => updateStatus(selected.id, s)}
                >
                  {info.label}
                </button>
              ))}
            </div>

            {/* Contact info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1rem' }}>
              <InfoField label="Email" value={selected.email} />
              <InfoField label="Phone" value={selected.phone} />
              <InfoField label="Address" value={[selected.address, selected.city, selected.state, selected.zip].filter(Boolean).join(', ')} />
              <InfoField label="Applied" value={new Date(selected.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
            </div>

            {selected.availability && (
              <InfoField label="Availability" value={selected.availability} />
            )}
            {selected.experience && (
              <InfoField label="Work Experience" value={selected.experience} multiline />
            )}
            {selected.references_info && (
              <InfoField label="References" value={selected.references_info} multiline />
            )}
            {selected.notes && (
              <InfoField label="Applicant Notes" value={selected.notes} multiline />
            )}

            {/* Admin notes */}
            <AdminNotes
              key={selected.id}
              initial={selected.admin_notes || ''}
              onSave={(notes) => addNote(selected.id, notes)}
            />

            {/* Convert to employee */}
            {(selected.status === 'approved' || selected.status === 'hired') && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginBottom: '.5rem' }}
                  onClick={() => convertToEmployee(selected)}
                  disabled={converting || selected.status === 'hired'}
                >
                  {converting ? '⏳ Creating...' : selected.status === 'hired' ? '🎉 Already Converted to Employee' : '👤 Convert to Employee Record'}
                </button>
                {convertMsg && (
                  <div style={{ fontSize: '.85rem', color: convertMsg.startsWith('✅') ? '#16a34a' : '#dc2626', textAlign: 'center' }}>
                    {convertMsg}
                  </div>
                )}
              </div>
            )}

            {/* Delete */}
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button
                className="btn btn-sm"
                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                onClick={() => deleteApp(selected.id)}
              >
                🗑 Delete Application
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value, multiline }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '.65rem' }}>
      <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '.2rem' }}>{label}</div>
      <div style={{ fontSize: '.9rem', color: '#1e293b', lineHeight: 1.5, whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>{value}</div>
    </div>
  );
}

function AdminNotes({ initial, onSave }) {
  const [notes, setNotes] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await onSave(notes);
    setSaving(false);
  };
  return (
    <div style={{ marginTop: '.5rem' }}>
      <label style={{ fontSize: '.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: '.3rem' }}>
        Admin Notes
      </label>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Internal notes about this applicant..."
        style={{ width: '100%', minHeight: 80, padding: '.6rem .8rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '.88rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
      <button className="btn btn-secondary btn-sm" onClick={save} disabled={saving} style={{ marginTop: '.4rem' }}>
        {saving ? '⏳ Saving...' : '💾 Save Notes'}
      </button>
    </div>
  );
}
