const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Employee/Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows: __employee } = await req.db.query('SELECT * FROM employees WHERE email = $1 AND (active IS NULL OR active != 0)', [email]);
    const employee = __employee[0];
    if (!employee) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, employee.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { remember_me } = req.body;
    const token = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role, name: `${employee.first_name} ${employee.last_name}` },
      JWT_SECRET,
      { expiresIn: remember_me ? '30d' : '24h' }
    );

    res.json({
      token,
      user: {
        id: employee.id,
        email: employee.email,
        role: employee.role,
        name: `${employee.first_name} ${employee.last_name}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client registration
router.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, password } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const { rows: __existing } = await req.db.query('SELECT id FROM clients WHERE email = $1', [email]);
    const existing = __existing[0];
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = password ? bcrypt.hashSync(password, 10) : null;

    const result = await req.db.query('INSERT INTO clients (first_name, last_name, email, phone, address, city, state, zip, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id', [first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', password_hash]);

    res.status(201).json({ id: result.rows[0].id, message: 'Registration successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client login
router.post('/client-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows: __client } = await req.db.query('SELECT * FROM clients WHERE email = $1', [email]);
    const client = __client[0];
    if (!client || !client.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, client.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { remember_me } = req.body;
    const token = jwt.sign(
      { id: client.id, email: client.email, role: 'client', name: `${client.first_name} ${client.last_name}` },
      JWT_SECRET,
      { expiresIn: remember_me ? '30d' : '24h' }
    );

    res.json({
      token,
      user: {
        id: client.id,
        email: client.email,
        role: 'client',
        name: `${client.first_name} ${client.last_name}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forgot password — send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, type } = req.body; // type: 'staff' or 'client'
    if (!email) return res.status(400).json({ error: 'Email is required' });

    let user;
    if (type === 'client') {
      const { rows } = await req.db.query('SELECT id, first_name FROM clients WHERE email = $1', [email]);
      user = rows[0];
    } else {
      const { rows } = await req.db.query('SELECT id, first_name FROM employees WHERE email = $1', [email]);
      user = rows[0];
    }

    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: 'If that email is registered, a reset link has been sent.' });

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    if (type === 'client') {
      await req.db.query('UPDATE password_reset_tokens SET used = 1 WHERE client_id = $1 AND used = 0', [user.id]);
      await req.db.query(
        'INSERT INTO password_reset_tokens (client_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, expiresAt]
      );
    } else {
      await req.db.query('UPDATE password_reset_tokens SET used = 1 WHERE employee_id = $1 AND used = 0', [user.id]);
      await req.db.query(
        'INSERT INTO password_reset_tokens (employee_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, expiresAt]
      );
    }

    const BASE_URL = process.env.BASE_URL || 'https://snowbros-production.up.railway.app';
    const resetLink = `${BASE_URL}/reset-password/${token}`;

    const { sendMail } = require('../utils/mailer');
    await sendMail({
      to: email,
      subject: 'Snow Bro\'s — Password Reset Request',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a56db;color:#fff;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:1.4rem;">❄️ Snow Bro's Lawn Care &amp; Snow Removal</h1>
            <p style="margin:4px 0 0;font-size:.85rem;opacity:.85;">1812 33rd St S, Moorhead, MN 56560 · 218-331-5145</p>
          </div>
          <div style="background:#f9fafb;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
            <h2 style="margin:0 0 16px;color:#111827;">Password Reset Request</h2>
            <p style="color:#374151;">Hi ${user.first_name},</p>
            <p style="color:#374151;">We received a request to reset your Snow Bro's ${type === 'client' ? 'client' : 'admin'} password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetLink}" style="background:#1a56db;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">Reset My Password</a>
            </div>
            <p style="color:#6b7280;font-size:.85rem;">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
            <p style="color:#6b7280;font-size:.85rem;">Or copy this link: <a href="${resetLink}" style="color:#1a56db;">${resetLink}</a></p>
          </div>
        </div>
      `
    });

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset password via token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token and new password are required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const { rows } = await req.db.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = 0 AND expires_at > NOW()',
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const resetToken = rows[0];
    const newHash = bcrypt.hashSync(new_password, 12);
    
    if (resetToken.client_id) {
      await req.db.query('UPDATE clients SET password_hash = $1 WHERE id = $2', [newHash, resetToken.client_id]);
    } else {
      await req.db.query('UPDATE employees SET password_hash = $1 WHERE id = $2', [newHash, resetToken.employee_id]);
    }
    
    await req.db.query('UPDATE password_reset_tokens SET used = 1 WHERE id = $1', [resetToken.id]);

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password (authenticated employee/admin)
const { authenticateToken } = require('../middleware/auth');
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Fetch the employee record
    const { rows } = await req.db.query('SELECT * FROM employees WHERE id = $1', [req.user.id]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ error: 'User not found' });

    // Verify current password
    const valid = bcrypt.compareSync(current_password, employee.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    // Hash and save the new password
    const newHash = bcrypt.hashSync(new_password, 12);
    await req.db.query('UPDATE employees SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate portal-setup token (GET — used by the frontend to show the set-password form)
router.get('/portal-setup/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { rows } = await req.db.query(
      'SELECT prt.*, c.first_name, c.last_name, c.email FROM password_reset_tokens prt JOIN clients c ON c.id = prt.client_id WHERE prt.token = $1 AND prt.used = 0 AND prt.expires_at > NOW()',
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'This invite link is invalid or has expired. Ask your admin to resend the invite.' });
    const r = rows[0];
    res.json({ valid: true, first_name: r.first_name, last_name: r.last_name, email: r.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete portal setup — client sets password, account is activated, JWT returned
router.post('/portal-setup/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const { rows } = await req.db.query(
      'SELECT prt.*, c.first_name, c.last_name, c.email FROM password_reset_tokens prt JOIN clients c ON c.id = prt.client_id WHERE prt.token = $1 AND prt.used = 0 AND prt.expires_at > NOW()',
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'This invite link is invalid or has expired. Ask your admin to resend the invite.' });

    const r = rows[0];
    const password_hash = bcrypt.hashSync(password, 12);

    // Save password, activate account
    await req.db.query(
      'UPDATE clients SET password_hash=$1, active=1 WHERE id=$2',
      [password_hash, r.client_id]
    );
    // Mark token used
    await req.db.query('UPDATE password_reset_tokens SET used=1 WHERE id=$1', [r.id]);

    // Issue JWT so the client is immediately logged in
    const jwtToken = jwt.sign(
      { id: r.client_id, email: r.email, role: 'client', name: `${r.first_name} ${r.last_name}` },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      token: jwtToken,
      user: { id: r.client_id, email: r.email, role: 'client', name: `${r.first_name} ${r.last_name}` },
      message: 'Account activated! Welcome to the Snow Bro\'s portal.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
