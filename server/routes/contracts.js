const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || path.join(__dirname, '../uploads');
const CONTRACTS_DIR = path.join(UPLOADS_ROOT, 'contracts');
const SIGNED_DIR    = path.join(UPLOADS_ROOT, 'signed');

// Multer storage
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

// ── Admin: upload + create contract ──────────────────────────────────────────
router.post('/upload', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { title, description, client_id } = req.body;
    if (!title || !client_id) return res.status(400).json({ error: 'Title and client required' });

    const result = req.db.prepare(
      `INSERT INTO contracts
         (title, description, client_id, filename, original_name, file_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title,
      description || '',
      client_id,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.user.id
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Contract uploaded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: list all contracts ─────────────────────────────────────────────────
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const contracts = req.db.prepare(
      `SELECT c.*, cl.first_name || ' ' || cl.last_name AS client_name, cl.email AS client_email,
              e.first_name || ' ' || e.last_name AS uploaded_by_name
       FROM contracts c
       JOIN clients cl ON c.client_id = cl.id
       JOIN employees e ON c.uploaded_by = e.id
       ORDER BY c.created_at DESC`
    ).all();
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: list their own contracts ─────────────────────────────────────────
router.get('/my', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });
    const contracts = req.db.prepare(
      `SELECT id, title, description, original_name, status, signed_at, signer_name, created_at
       FROM contracts WHERE client_id = ? ORDER BY created_at DESC`
    ).all(req.user.id);
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single contract metadata ──────────────────────────────────────────────
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const contract = req.db.prepare(
      `SELECT c.*, cl.first_name || ' ' || cl.last_name AS client_name, cl.email AS client_email
       FROM contracts c JOIN clients cl ON c.client_id = cl.id
       WHERE c.id = ?`
    ).get(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    // Clients can only see their own
    if (req.user.role === 'client' && contract.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve the original contract file ─────────────────────────────────────────
router.get('/:id/file', authenticateToken, (req, res) => {
  try {
    const contract = req.db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'client' && contract.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.setHeader('Content-Disposition', `inline; filename="${contract.original_name}"`);
    res.sendFile(contract.file_path);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve the signed contract file ───────────────────────────────────────────
router.get('/:id/signed-file', authenticateToken, (req, res) => {
  try {
    const contract = req.db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!contract || !contract.signed_file_path) return res.status(404).json({ error: 'Signed file not found' });
    if (req.user.role === 'client' && contract.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="signed_${contract.original_name}"`);
    res.sendFile(contract.signed_file_path);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: sign a contract ───────────────────────────────────────────────────
// signature_data: base64 PNG data URL (drawn) OR plain text (typed name)
// signature_type: 'drawn' | 'typed'
router.post('/:id/sign', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });

    const contract = req.db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.client_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (contract.status === 'signed') return res.status(400).json({ error: 'Already signed' });

    const { signature_data, signature_type, signer_name } = req.body;
    if (!signature_data || !signer_name) {
      return res.status(400).json({ error: 'Signature and signer name required' });
    }

    const signedAt = new Date().toISOString();
    let signedFilePath = '';

    // Only embed signature into PDF files
    const ext = path.extname(contract.original_name).toLowerCase();
    if (ext === '.pdf') {
      try {
        const originalBytes = fs.readFileSync(contract.file_path);
        const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const { width, height } = lastPage.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Signature block background
        lastPage.drawRectangle({
          x: 40, y: 40,
          width: width - 80, height: 110,
          color: rgb(0.97, 0.99, 0.97),
          borderColor: rgb(0.2, 0.6, 0.2),
          borderWidth: 1,
          opacity: 0.9,
        });

        // Header text
        lastPage.drawText('ELECTRONICALLY SIGNED', {
          x: 50, y: 132,
          size: 9, font,
          color: rgb(0.2, 0.5, 0.2),
        });

        // Signer name
        lastPage.drawText(`Signed by: ${signer_name}`, {
          x: 50, y: 115,
          size: 11, font,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Timestamp
        const displayDate = new Date(signedAt).toLocaleString('en-US', {
          dateStyle: 'long', timeStyle: 'short',
        });
        lastPage.drawText(`Date & Time: ${displayDate}`, {
          x: 50, y: 98,
          size: 9, font,
          color: rgb(0.3, 0.3, 0.3),
        });

        // Signature type
        lastPage.drawText(`Signature method: ${signature_type === 'drawn' ? 'Drawn signature' : 'Typed name'}`, {
          x: 50, y: 82,
          size: 8, font,
          color: rgb(0.4, 0.4, 0.4),
        });

        // Embed drawn signature image if available
        if (signature_type === 'drawn' && signature_data.startsWith('data:image/png')) {
          try {
            const base64 = signature_data.replace(/^data:image\/png;base64,/, '');
            const sigBytes = Buffer.from(base64, 'base64');
            const sigImage = await pdfDoc.embedPng(sigBytes);
            const sigDims = sigImage.scale(0.35);
            lastPage.drawImage(sigImage, {
              x: width - sigDims.width - 50,
              y: 50,
              width: sigDims.width,
              height: sigDims.height,
            });
          } catch (_) { /* skip image embed on error */ }
        } else if (signature_type === 'typed') {
          // Render typed name in a cursive-style larger font
          lastPage.drawText(signer_name, {
            x: width - 220, y: 58,
            size: 22, font,
            color: rgb(0.05, 0.2, 0.6),
          });
        }

        const signedBytes = await pdfDoc.save();
        const signedFilename = `signed_${uuidv4()}.pdf`;
        signedFilePath = path.join(SIGNED_DIR, signedFilename);
        fs.writeFileSync(signedFilePath, signedBytes);
      } catch (pdfErr) {
        console.error('PDF embed error:', pdfErr.message);
        // Fall through — still record the signature even if PDF embed fails
      }
    }

    req.db.prepare(
      `UPDATE contracts
       SET status='signed', signed_at=?, signature_data=?, signature_type=?,
           signer_name=?, signed_file_path=?
       WHERE id=?`
    ).run(signedAt, signature_data, signature_type || 'drawn', signer_name, signedFilePath, contract.id);

    res.json({ message: 'Contract signed successfully', signed_at: signedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: delete contract ────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const contract = req.db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Not found' });

    // Remove files
    try { if (fs.existsSync(contract.file_path)) fs.unlinkSync(contract.file_path); } catch (_) {}
    try { if (contract.signed_file_path && fs.existsSync(contract.signed_file_path)) fs.unlinkSync(contract.signed_file_path); } catch (_) {}

    req.db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
    res.json({ message: 'Contract deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
