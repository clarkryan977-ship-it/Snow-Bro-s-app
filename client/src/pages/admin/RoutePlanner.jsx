import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';

// ─── Pure helper functions (module-level, never recreated) ───────────────────

async function geocodeAddress(address, city, state, zip) {
  const q = [address, city, state, zip].filter(Boolean).join(', ');
  if (!q.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SnowBros-RoutePlanner/1.0' } });
    const data = await res.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* ignore */ }
  return null;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborSort(stops, startLat, startLng) {
  const unvisited = [...stops];
  const sorted = [];
  let curLat = startLat, curLng = startLng;
  while (unvisited.length > 0) {
    let nearestIdx = 0, nearestDist = Infinity;
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

function getAddress(b) {
  const parts = [
    b.job_address || b.address,
    b.job_city || b.city,
    b.job_state || b.state,
    b.job_zip || b.zip,
  ].filter(Boolean);
  return parts.join(', ') || 'No address on file';
}

const DEFAULT_START = { lat: 46.8772, lng: -96.7898 };

// ─── Stable sub-components (defined at module level — NEVER inside the parent)
// This prevents React from treating them as new component types on every render,
// which would cause unmount/remount (killing focused inputs and losing state).

function AvailablePanel({ available, bookings, filterDate, loading, onDateChange, onAdd }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      boxShadow: '0 1px 6px rgba(0,0,0,.1)', marginBottom: 16,
      boxSizing: 'border-box', width: '100%',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>📋 Available Jobs</h3>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
          Filter by Date
        </label>
        <input
          type="date"
          value={filterDate}
          onChange={e => onDateChange(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box', minHeight: 44 }}
        />
      </div>
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>Loading bookings…</p>
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
                <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>
                  {b.display_name || b.client_name || 'Unknown'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {b.service_name || 'Service'} · {b.preferred_time || 'No time'}
                </div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 2, wordBreak: 'break-word' }}>
                  📍 {getAddress(b)}
                </div>
              </div>
              <button
                onClick={() => onAdd(b)}
                style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 36, whiteSpace: 'nowrap' }}
              >
                + Add
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function RoutePanel({
  route, saving, saved, geocoding,
  dragIdx, dragOverIdx,
  onSave, onClear, onAutoSort, onMoveStop, onRemove,
  onDragStart, onDragOver, onDrop,
  startAddressRef,
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      boxShadow: '0 1px 6px rgba(0,0,0,.1)', marginBottom: 16,
      boxSizing: 'border-box', width: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🚗 Today's Route ({route.length} stops)</h3>
        {route.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={onClear}
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 36 }}
            >
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      {/* Starting address — uses a ref so typing never triggers parent re-render */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
          Starting Address (for auto-sort)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={startAddressRef}
            defaultValue=""
            placeholder="e.g. 123 Main St, Fargo ND (blank = Fargo)"
            style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, flex: 1, boxSizing: 'border-box', minHeight: 44 }}
          />
          <button
            onClick={onAutoSort}
            disabled={geocoding}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 14, minHeight: 44, whiteSpace: 'nowrap' }}
          >
            {geocoding ? '⏳' : '🧭 Sort'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
          Nearest-neighbor algorithm via OpenStreetMap
        </p>
      </div>

      {/* Empty state */}
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
                <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>
                  {stop.display_name || stop.client_name || 'Unknown'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {stop.service_name || 'Service'} · {stop.preferred_time || 'No time'}
                </div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 2, wordBreak: 'break-word' }}>
                  📍 {getAddress(stop)}
                </div>
                {stop._lat && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>✅ Geocoded</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => onMoveStop(idx, -1)}
                  disabled={idx === 0}
                  style={{ background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 32, opacity: idx === 0 ? 0.3 : 1 }}
                >▲</button>
                <button
                  onClick={() => onMoveStop(idx, 1)}
                  disabled={idx === route.length - 1}
                  style={{ background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 32, opacity: idx === route.length - 1 ? 0.3 : 1 }}
                >▼</button>
                <button
                  onClick={() => onRemove(stop.id)}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 32 }}
                >✕</button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
            <strong>💡 Tip:</strong> Drag stops to reorder, use ▲▼ arrows, or tap "🧭 Sort" to auto-optimize.
            Tap "💾 Save Route" below to push the order to employees.
          </div>

          {/* ── SAVE ROUTE BUTTON — always visible when route has stops ── */}
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              background: saved ? '#22c55e' : '#7c3aed',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '13px 16px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 15, minHeight: 48, width: '100%', marginTop: 12,
              boxSizing: 'border-box', letterSpacing: '.01em',
            }}
          >
            {saving ? '⏳ Saving…' : saved ? '✅ Route Saved!' : '💾 Save Route Order'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RoutePlanner() {
  const [bookings, setBookings]     = useState([]);
  const [route, setRoute]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [geocoding, setGeocoding]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dragIdx, setDragIdx]       = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [msg, setMsg]               = useState('');
  const [activeTab, setActiveTab]   = useState('available');

  // Uncontrolled ref for starting address — typing never triggers a re-render
  const startAddressRef = useRef(null);

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
  const onDragOver  = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop      = (idx) => {
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
    showMsg('📍 Geocoding addresses via OpenStreetMap…', 10000);
    let startLat = DEFAULT_START.lat, startLng = DEFAULT_START.lng;
    const addr = startAddressRef.current?.value?.trim() || '';
    if (addr) {
      const geo = await geocodeAddress(addr, '', '', '');
      if (geo) { startLat = geo.lat; startLng = geo.lng; }
    }
    const geocoded = await Promise.all(route.map(async (stop) => {
      if (stop._geocoded && stop._lat != null) return stop;
      const geo = await geocodeAddress(
        stop.job_address || stop.address || '',
        stop.job_city    || stop.city    || '',
        stop.job_state   || stop.state   || '',
        stop.job_zip     || stop.zip     || '',
      );
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

  // ── Determine screen width for layout (SSR-safe) ──
  // We use a state that updates on mount so the initial render is always
  // single-column (mobile-first), then corrects itself on desktop.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Layout: pure inline styles, zero CSS classes for the panels ──
  // This cannot be overridden by any external stylesheet.
  const outerStyle = {
    padding: 16,
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  };

  const panelsStyle = {
    display: 'flex',
    flexDirection: isDesktop ? 'row' : 'column',
    alignItems: 'flex-start',
    gap: isDesktop ? 16 : 0,
    width: '100%',
    boxSizing: 'border-box',
  };

  const panelStyle = {
    width: '100%',
    boxSizing: 'border-box',
    ...(isDesktop ? { flex: 1, minWidth: 0 } : {}),
  };

  // On mobile: show only the active tab panel; on desktop: show both
  const showAvailable = isDesktop || activeTab === 'available';
  const showRoute     = isDesktop || activeTab === 'route';

  return (
    <div style={outerStyle}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>🗺️ Route Planner</h1>
      <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
        Build today's route, auto-sort by geography, reorder stops, then save so employees see jobs in the right order.
      </p>

      {msg && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#1e40af', fontWeight: 600, fontSize: 14 }}>
          {msg}
        </div>
      )}

      {/* Mobile tab bar — only rendered on mobile */}
      {!isDesktop && (
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <button
            onClick={() => setActiveTab('available')}
            style={{
              flex: 1, padding: '12px 8px', textAlign: 'center', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', border: 'none', transition: 'all .15s',
              background: activeTab === 'available' ? '#2563eb' : '#f8fafc',
              color: activeTab === 'available' ? '#fff' : '#374151',
            }}
          >
            📋 Available ({available.length})
          </button>
          <button
            onClick={() => setActiveTab('route')}
            style={{
              flex: 1, padding: '12px 8px', textAlign: 'center', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', border: 'none', transition: 'all .15s',
              background: activeTab === 'route' ? '#2563eb' : '#f8fafc',
              color: activeTab === 'route' ? '#fff' : '#374151',
            }}
          >
            🚗 Route ({route.length})
          </button>
        </div>
      )}

      {/* Panels */}
      <div style={panelsStyle}>
        {showAvailable && (
          <div style={panelStyle}>
            <AvailablePanel
              available={available}
              bookings={bookings}
              filterDate={filterDate}
              loading={loading}
              onDateChange={setFilterDate}
              onAdd={addToRoute}
            />
          </div>
        )}
        {showRoute && (
          <div style={panelStyle}>
            <RoutePanel
              route={route}
              saving={saving}
              saved={saved}
              geocoding={geocoding}
              dragIdx={dragIdx}
              dragOverIdx={dragOverIdx}
              onSave={saveOrder}
              onClear={clearRoute}
              onAutoSort={autoSort}
              onMoveStop={moveStop}
              onRemove={removeFromRoute}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              startAddressRef={startAddressRef}
            />
          </div>
        )}
      </div>
    </div>
  );
}
