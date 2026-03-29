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

// Unified address getter — works for both booking objects and client objects
function getAddress(item) {
  const parts = [
    item.job_address || item.address,
    item.job_city    || item.city,
    item.job_state   || item.state,
    item.job_zip     || item.zip,
  ].filter(Boolean);
  return parts.join(', ') || 'No address on file';
}

// Build a Google Maps navigation URL for a stop
function mapsUrl(item) {
  const addr = getAddress(item);
  if (!addr || addr === 'No address on file') return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
}

const DEFAULT_START = { lat: 46.8772, lng: -96.7898 };

// ─── Stable sub-components (module-level — NEVER defined inside the parent) ──

// AvailablePanel: two inner tabs — Bookings and Clients
function AvailablePanel({
  // bookings tab
  bookings, filterDate, loadingBookings, onDateChange,
  // clients tab
  clients, loadingClients, clientSearch, onClientSearch,
  // shared
  routeIds, onAdd,
}) {
  const [innerTab, setInnerTab] = useState('bookings');

  const availableBookings = bookings.filter(b => !routeIds.has(`booking-${b.id}`));
  const filteredClients = clients.filter(c => {
    if (routeIds.has(`client-${c.id}`)) return false;
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase();
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  });

  const tabBtn = (id, label) => (
    <button
      onClick={() => setInnerTab(id)}
      style={{
        flex: 1, padding: '9px 8px', fontWeight: 700, fontSize: 13,
        cursor: 'pointer', border: 'none', transition: 'all .15s',
        background: innerTab === id ? '#2563eb' : '#f1f5f9',
        color: innerTab === id ? '#fff' : '#374151',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      boxShadow: '0 1px 6px rgba(0,0,0,.1)', marginBottom: 16,
      boxSizing: 'border-box', width: '100%',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📋 Available</h3>

      {/* Inner tab bar */}
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 14 }}>
        {tabBtn('bookings', `📅 Bookings (${availableBookings.length})`)}
        {tabBtn('clients',  `👥 Clients (${filteredClients.length})`)}
      </div>

      {/* ── BOOKINGS TAB ── */}
      {innerTab === 'bookings' && (
        <>
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
          {loadingBookings ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>Loading bookings…</p>
          ) : availableBookings.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
              {bookings.length === 0 ? `No active bookings for ${filterDate}` : '✅ All bookings added to route'}
            </p>
          ) : (
            availableBookings.map(b => (
              <div key={b.id} style={{
                padding: '12px 14px', borderRadius: 8, marginBottom: 8,
                background: '#f8fafc', border: '1px solid #e5e7eb',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>
                        {b.display_name || b.client_name || 'Unknown'}
                      </span>
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                        Booking
                      </span>
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
        </>
      )}

      {/* ── CLIENTS TAB ── */}
      {innerTab === 'clients' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <input
              type="text"
              value={clientSearch}
              onChange={e => onClientSearch(e.target.value)}
              placeholder="Search by name or address…"
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box', minHeight: 44 }}
            />
          </div>
          {loadingClients ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>Loading clients…</p>
          ) : filteredClients.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
              {clientSearch ? 'No clients match your search' : 'All clients already on route'}
            </p>
          ) : (
            filteredClients.map(c => (
              <div key={c.id} style={{
                padding: '12px 14px', borderRadius: 8, marginBottom: 8,
                background: '#f8fafc', border: '1px solid #e5e7eb',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>
                        {c.first_name} {c.last_name}
                      </span>
                      <span style={{ background: '#f3e8ff', color: '#7c3aed', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                        Client
                      </span>
                      {c.active === 0 && (
                        <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>📞 {c.phone}</div>
                    )}
                    <div style={{ fontSize: 12, color: '#374151', marginTop: 2, wordBreak: 'break-word' }}>
                      📍 {getAddress(c)}
                    </div>
                  </div>
                  <button
                    onClick={() => onAdd({
                      // Normalise client into a stop-compatible shape
                      _stopType: 'client',
                      _clientId: c.id,
                      id: `client-${c.id}`,
                      display_name: `${c.first_name} ${c.last_name}`,
                      client_name: `${c.first_name} ${c.last_name}`,
                      address: c.address, city: c.city, state: c.state, zip: c.zip,
                      _lat: c.latitude  || null,
                      _lng: c.longitude || null,
                      _geocoded: !!(c.latitude && c.longitude),
                      service_name: c.service_type || 'Service',
                      preferred_time: '',
                      phone: c.phone || '',
                    })}
                    style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 36, whiteSpace: 'nowrap' }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))
          )}
        </>
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
          <button
            onClick={onClear}
            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 36 }}
          >
            ✕ Clear
          </button>
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
            placeholder="e.g. 1812 33rd St S, Moorhead MN (blank = Fargo)"
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
          Nearest-neighbor sort via OpenStreetMap — works for both bookings and clients
        </p>
      </div>

      {/* Empty state */}
      {route.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
          <p>Add bookings or clients from the Available panel to build today's route.</p>
        </div>
      ) : (
        <div>
          {route.map((stop, idx) => {
            const isClient = stop._stopType === 'client';
            const navUrl = mapsUrl(stop);
            return (
              <div
                key={stop.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={() => onDrop(idx)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 12px', borderRadius: 8, marginBottom: 8,
                  background: dragOverIdx === idx ? '#eff6ff' : (isClient ? '#faf5ff' : '#f0fdf4'),
                  border: `2px solid ${dragOverIdx === idx ? '#2563eb' : (isClient ? '#e9d5ff' : '#bbf7d0')}`,
                  cursor: 'grab',
                  opacity: dragIdx === idx ? 0.5 : 1,
                  transition: 'all .15s',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{
                  minWidth: 30, height: 30, borderRadius: '50%',
                  background: isClient ? '#7c3aed' : '#2563eb', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13, flexShrink: 0,
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>
                      {stop.display_name || stop.client_name || 'Unknown'}
                    </span>
                    <span style={{
                      background: isClient ? '#f3e8ff' : '#dbeafe',
                      color: isClient ? '#7c3aed' : '#1d4ed8',
                      fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                    }}>
                      {isClient ? 'Client' : 'Booking'}
                    </span>
                  </div>
                  {!isClient && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {stop.service_name || 'Service'} · {stop.preferred_time || 'No time'}
                    </div>
                  )}
                  {isClient && stop.phone && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>📞 {stop.phone}</div>
                  )}
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 2, wordBreak: 'break-word' }}>
                    📍 {getAddress(stop)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {stop._lat && (
                      <span style={{ fontSize: 11, color: '#22c55e' }}>✅ Geocoded</span>
                    )}
                    {navUrl && (
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                      >
                        🗺️ Navigate
                      </a>
                    )}
                  </div>
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
            );
          })}

          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            💡 Drag to reorder, or use ▲▼ buttons. Click 🗺️ Navigate on any stop to open Google Maps.
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
  const [bookings, setBookings]         = useState([]);
  const [clients, setClients]           = useState([]);
  const [route, setRoute]               = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingClients, setLoadingClients]   = useState(false);
  const [geocoding, setGeocoding]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [filterDate, setFilterDate]     = useState(() => new Date().toISOString().split('T')[0]);
  const [clientSearch, setClientSearch] = useState('');
  const [dragIdx, setDragIdx]           = useState(null);
  const [dragOverIdx, setDragOverIdx]   = useState(null);
  const [msg, setMsg]                   = useState('');
  const [activeTab, setActiveTab]       = useState('available');

  // Uncontrolled ref for starting address — typing never triggers a re-render
  const startAddressRef = useRef(null);

  const showMsg = (text, ms = 3500) => {
    setMsg(text);
    setTimeout(() => setMsg(''), ms);
  };

  // Load bookings filtered by date
  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const r = await api.get('/bookings');
      const filtered = r.data.filter(b =>
        b.preferred_date === filterDate && b.status !== 'completed'
      );
      setBookings(filtered);
    } catch (e) { console.error(e); }
    setLoadingBookings(false);
  }, [filterDate]);

  // Load all clients (once on mount)
  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const r = await api.get('/clients');
      setClients(r.data);
    } catch (e) { console.error(e); }
    setLoadingClients(false);
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { loadClients(); }, [loadClients]);

  // Set of IDs already on the route (format: "booking-{id}" or "client-{id}")
  const routeIds = new Set(route.map(s => s.id));

  const addToRoute = (stop) => {
    // For booking stops, normalise the id to "booking-{id}" format
    const normStop = stop._stopType === 'client'
      ? stop  // already normalised in AvailablePanel
      : {
          ...stop,
          _stopType: 'booking',
          id: `booking-${stop.id}`,
          _bookingId: stop.id,
          _lat: stop._lat ?? (stop.latitude  || null),
          _lng: stop._lng ?? (stop.longitude || null),
          _geocoded: stop._geocoded ?? !!(stop.latitude && stop.longitude),
        };

    setRoute(prev => [...prev, normStop]);
    showMsg(`✅ Added ${normStop.display_name || normStop.client_name} to route`);
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
      // Separate booking stops from client stops
      const bookingOrders = route
        .filter(s => s._stopType === 'booking')
        .map((s, idx) => ({ id: s._bookingId, route_order: idx + 1 }));

      // Save booking route order
      if (bookingOrders.length > 0) {
        await api.patch('/bookings/route-order', { orders: bookingOrders });
      }

      // Client stops don't need to be saved to the DB for today's route —
      // they are ephemeral (just for navigation today). We still show them
      // in the saved route display so the employee sees the full stop list.

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      showMsg(`💾 Route saved! ${bookingOrders.length} booking stop${bookingOrders.length !== 1 ? 's' : ''} ordered for employees.`);
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
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Layout: pure inline styles, zero CSS classes for the panels ──
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
        Add bookings <em>or</em> any client directly to today's route. Auto-sort by geography, reorder stops, then save so employees see jobs in the right order.
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
            📋 Available
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
              bookings={bookings}
              filterDate={filterDate}
              loadingBookings={loadingBookings}
              onDateChange={setFilterDate}
              clients={clients}
              loadingClients={loadingClients}
              clientSearch={clientSearch}
              onClientSearch={setClientSearch}
              routeIds={routeIds}
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
