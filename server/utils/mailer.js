const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_hN64D3QT_BHqyEfVJRAVzLwYESNjfRNKC';
const BCC_EMAIL = 'clarkryan977@gmail.com';

// Use Resend's onboarding address until prosnowbros@gmail.com domain is verified
const FROM_ADDRESS = 'Snow Bro\'s <prosnowbros@prosnowbros.com>';

const resend = new Resend(RESEND_API_KEY);

/**
 * Send an email using the Resend API.
 * clarkryan977@gmail.com is always BCC'd on every outgoing email.
 * @param {Object} options - { to, subject, html, attachments?, cc? }
 */
async function sendMail({ to, subject, html, attachments, cc }) {
  try {
    const payload = {
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      bcc: [BCC_EMAIL],
      subject,
      html,
    };

    if (cc) {
      payload.cc = Array.isArray(cc) ? cc : [cc];
    }

    // Resend attachments format: [{ filename, content (base64 or Buffer) }]
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map(a => ({
        filename: a.filename || a.name || 'attachment',
        content: a.content || a.data,
      }));
    }

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error(`[MAILER] Resend error sending to ${to}:`, error);
      throw new Error(error.message || JSON.stringify(error));
    }

    console.log(`[MAILER] Email sent via Resend to ${to} (BCC: ${BCC_EMAIL}): ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error(`[MAILER] Failed to send email to ${to}:`, err.message);
    throw err;
  }
}

// Legacy compatibility: export EMAIL_USER for any code that references it
const EMAIL_USER = FROM_ADDRESS;

module.exports = { sendMail, EMAIL_USER, BCC_EMAIL };
