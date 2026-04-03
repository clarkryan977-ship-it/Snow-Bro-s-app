import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};
const fmtDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};

function WeatherBadge({ wx }) {
  if (!wx) return <span className="text-gray-400 text-xs">No data</span>;
  const cond = wx.weather || wx.sky_cond || '';
  const icon = /snow/i.test(cond) ? '❄️' : /rain|drizzle/i.test(cond) ? '🌧️' : /fog/i.test(cond) ? '🌫️' : /overcast/i.test(cond) ? '☁️' : /cloud/i.test(cond) ? '⛅' : /clear|fair/i.test(cond) ? '☀️' : '🌡️';
  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 whitespace-nowrap">
      <span>{icon}</span>
      {wx.air_temp && <span>{wx.air_temp}°F</span>}
      {cond && <span className="hidden sm:inline">{cond.slice(0, 20)}</span>}
      {wx.precip_1hr && wx.precip_1hr !== '0.00' && <span className="text-blue-600">· {wx.precip_1hr}"</span>}
    </span>
  );
}

// ── Route list card ─────────────────────────────────────────────────────────
function RouteCard({ route, onSelect, selected }) {
  const pct = route.total_stops > 0 ? Math.round((route.completed_stops / route.total_stops) * 100) : 0;
  const allDone = route.completed_stops === route.total_stops;
  return (
    <div
      onClick={() => onSelect(route)}
      className={`cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${selected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{route.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${route.type === 'snow' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {(route.type || 'snow').toUpperCase()}
            </span>
            {allDone && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ Complete</span>}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">{fmtDate(route.route_date)}</div>
          {route.assigned_employees?.length > 0 && (
            <div className="text-xs text-gray-400 mt-0.5">Crew: {route.assigned_employees.join(', ')}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-gray-700">{route.completed_stops}/{route.total_stops}</div>
          <div className="text-xs text-gray-400">stops done</div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{fmtTime(route.first_completed_at)} – {fmtTime(route.last_completed_at)}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

// ── Stop detail row ─────────────────────────────────────────────────────────
function StopRow({ stop, idx }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        className={`cursor-pointer transition-colors ${stop.completed ? 'hover:bg-green-50' : 'hover:bg-gray-50'} ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
      >
        <td className="px-3 py-2 text-center text-xs text-gray-500 font-medium">{idx + 1}</td>
        <td className="px-3 py-2">
          <div className="font-medium text-gray-900 text-sm">{stop.first_name} {stop.last_name}</div>
          <div className="text-xs text-gray-400">{[stop.stop_address, stop.stop_city].filter(Boolean).join(', ')}</div>
        </td>
        <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{fmtDateTime(stop.completed_at)}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{stop.completed_by_name || '—'}</td>
        <td className="px-3 py-2"><WeatherBadge wx={stop.weather_at_completion} /></td>
        <td className="px-3 py-2 text-center">
          {stop.completed
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">✓ Done</span>
            : <span className="text-xs text-gray-400">Pending</span>}
        </td>
      </tr>
      {expanded && stop.weather_at_completion && (
        <tr className="bg-blue-50/60">
          <td />
          <td colSpan={5} className="px-4 py-2 text-xs text-blue-800">
            <span className="font-semibold">Weather at completion</span>
            {' — '}
            Temp: {stop.weather_at_completion.air_temp || '—'}°F
            {' · '}Wind: {stop.weather_at_completion.wind || '—'}
            {' · '}Conditions: {stop.weather_at_completion.weather || stop.weather_at_completion.sky_cond || '—'}
            {' · '}1hr Precip: {stop.weather_at_completion.precip_1hr || '0.00'}"
            {stop.weather_at_completion.wind_chill && ` · Wind Chill: ${stop.weather_at_completion.wind_chill}°F`}
            {' · '}Visibility: {stop.weather_at_completion.visibility || '—'} mi
            {' · '}Humidity: {stop.weather_at_completion.humidity || '—'}%
            {' · '}Observed: {fmtDateTime(stop.weather_at_completion.observed_at)}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function RouteHistory() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected route detail
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const { data } = await api.get(`/routes/history?${params}`);
      setRoutes(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load route history');
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const loadDetail = async (route) => {
    setSelectedRoute(route);
    setDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/routes/history/${route.id}`);
      setDetail(data);
    } catch (e) {
      setDetail({ error: e?.response?.data?.error || 'Failed to load route detail' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = async (type) => {
    if (!selectedRoute) return;
    setExporting(type);
    try {
      const token = localStorage.getItem('token');
      const url = `/api/routes/history/${selectedRoute.id}/export.${type}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `route-${selectedRoute.name.replace(/[^a-z0-9]/gi, '-')}-export.${type}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setExporting('');
    }
  };

  // Filter stops by client name search
  const filteredStops = detail?.stops?.filter(s => {
    if (!clientSearch.trim()) return true;
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    return name.includes(clientSearch.toLowerCase());
  });

  // Compute stats for detail view
  const completedStops = detail?.stops?.filter(s => s.completed) || [];
  const pendingStops = detail?.stops?.filter(s => !s.completed) || [];
  const routeDuration = completedStops.length >= 2
    ? Math.round((new Date(detail.last_completed_at || completedStops.at(-1)?.completed_at) - new Date(completedStops[0]?.completed_at)) / 60000)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Route History</h1>
            <p className="text-sm text-gray-500 mt-0.5">Completed route records with weather context for service verification</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span>❄️</span>
            <span>Weather data from KFAR (Fargo Hector Intl) — auto-logged hourly</span>
          </div>
        </div>

        <div className="flex gap-5 flex-col lg:flex-row">

          {/* ── Left panel: route list ── */}
          <div className="w-full lg:w-80 shrink-0">
            {/* Search & filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
              <input
                type="text"
                placeholder="Search routes by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              {(search || dateFrom || dateTo) && (
                <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Clear filters
                </button>
              )}
            </div>

            {/* Route list */}
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading routes...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500 text-sm">{error}</div>
            ) : routes.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-3xl mb-2">📋</div>
                <div>No completed routes found</div>
                <div className="text-xs mt-1">Routes with at least one completed stop will appear here</div>
              </div>
            ) : (
              <div className="space-y-3">
                {routes.map(r => (
                  <RouteCard key={r.id} route={r} onSelect={loadDetail} selected={selectedRoute?.id === r.id} />
                ))}
                <div className="text-center text-xs text-gray-400 pt-1">{routes.length} route{routes.length !== 1 ? 's' : ''} found</div>
              </div>
            )}
          </div>

          {/* ── Right panel: route detail ── */}
          <div className="flex-1 min-w-0">
            {!selectedRoute ? (
              <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-24 text-gray-400">
                <div className="text-4xl mb-3">🗺️</div>
                <div className="font-medium">Select a route to view details</div>
                <div className="text-sm mt-1">Click any route on the left to see stop-by-stop completion data</div>
              </div>
            ) : detailLoading ? (
              <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-24 text-gray-400">
                Loading route details...
              </div>
            ) : detail?.error ? (
              <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-24 text-red-500">
                {detail.error}
              </div>
            ) : detail ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

                {/* Detail header */}
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-xl font-bold">{detail.name}</h2>
                      <div className="text-blue-200 text-sm mt-0.5">{fmtDate(detail.route_date)}</div>
                      {detail.description && <div className="text-blue-300 text-xs mt-1">{detail.description}</div>}
                    </div>
                    {/* Export buttons */}
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleExport('csv')}
                        disabled={exporting === 'csv'}
                        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {exporting === 'csv' ? '⏳' : '📊'} CSV
                      </button>
                      <button
                        onClick={() => handleExport('pdf')}
                        disabled={exporting === 'pdf'}
                        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {exporting === 'pdf' ? '⏳' : '📄'} PDF
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-6 mt-4 flex-wrap">
                    <div>
                      <div className="text-2xl font-bold">{completedStops.length}<span className="text-blue-300 text-base font-normal">/{detail.stops?.length}</span></div>
                      <div className="text-blue-300 text-xs">Stops completed</div>
                    </div>
                    {routeDuration !== null && (
                      <div>
                        <div className="text-2xl font-bold">{routeDuration < 60 ? `${routeDuration}m` : `${Math.floor(routeDuration/60)}h ${routeDuration%60}m`}</div>
                        <div className="text-blue-300 text-xs">Route duration</div>
                      </div>
                    )}
                    {completedStops[0]?.completed_at && (
                      <div>
                        <div className="text-lg font-bold">{fmtTime(completedStops[0].completed_at)}</div>
                        <div className="text-blue-300 text-xs">First stop</div>
                      </div>
                    )}
                    {completedStops.at(-1)?.completed_at && (
                      <div>
                        <div className="text-lg font-bold">{fmtTime(completedStops.at(-1).completed_at)}</div>
                        <div className="text-blue-300 text-xs">Last stop</div>
                      </div>
                    )}
                    {detail.total_precip_since_route_start != null && parseFloat(detail.total_precip_since_route_start) > 0 && (
                      <div>
                        <div className="text-lg font-bold">{parseFloat(detail.total_precip_since_route_start).toFixed(2)}"</div>
                        <div className="text-blue-300 text-xs">Precip during route</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Client search + pending notice */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    placeholder="Search by client name..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56"
                  />
                  {clientSearch && (
                    <button onClick={() => setClientSearch('')} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                  )}
                  {pendingStops.length > 0 && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      {pendingStops.length} stop{pendingStops.length !== 1 ? 's' : ''} not completed
                    </span>
                  )}
                  <span className="text-xs text-blue-600 ml-auto">Click a row to expand weather details</span>
                </div>

                {/* Stop table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-10">#</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Client</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Completed At</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Marked By</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Weather</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(filteredStops || []).map((stop, idx) => (
                        <StopRow key={stop.id} stop={stop} idx={idx} />
                      ))}
                      {filteredStops?.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-400">No stops match your search</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer note */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                  Weather data from KFAR (Fargo Hector International Airport) via NWS. Nearest observation within 2 hours of each stop's completion time.
                  {detail.total_precip_since_route_start != null && (
                    <> Cumulative precipitation during route: <strong>{parseFloat(detail.total_precip_since_route_start).toFixed(2)}" liquid equivalent</strong>.</>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
