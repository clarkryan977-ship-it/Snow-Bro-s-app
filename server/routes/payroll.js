const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── Ensure payroll tables exist ───────────────────────────────────────────────
// (Tables are created in init.js via ALTER TABLE; this route handles runtime checks)

// ── Get all pay periods ───────────────────────────────────────────────────────
router.get('/periods', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query(`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status TEXT DEFAULT 'open',
        paid_at TIMESTAMP,
        notes TEXT DEFAULT '',
        total_hours REAL DEFAULT 0,
        total_gross REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await req.db.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_hours REAL DEFAULT 0`).catch(() => {});
    await req.db.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_gross REAL DEFAULT 0`).catch(() => {});
    const { rows } = await req.db.query(
      'SELECT * FROM payroll_periods ORDER BY start_date DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create a pay period ───────────────────────────────────────────────────────
router.post('/periods', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, start_date, end_date, notes } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Name, start date, and end date are required' });
    }
    const { rows } = await req.db.query(
      `INSERT INTO payroll_periods (name, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, start_date, end_date, notes || '']);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mark pay period as paid ───────────────────────────────────────────────────
router.put('/periods/:id/pay', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `UPDATE payroll_periods SET status='paid', paid_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Pay period not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reopen a paid pay period ──────────────────────────────────────────────────
router.put('/periods/:id/reopen', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `UPDATE payroll_periods SET status='open', paid_at=NULL WHERE id=$1 RETURNING *`,
      [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Pay period not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete a pay period ───────────────────────────────────────────────────────
router.delete('/periods/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM payroll_periods WHERE id=$1', [req.params.id]);
    res.json({ message: 'Pay period deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get payroll summary for a date range ─────────────────────────────────────
// Frontend calls: GET /payroll/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns fields: employee_id, employee_name, employee_email, total_minutes, shift_count, hourly_rate
router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Support both ?start= and ?start_date= param names
    const start_date = req.query.start || req.query.start_date;
    const end_date   = req.query.end   || req.query.end_date;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start and end date parameters are required' });
    }

    // Ensure hourly_rate column exists
    await req.db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate REAL DEFAULT 0`).catch(() => {});

    // Get all active employees with their minutes in the period
    const { rows } = await req.db.query(
      `SELECT e.id AS employee_id,
              e.first_name || ' ' || e.last_name AS employee_name,
              e.email AS employee_email,
              COALESCE(e.hourly_rate, 0) AS hourly_rate,
              COUNT(tr.id) AS shift_count,
              COALESCE(SUM(
                CASE
                  WHEN tr.duration_minutes IS NOT NULL AND tr.duration_minutes > 0
                    THEN tr.duration_minutes
                  WHEN tr.clock_out IS NOT NULL
                    THEN ROUND(EXTRACT(EPOCH FROM (tr.clock_out - tr.clock_in)) / 60.0, 2)
                  ELSE 0
                END
              ), 0) AS total_minutes
       FROM employees e
       LEFT JOIN time_records tr
         ON tr.employee_id = e.id
         AND tr.clock_out IS NOT NULL
         AND tr.clock_in >= $1::date
         AND tr.clock_in < ($2::date + INTERVAL '1 day')
       WHERE (e.active IS NULL OR e.active != 0)
       GROUP BY e.id, e.first_name, e.last_name, e.email, e.hourly_rate
       ORDER BY e.first_name`,
      [start_date, end_date]);

    const summary = rows.map(r => ({
      ...r,
      total_minutes: parseFloat(r.total_minutes) || 0,
      shift_count:   parseInt(r.shift_count) || 0,
      hourly_rate:   parseFloat(r.hourly_rate) || 0,
    }));

    res.json(summary);
  } catch (err) {
    console.error('Payroll summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Get detailed time entries for one employee in a date range ────────────────
// Frontend calls: GET /time/employee/:id?start=...&end=...
// This is also handled in time.js but we add it here as an alias
router.get('/employee/:id/entries', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const start_date = req.query.start || req.query.start_date;
    const end_date   = req.query.end   || req.query.end_date;
    let where = 'WHERE tr.employee_id = $1 AND tr.clock_out IS NOT NULL';
    const params = [req.params.id];

    if (start_date) { params.push(start_date); where += ` AND tr.clock_in >= $${params.length}::date`; }
    if (end_date)   { params.push(end_date);   where += ` AND tr.clock_in < ($${params.length}::date + INTERVAL '1 day')`; }

    const { rows } = await req.db.query(
      `SELECT tr.id, tr.clock_in, tr.clock_out,
              CASE
                WHEN tr.duration_minutes IS NOT NULL AND tr.duration_minutes > 0
                  THEN ROUND(tr.duration_minutes / 60.0, 2)
                WHEN tr.clock_out IS NOT NULL
                  THEN ROUND(EXTRACT(EPOCH FROM (tr.clock_out - tr.clock_in)) / 3600.0, 2)
                ELSE 0
              END AS hours_worked,
              tr.job_address, tr.scope_of_work, tr.job_notes
       FROM time_records tr
       ${where}
       ORDER BY tr.clock_in DESC`,
      params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update employee hourly rate ───────────────────────────────────────────────
// Frontend calls: PUT /payroll/rate/:id
router.put('/rate/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { hourly_rate } = req.body;
    if (hourly_rate === undefined || hourly_rate === null) {
      return res.status(400).json({ error: 'hourly_rate is required' });
    }
    // Ensure column exists
    await req.db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate REAL DEFAULT 0`).catch(() => {});
    const { rows } = await req.db.query(
      `UPDATE employees SET hourly_rate = $1 WHERE id = $2 RETURNING id, first_name, last_name, hourly_rate`,
      [parseFloat(hourly_rate), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Keep old route as alias ───────────────────────────────────────────────────
router.put('/employee/:id/rate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { hourly_rate } = req.body;
    await req.db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate REAL DEFAULT 0`).catch(() => {});
    const { rows } = await req.db.query(
      `UPDATE employees SET hourly_rate = $1 WHERE id = $2 RETURNING id, first_name, last_name, hourly_rate`,
      [parseFloat(hourly_rate) || 0, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mark pay period as paid (create a period record) ─────────────────────────
// Frontend calls: POST /payroll/mark-paid
router.post('/mark-paid', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date, summary } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    await req.db.query(`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status TEXT DEFAULT 'paid',
        paid_at TIMESTAMP,
        notes TEXT DEFAULT '',
        total_hours REAL DEFAULT 0,
        total_gross REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});
    await req.db.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_hours REAL DEFAULT 0`).catch(() => {});
    await req.db.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_gross REAL DEFAULT 0`).catch(() => {});

    // Calculate totals from summary
    let totalMinutes = 0;
    let totalGross = 0;
    if (Array.isArray(summary)) {
      summary.forEach(r => {
        totalMinutes += parseFloat(r.total_minutes) || 0;
        const hrs = (parseFloat(r.total_minutes) || 0) / 60;
        totalGross += hrs * (parseFloat(r.hourly_rate) || 0);
      });
    }

    const name = `Pay Period ${start_date} – ${end_date}`;
    const { rows } = await req.db.query(
      `INSERT INTO payroll_periods (name, start_date, end_date, status, paid_at, total_hours, total_gross)
       VALUES ($1, $2, $3, 'paid', NOW(), $4, $5)
       RETURNING *`,
      [name, start_date, end_date, totalMinutes / 60, totalGross]);

    res.status(201).json({ message: 'Pay period marked as paid', period: rows[0] });
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
