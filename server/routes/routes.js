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

    // Calculate ETAs
    const { rows: settingsRows } = await req.db.query('SELECT key, value FROM route_settings');
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    const startTime = settings.eta_start_time || '08:00';
    const jobsPerHour = parseFloat(settings.eta_jobs_per_hour) || 2;
    const numCrews = parseInt(settings.eta_num_crews) || 1;
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
//  CREW GPS TRACKING
// ═══════════════════════════════════════════════════════════════════

// POST update crew location
router.post('/crew-location', authenticateToken, async (req, res) => {
  try {
    const { crew_id, latitude, longitude, current_stop } = req.body;
    await req.db.query(`
      INSERT INTO crew_locations (crew_id, latitude, longitude, current_stop, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT(crew_id) DO UPDATE SET latitude=excluded.latitude, longitude=excluded.longitude,
        current_stop=excluded.current_stop, updated_at=excluded.updated_at`,
      [crew_id || 1, latitude, longitude, current_stop || 0]);
    res.json({ message: 'Location updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET crew locations (admin)
router.get('/crew-locations', authenticateToken, async (req, res) => {
  try {
    const { rows: locs } = await req.db.query('SELECT * FROM crew_locations ORDER BY crew_id');
    res.json(locs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  PUBLIC ETA LOOKUP (no auth required)
// ═══════════════════════════════════════════════════════════════════

router.get('/eta/lookup', async (req, res) => {
  try {
    const { name, address } = req.query;
    if (!name && !address) return res.status(400).json({ error: 'Provide name or address' });

    const db = req.db;

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
      const { rows: allStops } = await db.query(`
        SELECT rs.position, rs.frequency, c.first_name, c.last_name, c.address, c.city, c.state
        FROM route_stops rs JOIN clients c ON rs.client_id = c.id
        WHERE rs.route_id = $1
        ORDER BY rs.position ASC`, [route.id]);

      // Search for matching client
      const match = allStops.find(s => {
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
        const fullAddr = `${s.address || ''} ${s.city || ''} ${s.state || ''}`.toLowerCase();
        return (name && fullName.includes(name.toLowerCase())) ||
               (address && fullAddr.includes(address.toLowerCase()));
      });

      if (match) {
        const startTime = settings.eta_start_time || '08:00';
        const jobsPerHour = parseFloat(settings.eta_jobs_per_hour) || 2;
        const numCrews = parseInt(settings.eta_num_crews) || 1;
        const minutesPerJob = 60 / jobsPerHour;
        const [startH, startM] = startTime.split(':').map(Number);
        const jobInCrewSequence = Math.floor(match.position / numCrews);
        const totalMinutes = startH * 60 + startM + jobInCrewSequence * minutesPerJob;
        const etaH = Math.floor(totalMinutes / 60) % 24;
        const etaM = Math.floor(totalMinutes % 60);

        result = {
          found: true,
          client_name: `${match.first_name} ${match.last_name}`,
          address: `${match.address || ''}, ${match.city || ''}, ${match.state || ''}`,
          route_name: route.name,
          route_type: route.type,
          stop_number: match.position + 1,
          total_stops: allStops.length,
          eta: `${String(etaH).padStart(2, '0')}:${String(etaM).padStart(2, '0')}`,
          crew_number: (match.position % numCrews) + 1,
          num_crews: numCrews,
          snow_day: snowDay,
          frequency: match.frequency,
        };

        // Check if crew GPS is available for refined ETA
        try {
          const crewNum = (match.position % numCrews) + 1;
          const { rows: crewRows } = await db.query('SELECT * FROM crew_locations WHERE crew_id = $1', [crewNum]);
          const crewLoc = crewRows[0];
          if (crewLoc) {
            result.crew_gps = { latitude: crewLoc.latitude, longitude: crewLoc.longitude, last_update: crewLoc.updated_at };
            result.crew_current_stop = crewLoc.current_stop;
            // Refined ETA: if crew has passed some stops, adjust
            if (crewLoc.current_stop > 0) {
              const remainingStops = Math.max(0, match.position - crewLoc.current_stop);
              const remainingMinutes = remainingStops * minutesPerJob;
              const now = new Date();
              const refinedTime = new Date(now.getTime() + remainingMinutes * 60000);
              result.refined_eta = `${String(refinedTime.getHours()).padStart(2, '0')}:${String(refinedTime.getMinutes()).padStart(2, '0')}`;
            }
          }
        } catch (e) { /* no crew location data */ }

        break;
      }
    }

    if (!result) {
      return res.json({ found: false, message: 'No matching client found on active routes' });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
