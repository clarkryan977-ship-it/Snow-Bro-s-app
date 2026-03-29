const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all clients (admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: clients } = await req.db.query(
      'SELECT id, first_name, last_name, email, phone, address, city, state, zip, notes, created_at, active, latitude, longitude, service_type, (password_hash IS NOT NULL) AS has_password FROM clients ORDER BY last_name, first_name'
    );
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single client
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { rows: __client } = await req.db.query(
      'SELECT id, first_name, last_name, email, phone, address, city, state, zip, notes, created_at, active, latitude, longitude, service_type FROM clients WHERE id = $1',
      [req.params.id]
    );
    const client = __client[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add client (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, notes, password } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email required' });
    }
    const password_hash = password ? bcrypt.hashSync(password, 10) : null;
    const result = await req.db.query(
      'INSERT INTO clients (first_name, last_name, email, phone, address, city, state, zip, notes, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
      [first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', notes || '', password_hash]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Client added' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update client (admin) — full update
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, notes, active, service_type } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'first_name, last_name, and email are required' });
    }
    const activeVal = (active === false || active === 0 || active === '0') ? 0 : 1;
    await req.db.query(
      'UPDATE clients SET first_name=$1, last_name=$2, email=$3, phone=$4, address=$5, city=$6, state=$7, zip=$8, notes=$9, active=$10, service_type=$11 WHERE id=$12',
      [first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', notes || '', activeVal, service_type || 'residential', req.params.id]
    );
    res.json({ message: 'Client updated' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH active flag only — used by the admin toggle button
router.patch('/:id/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { active } = req.body;
    if (active === undefined) return res.status(400).json({ error: 'active field required' });
    const activeVal = (active === false || active === 0 || active === '0') ? 0 : 1;
    await req.db.query('UPDATE clients SET active=$1 WHERE id=$2', [activeVal, req.params.id]);
    res.json({ message: 'Client active status updated', active: activeVal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH email only — used by the inline email editor
router.patch('/:id/email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    await req.db.query('UPDATE clients SET email=$1 WHERE id=$2', [email.trim().toLowerCase(), req.params.id]);
    res.json({ message: 'Email updated' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already in use by another client' });
    res.status(500).json({ error: err.message });
  }
});

// POST send portal invite — generates magic-link token, emails the client
router.post('/:id/invite', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __client } = await req.db.query(
      'SELECT id, first_name, last_name, email FROM clients WHERE id = $1',
      [req.params.id]
    );
    const client = __client[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });

    // Block invites to placeholder emails
    if (client.email.endsWith('@snowbros.placeholder')) {
      return res.status(400).json({ error: 'Cannot send invite to a placeholder email. Update the client\'s real email first.' });
    }

    // Invalidate any previous unused invite tokens for this client
    await req.db.query(
      "UPDATE password_reset_tokens SET used=1 WHERE client_id=$1 AND used=0",
      [client.id]
    );

    // Generate a new token valid for 7 days
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await req.db.query(
      'INSERT INTO password_reset_tokens (client_id, token, expires_at) VALUES ($1, $2, $3)',
      [client.id, token, expiresAt]
    );

    const BASE_URL = process.env.BASE_URL || 'https://snowbros-production.up.railway.app';
    const inviteLink = `${BASE_URL}/portal-setup/${token}`;

    const { sendMail } = require('../utils/mailer');
    await sendMail({
      to: client.email,
      subject: "You're invited to the Snow Bro's Client Portal",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#0f2557 0%,#1d4ed8 100%);color:#fff;padding:28px 32px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:1.5rem;">❄️ Snow Bro's Lawn Care &amp; Snow Removal</h1>
            <p style="margin:6px 0 0;font-size:.85rem;opacity:.85;">1812 33rd St S, Moorhead, MN 56560 · 218-331-5145</p>
          </div>
          <div style="background:#f9fafb;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
            <h2 style="margin:0 0 12px;color:#111827;">Hi ${client.first_name},</h2>
            <p style="color:#374151;font-size:1rem;">You've been invited to access your <strong>Snow Bro's Client Portal</strong> — your personal dashboard to view invoices, contracts, service history, and more.</p>
            <p style="color:#374151;">Click the button below to set your password and activate your account. This link expires in <strong>7 days</strong>.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${inviteLink}" style="background:#1d4ed8;color:#fff;padding:16px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1.05rem;display:inline-block;letter-spacing:.3px;">
                ✅ Set Password &amp; Access Portal
              </a>
            </div>
            <p style="color:#6b7280;font-size:.85rem;">Or copy this link into your browser:</p>
            <p style="color:#1d4ed8;font-size:.8rem;word-break:break-all;"><a href="${inviteLink}" style="color:#1d4ed8;">${inviteLink}</a></p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="color:#9ca3af;font-size:.8rem;text-align:center;">If you weren't expecting this email, you can safely ignore it.<br>Snow Bro's · 218-331-5145 · prosnowbros@prosnowbros.com</p>
          </div>
        </div>
      `
    });

    res.json({ message: `Portal invite sent to ${client.email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete client (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
