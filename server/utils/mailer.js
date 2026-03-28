const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER || 'prosnowbros@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'hisaxewlwuxmkghz';
const BCC_EMAIL = 'clarkryan977@gmail.com';

// Create transporter with explicit Gmail SMTP settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Send an email using the Snow Bro's Gmail account.
 * clarkryan977@gmail.com is always BCC'd on every outgoing email.
 * @param {Object} options - { to, subject, html, attachments?, cc? }
 */
async function sendMail({ to, subject, html, attachments, cc }) {
  const mailOptions = {
    from: `"Snow Bro's Lawn Care & Snow Removal" <${EMAIL_USER}>`,
    to,
    bcc: BCC_EMAIL,
    subject,
    html,
    ...(cc ? { cc } : {}),
    ...(attachments ? { attachments } : {})
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Email sent to ${to} (BCC: ${BCC_EMAIL}): ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[MAILER] Failed to send email to ${to}:`, err.message);
    throw err;
  }
}

module.exports = { sendMail, transporter, EMAIL_USER, BCC_EMAIL };
