const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Clock in — optionally pre-fill job site fields
router.post('/clock-in', authenticateToken, (req, res) => {
  try {
    const empId = req.user.id;
    const active = req.db.prepare(
      'SELECT id FROM time_records WHERE employee_id = ? AND clock_out IS NULL'
    ).get(empId);
    if (active) return res.status(400).json({ error: 'Already clocked in' });

    const { job_address = '', job_contact = '', scope_of_work = '', job_notes = '' } = req.body;

    const result = req.db.prepare(
      `INSERT INTO time_records
         (employee_id, clock_in, job_address, job_contact, scope_of_work, job_notes)
       VALUES (?, datetime('now'), ?, ?, ?, ?)`
    ).run(empId, job_address, job_contact, scope_of_work, job_notes);

    res.json({ id: result.lastInsertRowid, message: 'Clocked in successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clock out
router.post('/clock-out', authenticateToken, (req, res) => {
  try {
    const empId = req.user.id;
    const active = req.db.prepare(
      'SELECT id FROM time_records WHERE employee_id = ? AND clock_out IS NULL'
    ).get(empId);
    if (!active) return res.status(400).json({ error: 'Not currently clocked in' });

    req.db.prepare(`
      UPDATE time_records
      SET clock_out = datetime('now'),
          duration_minutes = ROUND((julianday(datetime('now')) - julianday(clock_in)) * 1440, 2)
      WHERE id = ?
    `).run(active.id);

    res.json({ message: 'Clocked out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update job site fields for the active (open) record
router.put('/current', authenticateToken, (req, res) => {
  try {
    const empId = req.user.id;
    const active = req.db.prepare(
      'SELECT id FROM time_records WHERE employee_id = ? AND clock_out IS NULL'
    ).get(empId);
    if (!active) return res.status(400).json({ error: 'Not currently clocked in' });

    const { job_address = '', job_contact = '', scope_of_work = '', job_notes = '' } = req.body;
    req.db.prepare(
      `UPDATE time_records
       SET job_address=?, job_contact=?, scope_of_work=?, job_notes=?
       WHERE id=?`
    ).run(job_address, job_contact, scope_of_work, job_notes, active.id);

    res.json({ message: 'Job site details updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update job site fields for any record by id (employee can edit their own past records)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const empId = req.user.id;
    const record = req.db.prepare(
      'SELECT id, employee_id FROM time_records WHERE id = ?'
    ).get(req.params.id);

    if (!record) return res.status(404).json({ error: 'Record not found' });
    // Employees can only edit their own; admins can edit any
    if (req.user.role !== 'admin' && record.employee_id !== empId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { job_address = '', job_contact = '', scope_of_work = '', job_notes = '' } = req.body;
    req.db.prepare(
      `UPDATE time_records
       SET job_address=?, job_contact=?, scope_of_work=?, job_notes=?
       WHERE id=?`
    ).run(job_address, job_contact, scope_of_work, job_notes, record.id);

    res.json({ message: 'Job site details updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current clock-in status
router.get('/status', authenticateToken, (req, res) => {
  try {
    const active = req.db.prepare(
      `SELECT id, clock_in, job_address, job_contact, scope_of_work, job_notes
       FROM time_records WHERE employee_id = ? AND clock_out IS NULL`
    ).get(req.user.id);
    res.json({ clocked_in: !!active, record: active || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get time records for the logged-in employee
router.get('/my-records', authenticateToken, (req, res) => {
  try {
    const records = req.db.prepare(
      `SELECT id, clock_in, clock_out, duration_minutes,
              job_address, job_contact, scope_of_work, job_notes, created_at
       FROM time_records WHERE employee_id = ? ORDER BY clock_in DESC LIMIT 100`
    ).all(req.user.id);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all time records (admin)
router.get('/all', authenticateToken, requireAdmin, (req, res) => {
  try {
    const records = req.db.prepare(
      `SELECT tr.id, tr.clock_in, tr.clock_out, tr.duration_minutes,
              tr.job_address, tr.job_contact, tr.scope_of_work, tr.job_notes, tr.created_at,
              e.first_name || ' ' || e.last_name AS employee_name,
              e.id AS employee_id
       FROM time_records tr
       JOIN employees e ON tr.employee_id = e.id
       ORDER BY tr.clock_in DESC
       LIMIT 200`
    ).all();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
