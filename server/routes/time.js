const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Clock in — optionally pre-fill job site fields
router.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    const empId = req.user.id;
    const { rows: __active } = await req.db.query('SELECT id FROM time_records WHERE employee_id = $1 AND clock_out IS NULL', [empId]);
    const active = __active[0];
    if (active) return res.status(400).json({ error: 'Already clocked in' });

    const { job_address = '', job_contact = '', scope_of_work = '', job_notes = '' } = req.body;

    const { rows: result } = await req.db.query(`INSERT INTO time_records
         (employee_id, clock_in, job_address, job_contact, scope_of_work, job_notes)
       VALUES ($1, NOW(), $2, $3, $4, $5) RETURNING id`,
      [empId, job_address, job_contact, scope_of_work, job_notes]);

    res.json({ id: result.rows[0].id, message: 'Clocked in successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clock out
router.post('/clock-out', authenticateToken, async (req, res) => {
  try {
    const empId = req.user.id;
    const { rows: __active } = await req.db.query('SELECT id FROM time_records WHERE employee_id = $6 AND clock_out IS NULL', [empId]);
    const active = __active[0];
    if (!active) return res.status(400).json({ error: 'Not currently clocked in' });

    await req.db.query(`UPDATE time_records
      SET clock_out = NOW(),
          duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - clock_in)) / 60.0, 2)
      WHERE id = $7`, [active.id]);

    res.json({ message: 'Clocked out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update job site fields for the active (open) record
router.put('/current', authenticateToken, async (req, res) => {
  try {
    const empId = req.user.id;
    const { rows: __active } = await req.db.query('SELECT id FROM time_records WHERE employee_id = $8 AND clock_out IS NULL', [empId]);
    const active = __active[0];
    if (!active) return res.status(400).json({ error: 'Not currently clocked in' });

    const { job_address = '', job_contact = '', scope_of_work = '', job_notes = '' } = req.body;
    await req.db.query(`UPDATE time_records
       SET job_address=$9, job_contact=$10, scope_of_work=$11, job_notes=$12
       WHERE id=$13`, [job_address, job_contact, scope_of_work, job_notes, active.id]);

    res.json({ message: 'Job site details updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update job site fields for any record by id (employee can edit their own past records)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const empId = req.user.id;
    const { rows: __record } = await req.db.query('SELECT id, employee_id FROM time_records WHERE id = $14', [req.params.id]);
    const record = __record[0];

    if (!record) return res.status(404).json({ error: 'Record not found' });
    // Employees can only edit their own; admins can edit any
    if (req.user.role !== 'admin' && record.employee_id !== empId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { job_address = '', job_contact = '', scope_of_work = '', job_notes = '' } = req.body;
    await req.db.query(`UPDATE time_records
       SET job_address=$15, job_contact=$16, scope_of_work=$17, job_notes=$18
       WHERE id=$19`, [job_address, job_contact, scope_of_work, job_notes, record.id]);

    res.json({ message: 'Job site details updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current clock-in status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { rows: __active } = await req.db.query(`SELECT id, clock_in, job_address, job_contact, scope_of_work, job_notes
       FROM time_records WHERE employee_id = $20 AND clock_out IS NULL`, [req.user.id]);
    const active = __active[0];
    res.json({ clocked_in: !!active, record: active || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get time records for the logged-in employee
router.get('/my-records', authenticateToken, async (req, res) => {
  try {
    
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
