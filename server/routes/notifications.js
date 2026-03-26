const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// GET my notifications (employee)
router.get('/my', authenticateToken, (req, res) => {
  try {
    const rows = req.db.prepare(
      'SELECT * FROM notifications WHERE employee_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET unread count
router.get('/unread', authenticateToken, (req, res) => {
  try {
    const r = req.db.prepare('SELECT COUNT(*) as count FROM notifications WHERE employee_id = ? AND read = 0').get(req.user.id);
    res.json({ count: r.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT mark as read
router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    req.db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND employee_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT mark all as read
router.put('/read-all', authenticateToken, (req, res) => {
  try {
    req.db.prepare('UPDATE notifications SET read = 1 WHERE employee_id = ?').run(req.user.id);
    res.json({ message: 'All marked as read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
