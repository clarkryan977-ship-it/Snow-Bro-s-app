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
router.get('/record/:recordId', authenticateToken, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query('SELECT * FROM before_after_photos WHERE time_record_id = $1 ORDER BY photo_type ASC, created_at ASC', [req.params.recordId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST upload a before or after photo
router.post('/record/:recordId', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { photo_type, caption } = req.body;
    if (!['before', 'after'].includes(photo_type)) return res.status(400).json({ error: 'photo_type must be before or after' });
    const filePath = `/uploads/beforeafter/${req.file.filename}`;
    const info = await req.db.query('INSERT INTO before_after_photos (time_record_id, employee_id, photo_type, filename, original_name, file_path, caption) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [req.params.recordId, req.user.id, photo_type, req.file.filename, req.file.originalname, filePath, caption || '']);
    res.json({ id: info[0].id, file_path: filePath });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE a before/after photo
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { rows: __photo } = await req.db.query('SELECT * FROM before_after_photos WHERE id = $1', [req.params.id]);
    const photo = __photo[0];
    if (!photo) return res.status(404).json({ error: 'Not found' });
    const fullPath = path.join(uploadDir, photo.filename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    await req.db.query('DELETE FROM before_after_photos WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
