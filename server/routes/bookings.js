const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
let sendAdminPush;
try { sendAdminPush = require('./push').sendAdminPush; } catch(e) { sendAdminPush = null; }
const { sendMail } = require('../utils/mailer');

// Create booking (public)
router.post('/', async (req, res) => {
  try {
    const { client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone } = req.body;
    if (!service_id || !preferred_date) {
      return res.status(400).json({ error: 'Service and preferred date required' });
    }

    const result = await req.db.query('INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [client_id || null, service_id, preferred_date, preferred_time || '', notes || '', client_name || '', client_email || '', client_phone || '']);

    res.status(201).json({ id: result.rows[0].id, message: 'Booking submitted successfully' });

    // Fire-and-forget: push notification + email to admin
    const name = client_name || client_email || 'A client';
    try {
      if (sendAdminPush) {
        sendAdminPush(req.db, {
          title: 'New Booking!',
          body: name + ' booked a service for ' + (preferred_date || 'upcoming'),
          url: '/admin/bookings',
          tag: 'new-booking-' + result.rows[0].id,
        });
      }
      sendMail({
        to: 'clarkryan977@gmail.com',
        subject: 'New Booking from ' + name,
        html: '<p><strong>' + name + '</strong> submitted a new booking for <strong>' + (preferred_date || 'upcoming') + '</strong>.</p><p><a href="https://snowbros-production.up.railway.app/admin/bookings">View in Admin Panel</a></p>',
      }).catch(() => {});
    } catch(e) { /* non-critical */ }
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
        COALESCE(c.phone, b.client_phone) as display_phone,
        COALESCE(b.address, c.address, '') as job_address,
        COALESCE(b.city, c.city, '') as job_city,
        COALESCE(b.state, c.state, '') as job_state,
        COALESCE(b.zip, c.zip, '') as job_zip,
        COALESCE(b.route_order, 9999) as route_order
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC`);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save route order for bookings (admin) — accepts array of {id, route_order}
router.patch('/route-order', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { orders } = req.body; // [{id: 1, route_order: 1}, {id: 2, route_order: 2}, ...]
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'orders array required' });
    }
    for (const { id, route_order } of orders) {
      await req.db.query('UPDATE bookings SET route_order = $1 WHERE id = $2', [route_order, id]);
    }
    res.json({ message: 'Route order saved', count: orders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update booking address fields (admin)
router.patch('/:id/address', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { address, city, state, zip } = req.body;
    await req.db.query(
      'UPDATE bookings SET address = $1, city = $2, state = $3, zip = $4 WHERE id = $5',
      [address || '', city || '', state || '', zip || '', req.params.id]
    );
    res.json({ message: 'Address updated' });
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

// Mark booking as completed (employee or admin)
router.patch('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const completedAt = new Date().toISOString();
    const { rowCount } = await req.db.query(
      `UPDATE bookings SET status = 'completed', completed_at = $1 WHERE id = $2`,
      [completedAt, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ message: 'Job marked as completed', completed_at: completedAt });
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
