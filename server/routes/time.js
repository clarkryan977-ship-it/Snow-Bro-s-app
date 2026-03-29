const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── Clock In ──────────────────────────────────────────────────────────────────
router.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    const empId = req.user.id;
    const { rows: active } = await req.db.query(
      'SELECT id FROM time_records WHERE employee_id = $1 AND clock_out IS NULL', [empId]);
    if (active[0]) return res.status(400).json({ error: 'Already clocked in' });

    const { job_address = '', job_contact = '', scope_of_work = '', job_notes = '' } = req.body;
    const { rows: result } = await req.db.query(
      `INSERT INTO time_records (employee_id, clock_in, job_address, job_contact, scope_of_work, job_notes)
       VALUES ($1, NOW(), $2, $3, $4, $5) RETURNING *`,
      [empId, job_address, job_contact, scope_of_work, job_notes]);

    res.json({ record: result[0], message: 'Clocked in successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Clock Out ─────────────────────────────────────────────────────────────────
router.post('/clock-out', authenticateToken, async (req, res) => {
  try {
    const empId = req.user.id;
    const { rows: active } = await req.db.query(
      'SELECT id FROM time_records WHERE employee_id = $1 AND clock_out IS NULL', [empId]);
    if (!active[0]) return res.status(400).json({ error: 'Not currently clocked in' });

    const { rows: result } = await req.db.query(
      `UPDATE time_records
       SET clock_out = NOW(),
           duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - clock_in)) / 60.0, 2)
       WHERE id = $1 RETURNING *`,
      [active[0].id]);

    res.json({ record: result[0], message: 'Clocked out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get current clock-in status ───────────────────────────────────────────────
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { rows: active } = await req.db.query(
      `SELECT id, clock_in, job_address, job_contact, scope_of_work, job_notes
       FROM time_records WHERE employee_id = $1 AND clock_out IS NULL`, [req.user.id]);
    res.json({ clocked_in: !!active[0], record: active[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update active record job details ─────────────────────────────────────────
router.put('/current', authenticateToken, async (req, res) => {
  try {
    const { rows: active } = await req.db.query(
      'SELECT id FROM time_records WHERE employee_id = $1 AND clock_out IS NULL', [req.user.id]);
    if (!active[0]) return res.status(400).json({ error: 'Not currently clocked in' });

    const { job_address = '', job_contact = '', scope_of_work = '', job_notes = '' } = req.body;
    await req.db.query(
      `UPDATE time_records SET job_address=$1, job_contact=$2, scope_of_work=$3, job_notes=$4 WHERE id=$5`,
      [job_address, job_contact, scope_of_work, job_notes, active[0].id]);

    res.json({ message: 'Job details updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get my time records (employee) ────────────────────────────────────────────
router.get('/my-records', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { rows } = await req.db.query(
      `SELECT id, clock_in, clock_out,
              ROUND(duration_minutes / 60.0, 2) AS hours_worked,
              duration_minutes,
              job_address, job_contact, scope_of_work, job_notes, created_at
       FROM time_records
       WHERE employee_id = $1
       ORDER BY clock_in DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: get all time records ───────────────────────────────────────────────
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { employee_id, start_date, end_date, limit = 200, offset = 0 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (employee_id) { params.push(employee_id); where += ` AND tr.employee_id = $${params.length}`; }
    if (start_date)  { params.push(start_date);   where += ` AND tr.clock_in >= $${params.length}::date`; }
    if (end_date)    { params.push(end_date);      where += ` AND tr.clock_in < ($${params.length}::date + INTERVAL '1 day')`; }

    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const { rows } = await req.db.query(
      `SELECT tr.id, tr.employee_id,
              e.first_name || ' ' || e.last_name AS employee_name,
              e.email AS employee_email,
              tr.clock_in, tr.clock_out,
              ROUND(tr.duration_minutes / 60.0, 2) AS hours_worked,
              tr.duration_minutes,
              tr.job_address, tr.job_contact, tr.scope_of_work, tr.job_notes,
              tr.created_at
       FROM time_records tr
       JOIN employees e ON tr.employee_id = e.id
       ${where}
       ORDER BY tr.clock_in DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: get summary by employee (for payroll) ──────────────────────────────
router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = 'WHERE tr.clock_out IS NOT NULL';
    const params = [];

    if (start_date) { params.push(start_date); where += ` AND tr.clock_in >= $${params.length}::date`; }
    if (end_date)   { params.push(end_date);   where += ` AND tr.clock_in < ($${params.length}::date + INTERVAL '1 day')`; }

    const { rows } = await req.db.query(
      `SELECT e.id AS employee_id,
              e.first_name || ' ' || e.last_name AS employee_name,
              e.email,
              COUNT(tr.id) AS total_shifts,
              ROUND(SUM(tr.duration_minutes) / 60.0, 2) AS total_hours,
              COALESCE(e.hourly_rate, 0) AS hourly_rate
       FROM employees e
       LEFT JOIN time_records tr ON tr.employee_id = e.id ${where}
       WHERE e.active IS NOT FALSE
       GROUP BY e.id, e.first_name, e.last_name, e.email, e.hourly_rate
       ORDER BY e.first_name`,
      params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: update a time record ───────────────────────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { clock_in, clock_out, job_address, job_contact, scope_of_work, job_notes } = req.body;
    const { rows } = await req.db.query(
      `UPDATE time_records
       SET clock_in = COALESCE($1, clock_in),
           clock_out = $2,
           duration_minutes = CASE
             WHEN $2 IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM ($2::timestamp - COALESCE($1, clock_in)::timestamp)) / 60.0, 2)
             ELSE duration_minutes
           END,
           job_address = COALESCE($3, job_address),
           job_contact = COALESCE($4, job_contact),
           scope_of_work = COALESCE($5, scope_of_work),
           job_notes = COALESCE($6, job_notes)
       WHERE id = $7 RETURNING *`,
      [clock_in || null, clock_out || null, job_address, job_contact, scope_of_work, job_notes, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: delete a time record ───────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM time_records WHERE id = $1', [req.params.id]);
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
