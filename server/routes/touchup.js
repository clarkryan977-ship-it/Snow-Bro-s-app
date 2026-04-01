const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');
const { wrapEmail } = require('../utils/emailHeader');

// ── Submit a touch-up request (client portal) ────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { note } = req.body;
    const clientId = req.user.clientId || req.user.id;

    // Get client info
    const { rows: clientRows } = await req.db.query(
      `SELECT first_name, last_name, email, phone, address, city, state, zip FROM clients WHERE id = $1`,
      [clientId]
    );
    if (!clientRows[0]) return res.status(404).json({ error: 'Client not found' });
    const c = clientRows[0];
    const clientName = `${c.first_name} ${c.last_name}`;
    const clientAddress = [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ');

    const { rows } = await req.db.query(
      `INSERT INTO touch_up_requests (client_id, client_name, client_address, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [clientId, clientName, clientAddress, note || '']
    );

    // Notify admin via email
    try {
      const { rows: adminRows } = await req.db.query(
        `SELECT email FROM employees WHERE role='admin' LIMIT 1`
      );
      if (adminRows[0]) {
        const body = wrapEmail(`
          <h2 style="color:#1e40af;">⚠️ Touch-Up Request</h2>
          <p>A client has requested a touch-up service.</p>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Client</td><td style="padding:8px">${clientName}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Address</td><td style="padding:8px">${clientAddress || 'Not on file'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Phone</td><td style="padding:8px">${c.phone || 'Not on file'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Email</td><td style="padding:8px">${c.email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Note</td><td style="padding:8px">${note || '(no note provided)'}</td></tr>
          </table>
          <p style="margin-top:16px"><a href="https://snowbros-production.up.railway.app/admin" style="background:#1e40af;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">View in Admin Panel</a></p>
        `);
        await sendEmail({
          to: adminRows[0].email,
          subject: `Touch-Up Request from ${clientName}`,
          html: body,
        });
      }
    } catch (emailErr) {
      console.warn('Touch-up email notification failed:', emailErr.message);
    }

    res.status(201).json({ message: 'Touch-up request submitted', request: rows[0] });
  } catch (err) {
    console.error('Touch-up submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Get all touch-up requests (admin) ────────────────────────────────────────
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `SELECT t.*, c.phone, c.email as client_email
       FROM touch_up_requests t
       LEFT JOIN clients c ON c.id = t.client_id
       ORDER BY t.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update touch-up request status (admin) ───────────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const { rows } = await req.db.query(
      `UPDATE touch_up_requests
       SET status = COALESCE($1, status),
           admin_notes = COALESCE($2, admin_notes),
           updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, admin_notes, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete touch-up request (admin) ──────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM touch_up_requests WHERE id = $1', [req.params.id]);
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get touch-up requests for a specific client ───────────────────────────────
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.clientId || req.user.id;
    const { rows } = await req.db.query(
      `SELECT * FROM touch_up_requests WHERE client_id = $1 ORDER BY created_at DESC`,
      [clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
