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

// ── Contract HTML template builder ─────────────────────────────────────────────
// Based on the 2026 Lawn Care Service Agreement (Lisa Clark template).
// All dynamic values are substituted before saving.
function buildContractHtml({
  clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail,
  startDate, endDate, rate, deposit, frequency, serviceDetails, contractType, year
}) {
  const contractTypeName = contractType === 'snow_removal' ? 'Snow Removal' : 'Lawn Care';
  const yr  = year || new Date().getFullYear();
  const freq = frequency || 'Weekly';
  const dep  = parseFloat(deposit || 0).toFixed(2);
  const rt   = parseFloat(rate || 0).toFixed(2);
  const details = serviceDetails || `${freq} lawn mowing, trimming, and property maintenance.`;

  const fmtDate = raw => {
    if (!raw) return '';
    const d = new Date(raw + 'T12:00:00');
    return isNaN(d) ? raw : d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  };
  const startFmt = fmtDate(startDate);
  const endFmt   = fmtDate(endDate);

  const addrParts = [clientAddress];
  if (clientCity && clientState) addrParts.push(`${clientCity}, ${clientState} ${clientZip || ''}`.trim());
  const addrHtml = addrParts.filter(Boolean).join('<br/>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${yr} ${contractTypeName} Service Agreement</title>
  <style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .hdr{background:linear-gradient(135deg,#0f2557 0%,#1d4ed8 100%);color:#fff;padding:24px 32px}
    .hdr h1{margin:0;font-size:26px;font-weight:800}
    .hdr p{margin:4px 0 0;font-size:13px;opacity:.9}
    .body{padding:28px 32px}
    h2.section{font-size:15px;font-weight:700;color:#0f2557;border-bottom:2px solid #0f2557;padding-bottom:5px;margin:24px 0 10px}
    .parties{display:flex;gap:20px;margin-bottom:8px}
    .party{flex:1;background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:14px}
    .party strong{display:block;color:#0f2557;font-size:14px;font-weight:700;margin-bottom:6px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:14px}
    th,td{padding:9px 12px;text-align:left;border-bottom:1px solid #e5e7eb}
    th{background:#f0f4f8;font-weight:700;color:#0f2557}
    .highlight{color:#dc2626;font-weight:700;font-size:15px}
    p.body-p{font-size:14px;margin:6px 0}
    .ftr{background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;text-align:center;font-size:12px;color:#666;margin-top:32px}
  </style>
</head>
<body>
  <div class="hdr">
    <h1>Snow Bro's Lawn Care &amp; Snow Removal</h1>
    <p>1812 33rd St S, Moorhead, MN 56560 &nbsp;|&nbsp; 218-331-5145 &nbsp;|&nbsp; clarkryan977@gmail.com</p>
  </div>
  <div class="body">
    <h1 style="text-align:center;text-transform:uppercase;color:#0f2557;margin:0 0 24px;font-size:22px">${yr} ${contractTypeName} Service Agreement</h1>

    <h2 class="section">Agreement Parties</h2>
    <div class="parties">
      <div class="party">
        <strong>Client</strong>
        ${clientName}<br/>
        ${addrHtml}${addrHtml ? '<br/>' : ''}
        ${clientPhone ? `Phone: ${clientPhone}<br/>` : ''}
        ${clientEmail ? `Email: ${clientEmail}` : ''}
      </div>
      <div class="party">
        <strong>Contractor</strong>
        Snow Bro's (Ryan Clark)<br/>
        1812 33rd St S<br/>Moorhead, MN 56560<br/>
        Phone: 218-331-5145<br/>Email: clarkryan977@gmail.com
      </div>
    </div>

    <h2 class="section">1. Services Provided</h2>
    <p class="body-p"><strong>Service Type:</strong> ${contractTypeName}</p>
    <p class="body-p"><strong>Frequency:</strong> ${freq}</p>
    <p class="body-p"><strong>Details:</strong> ${details}</p>

    <h2 class="section">2. Term of Agreement</h2>
    ${startFmt ? `<p class="body-p"><strong>Effective Date:</strong> ${startFmt}</p>` : ''}
    ${endFmt   ? `<p class="highlight">Agreement Termination Date: ${endFmt}</p>` : ''}
    <p class="body-p">This Agreement commences on the Effective Date and terminates on the Termination Date above, unless earlier terminated by either party with 30 days written notice.</p>

    <h2 class="section">3. Compensation &amp; Payment Terms</h2>
    <table>
      <tr><th>Service Rate</th><td>$${rt} per ${freq.toLowerCase()}</td></tr>
      <tr><th>Deposit Required</th><td>$${dep}</td></tr>
      <tr><th>Payment Terms</th><td>Due upon completion of each service</td></tr>
    </table>

    <h2 class="section">4. Cancellation Policy</h2>
    <p class="body-p">Either party may terminate this agreement with 24 hours notice. Late cancellations may be subject to a service charge.</p>

    <h2 class="section">5. Liability &amp; Indemnification</h2>
    <p class="body-p">The Contractor will provide all necessary equipment and tools. The Contractor is an independent contractor and not an employee of the Client. The Contractor agrees to indemnify and hold harmless the Client against claims arising from the Contractor's gross negligence or willful misconduct.</p>

    <h2 class="section">6. Service Area</h2>
    <p class="body-p">Services are provided in Moorhead, MN and Fargo, ND and surrounding areas.</p>

    <h2 class="section">7. Governing Law</h2>
    <p class="body-p">This Agreement is governed by the laws of the State of Minnesota.</p>
  </div>
  <div class="ftr">
    <strong>Snow Bro's Lawn Care &amp; Snow Removal</strong> &bull; 1812 33rd St S, Moorhead, MN 56560 &bull; 218-331-5145
  </div>
</body>
</html>`;
}

// ── GET /template — default field values for the generate form ───────────────
router.get('/template', authenticateToken, requireAdmin, (req, res) => {
  const yr = new Date().getFullYear();
  res.json({
    year: yr,
    defaultStart: `${yr}-04-01`,
    defaultEnd:   `${yr}-11-01`,
    defaultRate: '200',
    defaultDeposit: '0',
    defaultFrequency: 'Weekly',
    defaultServiceDetails: 'Weekly lawn mowing, trimming, and property maintenance.',
    contractTypes: [
      { value: 'lawn_care',    label: 'Lawn Care' },
      { value: 'snow_removal', label: 'Snow Removal' },
    ],
    frequencies: ['Weekly', 'Bi-weekly', 'Monthly', 'As needed'],
  });
});

// ── POST /preview — render HTML without saving (for live preview) ─────────────
router.post('/preview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      client_id, contract_type, rate, start_date, end_date,
      deposit, frequency, service_details, client_name_override,
    } = req.body;

    let clientName = client_name_override || 'Client Name';
    let clientAddress = '', clientCity = '', clientState = '', clientZip = '', clientPhone = '', clientEmail = '';

    if (client_id) {
      const { rows } = await req.db.query('SELECT * FROM clients WHERE id = $1', [client_id]);
      const cl = rows[0];
      if (cl) {
        clientName    = client_name_override || `${cl.first_name} ${cl.last_name}`;
        clientAddress = cl.address || '';
        clientCity    = cl.city    || '';
        clientState   = cl.state   || '';
        clientZip     = cl.zip     || '';
        clientPhone   = cl.phone   || '';
        clientEmail   = cl.email   || '';
      }
    }

    const html = buildContractHtml({
      clientName, clientAddress, clientCity, clientState, clientZip, clientPhone, clientEmail,
      startDate: start_date, endDate: end_date,
      rate, deposit, frequency, serviceDetails: service_details,
      contractType: contract_type || 'lawn_care',
      year: new Date().getFullYear(),
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
    const {
      title, client_id, contract_type, service_category, rate,
      start_date, end_date, deposit, frequency, service_details, contract_html
    } = req.body;

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
    // Build the full contract HTML server-side using the Lisa Clark template
    const generatedHtml = buildContractHtml({
      clientName: `${client.first_name} ${client.last_name}`,
      clientAddress: client.address || '',
      clientCity:    client.city    || '',
      clientState:   client.state   || '',
      clientZip:     client.zip     || '',
      clientPhone:   client.phone   || '',
      clientEmail:   client.email   || '',
      startDate: start_date, endDate: end_date,
      rate, deposit, frequency: frequency || 'Weekly',
      serviceDetails: service_details,
      contractType: contract_type,
      year: new Date().getFullYear(),
    });
    const { rows: result } = await req.db.query(`
      INSERT INTO contracts
        (title, client_id, uploaded_by, contract_type, service_category, rate, start_date, end_date,
         deposit, frequency, service_details, sign_token, contract_html, filename, original_name, file_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id`,
      [
        title, client_id, req.user.id, contract_type, service_category || '',
        rate || '', start_date || '', end_date || '', deposit || '0',
        frequency || 'Weekly', service_details || '',
        signToken, generatedHtml, 'generated', 'Generated Contract', 'generated'
      ]
    );

    const contractId = result[0].id;
    const signingUrl = `${BASE_URL}/sign-contract/${signToken}`;
    const clientName = `${client.first_name} ${client.last_name}`;

    // Send email to client
    if (client.email && !client.email.includes('@snowbros.placeholder')) {
      const contractTypeName = contract_type === 'snow_removal' ? 'Snow Removal' : 'Lawn Care';
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
          ${rate ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Monthly Rate</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">$${rate}/month</td></tr>` : ''}
          ${deposit && deposit !== '0' ? `<tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Deposit Due at Signing</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">$${deposit}</td></tr>` : ''}
          ${frequency ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;">Service Frequency</td><td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${frequency}</td></tr>` : ''}
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

    const contractBody = contract.contract_html && contract.contract_html !== ''
      ? contract.contract_html
      : `<p style="color:#6b7280;font-style:italic;">No contract content available.</p>`;

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
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #1e3a5f; padding-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 52px; height: 52px; background: #1e3a5f; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
    .brand-name { font-size: 22px; font-weight: 800; color: #1e3a5f; line-height: 1.1; }
    .brand-sub { font-size: 12px; color: #64748b; }
    .contract-meta { text-align: right; }
    .contract-meta h1 { font-size: 20px; color: #1e3a5f; font-weight: 700; }
    .contract-meta .type-badge { background: #eff6ff; color: #1d4ed8; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-top: 6px; display: inline-block; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
    .meta-item { background: #f8fafc; border-radius: 8px; padding: 12px 16px; }
    .meta-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
    .meta-value { font-size: 14px; color: #1a1a2e; font-weight: 600; margin-top: 3px; }
    .body-section { margin-top: 28px; line-height: 1.7; font-size: 14px; color: #374151; }
    .body-section h2, .body-section h3 { color: #1e3a5f; margin: 20px 0 8px; }
    .body-section p { margin-bottom: 12px; }
    .body-section ul, .body-section ol { padding-left: 20px; margin-bottom: 12px; }
    .status-row { margin-top: 28px; }
    @media print {
      .print-bar { display: none !important; }
      body { background: #fff; }
      .contract-card { box-shadow: none; padding: 0; }
      .page-wrapper { padding: 0; max-width: 100%; }
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
        <div class="header-row">
          <div class="brand">
            <div class="brand-icon">❄️</div>
            <div>
              <div class="brand-name">Snow Bro's</div>
              <div class="brand-sub">Professional Snow &amp; Lawn Services</div>
            </div>
          </div>
          <div class="contract-meta">
            <h1>${contract.title}</h1>
            <span class="type-badge">${contractTypeName} Service Agreement</span>
          </div>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><div class="meta-label">Client</div><div class="meta-value">${contract.client_name}</div></div>
          <div class="meta-item"><div class="meta-label">Email</div><div class="meta-value">${contract.client_email || '—'}</div></div>
          ${contract.start_date ? `<div class="meta-item"><div class="meta-label">Start Date</div><div class="meta-value">${contract.start_date}</div></div>` : ''}
          ${contract.end_date ? `<div class="meta-item"><div class="meta-label">End Date</div><div class="meta-value">${contract.end_date}</div></div>` : ''}
          ${contract.rate ? `<div class="meta-item"><div class="meta-label">Monthly Rate</div><div class="meta-value">$${contract.rate}/month</div></div>` : ''}
          ${contract.deposit && contract.deposit !== '0' ? `<div class="meta-item"><div class="meta-label">Deposit</div><div class="meta-value">$${contract.deposit}</div></div>` : ''}
          ${contract.frequency ? `<div class="meta-item"><div class="meta-label">Frequency</div><div class="meta-value">${contract.frequency}</div></div>` : ''}
          <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value" style="margin-top:4px;">${statusBadge}</div></div>
        </div>
        <div class="body-section">${contractBody}</div>
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

module.exports = router;
