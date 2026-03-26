const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all active services (public)
router.get('/', (req, res) => {
  try {
    const services = req.db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY name').all();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all services including inactive (admin)
router.get('/all', authenticateToken, requireAdmin, (req, res) => {
  try {
    const services = req.db.prepare('SELECT * FROM services ORDER BY name').all();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add service (admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description, price } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name required' });

    const result = req.db.prepare('INSERT INTO services (name, description, price) VALUES (?, ?, ?)').run(
      name, description || '', price || 0
    );
    res.status(201).json({ id: result.lastInsertRowid, message: 'Service added' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Service name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update service (admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description, price, active } = req.body;
    req.db.prepare('UPDATE services SET name=?, description=?, price=?, active=? WHERE id=?').run(
      name, description || '', price || 0, active !== undefined ? active : 1, req.params.id
    );
    res.json({ message: 'Service updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete service (admin)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    req.db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Service deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
