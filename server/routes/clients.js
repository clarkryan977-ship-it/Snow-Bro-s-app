const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all clients (admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: clients } = await req.db.query('SELECT id, first_name, last_name, email, phone, address, city, state, zip, notes, created_at, active, latitude, longitude, service_type FROM clients ORDER BY last_name, first_name');
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single client
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { rows: __client } = await req.db.query('SELECT id, first_name, last_name, email, phone, address, city, state, zip, notes, created_at, active, latitude, longitude, service_type FROM clients WHERE id = $1', [req.params.id]);
    const client = __client[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add client (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, notes, password } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email required' });
    }

    const password_hash = password ? bcrypt.hashSync(password, 10) : null;

    const result = await req.db.query('INSERT INTO clients (first_name, last_name, email, phone, address, city, state, zip, notes, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id', [first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', notes || '', password_hash]);

    res.status(201).json({ id: result.rows[0].id, message: 'Client added' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update client (admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, notes, active, service_type } = req.body;
    // active can be 0/1 or true/false — normalise to integer for PostgreSQL
    const activeVal = (active === false || active === 0 || active === '0') ? 0 : 1;
    await req.db.query(
      'UPDATE clients SET first_name=$1, last_name=$2, email=$3, phone=$4, address=$5, city=$6, state=$7, zip=$8, notes=$9, active=$10, service_type=$11 WHERE id=$12',
      [first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', notes || '', activeVal, service_type || 'residential', req.params.id]
    );
    res.json({ message: 'Client updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete client (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
