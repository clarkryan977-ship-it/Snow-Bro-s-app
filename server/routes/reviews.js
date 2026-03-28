const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// GET all reviews (public)
router.get('/', async (req, res) => {
  try {
    const { rows: rows } = await req.db.query(`SELECT r.*, c.first_name || ' ' || c.last_name AS client_name,
             b.preferred_date, s.name AS service_name
      FROM reviews r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN bookings b ON r.booking_id = b.id
      LEFT JOIN services s ON b.service_id = s.id
      ORDER BY r.created_at DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET reviews for a specific client
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query(`SELECT r.*, b.preferred_date, s.name AS service_name
      FROM reviews r
      LEFT JOIN bookings b ON r.booking_id = b.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE r.client_id = $1
      ORDER BY r.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET completed bookings that haven't been reviewed yet (for a client)
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query(`SELECT b.*, s.name AS service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.status = 'completed'
        AND (b.client_id = $1 OR b.client_email = (SELECT email FROM clients WHERE id = $2))
        AND b.id NOT IN (SELECT booking_id FROM reviews WHERE booking_id IS NOT NULL)
      ORDER BY b.completed_at DESC`, [req.user.id, req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create a review
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { booking_id, rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
    const info = await req.db.query('INSERT INTO reviews (booking_id, client_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id', [booking_id || null, req.user.id, rating, comment || '']);
    res.json({ id: info[0].id, message: 'Review submitted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET average rating stats
router.get('/stats', async (req, res) => {
  try {
    const { rows: __stats } = await req.db.query(`SELECT COUNT(*) as total, AVG(rating) as avg_rating,
             SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
             SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
             SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
             SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
             SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
      FROM reviews`);
    const stats = __stats[0];
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
