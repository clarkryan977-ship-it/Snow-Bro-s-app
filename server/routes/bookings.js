const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Create booking (public)
router.post('/', async (req, res) => {
  try {
    const { client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone } = req.body;
    if (!service_id || !preferred_date) {
      return res.status(400).json({ error: 'Service and preferred date required' });
    }

    const result = await req.db.query('INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [client_id || null, service_id, preferred_date, preferred_time || '', notes || '', client_name || '', client_email || '', client_phone || '']);

    res.status(201).json({ id: result[0].id, message: 'Booking submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all bookings (admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: bookings } = await req.db.query(`SELECT b.*, s.name as service_name,
        COALESCE(c.first_name || ' ' || c.last_name, b.client_name) as display_name,
        COALESCE(c.email, b.client_email) as display_email,
        COALESCE(c.phone, b.client_phone) as display_phone
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC`);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update booking status (admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await req.db.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ message: 'Booking updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my bookings (client)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query(`SELECT b.*, s.name AS service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.client_id = $1 OR b.client_email = (SELECT email FROM clients WHERE id = $2)
      ORDER BY b.preferred_date DESC`, [req.user.id, req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
