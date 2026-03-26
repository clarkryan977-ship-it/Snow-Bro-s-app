const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const GALLERY_DIR = path.join(__dirname, '../uploads/gallery');
if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GALLERY_DIR),
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

// ── GET all gallery photos (public) ──────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const photos = req.db.prepare('SELECT * FROM gallery_photos ORDER BY created_at DESC').all();
    res.json(photos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST upload gallery photo (admin only) ────────────────────────────────────
router.post('/', authenticateToken, requireAdmin, upload.single('photo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { caption, description } = req.body;
    const filePath = `/uploads/gallery/${req.file.filename}`;
    const result = req.db.prepare(`
      INSERT INTO gallery_photos (filename, original_name, file_path, caption, description, uploaded_by)
      VALUES (?,?,?,?,?,?)
    `).run(req.file.filename, req.file.originalname, filePath,
           caption || '', description || '', req.user.id);
    const photo = req.db.prepare('SELECT * FROM gallery_photos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(photo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT update caption/description (admin only) ───────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { caption, description } = req.body;
    req.db.prepare('UPDATE gallery_photos SET caption=?, description=? WHERE id=?')
      .run(caption || '', description || '', req.params.id);
    const photo = req.db.prepare('SELECT * FROM gallery_photos WHERE id = ?').get(req.params.id);
    res.json(photo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE gallery photo (admin only) ────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const photo = req.db.prepare('SELECT * FROM gallery_photos WHERE id = ?').get(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Not found' });
    const fullPath = path.join(__dirname, '../uploads/gallery', photo.filename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    req.db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
