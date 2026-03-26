const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Update GPS location (employee)
router.post('/update', authenticateToken, (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    req.db.prepare('INSERT INTO gps_locations (employee_id, latitude, longitude) VALUES (?, ?, ?)').run(
      req.user.id, latitude, longitude
    );
    res.json({ message: 'Location updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest locations for all clocked-in employees (admin)
router.get('/active', authenticateToken, requireAdmin, (req, res) => {
  try {
    const locations = req.db.prepare(`
      SELECT g.*, e.first_name || ' ' || e.last_name as employee_name, e.phone as employee_phone
      FROM gps_locations g
      JOIN employees e ON g.employee_id = e.id
      WHERE g.employee_id IN (
        SELECT employee_id FROM time_records WHERE clock_out IS NULL
      )
      AND g.id IN (
        SELECT MAX(id) FROM gps_locations GROUP BY employee_id
      )
      ORDER BY g.recorded_at DESC
    `).all();
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
