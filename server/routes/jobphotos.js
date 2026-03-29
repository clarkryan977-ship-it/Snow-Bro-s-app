const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { makeUploader, getFileInfo, deleteFile } = require('../utils/cloudinaryUpload');

const upload = makeUploader('snowbros/jobphotos', 'jobphotos', 10);

// ── GET photos for a time record ──────────────────────────────────────────────
router.get('/record/:recordId', authenticateToken, async (req, res) => {
  try {
    const { rows: photos } = await req.db.query(
      'SELECT * FROM job_photos WHERE time_record_id = $1 ORDER BY created_at ASC',
      [req.params.recordId]
    );
    res.json(photos);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST upload photo(s) for a time record ────────────────────────────────────
router.post('/record/:recordId', authenticateToken, upload.array('photos', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const recordId = req.params.recordId;
    // Verify the record belongs to this employee (unless admin)
    if (req.user.role !== 'admin') {
      const { rows: __record } = await req.db.query('SELECT * FROM time_records WHERE id = $1', [recordId]);
      const record = __record[0];
      if (!record || record.employee_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const inserted = [];
    for (const file of req.files) {
      const { url: filePath, filename } = getFileInfo(file, 'jobphotos');
      const result = await req.db.query(
        `INSERT INTO job_photos (time_record_id, employee_id, filename, original_name, file_path, caption)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [recordId, req.user.id, filename, file.originalname, filePath, req.body.caption || '']
      );
      const { rows: __p } = await req.db.query('SELECT * FROM job_photos WHERE id = $1', [result.rows[0].id]);
      inserted.push(__p[0]);
    }
    res.status(201).json(inserted);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE a job photo ────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { rows: __photo } = await req.db.query('SELECT * FROM job_photos WHERE id = $1', [req.params.id]);
    const photo = __photo[0];
    if (!photo) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && photo.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteFile(photo.filename, 'jobphotos');
    await req.db.query('DELETE FROM job_photos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
