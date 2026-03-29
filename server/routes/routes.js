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
  const noGeo    = stops.filter(s => !s.latitude || !s.longitude);
  if (geoStops.length <= 1) return [...geoStops, ...noGeo];
  const ordered = [];
  const remaining = [...geoStops];
  let current = remaining.shift();
  ordered.push(current);
  while (remaining.length > 0) {
    let nearest = 0, nearestDist = Infinity;
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
//  ROUTE SETTINGS
// ═══════════════════════════════════════════════════════════════════
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const { rows } = await req.db.query('SELECT key, value FROM route_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
//  CLIENT ACTIVE/INACTIVE TOGGLE + COORDS
// ═══════════════════════════════════════════════════════════════════
router.put('/clients/:id/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { active } = req.body;
    await req.db.query('UPDATE clients SET active = $1 WHERE id = $2', [active ? 1 : 0, req.params.id]);
    res.json({ message: 'Client status updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/clients/:id/coords', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    await req.db.query('UPDATE clients SET latitude = $1, longitude = $2 WHERE id = $3', [latitude, longitude, req.params.id]);
    res.json({ message: 'Coordinates updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  EMPLOYEE: MY ROUTES (routes assigned to the logged-in employee)
// ═══════════════════════════════════════════════════════════════════
// GET /routes/my-routes?date=YYYY-MM-DD  (employee only)
router.get('/my-routes', authenticateToken, async (req, res) => {
  try {
    const empId = req.user.id;
    // Default to today if no date provided
    const today = new Date().toISOString().slice(0, 10);
    const date = req.query.date || today;
    const sql = `SELECT * FROM routes WHERE assigned_employee_ids IS NOT NULL AND route_date = $1 ORDER BY name ASC`;
    const params = [date];

    const { rows: allRoutes } = await req.db.query(sql, params);

    // Filter to routes that include this employee
    const myRoutes = allRoutes.filter(r => {
      try {
        const ids = JSON.parse(r.assigned_employee_ids || '[]');
        return ids.includes(empId) || ids.includes(String(empId));
      } catch { return false; }
    });

    // Attach stops for each route
    for (const route of myRoutes) {
      const { rows: stops } = await req.db.query(`
        SELECT rs.*,
          c.first_name, c.last_name,
          COALESCE(rs.address, c.address, '') AS stop_address,
          COALESCE(rs.city,    c.city,    '') AS stop_city,
          COALESCE(rs.state,   c.state,   '') AS stop_state,
          COALESCE(rs.zip,     c.zip,     '') AS stop_zip,
          c.latitude, c.longitude,
          b.service_type AS booking_service_type,
          b.status AS booking_status,
          b.notes AS booking_notes
        FROM route_stops rs
        LEFT JOIN clients c ON rs.client_id = c.id
        LEFT JOIN bookings b ON rs.booking_id = b.id
        WHERE rs.route_id = $1
        ORDER BY rs.position ASC
      `, [route.id]);
      route.stops = stops;
    }

    res.json(myRoutes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  NAMED ROUTES CRUD (admin)
// ═══════════════════════════════════════════════════════════════════

// GET /routes — list all routes (with stop count and assigned employee names)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    let sql = `SELECT * FROM routes`;
    const params = [];
    if (date) { sql += ` WHERE route_date = $1`; params.push(date); }
    sql += ` ORDER BY route_date DESC NULLS LAST, name ASC`;

    const { rows: routes } = await req.db.query(sql, params);

    // Attach stop count and employee names
    const { rows: employees } = await req.db.query(`SELECT id, first_name, last_name FROM employees ORDER BY first_name`);
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = `${e.first_name} ${e.last_name}`; });

    for (const r of routes) {
      const { rows: cnt } = await req.db.query('SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1', [r.id]);
      r.stop_count = cnt[0].c;
      try {
        const ids = JSON.parse(r.assigned_employee_ids || '[]');
        r.assigned_employees = ids.map(id => ({ id, name: empMap[id] || empMap[String(id)] || `Employee #${id}` }));
      } catch { r.assigned_employees = []; }
    }
    res.json(routes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /routes — create a new named route
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type, route_date, description, assigned_employee_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Route name is required' });
    const empIds = JSON.stringify(Array.isArray(assigned_employee_ids) ? assigned_employee_ids : []);
    const { rows } = await req.db.query(
      `INSERT INTO routes (name, type, route_date, description, assigned_employee_ids)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, type || 'lawn', route_date || null, description || '', empIds]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /routes/:id — get a single route with all stops
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: routeRows } = await req.db.query('SELECT * FROM routes WHERE id = $1', [req.params.id]);
    if (!routeRows[0]) return res.status(404).json({ error: 'Route not found' });
    const route = routeRows[0];

    const { rows: stops } = await req.db.query(`
      SELECT rs.*,
        c.first_name, c.last_name,
        COALESCE(rs.address, c.address, '') AS stop_address,
        COALESCE(rs.city,    c.city,    '') AS stop_city,
        COALESCE(rs.state,   c.state,   '') AS stop_state,
        COALESCE(rs.zip,     c.zip,     '') AS stop_zip,
        c.latitude, c.longitude,
        b.service_type AS booking_service_type,
        b.status AS booking_status
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN bookings b ON rs.booking_id = b.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC
    `, [req.params.id]);

    route.stops = stops;
    try { route.assigned_employees = JSON.parse(route.assigned_employee_ids || '[]'); } catch { route.assigned_employees = []; }
    res.json(route);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /routes/:id — update route metadata (name, date, type, description, assigned employees)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type, route_date, description, assigned_employee_ids } = req.body;
    const empIds = JSON.stringify(Array.isArray(assigned_employee_ids) ? assigned_employee_ids : []);
    await req.db.query(
      `UPDATE routes SET name=$1, type=$2, route_date=$3, description=$4, assigned_employee_ids=$5, updated_at=NOW()
       WHERE id=$6`,
      [name, type || 'lawn', route_date || null, description || '', empIds, req.params.id]
    );
    res.json({ message: 'Route updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /routes/:id — delete a route and all its stops
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM routes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Route deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  ROUTE STOPS
// ═══════════════════════════════════════════════════════════════════

// GET /routes/:id/stops
router.get('/:id/stops', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`
      SELECT rs.*,
        c.first_name, c.last_name,
        COALESCE(rs.address, c.address, '') AS stop_address,
        COALESCE(rs.city,    c.city,    '') AS stop_city,
        COALESCE(rs.state,   c.state,   '') AS stop_state,
        COALESCE(rs.zip,     c.zip,     '') AS stop_zip,
        c.latitude, c.longitude,
        b.service_type AS booking_service_type,
        b.status AS booking_status
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN bookings b ON rs.booking_id = b.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /routes/:id/stops — add a stop (client or booking)
router.post('/:id/stops', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_id, booking_id, frequency, notes, stop_label, address, city, state, zip } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    // Check stop limit (200 per route)
    const { rows: cnt } = await req.db.query('SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1', [req.params.id]);
    if (cnt[0].c >= 200) return res.status(400).json({ error: 'Route is at the 200-stop limit' });

    // Check for duplicate
    let dupCheck = 'SELECT id FROM route_stops WHERE route_id = $1 AND client_id = $2';
    const dupParams = [req.params.id, client_id];
    if (booking_id) { dupCheck += ' AND booking_id = $3'; dupParams.push(booking_id); }
    const { rows: existing } = await req.db.query(dupCheck, dupParams);
    if (existing.length > 0) return res.status(409).json({ error: 'Stop already on this route' });

    const { rows: maxRows } = await req.db.query('SELECT COALESCE(MAX(position), -1) AS m FROM route_stops WHERE route_id = $1', [req.params.id]);
    const { rows: result } = await req.db.query(
      `INSERT INTO route_stops (route_id, client_id, booking_id, position, frequency, notes, stop_label, address, city, state, zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [req.params.id, client_id, booking_id || null, maxRows[0].m + 1,
       frequency || 'weekly', notes || '', stop_label || '', address || '', city || '', state || '', zip || '']
    );
    res.status(201).json({ id: result[0].id, message: 'Stop added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /routes/:routeId/stops/:stopId
router.delete('/:routeId/stops/:stopId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: stopRows } = await req.db.query(
      'SELECT position FROM route_stops WHERE id = $1 AND route_id = $2',
      [req.params.stopId, req.params.routeId]
    );
    if (!stopRows[0]) return res.status(404).json({ error: 'Stop not found' });
    await req.db.query('DELETE FROM route_stops WHERE id = $1', [req.params.stopId]);
    await req.db.query(
      'UPDATE route_stops SET position = position - 1 WHERE route_id = $1 AND position > $2',
      [req.params.routeId, stopRows[0].position]
    );
    res.json({ message: 'Stop removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /routes/:routeId/stops/:stopId — update notes/frequency
router.put('/:routeId/stops/:stopId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { frequency, notes, stop_label } = req.body;
    await req.db.query(
      'UPDATE route_stops SET frequency=$1, notes=$2, stop_label=$3 WHERE id=$4 AND route_id=$5',
      [frequency || 'weekly', notes || '', stop_label || '', req.params.stopId, req.params.routeId]
    );
    res.json({ message: 'Stop updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /routes/:id/reorder — save new stop order
router.put('/:id/reorder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { stop_ids } = req.body;
    if (!Array.isArray(stop_ids)) return res.status(400).json({ error: 'stop_ids array required' });
    for (let idx = 0; idx < stop_ids.length; idx++) {
      await req.db.query('UPDATE route_stops SET position = $1 WHERE id = $2 AND route_id = $3', [idx, stop_ids[idx], req.params.id]);
    }
    res.json({ message: 'Route reordered' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /routes/:id/optimize — nearest-neighbor geo-sort
router.post('/:id/optimize', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_lat, start_lng } = req.body;
    const { rows: stops } = await req.db.query(`
      SELECT rs.id, rs.position,
        COALESCE(c.latitude, 0)  AS latitude,
        COALESCE(c.longitude, 0) AS longitude
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC
    `, [req.params.id]);

    // If start coords provided, use them; otherwise use first stop with coords
    let startLat = parseFloat(start_lat) || 0;
    let startLng = parseFloat(start_lng) || 0;
    if (!startLat || !startLng) {
      const first = stops.find(s => s.latitude && s.longitude);
      if (first) { startLat = first.latitude; startLng = first.longitude; }
    }

    // Nearest-neighbor from start
    const geoStops = stops.filter(s => s.latitude && s.longitude);
    const noGeo    = stops.filter(s => !s.latitude || !s.longitude);
    const ordered  = [];
    const remaining = [...geoStops];
    let curLat = startLat, curLng = startLng;
    while (remaining.length > 0) {
      let nearest = 0, nearestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversine(curLat, curLng, remaining[i].latitude, remaining[i].longitude);
        if (d < nearestDist) { nearestDist = d; nearest = i; }
      }
      const next = remaining.splice(nearest, 1)[0];
      ordered.push(next);
      curLat = next.latitude; curLng = next.longitude;
    }
    const finalOrder = [...ordered, ...noGeo];
    for (let idx = 0; idx < finalOrder.length; idx++) {
      await req.db.query('UPDATE route_stops SET position = $1 WHERE id = $2', [idx, finalOrder[idx].id]);
    }
    res.json({ message: 'Route optimized', count: finalOrder.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  LIVE ROUTE SESSIONS (GPS tracking + ETA)
// ═══════════════════════════════════════════════════════════════════
router.post('/sessions/start', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { route_id, num_crews = 1, snow_condition = 'moderate' } = req.body;
    if (!route_id) return res.status(400).json({ error: 'route_id required' });
    const SNOW_CONDITIONS = { light: 3, moderate: 2, heavy: 1.5, blizzard: 1 };
    const jobsPerHour = SNOW_CONDITIONS[snow_condition] || 2;
    await req.db.query(`UPDATE route_sessions SET status='ended', ended_at=NOW() WHERE route_id=$1 AND status='active'`, [route_id]);
    const { rows } = await req.db.query(
      `INSERT INTO route_sessions (route_id, status, num_crews, jobs_per_hour, snow_condition, start_time)
       VALUES ($1, 'active', $2, $3, $4, NOW()) RETURNING id`,
      [route_id, num_crews, jobsPerHour, snow_condition]
    );
    res.status(201).json({ id: rows[0].id, message: 'Session started' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/sessions/:id/gps', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    await req.db.query(
      `UPDATE route_sessions SET admin_lat=$1, admin_lng=$2, admin_gps_updated_at=NOW() WHERE id=$3`,
      [latitude, longitude, req.params.id]
    );
    res.json({ message: 'GPS updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/sessions/:id/stop', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { current_stop } = req.body;
    await req.db.query(`UPDATE route_sessions SET current_stop=$1 WHERE id=$2`, [current_stop, req.params.id]);
    res.json({ message: 'Stop updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sessions/:id/end', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query(`UPDATE route_sessions SET status='ended', ended_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Session ended' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  CLIENT ETA LOOKUP
// ═══════════════════════════════════════════════════════════════════
router.get('/my-eta', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;
    const { rows: clientRows } = await req.db.query('SELECT active FROM clients WHERE id = $1', [clientId]);
    if (!clientRows[0] || clientRows[0].active !== 1) return res.json({ found: false });

    const { rows: settingsRows } = await req.db.query('SELECT key, value FROM route_settings');
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    const today = new Date().toISOString().slice(0, 10);
    const { rows: routes } = await req.db.query(`SELECT * FROM routes WHERE route_date = $1`, [today]);
    let result = null;

    for (const route of routes) {
      const { rows: sessionRows } = await req.db.query(
        `SELECT * FROM route_sessions WHERE route_id=$1 AND status='active' ORDER BY created_at DESC LIMIT 1`,
        [route.id]
      );
      const session = sessionRows[0];
      const { rows: stopRows } = await req.db.query(
        `SELECT rs.position, c.latitude, c.longitude
         FROM route_stops rs JOIN clients c ON rs.client_id = c.id
         WHERE rs.route_id=$1 AND rs.client_id=$2`,
        [route.id, clientId]
      );
      if (stopRows.length > 0) {
        const match = stopRows[0];
        const jobsPerHour = session ? session.jobs_per_hour : (parseFloat(settings.eta_jobs_per_hour) || 2);
        const numCrews    = session ? session.num_crews     : (parseInt(settings.eta_num_crews) || 1);
        const startTime   = settings.eta_start_time || '08:00';
        const minutesPerJob = 60 / jobsPerHour;
        const [startH, startM] = startTime.split(':').map(Number);
        const jobInSeq = Math.floor(match.position / numCrews);
        const totalMins = startH * 60 + startM + jobInSeq * minutesPerJob;
        const etaH = Math.floor(totalMins / 60) % 24;
        const etaM = Math.floor(totalMins % 60);
        result = {
          found: true,
          route_name: route.name,
          stop_number: match.position + 1,
          eta: `${String(etaH).padStart(2, '0')}:${String(etaM).padStart(2, '0')}`,
          crew_number: (match.position % numCrews) + 1,
          stops_ahead: Math.max(0, match.position - (session?.current_stop || 0)),
          session_active: !!session,
        };
        break;
      }
    }
    res.json(result || { found: false, message: 'No service scheduled today' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
