const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET all recurring services (admin)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT rs.*, c.first_name || ' ' || c.last_name AS client_name,
             s.name AS service_name, s.price AS service_price
      FROM recurring_services rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN services s ON rs.service_id = s.id
      ORDER BY rs.next_date ASC
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET my recurring services (client)
router.get('/my', authenticateToken, (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT rs.*, s.name AS service_name, s.price AS service_price
      FROM recurring_services rs
      LEFT JOIN services s ON rs.service_id = s.id
      WHERE rs.client_id = ?
      ORDER BY rs.next_date ASC
    `).all(req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create recurring service
router.post('/', authenticateToken, (req, res) => {
  try {
    const { client_id, service_id, frequency, preferred_day, preferred_time, start_date, end_date, notes } = req.body;
    const cid = client_id || req.user.id;
    if (!service_id || !frequency || !start_date) return res.status(400).json({ error: 'Missing required fields' });
    const info = req.db.prepare(`
      INSERT INTO recurring_services (client_id, service_id, frequency, preferred_day, preferred_time, start_date, end_date, next_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cid, service_id, frequency, preferred_day || 'Monday', preferred_time || '09:00', start_date, end_date || '', start_date, notes || '');
    res.json({ id: info.lastInsertRowid, message: 'Recurring service created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update recurring service
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { frequency, preferred_day, preferred_time, end_date, active, notes } = req.body;
    req.db.prepare(`
      UPDATE recurring_services SET frequency=?, preferred_day=?, preferred_time=?, end_date=?, active=?, notes=? WHERE id=?
    `).run(frequency, preferred_day, preferred_time, end_date || '', active ? 1 : 0, notes || '', req.params.id);
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    req.db.prepare('DELETE FROM recurring_services WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST generate next bookings from recurring (admin trigger)
router.post('/generate', authenticateToken, requireAdmin, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const due = req.db.prepare('SELECT * FROM recurring_services WHERE active = 1 AND next_date <= ?').all(today);
    let created = 0;
    for (const rs of due) {
      const client = req.db.prepare('SELECT * FROM clients WHERE id = ?').get(rs.client_id);
      req.db.prepare(`
        INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, status, notes, client_name, client_email, client_phone, recurring_id)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
      `).run(rs.client_id, rs.service_id, rs.next_date, rs.preferred_time, rs.notes,
             client ? `${client.first_name} ${client.last_name}` : '', client?.email || '', client?.phone || '', rs.id);
      // Calculate next date
      const d = new Date(rs.next_date);
      if (rs.frequency === 'weekly') d.setDate(d.getDate() + 7);
      else if (rs.frequency === 'biweekly') d.setDate(d.getDate() + 14);
      else if (rs.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
      const nextDate = d.toISOString().split('T')[0];
      if (rs.end_date && nextDate > rs.end_date) {
        req.db.prepare('UPDATE recurring_services SET active = 0, next_date = ? WHERE id = ?').run(nextDate, rs.id);
      } else {
        req.db.prepare('UPDATE recurring_services SET next_date = ? WHERE id = ?').run(nextDate, rs.id);
      }
      created++;
    }
    res.json({ message: `Generated ${created} bookings from recurring services` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
