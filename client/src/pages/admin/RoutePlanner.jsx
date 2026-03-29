import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

// ─── Nominatim geocoding (OpenStreetMap, free, no key needed) ───
async function geocodeAddress(address, city, state, zip) {
  const q = [address, city, state, zip].filter(Boolean).join(', ');
  if (!q.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SnowBros-RoutePlanner/1.0' } });
    const data = await res.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (e) { /* ignore */ }
  return null;
}

// ─── Haversine distance (km) ───
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Nearest-neighbor TSP ───
function nearestNeighborSort(stops, startLat, startLng) {
  const unvisited = [...stops];
  const sorted = [];
  let curLat = startLat;
  let curLng = startLng;
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const s = unvisited[i];
      if (s._lat != null && s._lng != null) {
        const d = haversine(curLat, curLng, s._lat, s._lng);
        if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
      }
    }
    const next = unvisited.splice(nearestIdx, 1)[0];
    sorted.push(next);
    curLat = next._lat ?? curLat;
    curLng = next._lng ?? curLng;
  }
  return sorted;
}

const DEFAULT_START = { lat: 46.8772, lng: -96.7898 };

export default function RoutePlanner() {
  const [bookings, setBookings] = useState([]);
  const [route, setRoute] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [startAddress, setStartAddress] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('available');

  const showMsg = (text, ms = 3500) => {
    setMsg(text);
    setTimeout(() => setMsg(''), ms);
  };

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/bookings');
      const filtered = r.data.filter(b =>
        b.preferred_date === filterDate && b.status !== 'completed'
      );
      setBookings(filtered);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterDate]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const available = bookings.filter(b => !route.some(r => r.id === b.id));

  const addToRoute = (booking) => {
    setRoute(prev => [...prev, { ...booking, _lat: null, _lng: null, _geocoded: false }]);
    showMsg(`✅ Added ${booking.display_name || booking.client_name} to route`);
    setActiveTab('route');
  };

  const removeFromRoute = (id) => setRoute(prev => prev.filter(s => s.id !== id));

  const moveStop = (idx, dir) => {
    setRoute(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop = (idx) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    setRoute(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const autoSort = async () => {
    if (route.length === 0) { showMsg('Add stops to the route first'); return; }
    setGeocoding(true);
    showMsg('📍 Geocoding addresses via OpenStreetMap...', 10000);
    let startLat = DEFAULT_START.lat;
    let startLng = DEFAULT_START.lng;
    if (startAddress.trim()) {
      const geo = await geocodeAddress(startAddress, '', '', '');
      if (geo) { startLat = geo.lat; startLng = geo.lng; }
    }
    const geocoded = await Promise.all(route.map(async (stop) => {
      if (stop._geocoded && stop._lat != null) return stop;
      const addr = stop.job_address || stop.address || '';
      const city = stop.job_city || stop.city || '';
      const state = stop.job_state || stop.state || '';
      const zip = stop.job_zip || stop.zip || '';
      const geo = await geocodeAddress(addr, city, state, zip);
      return { ...stop, _lat: geo?.lat ?? null, _lng: geo?.lng ?? null, _geocoded: true };
    }));
    const sorted = nearestNeighborSort(geocoded, startLat, startLng);
    setRoute(sorted);
    setGeocoding(false);
    showMsg(`🧭 Route optimized! ${sorted.length} stops sorted by proximity.`);
  };

  const saveOrder = async () => {
    if (route.length === 0) return;
    setSaving(true);
    try {
      const orders = route.map((stop, idx) => ({ id: stop.id, route_order: idx + 1 }));
      await api.patch('/bookings/route-order', { orders });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      showMsg('💾 Route saved! Employees see jobs in this order.');
    } catch (e) {
      showMsg('❌ Failed to save: ' + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const clearRoute = () => {
    if (!window.confirm('Clear all stops from the route?')) return;
    setRoute([]);
  };

  const getAddress = (b) => {
    const parts = [b.job_address || b.address, b.job_city || b.city, b.job_state || b.state, b.job_zip || b.zip].filter(Boolean);
    return parts.join(', ') || 'No address on file';
  };

  const S = {
    card: { background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 1px 6px rgba(0,0,0,.1)', marginBottom: 16, boxSizing: 'border-box', width: '100%' },
    msgBox: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#1e40af', fontWeight: 600, fontSize: 14 },
    input: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box', minHeight: 44 },
    btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14, minHeight: 44, whiteSpace: 'nowrap' },
    btnPurple: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14, minHeight: 44, whiteSpace: 'nowrap' },
    btnGray: { background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 36 },
    btnSmRed: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 36 },
    btnSmGreen: { background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 36 },
  };

  const AvailablePanel = () => (
    <div style={S.card}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>📋 Available Jobs</h3>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Filter by Date</label>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={S.input} />
      </div>
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>Loading bookings...</p>
      ) : available.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
          {bookings.length === 0 ? `No active bookings for ${filterDate}` : '✅ All bookings added to route'}
        </p>
      ) : (
        available.map(b => (
          <div key={b.id} style={{
            padding: '12px 14px', borderRadius: 8, marginBottom: 8,
            background: '#f8fafc', border: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{b.display_name || b.client_name || 'Unknown'}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{b.service_name || 'Service'} · {b.preferred_time || 'No time'}</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 2, wordBreak: 'break-word' }}>📍 {getAddress(b)}</div>
              </div>
              <button onClick={() => addToRoute(b)} style={S.btnSmGreen}>+ Add</button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const RoutePanel = () => (
    <div style={S.card}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🚗 Today's Route ({route.length} stops)</h3>
        {route.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={clearRoute} style={S.btnSmRed}>✕ Clear</button>
            <button onClick={saveOrder} disabled={saving} style={{ ...S.btnGray, background: saved ? '#22c55e' : '#7c3aed' }}>
              {saving ? '...' : saved ? '✅ Saved!' : '💾 Save'}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
          Starting Address (for auto-sort)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="e.g. 123 Main St, Fargo ND (blank = Fargo)"
            value={startAddress}
            onChange={e => setStartAddress(e.target.value)}
            style={{ ...S.input, flex: 1 }}
          />
          <button onClick={autoSort} disabled={geocoding} style={{ ...S.btnPrimary, padding: '10px 14px' }}>
            {geocoding ? '⏳' : '🧭 Sort'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
          Nearest-neighbor algorithm via OpenStreetMap
        </p>
      </div>

      {route.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
          <p>Add jobs from Available Jobs to build today's route.</p>
        </div>
      ) : (
        <div>
          {route.map((stop, idx) => (
            <div
              key={stop.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={() => onDrop(idx)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 12px', borderRadius: 8, marginBottom: 8,
                background: dragOverIdx === idx ? '#eff6ff' : '#f0fdf4',
                border: `2px solid ${dragOverIdx === idx ? '#2563eb' : '#bbf7d0'}`,
                cursor: 'grab',
                opacity: dragIdx === idx ? 0.5 : 1,
                transition: 'all .15s',
                boxSizing: 'border-box',
              }}
            >
              <div style={{
                minWidth: 30, height: 30, borderRadius: '50%',
                background: '#2563eb', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13, flexShrink: 0,
              }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{stop.display_name || stop.client_name || 'Unknown'}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{stop.service_name || 'Service'} · {stop.preferred_time || 'No time'}</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 2, wordBreak: 'break-word' }}>📍 {getAddress(stop)}</div>
                {stop._lat && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>✅ Geocoded</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <button onClick={() => moveStop(idx, -1)} disabled={idx === 0}
                  style={{ ...S.btnGray, padding: '5px 10px', opacity: idx === 0 ? 0.3 : 1, minHeight: 32 }}>▲</button>
                <button onClick={() => moveStop(idx, 1)} disabled={idx === route.length - 1}
                  style={{ ...S.btnGray, padding: '5px 10px', opacity: idx === route.length - 1 ? 0.3 : 1, minHeight: 32 }}>▼</button>
                <button onClick={() => removeFromRoute(stop.id)}
                  style={{ ...S.btnSmRed, padding: '5px 10px', minHeight: 32 }}>✕</button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
            <strong>💡 Tip:</strong> Drag stops to reorder, use ▲▼ arrows, or tap "🧭 Sort" to auto-optimize by geography.
            Tap "💾 Save" to push the order to employees' Assigned Jobs page.
          </div>

          <button
            onClick={saveOrder}
            disabled={saving}
            style={{ ...S.btnPurple, width: '100%', marginTop: 12, background: saved ? '#22c55e' : '#7c3aed' }}
          >
            {saving ? 'Saving...' : saved ? '✅ Route Saved!' : '💾 Save Route Order'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Scoped CSS — flex column on mobile, side-by-side on desktop */}
      <style>{`
        .rp-wrap {
          padding: 16px;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        .rp-tab-bar {
          display: flex;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          margin-bottom: 16px;
        }
        .rp-tab-btn {
          flex: 1;
          padding: 12px 8px;
          text-align: center;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: all .15s;
        }
        /* Mobile: flex column, both panels full width, tab bar visible */
        .rp-panels {
          display: flex;
          flex-direction: column;
          gap: 0;
          width: 100%;
        }
        .rp-panel {
          width: 100%;
          box-sizing: border-box;
        }
        /* Desktop (≥768px): side by side, tab bar hidden */
        @media (min-width: 768px) {
          .rp-tab-bar { display: none; }
          .rp-panels {
            flex-direction: row;
            align-items: flex-start;
            gap: 16px;
          }
          .rp-panel {
            flex: 1;
            min-width: 0;
          }
          .rp-panel-available { display: block !important; }
          .rp-panel-route { display: block !important; }
        }
      `}</style>

      <div className="rp-wrap">
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>🗺️ Route Planner</h1>
        <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
          Build today's route, auto-sort by geography, reorder stops, then save so employees see jobs in the right order.
        </p>

        {msg && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#1e40af', fontWeight: 600, fontSize: 14 }}>
            {msg}
          </div>
        )}

        {/* Mobile tab bar */}
        <div className="rp-tab-bar">
          <button
            className="rp-tab-btn"
            style={{ background: activeTab === 'available' ? '#2563eb' : '#f8fafc', color: activeTab === 'available' ? '#fff' : '#374151' }}
            onClick={() => setActiveTab('available')}
          >
            📋 Available ({available.length})
          </button>
          <button
            className="rp-tab-btn"
            style={{ background: activeTab === 'route' ? '#2563eb' : '#f8fafc', color: activeTab === 'route' ? '#fff' : '#374151' }}
            onClick={() => setActiveTab('route')}
          >
            🚗 Route ({route.length})
          </button>
        </div>

        {/* Panels — stacked on mobile, side-by-side on desktop */}
        <div className="rp-panels">
          <div
            className="rp-panel rp-panel-available"
            style={{ display: activeTab === 'available' ? 'block' : 'none' }}
          >
            <AvailablePanel />
          </div>
          <div
            className="rp-panel rp-panel-route"
            style={{ display: activeTab === 'route' ? 'block' : 'none' }}
          >
            <RoutePanel />
          </div>
        </div>
      </div>
    </>
  );
}
