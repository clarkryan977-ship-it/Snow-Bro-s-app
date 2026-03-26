const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const uploadDir = path.join(process.env.UPLOADS_ROOT || path.join(__dirname, '../uploads'), 'beforeafter');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// GET before/after photos for a time record
router.get('/record/:recordId', authenticateToken, (req, res) => {
  try {
    const rows = req.db.prepare(
      'SELECT * FROM before_after_photos WHERE time_record_id = ? ORDER BY photo_type ASC, created_at ASC'
    ).all(req.params.recordId);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST upload a before or after photo
router.post('/record/:recordId', authenticateToken, upload.single('photo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { photo_type, caption } = req.body;
    if (!['before', 'after'].includes(photo_type)) return res.status(400).json({ error: 'photo_type must be before or after' });
    const filePath = `/uploads/beforeafter/${req.file.filename}`;
    const info = req.db.prepare(
      'INSERT INTO before_after_photos (time_record_id, employee_id, photo_type, filename, original_name, file_path, caption) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.params.recordId, req.user.id, photo_type, req.file.filename, req.file.originalname, filePath, caption || '');
    res.json({ id: info.lastInsertRowid, file_path: filePath });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE a before/after photo
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const photo = req.db.prepare('SELECT * FROM before_after_photos WHERE id = ?').get(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Not found' });
    const fullPath = path.join(uploadDir, photo.filename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    req.db.prepare('DELETE FROM before_after_photos WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
