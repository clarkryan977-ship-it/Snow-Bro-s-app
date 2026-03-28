const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ─── Helpers ───────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborOrder(stops) {
  if (stops.length <= 1) return stops;
  const geoStops = stops.filter(s => s.latitude && s.longitude);
  const noGeo = stops.filter(s => !s.latitude || !s.longitude);
  if (geoStops.length <= 1) return [...geoStops, ...noGeo];

  const ordered = [];
  const remaining = [...geoStops];
  let current = remaining.shift();
  ordered.push(current);

  while (remaining.length > 0) {
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(current.latitude, current.longitude, remaining[i].latitude, remaining[i].longitude);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    }
    current = remaining.splice(nearest, 1)[0];
    ordered.push(current);
  }
  return [...ordered, ...noGeo];
}

// Snow conditions baseline: jobs per hour per crew
const SNOW_CONDITIONS = {
  'light': 3,
  'moderate': 2,
  'heavy': 1.5,
  'blizzard': 1
};

// ═══════════════════════════════════════════════════════════════════
//  ROUTE SETTINGS (Snow Day, ETA config)
// ═══════════════════════════════════════════════════════════════════

// GET all settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const { rows } = await req.db.query('SELECT key, value FROM route_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update settings
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body)) {
      await req.db.query(
        `INSERT INTO route_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
        [k, String(v)]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  CLIENT ACTIVE/INACTIVE TOGGLE
// ═══════════════════════════════════════════════════════════════════

router.put('/clients/:id/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { active } = req.body;
    await req.db.query('UPDATE clients SET active = $1 WHERE id = $2', [active ? 1 : 0, req.params.id]);
    res.json({ message: 'Client status updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT client coordinates (for geocoding)
router.put('/clients/:id/coords', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    await req.db.query('UPDATE clients SET latitude = $1, longitude = $2 WHERE id = $3', [latitude, longitude, req.params.id]);
    res.json({ message: 'Coordinates updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  ROUTES CRUD
// ═══════════════════════════════════════════════════════════════════

// GET all routes
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: routes } = await req.db.query('SELECT * FROM routes ORDER BY type, name');
    // Attach stop count for each route
    for (const r of routes) {
      const { rows: countRows } = await req.db.query('SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1', [r.id]);
      r.stop_count = countRows[0].c;
    }
    res.json(routes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create route
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type required' });
    const { rows } = await req.db.query('INSERT INTO routes (name, type) VALUES ($1, $2) RETURNING id', [name, type]);
    res.status(201).json({ id: rows[0].id, message: 'Route created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update route name/type
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type } = req.body;
    await req.db.query('UPDATE routes SET name = $1, type = $2, updated_at = NOW() WHERE id = $3', [name, type, req.params.id]);
    res.json({ message: 'Route updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE route
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM route_stops WHERE route_id = $1', [req.params.id]);
    await req.db.query('DELETE FROM routes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Route deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  ROUTE STOPS (clients on a route)
// ═══════════════════════════════════════════════════════════════════

// GET stops for a route (with client info + ETA)
router.get('/:id/stops', authenticateToken, async (req, res) => {
  try {
    const { rows: stops } = await req.db.query(`
      SELECT rs.id, rs.route_id, rs.client_id, rs.position, rs.frequency, rs.notes,
             c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip,
             c.active, c.latitude, c.longitude, c.service_type
      FROM route_stops rs
      JOIN clients c ON rs.client_id = c.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC`, [req.params.id]);

    // Check if there's an active session for this route
    const { rows: sessionRows } = await req.db.query(`
      SELECT * FROM route_sessions
      WHERE route_id = $1 AND status = $2
      ORDER BY created_at DESC LIMIT 1`,
      [req.params.id, 'active']);
    
    const session = sessionRows[0];

    // Calculate ETAs using session params or settings
    let settings = {};
    if (!session) {
      const { rows: settingsRows } = await req.db.query('SELECT key, value FROM route_settings');
      settingsRows.forEach(r => { settings[r.key] = r.value; });
    }

    const startTime = settings.eta_start_time || '08:00';
    const jobsPerHour = session ? session.jobs_per_hour : (parseFloat(settings.eta_jobs_per_hour) || 2);
    const numCrews = session ? session.num_crews : (parseInt(settings.eta_num_crews) || 1);
    const minutesPerJob = 60 / jobsPerHour;

    const [startH, startM] = startTime.split(':').map(Number);
    stops.forEach((stop, idx) => {
      const crewIdx = idx % numCrews;
      const jobInCrewSequence = Math.floor(idx / numCrews);
      const totalMinutes = startH * 60 + startM + jobInCrewSequence * minutesPerJob;
      const etaH = Math.floor(totalMinutes / 60) % 24;
      const etaM = Math.floor(totalMinutes % 60);
      stop.eta = `${String(etaH).padStart(2, '0')}:${String(etaM).padStart(2, '0')}`;
      stop.stop_number = idx + 1;
      stop.crew_number = crewIdx + 1;
    });

    res.json(stops);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST add client to route
router.post('/:id/stops', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_id, frequency } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    // Check not already on this route
    const { rows: existing } = await req.db.query('SELECT id FROM route_stops WHERE route_id = $1 AND client_id = $2', [req.params.id, client_id]);
    if (existing.length > 0) return res.status(409).json({ error: 'Client already on this route' });
    // Get max position
    const { rows: maxRows } = await req.db.query('SELECT COALESCE(MAX(position), -1) as m FROM route_stops WHERE route_id = $1', [req.params.id]);
    const maxPos = maxRows[0].m;
    const { rows: result } = await req.db.query(
      'INSERT INTO route_stops (route_id, client_id, position, frequency) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.params.id, client_id, maxPos + 1, frequency || 'weekly']
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Stop added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE remove stop from route
router.delete('/:routeId/stops/:stopId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: stopRows } = await req.db.query('SELECT position FROM route_stops WHERE id = $1 AND route_id = $2', [req.params.stopId, req.params.routeId]);
    if (stopRows.length === 0) return res.status(404).json({ error: 'Stop not found' });
    await req.db.query('DELETE FROM route_stops WHERE id = $1', [req.params.stopId]);
    // Reorder remaining
    await req.db.query('UPDATE route_stops SET position = position - 1 WHERE route_id = $1 AND position > $2', [req.params.routeId, stopRows[0].position]);
    res.json({ message: 'Stop removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update stop frequency/notes
router.put('/:routeId/stops/:stopId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { frequency, notes } = req.body;
    await req.db.query('UPDATE route_stops SET frequency = $1, notes = $2 WHERE id = $3 AND route_id = $4',
      [frequency || 'weekly', notes || '', req.params.stopId, req.params.routeId]);
    res.json({ message: 'Stop updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT reorder stops (manual drag-and-drop)
router.put('/:id/reorder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { stop_ids } = req.body; // array of stop IDs in new order
    if (!Array.isArray(stop_ids)) return res.status(400).json({ error: 'stop_ids array required' });
    
    for (let idx = 0; idx < stop_ids.length; idx++) {
      await req.db.query('UPDATE route_stops SET position = $1 WHERE id = $2 AND route_id = $3', [idx, stop_ids[idx], req.params.id]);
    }
    res.json({ message: 'Route reordered' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST auto-optimize route order (nearest neighbor)
router.post('/:id/optimize', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: stops } = await req.db.query(`
      SELECT rs.id, rs.position, c.latitude, c.longitude
      FROM route_stops rs
      JOIN clients c ON rs.client_id = c.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC`, [req.params.id]);

    const optimized = nearestNeighborOrder(stops);
    
    for (let idx = 0; idx < optimized.length; idx++) {
      await req.db.query('UPDATE route_stops SET position = $1 WHERE id = $2', [idx, optimized[idx].id]);
    }
    res.json({ message: 'Route optimized', order: optimized.map(s => s.id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  LIVE ROUTE SESSIONS (admin GPS tracking + real-time ETA)
// ═══════════════════════════════════════════════════════════════════

// POST start a new route session
router.post('/sessions/start', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { route_id, num_crews = 1, snow_condition = 'moderate' } = req.body;
    if (!route_id) return res.status(400).json({ error: 'route_id required' });
    
    const jobsPerHour = SNOW_CONDITIONS[snow_condition] || SNOW_CONDITIONS['moderate'];
    
    // End any existing active sessions for this route
    await req.db.query('UPDATE route_sessions SET status = $1 WHERE route_id = $2 AND status = $3',
      ['ended', route_id, 'active']);
    
    // Create new session
    const { rows } = await req.db.query(`
      INSERT INTO route_sessions (route_id, status, num_crews, jobs_per_hour, snow_condition, start_time)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, route_id, status, num_crews, jobs_per_hour, snow_condition, start_time`,
      [route_id, 'active', num_crews, jobsPerHour, snow_condition]);
    
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET active session for a route
router.get('/sessions/active/:route_id', authenticateToken, async (req, res) => {
  try {
    const { rows } = await req.db.query(`
      SELECT * FROM route_sessions
      WHERE route_id = $1 AND status = $2
      ORDER BY created_at DESC LIMIT 1`,
      [req.params.route_id, 'active']);
    
    if (rows.length === 0) return res.json({ found: false });
    res.json({ found: true, session: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST update admin GPS location for active session
router.post('/sessions/:session_id/gps', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude required' });
    }
    
    // Get the session and its route
    const { rows: sessionRows } = await req.db.query(
      'SELECT * FROM route_sessions WHERE id = $1 AND status = $2',
      [req.params.session_id, 'active']);
    
    if (sessionRows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }
    
    const session = sessionRows[0];
    
    // Get all stops for this route with client coords
    const { rows: stops } = await req.db.query(`
      SELECT rs.id, rs.position, rs.client_id, c.latitude, c.longitude, c.first_name, c.last_name
      FROM route_stops rs
      JOIN clients c ON rs.client_id = c.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC`, [session.route_id]);
    
    // Determine which stop the admin is currently at or closest to
    let currentStop = 0;
    let minDist = Infinity;
    for (const stop of stops) {
      if (stop.latitude && stop.longitude) {
        const dist = haversine(latitude, longitude, stop.latitude, stop.longitude);
        if (dist < minDist) {
          minDist = dist;
          currentStop = stop.position;
        }
      }
    }
    
    // Update session with GPS location
    await req.db.query(`
      UPDATE route_sessions
      SET admin_lat = $1, admin_lng = $2, admin_gps_updated_at = NOW(), current_stop = $3
      WHERE id = $4`,
      [latitude, longitude, currentStop, req.params.session_id]);
    
    res.json({ message: 'GPS updated', current_stop: currentStop });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update session parameters (num_crews, snow_condition, jobs_per_hour)
router.put('/sessions/:session_id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { num_crews, snow_condition, jobs_per_hour } = req.body;
    
    let jobsPerHour = jobs_per_hour;
    if (snow_condition && !jobs_per_hour) {
      jobsPerHour = SNOW_CONDITIONS[snow_condition] || SNOW_CONDITIONS['moderate'];
    }
    
    const updates = {};
    if (num_crews !== undefined) updates.num_crews = num_crews;
    if (snow_condition !== undefined) updates.snow_condition = snow_condition;
    if (jobsPerHour !== undefined) updates.jobs_per_hour = jobsPerHour;
    
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = [...Object.values(updates), req.params.session_id];
    
    await req.db.query(
      `UPDATE route_sessions SET ${setClauses} WHERE id = $${values.length}`,
      values);
    
    res.json({ message: 'Session updated', updates });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST end a route session
router.post('/sessions/:session_id/end', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query(
      'UPDATE route_sessions SET status = $1, ended_at = NOW() WHERE id = $2',
      ['ended', req.params.session_id]);
    
    res.json({ message: 'Route session ended' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  CLIENT ETA LOOKUP (authenticated clients only)
// ═══════════════════════════════════════════════════════════════════

router.get('/my-eta', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;
    const db = req.db;

    // Verify client is active
    const { rows: clientRows } = await db.query('SELECT active FROM clients WHERE id = $1', [clientId]);
    if (!clientRows[0] || clientRows[0].active !== 1) {
      return res.json({ found: false, message: 'Account is not active' });
    }

    // Get settings
    const { rows: settingsRows } = await db.query('SELECT key, value FROM route_settings');
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });
    const snowDay = settings.snow_day_active === '1';

    // Find matching routes
    const routeType = snowDay ? 'snow' : 'lawn';
    const { rows: routes } = await db.query('SELECT * FROM routes WHERE type = $1', [routeType]);

    let result = null;
    for (const route of routes) {
      // Check if there's an active session for this route
      const { rows: sessionRows } = await db.query(`
        SELECT * FROM route_sessions
        WHERE route_id = $1 AND status = $2
        ORDER BY created_at DESC LIMIT 1`,
        [route.id, 'active']);
      
      const session = sessionRows[0];
      
      const { rows: stopRows } = await db.query(`
        SELECT rs.position, rs.frequency, rs.client_id, c.latitude, c.longitude
        FROM route_stops rs
        JOIN clients c ON rs.client_id = c.id
        WHERE rs.route_id = $1 AND rs.client_id = $2`, [route.id, clientId]);

      if (stopRows.length > 0) {
        const match = stopRows[0];
        
        // Use session parameters if active, otherwise use settings
        const jobsPerHour = session ? session.jobs_per_hour : (parseFloat(settings.eta_jobs_per_hour) || 2);
        const numCrews = session ? session.num_crews : (parseInt(settings.eta_num_crews) || 1);
        const startTime = settings.eta_start_time || '08:00';
        const minutesPerJob = 60 / jobsPerHour;
        const [startH, startM] = startTime.split(':').map(Number);
        const jobInCrewSequence = Math.floor(match.position / numCrews);
        const totalMinutes = startH * 60 + startM + jobInCrewSequence * minutesPerJob;
        const etaH = Math.floor(totalMinutes / 60) % 24;
        const etaM = Math.floor(totalMinutes % 60);
        const stopsAhead = Math.max(0, match.position - (session?.current_stop || 0));

        result = {
          found: true,
          route_name: route.name,
          route_type: route.type,
          stop_number: match.position + 1,
          eta: `${String(etaH).padStart(2, '0')}:${String(etaM).padStart(2, '0')}`,
          crew_number: (match.position % numCrews) + 1,
          snow_day: snowDay,
          stops_ahead: stopsAhead,
          session_active: !!session,
          snow_condition: session?.snow_condition || 'moderate'
        };

        // If session is active with GPS, calculate refined ETA based on distance
        if (session && session.admin_lat && session.admin_lng && match.latitude && match.longitude) {
          try {
            // Distance from admin GPS to this client
            const distToClient = haversine(session.admin_lat, session.admin_lng, match.latitude, match.longitude);
            // Assume 15 mph average speed in snow
            const driveMinsToClient = (distToClient / 15) * 60;
            
            // Remaining stops ahead * time per job
            const remainingJobMins = stopsAhead * minutesPerJob;
            
            // Total remaining time
            const totalRemainMins = driveMinsToClient + remainingJobMins;
            const now = new Date();
            const refinedTime = new Date(now.getTime() + totalRemainMins * 60000);
            result.refined_eta = `${String(refinedTime.getHours()).padStart(2, '0')}:${String(refinedTime.getMinutes()).padStart(2, '0')}`;
            
            // ETA window: +/- 15 minutes
            const windowStart = new Date(refinedTime.getTime() - 15 * 60000);
            const windowEnd = new Date(refinedTime.getTime() + 15 * 60000);
            result.eta_window_start = `${String(windowStart.getHours()).padStart(2, '0')}:${String(windowStart.getMinutes()).padStart(2, '0')}`;
            result.eta_window_end = `${String(windowEnd.getHours()).padStart(2, '0')}:${String(windowEnd.getMinutes()).padStart(2, '0')}`;
          } catch (e) { /* no GPS data */ }
        }

        break;
      }
    }

    if (!result) {
      return res.json({ found: false, message: 'No service scheduled today' });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
