import { useState, useEffect, useRef, useCallback } from 'react';
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

const DEFAULT_START = { lat: 46.8772, lng: -96.7898, label: 'Fargo, ND (default)' };

export default function RoutePlanner() {
  const [bookings, setBookings] = useState([]);
  const [route, setRoute] = useState([]); // stops in current route order
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [startAddress, setStartAddress] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [msg, setMsg] = useState('');

  const showMsg = (text, ms = 3000) => {
    setMsg(text);
    setTimeout(() => setMsg(''), ms);
  };

  // Load bookings for selected date
  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/bookings');
      // Filter by date and non-completed
      const filtered = r.data.filter(b =>
        b.preferred_date === filterDate && b.status !== 'completed'
      );
      setBookings(filtered);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterDate]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  // Bookings not yet in route
  const available = bookings.filter(b => !route.some(r => r.id === b.id));

  // Add booking to route
  const addToRoute = (booking) => {
    setRoute(prev => [...prev, {
      ...booking,
      _lat: null,
      _lng: null,
      _geocoded: false,
    }]);
    showMsg(`✅ Added ${booking.display_name || booking.client_name} to route`);
  };

  // Remove from route
  const removeFromRoute = (id) => {
    setRoute(prev => prev.filter(s => s.id !== id));
  };

  // Move stop up/down
  const moveStop = (idx, dir) => {
    setRoute(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  // ─── Drag & drop ───
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

  // ─── Geocode all stops & auto-sort ───
  const autoSort = async () => {
    if (route.length === 0) { showMsg('Add stops to the route first'); return; }
    setGeocoding(true);
    showMsg('📍 Geocoding addresses via OpenStreetMap...', 10000);

    // Geocode start address
    let startLat = DEFAULT_START.lat;
    let startLng = DEFAULT_START.lng;
    if (startAddress.trim()) {
      const geo = await geocodeAddress(startAddress, '', '', '');
      if (geo) { startLat = geo.lat; startLng = geo.lng; }
    }

    // Geocode each stop
    const geocoded = await Promise.all(route.map(async (stop) => {
      if (stop._geocoded && stop._lat != null) return stop;
      const addr = stop.job_address || stop.address || '';
      const city = stop.job_city || stop.city || '';
      const state = stop.job_state || stop.state || '';
      const zip = stop.job_zip || stop.zip || '';
      const geo = await geocodeAddress(addr, city, state, zip);
      return { ...stop, _lat: geo?.lat ?? null, _lng: geo?.lng ?? null, _geocoded: true };
    }));

    // Nearest-neighbor sort
    const sorted = nearestNeighborSort(geocoded, startLat, startLng);
    setRoute(sorted);
    setGeocoding(false);
    showMsg(`🧭 Route optimized! ${sorted.length} stops sorted by proximity.`);
  };

  // ─── Save route order to DB ───
  const saveOrder = async () => {
    if (route.length === 0) return;
    setSaving(true);
    try {
      const orders = route.map((stop, idx) => ({ id: stop.id, route_order: idx + 1 }));
      await api.patch('/bookings/route-order', { orders });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      showMsg('💾 Route order saved! Employees will see jobs in this order.');
    } catch (e) {
      showMsg('❌ Failed to save route order: ' + e.message);
    }
    setSaving(false);
  };

  // ─── Clear route ───
  const clearRoute = () => {
    if (!window.confirm('Clear all stops from the route?')) return;
    setRoute([]);
  };

  // ─── Styles ───
  const card = { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.1)', marginBottom: 20 };
  const btn = (bg = '#2563eb') => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px',
    fontWeight: 700, cursor: 'pointer', fontSize: 14, transition: 'opacity .15s',
  });
  const btnSm = (bg = '#2563eb') => ({ ...btn(bg), padding: '6px 12px', fontSize: 12 });
  const input = { padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' };

  const getAddress = (b) => {
    const parts = [b.job_address || b.address, b.job_city || b.city, b.job_state || b.state, b.job_zip || b.zip].filter(Boolean);
    return parts.join(', ') || 'No address on file';
  };

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <div className="container">
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>🗺️ Route Planner</h1>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>Build today's route, auto-sort by geography, drag to reorder, then save so employees see jobs in the right order.</p>

        {msg && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#1e40af', fontWeight: 600 }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* ─── LEFT: Available bookings ─── */}
          <div>
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📋 Available Jobs</h3>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Date</label>
                  <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={input} />
                </div>
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
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '12px 14px', borderRadius: 8, marginBottom: 8,
                    background: '#f8fafc', border: '1px solid #e5e7eb',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{b.display_name || b.client_name || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{b.service_name || 'Service'} · {b.preferred_time || 'No time set'}</div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>📍 {getAddress(b)}</div>
                    </div>
                    <button onClick={() => addToRoute(b)} style={btnSm('#22c55e')}>+ Add</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ─── RIGHT: Route stops ─── */}
          <div>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🚗 Today's Route ({route.length} stops)</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {route.length > 0 && (
                    <>
                      <button onClick={clearRoute} style={btnSm('#ef4444')}>✕ Clear</button>
                      <button onClick={saveOrder} disabled={saving} style={btnSm(saved ? '#22c55e' : '#7c3aed')}>
                        {saving ? '...' : saved ? '✅ Saved!' : '💾 Save Order'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Start address for geo-sort */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                  Starting Address (for auto-sort — leave blank to use Fargo, ND)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="e.g. 123 Main St, Fargo ND or shop address"
                    value={startAddress}
                    onChange={e => setStartAddress(e.target.value)}
                    style={{ ...input, flex: 1 }}
                  />
                  <button onClick={autoSort} disabled={geocoding || route.length === 0} style={btnSm('#7c3aed')}>
                    {geocoding ? '⏳' : '🧭 Auto-Sort'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
                  Uses OpenStreetMap Nominatim geocoding + nearest-neighbor algorithm
                </p>
              </div>

              {route.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🗺️</div>
                  <p>Add jobs from the left panel to build today's route.</p>
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
                        padding: '12px 14px', borderRadius: 8, marginBottom: 8,
                        background: dragOverIdx === idx ? '#eff6ff' : '#f0fdf4',
                        border: `2px solid ${dragOverIdx === idx ? '#2563eb' : '#bbf7d0'}`,
                        cursor: 'grab',
                        opacity: dragIdx === idx ? 0.5 : 1,
                        transition: 'all .15s',
                      }}
                    >
                      {/* Stop number */}
                      <div style={{
                        minWidth: 32, height: 32, borderRadius: '50%',
                        background: '#2563eb', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 14, flexShrink: 0,
                      }}>
                        {idx + 1}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{stop.display_name || stop.client_name || 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{stop.service_name || 'Service'} · {stop.preferred_time || 'No time'}</div>
                        <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>📍 {getAddress(stop)}</div>
                        {stop._lat && (
                          <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>
                            ✅ Geocoded ({stop._lat.toFixed(4)}, {stop._lng.toFixed(4)})
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button onClick={() => moveStop(idx, -1)} disabled={idx === 0}
                          style={{ ...btnSm('#6b7280'), padding: '4px 8px', opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                        <button onClick={() => moveStop(idx, 1)} disabled={idx === route.length - 1}
                          style={{ ...btnSm('#6b7280'), padding: '4px 8px', opacity: idx === route.length - 1 ? 0.3 : 1 }}>▼</button>
                        <button onClick={() => removeFromRoute(stop.id)}
                          style={{ ...btnSm('#ef4444'), padding: '4px 8px' }}>✕</button>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                    <strong>💡 Tips:</strong> Drag stops to reorder, use ▲▼ arrows, or click "🧭 Auto-Sort" to optimize by geography.
                    Click "💾 Save Order" to push the order to employees' Assigned Jobs page.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
