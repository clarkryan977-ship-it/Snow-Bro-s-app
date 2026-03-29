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

// Format minutes offset from a base time string "HH:MM" into "H:MM AM/PM"
function addMinutesToTime(baseTime, minutes) {
  const [h, m] = (baseTime || '06:00').split(':').map(Number);
  const total = h * 60 + m + Math.round(minutes);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
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
router.get('/my-routes', authenticateToken, async (req, res) => {
  try {
    const empId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const date = req.query.date || today;
    const sql = `SELECT * FROM routes WHERE assigned_employee_ids IS NOT NULL AND route_date = $1 ORDER BY name ASC`;
    const { rows: allRoutes } = await req.db.query(sql, [date]);

    const myRoutes = allRoutes.filter(r => {
      try {
        const ids = JSON.parse(r.assigned_employee_ids || '[]');
        return ids.includes(empId) || ids.includes(String(empId));
      } catch { return false; }
    });

    for (const route of myRoutes) {
      const { rows: stops } = await req.db.query(`
        SELECT rs.*,
          c.first_name, c.last_name,
          COALESCE(rs.address, c.address, '') AS stop_address,
          COALESCE(rs.city,    c.city,    '') AS stop_city,
          COALESCE(rs.state,   c.state,   '') AS stop_state,
          COALESCE(rs.zip,     c.zip,     '') AS stop_zip,
          c.latitude, c.longitude,
          svc.name AS booking_service_type,
          b.status AS booking_status,
          b.notes AS booking_notes
        FROM route_stops rs
        LEFT JOIN clients c ON rs.client_id = c.id
        LEFT JOIN bookings b ON rs.booking_id = b.id
        LEFT JOIN services svc ON b.service_id = svc.id
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

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    let sql = `SELECT * FROM routes`;
    const params = [];
    if (date) { sql += ` WHERE route_date = $1`; params.push(date); }
    sql += ` ORDER BY route_date DESC NULLS LAST, name ASC`;

    const { rows: routes } = await req.db.query(sql, params);
    const { rows: employees } = await req.db.query(`SELECT id, first_name, last_name FROM employees ORDER BY first_name`);
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = `${e.first_name} ${e.last_name}`; });

    for (const r of routes) {
      const { rows: cnt } = await req.db.query('SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1', [r.id]);
      const { rows: doneCnt } = await req.db.query('SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1 AND completed = TRUE', [r.id]);
      r.stop_count = cnt[0].c;
      r.completed_count = doneCnt[0].c;
      try {
        const ids = JSON.parse(r.assigned_employee_ids || '[]');
        r.assigned_employees = ids.map(id => ({ id, name: empMap[id] || empMap[String(id)] || `Employee #${id}` }));
      } catch { r.assigned_employees = []; }
    }
    res.json(routes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type, route_date, description, assigned_employee_ids, minutes_per_stop, route_start_time } = req.body;
    if (!name) return res.status(400).json({ error: 'Route name is required' });
    const empIds = JSON.stringify(Array.isArray(assigned_employee_ids) ? assigned_employee_ids : []);
    const { rows } = await req.db.query(
      `INSERT INTO routes (name, type, route_date, description, assigned_employee_ids, minutes_per_stop, route_start_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, type || 'snow', route_date || null, description || '', empIds,
       parseInt(minutes_per_stop) || 15, route_start_time || '06:00']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        svc.name AS booking_service_type,
        b.status AS booking_status
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN bookings b ON rs.booking_id = b.id
      LEFT JOIN services svc ON b.service_id = svc.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC
    `, [req.params.id]);

    route.stops = stops;
    try { route.assigned_employees = JSON.parse(route.assigned_employee_ids || '[]'); } catch { route.assigned_employees = []; }
    res.json(route);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type, route_date, description, assigned_employee_ids, minutes_per_stop, route_start_time } = req.body;
    const empIds = JSON.stringify(Array.isArray(assigned_employee_ids) ? assigned_employee_ids : []);
    await req.db.query(
      `UPDATE routes SET name=$1, type=$2, route_date=$3, description=$4, assigned_employee_ids=$5,
       minutes_per_stop=$6, route_start_time=$7, updated_at=NOW()
       WHERE id=$8`,
      [name, type || 'snow', route_date || null, description || '', empIds,
       parseInt(minutes_per_stop) || 15, route_start_time || '06:00', req.params.id]
    );
    res.json({ message: 'Route updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM routes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Route deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
//  ROUTE STOPS
// ═══════════════════════════════════════════════════════════════════

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
        svc.name AS booking_service_type,
        b.status AS booking_status
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN bookings b ON rs.booking_id = b.id
      LEFT JOIN services svc ON b.service_id = svc.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/stops', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_id, booking_id, frequency, notes, stop_label, address, city, state, zip } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    const { rows: cnt } = await req.db.query('SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1', [req.params.id]);
    if (cnt[0].c >= 200) return res.status(400).json({ error: 'Route is at the 200-stop limit' });

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

// ─── Mark stop complete / uncomplete ─────────────────────────────
router.patch('/:routeId/stops/:stopId/complete', authenticateToken, async (req, res) => {
  try {
    await req.db.query(
      `UPDATE route_stops SET completed = TRUE, completed_at = NOW() WHERE id = $1 AND route_id = $2`,
      [req.params.stopId, req.params.routeId]
    );
    res.json({ message: 'Stop marked complete' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:routeId/stops/:stopId/uncomplete', authenticateToken, async (req, res) => {
  try {
    await req.db.query(
      `UPDATE route_stops SET completed = FALSE, completed_at = NULL WHERE id = $1 AND route_id = $2`,
      [req.params.stopId, req.params.routeId]
    );
    res.json({ message: 'Stop unmarked' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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

    let startLat = parseFloat(start_lat) || 0;
    let startLng = parseFloat(start_lng) || 0;
    if (!startLat || !startLng) {
      const first = stops.find(s => s.latitude && s.longitude);
      if (first) { startLat = first.latitude; startLng = first.longitude; }
    }

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
//  LIVE ROUTE SESSIONS (GPS tracking)
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
//  CLIENT ETA LOOKUP  (revised — uses per-stop completion)
// ═══════════════════════════════════════════════════════════════════
router.get('/my-eta', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;
    const { rows: clientRows } = await req.db.query(
      'SELECT active, latitude, longitude FROM clients WHERE id = $1', [clientId]
    );
    if (!clientRows[0]) return res.json({ found: false });
    const clientLat = parseFloat(clientRows[0].latitude) || null;
    const clientLng = parseFloat(clientRows[0].longitude) || null;

    const today = new Date().toISOString().slice(0, 10);
    const { rows: routes } = await req.db.query(
      `SELECT * FROM routes WHERE route_date = $1 ORDER BY route_start_time ASC NULLS LAST`,
      [today]
    );

    let result = null;

    for (const route of routes) {
      const { rows: myStopRows } = await req.db.query(
        `SELECT rs.id, rs.position, rs.completed, rs.completed_at
         FROM route_stops rs
         WHERE rs.route_id = $1 AND rs.client_id = $2
         LIMIT 1`,
        [route.id, clientId]
      );
      if (myStopRows.length === 0) continue;

      const myStop = myStopRows[0];
      const minutesPerStop = parseInt(route.minutes_per_stop) || 15;
      const startTime = route.route_start_time
        ? (typeof route.route_start_time === 'string' ? route.route_start_time.slice(0, 5) : '06:00')
        : '06:00';

      const { rows: totalRows } = await req.db.query(
        `SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1`, [route.id]
      );
      const totalStops = totalRows[0].c;

      const { rows: completedBeforeRows } = await req.db.query(
        `SELECT COUNT(*)::int AS c FROM route_stops
         WHERE route_id = $1 AND position < $2 AND completed = TRUE`,
        [route.id, myStop.position]
      );
      const completedBefore = completedBeforeRows[0].c;
      const stopsAhead = myStop.position - completedBefore;

      const { rows: doneRows } = await req.db.query(
        `SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1 AND completed = TRUE`,
        [route.id]
      );
      const completedCount = doneRows[0].c;

      const minutesFromStart = myStop.position * minutesPerStop;
      const etaTime  = addMinutesToTime(startTime, minutesFromStart);
      const etaEarly = addMinutesToTime(startTime, minutesFromStart - minutesPerStop);
      const etaLate  = addMinutesToTime(startTime, minutesFromStart + minutesPerStop);

      // ── GPS proximity from active session ──────────────────────────
      let gpsDistanceMiles = null;
      let gpsEtaMinutes   = null;
      let crewNearby      = false;
      let crewLat         = null;
      let crewLng         = null;
      let gpsUpdatedAt    = null;
      let snowCondition   = null;

      try {
        const { rows: sessionRows } = await req.db.query(
          `SELECT admin_lat, admin_lng, admin_gps_updated_at, snow_condition
           FROM route_sessions
           WHERE route_id = $1 AND status = 'active'
           ORDER BY start_time DESC LIMIT 1`,
          [route.id]
        );
        if (sessionRows.length > 0) {
          const sess = sessionRows[0];
          crewLat      = parseFloat(sess.admin_lat)  || null;
          crewLng      = parseFloat(sess.admin_lng)  || null;
          gpsUpdatedAt = sess.admin_gps_updated_at;
          snowCondition = sess.snow_condition;

          if (crewLat && crewLng && clientLat && clientLng) {
            gpsDistanceMiles = Math.round(haversine(crewLat, crewLng, clientLat, clientLng) * 10) / 10;
            crewNearby = gpsDistanceMiles <= 0.5;
            // Drive time estimate based on snow conditions
            const SNOW_SPEED = { light: 25, moderate: 20, heavy: 15, blizzard: 10 };
            const mph = SNOW_SPEED[snowCondition] || 20;
            gpsEtaMinutes = Math.round((gpsDistanceMiles / mph) * 60);
          }
        }
      } catch (gpsErr) { /* GPS lookup failure is non-fatal */ }

      result = {
        found: true,
        route_id: route.id,
        route_name: route.name,
        route_type: route.type || 'snow',
        stop_number: myStop.position + 1,
        total_stops: totalStops,
        stops_ahead: Math.max(0, stopsAhead),
        completed_count: completedCount,
        my_stop_completed: myStop.completed === true || myStop.completed === 't',
        completed_at: myStop.completed_at,
        eta: etaTime,
        eta_window: `${etaEarly} – ${etaLate}`,
        minutes_per_stop: minutesPerStop,
        route_start_time: startTime,
        all_done: completedCount >= totalStops,
        // GPS proximity fields
        crew_lat: crewLat,
        crew_lng: crewLng,
        gps_updated_at: gpsUpdatedAt,
        gps_distance_miles: gpsDistanceMiles,
        gps_eta_minutes: gpsEtaMinutes,
        crew_nearby: crewNearby,
        snow_condition: snowCondition,
        live_session_active: true,
      };
      break;
    }

    res.json(result || { found: false, message: 'No service scheduled today' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
