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
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
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
router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get all active employees with their hours in the period
    const { rows: employees } = await req.db.query(
      `SELECT e.id, e.first_name, e.last_name, e.email, e.phone,
              COALESCE(e.hourly_rate, 0) AS hourly_rate,
              COUNT(tr.id) AS total_shifts,
              COALESCE(ROUND(SUM(tr.duration_minutes) / 60.0, 2), 0) AS total_hours
       FROM employees e
       LEFT JOIN time_records tr
         ON tr.employee_id = e.id
         AND tr.clock_out IS NOT NULL
         AND tr.clock_in >= $1::date
         AND tr.clock_in < ($2::date + INTERVAL '1 day')
       WHERE e.active = 1
       GROUP BY e.id, e.first_name, e.last_name, e.email, e.phone, e.hourly_rate
       ORDER BY e.first_name`,
      [start_date, end_date]);

    const summary = employees.map(emp => ({
      ...emp,
      total_hours: parseFloat(emp.total_hours) || 0,
      hourly_rate: parseFloat(emp.hourly_rate) || 0,
      gross_pay: Math.round(parseFloat(emp.total_hours || 0) * parseFloat(emp.hourly_rate || 0) * 100) / 100,
    }));

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get detailed time entries for one employee in a date range ────────────────
router.get('/employee/:id/entries', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = 'WHERE tr.employee_id = $1 AND tr.clock_out IS NOT NULL';
    const params = [req.params.id];

    if (start_date) { params.push(start_date); where += ` AND tr.clock_in >= $${params.length}::date`; }
    if (end_date)   { params.push(end_date);   where += ` AND tr.clock_in < ($${params.length}::date + INTERVAL '1 day')`; }

    const { rows } = await req.db.query(
      `SELECT tr.id, tr.clock_in, tr.clock_out,
              ROUND(tr.duration_minutes / 60.0, 2) AS hours_worked,
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
router.put('/employee/:id/rate', authenticateToken, requireAdmin, async (req, res) => {
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

module.exports = router;
