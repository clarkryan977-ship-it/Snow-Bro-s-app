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
