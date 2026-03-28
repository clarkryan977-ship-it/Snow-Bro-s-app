const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/settings/public — public endpoint (no auth) for first-time discount info
router.get('/public', async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT key, value FROM app_settings WHERE key LIKE 'first_time_discount%'`);
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings — all settings (admin/manager only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query('SELECT * FROM app_settings ORDER BY key');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — update one or many settings (admin/manager only)
// Body: { key: value, key2: value2, ... }
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await req.db.query(
        'UPDATE app_settings SET value = $1, updated_at = NOW() WHERE key = $2',
        [String(value), key]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
