const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET all recurring services (admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query(`SELECT rs.*, c.first_name || ' ' || c.last_name AS client_name,
             s.name AS service_name, s.price AS service_price
      FROM recurring_services rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN services s ON rs.service_id = s.id
      ORDER BY rs.next_date ASC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET my recurring services (client)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query(`SELECT rs.*, s.name AS service_name, s.price AS service_price
      FROM recurring_services rs
      LEFT JOIN services s ON rs.service_id = s.id
      WHERE rs.client_id = $1
      ORDER BY rs.next_date ASC`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create recurring service
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { client_id, service_id, frequency, preferred_day, preferred_time, start_date, end_date, notes } = req.body;
    const cid = client_id || req.user.id;
    if (!service_id || !frequency || !start_date) return res.status(400).json({ error: 'Missing required fields' });
    const info = await req.db.query(`INSERT INTO recurring_services (client_id, service_id, frequency, preferred_day, preferred_time, start_date, end_date, next_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, [cid, service_id, frequency, preferred_day || 'Monday', preferred_time || '09:00', start_date, end_date || '', start_date, notes || '']);
    res.json({ id: info[0].id, message: 'Recurring service created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update recurring service
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { frequency, preferred_day, preferred_time, end_date, active, notes } = req.body;
    await req.db.query(`UPDATE recurring_services SET frequency=$1, preferred_day=$2, preferred_time=$3, end_date=$4, active=$5, notes=$6 WHERE id=$7`, [frequency, preferred_day, preferred_time, end_date || '', active ? 1 : 0, notes || '', req.params.id]);
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM recurring_services WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST generate next bookings from recurring (admin trigger)
router.post('/generate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows: due } = await req.db.query('SELECT * FROM recurring_services WHERE active = 1 AND next_date <= $1', [today]);
    let created = 0;
    for (const rs of due) {
      const { rows: __client } = await req.db.query('SELECT * FROM clients WHERE id = $1', [rs.client_id]);
      const client = __client[0];
      await req.db.query(`INSERT INTO bookings (client_id, service_id, preferred_date, preferred_time, status, notes, client_name, client_email, client_phone, recurring_id)
        VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)`, [rs.client_id, rs.service_id, rs.next_date, rs.preferred_time, rs.notes,
             client ? `${client.first_name} ${client.last_name}` : '', client?.email || '', client?.phone || '', rs.id]);
      // Calculate next date
      const d = new Date(rs.next_date);
      if (rs.frequency === 'weekly') d.setDate(d.getDate() + 7);
      else if (rs.frequency === 'biweekly') d.setDate(d.getDate() + 14);
      else if (rs.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
      const nextDate = d.toISOString().split('T')[0];
      if (rs.end_date && nextDate > rs.end_date) {
        await req.db.query('UPDATE recurring_services SET active = 0, next_date = $1 WHERE id = $2', [nextDate, rs.id]);
      } else {
        await req.db.query('UPDATE recurring_services SET next_date = $1 WHERE id = $2', [nextDate, rs.id]);
      }
      created++;
    }
    res.json({ message: `Generated ${created} bookings from recurring services` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
