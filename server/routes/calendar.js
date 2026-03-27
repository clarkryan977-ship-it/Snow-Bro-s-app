const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET all bookings in calendar format (with employee info)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT b.*, s.name AS service_name, s.price AS service_price,
             c.first_name || ' ' || c.last_name AS full_client_name,
             e.first_name || ' ' || e.last_name AS assigned_employee_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      LEFT JOIN employees e ON b.assigned_employee_id = e.id
      ORDER BY b.preferred_date ASC, b.preferred_time ASC
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create a new booking from admin calendar
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone, assigned_employee_id, status } = req.body;
    if (!service_id || !preferred_date) {
      return res.status(400).json({ error: 'Service and preferred date required' });
    }
    const result = req.db.prepare(
      'INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone, assigned_employee_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      client_id || null, service_id, preferred_date, preferred_time || '',
      notes || '', client_name || '', client_email || '', client_phone || '',
      assigned_employee_id || null, status || 'confirmed'
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Booking created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT full edit a booking (admin)
router.put('/:id/edit', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { client_id, service_id, preferred_date, preferred_time, notes, client_name, client_email, client_phone, assigned_employee_id, status } = req.body;
    req.db.prepare(
      'UPDATE bookings SET client_id=?, service_id=?, preferred_date=?, preferred_time=?, notes=?, client_name=?, client_email=?, client_phone=?, assigned_employee_id=?, status=? WHERE id=?'
    ).run(
      client_id || null, service_id, preferred_date, preferred_time || '',
      notes || '', client_name || '', client_email || '', client_phone || '',
      assigned_employee_id || null, status || 'confirmed', req.params.id
    );
    res.json({ message: 'Booking updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE a booking (admin)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    req.db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
    res.json({ message: 'Booking deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT assign employee to booking + send notification
router.put('/:id/assign', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { employee_id } = req.body;
    req.db.prepare('UPDATE bookings SET assigned_employee_id = ? WHERE id = ?').run(employee_id, req.params.id);
    // Get booking info for notification
    const booking = req.db.prepare(`
      SELECT b.*, s.name AS service_name FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id WHERE b.id = ?
    `).get(req.params.id);
    if (employee_id && booking) {
      req.db.prepare(
        'INSERT INTO notifications (employee_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)'
      ).run(employee_id, 'New Job Assigned',
        `You've been assigned: ${booking.service_name || 'Service'} on ${booking.preferred_date} at ${booking.preferred_time || 'TBD'} for ${booking.client_name || 'a client'}.`,
        'job_assigned', req.params.id);
    }
    res.json({ message: 'Employee assigned and notified' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update booking date/time (drag-and-drop)
router.put('/:id/reschedule', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { preferred_date, preferred_time } = req.body;
    req.db.prepare('UPDATE bookings SET preferred_date = ?, preferred_time = ? WHERE id = ?')
      .run(preferred_date, preferred_time || '', req.params.id);
    res.json({ message: 'Rescheduled' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT mark booking as completed + trigger follow-up
router.put('/:id/complete', authenticateToken, requireAdmin, (req, res) => {
  try {
    const now = new Date().toISOString();
    req.db.prepare('UPDATE bookings SET status = ?, completed_at = ? WHERE id = ?')
      .run('completed', now, req.params.id);
    res.json({ message: 'Marked as completed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET employee's assigned jobs for today (route optimization)
router.get('/employee-jobs/:employeeId', authenticateToken, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = req.db.prepare(`
      SELECT b.*, s.name AS service_name,
             c.first_name || ' ' || c.last_name AS full_client_name,
             c.address, c.city, c.state, c.zip, c.phone AS client_phone
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.assigned_employee_id = ? AND b.preferred_date = ? AND b.status != 'completed'
      ORDER BY b.preferred_time ASC
    `).all(req.params.employeeId, today);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET my assigned jobs (employee)
router.get('/my-jobs', authenticateToken, (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT b.*, s.name AS service_name,
             c.first_name || ' ' || c.last_name AS full_client_name,
             c.address, c.city, c.state, c.zip, c.phone AS client_phone
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.assigned_employee_id = ? AND b.status != 'completed'
      ORDER BY b.preferred_date ASC, b.preferred_time ASC
    `).all(req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
