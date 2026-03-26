const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// GET all reviews (public)
router.get('/', (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT r.*, c.first_name || ' ' || c.last_name AS client_name,
             b.preferred_date, s.name AS service_name
      FROM reviews r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN bookings b ON r.booking_id = b.id
      LEFT JOIN services s ON b.service_id = s.id
      ORDER BY r.created_at DESC
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET reviews for a specific client
router.get('/my', authenticateToken, (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT r.*, b.preferred_date, s.name AS service_name
      FROM reviews r
      LEFT JOIN bookings b ON r.booking_id = b.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE r.client_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET completed bookings that haven't been reviewed yet (for a client)
router.get('/pending', authenticateToken, (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT b.*, s.name AS service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.status = 'completed'
        AND (b.client_id = ? OR b.client_email = (SELECT email FROM clients WHERE id = ?))
        AND b.id NOT IN (SELECT booking_id FROM reviews WHERE booking_id IS NOT NULL)
      ORDER BY b.completed_at DESC
    `).all(req.user.id, req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create a review
router.post('/', authenticateToken, (req, res) => {
  try {
    const { booking_id, rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
    const info = req.db.prepare(
      'INSERT INTO reviews (booking_id, client_id, rating, comment) VALUES (?, ?, ?, ?)'
    ).run(booking_id || null, req.user.id, rating, comment || '');
    res.json({ id: info.lastInsertRowid, message: 'Review submitted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET average rating stats
router.get('/stats', (req, res) => {
  try {
    const stats = req.db.prepare(`
      SELECT COUNT(*) as total, AVG(rating) as avg_rating,
             SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
             SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
             SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
             SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
             SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
      FROM reviews
    `).get();
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
