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

// Geocode a stop address using Nominatim with multi-attempt fallback strategy.
// Handles directional suffixes ("Main Ave S"), missing zip codes, and partial addresses.
async function geocodeStopAddress(address, city, state, zip) {
  if (!address && !city) return null;
  const https = require('https');

  // Helper: fire a single Nominatim request
  const tryNominatim = (q) => new Promise((resolve) => {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' +
      encodeURIComponent(q);
    const req = https.get(url, { headers: { 'User-Agent': 'SnowBros-RoutePlanner/1.0 (prosnowbros@prosnowbros.com)' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data && data[0]) resolve({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
          else resolve(null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });

  // Strip trailing directional suffix (S, N, E, W, NE, SW, etc.) from address
  const stripDir = (a) => a ? a.replace(/\s+[NSEW]{1,2}\.?$/i, '').trim() : a;
  // Strip street type abbreviations that confuse Nominatim (St, Ave, Blvd, Dr, Ln, Ct, Pl, Rd)
  const stripStreetType = (a) => a ? a.replace(/\s+(St|Ave|Blvd|Dr|Ln|Ct|Pl|Rd|Way|Cir|Tr|Trl)\.?$/i, '').trim() : a;

  const addr = address ? address.trim() : '';
  const addrNoDir = stripDir(addr);
  const addrNoType = addrNoDir !== addr ? stripStreetType(addrNoDir) : stripStreetType(addr);
  const cityState = [city, state].filter(Boolean).join(', ');

  // Build ordered list of query attempts (most specific to least)
  const queries = [];
  if (addr && cityState)         queries.push([addr, cityState].join(', '));
  if (addrNoDir !== addr && cityState) queries.push([addrNoDir, cityState].join(', '));
  if (addrNoType && addrNoType !== addrNoDir && cityState) queries.push([addrNoType, cityState].join(', '));
  if (addr && zip)               queries.push([addr, zip].join(', '));
  if (addrNoDir !== addr && zip) queries.push([addrNoDir, zip].join(', '));
  if (cityState)                 queries.push(cityState);

  for (const q of queries) {
    const result = await tryNominatim(q);
    if (result) {
      console.log(`[geocode] OK "${q}" -> ${result.lat},${result.lng}`);
      return result;
    }
    // Respect Nominatim 1 req/sec rate limit between attempts
    await new Promise(r => setTimeout(r, 1100));
  }
  console.log(`[geocode] FAILED all attempts for: ${[address, city, state, zip].filter(Boolean).join(', ')}`);
  return null;
}

// Format minutes offset from a base time string "HH:MM" into "H:MM AM/PM"
function addMinutesToTime(baseTime, minutes) {
  const [h, m] = (baseTime || '00:00').split(':').map(Number);
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
    const { name, type, route_date, description, assigned_employee_ids, minutes_per_stop, route_start_time, event_note } = req.body;
    if (!name) return res.status(400).json({ error: 'Route name is required' });
    const empIds = JSON.stringify(Array.isArray(assigned_employee_ids) ? assigned_employee_ids : []);
    const { rows } = await req.db.query(
      `INSERT INTO routes (name, type, route_date, description, assigned_employee_ids, minutes_per_stop, route_start_time, event_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, type || 'snow', route_date || null, description || '', empIds,
       parseInt(minutes_per_stop) || 15, route_start_time || '00:00', event_note || '']
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
    const { name, type, route_date, description, assigned_employee_ids, minutes_per_stop, route_start_time, event_note } = req.body;
    const empIds = JSON.stringify(Array.isArray(assigned_employee_ids) ? assigned_employee_ids : []);
    await req.db.query(
      `UPDATE routes SET name=$1, type=$2, route_date=$3, description=$4, assigned_employee_ids=$5,
       minutes_per_stop=$6, route_start_time=$7, event_note=$8, updated_at=NOW()
       WHERE id=$9`,
      [name, type || 'snow', route_date || null, description || '', empIds,
       parseInt(minutes_per_stop) || 15, route_start_time || '00:00', event_note || '', req.params.id]
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
    let { client_id, booking_id, frequency, notes, stop_label, address, city, state, zip } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    // ── Auto-link to booking if not provided ──────────────────────────
    // If no booking_id was sent, try to find an active/confirmed booking for this client on this route's date
    if (!booking_id) {
      const { rows: routeRows } = await req.db.query('SELECT route_date FROM routes WHERE id = $1', [req.params.id]);
      if (routeRows[0] && routeRows[0].route_date) {
        const { rows: matchingBookings } = await req.db.query(
          `SELECT id FROM bookings 
           WHERE client_id = $1 AND preferred_date = $2 AND status IN ('confirmed', 'pending')
           LIMIT 1`,
          [client_id, routeRows[0].route_date]
        );
        if (matchingBookings[0]) {
          booking_id = matchingBookings[0].id;
          console.log(`[route-stops] Auto-linked stop to booking #${booking_id} for client #${client_id}`);
        }
      }
    }

    const { rows: cnt } = await req.db.query('SELECT COUNT(*)::int AS c FROM route_stops WHERE route_id = $1', [req.params.id]);
    if (cnt[0].c >= 200) return res.status(400).json({ error: 'Route is at the 200-stop limit' });

    let dupCheck = 'SELECT id FROM route_stops WHERE route_id = $1 AND client_id = $2';
    const dupParams = [req.params.id, client_id];
    if (booking_id) { dupCheck += ' AND booking_id = $3'; dupParams.push(booking_id); }
    const { rows: existing } = await req.db.query(dupCheck, dupParams);
    if (existing.length > 0) return res.status(409).json({ error: 'Stop already on this route' });

    const { rows: maxRows } = await req.db.query('SELECT COALESCE(MAX(position), -1) AS m FROM route_stops WHERE route_id = $1', [req.params.id]);

    // Geocode the stop-level address so geo-sort uses the correct location
    // (e.g. a Fargo booking for a client whose home address is in Moorhead)
    let stopLat = null, stopLng = null;
    if (address || city) {
      const coords = await geocodeStopAddress(address, city, state, zip);
      if (coords) { stopLat = coords.lat; stopLng = coords.lng; }
    }
    // If no stop-level address was provided, fall back to client's stored coordinates
    if (stopLat === null) {
      const { rows: clientRows } = await req.db.query('SELECT latitude, longitude FROM clients WHERE id = $1', [client_id]);
      if (clientRows[0]) { stopLat = clientRows[0].latitude; stopLng = clientRows[0].longitude; }
    }

    const { rows: result } = await req.db.query(
      `INSERT INTO route_stops (route_id, client_id, booking_id, position, frequency, notes, stop_label, address, city, state, zip, stop_lat, stop_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [req.params.id, client_id, booking_id || null, maxRows[0].m + 1,
       frequency || 'weekly', notes || '', stop_label || '', address || '', city || '', state || '', zip || '',
       stopLat, stopLng]
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
    const byId   = req.user.id;
    const byName = req.user.name || req.user.email || 'Unknown';
    const byRole = req.user.role || 'employee';
    
    // 1. Update the stop as completed
    await req.db.query(
      `UPDATE route_stops SET completed = TRUE, completed_at = NOW(),
       completed_by_id = $3, completed_by_name = $4, completed_by_role = $5
       WHERE id = $1 AND route_id = $2`,
      [req.params.stopId, req.params.routeId, byId, byName, byRole]
    );

    // 2. Fetch details for the notification email
    const { rows: stopDetails } = await req.db.query(`
      SELECT rs.*, c.email, c.first_name, c.last_name, r.name as route_name
      FROM route_stops rs
      JOIN clients c ON rs.client_id = c.id
      JOIN routes r ON rs.route_id = r.id
      WHERE rs.id = $1
    `, [req.params.stopId]);

    const stop = stopDetails[0];
    if (stop && stop.email) {
      const { sendMail } = require('../utils/mailer');
      const serviceAddress = [stop.address, stop.city, stop.state, stop.zip].filter(Boolean).join(', ');
      const completionTime = new Date().toLocaleString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
        hour: 'numeric', minute: '2-digit', hour12: true 
      });

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2c3e50; text-align: center;">Your Snow Bro's service is complete!</h2>
          <p>Hi ${stop.first_name || 'there'},</p>
          <p>Great news! Your service for today has been completed. Our crew has finished the work at your property.</p>
          
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Service Address:</strong> ${serviceAddress || 'Address on file'}</p>
            <p style="margin: 5px 0;"><strong>Completed At:</strong> ${completionTime}</p>
            <p style="margin: 5px 0;"><strong>Completed By:</strong> ${byName} (${byRole})</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://snowbros-production.up.railway.app/client/history" 
               style="background: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
               View in Portal
            </a>
          </div>

          <p style="font-size: 0.9em; color: #7f8c8d; text-align: center;">
            Thank you for choosing Snow Bro's! If you have any questions, feel free to reply to this email.
          </p>
        </div>
      `;

      try {
        await sendMail({
          to: stop.email,
          subject: "Your Snow Bro's service is complete!",
          html
        });
      } catch (mailErr) {
        console.error('[MAILER] Failed to send job completion email:', mailErr.message);
        // Don't fail the whole request if mail fails
      }
    }

    res.json({ message: 'Stop marked complete' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:routeId/stops/:stopId/uncomplete', authenticateToken, async (req, res) => {
  try {
    await req.db.query(
      `UPDATE route_stops SET completed = FALSE, completed_at = NULL,
       completed_by_id = NULL, completed_by_name = '', completed_by_role = ''
       WHERE id = $1 AND route_id = $2`,
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
    // Use stop-level coordinates (stop_lat/stop_lng) if available, fall back to client home coords
    // This fixes Fargo stops being sorted as Moorhead when the client lives in Moorhead
    const { rows: rawStops2 } = await req.db.query(`
       SELECT rs.id, rs.position,
        COALESCE(rs.stop_lat, c.latitude)  AS latitude,
        COALESCE(rs.stop_lng, c.longitude) AS longitude
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC
    `, [req.params.id]);
    // Normalise lat/lng to numbers (pg returns NUMERIC columns as strings)
    const stops = rawStops2.map(s => ({
      ...s,
      latitude:  s.latitude  != null && s.latitude  !== '' ? parseFloat(s.latitude)  : null,
      longitude: s.longitude != null && s.longitude !== '' ? parseFloat(s.longitude) : null,
    }));
    let startLat = parseFloat(start_lat) || 0;
    let startLng = parseFloat(start_lng) || 0;
    if (!startLat || !startLng) {
      const first = stops.find(s => s.latitude != null && !isNaN(s.latitude) && s.longitude != null && !isNaN(s.longitude));
      if (first) { startLat = first.latitude; startLng = first.longitude; }
    }
    const geoStops = stops.filter(s => s.latitude != null && !isNaN(s.latitude) && s.longitude != null && !isNaN(s.longitude));
    const noGeo    = stops.filter(s => s.latitude == null  || isNaN(s.latitude)  || s.longitude == null  || isNaN(s.longitude));
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

// POST /:id/optimize-from-here  — nearest-neighbour from a GPS point, only moves uncompleted stops
router.post('/:id/optimize-from-here', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const startLat = parseFloat(lat);
    const startLng = parseFloat(lng);
    console.log(`[optimize-from-here] routeId=${req.params.id} startLat=${startLat} startLng=${startLng}`);

    const { rows: rawStops } = await req.db.query(`
       SELECT rs.id, rs.position, rs.completed,
        COALESCE(rs.stop_lat, c.latitude)  AS latitude,
        COALESCE(rs.stop_lng, c.longitude) AS longitude
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      WHERE rs.route_id = $1
      ORDER BY rs.position ASC
    `, [req.params.id]);
    // Normalise lat/lng to numbers (pg returns NUMERIC columns as strings)
    const stops = rawStops.map(s => ({
      ...s,
      latitude:  s.latitude  != null && s.latitude  !== '' ? parseFloat(s.latitude)  : null,
      longitude: s.longitude != null && s.longitude !== '' ? parseFloat(s.longitude) : null,
    }));
    // Completed stops stay locked at the top in their current order
    const completed = stops.filter(s => s.completed === true || s.completed === 't');
    const pending   = stops.filter(s => s.completed !== true && s.completed !== 't');
    const geoStops = pending.filter(s => s.latitude != null && !isNaN(s.latitude) && s.longitude != null && !isNaN(s.longitude));
    const noGeo    = pending.filter(s => s.latitude == null  || isNaN(s.latitude)  || s.longitude == null  || isNaN(s.longitude));

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

    const finalOrder = [...completed, ...ordered, ...noGeo];
    for (let idx = 0; idx < finalOrder.length; idx++) {
      await req.db.query('UPDATE route_stops SET position = $1 WHERE id = $2', [idx, finalOrder[idx].id]);
    }
    res.json({ message: 'Route re-optimized from location', count: finalOrder.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /:id/geocode-stops — geocode all stops in a route using multi-attempt Nominatim strategy
// Supports ?force=true to re-geocode stops that already have coordinates
router.post('/:id/geocode-stops', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const force = req.query.force === 'true' || req.body.force === true;
    const whereClause = force ? 'WHERE rs.route_id = $1' : 'WHERE rs.route_id = $1 AND rs.stop_lat IS NULL';

    const { rows: stops } = await req.db.query(`
      SELECT rs.id, rs.address, rs.city, rs.state, rs.zip,
        c.first_name, c.last_name,
        c.address AS c_address, c.city AS c_city, c.state AS c_state, c.zip AS c_zip,
        c.latitude AS c_lat, c.longitude AS c_lng
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      ${whereClause}
      ORDER BY rs.position ASC
    `, [req.params.id]);

    if (stops.length === 0) {
      return res.json({ message: 'All stops already geocoded', geocoded: 0, skipped: 0, total: 0 });
    }

    // Respond immediately so the browser doesn't time out; geocoding runs in background
    res.json({ message: 'Geocoding started', total: stops.length });

    // Background geocoding
    let geocoded = 0, skipped = 0;
    for (const stop of stops) {
      // Prefer stop-specific address over client home address
      const addr  = (stop.address  && stop.address.trim())  ? stop.address.trim()  : (stop.c_address  || '');
      const city  = (stop.city     && stop.city.trim())     ? stop.city.trim()     : (stop.c_city     || '');
      const state = (stop.state    && stop.state.trim())    ? stop.state.trim()    : (stop.c_state    || '');
      const zip   = (stop.zip      && stop.zip.trim())      ? stop.zip.trim()      : (stop.c_zip      || '');
      const clientName = `${stop.first_name || ''} ${stop.last_name || ''}`.trim();

      // Try Nominatim with multi-attempt fallback
      const coords = await geocodeStopAddress(addr, city, state, zip);
      if (coords) {
        await req.db.query('UPDATE route_stops SET stop_lat=$1, stop_lng=$2 WHERE id=$3',
          [coords.lat, coords.lng, stop.id]);
        geocoded++;
        console.log(`[geocode-stops] ${clientName}: geocoded to ${coords.lat},${coords.lng}`);
      } else if (stop.c_lat && stop.c_lng) {
        // Final fallback: use client home coordinates
        const cLat = parseFloat(stop.c_lat), cLng = parseFloat(stop.c_lng);
        if (!isNaN(cLat) && !isNaN(cLng)) {
          await req.db.query('UPDATE route_stops SET stop_lat=$1, stop_lng=$2 WHERE id=$3',
            [cLat, cLng, stop.id]);
          geocoded++;
          console.log(`[geocode-stops] ${clientName}: used client home coords ${cLat},${cLng}`);
        } else { skipped++; console.log(`[geocode-stops] ${clientName}: SKIPPED (no valid coords)`); }
      } else {
        skipped++;
        console.log(`[geocode-stops] ${clientName}: SKIPPED (no address, no client coords)`);
      }
      // Nominatim rate limit: 1 req/sec (already enforced inside geocodeStopAddress between attempts)
      // Add a small extra buffer between stops
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`[geocode-stops] Done: ${geocoded} geocoded, ${skipped} skipped of ${stops.length} total`);
  } catch (err) {
    console.error('[geocode-stops] Error:', err.message);
  }
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
        ? (typeof route.route_start_time === 'string' ? route.route_start_time.slice(0, 5) : '00:00')
        : '00:00';

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

// ═══════════════════════════════════════════════════════════════════
//  ROUTE HISTORY & EXPORT
// ═══════════════════════════════════════════════════════════════════

// GET /history — list all routes that have at least one completed stop, with summary
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date_from, date_to, search } = req.query;
    let sql = `
      SELECT r.id, r.name, r.type, r.route_date, r.description, r.assigned_employee_ids,
             r.route_start_time, r.event_note,
             COUNT(rs.id)::int                                        AS total_stops,
             SUM(CASE WHEN rs.completed THEN 1 ELSE 0 END)::int       AS completed_stops,
             MIN(rs.completed_at)                                      AS first_completed_at,
             MAX(rs.completed_at)                                      AS last_completed_at
      FROM routes r
      JOIN route_stops rs ON rs.route_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (date_from) { params.push(date_from); sql += ` AND r.route_date >= $${params.length}`; }
    if (date_to)   { params.push(date_to);   sql += ` AND r.route_date <= $${params.length}`; }
    if (search)    { params.push(`%${search}%`); sql += ` AND (r.name ILIKE $${params.length} OR r.description ILIKE $${params.length})`; }
    sql += `
      GROUP BY r.id, r.name, r.type, r.route_date, r.description, r.assigned_employee_ids, r.route_start_time, r.event_note
      HAVING SUM(CASE WHEN rs.completed THEN 1 ELSE 0 END) > 0
      ORDER BY r.route_date DESC NULLS LAST, r.name ASC
    `;
    const { rows: routes } = await req.db.query(sql, params);

    // Resolve employee names for assigned_employee_ids
    const { rows: employees } = await req.db.query(`SELECT id, first_name, last_name FROM employees ORDER BY first_name`);
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = `${e.first_name} ${e.last_name}`; });

    for (const r of routes) {
      try {
        const ids = JSON.parse(r.assigned_employee_ids || '[]');
        r.assigned_employees = ids.map(id => empMap[id] || empMap[String(id)] || `Employee #${id}`);
      } catch { r.assigned_employees = []; }
    }
    res.json(routes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /history/:id — full detail of one route with all stops sorted by completion order, with weather context
router.get('/history/:id', authenticateToken, requireAdmin, async (req, res) => {
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
        svc.name AS booking_service_type,
        b.status AS booking_status
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN bookings b ON rs.booking_id = b.id
      LEFT JOIN services svc ON b.service_id = svc.id
      WHERE rs.route_id = $1
      ORDER BY
        CASE WHEN rs.completed THEN 0 ELSE 1 END ASC,
        rs.completed_at ASC NULLS LAST,
        rs.position ASC
    `, [req.params.id]);

    // Attach nearest weather snapshot to each completed stop
    // Uses a single query per stop (nearest observation within 2 hours of completion)
    for (const stop of stops) {
      if (stop.completed && stop.completed_at) {
        try {
          const { rows: wx } = await req.db.query(`
            SELECT id, observed_at, air_temp, wind, weather, sky_cond,
                   precip_1hr, precip_3hr, precip_6hr, humidity, visibility, wind_chill
            FROM weather_snapshots
            WHERE ABS(EXTRACT(EPOCH FROM (observed_at - $1::timestamptz))) < 7200
            ORDER BY ABS(EXTRACT(EPOCH FROM (observed_at - $1::timestamptz))) ASC
            LIMIT 1
          `, [stop.completed_at]);
          stop.weather_at_completion = wx[0] || null;
        } catch { stop.weather_at_completion = null; }
      } else {
        stop.weather_at_completion = null;
      }
    }

    // Also compute cumulative precip since route start (for service verification)
    const routeStart = stops.find(s => s.completed && s.completed_at)?.completed_at;
    if (routeStart) {
      try {
        const { rows: precipRows } = await req.db.query(`
          SELECT COALESCE(SUM(CAST(NULLIF(REGEXP_REPLACE(precip_1hr, '[^0-9.]', '', 'g'), '') AS NUMERIC)), 0) AS total_precip_in
          FROM weather_snapshots
          WHERE observed_at >= $1::timestamptz - INTERVAL '1 hour'
            AND observed_at <= NOW()
        `, [routeStart]);
        route.total_precip_since_route_start = precipRows[0]?.total_precip_in || 0;
      } catch { route.total_precip_since_route_start = null; }
    }

    try { route.assigned_employees = JSON.parse(route.assigned_employee_ids || '[]'); } catch { route.assigned_employees = []; }
    route.stops = stops;
    res.json(route);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /history/:id/export.csv — download completed route as CSV
router.get('/history/:id/export.csv', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: routeRows } = await req.db.query('SELECT * FROM routes WHERE id = $1', [req.params.id]);
    if (!routeRows[0]) return res.status(404).json({ error: 'Route not found' });
    const route = routeRows[0];

    const { rows: stops } = await req.db.query(`
      SELECT rs.position, rs.completed, rs.completed_at, rs.completed_by_name, rs.completed_by_role,
        rs.notes, rs.stop_label, rs.frequency,
        c.first_name, c.last_name,
        COALESCE(rs.address, c.address, '') AS stop_address,
        COALESCE(rs.city,    c.city,    '') AS stop_city,
        COALESCE(rs.state,   c.state,   '') AS stop_state,
        COALESCE(rs.zip,     c.zip,     '') AS stop_zip,
        svc.name AS service_type
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN bookings b ON rs.booking_id = b.id
      LEFT JOIN services svc ON b.service_id = svc.id
      WHERE rs.route_id = $1
      ORDER BY
        CASE WHEN rs.completed THEN 0 ELSE 1 END ASC,
        rs.completed_at ASC NULLS LAST,
        rs.position ASC
    `, [req.params.id]);

    // Attach nearest weather snapshot to each completed stop
    for (const stop of stops) {
      if (stop.completed && stop.completed_at) {
        try {
          const { rows: wx } = await req.db.query(`
            SELECT air_temp, wind, weather, sky_cond, precip_1hr, precip_3hr, wind_chill
            FROM weather_snapshots
            WHERE ABS(EXTRACT(EPOCH FROM (observed_at - $1::timestamptz))) < 7200
            ORDER BY ABS(EXTRACT(EPOCH FROM (observed_at - $1::timestamptz))) ASC
            LIMIT 1
          `, [stop.completed_at]);
          stop.wx = wx[0] || null;
        } catch { stop.wx = null; }
      } else { stop.wx = null; }
    }

    const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const routeDate = route.route_date ? new Date(route.route_date).toLocaleDateString('en-US') : 'No date';
    const header = ['#', 'Client Name', 'Address', 'City', 'State', 'Zip', 'Service Type', 'Status',
                    'Completed At', 'Marked Done By', 'Role',
                    'Temp (°F)', 'Wind', 'Conditions', 'Sky', '1hr Precip (in)', 'Wind Chill',
                    'Notes', 'Label', 'Frequency'];
    const lines = [header.map(esc).join(',')];
    stops.forEach((s, i) => {
      const completedAt = s.completed_at ? new Date(s.completed_at).toLocaleString('en-US') : '';
      const status = s.completed ? 'Done' : 'Pending';
      lines.push([
        i + 1, `${s.first_name} ${s.last_name}`, s.stop_address, s.stop_city, s.stop_state, s.stop_zip,
        s.service_type || '', status, completedAt, s.completed_by_name || '', s.completed_by_role || '',
        s.wx?.air_temp || '', s.wx?.wind || '', s.wx?.weather || '', s.wx?.sky_cond || '',
        s.wx?.precip_1hr || '', s.wx?.wind_chill || '',
        s.notes || '', s.stop_label || '', s.frequency || ''
      ].map(esc).join(','));
    });

    const filename = `route-${route.name.replace(/[^a-z0-9]/gi, '-')}-${routeDate.replace(/\//g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(lines.join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /history/:id/export.pdf — download completed route as PDF
router.get('/history/:id/export.pdf', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

    const { rows: routeRows } = await req.db.query('SELECT * FROM routes WHERE id = $1', [req.params.id]);
    if (!routeRows[0]) return res.status(404).json({ error: 'Route not found' });
    const route = routeRows[0];

    const { rows: stops } = await req.db.query(`
      SELECT rs.position, rs.completed, rs.completed_at, rs.completed_by_name, rs.completed_by_role,
        rs.notes, rs.stop_label, rs.frequency,
        c.first_name, c.last_name,
        COALESCE(rs.address, c.address, '') AS stop_address,
        COALESCE(rs.city,    c.city,    '') AS stop_city,
        COALESCE(rs.state,   c.state,   '') AS stop_state,
        COALESCE(rs.zip,     c.zip,     '') AS stop_zip,
        svc.name AS service_type
      FROM route_stops rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN bookings b ON rs.booking_id = b.id
      LEFT JOIN services svc ON b.service_id = svc.id
      WHERE rs.route_id = $1
      ORDER BY
        CASE WHEN rs.completed THEN 0 ELSE 1 END ASC,
        rs.completed_at ASC NULLS LAST,
        rs.position ASC
    `, [req.params.id]);

    // Attach nearest weather snapshot to each completed stop
    for (const stop of stops) {
      if (stop.completed && stop.completed_at) {
        try {
          const { rows: wx } = await req.db.query(`
            SELECT air_temp, wind, weather, sky_cond, precip_1hr, wind_chill
            FROM weather_snapshots
            WHERE ABS(EXTRACT(EPOCH FROM (observed_at - $1::timestamptz))) < 7200
            ORDER BY ABS(EXTRACT(EPOCH FROM (observed_at - $1::timestamptz))) ASC
            LIMIT 1
          `, [stop.completed_at]);
          stop.wx = wx[0] || null;
        } catch { stop.wx = null; }
      } else { stop.wx = null; }
    }

    // Use landscape (792 x 612) for wider table with weather columns
    const pdfDoc = await PDFDocument.create();
    const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const PAGE_W = 792, PAGE_H = 612, MARGIN = 36;
    // Columns: #, Client, Address, Completed At, Marked By, Temp, Conditions, Precip, Status
    const colW = [22, 120, 160, 88, 90, 38, 100, 50, 50];
    const ROW_H = 16, HEADER_H = 24;

    const routeDate = route.route_date ? new Date(route.route_date).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : 'No date';
    const completedCount = stops.filter(s => s.completed).length;
    const navy = rgb(0.059, 0.216, 0.361);
    const white = rgb(1, 1, 1);
    const lightGray = rgb(0.95, 0.95, 0.95);
    const green = rgb(0.086, 0.627, 0.522);
    const gray = rgb(0.5, 0.5, 0.5);
    const lightBlue = rgb(0.85, 0.92, 1.0);

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const newPage = () => {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    };

    const drawText = (text, x, yPos, size, font, color, maxLen = 50) => {
      page.drawText(String(text || '').slice(0, maxLen), { x, y: yPos, size, font, color });
    };

    // ── Header ──
    page.drawRectangle({ x: MARGIN, y: y - 48, width: PAGE_W - MARGIN * 2, height: 52, color: navy });
    drawText("Snow Bro's", MARGIN + 10, y - 14, 16, fontBold, white);
    drawText('Route Completion Report', MARGIN + 10, y - 30, 10, fontReg, rgb(0.8, 0.9, 1));
    drawText(`Generated: ${new Date().toLocaleString('en-US')}`, PAGE_W - MARGIN - 200, y - 14, 8, fontReg, rgb(0.8, 0.9, 1));
    y -= 60;

    // ── Route meta ──
    drawText(`Route: ${route.name}`, MARGIN, y, 12, fontBold, navy);
    y -= 14;
    drawText(`Date: ${routeDate}  |  Type: ${(route.type || 'snow').toUpperCase()}  |  Stops: ${completedCount} of ${stops.length} completed`, MARGIN, y, 8, fontReg, gray);
    y -= 7;
    if (route.description) { drawText(`Notes: ${route.description}`, MARGIN, y, 8, fontReg, gray); y -= 7; }
    y -= 6;

    // ── Weather section header ──
    page.drawRectangle({ x: MARGIN, y: y - 12, width: PAGE_W - MARGIN * 2, height: 14, color: lightBlue });
    drawText('Weather data from KFAR (Fargo Hector Intl) — nearest observation within 2 hours of each stop completion', MARGIN + 4, y - 9, 7, fontReg, navy, 120);
    y -= 18;

    // ── Column headers ──
    let cx = MARGIN;
    const colX = colW.map(w => { const x = cx; cx += w; return x; });
    page.drawRectangle({ x: MARGIN, y: y - HEADER_H + 4, width: PAGE_W - MARGIN * 2, height: HEADER_H, color: navy });
    const headers = ['#', 'Client', 'Address', 'Completed At', 'Marked By', 'Temp', 'Conditions', 'Precip', 'Status'];
    headers.forEach((h, i) => drawText(h, colX[i] + 2, y - 9, 7, fontBold, white));
    y -= HEADER_H + 2;

    // ── Rows ──
    stops.forEach((s, idx) => {
      if (y < MARGIN + ROW_H + 20) { newPage(); }
      const rowColor = idx % 2 === 0 ? lightGray : white;
      page.drawRectangle({ x: MARGIN, y: y - ROW_H + 4, width: PAGE_W - MARGIN * 2, height: ROW_H, color: rowColor });
      const completedAt = s.completed_at ? new Date(s.completed_at).toLocaleString('en-US', { month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true }) : '—';
      const addr = [s.stop_address, s.stop_city].filter(Boolean).join(', ');
      const statusColor = s.completed ? green : gray;
      const wxTemp = s.wx?.air_temp ? `${s.wx.air_temp}°F` : '—';
      const wxCond = s.wx?.weather || (s.wx?.sky_cond ? s.wx.sky_cond : '—');
      const wxPrecip = s.wx?.precip_1hr && s.wx.precip_1hr !== '0.00' ? `${s.wx.precip_1hr}"` : (s.wx ? '0"' : '—');
      drawText(idx + 1,                          colX[0] + 2, y - 8, 7, fontReg, navy);
      drawText(`${s.first_name} ${s.last_name}`, colX[1] + 2, y - 8, 7, fontReg, navy);
      drawText(addr,                             colX[2] + 2, y - 8, 6, fontReg, navy, 38);
      drawText(completedAt,                      colX[3] + 2, y - 8, 6, fontReg, navy);
      drawText(s.completed_by_name || '—',       colX[4] + 2, y - 8, 6, fontReg, navy);
      drawText(wxTemp,                           colX[5] + 2, y - 8, 7, fontReg, navy);
      drawText(wxCond,                           colX[6] + 2, y - 8, 6, fontReg, navy, 22);
      drawText(wxPrecip,                         colX[7] + 2, y - 8, 7, fontReg, navy);
      drawText(s.completed ? '✓ Done' : 'Pending', colX[8] + 2, y - 8, 7, fontBold, statusColor);
      y -= ROW_H;
    });

    // ── Footer ──
    if (y < MARGIN + 30) newPage();
    y -= 10;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: gray });
    y -= 10;
    drawText(`Snow Bro's  ·  218-331-5145  ·  prosnowbros@prosnowbros.com  ·  Route exported ${new Date().toLocaleDateString('en-US')}  ·  Weather: KFAR / NWS`, MARGIN, y, 6, fontReg, gray, 120);

    const pdfBytes = await pdfDoc.save();
    const routeDate2 = route.route_date ? new Date(route.route_date).toISOString().slice(0, 10) : 'nodate';
    const filename = `route-${route.name.replace(/[^a-z0-9]/gi, '-')}-${routeDate2}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Fix orphaned stops ──────────────────────────────────────────
// POST /fix-orphans — links any route_stops with NULL booking_id to a matching booking if one exists
router.post('/fix-orphans', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: routes } = await req.db.query('SELECT id, route_date FROM routes WHERE route_date IS NOT NULL');
    let totalFixed = 0;

    for (const route of routes) {
      const { rows: orphans } = await req.db.query(
        'SELECT id, client_id FROM route_stops WHERE route_id = $1 AND booking_id IS NULL',
        [route.id]
      );

      for (const stop of orphans) {
        const { rows: matching } = await req.db.query(
          `SELECT id FROM bookings 
           WHERE client_id = $1 AND preferred_date = $2 AND status IN ('confirmed', 'pending')
           LIMIT 1`,
          [stop.client_id, route.route_date]
        );

        if (matching[0]) {
          await req.db.query('UPDATE route_stops SET booking_id = $1 WHERE id = $2', [matching[0].id, stop.id]);
          totalFixed++;
        }
      }
    }
    res.json({ message: `Fixed ${totalFixed} orphaned stops` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
