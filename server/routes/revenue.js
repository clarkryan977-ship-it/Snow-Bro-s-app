const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET revenue dashboard stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Monthly revenue (last 12 months)
    const { rows: monthly } = await req.db.query(`SELECT strftime('%Y-%m', created_at) AS month,
             SUM(total) AS revenue, COUNT(*) AS invoice_count
      FROM invoices WHERE status != 'draft'
      GROUP BY month ORDER BY month DESC LIMIT 12`, [).reverse(]);

    // Top services by revenue
    const { rows: topServices } = await req.db.query(`SELECT s.name, COUNT(b.id) AS booking_count,
             COALESCE(SUM(s.price), 0) AS total_revenue
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      GROUP BY s.id ORDER BY booking_count DESC LIMIT 10`);

    // Overall stats
    const totalRevenue = (await req.db.query('SELECT COALESCE(SUM(total), 0) AS val FROM invoices WHERE status != 'draft'')).rows[0].val;
    const totalInvoices = (await req.db.query('SELECT COUNT(*) AS val FROM invoices')).rows[0].val;
    const totalBookings = (await req.db.query('SELECT COUNT(*) AS val FROM bookings')).rows[0].val;
    const totalClients = (await req.db.query('SELECT COUNT(*) AS val FROM clients')).rows[0].val;
    const pendingBookings = (await req.db.query('SELECT COUNT(*) AS val FROM bookings WHERE status = 'pending'')).rows[0].val;
    const completedBookings = (await req.db.query('SELECT COUNT(*) AS val FROM bookings WHERE status = 'completed'')).rows[0].val;
    const avgRating = (await req.db.query('SELECT COALESCE(AVG(rating), 0) AS val FROM reviews')).rows[0].val;
    const totalReviews = (await req.db.query('SELECT COUNT(*) AS val FROM reviews')).rows[0].val;

    // Bookings by status
    const { rows: bookingsByStatus } = await req.db.query(`SELECT status, COUNT(*) AS count FROM bookings GROUP BY status`);

    // Revenue this month vs last month
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastDate = new Date(); lastDate.setMonth(lastDate.getMonth() - 1);
    const lastMonth = lastDate.toISOString().slice(0, 7);
    const thisMonthRev = (await req.db.query('SELECT COALESCE(SUM(total), 0) AS val FROM invoices WHERE status != 'draft' AND strftime('%Y-%m', created_at) = $1', [thisMonth])).rows[0].val;
    const lastMonthRev = (await req.db.query('SELECT COALESCE(SUM(total), 0) AS val FROM invoices WHERE status != 'draft' AND strftime('%Y-%m', created_at) = $1', [lastMonth])).rows[0].val;

    res.json({
      monthly, topServices, totalRevenue, totalInvoices, totalBookings,
      totalClients, pendingBookings, completedBookings, avgRating, totalReviews,
      bookingsByStatus, thisMonthRev, lastMonthRev
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
