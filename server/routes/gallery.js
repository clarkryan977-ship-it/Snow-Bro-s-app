const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const GALLERY_DIR = path.join(process.env.UPLOADS_ROOT || path.join(__dirname, '../uploads'), 'gallery');
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
router.get('/', async (req, res) => {
  try {
    const { rows: photos } = await req.db.query('SELECT * FROM gallery_photos ORDER BY created_at DESC');
    res.json(photos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST upload gallery photo (admin only) ────────────────────────────────────
router.post('/', authenticateToken, requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { caption, description } = req.body;
    const filePath = `/uploads/gallery/${req.file.filename}`;
    const result = await req.db.query(`INSERT INTO gallery_photos (filename, original_name, file_path, caption, description, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [req.file.filename, req.file.originalname, filePath,
           caption || '', description || '', req.user.id]);
    const { rows: __photo } = await req.db.query('SELECT * FROM gallery_photos WHERE id = $1', [result[0].id]);
    const photo = __photo[0];
    res.status(201).json(photo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT update caption/description (admin only) ───────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { caption, description } = req.body;
    await req.db.query('UPDATE gallery_photos SET caption=$1, description=$2 WHERE id=$3', [caption || '', description || '', req.params.id]);
    const { rows: __photo } = await req.db.query('SELECT * FROM gallery_photos WHERE id = $1', [req.params.id]);
    const photo = __photo[0];
    res.json(photo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE gallery photo (admin only) ────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __photo } = await req.db.query('SELECT * FROM gallery_photos WHERE id = $1', [req.params.id]);
    const photo = __photo[0];
    if (!photo) return res.status(404).json({ error: 'Not found' });
    const fullPath = path.join(__dirname, '../uploads/gallery', photo.filename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    await req.db.query('DELETE FROM gallery_photos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
