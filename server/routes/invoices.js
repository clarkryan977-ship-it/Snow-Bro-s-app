const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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

    const result = await req.db.query('INSERT INTO invoices (invoice_number, client_id, subtotal, tax_rate, tax_amount, total, notes) VALUES ($2, $3, $4, $5, $6, $7, $8) RETURNING id', [invoice_number, client_id, subtotal, taxRate, tax_amount, total, notes || '']);

    const invoiceId = result[0].id;

    for (const item of items) {
      await req.db.query('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES ($9, $10, $11, $12, $13)', [invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]);
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

// Get my invoices (client)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { rows } = await req.db.query(`
      SELECT i.*, c.first_name || ' ' || c.last_name AS client_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.client_id = $1
      ORDER BY i.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
