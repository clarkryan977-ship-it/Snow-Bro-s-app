const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { wrapEmail, BUSINESS } = require('../utils/emailHeader');
const BASE_URL = process.env.BASE_URL || 'https://snowbros-production.up.railway.app';

// ── Ensure new columns exist ─────────────────────────────────────────────────
router.use(async (req, res, next) => {
  try {
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_date DATE`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`).catch(() => {});
  } catch (_) {}
  next();
});

// Get all invoices (admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: invoices } = await req.db.query(`SELECT i.*, c.first_name || ' ' || c.last_name as client_name, c.email as client_email
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC`);
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single invoice with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { rows: invoiceRows } = await req.db.query(`SELECT i.*, c.first_name || ' ' || c.last_name as client_name,
        c.email as client_email, c.phone as client_phone,
        c.address as client_address, c.city as client_city,
        c.state as client_state, c.zip as client_zip
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = $1`, [req.params.id]);
    const invoice = invoiceRows[0];

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const { rows: items } = await req.db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
    res.json({ ...invoice, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create invoice (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_id, items, tax_rate, notes } = req.body;
    if (!client_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Client and at least one line item required' });
    }

    // Generate invoice number
    const count = (await req.db.query('SELECT COUNT(*) as cnt FROM invoices')).rows[0].cnt;
    const invoice_number = `INV-${String(count + 1001).padStart(5, '0')}`;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxRate = tax_rate || 0;
    const tax_amount = subtotal * (taxRate / 100);
    const total = subtotal + tax_amount;

    const result = await req.db.query('INSERT INTO invoices (invoice_number, client_id, subtotal, tax_rate, tax_amount, total, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [invoice_number, client_id, subtotal, taxRate, tax_amount, total, notes || '']);

    const invoiceId = result.rows[0].id;

    for (const item of items) {
      await req.db.query('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES ($1, $2, $3, $4, $5)', [invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]);
    }

    res.status(201).json({ id: invoiceId, invoice_number, message: 'Invoice created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update invoice status
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await req.db.query('UPDATE invoices SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ message: 'Invoice status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my invoices (client — authenticated, scoped to their own account)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });
    const { rows } = await req.db.query(`
      SELECT i.id, i.invoice_number, i.subtotal, i.tax_rate, i.tax_amount, i.total,
             i.status, i.notes, i.service_date, i.due_date, i.sent_at, i.created_at
      FROM invoices i
      WHERE i.client_id = $1
      ORDER BY i.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Send invoice email to client
router.post('/:id/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: invRows } = await req.db.query(
      `SELECT i.*, c.first_name, c.last_name, c.email AS client_email,
              c.address AS client_address, c.city, c.state, c.zip
       FROM invoices i JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1`, [req.params.id]);
    const inv = invRows[0];
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (!inv.client_email || inv.client_email.includes('@snowbros.placeholder')) {
      return res.status(400).json({ error: 'Client has no valid email address' });
    }

    const { rows: items } = await req.db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [inv.id]);

    const itemRows = items.map(it => `
      <tr>
        <td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${it.description}</td>
        <td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;text-align:center;">${it.quantity}</td>
        <td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;text-align:right;">$${parseFloat(it.unit_price).toFixed(2)}</td>
        <td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;text-align:right;font-weight:600;">$${parseFloat(it.total).toFixed(2)}</td>
      </tr>`).join('');

    const html = wrapEmail(`
      <h2 style="color:#1e40af;margin-top:0;">Invoice ${inv.invoice_number}</h2>
      <p>Hi ${inv.first_name},</p>
      <p>Please find your invoice from <strong>Snow Bro's</strong> below.</p>
      ${inv.service_date ? `<p><strong>Service Date:</strong> ${new Date(inv.service_date).toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}</p>` : ''}
      ${inv.due_date ? `<p><strong>Due Date:</strong> ${new Date(inv.due_date).toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <thead>
          <tr style="background:#1e40af;color:#fff;">
            <th style="padding:10px 14px;text-align:left;">Description</th>
            <th style="padding:10px 14px;text-align:center;">Qty</th>
            <th style="padding:10px 14px;text-align:right;">Unit Price</th>
            <th style="padding:10px 14px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr style="background:#f8fafc;">
            <td colspan="3" style="padding:10px 14px;font-weight:700;text-align:right;border-top:2px solid #e2e8f0;">Subtotal</td>
            <td style="padding:10px 14px;font-weight:700;text-align:right;border-top:2px solid #e2e8f0;">$${parseFloat(inv.subtotal).toFixed(2)}</td>
          </tr>
          ${inv.tax_rate > 0 ? `<tr><td colspan="3" style="padding:6px 14px;text-align:right;color:#6b7280;">Tax (${inv.tax_rate}%)</td><td style="padding:6px 14px;text-align:right;color:#6b7280;">$${parseFloat(inv.tax_amount).toFixed(2)}</td></tr>` : ''}
          <tr style="background:#eff6ff;">
            <td colspan="3" style="padding:12px 14px;font-weight:800;font-size:16px;text-align:right;color:#1e40af;">Total Due</td>
            <td style="padding:12px 14px;font-weight:800;font-size:16px;text-align:right;color:#1e40af;">$${parseFloat(inv.total).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      ${inv.notes ? `<p style="color:#6b7280;font-size:13px;"><em>${inv.notes}</em></p>` : ''}
      <div style="text-align:center;margin:24px 0;">
        <a href="${BASE_URL}/client/invoices" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">📄 View Invoice in Your Portal</a>
        <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">Log in at <a href="${BASE_URL}/login" style="color:#1e40af;">${BASE_URL}/login</a> to view, download, or print this invoice.</p>
      </div>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;font-weight:700;color:#15803d;">Payment Options</p>
        <p style="margin:6px 0 0;color:#374151;font-size:13px;">Cash App: <strong>$SnowBros</strong> &nbsp;|&nbsp; Venmo: <strong>@SnowBros</strong> &nbsp;|&nbsp; Zelle: <strong>${BUSINESS.phone}</strong></p>
        <p style="margin:4px 0 0;color:#374151;font-size:13px;">Please include invoice number <strong>${inv.invoice_number}</strong> in your payment memo.</p>
      </div>
      <p>Questions? Call us at <strong>${BUSINESS.phone}</strong> or email <a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a>.</p>
    `, `Invoice ${inv.invoice_number}`);

    await sendMail({ to: inv.client_email, subject: `Invoice ${inv.invoice_number} from Snow Bro's`, html });
    await req.db.query('UPDATE invoices SET sent_at = NOW(), status = CASE WHEN status = \'draft\' THEN \'sent\' ELSE status END WHERE id = $1', [inv.id]);

    res.json({ message: 'Invoice emailed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
