const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// GET my notifications (employee)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { rows: rows } = await req.db.query('SELECT * FROM notifications WHERE employee_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET unread count
router.get('/unread', authenticateToken, async (req, res) => {
  try {
    const { rows: __r } = await req.db.query('SELECT COUNT(*) as count FROM notifications WHERE employee_id = $1 AND read = 0', [req.user.id]);
    const r = __r[0];
    res.json({ count: r.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT mark as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await req.db.query('UPDATE notifications SET read = 1 WHERE id = $1 AND employee_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT mark all as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await req.db.query('UPDATE notifications SET read = 1 WHERE employee_id = $1', [req.user.id]);
    res.json({ message: 'All marked as read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
