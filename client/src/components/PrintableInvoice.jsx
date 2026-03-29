/**
 * PrintableInvoice — opens a new browser window with a print-ready, letter-paper
 * formatted invoice. No nav bars, clean layout, proper margins for mailing.
 *
 * Usage:
 *   import { printInvoice } from './PrintableInvoice';
 *   printInvoice(invoiceData);
 */

export function printInvoice(inv) {
  const items = (inv.items || []);
  const subtotal   = Number(inv.subtotal  || 0).toFixed(2);
  const taxRate    = Number(inv.tax_rate  || 0);
  const taxAmount  = Number(inv.tax_amount || 0).toFixed(2);
  const total      = Number(inv.total     || 0).toFixed(2);
  const isPaid     = inv.status === 'paid';
  const invoiceDate = inv.created_at ? inv.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const dueDate     = inv.due_date   ? inv.due_date.slice(0, 10)   : '';

  // Build address lines
  const clientAddress = [
    inv.client_address,
    [inv.client_city, inv.client_state, inv.client_zip].filter(Boolean).join(' ')
  ].filter(Boolean).join('\n');

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escHtml(it.description)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${Number(it.quantity)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(it.unit_price).toFixed(2)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">$${Number(it.total).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${escHtml(inv.invoice_number)} — Snow Bro's</title>
  <style>
    /* ── Reset & base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1e293b;
      background: #fff;
    }

    /* ── Print page setup ── */
    @page {
      size: letter portrait;
      margin: 0.75in 0.75in 0.75in 0.75in;
    }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }

    /* ── Screen wrapper ── */
    .page {
      max-width: 7in;
      margin: 0 auto;
      padding: 0.5in;
      background: #fff;
    }

    /* ── Header band ── */
    .header {
      display: flex;
      align-items: center;
      gap: 18px;
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      color: #fff;
      padding: 20px 24px;
      border-radius: 8px 8px 0 0;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url('/logo.jpg') center/contain no-repeat;
      opacity: 0.06;
      pointer-events: none;
    }
    .header img {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(255,255,255,0.4);
      flex-shrink: 0;
      position: relative;
    }
    .header-info { flex: 1; position: relative; }
    .header-info h1 { font-size: 22pt; font-weight: 800; letter-spacing: .01em; line-height: 1.1; }
    .header-info p  { font-size: 9pt; opacity: .85; margin-top: 5px; line-height: 1.8; }
    .header-info a  { color: rgba(255,255,255,0.9); text-decoration: none; }
    .invoice-badge {
      position: relative;
      text-align: right;
      flex-shrink: 0;
    }
    .invoice-badge .label { font-size: 9pt; opacity: .7; text-transform: uppercase; letter-spacing: .08em; }
    .invoice-badge .number { font-size: 16pt; font-weight: 800; }

    /* ── Body ── */
    .body {
      border: 1px solid #e2e8f0;
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 24px;
    }

    /* ── Address block ── */
    .address-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
    }
    .address-block h3 {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #64748b;
      margin-bottom: 6px;
    }
    .address-block p { font-size: 10.5pt; line-height: 1.7; white-space: pre-line; }
    .address-block strong { font-size: 11.5pt; }

    .invoice-meta { text-align: right; }
    .invoice-meta table { margin-left: auto; border-collapse: collapse; }
    .invoice-meta td { padding: 3px 0 3px 16px; font-size: 10pt; }
    .invoice-meta td:first-child { color: #64748b; text-align: right; }
    .invoice-meta td:last-child  { font-weight: 700; text-align: right; }

    /* ── Status stamp ── */
    .status-stamp {
      display: inline-block;
      padding: 3px 14px;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .status-paid     { background: #dcfce7; color: #16a34a; border: 2px solid #16a34a; }
    .status-unpaid   { background: #fee2e2; color: #dc2626; border: 2px solid #dc2626; }
    .status-sent     { background: #dbeafe; color: #2563eb; border: 2px solid #2563eb; }
    .status-overdue  { background: #fef3c7; color: #d97706; border: 2px solid #d97706; }
    .status-draft    { background: #f1f5f9; color: #64748b; border: 2px solid #94a3b8; }

    /* ── Line items table ── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .items-table thead tr {
      background: #1e3a5f;
      color: #fff;
    }
    .items-table thead th {
      padding: 9px 10px;
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .items-table thead th:first-child { text-align: left; border-radius: 4px 0 0 4px; }
    .items-table thead th:last-child  { border-radius: 0 4px 4px 0; }
    .items-table tbody tr:nth-child(even) { background: #f8fafc; }
    .items-table tfoot td {
      padding: 6px 10px;
      font-size: 10pt;
      border-top: 1px solid #e2e8f0;
    }

    /* ── Totals ── */
    .totals-row { display: flex; justify-content: flex-end; margin-bottom: 20px; }
    .totals-box {
      min-width: 220px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }
    .totals-box table { width: 100%; border-collapse: collapse; }
    .totals-box td { padding: 7px 14px; font-size: 10pt; }
    .totals-box tr:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }
    .totals-box tr:last-child { background: #1e3a5f; color: #fff; }
    .totals-box tr:last-child td { font-size: 13pt; font-weight: 800; }
    .totals-box td:last-child { text-align: right; font-weight: 600; }

    /* ── Notes ── */
    .notes-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 9.5pt;
      color: #475569;
      margin-bottom: 20px;
    }
    .notes-box strong { display: block; margin-bottom: 4px; color: #1e293b; }

    /* ── Payment instructions ── */
    .payment-box {
      border: 2px solid #2563eb;
      border-radius: 8px;
      padding: 16px 20px;
      background: #eff6ff;
      margin-bottom: 20px;
    }
    .payment-box h3 {
      font-size: 11pt;
      font-weight: 800;
      color: #1e40af;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .payment-box p { font-size: 9.5pt; color: #1e40af; line-height: 1.7; }
    .payment-box .methods { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 8px; }
    .payment-box .method  { font-size: 9.5pt; color: #1e3a5f; font-weight: 600; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      font-size: 8.5pt;
      color: #94a3b8;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      line-height: 1.8;
    }

    /* ── Print button (screen only) ── */
    .print-btn {
      display: block;
      margin: 20px auto 0;
      padding: 10px 32px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 11pt;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: .02em;
    }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <img src="/logo.jpg" alt="Snow Bro's Logo" onerror="this.style.display='none'" />
    <div class="header-info">
      <h1>Snow Bro's</h1>
      <p>
        1812 33rd St S, Moorhead, MN 56560<br>
        <a href="tel:2183315145">218-331-5145</a>
        &nbsp;·&nbsp;
        <a href="mailto:prosnowbros@prosnowbros.com">prosnowbros@prosnowbros.com</a><br>
        <a href="https://prosnowbros.com">prosnowbros.com</a>
      </p>
    </div>
    <div class="invoice-badge">
      <div class="label">Invoice</div>
      <div class="number">${escHtml(inv.invoice_number)}</div>
      <div style="margin-top:6px;">
        <span class="status-stamp status-${isPaid ? 'paid' : (inv.status === 'overdue' ? 'overdue' : (inv.status === 'sent' ? 'sent' : (inv.status === 'draft' ? 'draft' : 'unpaid')))}">
          ${isPaid ? 'PAID' : inv.status?.toUpperCase() || 'UNPAID'}
        </span>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Address + Meta -->
    <div class="address-row">
      <div>
        <div class="address-block">
          <h3>Bill To</h3>
          <p><strong>${escHtml(inv.client_name || '')}</strong>
${clientAddress ? '\n' + escHtml(clientAddress) : ''}${inv.client_email ? '\n' + escHtml(inv.client_email) : ''}${inv.client_phone ? '\n' + escHtml(inv.client_phone) : ''}</p>
        </div>
      </div>
      <div class="invoice-meta">
        <table>
          <tr><td>Invoice Date:</td><td>${invoiceDate}</td></tr>
          ${dueDate ? `<tr><td>Due Date:</td><td>${dueDate}</td></tr>` : ''}
          <tr><td>Invoice #:</td><td>${escHtml(inv.invoice_number)}</td></tr>
          <tr><td>Status:</td><td><span class="status-stamp status-${isPaid ? 'paid' : (inv.status === 'overdue' ? 'overdue' : (inv.status === 'sent' ? 'sent' : 'draft'))}">${isPaid ? 'PAID' : inv.status?.toUpperCase() || 'UNPAID'}</span></td></tr>
        </table>
      </div>
    </div>

    <!-- Line Items -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align:left;">Description</th>
          <th style="text-align:center;width:60px;">Qty</th>
          <th style="text-align:right;width:90px;">Unit Price</th>
          <th style="text-align:right;width:90px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="4" style="padding:12px 10px;color:#94a3b8;text-align:center;">No line items</td></tr>`}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-row">
      <div class="totals-box">
        <table>
          <tr><td>Subtotal</td><td>$${subtotal}</td></tr>
          ${taxRate > 0 ? `<tr><td>Tax (${taxRate}%)</td><td>$${taxAmount}</td></tr>` : ''}
          <tr><td>Total Due</td><td>$${total}</td></tr>
        </table>
      </div>
    </div>

    ${inv.notes ? `
    <!-- Notes -->
    <div class="notes-box">
      <strong>Notes</strong>
      ${escHtml(inv.notes)}
    </div>
    ` : ''}

    <!-- Payment Instructions -->
    ${!isPaid ? `
    <div class="payment-box">
      <h3>💳 Payment Instructions</h3>
      <p>Please make payment by the due date. We accept the following payment methods:</p>
      <div class="methods">
        <span class="method">💵 Cash</span>
        <span class="method">🏦 Check (payable to Snow Bro's)</span>
        <span class="method">📱 Venmo / Zelle</span>
        <span class="method">💳 Credit / Debit Card</span>
      </div>
      <p style="margin-top:10px;">
        To pay online, visit:
        <strong>snowbros-production.up.railway.app</strong>
        and log in to your client portal, or call us at
        <strong>218-331-5145</strong>.
      </p>
    </div>
    ` : `
    <div class="payment-box" style="border-color:#16a34a;background:#f0fdf4;">
      <h3 style="color:#15803d;">✅ Payment Received — Thank You!</h3>
      <p style="color:#15803d;">This invoice has been paid in full. Thank you for your business!</p>
    </div>
    `}

    <!-- Footer -->
    <div class="footer">
      <strong>Snow Bro's</strong> · 1812 33rd St S, Moorhead, MN 56560 · 218-331-5145 · prosnowbros.com<br>
      Thank you for choosing Snow Bro's for your lawn care and snow removal needs!
    </div>

  </div><!-- /body -->

  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>

</div><!-- /page -->
<script>
  // Auto-focus for keyboard shortcut Ctrl+P
  window.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); window.print(); }
  });
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=1100');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
  }
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Default export: a reusable Print button component
export default function PrintInvoiceButton({ invoice, className = '', label = '🖨️ Print Invoice' }) {
  return (
    <button
      className={className || 'btn btn-secondary btn-sm'}
      onClick={() => printInvoice(invoice)}
      title="Open print-ready invoice in new window"
    >
      {label}
    </button>
  );
}
