const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/settings/public — public endpoint (no auth) for first-time discount info
router.get('/public', (req, res) => {
  try {
    const rows = req.db.prepare(
      "SELECT key, value FROM app_settings WHERE key LIKE 'first_time_discount%'"
    ).all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings — all settings (admin/manager only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const rows = req.db.prepare('SELECT * FROM app_settings ORDER BY key').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — update one or many settings (admin/manager only)
// Body: { key: value, key2: value2, ... }
router.put('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const updates = req.body;
    const stmt = req.db.prepare(
      "UPDATE app_settings SET value = ?, updated_at = datetime('now') WHERE key = ?"
    );
    const updateMany = req.db.transaction((obj) => {
      for (const [key, value] of Object.entries(obj)) {
        stmt.run(String(value), key);
      }
    });
    updateMany(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
