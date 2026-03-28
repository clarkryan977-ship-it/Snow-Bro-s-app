const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Update GPS location (employee)
router.post('/update', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    await req.db.query('INSERT INTO gps_locations (employee_id, latitude, longitude) VALUES ($1, $2, $3)', [req.user.id, latitude, longitude]);
    res.json({ message: 'Location updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest locations for all clocked-in employees (admin)
router.get('/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: locations } = await req.db.query(`SELECT g.*, e.first_name || ' ' || e.last_name as employee_name, e.phone as employee_phone
      FROM gps_locations g
      JOIN employees e ON g.employee_id = e.id
      WHERE g.employee_id IN (
        SELECT employee_id FROM time_records WHERE clock_out IS NULL
      )
      AND g.id IN (
        SELECT MAX(id) FROM gps_locations GROUP BY employee_id
      )
      ORDER BY g.recorded_at DESC`);
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
