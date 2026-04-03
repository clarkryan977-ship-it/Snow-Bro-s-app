const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER; // e.g. +12183315145

/**
 * Send an SMS via Twilio.
 * Silently no-ops if Twilio credentials are not configured.
 * @param {string} to   - Recipient phone number (any format; will be normalised)
 * @param {string} body - SMS message text (max 160 chars recommended)
 */
async function sendSms(to, body) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn('[SMS] Twilio credentials not configured — skipping SMS to', to);
    return { skipped: true };
  }

  // Normalise phone number to E.164 format (+1XXXXXXXXXX for US numbers)
  const cleaned = to.replace(/\D/g, '');
  let e164;
  if (cleaned.length === 10) {
    e164 = `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    e164 = `+${cleaned}`;
  } else if (cleaned.startsWith('+')) {
    e164 = to; // already E.164
  } else {
    e164 = `+${cleaned}`;
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({
      body,
      from: TWILIO_FROM_NUMBER,
      to: e164,
    });
    console.log(`[SMS] Sent to ${e164}: SID ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error(`[SMS] Failed to send to ${e164}:`, err.message);
    throw err;
  }
}

module.exports = { sendSms };
