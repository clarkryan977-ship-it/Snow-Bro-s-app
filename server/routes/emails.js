const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Send promotional email (admin) - logs the email; in production would use SMTP
router.post('/send', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { subject, body, recipient_ids } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body required' });
    }

    let recipients;
    if (recipient_ids && recipient_ids.length > 0) {
      const placeholders = recipient_ids.map(() => '?').join(',');
      recipients = req.db.prepare(`SELECT id, email, first_name, last_name FROM clients WHERE id IN (${placeholders})`).all(...recipient_ids);
    } else {
      recipients = req.db.prepare('SELECT id, email, first_name, last_name FROM clients').all();
    }

    // Log the email
    req.db.prepare('INSERT INTO email_log (subject, body, recipients_count, sent_by) VALUES (?, ?, ?, ?)').run(
      subject, body, recipients.length, req.user.id
    );

    // In production, this would send actual emails via SMTP/SendGrid/etc.
    // For demo purposes, we log it and return success
    res.json({
      message: `Promotional email queued for ${recipients.length} recipient(s)`,
      recipients_count: recipients.length,
      recipients: recipients.map(r => ({ name: `${r.first_name} ${r.last_name}`, email: r.email }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get email history (admin)
router.get('/history', authenticateToken, requireAdmin, (req, res) => {
  try {
    const logs = req.db.prepare('SELECT * FROM email_log ORDER BY sent_at DESC LIMIT 50').all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
