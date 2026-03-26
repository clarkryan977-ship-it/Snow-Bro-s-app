const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all employees/managers/admins (admin or manager)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const employees = req.db.prepare(
      "SELECT id, first_name, last_name, email, phone, role, title, active, created_at FROM employees ORDER BY last_name, first_name"
    ).all();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single employee
router.get('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const emp = req.db.prepare(
      "SELECT id, first_name, last_name, email, phone, role, title, active, created_at FROM employees WHERE id = ?"
    ).get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add employee/manager (admin or manager)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { first_name, last_name, email, phone, password, role, title } = req.body;
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, email and password are required' });
    }

    // Only admin can create another admin
    const effectiveRole = role || 'employee';
    if (effectiveRole === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only an admin can create another admin account' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = req.db.prepare(
      'INSERT INTO employees (first_name, last_name, email, phone, password_hash, role, title) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(first_name, last_name, email, phone || '', hash, effectiveRole, title || '');

    res.status(201).json({ id: result.lastInsertRowid, message: 'Account created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update employee/manager (admin or manager)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { first_name, last_name, email, phone, active, role, title, password } = req.body;

    // Only admin can promote/demote to admin
    const currentEmp = req.db.prepare("SELECT role FROM employees WHERE id = ?").get(req.params.id);
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only an admin can assign the admin role' });
    }
    // Prevent demoting the last admin
    if (currentEmp && currentEmp.role === 'admin' && role !== 'admin') {
      const adminCount = req.db.prepare("SELECT COUNT(*) as c FROM employees WHERE role='admin'").get().c;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot change role of the last admin account' });
      }
    }

    const effectiveRole = role || 'employee';
    const effectiveActive = active !== undefined ? active : 1;

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      req.db.prepare(
        'UPDATE employees SET first_name=?, last_name=?, email=?, phone=?, active=?, role=?, title=?, password_hash=? WHERE id=?'
      ).run(first_name, last_name, email, phone || '', effectiveActive, effectiveRole, title || '', hash, req.params.id);
    } else {
      req.db.prepare(
        'UPDATE employees SET first_name=?, last_name=?, email=?, phone=?, active=?, role=?, title=? WHERE id=?'
      ).run(first_name, last_name, email, phone || '', effectiveActive, effectiveRole, title || '', req.params.id);
    }
    res.json({ message: 'Account updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete employee (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    // Prevent deleting the last admin
    const emp = req.db.prepare("SELECT role FROM employees WHERE id = ?").get(req.params.id);
    if (emp && emp.role === 'admin') {
      const adminCount = req.db.prepare("SELECT COUNT(*) as c FROM employees WHERE role='admin'").get().c;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin account' });
      }
    }
    // Only admin can delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only an admin can delete accounts' });
    }
    req.db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
