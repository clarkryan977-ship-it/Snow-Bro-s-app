const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { wrapEmail } = require('../utils/emailHeader');
const { sendMail } = require('../utils/mailer');

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
        "SELECT id, email, first_name, last_name FROM clients WHERE email NOT LIKE '%@snowbros.placeholder%'"
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

    // Send real emails via nodemailer
    const results = [];
    for (const r of recipients) {
      if (!r.email || r.email.includes('@snowbros.placeholder')) {
        results.push({ name: `${r.first_name} ${r.last_name}`, email: r.email, status: 'skipped (no valid email)' });
        continue;
      }
      try {
        await sendMail({ to: r.email, subject, html: htmlBody });
        results.push({ name: `${r.first_name} ${r.last_name}`, email: r.email, status: 'sent' });
      } catch (err) {
        console.error(`[EMAIL] Failed to send to ${r.email}:`, err.message);
        results.push({ name: `${r.first_name} ${r.last_name}`, email: r.email, status: `failed: ${err.message}` });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    res.json({
      message: `Email sent to ${sentCount} of ${recipients.length} recipient(s)`,
      recipients_count: sentCount,
      results
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
