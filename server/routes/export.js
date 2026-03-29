const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Helper: convert an array of objects to CSV string
function toCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

// GET /api/export/backup  — streams a ZIP file with 5 CSV files
router.get('/backup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = req.db;

    // Fetch all tables (exclude sensitive fields like password_hash)
    const [clients, employees, bookings, contracts, services] = await Promise.all([
      db.query(`SELECT id, first_name, last_name, email, phone, address, city, state, zip,
                       notes, active, service_type, latitude, longitude, created_at
                FROM clients ORDER BY id`),
      db.query(`SELECT id, first_name, last_name, email, phone, role, title,
                       active, created_at
                FROM employees ORDER BY id`),
      db.query(`SELECT b.id, b.client_id,
                       c.first_name || ' ' || c.last_name AS client_name,
                       s.name AS service_name,
                       b.scheduled_date, b.scheduled_time, b.status,
                       b.address, b.city, b.state, b.zip,
                       b.price, b.notes, b.created_at
                FROM bookings b
                LEFT JOIN clients c ON b.client_id = c.id
                LEFT JOIN services s ON b.service_id = s.id
                ORDER BY b.id`),
      db.query(`SELECT id, client_id, title, status, total_amount,
                       signed_at, created_at
                FROM contracts ORDER BY id`),
      db.query(`SELECT id, name, description, base_price, category, active, created_at
                FROM services ORDER BY id`),
    ]);

    const now = new Date();
    const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `snowbros-backup-${stamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    archive.append(toCsv(clients.rows),   { name: 'clients.csv' });
    archive.append(toCsv(employees.rows), { name: 'employees.csv' });
    archive.append(toCsv(bookings.rows),  { name: 'bookings.csv' });
    archive.append(toCsv(contracts.rows), { name: 'contracts.csv' });
    archive.append(toCsv(services.rows),  { name: 'services.csv' });

    // Also include a manifest
    const manifest = [
      `Snow Bro's Data Backup`,
      `Generated: ${now.toISOString()}`,
      ``,
      `Files included:`,
      `  clients.csv   — ${clients.rows.length} records`,
      `  employees.csv — ${employees.rows.length} records`,
      `  bookings.csv  — ${bookings.rows.length} records`,
      `  contracts.csv — ${contracts.rows.length} records`,
      `  services.csv  — ${services.rows.length} records`,
    ].join('\n');
    archive.append(manifest, { name: 'README.txt' });

    await archive.finalize();
  } catch (err) {
    console.error('Export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
