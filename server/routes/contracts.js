const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { emailHeader, emailFooter, BUSINESS } = require('../utils/emailHeader');

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

// ── Admin: generate + create contract ────────────────────────────────────────
router.post('/generate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, client_id, contract_type, service_category, rate, start_date, contract_html } = req.body;
    if (!title || !client_id || !contract_type) {
      return res.status(400).json({ error: 'Title, client, and contract type required' });
    }

    const signToken = uuidv4();
    const { rows: result } = await req.db.query(`
      INSERT INTO contracts
        (title, client_id, uploaded_by, contract_type, service_category, rate, start_date, sign_token, contract_html, filename, original_name, file_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [title, client_id, req.user.id, contract_type, service_category || '', rate || '', start_date || '', signToken, contract_html || '', 'generated', 'Generated Contract', 'generated']
    );

    res.status(201).json({ id: result[0].id, sign_token: signToken, message: 'Contract generated' });
  } catch (err) {
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
      SELECT c.*, cl.email AS client_email, cl.first_name || ' ' || cl.last_name AS client_name
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
    
    // Update DB
    await req.db.query(`
      UPDATE contracts
      SET status='signed', signed_at=$1, signature_data=$2, signature_type=$3, signer_name=$4
      WHERE id=$5`, [signedAt, signature_data, signature_type || 'drawn', signer_name, contract.id]);

    // In a real app, we would generate the PDF here and send emails.
    // For now, we log the action.
    console.log(`Contract ${contract.id} signed by ${signer_name} at ${signedAt}`);

    res.json({ message: 'Contract signed successfully', signed_at: signedAt });
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
