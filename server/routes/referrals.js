const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// GET my referral info (client)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { rows: __client } = await req.db.query('SELECT * FROM clients WHERE id = $1', [req.user.id]);
    const client = __client[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });
    // Generate referral code if not exists
    if (!client.referral_code) {
      const code = 'SNOW' + crypto.randomBytes(3).toString('hex').toUpperCase();
      await req.db.query('UPDATE clients SET referral_code = $1 WHERE id = $2', [code, req.user.id]);
      client.referral_code = code;
    }
    const { rows: referrals } = await req.db.query(`SELECT r.*, c.first_name || ' ' || c.last_name AS referred_name
      FROM referrals r
      LEFT JOIN clients c ON r.referred_client_id = c.id
      WHERE r.referrer_client_id = $1
      ORDER BY r.created_at DESC`, [req.user.id]);
    res.json({ referral_code: client.referral_code, credits: client.referral_credits || 0, referrals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST validate a referral code (during registration)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const { rows: __client } = await req.db.query('SELECT id, first_name, last_name FROM clients WHERE referral_code = $1', [code.toUpperCase()]);
    const client = __client[0];
    if (!client) return res.status(404).json({ error: 'Invalid referral code' });
    res.json({ valid: true, referrer: `${client.first_name} ${client.last_name}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST redeem referral (called after new client registers with a code)
router.post('/redeem', async (req, res) => {
  try {
    const { referral_code, new_client_id } = req.body;
    const { rows: __referrer } = await req.db.query('SELECT id FROM clients WHERE referral_code = $1', [referral_code]);
    const referrer = __referrer[0];
    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
    // Create referral record
    await req.db.query('INSERT INTO referrals (referrer_client_id, referral_code, referred_client_id, status, discount_amount) VALUES ($1, $2, $3, $4, $5)', [referrer.id, referral_code, new_client_id, 'completed', 10]);
    // Credit the referrer
    await req.db.query('UPDATE clients SET referral_credits = referral_credits + 10 WHERE id = $1', [referrer.id]);
    await req.db.query('UPDATE clients SET referred_by = $1 WHERE id = $2', [referral_code, new_client_id]);
    res.json({ message: 'Referral redeemed! $10 credit applied.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
