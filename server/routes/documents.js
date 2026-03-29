const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getPool } = require('../db/init');

// Store files in memory, convert to base64 for DB storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, JPG, and PNG files are allowed'));
  }
});

// ── POST /api/documents/upload — Employee uploads a document
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const db = getPool();
    const empId = req.user.id;
    const { doc_type } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const base64Data = file.buffer.toString('base64');
    const result = await db.query(
      `INSERT INTO employee_documents (employee_id, doc_type, file_name, mime_type, file_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, doc_type, file_name, mime_type, uploaded_at`,
      [empId, doc_type || 'other', file.originalname, file.mimetype, base64Data]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// ── GET /api/documents/my — Employee gets their own documents
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, doc_type, file_name, mime_type, uploaded_at
       FROM employee_documents WHERE employee_id = $1 ORDER BY uploaded_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ── GET /api/documents/employee/:id — Admin gets documents for a specific employee
router.get('/employee/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, doc_type, file_name, mime_type, uploaded_at
       FROM employee_documents WHERE employee_id = $1 ORDER BY uploaded_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ── GET /api/documents/:id/download — Download/view a document (employee owns it or admin)
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const { rows } = await db.query(
      'SELECT * FROM employee_documents WHERE id = $1', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found' });

    const doc = rows[0];
    // Only allow if admin or the document owner
    if (req.user.role !== 'admin' && doc.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const buffer = Buffer.from(doc.file_data, 'base64');
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// ── DELETE /api/documents/:id — Delete a document (employee owns it or admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getPool();
    const { rows } = await db.query(
      'SELECT employee_id FROM employee_documents WHERE id = $1', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found' });

    if (req.user.role !== 'admin' && rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query('DELETE FROM employee_documents WHERE id = $1', [req.params.id]);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ── GET /api/documents/all — Admin gets all documents with employee names
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT ed.id, ed.doc_type, ed.file_name, ed.mime_type, ed.uploaded_at, ed.employee_id,
              e.first_name, e.last_name, e.email
       FROM employee_documents ed
       JOIN employees e ON ed.employee_id = e.id
       ORDER BY ed.uploaded_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch all documents' });
  }
});

module.exports = router;
