const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// GET my referral info (client)
router.get('/my', authenticateToken, (req, res) => {
  try {
    let client = req.db.prepare('SELECT * FROM clients WHERE id = ?').get(req.user.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    // Generate referral code if not exists
    if (!client.referral_code) {
      const code = 'SNOW' + crypto.randomBytes(3).toString('hex').toUpperCase();
      req.db.prepare('UPDATE clients SET referral_code = ? WHERE id = ?').run(code, req.user.id);
      client.referral_code = code;
    }
    const referrals = req.db.prepare(`
      SELECT r.*, c.first_name || ' ' || c.last_name AS referred_name
      FROM referrals r
      LEFT JOIN clients c ON r.referred_client_id = c.id
      WHERE r.referrer_client_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.id);
    res.json({ referral_code: client.referral_code, credits: client.referral_credits || 0, referrals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST validate a referral code (during registration)
router.post('/validate', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const client = req.db.prepare('SELECT id, first_name, last_name FROM clients WHERE referral_code = ?').get(code.toUpperCase());
    if (!client) return res.status(404).json({ error: 'Invalid referral code' });
    res.json({ valid: true, referrer: `${client.first_name} ${client.last_name}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST redeem referral (called after new client registers with a code)
router.post('/redeem', (req, res) => {
  try {
    const { referral_code, new_client_id } = req.body;
    const referrer = req.db.prepare('SELECT id FROM clients WHERE referral_code = ?').get(referral_code);
    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
    // Create referral record
    req.db.prepare(
      'INSERT INTO referrals (referrer_client_id, referral_code, referred_client_id, status, discount_amount) VALUES (?, ?, ?, ?, ?)'
    ).run(referrer.id, referral_code, new_client_id, 'completed', 10);
    // Credit the referrer
    req.db.prepare('UPDATE clients SET referral_credits = referral_credits + 10 WHERE id = ?').run(referrer.id);
    req.db.prepare('UPDATE clients SET referred_by = ? WHERE id = ?').run(referral_code, new_client_id);
    res.json({ message: 'Referral redeemed! $10 credit applied.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
