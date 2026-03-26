const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all invoices (admin)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const invoices = req.db.prepare(`
      SELECT i.*, c.first_name || ' ' || c.last_name as client_name, c.email as client_email
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC
    `).all();
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single invoice with items
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const invoice = req.db.prepare(`
      SELECT i.*, c.first_name || ' ' || c.last_name as client_name,
        c.email as client_email, c.phone as client_phone,
        c.address as client_address, c.city as client_city,
        c.state as client_state, c.zip as client_zip
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const items = req.db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
    res.json({ ...invoice, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create invoice (admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { client_id, items, tax_rate, notes } = req.body;
    if (!client_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Client and at least one line item required' });
    }

    // Generate invoice number
    const count = req.db.prepare('SELECT COUNT(*) as cnt FROM invoices').get().cnt;
    const invoice_number = `INV-${String(count + 1001).padStart(5, '0')}`;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxRate = tax_rate || 0;
    const tax_amount = subtotal * (taxRate / 100);
    const total = subtotal + tax_amount;

    const result = req.db.prepare(
      'INSERT INTO invoices (invoice_number, client_id, subtotal, tax_rate, tax_amount, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(invoice_number, client_id, subtotal, taxRate, tax_amount, total, notes || '');

    const invoiceId = result.lastInsertRowid;
    const insertItem = req.db.prepare(
      'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)'
    );

    for (const item of items) {
      insertItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
    }

    res.status(201).json({ id: invoiceId, invoice_number, message: 'Invoice created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update invoice status
router.put('/:id/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    req.db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Invoice status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my invoices (client)
router.get('/my', authenticateToken, (req, res) => {
  try {
    const rows = req.db.prepare(`
      SELECT i.*, c.first_name || ' ' || c.last_name AS client_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.client_id = ?
      ORDER BY i.created_at DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
