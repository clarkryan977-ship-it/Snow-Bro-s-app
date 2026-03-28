const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { wrapEmail } = require('../utils/emailHeader');

// Send promotional email (admin)
router.post('/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { subject, body, recipient_ids } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body required' });
    }

    let recipients;
    if (recipient_ids && recipient_ids.length > 0) {
      const placeholders = recipient_ids.map((_, i) => `$${i + 1}`).join(',');
      const { rows: recipientRows } = await req.db.query(
        `SELECT id, email, first_name, last_name FROM clients WHERE id IN (${placeholders})`,
        recipient_ids
      );
      recipients = recipientRows;
    } else {
      const { rows: allRows } = await req.db.query(
        'SELECT id, email, first_name, last_name FROM clients WHERE email NOT LIKE \'%@snowbros.placeholder%\''
      );
      recipients = allRows;
    }

    // Build HTML email with professional header
    const htmlBody = wrapEmail(`
      <p style="font-size:16px;color:#1e293b;margin-bottom:16px;">
        Hello,
      </p>
      <div style="font-size:15px;color:#334155;line-height:1.7;white-space:pre-wrap;">${body.replace(/\n/g, '<br>')}</div>
      <div style="margin-top:28px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #1d4ed8;font-size:13px;color:#1e40af;">
        <strong>Questions?</strong> Call us at 218-331-5145 or reply to this email.
      </div>
    `, "Message from Snow Bro's");

    // Log the email
    await req.db.query(
      'INSERT INTO email_log (subject, body, recipients_count, sent_by) VALUES ($1, $2, $3, $4)',
      [subject, body, recipients.length, req.user.id]
    );

    // In production, send via SMTP/SendGrid. For now, log and return success.
    console.log(`[EMAIL] Subject: "${subject}" → ${recipients.length} recipients`);
    recipients.forEach(r => console.log(`  → ${r.first_name} ${r.last_name} <${r.email}>`));

    res.json({
      message: `Email queued for ${recipients.length} recipient(s)`,
      recipients_count: recipients.length,
      recipients: recipients.map(r => ({ name: `${r.first_name} ${r.last_name}`, email: r.email })),
      html_preview: htmlBody.substring(0, 200) + '...'
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
