const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Employee/Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows: __employee } = await req.db.query('SELECT * FROM employees WHERE email = $1 AND active = 1', [email]);
    const employee = __employee[0];
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
router.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, city, state, zip, password } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const { rows: __existing } = await req.db.query('SELECT id FROM clients WHERE email = $1', [email]);
    const existing = __existing[0];
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = password ? bcrypt.hashSync(password, 10) : null;

    const result = await req.db.query('INSERT INTO clients (first_name, last_name, email, phone, address, city, state, zip, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id', [first_name, last_name, email, phone || '', address || '', city || '', state || '', zip || '', password_hash]);

    res.status(201).json({ id: result.rows[0].id, message: 'Registration successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client login
router.post('/client-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows: __client } = await req.db.query('SELECT * FROM clients WHERE email = $1', [email]);
    const client = __client[0];
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
