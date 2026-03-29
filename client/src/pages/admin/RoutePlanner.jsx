import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';

// ─── Pure helpers (module-level) ─────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getStopAddress(stop) {
  const parts = [
    stop.stop_address || stop.address,
    stop.stop_city || stop.city,
    stop.stop_state || stop.state,
    stop.stop_zip || stop.zip,
  ].filter(Boolean);
  return parts.join(', ') || 'No address';
}

function mapsUrl(stop) {
  const addr = getStopAddress(stop);
  if (!addr || addr === 'No address') return null;
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr);
}

function mapsRouteUrl(stops) {
  const withAddr = stops.filter(s => getStopAddress(s) !== 'No address');
  if (withAddr.length === 0) return null;
  if (withAddr.length === 1) return mapsUrl(withAddr[0]);
  const origin = encodeURIComponent(getStopAddress(withAddr[0]));
  const dest   = encodeURIComponent(getStopAddress(withAddr[withAddr.length - 1]));
  const wps    = withAddr.slice(1, -1).map(s => encodeURIComponent(getStopAddress(s))).join('|');
  return 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + dest + (wps ? '&waypoints=' + wps : '');
}

// ─── RouteCard ────────────────────────────────────────────────────────────────
function RouteCard({ route, isSelected, onSelect, onEdit, onDelete }) {
  const empNames = (route.assigned_employees || []).map(e => e.name).join(', ') || 'Unassigned';
  return (
    <div
      onClick={() => onSelect(route.id)}
      style={{
        background: isSelected ? '#1e3a5f' : '#fff',
        color: isSelected ? '#fff' : '#1a1a2e',
        border: '2px solid ' + (isSelected ? '#1e3a5f' : '#e2e8f0'),
        borderRadius: 10, padding: '14px 16px', marginBottom: 10,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{route.name}</div>
          <div style={{ fontSize: 12, opacity: .8 }}>
            {route.route_date
              ? new Date(route.route_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : 'No date set'}
            {' · '}{route.stop_count || 0} stop{route.stop_count !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 12, opacity: .75, marginTop: 2 }}>{'👤 ' + empNames}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onEdit(route); }}
            style={{ background: isSelected ? 'rgba(255,255,255,.2)' : '#f0f4f8', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13 }}
          >✏️</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(route); }}
            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13 }}
          >🗑️</button>
        </div>
      </div>
    </div>
  );
}

// ─── StopCard ─────────────────────────────────────────────────────────────────
function StopCard({ stop, index, onRemove }) {
  const clientName = stop.first_name
    ? stop.first_name + ' ' + stop.last_name
    : (stop.stop_label || ('Stop ' + (index + 1)));
  const addr = getStopAddress(stop);
  const url  = mapsUrl(stop);
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{clientName}</div>
        <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</div>
        {stop.booking_service_type && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>{'📋 ' + stop.booking_service_type}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ background: '#eff6ff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, textDecoration: 'none' }}>
            🗺️
          </a>
        )}
        <button onClick={() => onRemove(stop.id)}
          style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13 }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── AddStopPanel ─────────────────────────────────────────────────────────────
function AddStopPanel({ routeId, existingStopIds, onAdded }) {
  const [tab, setTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState({});

  useEffect(() => {
    setLoading(true);
    if (tab === 'bookings') {
      api.get('/bookings?date=' + filterDate)
        .then(r => setBookings(r.data || []))
        .catch(() => setBookings([]))
        .finally(() => setLoading(false));
    } else {
      api.get('/clients')
        .then(r => setClients(r.data || []))
        .catch(() => setClients([]))
        .finally(() => setLoading(false));
    }
  }, [tab, filterDate]);

  const addBookingStop = async (booking) => {
    setAdding(a => ({ ...a, [booking.id]: true }));
    try {
      await api.post('/routes/' + routeId + '/stops', {
        client_id: booking.client_id,
        booking_id: booking.id,
        stop_label: booking.service_type || 'Service',
        address: booking.address || booking.job_address || '',
        city: booking.city || booking.job_city || '',
        state: booking.state || booking.job_state || '',
        zip: booking.zip || booking.job_zip || '',
      });
      onAdded();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add stop');
    } finally {
      setAdding(a => ({ ...a, [booking.id]: false }));
    }
  };

  const addClientStop = async (client) => {
    setAdding(a => ({ ...a, [client.id]: true }));
    try {
      await api.post('/routes/' + routeId + '/stops', {
        client_id: client.id,
        stop_label: client.first_name + ' ' + client.last_name,
        address: client.address || '',
        city: client.city || '',
        state: client.state || '',
        zip: client.zip || '',
      });
      onAdded();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add stop');
    } finally {
      setAdding(a => ({ ...a, [client.id]: false }));
    }
  };

  const tabStyle = (active) => ({
    flex: 1, padding: '8px 0', border: 'none', borderRadius: 6,
    background: active ? '#1e3a5f' : 'transparent',
    color: active ? '#fff' : '#64748b',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  });

  const filteredClients = clients.filter(c => {
    const name = (c.first_name + ' ' + c.last_name).toLowerCase();
    const addr = (c.address || '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || addr.includes(q);
  });

  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginTop: 12, border: '1px solid #e2e8f0' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#1e3a5f' }}>➕ Add Stops</div>
      <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 3, marginBottom: 12 }}>
        <button style={tabStyle(tab === 'bookings')} onClick={() => setTab('bookings')}>📋 Bookings</button>
        <button style={tabStyle(tab === 'clients')} onClick={() => setTab('clients')}>👥 Clients</button>
      </div>

      {tab === 'bookings' && (
        <div>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 8, fontSize: 13, boxSizing: 'border-box' }} />
          {loading
            ? <div style={{ textAlign: 'center', color: '#64748b', padding: 12 }}>Loading…</div>
            : bookings.length === 0
              ? <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, padding: 12 }}>No bookings for this date</div>
              : bookings.map(b => {
                const key = b.id + '_booking';
                const done = existingStopIds.has(key);
                const cname = b.client_name || b.display_name || ('Client #' + b.client_id);
                return (
                  <div key={b.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{cname}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{b.service_type} · {b.address || b.job_address || 'No address'}</div>
                    </div>
                    <button onClick={() => addBookingStop(b)} disabled={done || adding[b.id]}
                      style={{ background: done ? '#d1fae5' : '#1e3a5f', color: done ? '#065f46' : '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: done ? 'default' : 'pointer', fontWeight: 600, flexShrink: 0 }}>
                      {done ? '✓' : adding[b.id] ? '…' : '+ Add'}
                    </button>
                  </div>
                );
              })
          }
        </div>
      )}

      {tab === 'clients' && (
        <div>
          <input type="text" placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 8, fontSize: 13, boxSizing: 'border-box' }} />
          {loading
            ? <div style={{ textAlign: 'center', color: '#64748b', padding: 12 }}>Loading…</div>
            : filteredClients.length === 0
              ? <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, padding: 12 }}>No clients found</div>
              : filteredClients.map(c => {
                const key = c.id + '_client';
                const done = existingStopIds.has(key);
                const addr = [c.address, c.city, c.state].filter(Boolean).join(', ') || 'No address';
                return (
                  <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</div>
                    </div>
                    <button onClick={() => addClientStop(c)} disabled={done || adding[c.id]}
                      style={{ background: done ? '#d1fae5' : '#1e3a5f', color: done ? '#065f46' : '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: done ? 'default' : 'pointer', fontWeight: 600, flexShrink: 0 }}>
                      {done ? '✓' : adding[c.id] ? '…' : '+ Add'}
                    </button>
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}

// ─── RouteFormModal ───────────────────────────────────────────────────────────
function RouteFormModal({ route, employees, onSave, onClose }) {
  const [name, setName] = useState(route ? route.name : '');
  const [routeDate, setRouteDate] = useState(
    route && route.route_date ? route.route_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [type, setType] = useState(route ? (route.type || 'lawn') : 'lawn');
  const [description, setDescription] = useState(route ? (route.description || '') : '');
  const [selectedEmpIds, setSelectedEmpIds] = useState(() => {
    if (!route) return [];
    try { return JSON.parse(route.assigned_employee_ids || '[]').map(Number); } catch { return []; }
  });
  const [saving, setSaving] = useState(false);

  const toggleEmp = (id) => {
    setSelectedEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!name.trim()) { alert('Route name is required'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), route_date: routeDate, type, description, assigned_employee_ids: selectedEmpIds });
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginTop: 4, boxSizing: 'border-box' };
  const lbl = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginTop: 14 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#1e3a5f', fontSize: 18 }}>{route ? 'Edit Route' : 'New Route'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        <label style={lbl}>Route Name *</label>
        <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Crew A – Monday, Gabe's Route" />

        <label style={lbl}>Date</label>
        <input type="date" style={inp} value={routeDate} onChange={e => setRouteDate(e.target.value)} />

        <label style={lbl}>Type</label>
        <select style={inp} value={type} onChange={e => setType(e.target.value)}>
          <option value="lawn">🌿 Lawn Care</option>
          <option value="snow">❄️ Snow Removal</option>
          <option value="landscape">🌱 Landscape</option>
          <option value="other">📋 Other</option>
        </select>

        <label style={lbl}>Description (optional)</label>
        <input style={inp} value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes about this route…" />

        <label style={lbl}>Assign Employees</label>
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {employees.map(emp => {
            const selected = selectedEmpIds.includes(emp.id);
            return (
              <button key={emp.id} onClick={() => toggleEmp(emp.id)}
                style={{ padding: '6px 12px', borderRadius: 20, border: '2px solid ' + (selected ? '#1e3a5f' : '#e2e8f0'), background: selected ? '#1e3a5f' : '#fff', color: selected ? '#fff' : '#374151', fontSize: 13, cursor: 'pointer', fontWeight: selected ? 700 : 400 }}>
                {selected ? '✓ ' : ''}{emp.first_name} {emp.last_name}
              </button>
            );
          })}
          {employees.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>No employees found</div>}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Saving…' : (route ? 'Save Changes' : 'Create Route')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main RoutePlanner ────────────────────────────────────────────────────────
export default function RoutePlanner() {
  const [routes, setRoutes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingStops, setLoadingStops] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [showAllDates, setShowAllDates] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [mobileView, setMobileView] = useState('routes');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const startAddressRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadRoutes = useCallback(() => {
    setLoadingRoutes(true);
    const url = showAllDates ? '/routes' : ('/routes?date=' + filterDate);
    api.get(url)
      .then(r => setRoutes(r.data || []))
      .catch(() => setRoutes([]))
      .finally(() => setLoadingRoutes(false));
  }, [filterDate, showAllDates]);

  useEffect(() => {
    api.get('/employees').then(r => setEmployees(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const loadRouteDetail = useCallback((id) => {
    if (!id) { setSelectedRoute(null); return; }
    setLoadingStops(true);
    api.get('/routes/' + id)
      .then(r => setSelectedRoute(r.data))
      .catch(() => setSelectedRoute(null))
      .finally(() => setLoadingStops(false));
  }, []);

  const handleSelectRoute = (id) => {
    setSelectedRouteId(id);
    loadRouteDetail(id);
    setShowAddStop(false);
    if (isMobile) setMobileView('stops');
  };

  const handleCreateRoute = async (data) => {
    await api.post('/routes', data);
    setShowForm(false);
    loadRoutes();
  };

  const handleEditRoute = async (data) => {
    await api.put('/routes/' + editingRoute.id, data);
    setEditingRoute(null);
    setShowForm(false);
    loadRoutes();
    if (selectedRouteId === editingRoute.id) loadRouteDetail(editingRoute.id);
  };

  const handleDeleteRoute = async (route) => {
    if (!window.confirm('Delete route "' + route.name + '"? This will remove all ' + (route.stop_count || 0) + ' stops.')) return;
    await api.delete('/routes/' + route.id);
    if (selectedRouteId === route.id) { setSelectedRouteId(null); setSelectedRoute(null); }
    loadRoutes();
  };

  const handleRemoveStop = async (stopId) => {
    if (!selectedRouteId) return;
    await api.delete('/routes/' + selectedRouteId + '/stops/' + stopId);
    loadRouteDetail(selectedRouteId);
    loadRoutes();
  };

  const handleStopAdded = () => {
    loadRouteDetail(selectedRouteId);
    loadRoutes();
  };

  const handleGeoSort = async () => {
    if (!selectedRouteId) return;
    setOptimizing(true);
    try {
      let startLat = 46.8772, startLng = -96.7898;
      const addrVal = startAddressRef.current ? startAddressRef.current.value.trim() : '';
      if (addrVal) {
        try {
          const geoUrl = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(addrVal) + '&limit=1&countrycodes=us';
          const res = await fetch(geoUrl, { headers: { 'User-Agent': 'SnowBros-RoutePlanner/1.0' } });
          const data = await res.json();
          if (data && data[0]) { startLat = parseFloat(data[0].lat); startLng = parseFloat(data[0].lon); }
        } catch { /* use default */ }
      }
      await api.post('/routes/' + selectedRouteId + '/optimize', { start_lat: startLat, start_lng: startLng });
      loadRouteDetail(selectedRouteId);
    } finally { setOptimizing(false); }
  };

  const existingStopIds = new Set(
    (selectedRoute ? selectedRoute.stops || [] : []).map(s =>
      s.booking_id ? (s.booking_id + '_booking') : (s.client_id + '_client')
    )
  );

  // Pure inline layout — guaranteed single column on mobile
  const panelsStyle = isMobile
    ? { display: 'flex', flexDirection: 'column', width: '100%' }
    : { display: 'flex', flexDirection: 'row', gap: 16, width: '100%', alignItems: 'flex-start' };

  const leftStyle = isMobile
    ? { width: '100%', display: mobileView === 'routes' ? 'block' : 'none' }
    : { width: 320, flexShrink: 0 };

  const rightStyle = isMobile
    ? { width: '100%', display: mobileView === 'stops' ? 'block' : 'none' }
    : { flex: 1, minWidth: 0 };

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, color: '#1e3a5f', fontSize: 22 }}>🗺️ Route Planner</h2>
        <button
          onClick={() => { setEditingRoute(null); setShowForm(true); }}
          style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + New Route
        </button>
      </div>

      {/* Date filter */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input type="date" value={filterDate}
          onChange={e => { setFilterDate(e.target.value); setShowAllDates(false); }}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} />
        <button onClick={() => setShowAllDates(v => !v)}
          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: showAllDates ? '#1e3a5f' : '#fff', color: showAllDates ? '#fff' : '#374151', fontSize: 13, cursor: 'pointer' }}>
          {showAllDates ? '📅 All Dates (active)' : '📅 Show All Dates'}
        </button>
      </div>

      {/* Mobile tab bar — only rendered on mobile */}
      {isMobile && (
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 3, marginBottom: 12 }}>
          <button
            style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, background: mobileView === 'routes' ? '#1e3a5f' : 'transparent', color: mobileView === 'routes' ? '#fff' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            onClick={() => setMobileView('routes')}>
            {'📋 Routes (' + routes.length + ')'}
          </button>
          <button
            style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, background: mobileView === 'stops' ? '#1e3a5f' : 'transparent', color: mobileView === 'stops' ? '#fff' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            onClick={() => setMobileView('stops')}>
            {'📍 ' + (selectedRoute ? selectedRoute.name : 'Select Route')}
          </button>
        </div>
      )}

      <div style={panelsStyle}>
        {/* LEFT: Route List */}
        <div style={leftStyle}>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a5f', marginBottom: 12 }}>
              Routes
              {routes.length > 0 && (
                <span style={{ background: '#1e3a5f', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 12, marginLeft: 6 }}>
                  {routes.length}
                </span>
              )}
            </div>
            {loadingRoutes ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>Loading…</div>
            ) : routes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 20, fontSize: 13 }}>
                {showAllDates ? 'No routes found.' : 'No routes for this date.'}
                <br />
                <button onClick={() => { setEditingRoute(null); setShowForm(true); }}
                  style={{ marginTop: 10, background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
                  + Create First Route
                </button>
              </div>
            ) : (
              routes.map(r => (
                <RouteCard
                  key={r.id}
                  route={r}
                  isSelected={r.id === selectedRouteId}
                  onSelect={handleSelectRoute}
                  onEdit={route => { setEditingRoute(route); setShowForm(true); }}
                  onDelete={handleDeleteRoute}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Route Detail */}
        <div style={rightStyle}>
          {!selectedRoute && !loadingStops ? (
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Select a route to view stops</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Or create a new route to get started</div>
            </div>
          ) : loadingStops ? (
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
              Loading stops…
            </div>
          ) : selectedRoute && (
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
              {/* Route header */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#1e3a5f', fontSize: 18 }}>{selectedRoute.name}</h3>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                      {selectedRoute.route_date
                        ? new Date(selectedRoute.route_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                        : 'No date set'}
                      {' · '}{(selectedRoute.stops || []).length} stops
                    </div>
                    {selectedRoute.assigned_employees && selectedRoute.assigned_employees.length > 0 && (
                      <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>
                        {'👤 ' + selectedRoute.assigned_employees.map(e => e.name || ('Employee #' + e)).join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        const url = mapsRouteUrl(selectedRoute.stops || []);
                        if (url) window.open(url, '_blank', 'noopener');
                      }}
                      style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      🗺️ Open in Maps
                    </button>
                    <button onClick={() => setShowAddStop(v => !v)}
                      style={{ background: showAddStop ? '#1e3a5f' : '#fff', color: showAddStop ? '#fff' : '#1e3a5f', border: '2px solid #1e3a5f', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
                      {showAddStop ? '✕ Close' : '+ Add Stops'}
                    </button>
                  </div>
                </div>

                {/* Geo-sort bar */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <input ref={startAddressRef} placeholder="Starting address for geo-sort (optional)"
                    style={{ flex: 1, minWidth: 160, padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  <button onClick={handleGeoSort} disabled={optimizing}
                    style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {optimizing ? '⏳ Sorting…' : '📍 Geo-Sort'}
                  </button>
                </div>
              </div>

              {showAddStop && (
                <AddStopPanel
                  routeId={selectedRouteId}
                  existingStopIds={existingStopIds}
                  onAdded={handleStopAdded}
                />
              )}

              <div style={{ marginTop: 14 }}>
                {(!selectedRoute.stops || selectedRoute.stops.length === 0) ? (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: 24, fontSize: 13 }}>
                    No stops yet. Click "+ Add Stops" to add clients or bookings.
                  </div>
                ) : (
                  selectedRoute.stops.map((stop, idx) => (
                    <StopCard key={stop.id} stop={stop} index={idx} onRemove={handleRemoveStop} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <RouteFormModal
          route={editingRoute}
          employees={employees}
          onSave={editingRoute ? handleEditRoute : handleCreateRoute}
          onClose={() => { setShowForm(false); setEditingRoute(null); }}
        />
      )}
    </div>
  );
}
