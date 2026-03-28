/**
 * Snow Bro's — Shared Email Header & Footer Utility
 * Use emailHeader() and emailFooter() to wrap all customer-facing HTML emails.
 */

const LOGO_URL = 'https://prosnowbros.com/logo.jpg';
const BUSINESS = {
  name:    "Snow Bro's",
  tagline: "Lawn Care & Snow Removal",
  address: "1812 33rd St S, Moorhead, MN 56560",
  phone:   "218-331-5145",
  email:   "clarkryan977@gmail.com",
  website: "https://snowbros-production.up.railway.app",
};

/**
 * Returns the HTML email header block.
 * @param {string} [subtitle] - Optional subtitle shown below the tagline (e.g. "Invoice #INV-1001")
 */
function emailHeader(subtitle = '') {
  return `
  <!-- Snow Bro's Email Header -->
  <div style="background:linear-gradient(135deg,#0f2557 0%,#1d4ed8 100%);padding:28px 36px;color:#fff;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;width:80px;">
          <img src="${LOGO_URL}" alt="Snow Bro's Logo" width="72" height="72"
               style="border-radius:50%;border:3px solid rgba(255,255,255,0.4);object-fit:cover;display:block;" />
        </td>
        <td style="vertical-align:middle;padding-left:16px;">
          <div style="font-size:26px;font-weight:800;letter-spacing:-.5px;line-height:1.1;">${BUSINESS.name}</div>
          <div style="font-size:13px;font-weight:600;opacity:.85;margin-top:3px;text-transform:uppercase;letter-spacing:.04em;">${BUSINESS.tagline}</div>
          <div style="font-size:12px;opacity:.75;margin-top:5px;">${BUSINESS.address}</div>
          <div style="font-size:12px;opacity:.75;">${BUSINESS.phone} &middot; ${BUSINESS.email}</div>
        </td>
        ${subtitle ? `
        <td style="vertical-align:middle;text-align:right;">
          <div style="font-size:13px;opacity:.75;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">${subtitle}</div>
        </td>` : ''}
      </tr>
    </table>
  </div>`;
}

/**
 * Returns the HTML email footer block.
 */
function emailFooter() {
  return `
  <!-- Snow Bro's Email Footer -->
  <div style="padding:20px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
    <strong style="color:#1e40af;">${BUSINESS.name}</strong> &middot; ${BUSINESS.address} &middot; ${BUSINESS.phone}<br>
    <a href="mailto:${BUSINESS.email}" style="color:#1e40af;text-decoration:none;">${BUSINESS.email}</a>
    &middot;
    <a href="${BUSINESS.website}" style="color:#1e40af;text-decoration:none;">${BUSINESS.website}</a>
    <div style="margin-top:10px;">
      <a href="https://www.facebook.com/share/1HNXScvP62/" target="_blank" style="color:#1877F2;text-decoration:none;margin:0 6px;">Facebook</a>
      <a href="https://nextdoor.com/page/snow-bros-snow-removal-moorhead-mn" target="_blank" style="color:#00B246;text-decoration:none;margin:0 6px;">Nextdoor</a>
      <a href="https://prosnowbros.com/" target="_blank" style="color:#2563eb;text-decoration:none;margin:0 6px;">prosnowbros.com</a>
    </div>
    <div style="margin-top:8px;font-size:11px;color:#cbd5e1;">
      This email was sent by Snow Bro's on behalf of Ryan Clark. To unsubscribe, reply with "unsubscribe".
    </div>
  </div>`;
}

/**
 * Wraps content in a full HTML email document with header and footer.
 * @param {string} content - The inner HTML body content
 * @param {string} [subtitle] - Optional subtitle for the header
 */
function wrapEmail(content, subtitle = '') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snow Bro's</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    ${emailHeader(subtitle)}
    <div style="padding:28px 36px;">
      ${content}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`;
}

module.exports = { emailHeader, emailFooter, wrapEmail, BUSINESS };
