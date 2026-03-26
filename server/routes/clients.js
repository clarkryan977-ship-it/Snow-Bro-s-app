const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all clients (admin)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const clients = req.db.prepare('SELECT id, first_name, last_name, email, phone, address, city, state, zip, notes, created_at FROM clients ORDER BY last_name, first_name').all();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single client
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const client = req.db.prepare('SELECT id, first_name, last_name, email, phone, address, city, state, zip, notes, created_at FROM clients WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add client (admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, notes, password } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email required' });
    }

    const password_hash = password ? bcrypt.hashSync(password, 10) : null;

    const result = req.db.prepare(
      'INSERT INTO clients (first_name, last_name, email, phone, address, city, state, zip, notes, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', notes || '', password_hash);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Client added' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update client (admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, notes } = req.body;
    req.db.prepare(
      'UPDATE clients SET first_name=?, last_name=?, email=?, phone=?, address=?, city=?, state=?, zip=?, notes=? WHERE id=?'
    ).run(first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', notes || '', req.params.id);
    res.json({ message: 'Client updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete client (admin)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    req.db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
