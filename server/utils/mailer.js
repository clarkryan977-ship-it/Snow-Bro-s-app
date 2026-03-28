const nodemailer = require('nodemailer');
const dns = require('dns');

// Force IPv4 DNS resolution to avoid Railway IPv6 ENETUNREACH issue
dns.setDefaultResultOrder('ipv4first');

const EMAIL_USER = process.env.EMAIL_USER || 'prosnowbros@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'hisaxewlwuxmkghz';
const BCC_EMAIL = 'clarkryan977@gmail.com';

// Create transporter with Gmail SMTP forced to IPv4 via port 587 (STARTTLS)
// Port 587 is more reliable on Railway than 465 (SSL) for IPv4
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  // Force IPv4 family to avoid Railway IPv6 routing issues
  family: 4,
  connectionTimeout: 30000,
  greetingTimeout: 15000,
  socketTimeout: 30000
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
