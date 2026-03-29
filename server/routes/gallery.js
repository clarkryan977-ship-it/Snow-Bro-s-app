const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { makeUploader, getFileInfo, deleteFile } = require('../utils/cloudinaryUpload');

const upload = makeUploader('snowbros/gallery', 'gallery', 10);

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
    const { url: filePath, filename } = getFileInfo(req.file, 'gallery');
    const result = await req.db.query(
      `INSERT INTO gallery_photos (filename, original_name, file_path, caption, description, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [filename, req.file.originalname, filePath, caption || '', description || '', req.user.id]
    );
    const { rows: __photo } = await req.db.query('SELECT * FROM gallery_photos WHERE id = $1', [result.rows[0].id]);
    res.status(201).json(__photo[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT update caption/description (admin only) ───────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { caption, description } = req.body;
    await req.db.query('UPDATE gallery_photos SET caption=$1, description=$2 WHERE id=$3', [caption || '', description || '', req.params.id]);
    const { rows: __photo } = await req.db.query('SELECT * FROM gallery_photos WHERE id = $1', [req.params.id]);
    res.json(__photo[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE gallery photo (admin only) ────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __photo } = await req.db.query('SELECT * FROM gallery_photos WHERE id = $1', [req.params.id]);
    const photo = __photo[0];
    if (!photo) return res.status(404).json({ error: 'Not found' });
    await deleteFile(photo.filename, 'gallery');
    await req.db.query('DELETE FROM gallery_photos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
