/**
 * DispatchMap — Real-time employee location map for the admin dashboard.
 *
 * - Polls /gps/active every 60 seconds
 * - Shows each clocked-in employee as a Leaflet marker
 * - Marker popup shows name, phone, job address, and last-seen time
 * - "Find Nearest" tool: enter a job address to see which employee is closest
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import { openInMaps } from '../utils/openInMaps.jsx';

// Fix Leaflet's broken default icon path in Vite/Webpack builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Haversine distance in miles between two lat/lng points */
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Geocode an address using the free Nominatim API */
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

/** Auto-fit map bounds to show all markers */
function FitBounds({ locations }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [locations, map]);
  return null;
}

export default function DispatchMap() {
  const [locations, setLocations]     = useState([]);
  const [lastUpdate, setLastUpdate]   = useState(null);
  const [jobAddress, setJobAddress]   = useState('');
  const [nearestResult, setNearest]   = useState(null); // { employee, distance }
  const [geocoding, setGeocoding]     = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const intervalRef = useRef(null);

  const load = useCallback(() => {
    api.get('/gps/active').then(r => {
      setLocations(r.data || []);
      setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60000); // refresh every 60 seconds
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const findNearest = async () => {
    if (!jobAddress.trim() || locations.length === 0) return;
    setGeocoding(true);
    setNearest(null);
    const coords = await geocodeAddress(jobAddress.trim());
    setGeocoding(false);
    if (!coords) {
      setNearest({ error: 'Could not geocode that address. Try a more specific address.' });
      return;
    }
    let closest = null;
    let minDist = Infinity;
    for (const loc of locations) {
      const d = distanceMiles(coords.lat, coords.lng, loc.latitude, loc.longitude);
      if (d < minDist) { minDist = d; closest = loc; }
    }
    if (closest) setNearest({ employee: closest, distance: minDist.toFixed(1) });
  };

  const center = locations.length > 0
    ? [locations[0].latitude, locations[0].longitude]
    : [46.8772, -96.7898]; // Fargo/Moorhead area default

  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #cbd5e1',
      borderRadius: 12,
      marginBottom: '1.5rem',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '.85rem 1.25rem',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        color: '#fff',
        cursor: 'pointer',
      }} onClick={() => setCollapsed(c => !c)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📍</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Live Crew Dispatch Map</div>
            <div style={{ fontSize: '.78rem', opacity: .85 }}>
              {locations.length === 0
                ? 'No employees currently clocked in'
                : `${locations.length} employee${locations.length !== 1 ? 's' : ''} clocked in`}
              {lastUpdate && ` · Updated ${lastUpdate}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); load(); }}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: '.8rem', cursor: 'pointer', fontWeight: 600 }}
          >↻ Refresh</button>
          <span style={{ fontSize: '.9rem', opacity: .8 }}>{collapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {!collapsed && (
        <div>
          {locations.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>🗺️</div>
              <div style={{ fontWeight: 600 }}>No crew members are currently clocked in.</div>
              <div style={{ fontSize: '.85rem', marginTop: '.3rem' }}>Locations will appear here when employees clock in and share their GPS.</div>
            </div>
          ) : (
            <>
              {/* Employee cards */}
              <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', padding: '.75rem 1rem .5rem' }}>
                {locations.map(loc => (
                  <div key={loc.employee_id} style={{
                    background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8,
                    padding: '.5rem .85rem', minWidth: 180,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#14532d' }}>👷 {loc.employee_name}</div>
                    {loc.employee_phone && (
                      <div style={{ fontSize: '.78rem', color: '#166534', marginTop: '.15rem' }}>
                        📞 <a href={`tel:${loc.employee_phone}`} style={{ color: '#166534' }}>{loc.employee_phone}</a>
                      </div>
                    )}
                    <div style={{ fontSize: '.72rem', color: '#4ade80', marginTop: '.2rem' }}>
                      Last seen: {new Date(loc.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Map */}
              <div style={{ height: 380, margin: '0 0 0 0' }}>
                <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                  />
                  <FitBounds locations={locations} />
                  {locations.map(loc => (
                    <Marker key={loc.employee_id} position={[loc.latitude, loc.longitude]}>
                      <Popup>
                        <div style={{ minWidth: 160 }}>
                          <strong style={{ fontSize: '.95rem' }}>👷 {loc.employee_name}</strong><br />
                          {loc.employee_phone && <><span style={{ fontSize: '.82rem' }}>📞 {loc.employee_phone}</span><br /></>}
                          <span style={{ fontSize: '.78rem', color: '#64748b' }}>
                            Last seen: {new Date(loc.recorded_at).toLocaleString()}
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {/* Find Nearest tool */}
              <div style={{ padding: '.85rem 1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#1e3a5f', marginBottom: '.5rem' }}>
                  🎯 Find Nearest Employee to a Job
                </div>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <input
                    type="text"
                    value={jobAddress}
                    onChange={e => setJobAddress(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && findNearest()}
                    placeholder="Enter job address (e.g. 123 Main St, Moorhead MN)"
                    style={{
                      flex: 1, minWidth: 220, padding: '.45rem .75rem',
                      border: '1.5px solid #cbd5e1', borderRadius: 6,
                      fontSize: '.88rem',
                    }}
                  />
                  <button
                    onClick={findNearest}
                    disabled={geocoding || !jobAddress.trim()}
                    style={{
                      padding: '.45rem 1rem', background: '#2563eb', color: '#fff',
                      border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.85rem',
                      cursor: geocoding ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {geocoding ? '⏳ Searching...' : '🔍 Find Nearest'}
                  </button>
                  {jobAddress && (
                    <button
                      onClick={() => openInMaps(jobAddress)}
                      style={{
                        padding: '.45rem .85rem', background: '#16a34a', color: '#fff',
                        border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.85rem',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      📍 Open in Maps
                    </button>
                  )}
                </div>
                {nearestResult && (
                  <div style={{
                    marginTop: '.6rem', padding: '.6rem .85rem',
                    background: nearestResult.error ? '#fee2e2' : '#dcfce7',
                    border: `1px solid ${nearestResult.error ? '#fca5a5' : '#86efac'}`,
                    borderRadius: 6, fontSize: '.85rem',
                    color: nearestResult.error ? '#991b1b' : '#14532d',
                    fontWeight: 600,
                  }}>
                    {nearestResult.error
                      ? `⚠️ ${nearestResult.error}`
                      : `✅ Closest employee: ${nearestResult.employee.employee_name} — ${nearestResult.distance} miles away`
                    }
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
