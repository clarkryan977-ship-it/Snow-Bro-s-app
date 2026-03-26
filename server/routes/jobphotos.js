const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const JOBS_DIR = path.join(__dirname, '../uploads/jobphotos');
if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, JOBS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// ── GET photos for a time record ──────────────────────────────────────────────
router.get('/record/:recordId', authenticateToken, (req, res) => {
  try {
    const photos = req.db.prepare(
      'SELECT * FROM job_photos WHERE time_record_id = ? ORDER BY created_at ASC'
    ).all(req.params.recordId);
    res.json(photos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST upload photo(s) for a time record ────────────────────────────────────
router.post('/record/:recordId', authenticateToken, upload.array('photos', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const recordId = req.params.recordId;
    // Verify the record belongs to this employee (unless admin)
    if (req.user.role !== 'admin') {
      const record = req.db.prepare('SELECT * FROM time_records WHERE id = ?').get(recordId);
      if (!record || record.employee_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const ins = req.db.prepare(`
      INSERT INTO job_photos (time_record_id, employee_id, filename, original_name, file_path, caption)
      VALUES (?,?,?,?,?,?)
    `);
    const inserted = [];
    for (const file of req.files) {
      const filePath = `/uploads/jobphotos/${file.filename}`;
      const result = ins.run(recordId, req.user.id, file.filename, file.originalname, filePath, req.body.caption || '');
      inserted.push(req.db.prepare('SELECT * FROM job_photos WHERE id = ?').get(result.lastInsertRowid));
    }
    res.status(201).json(inserted);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE a job photo ────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const photo = req.db.prepare('SELECT * FROM job_photos WHERE id = ?').get(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && photo.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const fullPath = path.join(__dirname, '../uploads/jobphotos', photo.filename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    req.db.prepare('DELETE FROM job_photos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
