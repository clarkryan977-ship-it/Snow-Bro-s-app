const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

// ─── PUBLIC: Submit a one-time booking request (no auth required) ───
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, address, city, state, zip, service_type, preferred_date, notes } = req.body;
    if (!name || !email || !service_type) {
      return res.status(400).json({ error: 'Name, email, and service type are required' });
    }

    const { rows } = await req.db.query(
      `INSERT INTO booking_requests (name, email, phone, address, city, state, zip, service_type, preferred_date, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new') RETURNING id, created_at`,
      [name.trim(), email.trim().toLowerCase(), phone || '', address || '', city || '', state || '', zip || '',
       service_type, preferred_date || '', notes || '']
    );
    const req_id = rows[0].id;

    // Notify admin via email
    try {
      await sendEmail({
        to: 'prosnowbros@prosnowbros.com',
        subject: `🆕 New Booking Request #${req_id} — ${service_type}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#fff;margin:0;font-size:20px">❄️ New Booking Request</h2>
            </div>
            <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:6px 0;color:#64748b;width:130px">Request #</td><td style="padding:6px 0;font-weight:600">${req_id}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Name</td><td style="padding:6px 0;font-weight:600">${name}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0">${email}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Phone</td><td style="padding:6px 0">${phone || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Service</td><td style="padding:6px 0;font-weight:700;color:#1e3a5f">${service_type}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Preferred Date</td><td style="padding:6px 0">${preferred_date || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Address</td><td style="padding:6px 0">${[address, city, state, zip].filter(Boolean).join(', ') || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Notes</td><td style="padding:6px 0">${notes || '—'}</td></tr>
              </table>
              <div style="margin-top:20px;padding:12px;background:#fff3cd;border-radius:6px;font-size:13px;color:#856404">
                ⚡ Reply to this customer promptly — they may be checking multiple services.
              </div>
            </div>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error('Admin notify email failed:', mailErr.message);
    }

    // Auto-reply to customer
    try {
      await sendEmail({
        to: email,
        subject: 'We received your Snow Bro\'s service request!',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:#fff;margin:0">❄️ Snow Bro's</h2>
            </div>
            <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
              <p style="font-size:16px;margin:0 0 12px">Hi <strong>${name.split(' ')[0]}</strong>,</p>
              <p style="font-size:14px;color:#374151;margin:0 0 12px">
                Thanks for reaching out! We've received your request for <strong>${service_type}</strong>
                ${preferred_date ? ` on <strong>${preferred_date}</strong>` : ''} and will be in touch shortly to confirm.
              </p>
              <p style="font-size:14px;color:#374151;margin:0 0 20px">
                If you need to reach us urgently, you can also text or call us directly.
              </p>
              <p style="font-size:13px;color:#64748b;margin:0">— The Snow Bro's Team</p>
            </div>
          </div>
        `,
      });
    } catch (_) { /* non-critical */ }

    res.status(201).json({ success: true, id: req_id, message: 'Request received! We\'ll be in touch soon.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN: List all booking requests ───────────────────────────
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT * FROM booking_requests`;
    const params = [];
    if (status) { sql += ` WHERE status = $1`; params.push(status); }
    sql += ` ORDER BY created_at DESC`;
    const { rows } = await req.db.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN: Update status of a booking request ──────────────────
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'contacted', 'confirmed', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await req.db.query(`UPDATE booking_requests SET status = $1 WHERE id = $2`, [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN: Delete a booking request ────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query(`DELETE FROM booking_requests WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Request deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
