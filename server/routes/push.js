const express = require('express');
const router  = express.Router();
const webpush = require('web-push');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getPool } = require('../db/init');

// VAPID keys — generated once, stored as env vars on Railway
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || 'BMCoPw4-7dOUnyvKtPKqMzsX9uhZ41jPFW5eVfWvW-7DDQUDWQCIdroitNqlezdtnxdZginzV_O5Qyijoa1t7FI';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '_2YQAMDODswJVLkv4ePLXOh5W-BBdegs8NOzNmoo5tY';

webpush.setVapidDetails(
  'mailto:prosnowbros@prosnowbros.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// ── GET /api/push/vapid-public-key  (public — needed by frontend to subscribe)
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// ── POST /api/push/subscribe  (admin only — save push subscription)
router.post('/subscribe', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getPool();
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

    const endpoint = subscription.endpoint;
    const subJson  = JSON.stringify(subscription);

    // Upsert: replace existing subscription for this endpoint
    await db.query(
      `INSERT INTO push_subscriptions (employee_id, endpoint, subscription_json, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (endpoint) DO UPDATE SET subscription_json = EXCLUDED.subscription_json, employee_id = EXCLUDED.employee_id`,
      [req.user.id, endpoint, subJson]
    );
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// ── DELETE /api/push/unsubscribe  (admin only — remove push subscription)
router.delete('/unsubscribe', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getPool();
    const { endpoint } = req.body;
    if (endpoint) {
      await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    } else {
      await db.query('DELETE FROM push_subscriptions WHERE employee_id = $1', [req.user.id]);
    }
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// ── Utility: send push notification to ALL admin subscribers
async function sendAdminPush(db, payload) {
  try {
    const { rows } = await db.query(
      `SELECT ps.subscription_json FROM push_subscriptions ps
       JOIN employees e ON ps.employee_id = e.id
       WHERE e.role = 'admin'`
    );
    const results = await Promise.allSettled(
      rows.map(row => {
        const sub = JSON.parse(row.subscription_json);
        return webpush.sendNotification(sub, JSON.stringify(payload));
      })
    );
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`Push: ${failed.length}/${rows.length} notifications failed`);
    }
    return { sent: rows.length - failed.length, failed: failed.length };
  } catch (err) {
    console.error('sendAdminPush error:', err);
    return { sent: 0, failed: 0 };
  }
}

module.exports = router;
module.exports.sendAdminPush = sendAdminPush;
