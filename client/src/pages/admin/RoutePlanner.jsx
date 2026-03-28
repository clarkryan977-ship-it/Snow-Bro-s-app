import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import DraggableList from '../../components/DraggableList';

const SNOW_CONDITIONS = {
  'light': { label: 'Light Snow', jobsPerHour: 3, color: '#e0f2fe' },
  'moderate': { label: 'Moderate Snow', jobsPerHour: 2, color: '#f0f9ff' },
  'heavy': { label: 'Heavy Snow', jobsPerHour: 1.5, color: '#fef2f2' },
  'blizzard': { label: 'Blizzard', jobsPerHour: 1, color: '#fee2e2' }
};

export default function RoutePlanner() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [clients, setClients] = useState([]);
  const [addClientId, setAddClientId] = useState('');
  const [addFrequency, setAddFrequency] = useState('weekly');
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', type: 'snow' });

  // Route session state
  const [activeSession, setActiveSession] = useState(null);
  const [numCrews, setNumCrews] = useState(1);
  const [snowCondition, setSnowCondition] = useState('moderate');
  const [jobsPerHourOverride, setJobsPerHourOverride] = useState('');
  const [gpsTracking, setGpsTracking] = useState(false);
  const gpsIntervalRef = useRef(null);

  useEffect(() => {
    loadRoutes();
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedRoute) loadStops();
  }, [selectedRoute]);

  useEffect(() => {
    if (activeSession && gpsTracking) {
      startGpsTracking();
    } else {
      stopGpsTracking();
    }
    return () => stopGpsTracking();
  }, [gpsTracking, activeSession]);

  const loadRoutes = async () => {
    try {
      const r = await api.get('/routes');
      setRoutes(r.data);
    } catch (e) { console.error(e); }
  };

  const loadClients = async () => {
    try {
      const r = await api.get('/clients');
      setClients(r.data);
    } catch (e) { console.error(e); }
  };

  const loadStops = async () => {
    try {
      const r = await api.get(`/routes/${selectedRoute}/stops`);
      setStops(r.data);
      
      // Load active session for this route
      const sessionR = await api.get(`/routes/sessions/active/${selectedRoute}`);
      if (sessionR.data.found) {
        setActiveSession(sessionR.data.session);
        setNumCrews(sessionR.data.session.num_crews);
        setSnowCondition(sessionR.data.session.snow_condition);
        setJobsPerHourOverride(sessionR.data.session.jobs_per_hour.toString());
      } else {
        setActiveSession(null);
        setJobsPerHourOverride('');
      }
    } catch (e) { console.error(e); }
  };

  const createRoute = async () => {
    if (!newRoute.name.trim()) return;
    try {
      await api.post('/routes', newRoute);
      setNewRoute({ name: '', type: 'snow' });
      setShowNewRoute(false);
      loadRoutes();
    } catch (e) { console.error(e); }
  };

  const deleteRoute = async (id) => {
    if (!confirm('Delete this route?')) return;
    try {
      await api.delete(`/routes/${id}`);
      loadRoutes();
      if (selectedRoute === id) setSelectedRoute(null);
    } catch (e) { console.error(e); }
  };

  const addStop = async () => {
    if (!addClientId) return;
    try {
      await api.post(`/routes/${selectedRoute}/stops`, { client_id: parseInt(addClientId), frequency: addFrequency });
      setAddClientId('');
      setAddFrequency('weekly');
      loadStops();
    } catch (e) { console.error(e); }
  };

  const removeStop = async (id) => {
    if (!confirm('Remove this stop?')) return;
    try {
      await api.delete(`/routes/${selectedRoute}/stops/${id}`);
      loadStops();
    } catch (e) { console.error(e); }
  };

  const updateStopFrequency = async (id, freq) => {
    try {
      await api.put(`/routes/${selectedRoute}/stops/${id}`, { frequency: freq });
      loadStops();
    } catch (e) { console.error(e); }
  };

  const handleReorder = async (newOrder) => {
    const stopIds = newOrder.map(s => s.id);
    try {
      await api.put(`/routes/${selectedRoute}/reorder`, { stop_ids: stopIds });
      loadStops();
    } catch (e) { console.error(e); }
  };

  const optimizeRoute = async () => {
    try {
      await api.post(`/routes/${selectedRoute}/optimize`);
      loadStops();
    } catch (e) { console.error(e); }
  };

  const toggleClientActive = async (id, active) => {
    try {
      await api.put(`/routes/clients/${id}/active`, { active: !active });
      loadClients();
      loadStops();
    } catch (e) { console.error(e); }
  };

  // ─── Route Session Controls ───
  const startRouteSession = async () => {
    if (!selectedRoute) return;
    try {
      const res = await api.post('/routes/sessions/start', {
        route_id: selectedRoute,
        num_crews: numCrews,
        snow_condition: snowCondition
      });
      setActiveSession(res.data);
      setJobsPerHourOverride(res.data.jobs_per_hour.toString());
    } catch (e) { console.error(e); }
  };

  const endRouteSession = async () => {
    if (!activeSession) return;
    try {
      await api.post(`/routes/sessions/${activeSession.id}/end`);
      setActiveSession(null);
      setGpsTracking(false);
      setJobsPerHourOverride('');
      loadStops();
    } catch (e) { console.error(e); }
  };

  const updateSessionParams = async () => {
    if (!activeSession) return;
    try {
      const updates = {
        num_crews: numCrews,
        snow_condition: snowCondition
      };
      if (jobsPerHourOverride) {
        updates.jobs_per_hour = parseFloat(jobsPerHourOverride);
      }
      await api.put(`/routes/sessions/${activeSession.id}`, updates);
      loadStops();
      const sessionR = await api.get(`/routes/sessions/active/${selectedRoute}`);
      if (sessionR.data.found) setActiveSession(sessionR.data.session);
    } catch (e) { console.error(e); }
  };

  const startGpsTracking = () => {
    if (!activeSession) return;
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);

    const trackGps = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          api.post(`/routes/sessions/${activeSession.id}/gps`, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          }).catch(e => console.error('GPS update failed:', e));
        },
        (err) => console.error('Geolocation error:', err)
      );
    };

    trackGps();
    gpsIntervalRef.current = setInterval(trackGps, 45000); // 45 seconds
  };

  const stopGpsTracking = () => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
  };

  const activeRoute = routes.find(r => r.id === selectedRoute);
  const availableClients = clients.filter(c => !stops.some(s => s.client_id === c.id));

  const card = { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.1)', marginBottom: 20 };
  const input = { padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16, width: '100%', boxSizing: 'border-box' };
  const select = { padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16, boxSizing: 'border-box' };
  const btnSm = (bg = '#2563eb', hover = '#1d4ed8') => ({ background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13, transition: 'background 0.2s', ':hover': { background: hover } });
  const badge = (bg, bgLight) => ({ background: bgLight, color: bg, padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 });

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <div className="container">
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>🗺️ Route Planner</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Left: Route list + clients */}
          <div>
            {/* Routes */}
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

          {/* Right: Route detail + session controls */}
          <div>
            {!selectedRoute ? (
              <div style={{ ...card, textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
                <p style={{ fontSize: 16 }}>Select a route from the left to view and manage stops.</p>
              </div>
            ) : (
              <>
                {/* Route Session Controls */}
                <div style={{ ...card, background: activeSession ? '#f0fdf4' : '#fef2f2', borderLeft: `4px solid ${activeSession ? '#22c55e' : '#ef4444'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4 }}>
                        {activeSession ? '🟢 Route Active' : '⚪ Route Inactive'}
                      </h3>
                      {activeSession && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          Started: {new Date(activeSession.start_time).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                    {activeSession ? (
                      <button onClick={endRouteSession} style={btnSm('#ef4444')}>🛑 End Route</button>
                    ) : (
                      <button onClick={startRouteSession} style={btnSm('#22c55e')}>▶️ Start Route</button>
                    )}
                  </div>

                  {activeSession && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Crews</label>
                          <select value={numCrews} onChange={e => setNumCrews(parseInt(e.target.value))}
                            style={{ ...select, width: '100%' }}>
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} crew{n > 1 ? 's' : ''}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Snow Condition</label>
                          <select value={snowCondition} onChange={e => setSnowCondition(e.target.value)}
                            style={{ ...select, width: '100%' }}>
                            {Object.entries(SNOW_CONDITIONS).map(([key, val]) => (
                              <option key={key} value={key}>{val.label} ({val.jobsPerHour} jobs/hr)</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                          Override Jobs/Hour (leave blank to use condition baseline)
                        </label>
                        <input type="number" step="0.5" min="0.5" max="10" value={jobsPerHourOverride}
                          onChange={e => setJobsPerHourOverride(e.target.value)}
                          placeholder={SNOW_CONDITIONS[snowCondition].jobsPerHour.toString()}
                          style={{ ...input, marginBottom: 8 }} />
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={updateSessionParams} style={btnSm('#7c3aed')}>💾 Save Changes</button>
                        <button onClick={() => setGpsTracking(!gpsTracking)}
                          style={btnSm(gpsTracking ? '#ef4444' : '#2563eb')}>
                          {gpsTracking ? '🛑 Stop GPS' : '📍 Start GPS Tracking'}
                        </button>
                      </div>

                      {gpsTracking && (
                        <div style={{ padding: 8, background: '#dbeafe', borderRadius: 6, fontSize: 12, color: '#1e40af' }}>
                          📍 Live GPS tracking active — updating every 45 seconds
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Route Detail */}
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
      </div>
    </div>
  );
}
