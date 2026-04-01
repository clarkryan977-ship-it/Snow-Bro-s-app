const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { makeUploader, getFileInfo, deleteFile } = require('../utils/cloudinaryUpload');

const upload = makeUploader('snowbros/beforeafter', 'beforeafter', 15);

// ── GET before/after photos for a booking ────────────────────────────────────
router.get('/booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    if (req.user.role === 'client') {
      const { rows: bk } = await req.db.query('SELECT client_id, client_email FROM bookings WHERE id = $1', [bookingId]);
      if (!bk[0]) return res.status(404).json({ error: 'Booking not found' });
      const { rows: cl } = await req.db.query('SELECT email FROM clients WHERE id = $1', [req.user.id]);
      const clientEmail = cl[0]?.email || '';
      if (bk[0].client_id !== req.user.id && bk[0].client_email !== clientEmail) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const { rows } = await req.db.query(
      `SELECT p.*, e.first_name || ' ' || e.last_name AS employee_name
       FROM before_after_photos p
       LEFT JOIN employees e ON p.employee_id = e.id
       WHERE p.booking_id = $1
       ORDER BY p.photo_type ASC, p.created_at ASC`,
      [bookingId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET before/after photos for a route stop ─────────────────────────────────
router.get('/stop/:stopId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `SELECT p.*, e.first_name || ' ' || e.last_name AS employee_name
       FROM before_after_photos p
       LEFT JOIN employees e ON p.employee_id = e.id
       WHERE p.route_stop_id = $1
       ORDER BY p.photo_type ASC, p.created_at ASC`,
      [req.params.stopId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET before/after photos for a time record (legacy) ───────────────────────
router.get('/record/:recordId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      'SELECT * FROM before_after_photos WHERE time_record_id = $1 ORDER BY photo_type ASC, created_at ASC',
      [req.params.recordId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST upload a before or after photo for a booking ────────────────────────
router.post('/booking/:bookingId', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { photo_type, caption } = req.body;
    if (!['before', 'after'].includes(photo_type)) return res.status(400).json({ error: 'photo_type must be before or after' });
    const bookingId = req.params.bookingId;
    const { rows: bk } = await req.db.query('SELECT id FROM bookings WHERE id = $1', [bookingId]);
    if (!bk[0]) return res.status(404).json({ error: 'Booking not found' });

    const { url: filePath, filename } = getFileInfo(req.file, 'beforeafter');
    const { rows: inserted } = await req.db.query(
      `INSERT INTO before_after_photos (booking_id, employee_id, photo_type, filename, original_name, file_path, caption)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [bookingId, req.user.id, photo_type, filename, req.file.originalname, filePath, caption || '']
    );
    res.status(201).json(inserted[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST upload a before or after photo for a route stop ─────────────────────
router.post('/stop/:stopId', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { photo_type, caption } = req.body;
    if (!['before', 'after'].includes(photo_type)) return res.status(400).json({ error: 'photo_type must be before or after' });
    const stopId = req.params.stopId;

    // Check if the stop has a booking_id — if so, also link to booking
    const { rows: stopRows } = await req.db.query('SELECT booking_id FROM route_stops WHERE id = $1', [stopId]);
    if (!stopRows[0]) return res.status(404).json({ error: 'Route stop not found' });
    const bookingId = stopRows[0].booking_id || null;

    const { url: filePath, filename } = getFileInfo(req.file, 'beforeafter');
    const { rows: inserted } = await req.db.query(
      `INSERT INTO before_after_photos (route_stop_id, booking_id, employee_id, photo_type, filename, original_name, file_path, caption)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [stopId, bookingId, req.user.id, photo_type, filename, req.file.originalname, filePath, caption || '']
    );
    res.status(201).json(inserted[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST upload a before or after photo for a time record (legacy) ────────────
router.post('/record/:recordId', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { photo_type, caption } = req.body;
    if (!['before', 'after'].includes(photo_type)) return res.status(400).json({ error: 'photo_type must be before or after' });

    const { url: filePath, filename } = getFileInfo(req.file, 'beforeafter');
    const { rows: inserted } = await req.db.query(
      `INSERT INTO before_after_photos (time_record_id, employee_id, photo_type, filename, original_name, file_path, caption)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.recordId, req.user.id, photo_type, filename, req.file.originalname, filePath, caption || '']
    );
    res.status(201).json(inserted[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET all photos for admin (all service types) ──────────────────────────────
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `SELECT p.*,
              e.first_name || ' ' || e.last_name AS employee_name,
              COALESCE(b.preferred_date, r.route_date::text) AS job_date,
              COALESCE(b.client_name, c2.first_name || ' ' || c2.last_name) AS client_name,
              COALESCE(c.first_name || ' ' || c.last_name, b.client_name, c2.first_name || ' ' || c2.last_name) AS display_name,
              COALESCE(s.name, svc2.name, rs.stop_label) AS service_name,
              r.name AS route_name
       FROM before_after_photos p
       LEFT JOIN employees e ON p.employee_id = e.id
       LEFT JOIN bookings b ON p.booking_id = b.id
       LEFT JOIN clients c ON b.client_id = c.id
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN route_stops rs ON p.route_stop_id = rs.id
       LEFT JOIN clients c2 ON rs.client_id = c2.id
       LEFT JOIN bookings b2 ON rs.booking_id = b2.id
       LEFT JOIN services svc2 ON b2.service_id = svc2.id
       LEFT JOIN routes r ON rs.route_id = r.id
       ORDER BY p.created_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE a before/after photo ────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { rows: __photo } = await req.db.query('SELECT * FROM before_after_photos WHERE id = $1', [req.params.id]);
    const photo = __photo[0];
    if (!photo) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && photo.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteFile(photo.filename, 'beforeafter');
    await req.db.query('DELETE FROM before_after_photos WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
