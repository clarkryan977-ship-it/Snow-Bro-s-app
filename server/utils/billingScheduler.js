/**
 * Billing Scheduler — runs daily, generates invoices for contracts with monthly billing
 * on their configured billing_day.
 */
const { sendMail } = require('./mailer');
const { wrapEmail, BUSINESS } = require('./emailHeader');

const BASE_URL = process.env.BASE_URL || 'https://snowbros-production.up.railway.app';

async function runBillingCycle(db) {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const monthName = today.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  console.log(`[billing] Running billing cycle for day ${dayOfMonth} of ${monthName}`);

  try {
    // Find all signed/active contracts with monthly billing that match today's billing day
    // and haven't been billed this month yet
    const { rows: contracts } = await db.query(`
      SELECT co.*, 
             c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip
      FROM contracts co
      JOIN clients c ON co.client_id = c.id
      WHERE co.billing_type = 'monthly'
        AND co.status = 'signed'
        AND co.billing_day = $1
        AND (co.monthly_amount IS NOT NULL AND co.monthly_amount != '' AND co.monthly_amount != '0')
        AND c.active = 1
        AND (co.end_date IS NULL OR co.end_date = '' OR co.end_date::date >= CURRENT_DATE)
        AND (co.start_date IS NULL OR co.start_date = '' OR co.start_date::date <= CURRENT_DATE)
        AND (co.last_billed_at IS NULL OR co.last_billed_at < date_trunc('month', CURRENT_DATE))
    `, [dayOfMonth]);

    console.log(`[billing] Found ${contracts.length} contracts to bill`);

    let generated = 0;
    let emailed = 0;
    let errors = 0;

    for (const contract of contracts) {
      try {
        const amount = parseFloat(contract.monthly_amount);
        if (isNaN(amount) || amount <= 0) {
          console.log(`[billing] Skipping contract ${contract.id}: invalid amount "${contract.monthly_amount}"`);
          continue;
        }

        // Generate invoice number
        const countResult = await db.query('SELECT COUNT(*) as cnt FROM invoices');
        const count = parseInt(countResult.rows[0].cnt);
        const invoice_number = `INV-${String(count + 1001).padStart(5, '0')}`;

        // Determine service description
        const isSnow = contract.service_category === 'snow';
        const description = `${isSnow ? 'Snow Removal' : 'Lawn Care'} — Monthly Service (${monthName})`;

        // Create the invoice
        const serviceDate = today.toISOString().split('T')[0];
        const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const result = await db.query(
          `INSERT INTO invoices (invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, notes, service_date, due_date, auto_generated, contract_id)
           VALUES ($1, $2, $3, 0, 0, $3, 'sent', $4, $5, $6, TRUE, $7) RETURNING id`,
          [invoice_number, contract.client_id, amount, `Auto-generated from contract: ${contract.title}`, serviceDate, dueDate, contract.id]
        );
        const invoiceId = result.rows[0].id;

        // Add line item
        await db.query(
          'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES ($1, $2, 1, $3, $3)',
          [invoiceId, description, amount]
        );

        // Update last_billed_at on the contract
        await db.query('UPDATE contracts SET last_billed_at = NOW() WHERE id = $1', [contract.id]);

        generated++;
        console.log(`[billing] Generated invoice ${invoice_number} for ${contract.first_name} ${contract.last_name} — $${amount.toFixed(2)}`);

        // Send email if client has a valid email
        if (contract.email && !contract.email.includes('@snowbros.placeholder')) {
          try {
            const html = wrapEmail(`
              <h2 style="color:#1e40af;margin-top:0;">Invoice ${invoice_number}</h2>
              <p>Hi ${contract.first_name},</p>
              <p>Your monthly service invoice from <strong>Snow Bro's</strong> has been generated.</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
                <thead>
                  <tr style="background:#1e40af;color:#fff;">
                    <th style="padding:10px 14px;text-align:left;">Description</th>
                    <th style="padding:10px 14px;text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;">${description}</td>
                    <td style="padding:10px 14px;color:#374151;border-top:1px solid #e5e7eb;text-align:right;font-weight:600;">$${amount.toFixed(2)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="background:#eff6ff;">
                    <td style="padding:12px 14px;font-weight:800;font-size:16px;text-align:right;color:#1e40af;">Total Due</td>
                    <td style="padding:12px 14px;font-weight:800;font-size:16px;text-align:right;color:#1e40af;">$${amount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
              <p style="color:#6b7280;font-size:13px;">Due Date: ${new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${BASE_URL}/client/invoices" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">View Invoice in Your Portal</a>
              </div>
              <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
                <p style="margin:0;font-weight:700;color:#15803d;">Payment Options</p>
                <p style="margin:6px 0 0;color:#374151;font-size:13px;">Cash App: <strong>$SnowBros</strong> | Venmo: <strong>@SnowBros</strong> | Zelle: <strong>${BUSINESS.phone}</strong></p>
                <p style="margin:4px 0 0;color:#374151;font-size:13px;">Please include invoice number <strong>${invoice_number}</strong> in your payment memo.</p>
              </div>
            `, `Invoice ${invoice_number}`);

            await sendMail({
              to: contract.email,
              subject: `Invoice ${invoice_number} from Snow Bro's — ${monthName}`,
              html
            });

            // Mark as sent
            await db.query('UPDATE invoices SET sent_at = NOW() WHERE id = $1', [invoiceId]);
            emailed++;
            console.log(`[billing] Emailed invoice ${invoice_number} to ${contract.email}`);
          } catch (emailErr) {
            console.error(`[billing] Failed to email invoice ${invoice_number}:`, emailErr.message);
          }
        }
      } catch (contractErr) {
        errors++;
        console.error(`[billing] Error processing contract ${contract.id}:`, contractErr.message);
      }
    }

    console.log(`[billing] Cycle complete: ${generated} invoices generated, ${emailed} emailed, ${errors} errors`);
    return { generated, emailed, errors, total_contracts: contracts.length };
  } catch (err) {
    console.error('[billing] Fatal error in billing cycle:', err.message);
    return { generated: 0, emailed: 0, errors: 1, total_contracts: 0 };
  }
}

/**
 * Start the billing scheduler — runs once per day at midnight
 */
function startBillingScheduler(db) {
  // Run immediately on startup to catch any missed billings
  setTimeout(() => {
    console.log('[billing] Running startup billing check...');
    runBillingCycle(db).catch(err => console.error('[billing] Startup check failed:', err.message));
  }, 30000); // Wait 30 seconds after server start

  // Then run every 24 hours at midnight
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = nextMidnight - now;

  setTimeout(() => {
    runBillingCycle(db).catch(err => console.error('[billing] Scheduled run failed:', err.message));
    // Then every 24 hours
    setInterval(() => {
      runBillingCycle(db).catch(err => console.error('[billing] Scheduled run failed:', err.message));
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log(`[billing] Scheduler started. Next run in ${Math.round(msUntilMidnight / 60000)} minutes (midnight)`);
}

module.exports = { runBillingCycle, startBillingScheduler };
