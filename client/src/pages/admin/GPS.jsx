import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../../utils/api';

// Fix default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function AdminGPS() {
  const [locations, setLocations] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = () => {
    api.get('/gps/active').then(r => {
      setLocations(r.data);
      setLastUpdate(new Date().toLocaleTimeString());
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const center = locations.length > 0
    ? [locations[0].latitude, locations[0].longitude]
    : [44.9778, -93.2650]; // default: Minneapolis

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <h1>📍 GPS Tracking</h1>
          <p>Real-time location of clocked-in employees. Refreshes every 15 seconds.</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          {lastUpdate && <span style={{ fontSize:'.8rem', color:'var(--gray-400)' }}>Updated: {lastUpdate}</span>}
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="card text-center" style={{ padding:'3rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>📍</div>
          <h3 style={{ color:'var(--gray-500)' }}>No employees currently clocked in</h3>
          <p style={{ color:'var(--gray-400)', fontSize:'.88rem', marginTop:'.5rem' }}>Locations will appear here when employees clock in and share their GPS.</p>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap', marginBottom:'1rem' }}>
            {locations.map(loc => (
              <div key={loc.employee_id} className="card card-sm" style={{ minWidth:200 }}>
                <div style={{ fontWeight:700 }}>👷 {loc.employee_name}</div>
                <div style={{ fontSize:'.8rem', color:'var(--gray-500)', marginTop:'.2rem' }}>{loc.employee_phone}</div>
                <div style={{ fontSize:'.75rem', color:'var(--gray-400)', marginTop:'.3rem' }}>
                  {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                </div>
                <div style={{ fontSize:'.75rem', color:'var(--gray-400)' }}>
                  Last seen: {new Date(loc.recorded_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })} CT
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding:0, overflow:'hidden', height:480 }}>
            <MapContainer center={center} zoom={12} style={{ height:'100%', width:'100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
              />
              {locations.map(loc => (
                <Marker key={loc.employee_id} position={[loc.latitude, loc.longitude]}>
                  <Popup>
                    <strong>{loc.employee_name}</strong><br />
                    {loc.employee_phone}<br />
                    <small>{new Date(loc.recorded_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} CT</small>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </>
      )}
    </div>
  );
}
