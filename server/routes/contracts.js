const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { wrapEmail, BUSINESS } = require('../utils/emailHeader');
const { sendMail } = require('../utils/mailer');

const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://snowbros-production.up.railway.app';

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || path.join(__dirname, '../uploads');
const CONTRACTS_DIR = path.join(UPLOADS_ROOT, 'contracts');
const SIGNED_DIR    = path.join(UPLOADS_ROOT, 'signed');

// Ensure directories exist
[CONTRACTS_DIR, SIGNED_DIR].forEach(d => { try { fs.mkdirSync(d, { recursive: true }); } catch (_) {} });

// Multer storage for manual uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CONTRACTS_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

// ─── Shared CSS + HTML shell used by all three templates ────────────────────
const SHARED_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;color:#1a1a2e;line-height:1.6}
  .page-wrapper{max-width:860px;margin:0 auto;padding:24px 16px 48px}
  .print-bar{background:#1e3a5f;color:#fff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10}
  .print-bar h2{font-size:15px;font-weight:700;margin:0}
  .print-btn{background:#fff;color:#1e3a5f;border:none;padding:7px 16px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px}
  .contract-card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.12);padding:36px 40px;position:relative;overflow:hidden}
  .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72px;font-weight:900;color:rgba(30,58,95,.04);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:4px}
  .contract-content{position:relative;z-index:1}
  .header-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;border-bottom:3px solid #1e3a5f;padding-bottom:20px;flex-wrap:wrap;gap:12px}
  .brand{display:flex;align-items:center;gap:12px}
  .brand-icon{width:52px;height:52px;background:#1e3a5f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}
  .brand-name{font-size:22px;font-weight:800;color:#1e3a5f;line-height:1.1}
  .brand-sub{font-size:12px;color:#64748b;margin-top:2px}
  .contract-meta{text-align:right}
  .contract-meta h1{font-size:18px;color:#1e3a5f;font-weight:700;margin-bottom:6px}
  .type-badge{padding:3px 12px;border-radius:12px;font-size:12px;font-weight:700;display:inline-block}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
  .meta-item{background:#f8fafc;border-radius:8px;padding:12px 16px;border-left:3px solid #1e3a5f}
  .meta-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
  .meta-value{font-size:14px;color:#1a1a2e;font-weight:600;margin-top:3px}
  .section-title{font-size:15px;font-weight:700;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:24px 0 12px;text-transform:uppercase;letter-spacing:.04em}
  .body-p{font-size:14px;margin:6px 0;color:#374151}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0}
  .party{background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:13px;border-top:3px solid #1e3a5f}
  .party-title{font-weight:700;color:#1e3a5f;font-size:13px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
  table.data{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
  table.data th{background:#1e3a5f;color:#fff;padding:9px 12px;text-align:left;font-weight:600}
  table.data td{padding:9px 12px;border-bottom:1px solid #e5e7eb}
  table.data tr:nth-child(even) td{background:#f8fafc}
  table.data tfoot td{background:#f0f4f8;font-weight:700;border-top:2px solid #1e3a5f}
  .highlight-box{background:#eff6ff;border-left:4px solid #1d4ed8;padding:12px 16px;border-radius:0 8px 8px 0;margin:12px 0;font-size:14px}
  .sig-block{margin-top:36px;padding-top:20px;border-top:2px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .sig-line{border-bottom:1px solid #374151;margin-top:32px;margin-bottom:6px}
  .sig-label{font-size:12px;color:#64748b}
  .footer-bar{background:#1e3a5f;color:#fff;text-align:center;padding:12px 24px;font-size:12px;margin-top:32px;border-radius:0 0 12px 12px}
  @media print{.print-bar{display:none!important}body{background:#fff}.contract-card{box-shadow:none;padding:0}.page-wrapper{padding:0;max-width:100%}}
  @media(max-width:600px){.parties,.meta-grid,.sig-block{grid-template-columns:1fr}.contract-card{padding:20px 16px}.header-row{flex-direction:column}}
`;

function contractShell(title, typeBadgeColor, typeBadgeBg, typeLabel, watermarkText, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="print-bar">
    <h2>📄 ${title}</h2>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>
  <div class="page-wrapper">
    <div class="contract-card">
      <div class="watermark">${watermarkText}</div>
      <div class="contract-content">
        <div class="header-row">
          <div class="brand">
            <div class="brand-icon">❄️</div>
            <div>
              <div class="brand-name">Snow Bro's</div>
              <div class="brand-sub">Professional Snow &amp; Lawn Services</div>
            </div>
          </div>
          <div class="contract-meta">
            <h1>${title}</h1>
            <span class="type-badge" style="background:${typeBadgeBg};color:${typeBadgeColor}">${typeLabel}</span>
          </div>
        </div>
        ${bodyHtml}
      </div>
      <div class="footer-bar">Snow Bro's &bull; 1812 33rd St S, Moorhead MN 56560 &bull; 218-331-5145 &bull; clarkryan977@gmail.com</div>
    </div>
  </div>
</body>
</html>`;
}

const fmtDate = raw => {
  if (!raw) return '';
  const d = new Date(raw + 'T12:00:00');
  return isNaN(d) ? raw : d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
};

const money = v => parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

function clientBlock(name, address, city, state, zip, phone, email) {
  const addrLine = [address, city && state ? `${city}, ${state} ${zip||''}`.trim() : (city||state||'')].filter(Boolean).join(', ');
  return `<div class="party">
    <div class="party-title">Client</div>
    <strong>${name}</strong><br/>
    ${addrLine ? addrLine + '<br/>' : ''}
    ${phone ? `📞 ${phone}<br/>` : ''}
    ${email ? `✉️ ${email}` : ''}
  </div>
  <div class="party">
    <div class="party-title">Contractor</div>
    <strong>Snow Bro's (Ryan Clark)</strong><br/>
    1812 33rd St S, Moorhead, MN 56560<br/>
    📞 218-331-5145<br/>✉️ clarkryan977@gmail.com
  </div>`;
}

// ─── Template 1: Snow Removal Agreement ─────────────────────────────────────
function buildSnowRemovalHtml({
  clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail,
  startDate, endDate, ratePerVisit, monthlyRate, paymentTerms, serviceDetails, year
}) {
  const yr = year || new Date().getFullYear();
  const startFmt = fmtDate(startDate);
  const endFmt   = fmtDate(endDate);
  const season   = startFmt && endFmt ? `${startFmt} – ${endFmt}` : (startFmt || endFmt || `${yr}–${yr+1} Winter Season`);

  const body = `
    <div class="meta-grid">
      <div class="meta-item"><div class="meta-label">Client</div><div class="meta-value">${clientName}</div></div>
      <div class="meta-item"><div class="meta-label">Service Season</div><div class="meta-value">${season}</div></div>
      ${ratePerVisit ? `<div class="meta-item"><div class="meta-label">Rate Per Visit</div><div class="meta-value">$${money(ratePerVisit)}</div></div>` : ''}
      ${monthlyRate  ? `<div class="meta-item"><div class="meta-label">Monthly Rate</div><div class="meta-value">$${money(monthlyRate)}/month</div></div>` : ''}
      <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value"><span style="background:#fef9c3;color:#92400e;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">⏳ Pending Signature</span></div></div>
    </div>

    <h3 class="section-title">1. Parties</h3>
    <div class="parties">${clientBlock(clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail)}</div>

    <h3 class="section-title">2. Services</h3>
    <p class="body-p">Contractor agrees to provide snow removal services at the Client's property during the service season specified above. Services include:</p>
    <div class="highlight-box">${serviceDetails || 'Snow plowing of driveway and walkways. Salting/sanding of walkways and entry points. Services triggered by snowfall of 2 inches or more.'}</div>

    <h3 class="section-title">3. Service Season &amp; Schedule</h3>
    <p class="body-p"><strong>Season:</strong> ${season}</p>
    <p class="body-p">Services will be performed as needed based on snowfall conditions, typically within 24 hours of a qualifying snowfall event. The Contractor will make reasonable efforts to service the property before 7:00 AM on business days.</p>

    <h3 class="section-title">4. Compensation &amp; Payment Terms</h3>
    <table class="data">
      <thead><tr><th>Item</th><th>Amount</th></tr></thead>
      <tbody>
        ${ratePerVisit ? `<tr><td>Rate Per Visit</td><td>$${money(ratePerVisit)}</td></tr>` : ''}
        ${monthlyRate  ? `<tr><td>Monthly Rate (flat)</td><td>$${money(monthlyRate)}/month</td></tr>` : ''}
        <tr><td>Payment Terms</td><td>${paymentTerms || 'Due within 7 days of invoice'}</td></tr>
      </tbody>
    </table>

    <h3 class="section-title">5. Cancellation &amp; Termination</h3>
    <p class="body-p">Either party may terminate this agreement with 48 hours written notice. The Client is responsible for payment for all services rendered prior to termination.</p>

    <h3 class="section-title">6. Liability</h3>
    <p class="body-p">The Contractor shall not be liable for damage caused by pre-existing conditions, hidden obstacles under snow, or acts of nature. The Client agrees to mark any obstacles (sprinkler heads, curbs, garden edging) prior to the service season.</p>

    <h3 class="section-title">7. Governing Law</h3>
    <p class="body-p">This Agreement is governed by the laws of the State of Minnesota.</p>

     <div class="sig-block">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Client Signature &amp; Date</div>
      </div>
      <div>
        <div style="margin-top:8px;font-family:'Brush Script MT',cursive;font-size:32px;color:#1e3a5f;line-height:1.1;">Ryan Clark</div>
        <div class="sig-line" style="margin-top:4px;"></div>
        <div class="sig-label">Contractor Signature &amp; Date</div>
        <div class="sig-label" style="margin-top:4px;font-weight:600;color:#374151;">Ryan Clark — Snow Bro's</div>
        <div class="sig-label" style="margin-top:2px;">${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
    </div>`;
  return contractShell(
    `${yr} Snow Removal Service Agreement`,
    '#1d4ed8', '#eff6ff', '❄️ Snow Removal',
    '❄️ SNOW BRO\'S',
    body
  );
}

// ─── Template 2: Lawn Care Agreement ────────────────────────────────────────
function buildLawnCareHtml({
  clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail,
  startDate, endDate, frequency, monthlyRate, paymentTerms, serviceDetails, year
}) {
  const yr = year || new Date().getFullYear();
  const startFmt = fmtDate(startDate);
  const endFmt   = fmtDate(endDate);
  const freq = frequency || 'Weekly';

  const body = `
    <div class="meta-grid">
      <div class="meta-item"><div class="meta-label">Client</div><div class="meta-value">${clientName}</div></div>
      <div class="meta-item"><div class="meta-label">Frequency</div><div class="meta-value">${freq}</div></div>
      ${startFmt ? `<div class="meta-item"><div class="meta-label">Start Date</div><div class="meta-value">${startFmt}</div></div>` : ''}
      ${endFmt   ? `<div class="meta-item"><div class="meta-label">End Date</div><div class="meta-value">${endFmt}</div></div>` : ''}
      ${monthlyRate ? `<div class="meta-item"><div class="meta-label">Monthly Rate</div><div class="meta-value">$${money(monthlyRate)}/month</div></div>` : ''}
      <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value"><span style="background:#fef9c3;color:#92400e;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">⏳ Pending Signature</span></div></div>
    </div>

    <h3 class="section-title">1. Parties</h3>
    <div class="parties">${clientBlock(clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail)}</div>

    <h3 class="section-title">2. Services</h3>
    <p class="body-p">Contractor agrees to provide lawn care and maintenance services at the Client's property on a <strong>${freq}</strong> basis. Services include:</p>
    <div class="highlight-box">${serviceDetails || 'Lawn mowing and edging. Trimming around obstacles and borders. Blowing clippings off driveways and walkways. Seasonal cleanup as needed.'}</div>

    <h3 class="section-title">3. Term of Agreement</h3>
    ${startFmt ? `<p class="body-p"><strong>Effective Date:</strong> ${startFmt}</p>` : ''}
    ${endFmt   ? `<p class="body-p"><strong>Termination Date:</strong> ${endFmt}</p>` : ''}
    <p class="body-p">This Agreement commences on the Effective Date and continues through the Termination Date, unless earlier terminated by either party with 30 days written notice.</p>

    <h3 class="section-title">4. Compensation &amp; Payment Terms</h3>
    <table class="data">
      <thead><tr><th>Item</th><th>Amount</th></tr></thead>
      <tbody>
        ${monthlyRate ? `<tr><td>Monthly Rate</td><td>$${money(monthlyRate)}/month</td></tr>` : ''}
        <tr><td>Service Frequency</td><td>${freq}</td></tr>
        <tr><td>Payment Terms</td><td>${paymentTerms || 'Due on the 1st of each month'}</td></tr>
      </tbody>
    </table>

    <h3 class="section-title">5. Cancellation Policy</h3>
    <p class="body-p">Either party may cancel this agreement with 30 days written notice. Services skipped due to weather will be rescheduled at no additional charge. Missed visits due to Client access issues may be billed at the standard rate.</p>

    <h3 class="section-title">6. Client Responsibilities</h3>
    <p class="body-p">The Client agrees to: (a) ensure property access on scheduled service days; (b) remove obstacles such as toys, hoses, and pet waste prior to service; (c) notify the Contractor of any areas requiring special attention.</p>

    <h3 class="section-title">7. Liability</h3>
    <p class="body-p">The Contractor carries general liability insurance. The Contractor is not responsible for pre-existing lawn damage, underground utilities, or damage caused by undisclosed obstacles.</p>

    <h3 class="section-title">8. Governing Law</h3>
    <p class="body-p">This Agreement is governed by the laws of the State of Minnesota.</p>

    <div class="sig-block">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Client Signature &amp; Date</div>
      </div>
      <div>
        <div style="margin-top:8px;font-family:'Brush Script MT',cursive;font-size:32px;color:#1e3a5f;line-height:1.1;">Ryan Clark</div>
        <div class="sig-line" style="margin-top:4px;"></div>
        <div class="sig-label">Contractor Signature &amp; Date</div>
        <div class="sig-label" style="margin-top:4px;font-weight:600;color:#374151;">Ryan Clark — Snow Bro's</div>
        <div class="sig-label" style="margin-top:2px;">${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
    </div>`;

  return contractShell(
    `${yr} Lawn Care Service Agreement`,
    '#16a34a', '#f0fdf4', '🌿 Lawn Care',
    'SNOW BRO\'S',
    body
  );
}

// ─── Template 3: Landscape Agreement ────────────────────────────────────────
function buildLandscapeHtml({
  clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail,
  startDate, endDate, projectDescription, lineItems, laborHours, laborRate,
  depositAmount, milestone1Desc, milestone1Amount, finalPaymentAmount,
  paymentTerms, year
}) {
  const yr = year || new Date().getFullYear();
  const startFmt = fmtDate(startDate);
  const endFmt   = fmtDate(endDate);

  // Parse line items — array of { name, qty, unitCost } or JSON string
  let items = [];
  try {
    items = typeof lineItems === 'string' ? JSON.parse(lineItems) : (lineItems || []);
  } catch { items = []; }

  const materialTotal = items.reduce((sum, it) => sum + (parseFloat(it.qty||0) * parseFloat(it.unitCost||0)), 0);
  const laborTotal    = parseFloat(laborHours||0) * parseFloat(laborRate||0);
  const projectTotal  = materialTotal + laborTotal;

  const itemRows = items.map(it => {
    const total = parseFloat(it.qty||0) * parseFloat(it.unitCost||0);
    return `<tr><td>${it.name||''}</td><td style="text-align:center">${it.qty||''}</td><td style="text-align:right">$${money(it.unitCost)}</td><td style="text-align:right">$${money(total)}</td></tr>`;
  }).join('');

  const dep  = parseFloat(depositAmount||0);
  const mil1 = parseFloat(milestone1Amount||0);
  const fin  = parseFloat(finalPaymentAmount||0);
  const schedTotal = dep + mil1 + fin;

  const body = `
    <div class="meta-grid">
      <div class="meta-item"><div class="meta-label">Client</div><div class="meta-value">${clientName}</div></div>
      ${startFmt ? `<div class="meta-item"><div class="meta-label">Project Start</div><div class="meta-value">${startFmt}</div></div>` : ''}
      ${endFmt   ? `<div class="meta-item"><div class="meta-label">Estimated Completion</div><div class="meta-value">${endFmt}</div></div>` : ''}
      <div class="meta-item"><div class="meta-label">Project Total</div><div class="meta-value" style="color:#1e3a5f;font-size:16px">$${money(projectTotal)}</div></div>
      <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value"><span style="background:#fef9c3;color:#92400e;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">⏳ Pending Signature</span></div></div>
    </div>

    <h3 class="section-title">1. Parties</h3>
    <div class="parties">${clientBlock(clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail)}</div>

    <h3 class="section-title">2. Project Scope &amp; Description</h3>
    <div class="highlight-box">${projectDescription || 'Full landscape installation including grading, planting, and hardscape as described in the line items below.'}</div>
    ${startFmt ? `<p class="body-p" style="margin-top:10px"><strong>Start Date:</strong> ${startFmt}</p>` : ''}
    ${endFmt   ? `<p class="body-p"><strong>Estimated Completion:</strong> ${endFmt}</p>` : ''}

    <h3 class="section-title">3. Materials &amp; Labor</h3>
    ${items.length > 0 ? `
    <p class="body-p"><strong>Materials:</strong></p>
    <table class="data">
      <thead><tr><th>Item / Material</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr><td colspan="3"><strong>Materials Subtotal</strong></td><td style="text-align:right"><strong>$${money(materialTotal)}</strong></td></tr></tfoot>
    </table>` : ''}
    ${(laborHours && laborRate) ? `
    <p class="body-p" style="margin-top:14px"><strong>Labor:</strong></p>
    <table class="data">
      <thead><tr><th>Description</th><th style="text-align:center">Hours</th><th style="text-align:right">Rate/hr</th><th style="text-align:right">Total</th></tr></thead>
      <tbody><tr><td>Landscape Labor</td><td style="text-align:center">${laborHours}</td><td style="text-align:right">$${money(laborRate)}/hr</td><td style="text-align:right">$${money(laborTotal)}</td></tr></tbody>
    </table>` : ''}
    <table class="data" style="margin-top:12px">
      <tfoot><tr><td colspan="3" style="font-size:15px"><strong>PROJECT TOTAL</strong></td><td style="text-align:right;font-size:15px;color:#1e3a5f"><strong>$${money(projectTotal)}</strong></td></tr></tfoot>
    </table>

    <h3 class="section-title">4. Payment Schedule</h3>
    <table class="data">
      <thead><tr><th>Payment</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${dep  > 0 ? `<tr><td><strong>Deposit</strong></td><td>Due upon signing</td><td style="text-align:right">$${money(dep)}</td></tr>` : ''}
        ${mil1 > 0 ? `<tr><td><strong>Progress Payment</strong></td><td>${milestone1Desc || 'Upon project milestone'}</td><td style="text-align:right">$${money(mil1)}</td></tr>` : ''}
        ${fin  > 0 ? `<tr><td><strong>Final Payment</strong></td><td>Upon project completion</td><td style="text-align:right">$${money(fin)}</td></tr>` : ''}
      </tbody>
      ${schedTotal > 0 ? `<tfoot><tr><td colspan="2"><strong>Total</strong></td><td style="text-align:right"><strong>$${money(schedTotal)}</strong></td></tr></tfoot>` : ''}
    </table>
    <p class="body-p">${paymentTerms || 'All payments are due per the schedule above. Late payments are subject to a 1.5% monthly finance charge.'}</p>

    <h3 class="section-title">5. Changes &amp; Substitutions</h3>
    <p class="body-p">Any changes to the scope of work must be agreed upon in writing by both parties. Material substitutions of equal or greater value may be made by the Contractor if specified materials are unavailable, with Client notification.</p>

    <h3 class="section-title">6. Warranty</h3>
    <p class="body-p">The Contractor warrants all labor for a period of 30 days after project completion. Plant materials are warranted for 30 days under normal care conditions. This warranty does not cover damage from drought, flooding, pests, or Client neglect.</p>

    <h3 class="section-title">7. Liability</h3>
    <p class="body-p">The Contractor carries general liability insurance. The Client is responsible for marking all underground utilities prior to project start. The Contractor is not liable for damage to unmarked underground lines or pre-existing conditions.</p>

    <h3 class="section-title">8. Governing Law</h3>
    <p class="body-p">This Agreement is governed by the laws of the State of Minnesota.</p>

    <div class="sig-block">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Client Signature &amp; Date</div>
      </div>
      <div>
        <div style="margin-top:8px;font-family:'Brush Script MT',cursive;font-size:32px;color:#1e3a5f;line-height:1.1;">Ryan Clark</div>
        <div class="sig-line" style="margin-top:4px;"></div>
        <div class="sig-label">Contractor Signature &amp; Date</div>
        <div class="sig-label" style="margin-top:4px;font-weight:600;color:#374151;">Ryan Clark — Snow Bro's</div>
        <div class="sig-label" style="margin-top:2px;">${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
    </div>`;

  return contractShell(
    `${yr} Landscape Service Agreement`,
    '#92400e', '#fef9c3', '🌱 Landscape',
    'SNOW BRO\'S',
    body
  );
}

// ─── Template 4: Junk Removal / Construction Clean-Up Agreement ─────────────
function buildJunkRemovalHtml({
  clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail,
  startDate, endDate, ratePerVisit, monthlyRate, paymentTerms, serviceDetails, year
}) {
  const yr = year || new Date().getFullYear();
  const startFmt = fmtDate(startDate);
  const endFmt   = fmtDate(endDate);
  const flatRate = ratePerVisit ? `$${money(ratePerVisit)} flat rate` : null;
  const hourlyRate = monthlyRate ? `$${money(monthlyRate)}/hr` : null;

  const body = `
    <div class="meta-grid">
      <div class="meta-item"><div class="meta-label">Client</div><div class="meta-value">${clientName}</div></div>
      <div class="meta-item"><div class="meta-label">Service Date</div><div class="meta-value">${startFmt || 'TBD'}</div></div>
      ${flatRate ? `<div class="meta-item"><div class="meta-label">Flat Rate</div><div class="meta-value">${flatRate}</div></div>` : ''}
      ${hourlyRate ? `<div class="meta-item"><div class="meta-label">Hourly Rate</div><div class="meta-value">${hourlyRate}</div></div>` : ''}
      <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value"><span style="background:#fef9c3;color:#92400e;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">⏳ Pending Signature</span></div></div>
    </div>

    <h3 class="section-title">1. Parties</h3>
    <div class="parties">${clientBlock(clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail)}</div>

    <h3 class="section-title">2. Scope of Work</h3>
    <p class="body-p">Contractor agrees to provide junk removal and/or construction clean-up services at the Client's property on the date(s) specified above. The scope of work includes:</p>
    <div class="highlight-box">${serviceDetails || 'Haul-away of junk, debris, and construction waste. All items to be removed from designated area. Client responsible for ensuring access to the property.'}</div>

    <h3 class="section-title">3. Service Date &amp; Access</h3>
    <p class="body-p"><strong>Service Date:</strong> ${startFmt || 'To be scheduled'}</p>
    ${endFmt && endFmt !== startFmt ? `<p class="body-p"><strong>Estimated Completion:</strong> ${endFmt}</p>` : ''}
    <p class="body-p">Client agrees to provide clear access to the property and all areas where items are to be removed. Any hazardous materials (chemicals, asbestos, biohazards) are excluded from this agreement and must be disclosed prior to service.</p>

    <h3 class="section-title">4. Compensation &amp; Payment Terms</h3>
    <table class="data">
      <thead><tr><th>Item</th><th>Amount</th></tr></thead>
      <tbody>
        ${flatRate ? `<tr><td>Flat Rate (all-inclusive)</td><td>${flatRate}</td></tr>` : ''}
        ${hourlyRate ? `<tr><td>Hourly Rate</td><td>${hourlyRate}</td></tr>` : ''}
        <tr><td>Payment Terms</td><td>${paymentTerms || 'Due upon completion of service'}</td></tr>
      </tbody>
    </table>

    <h3 class="section-title">5. Disposal &amp; Recycling</h3>
    <p class="body-p">Contractor will make reasonable efforts to recycle or donate items where feasible. All remaining items will be disposed of at a licensed facility. Disposal fees are included in the quoted rate unless otherwise noted.</p>

    <h3 class="section-title">6. Cancellation &amp; Changes</h3>
    <p class="body-p">Either party may cancel or reschedule with 24 hours written notice. Same-day cancellations may be subject to a $50 trip fee. Additional items not included in the original scope may be subject to additional charges, which will be communicated and agreed upon before proceeding.</p>

    <h3 class="section-title">7. Liability</h3>
    <p class="body-p">Contractor carries general liability insurance. Contractor is not responsible for pre-existing damage to driveways, lawns, or structures. Client warrants that all items designated for removal are owned by the Client or that the Client has authority to dispose of them.</p>

    <h3 class="section-title">8. Governing Law</h3>
    <p class="body-p">This agreement shall be governed by the laws of the State of Minnesota. Any disputes shall be resolved in Clay County, MN.</p>

    <div class="sig-block">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Client Signature &amp; Date</div>
        <div class="sig-label" style="margin-top:4px;font-weight:600;color:#374151;">${clientName}</div>
      </div>
      <div>
        <div style="margin-top:8px;font-family:'Brush Script MT',cursive;font-size:32px;color:#1e3a5f;line-height:1.1;">Ryan Clark</div>
        <div class="sig-line" style="margin-top:4px;"></div>
        <div class="sig-label">Contractor Signature &amp; Date</div>
        <div class="sig-label" style="margin-top:4px;font-weight:600;color:#374151;">Ryan Clark — Snow Bro's</div>
        <div class="sig-label" style="margin-top:2px;">${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
    </div>`;

  return contractShell(
    `${yr} Junk Removal / Construction Clean-Up Agreement`,
    '#7c3aed', '#fdf4ff', '\uD83D\uDE9B Junk Removal',
    'SNOW BRO\u2019S',
    body
  );
}

// ─── Router: pick the right template ────────────────────────────────────────
function buildContractHtml(fields) {
  const t = fields.contractType || fields.contract_type || 'lawn_care';
  if (t === 'snow_removal')  return buildSnowRemovalHtml(fields);
  if (t === 'landscape')     return buildLandscapeHtml(fields);
  if (t === 'junk_removal')  return buildJunkRemovalHtml(fields);
  return buildLawnCareHtml(fields);
}

// ── GET /template — default field values for the generate form ───────────────
router.get('/template', authenticateToken, requireAdmin, (req, res) => {
  const yr = new Date().getFullYear();
  res.json({
    year: yr,
    contractTypes: [
      { value: 'lawn_care',    label: '\uD83C\uDF3F Lawn Care' },
      { value: 'snow_removal', label: '\u2744\uFE0F Snow Removal' },
      { value: 'landscape',   label: '\uD83C\uDF31 Landscape' },
      { value: 'junk_removal', label: '\uD83D\uDE9B Junk Removal / Construction Clean-Up' },
    ],
    frequencies: ['Weekly', 'Bi-weekly', 'Monthly', 'As needed'],
    defaults: {
      lawn_care: {
        start_date: `${yr}-04-01`, end_date: `${yr}-11-01`,
        monthly_rate: '200', frequency: 'Weekly',
        service_details: 'Weekly lawn mowing, edging, trimming, and blowing off hard surfaces.',
        payment_terms: 'Due on the 1st of each month.',
      },
      snow_removal: {
        start_date: `${yr}-11-01`, end_date: `${yr+1}-04-01`,
        rate_per_visit: '75', monthly_rate: '',
        service_details: 'Snow plowing of driveway and walkways. Salting/sanding of entry points. Services triggered by 2+ inch snowfall.',
        payment_terms: 'Due within 7 days of invoice.',
      },
      landscape: {
        start_date: `${yr}-05-01`, end_date: `${yr}-06-30`,
        project_description: 'Full landscape installation including grading, planting, and hardscape.',
        labor_hours: '20', labor_rate: '65',
        deposit_amount: '500', milestone1_desc: 'Upon 50% project completion', milestone1_amount: '500', final_payment_amount: '0',
        payment_terms: 'All payments due per schedule. Late payments subject to 1.5% monthly finance charge.',
        line_items: JSON.stringify([
          { name: 'Topsoil (cubic yard)', qty: 5, unitCost: 45 },
          { name: 'Mulch (cubic yard)',   qty: 3, unitCost: 38 },
          { name: 'Perennial plants',     qty: 12, unitCost: 18 },
        ]),
      },
      junk_removal: {
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        rate_per_visit: '150', monthly_rate: '',
        service_details: 'Haul-away of junk, debris, and construction waste as described. All items to be removed from designated area. Client responsible for ensuring access.',
        payment_terms: 'Due upon completion of service.',
      },
    },
  });
});

/// ── POST /preview — render HTML without saving (for live preview) ─────────────
router.post('/preview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    const contract_type = body.contract_type || 'lawn_care';
    let clientName = body.client_name_override || 'Client Name';
    let clientAddress = '', clientCity = '', clientState = '', clientZip = '', clientPhone = '', clientEmail = '';
    if (body.client_id) {
      const { rows } = await req.db.query('SELECT * FROM clients WHERE id = $1', [body.client_id]);
      const cl = rows[0];
      if (cl) {
        clientName    = body.client_name_override || `${cl.first_name} ${cl.last_name}`;
        clientAddress = cl.address || '';
        clientCity    = cl.city    || '';
        clientState   = cl.state   || '';
        clientZip     = cl.zip     || '';
        clientPhone   = cl.phone   || '';
        clientEmail   = cl.email   || '';
      }
    }
    const html = buildContractHtml({
      contractType: contract_type,
      clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail,
      startDate: body.start_date, endDate: body.end_date,
      year: new Date().getFullYear(),
      // Lawn Care fields
      monthlyRate: body.monthly_rate || body.rate,
      frequency: body.frequency,
      serviceDetails: body.service_details,
      paymentTerms: body.payment_terms,
      // Snow Removal fields
      ratePerVisit: body.rate_per_visit,
      // Landscape fields
      projectDescription: body.project_description,
      lineItems: body.line_items,
      laborHours: body.labor_hours,
      laborRate: body.labor_rate,
      depositAmount: body.deposit_amount,
      milestone1Desc: body.milestone1_desc,
      milestone1Amount: body.milestone1_amount,
      finalPaymentAmount: body.final_payment_amount,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('<h1>Preview error</h1><p>' + err.message + '</p>');
  }
});

// ── Admin: generate + create contract and send email ─────────────────────────
router.post('/generate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    const { title, client_id, contract_type } = body;

    if (!title || !client_id || !contract_type) {
      return res.status(400).json({ error: 'Title, client, and contract type required' });
    }

    // Fetch client info
    const { rows: clients } = await req.db.query(
      'SELECT * FROM clients WHERE id = $1', [client_id]
    );
    const client = clients[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const signToken = uuidv4();
    // Build the full contract HTML server-side using the correct template
    const generatedHtml = buildContractHtml({
      contractType: contract_type,
      clientName: `${client.first_name} ${client.last_name}`,
      clientAddress: client.address || '',
      clientCity:    client.city    || '',
      clientState:   client.state   || '',
      clientZip:     client.zip     || '',
      clientPhone:   client.phone   || '',
      clientEmail:   client.email   || '',
      startDate: body.start_date, endDate: body.end_date,
      year: new Date().getFullYear(),
      // Lawn Care
      monthlyRate: body.monthly_rate || body.rate,
      frequency: body.frequency,
      serviceDetails: body.service_details,
      paymentTerms: body.payment_terms,
      // Snow Removal
      ratePerVisit: body.rate_per_visit,
      // Landscape
      projectDescription: body.project_description,
      lineItems: body.line_items,
      laborHours: body.labor_hours,
      laborRate: body.labor_rate,
      depositAmount: body.deposit_amount,
      milestone1Desc: body.milestone1_desc,
      milestone1Amount: body.milestone1_amount,
      finalPaymentAmount: body.final_payment_amount,
    });

    // Store a summary rate/deposit for the contracts table
    const rateForDb    = body.monthly_rate || body.rate || body.rate_per_visit || '';
    const depositForDb = body.deposit_amount || body.deposit || '0';
    const freqForDb    = body.frequency || '';
    const detailsForDb = body.service_details || body.project_description || '';
    const start_date   = body.start_date || '';
    const end_date     = body.end_date   || '';

    const { rows: result } = await req.db.query(`
      INSERT INTO contracts
        (title, client_id, uploaded_by, contract_type, service_category, rate, start_date, end_date,
         deposit, frequency, service_details, sign_token, contract_html, filename, original_name, file_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id`,
      [
        title, client_id, req.user.id, contract_type, body.service_category || '',
        rateForDb, start_date, end_date, depositForDb,
        freqForDb, detailsForDb,
        signToken, generatedHtml, 'generated', 'Generated Contract', 'generated'
      ]
    );

    const contractId = result[0].id;
    const signingUrl = `${BASE_URL}/sign-contract/${signToken}`;
    const clientName = `${client.first_name} ${client.last_name}`;

    // Send email to client
    if (client.email && !client.email.includes('@snowbros.placeholder')) {
      const contractTypeName = contract_type === 'snow_removal' ? 'Snow Removal' : contract_type === 'landscape' ? 'Landscape' : contract_type === 'junk_removal' ? 'Junk Removal / Construction Clean-Up' : 'Lawn Care';
      const emailHtml = wrapEmail(`
        <h2 style="color:#1e40af;margin-top:0;">Your ${contractTypeName} Service Contract</h2>
        <p>Hi ${client.first_name},</p>
        <p>
          <strong>Snow Bro's</strong> has prepared a <strong>${contractTypeName} Service Agreement</strong> for you.
          Please review and e-sign the contract using the button below.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
          <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Contract Type</td><td style="padding:10px 14px;color:#1e40af;">${contractTypeName}</td></tr>
          ${start_date ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Start Date</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${start_date}</td></tr>` : ''}
          ${end_date ? `<tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">End Date</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${end_date}</td></tr>` : ''}
          ${rateForDb ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Rate</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">$${rateForDb}</td></tr>` : ''}
          ${depositForDb && depositForDb !== '0' ? `<tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Deposit Due at Signing</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">$${depositForDb}</td></tr>` : ''}
          ${freqForDb ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Service Frequency</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${freqForDb}</td></tr>` : ''}
        </table>
        <div style="text-align:center;margin:32px 0;">
          <a href="${signingUrl}"
             style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                    padding:16px 36px;border-radius:8px;font-size:16px;font-weight:700;
                    letter-spacing:.02em;">
            ✍️ Review &amp; Sign Contract
          </a>
        </div>
        <p style="font-size:13px;color:#6b7280;">
          Or copy and paste this link into your browser:<br>
          <a href="${signingUrl}" style="color:#1d4ed8;">${signingUrl}</a>
        </p>
        <p style="font-size:13px;color:#6b7280;">
          If you have any questions, please call us at <strong>${BUSINESS.phone}</strong> or reply to this email.
        </p>
      `, `${contractTypeName} Contract`);

      try {
        await sendMail({
          to: client.email,
          subject: `Action Required: Sign Your ${contractTypeName} Service Agreement — Snow Bro's`,
          html: emailHtml
        });
        console.log(`[CONTRACTS] Contract email sent to ${client.email}`);
      } catch (emailErr) {
        console.error('[CONTRACTS] Email failed:', emailErr.message);
        // Don't fail the whole request if email fails — contract is still saved
      }
    }

    res.status(201).json({
      id: contractId,
      sign_token: signToken,
      signing_url: signingUrl,
      message: 'Contract generated and email sent'
    });
  } catch (err) {
    console.error('[CONTRACTS] Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: upload + create contract ──────────────────────────────────────────
router.post('/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { title, description, client_id } = req.body;
    if (!title || !client_id) return res.status(400).json({ error: 'Title and client required' });

    const { rows: result } = await req.db.query(`
      INSERT INTO contracts
        (title, description, client_id, filename, original_name, file_path, uploaded_by, contract_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploaded')
      RETURNING id`,
      [title, description || '', client_id, req.file.filename, req.file.originalname, req.file.path, req.user.id]
    );

    res.status(201).json({ id: result[0].id, message: 'Contract uploaded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: list all contracts ─────────────────────────────────────────────────
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: contracts } = await req.db.query(`
      SELECT c.*, cl.first_name || ' ' || cl.last_name AS client_name, cl.email AS client_email,
             COALESCE(e.first_name || ' ' || e.last_name, 'Admin') AS uploaded_by_name
      FROM contracts c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN employees e ON c.uploaded_by = e.id
      ORDER BY c.created_at DESC`);
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public: get contract by token ─────────────────────────────────────────────
router.get('/public/:token', async (req, res) => {
  try {
    const { rows: __contracts } = await req.db.query(`
      SELECT c.*, cl.first_name || ' ' || cl.last_name AS client_name, cl.email AS client_email,
             cl.phone AS client_phone, cl.address AS client_address, cl.city AS client_city,
             cl.state AS client_state, cl.zip AS client_zip
      FROM contracts c
      JOIN clients cl ON c.client_id = cl.id
      WHERE c.sign_token = $1`, [req.params.token]);
    
    const contract = __contracts[0];
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public: sign contract by token ────────────────────────────────────────────
router.post('/public/:token/sign', async (req, res) => {
  try {
    const { rows: __contracts } = await req.db.query(`
      SELECT c.*, cl.email AS client_email, cl.first_name || ' ' || cl.last_name AS client_name,
             cl.first_name AS client_first_name
      FROM contracts c
      JOIN clients cl ON c.client_id = cl.id
      WHERE c.sign_token = $1`, [req.params.token]);
    
    const contract = __contracts[0];
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.status === 'signed') return res.status(400).json({ error: 'Already signed' });

    const { signature_data, signature_type, signer_name } = req.body;
    if (!signature_data || !signer_name) {
      return res.status(400).json({ error: 'Signature and signer name required' });
    }

    const signedAt = new Date().toISOString();
    const signedAtFormatted = new Date(signedAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    // Update DB
    await req.db.query(`
      UPDATE contracts
      SET status='signed', signed_at=$1, signature_data=$2, signature_type=$3, signer_name=$4
      WHERE id=$5`, [signedAt, signature_data, signature_type || 'drawn', signer_name, contract.id]);

    const contractTypeName = contract.contract_type === 'snow_removal' ? 'Snow Removal' : 'Lawn Care';

    // Send confirmation email to client
    if (contract.client_email && !contract.client_email.includes('@snowbros.placeholder')) {
      const clientEmailHtml = wrapEmail(`
        <h2 style="color:#16a34a;margin-top:0;">✅ Contract Signed Successfully</h2>
        <p>Hi ${contract.client_first_name || signer_name},</p>
        <p>
          Thank you for signing your <strong>${contractTypeName} Service Agreement</strong> with Snow Bro's.
          Your contract has been received and is now on file.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
          <tr style="background:#f0fdf4;"><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Signed By</td><td style="padding:10px 14px;color:#374151;">${signer_name}</td></tr>
          <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Date Signed</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${signedAtFormatted}</td></tr>
          <tr style="background:#f0fdf4;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Contract Type</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${contractTypeName} Service Agreement</td></tr>
          ${contract.start_date ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Service Start</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${contract.start_date}</td></tr>` : ''}
          ${contract.end_date ? `<tr style="background:#f0fdf4;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Service End</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${contract.end_date}</td></tr>` : ''}
          ${contract.rate ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Monthly Rate</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">$${contract.rate}/month</td></tr>` : ''}
        </table>
        <p>
          We look forward to serving you this season! If you have any questions, please call
          <strong>${BUSINESS.phone}</strong> or email <a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a>.
        </p>
        <p style="font-size:13px;color:#6b7280;">
          Please keep this email for your records as confirmation of your signed agreement.
        </p>
      `, `${contractTypeName} Contract — Signed`);

      try {
        await sendMail({
          to: contract.client_email,
          subject: `Contract Signed — ${contractTypeName} Service Agreement with Snow Bro's`,
          html: clientEmailHtml
        });
      } catch (emailErr) {
        console.error('[CONTRACTS] Client confirmation email failed:', emailErr.message);
      }
    }

    // Send notification to admin (Ryan)
    const adminNotifyHtml = wrapEmail(`
      <h2 style="color:#1e40af;margin-top:0;">📋 Contract Signed — Action Required</h2>
      <p>A client has signed their service contract. Details below:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Client Name</td><td style="padding:10px 14px;color:#374151;">${contract.client_name}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Signed By</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${signer_name}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Contract Type</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${contractTypeName}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Date Signed</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${signedAtFormatted}</td></tr>
        ${contract.rate ? `<tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Rate</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">$${contract.rate}/month</td></tr>` : ''}
        ${contract.start_date ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Start Date</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${contract.start_date}</td></tr>` : ''}
        ${contract.end_date ? `<tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">End Date</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${contract.end_date}</td></tr>` : ''}
      </table>
      <div style="text-align:center;margin:24px 0;">
        <a href="${BASE_URL}/admin/contracts"
           style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">
          View in Admin Panel
        </a>
      </div>
    `, 'Contract Signed');

    try {
      await sendMail({
        to: 'clarkryan977@gmail.com',
        subject: `✅ Contract Signed by ${signer_name} — ${contractTypeName}`,
        html: adminNotifyHtml
      });
    } catch (emailErr) {
      console.error('[CONTRACTS] Admin notification email failed:', emailErr.message);
    }

    res.json({ message: 'Contract signed successfully', signed_at: signedAt });
  } catch (err) {
    console.error('[CONTRACTS] Sign error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: resend contract email ──────────────────────────────────────────────
router.post('/:id/resend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __contracts } = await req.db.query(`
      SELECT c.*, cl.email AS client_email, cl.first_name, cl.last_name
      FROM contracts c JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = $1`, [req.params.id]);
    
    const contract = __contracts[0];
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (!contract.client_email || contract.client_email.includes('@snowbros.placeholder')) {
      return res.status(400).json({ error: 'Client has no valid email address' });
    }

    const signingUrl = `${BASE_URL}/sign-contract/${contract.sign_token}`;
    const contractTypeName = contract.contract_type === 'snow_removal' ? 'Snow Removal' : 'Lawn Care';

    const emailHtml = wrapEmail(`
      <h2 style="color:#1e40af;margin-top:0;">Your ${contractTypeName} Service Contract</h2>
      <p>Hi ${contract.first_name},</p>
      <p>
        This is a reminder to review and sign your <strong>${contractTypeName} Service Agreement</strong> with Snow Bro's.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${signingUrl}"
           style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                  padding:16px 36px;border-radius:8px;font-size:16px;font-weight:700;">
          ✍️ Review &amp; Sign Contract
        </a>
      </div>
      <p style="font-size:13px;color:#6b7280;">
        Signing link: <a href="${signingUrl}" style="color:#1d4ed8;">${signingUrl}</a>
      </p>
    `, `${contractTypeName} Contract`);

    await sendMail({
      to: contract.client_email,
      subject: `Reminder: Sign Your ${contractTypeName} Service Agreement — Snow Bro's`,
      html: emailHtml
    });

    res.json({ message: 'Contract email resent', signing_url: signingUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: list their own contracts ─────────────────────────────────────────
router.get('/my', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });
    const { rows: contracts } = await req.db.query(`
      SELECT id, title, description, original_name, status, signed_at, signer_name, created_at, sign_token
      FROM contracts WHERE client_id = $1 ORDER BY created_at DESC`, [req.user.id]);
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single contract metadata ──────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { rows: __contracts } = await req.db.query(`
      SELECT c.*, cl.first_name || ' ' || cl.last_name AS client_name, cl.email AS client_email
      FROM contracts c JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = $1`, [req.params.id]);
    const contract = __contracts[0];
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    if (req.user.role === 'client' && contract.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── View contract as rendered HTML page (no auth required — uses sign_token or id) ──────────────
router.get('/:id/view', async (req, res) => {
  try {
    const { rows: __contract } = await req.db.query(`
      SELECT c.*, cl.first_name || ' ' || cl.last_name AS client_name, cl.email AS client_email,
             cl.address AS client_address, cl.city AS client_city, cl.state AS client_state, cl.zip AS client_zip
      FROM contracts c JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = $1`, [req.params.id]);
    const contract = __contract[0];
    if (!contract) return res.status(404).send('<h1>Contract not found</h1>');

    // ── CASE 1: Generated contract (has contract_html from contractShell) ──────
    // contractShell() always returns a complete <!DOCTYPE html> page with its own
    // print button, styles, and signature section. Serve it DIRECTLY — never wrap.
    if (contract.contract_html) {
      let fullHtml = contract.contract_html;

      // If the contract has been signed, inject the signature block before </body>
      if (contract.status === 'signed' && contract.signature_data) {
        const signatureBlock = `
<div style="max-width:860px;margin:24px auto;padding:0 24px 48px">
  <div style="margin-top:40px;padding:24px;border:2px solid #16a34a;border-radius:10px;background:#f0fdf4;">
    <h3 style="color:#15803d;margin:0 0 12px;">✅ Electronic Signature</h3>
    <p style="margin:4px 0;"><strong>Signed by:</strong> ${contract.signer_name || ''}</p>
    <p style="margin:4px 0;"><strong>Date:</strong> ${contract.signed_at ? new Date(contract.signed_at).toLocaleString('en-US') : ''}</p>
    ${contract.signature_type === 'drawn'
      ? `<div style="margin-top:12px;"><img src="${contract.signature_data}" alt="Signature" style="max-width:300px;border:1px solid #d1fae5;border-radius:4px;background:#fff;"></div>`
      : `<p style="margin-top:12px;font-family:cursive;font-size:28px;color:#1e3a5f;">${contract.signature_data}</p>`
    }
  </div>
</div>`;
        fullHtml = fullHtml.replace(/<\/body>\s*<\/html>\s*$/, signatureBlock + '\n</body>\n</html>');
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(fullHtml);
    }

    // ── CASE 2: Legacy uploaded-file contract (no contract_html) ──────────────
    // Build a simple viewer wrapper around whatever body content we have.
    const contractTypeName = contract.contract_type === 'snow_removal' ? 'Snow Removal' : 'Lawn Care';
    const statusBadge = contract.status === 'signed'
      ? `<span style="background:#dcfce7;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;">✅ Signed — ${contract.signer_name || ''} on ${contract.signed_at ? new Date(contract.signed_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : ''}</span>`
      : `<span style="background:#fef9c3;color:#92400e;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;">⏳ Pending Signature</span>`;

    const signatureBlock = contract.status === 'signed' && contract.signature_data
      ? `<div style="margin-top:40px;padding:24px;border:2px solid #16a34a;border-radius:10px;background:#f0fdf4;">
           <h3 style="color:#15803d;margin:0 0 12px;">✅ Electronic Signature</h3>
           <p style="margin:4px 0;"><strong>Signed by:</strong> ${contract.signer_name}</p>
           <p style="margin:4px 0;"><strong>Date:</strong> ${contract.signed_at ? new Date(contract.signed_at).toLocaleString('en-US') : ''}</p>
           ${contract.signature_type === 'drawn' ? `<div style="margin-top:12px;"><img src="${contract.signature_data}" alt="Signature" style="max-width:300px;border:1px solid #d1fae5;border-radius:4px;background:#fff;"></div>` : `<p style="margin-top:12px;font-family:cursive;font-size:28px;color:#1e3a5f;">${contract.signature_data}</p>`}
         </div>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${contract.title} — Snow Bro's</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1a1a2e; }
    .page-wrapper { max-width: 860px; margin: 0 auto; padding: 32px 24px 60px; }
    .print-bar { background: #1e3a5f; color: #fff; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .print-bar h2 { font-size: 16px; font-weight: 600; }
    .print-btn { background: #fff; color: #1e3a5f; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 700; font-size: 14px; cursor: pointer; }
    .print-btn:hover { background: #e0f2fe; }
    .contract-card { background: #fff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,.10); padding: 48px 52px; margin-top: 24px; position: relative; overflow: hidden; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 72px; font-weight: 900; color: rgba(30,58,95,.05); white-space: nowrap; pointer-events: none; user-select: none; z-index: 0; }
    .contract-content { position: relative; z-index: 1; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
    .meta-item { background: #f8fafc; border-radius: 8px; padding: 12px 16px; }
    .meta-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
    .meta-value { font-size: 14px; color: #1a1a2e; font-weight: 600; margin-top: 3px; }
    .body-section { margin-top: 28px; line-height: 1.7; font-size: 14px; color: #374151; }
    @media print {
      .print-bar { display: none !important; }
      body { background: #fff !important; }
      .contract-card { box-shadow: none !important; padding: 20px !important; }
      .page-wrapper { padding: 0 !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <h2>📄 ${contract.title}</h2>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>
  <div class="page-wrapper">
    <div class="contract-card">
      <div class="watermark">❄️ SNOW BRO'S</div>
      <div class="contract-content">
        <div class="meta-grid">
          <div class="meta-item"><div class="meta-label">Client</div><div class="meta-value">${contract.client_name}</div></div>
          <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value" style="margin-top:4px;">${statusBadge}</div></div>
        </div>
        <div class="body-section"><p style="color:#6b7280;font-style:italic;">This contract was uploaded as a file. Use the Download button to view it.</p></div>
        ${signatureBlock}
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[CONTRACTS] View error:', err);
    res.status(500).send('<h1>Error loading contract</h1><p>' + err.message + '</p>');
  }
});

// ── Serve the original contract file ─────────────────────────────────────────
router.get('/:id/file', authenticateToken, async (req, res) => {
  try {
    const { rows: __contract } = await req.db.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    const contract = __contract[0];
    if (!contract) return res.status(404).json({ error: 'Not found' });
    if (contract.contract_type === 'generated') return res.status(400).json({ error: 'Generated contracts do not have a static file' });
    
    if (req.user.role === 'client' && contract.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.setHeader('Content-Disposition', `inline; filename="${contract.original_name}"`);
    res.sendFile(contract.file_path);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: delete contract ────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __contract } = await req.db.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    const contract = __contract[0];
    if (!contract) return res.status(404).json({ error: 'Not found' });

    // Remove files if they exist
    if (contract.file_path && contract.file_path !== 'generated') {
      try { if (fs.existsSync(contract.file_path)) fs.unlinkSync(contract.file_path); } catch (_) {}
    }
    if (contract.signed_file_path) {
      try { if (fs.existsSync(contract.signed_file_path)) fs.unlinkSync(contract.signed_file_path); } catch (_) {}
    }

    await req.db.query('DELETE FROM contracts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Contract deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: delete ALL contracts (dev/reset) ─────────────────────────────────
router.delete('/all/purge', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Delete all physical files first
    const { rows: all } = await req.db.query('SELECT file_path, signed_file_path FROM contracts');
    for (const c of all) {
      if (c.file_path && c.file_path !== 'generated') {
        try { if (fs.existsSync(c.file_path)) fs.unlinkSync(c.file_path); } catch (_) {}
      }
      if (c.signed_file_path) {
        try { if (fs.existsSync(c.signed_file_path)) fs.unlinkSync(c.signed_file_path); } catch (_) {}
      }
    }
    const { rowCount } = await req.db.query('DELETE FROM contracts');
    res.json({ message: `Deleted ${rowCount} contracts`, count: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
