import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

const STATUS_COLORS = {
  new:       { bg: '#fef3c7', color: '#92400e', label: '🆕 New' },
  contacted: { bg: '#dbeafe', color: '#1e40af', label: '📞 Contacted' },
  confirmed: { bg: '#d1fae5', color: '#065f46', label: '✅ Confirmed' },
  declined:  { bg: '#fee2e2', color: '#991b1b', label: '❌ Declined' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AdminBookingRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updating, setUpdating] = useState({});
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const url = filter === 'all' ? '/booking-requests' : `/booking-requests?status=${filter}`;
    api.get(url)
      .then(r => setRequests(r.data || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      await api.patch(`/booking-requests/${id}/status`, { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { alert('Failed to update status'); }
    finally { setUpdating(u => ({ ...u, [id]: false })); }
  };

  const deleteRequest = async (id) => {
    if (!window.confirm('Delete this booking request?')) return;
    try {
      await api.delete(`/booking-requests/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch { alert('Failed to delete'); }
  };

  const [savingClient, setSavingClient] = useState({});

  const saveAsClient = async (req) => {
    setSavingClient(s => ({ ...s, [req.id]: 'saving' }));
    try {
      // Parse name into first/last
      const nameParts = (req.name || '').trim().split(' ');
      const first_name = nameParts[0] || req.name || 'Unknown';
      const last_name = nameParts.slice(1).join(' ') || '.';
      // Parse address
      const addrParts = (req.address || '').split(',').map(p => p.trim());
      await api.post('/clients', {
        first_name,
        last_name,
        email: req.email || '',
        phone: req.phone || '',
        address: addrParts[0] || req.address || '',
        city: req.city || addrParts[1] || '',
        state: req.state || addrParts[2] || '',
        zip: req.zip || addrParts[3] || '',
        notes: `Added from booking request #${req.id}${req.service_type ? ` — ${req.service_type}` : ''}`,
        active: 0,
      });
      setSavingClient(s => ({ ...s, [req.id]: 'saved' }));
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save client';
      alert(msg);
      setSavingClient(s => ({ ...s, [req.id]: null }));
    }
  };

  const newCount = requests.filter(r => r.status === 'new').length;

  const filterBtnStyle = (active) => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: active ? '#1e3a5f' : '#f1f5f9',
    color: active ? '#fff' : '#374151',
  });

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e3a5f', fontSize: 22 }}>
            📨 Booking Requests
            {newCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 13, marginLeft: 8 }}>
                {newCount} new
              </span>
            )}
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            One-time service requests submitted from the public booking form
          </p>
        </div>
        <button onClick={load} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          🔄 Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'new', 'contacted', 'confirmed', 'declined'].map(s => (
          <button key={s} style={filterBtnStyle(filter === s)} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : STATUS_COLORS[s]?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600 }}>No booking requests{filter !== 'all' ? ` with status "${filter}"` : ''}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>New requests will appear here when customers submit the public booking form.</div>
        </div>
      ) : (
        <div>
          {requests.map(req => {
            const sc = STATUS_COLORS[req.status] || STATUS_COLORS.new;
            const isExpanded = expanded === req.id;
            const addr = [req.address, req.city, req.state, req.zip].filter(Boolean).join(', ');
            return (
              <div key={req.id} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                marginBottom: 12, overflow: 'hidden',
                boxShadow: req.status === 'new' ? '0 0 0 2px #fbbf24' : 'none',
              }}>
                {/* Row header */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : req.id)}
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
                >
                  <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {sc.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{req.name}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      {req.service_type}
                      {req.preferred_date && ` · ${req.preferred_date}`}
                      {addr && ` · ${addr}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{fmtDate(req.created_at)}</div>
                  <span style={{ color: '#94a3b8', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 16px 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Contact</div>
                        <div style={{ fontSize: 14 }}>{req.name}</div>
                        <div style={{ fontSize: 13, color: '#1d4ed8' }}>
                          <a href={`mailto:${req.email}`} style={{ color: '#1d4ed8' }}>{req.email}</a>
                        </div>
                        {req.phone && (
                          <div style={{ fontSize: 13 }}>
                            <a href={`tel:${req.phone}`} style={{ color: '#1d4ed8' }}>{req.phone}</a>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Service</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{req.service_type}</div>
                        {req.preferred_date && <div style={{ fontSize: 13, color: '#64748b' }}>Preferred: {req.preferred_date}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Address</div>
                        <div style={{ fontSize: 14 }}>{addr || '—'}</div>
                      </div>
                    </div>

                    {req.notes && (
                      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 14, color: '#374151' }}>
                        <strong>Notes:</strong> {req.notes}
                      </div>
                    )}

                    {/* Status buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Update status:</span>
                      {['contacted', 'confirmed', 'declined'].map(s => (
                        <button
                          key={s}
                          disabled={req.status === s || updating[req.id]}
                          onClick={() => updateStatus(req.id, s)}
                          style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: req.status === s ? 'default' : 'pointer',
                            background: req.status === s ? STATUS_COLORS[s].bg : '#f1f5f9',
                            color: req.status === s ? STATUS_COLORS[s].color : '#374151',
                            fontSize: 13, fontWeight: req.status === s ? 700 : 400,
                          }}
                        >
                          {STATUS_COLORS[s].label}
                        </button>
                      ))}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        {savingClient[req.id] === 'saved' ? (
                          <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700 }}>✅ Saved to Clients</span>
                        ) : (
                          <button
                            onClick={() => saveAsClient(req)}
                            disabled={savingClient[req.id] === 'saving'}
                            style={{ background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                          >
                            {savingClient[req.id] === 'saving' ? '⏳ Saving…' : '👤 Save as New Client'}
                          </button>
                        )}
                        <button
                          onClick={() => deleteRequest(req.id)}
                          style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
