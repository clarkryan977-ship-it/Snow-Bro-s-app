const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Create booking (public)
router.post('/', (req, res) => {
  try {
    const { client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone } = req.body;
    if (!service_id || !preferred_date) {
      return res.status(400).json({ error: 'Service and preferred date required' });
    }

    const result = req.db.prepare(
      'INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(client_id || null, service_id, preferred_date, preferred_time || '', notes || '', client_name || '', client_email || '', client_phone || '');

    res.status(201).json({ id: result.lastInsertRowid, message: 'Booking submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all bookings (admin)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const bookings = req.db.prepare(`
      SELECT b.*, s.name as service_name,
        COALESCE(c.first_name || ' ' || c.last_name, b.client_name) as display_name,
        COALESCE(c.email, b.client_email) as display_email,
        COALESCE(c.phone, b.client_phone) as display_phone
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC
    `).all();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update booking status (admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    req.db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Booking updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my bookings (client)
router.get('/my', authenticateToken, (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT b.*, s.name AS service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.client_id = ? OR b.client_email = (SELECT email FROM clients WHERE id = ?)
      ORDER BY b.preferred_date DESC
    `).all(req.user.id, req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
