const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── PUBLIC: Submit a job application (no auth required) ─────────────────────
router.post('/public', async (req, res) => {
  try {
    const { full_name, email, phone, address, city, state, zip, position, availability, experience, references_info, notes } = req.body;
    if (!full_name || !email || !position) {
      return res.status(400).json({ error: 'Full name, email, and position are required' });
    }
    const { rows } = await req.db.query(
      `INSERT INTO job_applications
        (full_name, email, phone, address, city, state, zip, position, availability, experience, references_info, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, full_name, position, created_at`,
      [full_name, email, phone || '', address || '', city || '', state || '', zip || '',
       position, availability || '', experience || '', references_info || '', notes || '']
    );
    // Notify admin via email (best-effort)
    try {
      const { sendMail } = require('../utils/mailer');
      if (sendMail) {
        sendMail({
          to: process.env.ADMIN_EMAIL || 'admin@snowbros.com',
          subject: `New Job Application: ${full_name} — ${position}`,
          html: `<h2>New Job Application Received</h2>
            <p><strong>Name:</strong> ${full_name}</p>
            <p><strong>Position:</strong> ${position}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
            <p><strong>Address:</strong> ${[address, city, state, zip].filter(Boolean).join(', ') || 'N/A'}</p>
            <p><strong>Availability:</strong> ${availability || 'N/A'}</p>
            <p><strong>Experience:</strong></p><p>${(experience || 'N/A').replace(/\n/g, '<br>')}</p>
            <p><strong>References:</strong></p><p>${(references_info || 'N/A').replace(/\n/g, '<br>')}</p>
            <p><strong>Notes:</strong> ${notes || 'N/A'}</p>
            <p style="color:#6b7280;font-size:12px;">View in admin panel → Applications</p>`
        }).catch(() => {});
      }
    } catch (_) {}
    res.status(201).json({ message: 'Application submitted successfully!', id: rows[0].id });
  } catch (err) {
    console.error('Application submit error:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// ── ADMIN: Get all applications ─────────────────────────────────────────────
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `SELECT ja.*, e.first_name || ' ' || e.last_name AS reviewed_by_name
       FROM job_applications ja
       LEFT JOIN employees e ON ja.reviewed_by = e.id
       ORDER BY ja.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Get single application ───────────────────────────────────────────
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query('SELECT * FROM job_applications WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Application not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Update application status (approve/reject/pending) ───────────────
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    if (!['pending', 'approved', 'rejected', 'hired'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await req.db.query(
      `UPDATE job_applications
       SET status = $1, admin_notes = COALESCE($2, admin_notes), reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $4
       RETURNING *`,
      [status, admin_notes || null, req.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Application not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Convert approved applicant to employee ───────────────────────────
router.post('/:id/convert', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get the application
    const { rows: apps } = await req.db.query('SELECT * FROM job_applications WHERE id = $1', [req.params.id]);
    if (!apps[0]) return res.status(404).json({ error: 'Application not found' });
    const app = apps[0];

    if (app.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved applications can be converted to employees' });
    }

    // Parse full_name into first/last
    const nameParts = app.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Generate a temp password
    const { password, role, title } = req.body;
    const tempPassword = password || `snow${Math.random().toString(36).slice(2, 8)}`;
    const hash = bcrypt.hashSync(tempPassword, 10);

    // Check if email already exists
    const { rows: existing } = await req.db.query('SELECT id FROM employees WHERE email = $1', [app.email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An employee with this email already exists' });
    }

    // Create employee record
    const { rows: emp } = await req.db.query(
      `INSERT INTO employees (first_name, last_name, email, phone, password_hash, role, title)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, first_name, last_name, email, role, title`,
      [firstName, lastName, app.email, app.phone || '', hash, role || 'employee', title || app.position]
    );

    // Update application status to hired
    await req.db.query(
      `UPDATE job_applications SET status = 'hired', reviewed_at = NOW(), reviewed_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    res.status(201).json({
      message: `${app.full_name} has been hired and added as an employee`,
      employee: emp[0],
      temp_password: tempPassword
    });
  } catch (err) {
    console.error('Convert application error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Delete application ───────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await req.db.query('DELETE FROM job_applications WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Application not found' });
    res.json({ message: 'Application deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
