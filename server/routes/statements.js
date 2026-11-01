const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf','image/jpeg','image/png','image/webp'];
    cb(allowed.includes(file.mimetype) ? null : new Error('Upload a PDF, JPG, PNG, or WEBP statement'), allowed.includes(file.mimetype));
  }
});

router.use(async (req, _res, next) => {
  await req.db.query(`CREATE TABLE IF NOT EXISTS financial_statements (
    id SERIAL PRIMARY KEY, statement_type TEXT NOT NULL, institution TEXT NOT NULL DEFAULT '', account_name TEXT NOT NULL DEFAULT '',
    account_last4 TEXT DEFAULT '', period_start DATE, period_end DATE, ending_balance REAL, total_inflows REAL, total_outflows REAL,
    notes TEXT DEFAULT '', file_name TEXT NOT NULL, mime_type TEXT NOT NULL, file_data TEXT NOT NULL, created_by INTEGER, created_at TIMESTAMP DEFAULT NOW()
  )`).catch(() => {});
  next();
});

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT id,statement_type,institution,account_name,account_last4,period_start,period_end,ending_balance,total_inflows,total_outflows,notes,file_name,mime_type,created_at FROM financial_statements ORDER BY period_end DESC NULLS LAST, created_at DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/file', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query('SELECT file_name,mime_type,file_data FROM financial_statements WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Statement not found' });
    const file = rows[0];
    res.type(file.mime_type).set('Content-Disposition', `inline; filename="${file.file_name.replace(/"/g, '')}"`).send(Buffer.from(file.file_data, 'base64'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticateToken, requireAdmin, upload.single('statement'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Statement file is required' });
    const { statement_type, institution, account_name, account_last4, period_start, period_end, ending_balance, total_inflows, total_outflows, notes } = req.body;
    if (!['bank','credit_card','other'].includes(statement_type)) return res.status(400).json({ error: 'Invalid statement type' });
    const { rows } = await req.db.query(`INSERT INTO financial_statements
      (statement_type,institution,account_name,account_last4,period_start,period_end,ending_balance,total_inflows,total_outflows,notes,file_name,mime_type,file_data,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,statement_type,institution,account_name,period_start,period_end,created_at`,
      [statement_type, institution || '', account_name || '', account_last4 || '', period_start || null, period_end || null,
       ending_balance === '' ? null : Number(ending_balance), total_inflows === '' ? null : Number(total_inflows), total_outflows === '' ? null : Number(total_outflows), notes || '', req.file.originalname, req.file.mimetype, req.file.buffer.toString('base64'), req.user.id]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try { const result = await req.db.query('DELETE FROM financial_statements WHERE id=$1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Statement not found' }); res.json({ message: 'Statement deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
