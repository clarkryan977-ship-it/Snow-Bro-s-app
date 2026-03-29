import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

/** Send current GPS position to the server. Silent on error. */
function sendGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      api.post('/gps/update', {
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
      }).catch(() => {});
    },
    () => {},
    { timeout: 10000, maximumAge: 30000 }
  );
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ClockWidget() {
  const [status, setStatus]       = useState(null);  // null = loading, { clocked_in, record }
  const [elapsed, setElapsed]     = useState(0);     // seconds since clock-in
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [jobAddress, setJobAddress] = useState('');
  const timerRef = useRef(null);
  const gpsRef   = useRef(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/time/status');
      setStatus(data);
      if (data.clocked_in && data.record?.clock_in) {
        const secs = Math.floor((Date.now() - new Date(data.record.clock_in).getTime()) / 1000);
        setElapsed(Math.max(0, secs));
      } else {
        setElapsed(0);
      }
    } catch {
      setStatus({ clocked_in: false, record: null });
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Live timer tick
  useEffect(() => {
    if (status?.clocked_in) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status?.clocked_in]);

  // GPS sharing while clocked in — send immediately then every 60 seconds
  useEffect(() => {
    if (status?.clocked_in) {
      sendGPS();
      gpsRef.current = setInterval(sendGPS, 60000);
    } else {
      clearInterval(gpsRef.current);
    }
    return () => clearInterval(gpsRef.current);
  }, [status?.clocked_in]);

  const handleClockIn = async () => {
    setLoading(true);
    try {
      // Request geolocation permission proactively before clock-in
      let lat = null, lng = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          // Permission denied or unavailable — still allow clock-in
        }
      }

      await api.post('/time/clock-in', { job_address: jobAddress || '' });

      // Send first GPS ping immediately if we got a position
      if (lat !== null && lng !== null) {
        api.post('/gps/update', { latitude: lat, longitude: lng }).catch(() => {});
      }

      flash('success', '✅ Clocked in! GPS sharing is active.');
      setShowForm(false);
      setJobAddress('');
      await loadStatus();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to clock in');
    } finally { setLoading(false); }
  };

  const handleClockOut = async () => {
    if (!window.confirm('Clock out now?')) return;
    setLoading(true);
    try {
      await api.post('/time/clock-out', {});
      flash('success', '✅ Clocked out successfully!');
      clearInterval(gpsRef.current);
      await loadStatus();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to clock out');
    } finally { setLoading(false); }
  };

  if (!status) return null; // still loading, render nothing

  const isClockedIn = status.clocked_in;
  const clockInTime = status.record?.clock_in
    ? new Date(status.record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="card" style={{
      background: isClockedIn
        ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
        : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
      border: `2px solid ${isClockedIn ? '#16a34a' : '#94a3b8'}`,
      borderRadius: 12,
      padding: '1.25rem 1.5rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Left: status info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Status dot */}
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: isClockedIn ? '#16a34a' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', flexShrink: 0,
            boxShadow: isClockedIn ? '0 0 0 4px rgba(22,163,74,0.2)' : 'none',
          }}>
            {isClockedIn ? '⏱️' : '⏸️'}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: isClockedIn ? '#14532d' : '#475569' }}>
              {isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
            </div>
            {isClockedIn && clockInTime && (
              <div style={{ fontSize: '.85rem', color: '#166534', marginTop: 2 }}>
                Since {clockInTime}
                {status.record?.job_address && (
                  <span style={{ marginLeft: '.5rem', color: '#15803d' }}>
                    · {status.record.job_address}
                  </span>
                )}
              </div>
            )}
            {!isClockedIn && (
              <div style={{ fontSize: '.82rem', color: '#64748b', marginTop: 2 }}>
                Tap Clock In to start tracking your time
              </div>
            )}
          </div>
        </div>

        {/* Center: elapsed timer */}
        {isClockedIn && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'monospace', fontSize: '2rem', fontWeight: 900,
              color: '#14532d', letterSpacing: 2,
              background: 'rgba(255,255,255,0.6)', borderRadius: 8,
              padding: '.25rem .75rem',
            }}>
              {formatElapsed(elapsed)}
            </div>
            <div style={{ fontSize: '.72rem', color: '#166534', marginTop: 2, fontWeight: 600 }}>
              TIME ELAPSED
            </div>
          </div>
        )}

        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isClockedIn ? (
            <button
              className="btn btn-primary"
              style={{ fontWeight: 700, fontSize: '1rem', padding: '.6rem 1.4rem', borderRadius: 8 }}
              onClick={() => setShowForm(f => !f)}
              disabled={loading}
            >
              {loading ? '...' : '🟢 Clock In'}
            </button>
          ) : (
            <button
              className="btn btn-danger"
              style={{ fontWeight: 700, fontSize: '1rem', padding: '.6rem 1.4rem', borderRadius: 8 }}
              onClick={handleClockOut}
              disabled={loading}
            >
              {loading ? '...' : '🔴 Clock Out'}
            </button>
          )}
          <Link to="/admin/time-records" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: '.8rem' }}>
              View Time Records
            </button>
          </Link>
        </div>
      </div>

      {/* Inline clock-in form */}
      {showForm && !isClockedIn && (
        <div style={{
          marginTop: '1rem', paddingTop: '1rem',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', gap: '.75rem', alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '.3rem' }}>
              Job Address (optional)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 123 Main St, Moorhead MN"
              value={jobAddress}
              onChange={e => setJobAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleClockIn()}
              style={{ fontSize: '.9rem' }}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleClockIn}
            disabled={loading}
            style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {loading ? 'Clocking In...' : '✅ Confirm Clock In'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowForm(false)}
          >Cancel</button>
        </div>
      )}

      {/* Flash message */}
      {msg && (
        <div style={{
          marginTop: '.75rem',
          padding: '.5rem .75rem',
          borderRadius: 6,
          fontSize: '.85rem',
          fontWeight: 600,
          background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'success' ? '#14532d' : '#991b1b',
          border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
