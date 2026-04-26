const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { wrapEmail, BUSINESS } = require('../utils/emailHeader');

// GET all bookings in calendar format (with employee info)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query(`SELECT b.*, s.name AS service_name, s.price AS service_price,
             c.first_name || ' ' || c.last_name AS full_client_name,
             e.first_name || ' ' || e.last_name AS assigned_employee_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      LEFT JOIN employees e ON b.assigned_employee_id = e.id
      ORDER BY b.preferred_date ASC, b.preferred_time ASC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create a new booking from admin calendar
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone, assigned_employee_id, status } = req.body;
    if (!service_id || !preferred_date) {
      return res.status(400).json({ error: 'Service and preferred date required' });
    }
    const result = await req.db.query('INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone, assigned_employee_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id', [client_id || null, service_id, preferred_date, preferred_time || '',
      notes || '', client_name || '', client_email || '', client_phone || '',
      assigned_employee_id || null, status || 'pending']);
    res.status(201).json({ id: result.rows[0].id, message: 'Booking created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT full edit a booking (admin)
router.put('/:id/edit', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone, assigned_employee_id, status } = req.body;
    await req.db.query('UPDATE bookings SET client_id=$1, service_id=$2, preferred_date=$3, preferred_time=$4, notes=$5, client_name=$6, client_email=$7, client_phone=$8, assigned_employee_id=$9, status=$10 WHERE id=$11', [client_id || null, service_id, preferred_date, preferred_time || '',
      notes || '', client_name || '', client_email || '', client_phone || '',
      assigned_employee_id || null, status || 'pending', req.params.id]);
    res.json({ message: 'Booking updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE a booking (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Booking deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT assign employee to booking + send notification
router.put('/:id/assign', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { employee_id } = req.body;
    await req.db.query('UPDATE bookings SET assigned_employee_id = $1 WHERE id = $2', [employee_id, req.params.id]);
    // Get booking info for notification
    const { rows: __booking } = await req.db.query(`SELECT b.*, s.name AS service_name FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id WHERE b.id = $1
    `, [req.params.id]);
    const booking = __booking[0];
    if (employee_id && booking) {
      await req.db.query('INSERT INTO notifications (employee_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)', [employee_id, 'New Job Assigned',
        `You've been assigned: ${booking.service_name || 'Service'} on ${booking.preferred_date} at ${booking.preferred_time || 'TBD'} for ${booking.client_name || 'a client'}.`,
        'job_assigned', req.params.id]);
    }
    res.json({ message: 'Employee assigned and notified' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update booking date/time (drag-and-drop)
router.put('/:id/reschedule', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { preferred_date, preferred_time } = req.body;
    await req.db.query('UPDATE bookings SET preferred_date = $1, preferred_time = $2 WHERE id = $3', [preferred_date, preferred_time || '', req.params.id]);
    res.json({ message: 'Rescheduled' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT mark booking as completed + trigger follow-up
router.put('/:id/complete', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const now = new Date().toISOString();
    await req.db.query('UPDATE bookings SET status = $1, completed_at = $2 WHERE id = $3', ['completed', now, req.params.id]);
    res.json({ message: 'Marked as completed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET employee's assigned jobs for today (route optimization)
router.get('/employee-jobs/:employeeId', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await req.db.query(`
      SELECT b.*, s.name AS service_name,
             c.first_name || ' ' || c.last_name AS full_client_name,
             c.address, c.city, c.state, c.zip, c.phone AS client_phone
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.assigned_employee_id = $1 AND b.preferred_date = $2 AND b.status != 'completed'
      ORDER BY b.preferred_time ASC`, [req.params.employeeId, today]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET my assigned jobs (employee)
router.get('/my-jobs', authenticateToken, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query(`SELECT b.*, s.name AS service_name,
             c.first_name || ' ' || c.last_name AS full_client_name,
             c.address, c.city, c.state, c.zip, c.phone AS client_phone
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.assigned_employee_id = $1 AND b.status != 'completed'
      ORDER BY COALESCE(b.route_order, 9999) ASC, b.preferred_date ASC, b.preferred_time ASC`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST send confirmation email to customer for a booking
router.post('/:id/confirm-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`
      SELECT b.*, s.name AS service_name,
             c.first_name || ' ' || c.last_name AS full_client_name,
             c.email AS client_email_from_record
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = $1`, [req.params.id]);
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const recipientEmail = booking.client_email || booking.client_email_from_record;
    if (!recipientEmail) return res.status(400).json({ error: 'No customer email on this booking' });

    const customerName = booking.client_name || booking.full_client_name || 'Valued Customer';
    const serviceName = booking.service_name || 'Service';
    const dateStr = booking.preferred_date
      ? new Date(booking.preferred_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBD';
    const timeStr = booking.preferred_time || 'To be confirmed';
    const notesStr = booking.notes ? `<p style="color:#374151;"><strong>Notes:</strong> ${booking.notes}</p>` : '';

    const content = `
      <h2 style="color:#1e3a5f;margin:0 0 16px;">Your Job is Confirmed! ✅</h2>
      <p style="color:#374151;">Hi ${customerName},</p>
      <p style="color:#374151;">Great news! Your service has been confirmed. Here are the details:</p>
      <div style="background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:6px;padding:18px 22px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#64748b;font-weight:600;width:120px;">Service</td><td style="padding:6px 0;color:#1e293b;font-weight:700;">${serviceName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-weight:600;">Date</td><td style="padding:6px 0;color:#1e293b;font-weight:700;">${dateStr}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-weight:600;">Time</td><td style="padding:6px 0;color:#1e293b;">${timeStr}</td></tr>
          ${booking.address ? `<tr><td style="padding:6px 0;color:#64748b;font-weight:600;">Address</td><td style="padding:6px 0;color:#1e293b;">${booking.address}${booking.city ? ', ' + booking.city : ''}</td></tr>` : ''}
        </table>
      </div>
      ${notesStr}
      <p style="color:#374151;">Our team will arrive at the scheduled time. If you need to make any changes or have questions, please contact us:</p>
      <p style="color:#374151;"><strong>Phone:</strong> ${BUSINESS.phone}<br><strong>Email:</strong> ${BUSINESS.email}</p>
    `;

    const html = wrapEmail(content, `Confirmation — ${serviceName}`, true);
    const info = await sendMail({
      to: recipientEmail,
      subject: `Your ${serviceName} is Confirmed — Snow Bro's`,
      html
    });

    // Update booking status to confirmed if not already
    await req.db.query("UPDATE bookings SET status = 'confirmed' WHERE id = $1 AND status = 'pending'", [req.params.id]);

    res.json({ success: true, messageId: info.messageId, sentTo: recipientEmail });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
