const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const nodemailer = require('nodemailer');

// ── helpers ──────────────────────────────────────────────────────────────────
function nextEstimateNumber(db) {
  const last = db.prepare("SELECT estimate_number FROM estimates ORDER BY id DESC LIMIT 1").get();
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
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f2557 0%,#1d4ed8 100%);padding:28px 36px;color:#fff;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;width:80px;">
            <img src="https://prosnowbros.com/logo.jpg" alt="Snow Bro's" width="72" height="72" style="border-radius:50%;border:3px solid rgba(255,255,255,0.4);object-fit:cover;display:block;" />
          </td>
          <td style="vertical-align:middle;padding-left:16px;">
            <div style="font-size:24px;font-weight:800;letter-spacing:-.5px;">Snow Bro's</div>
            <div style="font-size:12px;opacity:.8;margin-top:3px;">1812 33rd St S, Moorhead, MN 56560</div>
            <div style="font-size:12px;opacity:.8;">218-331-5145 &middot; Clarkryan977@gmail.com</div>
          </td>
          <td style="vertical-align:middle;text-align:right;">
            <div style="font-size:22px;font-weight:700;letter-spacing:.5px;">ESTIMATE</div>
            <div style="font-size:15px;opacity:.9;margin-top:2px;">${est.estimate_number}</div>
          </td>
        </tr>
      </table>
    </div>
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
    <!-- Footer -->
    <div style="padding:20px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
      Thank you for considering Snow Bro's! To accept this estimate or ask questions, reply to this email or call us.<br>
      <strong style="color:#1e40af;">Snow Bro's</strong> &middot; 1812 33rd St S, Moorhead, MN 56560 &middot; 218-331-5145 &middot; Clarkryan977@gmail.com<br>
      <div style="margin-top:10px;">
        <a href="https://www.facebook.com/share/1HNXScvP62/" target="_blank" style="color:#1877F2;text-decoration:none;margin:0 6px;">Facebook</a>
        <a href="https://nextdoor.com/page/snow-bros-snow-removal-moorhead-mn?utm_campaign=1774487768034&share_action_id=83d220bf-e515-44f1-a37e-e7b8dac41a4b" target="_blank" style="color:#00B246;text-decoration:none;margin:0 6px;">Nextdoor</a>
        <a href="https://prosnowbros.com/" target="_blank" style="color:#2563eb;text-decoration:none;margin:0 6px;">prosnowbros.com</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── GET all estimates ─────────────────────────────────────────────────────────
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const estimates = req.db.prepare(`
      SELECT * FROM estimates ORDER BY created_at DESC
    `).all();
    res.json(estimates);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET single estimate with items ───────────────────────────────────────────
router.get('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const est = req.db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id);
    if (!est) return res.status(404).json({ error: 'Not found' });
    const items = req.db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY id').all(est.id);
    res.json({ ...est, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST create estimate ──────────────────────────────────────────────────────
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_address,
            subtotal, tax_rate, tax_amount, total, notes, valid_until, items } = req.body;
    const estimate_number = nextEstimateNumber(req.db);
    const ins = req.db.prepare(`
      INSERT INTO estimates (estimate_number, customer_name, customer_email, customer_phone,
        customer_address, subtotal, tax_rate, tax_amount, total, notes, valid_until)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);
    const result = ins.run(estimate_number, customer_name, customer_email || '',
      customer_phone || '', customer_address || '',
      subtotal || 0, tax_rate || 0, tax_amount || 0, total || 0,
      notes || '', valid_until || '');
    const estId = result.lastInsertRowid;
    if (items && items.length) {
      const insItem = req.db.prepare('INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, total) VALUES (?,?,?,?,?)');
      for (const it of items) {
        insItem.run(estId, it.description, it.quantity || 1, it.unit_price || 0, it.total || 0);
      }
    }
    const est = req.db.prepare('SELECT * FROM estimates WHERE id = ?').get(estId);
    const estItems = req.db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(estId);
    res.status(201).json({ ...est, items: estItems });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT update estimate ───────────────────────────────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_address,
            subtotal, tax_rate, tax_amount, total, notes, valid_until, status, items } = req.body;
    req.db.prepare(`
      UPDATE estimates SET customer_name=?, customer_email=?, customer_phone=?,
        customer_address=?, subtotal=?, tax_rate=?, tax_amount=?, total=?,
        notes=?, valid_until=?, status=? WHERE id=?
    `).run(customer_name, customer_email || '', customer_phone || '', customer_address || '',
      subtotal || 0, tax_rate || 0, tax_amount || 0, total || 0,
      notes || '', valid_until || '', status || 'draft', req.params.id);
    req.db.prepare('DELETE FROM estimate_items WHERE estimate_id = ?').run(req.params.id);
    if (items && items.length) {
      const insItem = req.db.prepare('INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, total) VALUES (?,?,?,?,?)');
      for (const it of items) {
        insItem.run(req.params.id, it.description, it.quantity || 1, it.unit_price || 0, it.total || 0);
      }
    }
    const est = req.db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id);
    const estItems = req.db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(req.params.id);
    res.json({ ...est, items: estItems });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE estimate ───────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    req.db.prepare('DELETE FROM estimates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST email estimate ───────────────────────────────────────────────────────
router.post('/:id/email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const est = req.db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    if (!est.customer_email) return res.status(400).json({ error: 'No customer email on this estimate' });
    const items = req.db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY id').all(est.id);
    const html = buildEstimateHTML(est, items);

    // Use nodemailer with a simple SMTP config (or ethereal for demo)
    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
    } else {
      // Ethereal test account for demo
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
    }

    const info = await transporter.sendMail({
      from: '"Snow Bro\'s" <noreply@snowbros.com>',
      to: est.customer_email,
      subject: `Your Estimate from Snow Bro's — ${est.estimate_number}`,
      html
    });

    // Mark as emailed
    req.db.prepare("UPDATE estimates SET emailed_at = datetime('now'), status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END WHERE id = ?").run(est.id);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    res.json({ success: true, messageId: info.messageId, previewUrl: previewUrl || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST convert estimate to invoice ─────────────────────────────────────────
router.post('/:id/convert', authenticateToken, requireAdmin, (req, res) => {
  try {
    const est = req.db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id is required to convert to invoice' });

    // Generate invoice number
    const lastInv = req.db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get();
    let invNum = 'INV-1001';
    if (lastInv) {
      const n = parseInt(lastInv.invoice_number.replace('INV-', ''), 10) || 1000;
      invNum = `INV-${n + 1}`;
    }

    const invResult = req.db.prepare(`
      INSERT INTO invoices (invoice_number, client_id, subtotal, tax_rate, tax_amount, total, notes, status)
      VALUES (?,?,?,?,?,?,?,'draft')
    `).run(invNum, client_id, est.subtotal, est.tax_rate, est.tax_amount, est.total, est.notes || '');
    const invoiceId = invResult.lastInsertRowid;

    const items = req.db.prepare('SELECT * FROM estimate_items WHERE estimate_id = ?').all(est.id);
    const insItem = req.db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?,?,?,?,?)');
    for (const it of items) {
      insItem.run(invoiceId, it.description, it.quantity, it.unit_price, it.total);
    }

    req.db.prepare("UPDATE estimates SET status='accepted', converted_invoice_id=? WHERE id=?").run(invoiceId, est.id);
    res.json({ success: true, invoice_id: invoiceId, invoice_number: invNum });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
