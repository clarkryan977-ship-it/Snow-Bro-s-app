const express = require('express');
const router = express.Router();
let sendAdminPush;
try { sendAdminPush = require('./push').sendAdminPush; } catch(e) { sendAdminPush = null; }
const { sendMail } = require('../utils/mailer');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { emailHeader, emailFooter } = require('../utils/emailHeader');
const { sendMail } = require('../utils/mailer');

// ── helpers ──────────────────────────────────────────────────────────────────
async function nextEstimateNumber(db) {
  const { rows: __last } = await db.query('SELECT estimate_number FROM estimates ORDER BY id DESC LIMIT 1');
  const last = __last[0];
  if (!last) return 'EST-1001';
  const n = parseInt(last.estimate_number.replace('EST-', ''), 10) || 1000;
  return `EST-${n + 1}`;
}

function buildEstimateHTML(est, items) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${it.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${Number(it.quantity).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">$${Number(it.unit_price).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">$${Number(it.total).toFixed(2)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Estimate ${est.estimate_number}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    ${emailHeader('ESTIMATE — ' + est.estimate_number)}
    <!-- Meta -->
    <div style="padding:24px 40px;background:#eff6ff;border-bottom:1px solid #bfdbfe;display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1e40af;letter-spacing:.06em;">Prepared For</div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;margin-top:4px;">${est.customer_name}</div>
        ${est.customer_address ? `<div style="font-size:13px;color:#475569;margin-top:2px;">${est.customer_address}</div>` : ''}
        ${est.customer_email ? `<div style="font-size:13px;color:#475569;">${est.customer_email}</div>` : ''}
        ${est.customer_phone ? `<div style="font-size:13px;color:#475569;">${est.customer_phone}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1e40af;letter-spacing:.06em;">Date</div>
        <div style="font-size:13px;color:#475569;margin-top:4px;">${new Date(est.created_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
        ${est.valid_until ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1e40af;letter-spacing:.06em;margin-top:10px;">Valid Until</div><div style="font-size:13px;color:#475569;margin-top:4px;">${new Date(est.valid_until).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>` : ''}
      </div>
    </div>
    <!-- Line items -->
    <div style="padding:24px 40px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#eff6ff;">
            <th style="padding:10px 12px;text-align:left;color:#1e40af;font-weight:700;border-bottom:2px solid #bfdbfe;">Description</th>
            <th style="padding:10px 12px;text-align:center;color:#1e40af;font-weight:700;border-bottom:2px solid #bfdbfe;">Qty</th>
            <th style="padding:10px 12px;text-align:right;color:#1e40af;font-weight:700;border-bottom:2px solid #bfdbfe;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;color:#1e40af;font-weight:700;border-bottom:2px solid #bfdbfe;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <!-- Totals -->
      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <table style="font-size:14px;min-width:240px;">
          <tr>
            <td style="padding:5px 12px;color:#64748b;">Subtotal</td>
            <td style="padding:5px 12px;text-align:right;font-weight:600;">$${Number(est.subtotal).toFixed(2)}</td>
          </tr>
          ${est.tax_rate > 0 ? `<tr><td style="padding:5px 12px;color:#64748b;">Tax (${Number(est.tax_rate).toFixed(1)}%)</td><td style="padding:5px 12px;text-align:right;font-weight:600;">$${Number(est.tax_amount).toFixed(2)}</td></tr>` : ''}
          <tr style="background:#eff6ff;">
            <td style="padding:10px 12px;font-weight:800;color:#1e40af;font-size:16px;border-top:2px solid #bfdbfe;">Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:800;color:#1e40af;font-size:16px;border-top:2px solid #bfdbfe;">$${Number(est.total).toFixed(2)}</td>
          </tr>
        </table>
      </div>
      ${est.notes ? `<div style="margin-top:20px;padding:14px 16px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;font-size:13px;color:#475569;"><strong>Notes:</strong> ${est.notes}</div>` : ''}
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`;
}

// ── GET all estimates ─────────────────────────────────────────────────────────
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: estimates } = await req.db.query(`SELECT * FROM estimates ORDER BY created_at DESC`);
    res.json(estimates);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET single estimate with items ───────────────────────────────────────────
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __est } = await req.db.query('SELECT * FROM estimates WHERE id = $1', [req.params.id]);
    const est = __est[0];
    if (!est) return res.status(404).json({ error: 'Not found' });
    const { rows: items } = await req.db.query('SELECT * FROM estimate_items WHERE estimate_id = $1 ORDER BY id', [est.id]);
    res.json({ ...est, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST create estimate ──────────────────────────────────────────────────────
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_address,
            subtotal, tax_rate, tax_amount, total, notes, valid_until, items } = req.body;
    const estimate_number = await nextEstimateNumber(req.db);
    const { rows: insResult } = await req.db.query(`INSERT INTO estimates (estimate_number, customer_name, customer_email, customer_phone,
        customer_address, subtotal, tax_rate, tax_amount, total, notes, valid_until)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [estimate_number, customer_name, customer_email || '',
       customer_phone || '', customer_address || '',
       subtotal || 0, tax_rate || 0, tax_amount || 0, total || 0,
       notes || '', valid_until || '']);
    const estId = insResult[0].id;
    if (items && items.length) {
      
      for (const it of items) {
        await req.db.query('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)', [estId, it.description, it.quantity || 1, it.unit_price || 0, it.total || 0]);
      }
    }
    const { rows: __est } = await req.db.query('SELECT * FROM estimates WHERE id = $1', [estId]);
    const est = __est[0];
    const { rows: estItems } = await req.db.query('SELECT * FROM estimate_items WHERE estimate_id = $1', [estId]);
    res.status(201).json({ ...est, items: estItems });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT update estimate ───────────────────────────────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_address,
            subtotal, tax_rate, tax_amount, total, notes, valid_until, status, items } = req.body;
    await req.db.query(`UPDATE estimates SET customer_name=$17, customer_email=$18, customer_phone=$19,
        customer_address=$20, subtotal=$21, tax_rate=$22, tax_amount=$23, total=$24,
        notes=$25, valid_until=$26, status=$27 WHERE id=$28`, [customer_name, customer_email || '', customer_phone || '', customer_address || '',
      subtotal || 0, tax_rate || 0, tax_amount || 0, total || 0,
      notes || '', valid_until || '', status || 'draft', req.params.id]);
    await req.db.query('DELETE FROM estimate_items WHERE estimate_id = $1', [req.params.id]);
    if (items && items.length) {
      
      for (const it of items) {
        await req.db.query('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)', [req.params.id, it.description, it.quantity || 1, it.unit_price || 0, it.total || 0]);
      }
    }
    const { rows: __est } = await req.db.query('SELECT * FROM estimates WHERE id = $1', [req.params.id]);
    const est = __est[0];
    const { rows: estItems } = await req.db.query('SELECT * FROM estimate_items WHERE estimate_id = $1', [req.params.id]);
    res.json({ ...est, items: estItems });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE estimate ───────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM estimates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST email estimate ───────────────────────────────────────────────────────
router.post('/:id/email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __est } = await req.db.query('SELECT * FROM estimates WHERE id = $1', [req.params.id]);
    const est = __est[0];
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!est.customer_email) return res.status(400).json({ error: 'No customer email on this estimate' });
    const { rows: items } = await req.db.query('SELECT * FROM estimate_items WHERE estimate_id = $1 ORDER BY id', [est.id]);
    const html = buildEstimateHTML(est, items);

    const info = await sendMail({
      to: est.customer_email,
      subject: `Your Estimate from Snow Bro's — ${est.estimate_number}`,
      html
    });

    // Mark as emailed
    await req.db.query("UPDATE estimates SET emailed_at = NOW(), status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END WHERE id = $1", [est.id]);

    res.json({ success: true, messageId: info.messageId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST convert estimate to invoice ─────────────────────────────────────────
router.post('/:id/convert', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: __est } = await req.db.query('SELECT * FROM estimates WHERE id = $1', [req.params.id]);
    const est = __est[0];
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id is required to convert to invoice' });

    // Generate invoice number
    const { rows: __lastInv } = await req.db.query('SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1');
    const lastInv = __lastInv[0];
    let invNum = 'INV-1001';
    if (lastInv) {
      const n = parseInt(lastInv.invoice_number.replace('INV-', ''), 10) || 1000;
      invNum = `INV-${n + 1}`;
    }

    const invResult = await req.db.query(`
      INSERT INTO invoices (invoice_number, client_id, subtotal, tax_rate, tax_amount, total, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING id`, [invNum, client_id, est.subtotal, est.tax_rate, est.tax_amount, est.total, est.notes || '']);
    const invoiceId = invResult.rows[0].id;

    const { rows: items } = await req.db.query('SELECT * FROM estimate_items WHERE estimate_id = $1', [est.id]);
    
    for (const it of items) {
      await req.db.query('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES ($1,$2,$3,$4,$5)', [invoiceId, it.description, it.quantity, it.unit_price, it.total]);
    }

    await req.db.query(`UPDATE estimates SET status='accepted', converted_invoice_id=$1 WHERE id=$2`, [invoiceId, est.id]);
    res.json({ success: true, invoice_id: invoiceId, invoice_number: invNum });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
