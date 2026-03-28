const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Send promotional email (admin) - logs the email; in production would use SMTP
router.post('/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { subject, body, recipient_ids } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body required' });
    }

    let recipients;
    if (recipient_ids && recipient_ids.length > 0) {
      const placeholders = recipient_ids.map((_, i) => `$${i + 1}`).join(',');
      const { rows: recipientRows } = await req.db.query(`SELECT id, email, first_name, last_name FROM clients WHERE id IN (${placeholders})`, recipient_ids);
      recipients = recipientRows;
    } else {
      const { rows: allRows } = await req.db.query('SELECT id, email, first_name, last_name FROM clients');
      recipients = allRows;
    }

    // Log the email
    await req.db.query('INSERT INTO email_log (subject, body, recipients_count, sent_by) VALUES ($1, $2, $3, $4)', [subject, body, recipients.length, req.user.id]);

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
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: logs } = await req.db.query('SELECT * FROM email_log ORDER BY sent_at DESC LIMIT 50');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
