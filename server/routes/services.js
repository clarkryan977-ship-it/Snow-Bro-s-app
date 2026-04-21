const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all active services (public)
router.get('/', async (req, res) => {
  try {
    const { rows: services } = await req.db.query('SELECT * FROM services WHERE active = 1 ORDER BY name');
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all services including inactive (admin)
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: services } = await req.db.query('SELECT * FROM services ORDER BY name');
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add service (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, starting_price } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name required' });

    const result = await req.db.query('INSERT INTO services (name, description, price, starting_price) VALUES ($1, $2, $3, $4) RETURNING id', [name, description || '', price || 0, starting_price || '']);
    res.status(201).json({ id: result.rows[0].id, message: 'Service added' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Service name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update service (admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, starting_price, active } = req.body;
    await req.db.query('UPDATE services SET name=$1, description=$2, price=$3, starting_price=$4, active=$5 WHERE id=$6', [name, description || '', price || 0, starting_price || '', active !== undefined ? active : 1, req.params.id]);
    res.json({ message: 'Service updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete service (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('UPDATE services SET active = 0 WHERE id = $1', [req.params.id]);
    res.json({ message: 'Service deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
