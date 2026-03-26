const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Employee/Admin login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const employee = req.db.prepare('SELECT * FROM employees WHERE email = ? AND active = 1').get(email);
    if (!employee) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, employee.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role, name: `${employee.first_name} ${employee.last_name}` },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: employee.id,
        email: employee.email,
        role: employee.role,
        name: `${employee.first_name} ${employee.last_name}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client registration
router.post('/register', (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, password } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const existing = req.db.prepare('SELECT id FROM clients WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = password ? bcrypt.hashSync(password, 10) : null;

    const result = req.db.prepare(
      'INSERT INTO clients (first_name, last_name, email, phone, address, city, state, zip, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', password_hash);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Registration successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client login
router.post('/client-login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const client = req.db.prepare('SELECT * FROM clients WHERE email = ?').get(email);
    if (!client || !client.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, client.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: client.id, email: client.email, role: 'client', name: `${client.first_name} ${client.last_name}` },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: client.id,
        email: client.email,
        role: 'client',
        name: `${client.first_name} ${client.last_name}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
