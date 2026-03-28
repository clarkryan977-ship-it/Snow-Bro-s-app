const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER || 'prosnowbros@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'qzvtdmbvdyyhzfck';
const BCC_EMAIL = 'clarkryan977@gmail.com';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

/**
 * Send an email using the Snow Bro's Gmail account.
 * @param {Object} options - { to, subject, html, attachments? }
 */
async function sendMail({ to, subject, html, attachments }) {
  const mailOptions = {
    from: `"Snow Bro's Lawn Care & Snow Removal" <${EMAIL_USER}>`,
    to,
    bcc: BCC_EMAIL,
    subject,
    html,
    attachments
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[MAILER] Failed to send email to ${to}:`, err.message);
    throw err;
  }
}

module.exports = { sendMail, transporter, EMAIL_USER, BCC_EMAIL };
