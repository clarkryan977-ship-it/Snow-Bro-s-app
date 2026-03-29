const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
let sendAdminPush;
try { sendAdminPush = require('./push').sendAdminPush; } catch(e) { sendAdminPush = null; }
const { sendMail } = require('../utils/mailer');

const BASE_URL = process.env.BASE_URL || 'https://snowbros-production.up.railway.app';

// ── Create booking (public — no auth required) ────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone } = req.body;
    if (!service_id || !preferred_date) {
      return res.status(400).json({ error: 'Service and preferred date required' });
    }
    const result = await req.db.query(
      'INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [client_id || null, service_id, preferred_date, preferred_time || '', notes || '', client_name || '', client_email || '', client_phone || '']
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Booking submitted successfully' });
    // Fire-and-forget: push notification + email to admin
    const name = client_name || client_email || 'A client';
    try {
      if (sendAdminPush) {
        sendAdminPush(req.db, {
          title: 'New Booking!',
          body: `${name} booked a service for ${preferred_date || 'upcoming'}`,
          url: '/admin/bookings',
          tag: 'new-booking-' + result.rows[0].id,
        });
      }
      sendMail({
        to: 'clarkryan977@gmail.com',
        subject: `New Booking from ${name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1e3a5f;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;font-size:1.2rem;">❄️ Snow Bro's — New Booking Request</h2>
            </div>
            <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
              <p><strong>${name}</strong> submitted a new booking for <strong>${preferred_date || 'upcoming'}</strong>.</p>
              <p>Email: ${client_email || '—'} | Phone: ${client_phone || '—'}</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${BASE_URL}/admin/bookings" style="background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;">View in Admin Panel</a>
              </div>
            </div>
          </div>`,
      }).catch(() => {});
    } catch(e) { /* non-critical */ }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create booking (authenticated client) ─────────────────────────────────────
router.post('/client', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });
    const { service_id, preferred_date, preferred_time, notes, address, city, state, zip } = req.body;
    if (!service_id || !preferred_date) {
      return res.status(400).json({ error: 'Service and preferred date required' });
    }
    // Get client info
    const { rows: clients } = await req.db.query('SELECT * FROM clients WHERE id = $1', [req.user.id]);
    const client = clients[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const result = await req.db.query(
      `INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone, address, city, state, zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        req.user.id, service_id, preferred_date, preferred_time || '', notes || '',
        `${client.first_name} ${client.last_name}`, client.email, client.phone || '',
        address || client.address || '', city || client.city || '',
        state || client.state || '', zip || client.zip || ''
      ]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Booking submitted successfully' });

    // Notify admin
    const name = `${client.first_name} ${client.last_name}`;
    try {
      if (sendAdminPush) {
        sendAdminPush(req.db, {
          title: 'New Client Booking!',
          body: `${name} booked a service for ${preferred_date}`,
          url: '/admin/bookings',
          tag: 'new-booking-' + result.rows[0].id,
        });
      }
      sendMail({
        to: 'clarkryan977@gmail.com',
        subject: `New Booking from ${name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1e3a5f;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;font-size:1.2rem;">❄️ Snow Bro's — New Client Booking</h2>
            </div>
            <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
              <p><strong>${name}</strong> (registered client) submitted a new booking for <strong>${preferred_date}</strong>.</p>
              <p>Email: ${client.email} | Phone: ${client.phone || '—'}</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${BASE_URL}/admin/bookings" style="background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;">Review in Admin Panel</a>
              </div>
            </div>
          </div>`,
      }).catch(() => {});
    } catch(e) { /* non-critical */ }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get all bookings (admin) ──────────────────────────────────────────────────
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

// ── Save route order for bookings (admin) ─────────────────────────────────────
router.patch('/route-order', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { orders } = req.body;
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

// ── Update booking address fields (admin) ─────────────────────────────────────
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

// ── Update booking status (admin) ─────────────────────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await req.db.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ message: 'Booking updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Send confirmation email when admin accepts a booking ──────────────────────
router.post('/:id/confirm-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: bkRows } = await req.db.query(`
      SELECT b.*, s.name as service_name,
             COALESCE(c.first_name || ' ' || c.last_name, b.client_name) as display_name,
             COALESCE(c.email, b.client_email) as display_email,
             COALESCE(c.first_name, b.client_name) as first_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = $1`, [req.params.id]);
    const booking = bkRows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const clientEmail = booking.display_email;
    if (!clientEmail || clientEmail.includes('@snowbros.placeholder')) {
      return res.json({ message: 'No client email — skipped' });
    }

    const firstName = booking.first_name || 'there';
    const serviceName = booking.service_name || 'service';
    const preferredDate = booking.preferred_date;
    const preferredTime = booking.preferred_time ? ` at ${booking.preferred_time}` : '';

    await sendMail({
      to: clientEmail,
      subject: `Your Snow Bro's Booking is Confirmed! 🎉`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1e3a5f;color:#fff;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:1.4rem;">❄️ Snow Bro's Lawn Care &amp; Snow Removal</h1>
            <p style="margin:4px 0 0;font-size:.85rem;opacity:.85;">1812 33rd St S, Moorhead, MN 56560 · 218-331-5145</p>
          </div>
          <div style="background:#f9fafb;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
            <h2 style="margin:0 0 16px;color:#15803d;">✅ Booking Confirmed!</h2>
            <p style="color:#374151;">Hi ${firstName},</p>
            <p style="color:#374151;">Great news! Your booking has been confirmed. Here are the details:</p>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;width:120px;">Service</td><td style="padding:8px 0;color:#111827;font-weight:700;">${serviceName}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Date</td><td style="padding:8px 0;color:#111827;font-weight:700;">${preferredDate}${preferredTime}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Status</td><td style="padding:8px 0;"><span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;">✅ Confirmed</span></td></tr>
              </table>
            </div>
            <p style="color:#374151;">Our team will arrive at the scheduled time. If you have any questions or need to make changes, please contact us:</p>
            <p style="color:#374151;"><strong>📞 Phone:</strong> 218-331-5145</p>
            <p style="color:#374151;"><strong>📧 Email:</strong> clarkryan977@gmail.com</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${BASE_URL}/client" style="background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:1rem;">View Your Portal</a>
            </div>
            <p style="color:#6b7280;font-size:.85rem;">Thank you for choosing Snow Bro's!</p>
          </div>
        </div>`,
    });
    res.json({ message: 'Confirmation email sent to ' + clientEmail });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mark booking as completed (employee or admin) ─────────────────────────────
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

// ── Get my bookings (authenticated client) ────────────────────────────────────
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT b.*, s.name AS service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.client_id = $1 OR b.client_email = (SELECT email FROM clients WHERE id = $2)
      ORDER BY b.preferred_date DESC`, [req.user.id, req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
