const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { wrapEmail, BUSINESS } = require('../utils/emailHeader');
const { runBillingCycle } = require('../utils/billingScheduler');
const { makeUploader, getFileInfo } = require('../utils/cloudinaryUpload');
const BASE_URL = process.env.BASE_URL || 'https://snowbros-production.up.railway.app';
const receiptUpload = makeUploader('snowbros/receipts', 'receipts', 15);

// ── Ensure new columns exist ─────────────────────────────────────────────────
router.use(async (req, res, next) => {
  try {
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_date DATE`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_id INTEGER`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid REAL DEFAULT 0`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT ''`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_notes TEXT DEFAULT ''`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS void_reason TEXT DEFAULT ''`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`).catch(() => {});
    await req.db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_by INTEGER`).catch(() => {});
    await req.db.query(`CREATE TABLE IF NOT EXISTS invoice_payments (id SERIAL PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, amount REAL NOT NULL CHECK (amount > 0), payment_method TEXT NOT NULL DEFAULT 'other', reference TEXT DEFAULT '', notes TEXT DEFAULT '', paid_at TIMESTAMP DEFAULT NOW(), created_by INTEGER, created_at TIMESTAMP DEFAULT NOW())`).catch(() => {});
    await req.db.query(`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS deposited_at TIMESTAMP`).catch(() => {});
    await req.db.query(`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS deposit_reference TEXT DEFAULT ''`).catch(() => {});
    await req.db.query(`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMP`).catch(() => {});
    await req.db.query(`CREATE TABLE IF NOT EXISTS invoice_attachments (id SERIAL PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, payment_id INTEGER REFERENCES invoice_payments(id) ON DELETE CASCADE, name TEXT NOT NULL, url TEXT NOT NULL, created_by INTEGER, created_at TIMESTAMP DEFAULT NOW())`).catch(() => {});
    await req.db.query(`CREATE TABLE IF NOT EXISTS invoice_audit_log (id SERIAL PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, action TEXT NOT NULL, details TEXT DEFAULT '', created_by INTEGER, created_at TIMESTAMP DEFAULT NOW())`).catch(() => {});
    await req.db.query(`CREATE UNIQUE INDEX IF NOT EXISTS invoice_contract_month_unique ON invoices (contract_id, (date_trunc('month', created_at))) WHERE auto_generated=TRUE`).catch(() => {});
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

// Archive historical invoices without deleting their financial records
router.post('/archive-before', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const cutoff = req.body.cutoff_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cutoff || ''))) return res.status(400).json({ error: 'cutoff_date must be YYYY-MM-DD' });
    const { rows } = await req.db.query(`UPDATE invoices SET archived_at=NOW(), archived_by=$1 WHERE created_at::date <= $2::date AND archived_at IS NULL RETURNING id`, [req.user.id, cutoff]);
    res.json({ message: 'Invoices archived safely', archived: rows.length, cutoff_date: cutoff });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query('UPDATE invoices SET archived_at=NULL, archived_by=NULL WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice restored' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get auto-generated invoices log (admin)
router.get('/auto-generated', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`
      SELECT i.*, c.first_name || ' ' || c.last_name as client_name, c.email as client_email,
             co.title as contract_title, co.service_category
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN contracts co ON i.contract_id = co.id
      WHERE i.auto_generated = TRUE
      ORDER BY i.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard summary for receivables and collections
router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status NOT IN ('paid','void') AND due_date IS NOT NULL AND due_date < CURRENT_DATE)::int AS overdue,
      COALESCE(SUM(total),0) AS invoiced, COALESCE(SUM(COALESCE(amount_paid,0)),0) AS collected,
      COALESCE(SUM(GREATEST(total-COALESCE(amount_paid,0),0)) FILTER (WHERE status NOT IN ('paid','void')),0) AS outstanding,
      COALESCE(SUM(COALESCE(amount_paid,0)) FILTER (WHERE paid_at >= date_trunc('month', CURRENT_DATE)),0) AS collected_this_month FROM invoices`);
    const aging = await req.db.query(`SELECT
      COALESCE(SUM(GREATEST(total-COALESCE(amount_paid,0),0)) FILTER (WHERE status NOT IN ('paid','void') AND (due_date IS NULL OR due_date >= CURRENT_DATE)),0) AS current,
      COALESCE(SUM(GREATEST(total-COALESCE(amount_paid,0),0)) FILTER (WHERE status NOT IN ('paid','void') AND due_date < CURRENT_DATE AND due_date >= CURRENT_DATE-30),0) AS days_1_30,
      COALESCE(SUM(GREATEST(total-COALESCE(amount_paid,0),0)) FILTER (WHERE status NOT IN ('paid','void') AND due_date < CURRENT_DATE-30 AND due_date >= CURRENT_DATE-60),0) AS days_31_60,
      COALESCE(SUM(GREATEST(total-COALESCE(amount_paid,0),0)) FILTER (WHERE status NOT IN ('paid','void') AND due_date < CURRENT_DATE-60),0) AS days_60_plus FROM invoices`);
    res.json({ ...rows[0], aging: aging.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CSV export for bookkeeping
router.get('/export.csv', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT i.invoice_number, c.first_name || ' ' || c.last_name AS client, c.email,
      i.total, COALESCE(i.amount_paid,0) AS amount_paid, GREATEST(i.total-COALESCE(i.amount_paid,0),0) AS balance_due,
      i.status, i.payment_method, i.paid_at, i.due_date, i.created_at FROM invoices i JOIN clients c ON c.id=i.client_id ORDER BY i.created_at DESC`);
    const headers = ['invoice_number','client','email','total','amount_paid','balance_due','status','payment_method','paid_at','due_date','created_at'];
    const csv = [headers.join(','), ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    res.type('text/csv').set('Content-Disposition','attachment; filename="snowbros-invoices.csv"').send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/accounting.csv', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT i.invoice_number AS transaction_id, i.created_at::date AS transaction_date,
      c.first_name || ' ' || c.last_name AS customer, c.email, 'Invoice' AS transaction_type,
      i.subtotal AS income, i.tax_amount AS sales_tax, i.total AS gross_total,
      COALESCE(i.amount_paid,0) AS paid, GREATEST(i.total-COALESCE(i.amount_paid,0),0) AS open_balance,
      i.payment_method, i.status, i.due_date, i.paid_at FROM invoices i JOIN clients c ON c.id=i.client_id ORDER BY i.created_at`);
    const headers = ['transaction_id','transaction_date','customer','email','transaction_type','income','sales_tax','gross_total','paid','open_balance','payment_method','status','due_date','paid_at'];
    const csv = [headers.join(','), ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    res.type('text/csv').set('Content-Disposition','attachment; filename="snowbros-accounting-export.csv"').send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single invoice with items

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
    const { rows: payments } = await req.db.query('SELECT * FROM invoice_payments WHERE invoice_id=$1 ORDER BY paid_at DESC, id DESC', [req.params.id]);
    const { rows: audit } = await req.db.query('SELECT * FROM invoice_audit_log WHERE invoice_id=$1 ORDER BY created_at DESC LIMIT 100', [req.params.id]);
    res.json({ ...invoice, balance_due: Math.max(Number(invoice.total) - Number(invoice.amount_paid || 0), 0), items, payments, audit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create invoice (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_id, items, tax_rate, notes, service_date, due_date } = req.body;
    if (!client_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Client and at least one line item required' });
    }

    // Generate invoice number
    const count = (await req.db.query('SELECT COUNT(*) as cnt FROM invoices')).rows[0].cnt;
    const invoice_number = `INV-${String(parseInt(count) + 1001).padStart(5, '0')}`;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxRate = tax_rate || 0;
    const tax_amount = subtotal * (taxRate / 100);
    const total = subtotal + tax_amount;

    const result = await req.db.query(
      `INSERT INTO invoices (invoice_number, client_id, subtotal, tax_rate, tax_amount, total, notes, service_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [invoice_number, client_id, subtotal, taxRate, tax_amount, total, notes || '',
       service_date || null, due_date || null]
    );

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
    const allowed = ['draft','sent','partial','paid','overdue','void'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid invoice status' });
    const { rows } = await req.db.query('SELECT status FROM invoices WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Invoice not found' });
    await req.db.query("UPDATE invoices SET status=$1, paid_at=CASE WHEN $1='paid' THEN COALESCE(paid_at,NOW()) ELSE NULL END WHERE id=$2", [status, req.params.id]);
    await req.db.query('INSERT INTO invoice_audit_log (invoice_id,action,details,created_by) VALUES ($1,$2,$3,$4)', [req.params.id, 'status_changed', `${rows[0].status} → ${status}`, req.user.id]);
    res.json({ message: 'Invoice status updated', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark an invoice paid in full in one step, recording the remaining balance.
router.post('/:id/pay-in-full', authenticateToken, requireAdmin, async (req, res) => {
  const db = req.db;
  try {
    const method = String(req.body.payment_method || 'other').trim().toLowerCase();
    const allowedMethods = ['cash','check','venmo','cash_app','zelle','card','bank_transfer','other'];
    if (!allowedMethods.includes(method)) return res.status(400).json({ error: 'Invalid payment method' });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [req.params.id]);
      const inv = rows[0];
      if (!inv) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found' }); }
      const balance = Math.max(Number(inv.total) - Number(inv.amount_paid || 0), 0);
      if (balance > 0.01) {
        await client.query(`INSERT INTO invoice_payments (invoice_id,amount,payment_method,reference,notes,created_by)
          VALUES ($1,$2,$3,$4,$5,$6)`, [req.params.id, balance, method, req.body.reference || '', req.body.notes || 'Marked paid in full', req.user.id]);
      }
      await client.query(`UPDATE invoices SET amount_paid=$1,status='paid',paid_at=COALESCE(paid_at,NOW()),
        payment_method=$2,payment_reference=$3,payment_notes=$4 WHERE id=$5`,
        [Number(inv.total), method, req.body.reference || '', req.body.notes || 'Marked paid in full', req.params.id]);
      await client.query('INSERT INTO invoice_audit_log (invoice_id,action,details,created_by) VALUES ($1,$2,$3,$4)', [req.params.id, 'paid_in_full', `$${balance.toFixed(2)} remaining balance marked paid in full via ${method}`, req.user.id]);
      await client.query('COMMIT');
      res.status(201).json({ status: 'paid', amount_paid: Number(inv.total), balance_due: 0 });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Record a full or partial payment
router.post('/:id/payments', authenticateToken, requireAdmin, async (req, res) => {
  const db = req.db;
  try {
    const amount = Number(req.body.amount);
    const method = String(req.body.payment_method || 'other').trim().toLowerCase();
    const allowedMethods = ['cash','check','venmo','cash_app','zelle','card','bank_transfer','other'];
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Payment amount must be greater than zero' });
    if (!allowedMethods.includes(method)) return res.status(400).json({ error: 'Invalid payment method' });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [req.params.id]);
      const inv = rows[0];
      if (!inv) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found' }); }
      const balance = Math.max(Number(inv.total) - Number(inv.amount_paid || 0), 0);
      if (amount > balance + 0.01) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Payment exceeds remaining balance of $${balance.toFixed(2)}` }); }
      const payment = await client.query(`INSERT INTO invoice_payments (invoice_id,amount,payment_method,reference,notes,created_by)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [req.params.id, amount, method, req.body.reference || '', req.body.notes || '', req.user.id]);
      const newPaid = Number(inv.amount_paid || 0) + amount;
      const newStatus = newPaid >= Number(inv.total) - 0.01 ? 'paid' : 'partial';
      await client.query(`UPDATE invoices SET amount_paid=$1,status=$2,paid_at=CASE WHEN $2='paid' THEN NOW() ELSE paid_at END,
        payment_method=$3,payment_reference=$4,payment_notes=$5 WHERE id=$6`, [newPaid, newStatus, method, req.body.reference || '', req.body.notes || '', req.params.id]);
      await client.query('INSERT INTO invoice_audit_log (invoice_id,action,details,created_by) VALUES ($1,$2,$3,$4)', [req.params.id, 'payment_recorded', `$${amount.toFixed(2)} via ${method}; total paid $${newPaid.toFixed(2)}`, req.user.id]);
      await client.query('COMMIT');
      res.status(201).json({ payment: payment.rows[0], status: newStatus, amount_paid: newPaid, balance_due: Math.max(Number(inv.total)-newPaid,0) });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Send a payment reminder and record it
router.post('/:id/remind', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT i.*, c.first_name,c.email FROM invoices i JOIN clients c ON c.id=i.client_id WHERE i.id=$1`, [req.params.id]);
    const inv = rows[0];
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const balance = Math.max(Number(inv.total)-Number(inv.amount_paid||0),0);
    if (!inv.email || inv.email.includes('@snowbros.placeholder')) return res.status(400).json({ error: 'Client has no valid email address' });
    const html = wrapEmail(`<h2 style="color:#b45309;margin-top:0;">Payment reminder — Invoice ${inv.invoice_number}</h2><p>Hi ${inv.first_name},</p><p>This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> has an outstanding balance of <strong>$${balance.toFixed(2)}</strong>.</p><p>Please log in to your client portal or contact us if you have already paid.</p>`, `Payment Reminder · ${inv.invoice_number}`);
    await sendMail({ to: inv.email, subject: `Payment reminder for invoice ${inv.invoice_number}`, html });
    await req.db.query('UPDATE invoices SET last_reminder_at=NOW(), reminder_count=COALESCE(reminder_count,0)+1 WHERE id=$1', [req.params.id]);
    await req.db.query('INSERT INTO invoice_audit_log (invoice_id,action,details,created_by) VALUES ($1,$2,$3,$4)', [req.params.id, 'reminder_sent', `Balance $${balance.toFixed(2)}`, req.user.id]);
    res.json({ message: 'Payment reminder sent' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reconcile a payment against a bank deposit
router.put('/payments/:paymentId/deposit', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`UPDATE invoice_payments SET deposited_at=COALESCE($1::timestamp,NOW()), deposit_reference=$2 WHERE id=$3 RETURNING *`, [req.body.deposited_at || null, req.body.deposit_reference || '', req.params.paymentId]);
    if (!rows[0]) return res.status(404).json({ error: 'Payment not found' });
    await req.db.query('INSERT INTO invoice_audit_log (invoice_id,action,details,created_by) VALUES ($1,$2,$3,$4)', [rows[0].invoice_id, 'payment_deposited', `Deposit ${req.body.deposit_reference || '(no reference)'}`, req.user.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Void an issued invoice without destroying its history
router.put('/:id/void', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`UPDATE invoices SET status='void', voided_at=NOW(), void_reason=$1 WHERE id=$2 AND status <> 'paid' RETURNING *`, [req.body.reason || '', req.params.id]);
    if (!rows[0]) return res.status(400).json({ error: 'Invoice not found or already paid' });
    await req.db.query('INSERT INTO invoice_audit_log (invoice_id,action,details,created_by) VALUES ($1,$2,$3,$4)', [req.params.id, 'invoice_voided', req.body.reason || '', req.user.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Send a receipt for a specific payment
router.post('/payments/:paymentId/receipt', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await req.db.query(`SELECT p.*, i.invoice_number, c.first_name, c.email FROM invoice_payments p JOIN invoices i ON i.id=p.invoice_id JOIN clients c ON c.id=i.client_id WHERE p.id=$1`, [req.params.paymentId]);
    const payment = rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (!payment.email || payment.email.includes('@snowbros.placeholder')) return res.status(400).json({ error: 'Client has no valid email address' });
    const html = wrapEmail(`<h2 style="color:#15803d;margin-top:0;">Payment receipt · ${payment.invoice_number}</h2><p>Hi ${payment.first_name},</p><p>We received your payment of <strong>$${Number(payment.amount).toFixed(2)}</strong> via <strong>${payment.payment_method}</strong>.</p><p>Reference: ${payment.reference || '—'}</p>`, `Payment Receipt · ${payment.invoice_number}`);
    await sendMail({ to: payment.email, subject: `Payment receipt for ${payment.invoice_number}`, html });
    await req.db.query('UPDATE invoice_payments SET receipt_sent_at=NOW() WHERE id=$1', [req.params.paymentId]);
    res.json({ message: 'Receipt sent' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Store a bookkeeping attachment URL
router.post('/:id/attachments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!req.body.name || !req.body.url) return res.status(400).json({ error: 'Attachment name and URL are required' });
    const { rows } = await req.db.query('INSERT INTO invoice_attachments (invoice_id,payment_id,name,url,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.params.id, req.body.payment_id || null, req.body.name, req.body.url, req.user.id]);
    await req.db.query('INSERT INTO invoice_audit_log (invoice_id,action,details,created_by) VALUES ($1,$2,$3,$4)', [req.params.id, 'attachment_added', req.body.name, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Scan/upload a receipt from a phone camera and attach it to the invoice/payment
router.post('/:id/receipt-scan', authenticateToken, requireAdmin, receiptUpload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No receipt image uploaded' });
    const { url, filename } = getFileInfo(req.file, 'receipts');
    const { rows } = await req.db.query(`INSERT INTO invoice_attachments (invoice_id,payment_id,name,url,created_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`, [req.params.id, req.body.payment_id || null, req.body.name || `Receipt scan ${new Date().toLocaleDateString()}`, url, req.user.id]);
    await req.db.query('INSERT INTO invoice_audit_log (invoice_id,action,details,created_by) VALUES ($1,$2,$3,$4)', [req.params.id, 'receipt_scanned', filename, req.user.id]);
    res.status(201).json({ ...rows[0], url, ocr: { status: 'manual_review_required', message: 'Receipt image saved. Enter amount, date, and check/reference if needed.' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
        <a href="${BASE_URL}/client/invoices" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">View Invoice in Your Portal</a>
        <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">Log in at <a href="${BASE_URL}/login" style="color:#1e40af;">${BASE_URL}/login</a> to view, download, or print this invoice.</p>
      </div>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;font-weight:700;color:#15803d;">Payment Options</p>
        <p style="margin:6px 0 0;color:#374151;font-size:13px;">Cash App: <strong>$SnowBros</strong> &nbsp;|&nbsp; Venmo: <a href="${BUSINESS.venmoUrl}" style="color:#1e40af;text-decoration:none;"><strong>${BUSINESS.venmoHandle}</strong></a> &nbsp;|&nbsp; Zelle: <strong>${BUSINESS.phone}</strong></p>
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

// Send invoice via SMS (generates text for manual sending)
router.post('/:id/send-sms', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows: invRows } = await req.db.query(
      `SELECT i.*, c.first_name, c.last_name, c.phone AS client_phone, c.email AS client_email
       FROM invoices i JOIN clients c ON i.client_id = c.id
       WHERE i.id = $1`, [req.params.id]);
    const inv = invRows[0];
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const smsText = `Hi ${inv.first_name}! You have a new invoice from Snow Bro's:\n\nInvoice: ${inv.invoice_number}\nAmount: $${parseFloat(inv.total).toFixed(2)}\n${inv.due_date ? `Due: ${new Date(inv.due_date).toLocaleDateString()}\n` : ''}\nPay via:\n- Cash App: $SnowBros\n- Venmo: ${BUSINESS.venmoHandle}\n- Zelle: ${BUSINESS.phone}\n\nView details: ${BASE_URL}/login\nRef: ${inv.invoice_number}`;

    res.json({
      message: 'SMS text generated',
      sms_text: smsText,
      phone: inv.client_phone || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually trigger billing cycle (admin)
router.post('/run-billing', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await runBillingCycle(req.db);
    res.json({ message: 'Billing cycle completed', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete invoice (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await req.db.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
