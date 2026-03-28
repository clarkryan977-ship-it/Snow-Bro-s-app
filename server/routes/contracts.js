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
        signToken, contract_html || '', 'generated', 'Generated Contract', 'generated'
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
             e.first_name || ' ' || e.last_name AS uploaded_by_name
      FROM contracts c
      JOIN clients cl ON c.client_id = cl.id
      JOIN employees e ON c.uploaded_by = e.id
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
