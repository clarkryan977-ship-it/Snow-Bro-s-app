const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const https = require('https');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── Helper: geocode an address via Nominatim (OpenStreetMap) ──────────────────
async function geocodeAddress(address, city, state, zip) {
  const query = [address, city, state, zip].filter(Boolean).join(', ');
  if (!query || query.trim() === ',') return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=us`;
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'SnowBros-RoutePlanner/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.length > 0) {
            resolve({ lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

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
    const newId = result.rows[0].id;
    // Geocode in background (don't block response)
    if (address && city) {
      geocodeAddress(address, city, state, zip).then(coords => {
        if (coords) {
          req.db.query('UPDATE clients SET latitude=$1, longitude=$2 WHERE id=$3', [coords.lat, coords.lon, newId]).catch(() => {});
        }
      });
    }
    res.status(201).json({ id: newId, message: 'Client added' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update client (admin) — full update; also accepts latitude/longitude and password
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, notes, active, service_type, latitude, longitude, password } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'first_name, last_name, and email are required' });
    }
    const activeVal = (active === false || active === 0 || active === '0') ? 0 : 1;

    // If lat/lon are explicitly provided, use them; otherwise keep existing coords
    let latVal = latitude !== undefined ? (latitude || null) : undefined;
    let lonVal = longitude !== undefined ? (longitude || null) : undefined;

    let query, params;
    if (latVal !== undefined && lonVal !== undefined) {
      // Update including coordinates
      query = 'UPDATE clients SET first_name=$1, last_name=$2, email=$3, phone=$4, address=$5, city=$6, state=$7, zip=$8, notes=$9, active=$10, service_type=$11, latitude=$12, longitude=$13 WHERE id=$14 RETURNING *';
      params = [first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', notes || '', activeVal, service_type || 'residential', latVal, lonVal, req.params.id];
    } else {
      // Don't overwrite existing coordinates
      query = 'UPDATE clients SET first_name=$1, last_name=$2, email=$3, phone=$4, address=$5, city=$6, state=$7, zip=$8, notes=$9, active=$10, service_type=$11 WHERE id=$12 RETURNING *';
      params = [first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', notes || '', activeVal, service_type || 'residential', req.params.id];
    }

    const { rows } = await req.db.query(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Client not found' });

    // If password provided, hash and save it
    if (password && password.trim()) {
      const password_hash = bcrypt.hashSync(password.trim(), 10);
      await req.db.query('UPDATE clients SET password_hash=$1 WHERE id=$2', [password_hash, req.params.id]);
    }

    // If address changed and no coords provided, re-geocode in background
    if (latVal === undefined && address && city) {
      const existing = rows[0];
      if (!existing.latitude || !existing.longitude) {
        geocodeAddress(address, city, state, zip).then(coords => {
          if (coords) {
            req.db.query('UPDATE clients SET latitude=$1, longitude=$2 WHERE id=$3', [coords.lat, coords.lon, req.params.id]).catch(() => {});
          }
        });
      }
    }

    res.json(rows[0]);
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

// PATCH geocode — set lat/lon for a single client
router.patch('/:id/geocode', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude required' });
    }
    await req.db.query('UPDATE clients SET latitude=$1, longitude=$2 WHERE id=$3', [latitude || null, longitude || null, req.params.id]);
    res.json({ message: 'Coordinates updated', latitude, longitude });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /geocode-all — geocode all clients missing lat/lon (admin, runs in background)
router.post('/geocode-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: clients } = await req.db.query(
      "SELECT id, address, city, state, zip FROM clients WHERE (latitude IS NULL OR longitude IS NULL) AND address IS NOT NULL AND address != '' AND city IS NOT NULL AND city != ''"
    );
    res.json({ message: `Geocoding ${clients.length} clients in background`, count: clients.length });

    // Process in background with rate limiting (1 req/sec for Nominatim)
    (async () => {
      let success = 0, fail = 0;
      for (const c of clients) {
        await new Promise(r => setTimeout(r, 1100)); // 1.1s delay for Nominatim rate limit
        const coords = await geocodeAddress(c.address, c.city, c.state, c.zip);
        if (coords) {
          await req.db.query('UPDATE clients SET latitude=$1, longitude=$2 WHERE id=$3', [coords.lat, coords.lon, c.id]).catch(() => {});
          success++;
          console.log(`[geocode-all] ID ${c.id}: (${coords.lat}, ${coords.lon})`);
        } else {
          fail++;
          console.log(`[geocode-all] ID ${c.id}: no result for "${c.address}, ${c.city}"`);
        }
      }
      console.log(`[geocode-all] Done: ${success} geocoded, ${fail} failed`);
    })();
  } catch (err) {
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

// ── Admin: Create portal account for a client ─────────────────────────────────
router.post('/:id/create-portal-account', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __client } = await req.db.query(
      'SELECT id, first_name, last_name, email, password_hash FROM clients WHERE id = $1',
      [req.params.id]
    );
    const client = __client[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (client.email.endsWith('@snowbros.placeholder')) {
      return res.status(400).json({ error: 'Cannot create portal account with a placeholder email. Update the client\'s real email first.' });
    }

    // Generate or use provided password
    let { password } = req.body;
    if (!password || !password.trim()) {
      // Auto-generate: first name lowercase + random 4 digits
      const rand = Math.floor(1000 + Math.random() * 9000);
      password = `${client.first_name.toLowerCase()}${rand}`;
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    await req.db.query('UPDATE clients SET password_hash=$1 WHERE id=$2', [password_hash, client.id]);

    res.json({
      message: `Portal account created for ${client.first_name} ${client.last_name}`,
      credentials: { email: client.email, password, login_url: (process.env.BASE_URL || 'https://snowbros-production.up.railway.app') + '/login' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Reset client portal password ─────────────────────────────────────
router.post('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __client } = await req.db.query(
      'SELECT id, first_name, last_name, email, password_hash FROM clients WHERE id = $1',
      [req.params.id]
    );
    const client = __client[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.password_hash) {
      return res.status(400).json({ error: 'Client does not have a portal account yet. Create one first.' });
    }

    let { password } = req.body;
    if (!password || !password.trim()) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      password = `${client.first_name.toLowerCase()}${rand}`;
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    await req.db.query('UPDATE clients SET password_hash=$1 WHERE id=$2', [password_hash, client.id]);

    res.json({
      message: `Password reset for ${client.first_name} ${client.last_name}`,
      credentials: { email: client.email, password, login_url: (process.env.BASE_URL || 'https://snowbros-production.up.railway.app') + '/login' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Send credentials to client via email ─────────────────────────────
router.post('/:id/send-credentials', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __client } = await req.db.query(
      'SELECT id, first_name, last_name, email, phone FROM clients WHERE id = $1',
      [req.params.id]
    );
    const client = __client[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { password, method } = req.body; // method: 'email' or 'sms'
    if (!password) return res.status(400).json({ error: 'Password is required to send credentials' });

    const BASE_URL = process.env.BASE_URL || 'https://snowbros-production.up.railway.app';
    const loginUrl = `${BASE_URL}/login`;

    if (method === 'sms') {
      // SMS via email-to-SMS gateways is unreliable; return the message text for manual sending
      const smsText = `Hi ${client.first_name}! Your Snow Bro's portal account is ready. Login at ${loginUrl} with email: ${client.email} and password: ${password}`;
      return res.json({ message: 'SMS text generated (copy and send manually)', sms_text: smsText, phone: client.phone });
    }

    // Send via email
    if (!client.email || client.email.endsWith('@snowbros.placeholder')) {
      return res.status(400).json({ error: 'Client has no valid email address' });
    }

    const { sendMail } = require('../utils/mailer');
    const { wrapEmail } = require('../utils/emailHeader');

    const html = wrapEmail(`
      <h2 style="color:#1e40af;margin-top:0;">Your Portal Account is Ready!</h2>
      <p>Hi ${client.first_name},</p>
      <p>Your <strong>Snow Bro's Client Portal</strong> account has been set up. You can now log in to view invoices, contracts, service history, and track your service in real time.</p>
      <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:10px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px;font-weight:700;color:#1e40af;">Your Login Credentials</p>
        <table style="font-size:14px;">
          <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#374151;">Email:</td><td style="color:#111827;">${client.email}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#374151;">Password:</td><td style="color:#111827;font-family:monospace;font-size:15px;letter-spacing:1px;">${password}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${loginUrl}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">Log In to Your Portal</a>
      </div>
      <p style="color:#6b7280;font-size:13px;">We recommend changing your password after your first login for security.</p>
    `, 'Portal Account');

    await sendMail({
      to: client.email,
      subject: "Your Snow Bro's Portal Login Credentials",
      html
    });

    res.json({ message: `Credentials emailed to ${client.email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Remove portal account (clear password) ───────────────────────────
router.post('/:id/remove-portal-account', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('UPDATE clients SET password_hash=NULL WHERE id=$1', [req.params.id]);
    res.json({ message: 'Portal account removed' });
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
