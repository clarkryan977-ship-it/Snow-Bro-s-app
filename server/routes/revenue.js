const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET revenue dashboard stats
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    // Monthly revenue (last 12 months)
    const monthly = req.db.prepare(`
      SELECT strftime('%Y-%m', created_at) AS month,
             SUM(total) AS revenue, COUNT(*) AS invoice_count
      FROM invoices WHERE status != 'draft'
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).all().reverse();

    // Top services by revenue
    const topServices = req.db.prepare(`
      SELECT s.name, COUNT(b.id) AS booking_count,
             COALESCE(SUM(s.price), 0) AS total_revenue
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      GROUP BY s.id ORDER BY booking_count DESC LIMIT 10
    `).all();

    // Overall stats
    const totalRevenue = req.db.prepare("SELECT COALESCE(SUM(total), 0) AS val FROM invoices WHERE status != 'draft'").get().val;
    const totalInvoices = req.db.prepare("SELECT COUNT(*) AS val FROM invoices").get().val;
    const totalBookings = req.db.prepare("SELECT COUNT(*) AS val FROM bookings").get().val;
    const totalClients = req.db.prepare("SELECT COUNT(*) AS val FROM clients").get().val;
    const pendingBookings = req.db.prepare("SELECT COUNT(*) AS val FROM bookings WHERE status = 'pending'").get().val;
    const completedBookings = req.db.prepare("SELECT COUNT(*) AS val FROM bookings WHERE status = 'completed'").get().val;
    const avgRating = req.db.prepare("SELECT COALESCE(AVG(rating), 0) AS val FROM reviews").get().val;
    const totalReviews = req.db.prepare("SELECT COUNT(*) AS val FROM reviews").get().val;

    // Bookings by status
    const bookingsByStatus = req.db.prepare(`
      SELECT status, COUNT(*) AS count FROM bookings GROUP BY status
    `).all();

    // Revenue this month vs last month
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastDate = new Date(); lastDate.setMonth(lastDate.getMonth() - 1);
    const lastMonth = lastDate.toISOString().slice(0, 7);
    const thisMonthRev = req.db.prepare("SELECT COALESCE(SUM(total), 0) AS val FROM invoices WHERE status != 'draft' AND strftime('%Y-%m', created_at) = ?").get(thisMonth).val;
    const lastMonthRev = req.db.prepare("SELECT COALESCE(SUM(total), 0) AS val FROM invoices WHERE status != 'draft' AND strftime('%Y-%m', created_at) = ?").get(lastMonth).val;

    res.json({
      monthly, topServices, totalRevenue, totalInvoices, totalBookings,
      totalClients, pendingBookings, completedBookings, avgRating, totalReviews,
      bookingsByStatus, thisMonthRev, lastMonthRev
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
