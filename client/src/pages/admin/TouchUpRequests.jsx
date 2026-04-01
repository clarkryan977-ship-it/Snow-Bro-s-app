import { useState, useEffect } from 'react';
import api from '../../utils/api';

const STATUS_COLORS = {
  pending:      { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  acknowledged: { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa' },
  completed:    { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
  cancelled:    { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
};

export default function TouchUpRequests() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter]     = useState('all');
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null); // { id, admin_notes }
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/touchup' : `/touchup?status=${filter}`;
      const { data } = await api.get(url);
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status, admin_notes) => {
    setSaving(true);
    try {
      await api.put(`/touchup/${id}`, { status, admin_notes });
      await load();
      setEditing(null);
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const deleteRequest = async (id) => {
    if (!window.confirm('Delete this touch-up request?')) return;
    try {
      await api.delete(`/touchup/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  };

  const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#166534', marginBottom: '8px' }}>
        🔧 Touch-Up Requests
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        Client-submitted requests for additional service touch-ups.
      </p>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'acknowledged', 'completed', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: '1px solid #d1d5db',
              background: filter === s ? '#166534' : '#fff',
              color: filter === s ? '#fff' : '#374151',
              cursor: 'pointer',
              fontWeight: filter === s ? 600 : 400,
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
          <p>No {filter === 'all' ? '' : filter} touch-up requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map(r => {
            const colors = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
            const isEditing = editing?.id === r.id;
            return (
              <div
                key={r.id}
                style={{
                  background: '#fff',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '10px',
                  padding: '16px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>
                      {r.client_name || 'Unknown Client'}
                    </span>
                    {r.client_address && (
                      <span style={{ marginLeft: '10px', color: '#6b7280', fontSize: '0.9rem' }}>
                        📍 {r.client_address}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      padding: '3px 12px',
                      borderRadius: '12px',
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {r.status}
                  </span>
                </div>

                {/* Contact info */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap', fontSize: '0.85rem', color: '#6b7280' }}>
                  {r.client_email && <span>✉️ {r.client_email}</span>}
                  {r.phone && <span>📞 {r.phone}</span>}
                  <span>🕐 {fmt(r.created_at)}</span>
                </div>

                {/* Note */}
                {r.note && (
                  <div style={{ marginTop: '10px', background: '#f9fafb', borderRadius: '6px', padding: '10px', fontSize: '0.9rem', color: '#374151' }}>
                    <strong>Client Note:</strong> {r.note}
                  </div>
                )}

                {/* Admin notes (edit mode) */}
                {isEditing ? (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Admin Notes:</label>
                    <textarea
                      rows={3}
                      value={editing.admin_notes}
                      onChange={e => setEditing(prev => ({ ...prev, admin_notes: e.target.value }))}
                      style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {['pending', 'acknowledged', 'completed', 'cancelled'].map(s => (
                        <button
                          key={s}
                          disabled={saving}
                          onClick={() => updateStatus(r.id, s, editing.admin_notes)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: s === 'completed' ? '#166534' : s === 'acknowledged' ? '#1e40af' : s === 'cancelled' ? '#6b7280' : '#f59e0b',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            textTransform: 'capitalize',
                          }}
                        >
                          Mark {s}
                        </button>
                      ))}
                      <button
                        onClick={() => setEditing(null)}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {r.admin_notes && (
                      <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#374151' }}>
                        <strong>Admin Notes:</strong> {r.admin_notes}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setEditing({ id: r.id, admin_notes: r.admin_notes || '' })}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                      >
                        ✏️ Edit / Update Status
                      </button>
                      {r.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(r.id, 'acknowledged', r.admin_notes)}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                        >
                          ✔ Acknowledge
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'acknowledged') && (
                        <button
                          onClick={() => updateStatus(r.id, 'completed', r.admin_notes)}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#166534', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                        >
                          ✅ Mark Complete
                        </button>
                      )}
                      <button
                        onClick={() => deleteRequest(r.id)}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginLeft: 'auto' }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
