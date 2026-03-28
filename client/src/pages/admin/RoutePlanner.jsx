import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

// ─── Inline drag-and-drop helpers (no external lib needed) ───────
function DraggableList({ items, onReorder, renderItem }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const handleDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, idx) => { e.preventDefault(); setOverIdx(idx); };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    const newItems = [...items];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(idx, 0, moved);
    onReorder(newItems);
    setDragIdx(null); setOverIdx(null);
  };

  return (
    <div>
      {items.map((item, idx) => (
        <div key={item.id}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragOver={e => handleDragOver(e, idx)}
          onDrop={e => handleDrop(e, idx)}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
          style={{
            opacity: dragIdx === idx ? 0.4 : 1,
            borderTop: overIdx === idx && dragIdx !== idx ? '3px solid #2563eb' : '3px solid transparent',
            transition: 'all 0.15s ease',
            cursor: 'grab',
          }}
        >
          {renderItem(item, idx)}
        </div>
      ))}
    </div>
  );
}

export default function RoutePlanner() {
  // State
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState({});
  const [flash, setFlash] = useState('');
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', type: 'lawn' });
  const [addClientId, setAddClientId] = useState('');
  const [addFrequency, setAddFrequency] = useState('weekly');
  const [tab, setTab] = useState('routes'); // routes | settings | eta-lookup

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 3000); };

  // ─── Data fetching ──────────────────────────────────────────────
  const fetchRoutes = useCallback(async () => {
    try { const r = await api.get('/routes'); setRoutes(r.data); } catch (e) { console.error(e); }
  }, []);

  const fetchStops = useCallback(async (routeId) => {
    try { const r = await api.get(`/routes/${routeId}/stops`); setStops(r.data); } catch (e) { console.error(e); }
  }, []);

  const fetchClients = useCallback(async () => {
    try { const r = await api.get('/clients'); setClients(r.data); } catch (e) { console.error(e); }
  }, []);

  const fetchSettings = useCallback(async () => {
    try { const r = await api.get('/routes/settings'); setSettings(r.data); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchRoutes(); fetchClients(); fetchSettings(); }, [fetchRoutes, fetchClients, fetchSettings]);
  useEffect(() => { if (selectedRoute) fetchStops(selectedRoute); }, [selectedRoute, fetchStops]);

  // ─── Route CRUD ─────────────────────────────────────────────────
  const createRoute = async () => {
    if (!newRoute.name) return;
    await api.post('/routes', newRoute);
    setNewRoute({ name: '', type: 'lawn' }); setShowNewRoute(false);
    fetchRoutes(); showFlash('Route created');
  };

  const deleteRoute = async (id) => {
    if (!confirm('Delete this route and all its stops?')) return;
    await api.delete(`/routes/${id}`);
    if (selectedRoute === id) { setSelectedRoute(null); setStops([]); }
    fetchRoutes(); showFlash('Route deleted');
  };

  // ─── Stop management ───────────────────────────────────────────
  const addStop = async () => {
    if (!addClientId || !selectedRoute) return;
    try {
      await api.post(`/routes/${selectedRoute}/stops`, { client_id: parseInt(addClientId), frequency: addFrequency });
      setAddClientId(''); fetchStops(selectedRoute); showFlash('Client added to route');
    } catch (e) { showFlash(e.response?.data?.error || 'Error adding client'); }
  };

  const removeStop = async (stopId) => {
    await api.delete(`/routes/${selectedRoute}/stops/${stopId}`);
    fetchStops(selectedRoute); showFlash('Stop removed');
  };

  const updateStopFrequency = async (stopId, frequency) => {
    await api.put(`/routes/${selectedRoute}/stops/${stopId}`, { frequency });
    fetchStops(selectedRoute);
  };

  const handleReorder = async (newStops) => {
    setStops(newStops);
    await api.put(`/routes/${selectedRoute}/reorder`, { stop_ids: newStops.map(s => s.id) });
    fetchStops(selectedRoute);
  };

  const optimizeRoute = async () => {
    await api.post(`/routes/${selectedRoute}/optimize`);
    fetchStops(selectedRoute); showFlash('Route optimized by geographic proximity');
  };

  // ─── Client active/inactive ────────────────────────────────────
  const toggleClientActive = async (clientId, currentActive) => {
    await api.put(`/routes/clients/${clientId}/active`, { active: !currentActive });
    fetchClients(); if (selectedRoute) fetchStops(selectedRoute);
  };

  // ─── Settings ──────────────────────────────────────────────────
  const updateSettings = async (updates) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await api.put('/routes/settings', updates);
    if (selectedRoute) fetchStops(selectedRoute);
    showFlash('Settings updated');
  };

  // ─── Styles ────────────────────────────────────────────────────
  const card = { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.1)' };
  const btn = (color = '#2563eb') => ({ background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 });
  const btnSm = (color = '#2563eb') => ({ ...btn(color), padding: '5px 12px', fontSize: 13 });
  const input = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' };
  const select = { ...input, width: 'auto' };
  const badge = (color, bg) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, color, background: bg });

  const activeRoute = routes.find(r => r.id === selectedRoute);
  const snowDayActive = settings.snow_day_active === '1';

  // Clients not already on this route
  const availableClients = clients.filter(c => !stops.find(s => s.client_id === c.id));

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Route Planner</h2>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Manage lawn and snow routes, set ETAs, and track crew progress.</p>

      {flash && <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>{flash}</div>}

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['routes', 'Routes'], ['settings', 'ETA Settings'], ['eta-lookup', 'Public ETA Lookup']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ ...btn(tab === key ? '#2563eb' : '#9ca3af'), borderRadius: 20, padding: '8px 20px' }}>{label}</button>
        ))}
      </div>

      {/* ════════ SETTINGS TAB ════════ */}
      {tab === 'settings' && (
        <div style={card}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Route & ETA Settings</h3>

          {/* Snow Day Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 16, background: snowDayActive ? '#fef2f2' : '#f0fdf4', borderRadius: 12, border: `2px solid ${snowDayActive ? '#ef4444' : '#22c55e'}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Snow Day Mode</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>When active, snow routes are used instead of lawn routes. Toggle on when it snows.</div>
            </div>
            <button onClick={() => updateSettings({ snow_day_active: snowDayActive ? '0' : '1' })}
              style={{ ...btn(snowDayActive ? '#ef4444' : '#22c55e'), padding: '12px 24px', fontSize: 16, minWidth: 140 }}>
              {snowDayActive ? '❄️ SNOW DAY ON' : '☀️ SNOW DAY OFF'}
            </button>
          </div>

          {/* ETA Config */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Start Time</label>
              <input type="time" value={settings.eta_start_time || '08:00'}
                onChange={e => updateSettings({ eta_start_time: e.target.value })} style={input} />
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Jobs Per Hour Per Crew</label>
              <select value={settings.eta_jobs_per_hour || '2'}
                onChange={e => updateSettings({ eta_jobs_per_hour: e.target.value })} style={input}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} job{n > 1 ? 's' : ''}/hr</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Number of Crews</label>
              <select value={settings.eta_num_crews || '1'}
                onChange={e => updateSettings({ eta_num_crews: e.target.value })} style={input}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} crew{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 14, color: '#6b7280' }}>
            <strong>How ETA works:</strong> Each crew handles {settings.eta_jobs_per_hour || 2} jobs/hour. With {settings.eta_num_crews || 1} crew(s), jobs are distributed in parallel. Stop #1 goes to Crew 1, Stop #2 to Crew 2, etc. ETAs are calculated based on position in each crew's queue.
          </div>
        </div>
      )}

      {/* ════════ ETA LOOKUP TAB ════════ */}
      {tab === 'eta-lookup' && <ETALookup />}

      {/* ════════ ROUTES TAB ════════ */}
      {tab === 'routes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          {/* Left: Route list */}
          <div>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Routes</h3>
                <button onClick={() => setShowNewRoute(!showNewRoute)} style={btnSm()}>+ New</button>
              </div>

              {showNewRoute && (
                <div style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <input placeholder="Route name" value={newRoute.name}
                    onChange={e => setNewRoute({ ...newRoute, name: e.target.value })}
                    style={{ ...input, marginBottom: 8 }} />
                  <select value={newRoute.type} onChange={e => setNewRoute({ ...newRoute, type: e.target.value })}
                    style={{ ...input, marginBottom: 8 }}>
                    <option value="lawn">Lawn Route</option>
                    <option value="snow">Snow Route</option>
                  </select>
                  <button onClick={createRoute} style={btnSm('#22c55e')}>Create</button>
                </div>
              )}

              {routes.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>No routes yet. Create one to get started.</p>}
              {routes.map(r => (
                <div key={r.id} onClick={() => setSelectedRoute(r.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                    background: selectedRoute === r.id ? '#eff6ff' : '#fff',
                    border: selectedRoute === r.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {r.type === 'snow' ? '❄️' : '🌿'} {r.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{r.stop_count} stops · {r.type}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteRoute(r.id); }}
                    style={{ ...btnSm('#ef4444'), padding: '3px 8px', fontSize: 11 }}>✕</button>
                </div>
              ))}
            </div>

            {/* Client Status Panel */}
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Client Status</h3>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {clients.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', borderRadius: 6, marginBottom: 4,
                    background: c.active ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${c.active ? '#bbf7d0' : '#fecaca'}`,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.first_name} {c.last_name}</span>
                    <button onClick={() => toggleClientActive(c.id, c.active)}
                      style={{ ...btnSm(c.active ? '#22c55e' : '#ef4444'), padding: '2px 8px', fontSize: 11 }}>
                      {c.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Route detail */}
          <div>
            {!selectedRoute ? (
              <div style={{ ...card, textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
                <p style={{ fontSize: 16 }}>Select a route from the left to view and manage stops.</p>
              </div>
            ) : (
              <>
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                      {activeRoute?.type === 'snow' ? '❄️' : '🌿'} {activeRoute?.name}
                      <span style={{ ...badge(activeRoute?.type === 'snow' ? '#1e40af' : '#166534', activeRoute?.type === 'snow' ? '#dbeafe' : '#dcfce7'), marginLeft: 8 }}>
                        {activeRoute?.type === 'snow' ? 'Snow Route' : 'Lawn Route'}
                      </span>
                    </h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={optimizeRoute} style={btnSm('#7c3aed')} title="Auto-optimize by geographic proximity">
                        🧭 Auto-Optimize
                      </button>
                    </div>
                  </div>

                  {/* Add client to route */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <select value={addClientId} onChange={e => setAddClientId(e.target.value)} style={{ ...select, flex: 1, minWidth: 200 }}>
                      <option value="">— Select client to add —</option>
                      {availableClients.map(c => (
                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.address || 'No address'}</option>
                      ))}
                    </select>
                    <select value={addFrequency} onChange={e => setAddFrequency(e.target.value)} style={select}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-Weekly</option>
                      <option value="snow-only">Snow Only</option>
                    </select>
                    <button onClick={addStop} style={btnSm('#22c55e')}>+ Add Stop</button>
                  </div>

                  {/* Stop list header */}
                  {stops.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 140px 100px 80px 70px 50px', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
                      <span>Stop</span><span>Client</span><span>Address</span><span>Frequency</span><span>ETA</span><span>Crew</span><span></span>
                    </div>
                  )}

                  {/* Draggable stops */}
                  {stops.length === 0 ? (
                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>No stops yet. Add clients above.</p>
                  ) : (
                    <DraggableList items={stops} onReorder={handleReorder}
                      renderItem={(stop, idx) => (
                        <div style={{
                          display: 'grid', gridTemplateColumns: '50px 1fr 140px 100px 80px 70px 50px', gap: 8,
                          padding: '10px 12px', borderRadius: 8, marginBottom: 4, alignItems: 'center',
                          background: stop.active ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${stop.active ? '#bbf7d0' : '#fecaca'}`,
                        }}>
                          <span style={{ fontWeight: 800, fontSize: 16, color: '#2563eb' }}>#{stop.stop_number}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {stop.first_name} {stop.last_name}
                              <span style={{ ...badge(stop.active ? '#166534' : '#991b1b', stop.active ? '#dcfce7' : '#fee2e2'), marginLeft: 6, fontSize: 10 }}>
                                {stop.active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{stop.email}</div>
                          </div>
                          <div style={{ fontSize: 12, color: '#374151' }}>{stop.address}{stop.city ? `, ${stop.city}` : ''}</div>
                          <select value={stop.frequency} onChange={e => updateStopFrequency(stop.id, e.target.value)}
                            style={{ ...select, fontSize: 12, padding: '3px 6px' }}>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Bi-Weekly</option>
                            <option value="snow-only">Snow Only</option>
                          </select>
                          <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 14 }}>{stop.eta}</span>
                          <span style={{ ...badge('#7c3aed', '#ede9fe'), fontSize: 11 }}>Crew {stop.crew_number}</span>
                          <button onClick={() => removeStop(stop.id)}
                            style={{ ...btnSm('#ef4444'), padding: '2px 6px', fontSize: 11 }}>✕</button>
                        </div>
                      )}
                    />
                  )}
                </div>

                {/* Route summary */}
                {stops.length > 0 && (
                  <div style={card}>
                    <h4 style={{ fontWeight: 700, marginBottom: 8 }}>Route Summary</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb' }}>{stops.length}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Total Stops</div>
                      </div>
                      <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{stops.filter(s => s.active).length}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Active Clients</div>
                      </div>
                      <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{stops.filter(s => !s.active).length}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Inactive Clients</div>
                      </div>
                      <div style={{ padding: 12, background: '#faf5ff', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{stops[stops.length - 1]?.eta || '--'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Est. Completion</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Public ETA Lookup Component ─────────────────────────────────
function ETALookup() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r = await api.get(`/routes/eta/lookup?name=${encodeURIComponent(query)}&address=${encodeURIComponent(query)}`);
      setResult(r.data);
    } catch (e) { setResult({ found: false, message: 'Error looking up ETA' }); }
    setLoading(false);
  };

  const card = { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.1)' };
  const input = { padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>ETA Lookup</h3>
        <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>
          This is how customers can look up their estimated arrival time. Enter a name or address.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input placeholder="Enter your name or address..." value={query}
            onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup()} style={{ ...input, flex: 1 }} />
          <button onClick={lookup} disabled={loading}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? '...' : 'Look Up'}
          </button>
        </div>

        {result && !result.found && (
          <div style={{ padding: 16, background: '#fef2f2', borderRadius: 8, color: '#991b1b' }}>
            No matching client found on active routes. Please check your name or address.
          </div>
        )}

        {result && result.found && (
          <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Hello, {result.client_name}!</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#2563eb', marginBottom: 8 }}>
              ETA: {result.refined_eta || result.eta}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
              <div><strong>Route:</strong> {result.route_name}</div>
              <div><strong>Stop:</strong> #{result.stop_number} of {result.total_stops}</div>
              <div><strong>Crew:</strong> #{result.crew_number} of {result.num_crews}</div>
              <div><strong>Type:</strong> {result.snow_day ? '❄️ Snow' : '🌿 Lawn'}</div>
            </div>
            {result.refined_eta && (
              <div style={{ marginTop: 8, padding: 8, background: '#dbeafe', borderRadius: 6, fontSize: 13 }}>
                📍 Live GPS tracking active — ETA refined based on crew location.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
