const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { initDB } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const db = initDB();

// ── Performance: Database indexes ──
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)',
  'CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email)',
  'CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(preferred_date)',
  'CREATE INDEX IF NOT EXISTS idx_time_records_employee ON time_records(employee_id)',
  'CREATE INDEX IF NOT EXISTS idx_time_records_clockin ON time_records(clock_in)',
  'CREATE INDEX IF NOT EXISTS idx_gps_employee ON gps_locations(employee_id)',
  'CREATE INDEX IF NOT EXISTS idx_gps_recorded ON gps_locations(recorded_at)',
  'CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id)',
  'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
  'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status)',
  'CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status)',
  'CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items(estimate_id)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_client ON reviews(client_id)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id)',
  'CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_client_id)',
  'CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code)',
  'CREATE INDEX IF NOT EXISTS idx_recurring_client ON recurring_services(client_id)',
  'CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_services(active)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_employee ON notifications(employee_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)',
  'CREATE INDEX IF NOT EXISTS idx_job_photos_record ON job_photos(time_record_id)',
  'CREATE INDEX IF NOT EXISTS idx_beforeafter_record ON before_after_photos(time_record_id)',
  'CREATE INDEX IF NOT EXISTS idx_gallery_created ON gallery_photos(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_services_active ON services(active)',
];
for (const sql of indexes) {
  try { db.exec(sql); } catch (e) { /* index may already exist */ }
}

// ── Performance: SQLite optimizations ──
db.pragma('cache_size = -20000');    // 20MB cache
db.pragma('temp_store = MEMORY');    // temp tables in memory
db.pragma('mmap_size = 268435456');  // 256MB memory-mapped I/O
db.pragma('synchronous = NORMAL');   // faster writes (WAL mode is safe)

// ── Middleware ──
// Gzip/Brotli compression for all responses
app.use(compression({ level: 6, threshold: 1024 }));

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Make db available to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// ── API Routes ──
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/services',      require('./routes/services'));
app.use('/api/clients',       require('./routes/clients'));
app.use('/api/bookings',      require('./routes/bookings'));
app.use('/api/employees',     require('./routes/employees'));
app.use('/api/time',          require('./routes/time'));
app.use('/api/gps',           require('./routes/gps'));
app.use('/api/invoices',      require('./routes/invoices'));
app.use('/api/emails',        require('./routes/emails'));
app.use('/api/contracts',     require('./routes/contracts'));
app.use('/api/estimates',     require('./routes/estimates'));
app.use('/api/gallery',       require('./routes/gallery'));
app.use('/api/jobphotos',     require('./routes/jobphotos'));
app.use('/api/reviews',       require('./routes/reviews'));
app.use('/api/referrals',     require('./routes/referrals'));
app.use('/api/recurring',     require('./routes/recurring'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/beforeafter',   require('./routes/beforeafter'));
app.use('/api/revenue',       require('./routes/revenue'));
app.use('/api/calendar',      require('./routes/calendar'));
app.use('/api/settings',      require('./routes/settings'));

// ── Performance: Serve uploaded files with short cache ──
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1h',
  etag: true,
  lastModified: true,
}));

// ── Performance: Serve React build with aggressive caching ──
const distPath = path.join(__dirname, '../client/dist');

// Hashed assets (JS/CSS) — cache for 1 year (immutable)
app.use('/assets', express.static(path.join(distPath, 'assets'), {
  maxAge: '365d',
  immutable: true,
  etag: false,
}));

// Icons and images — cache for 7 days
app.use('/icons', express.static(path.join(distPath, 'icons'), {
  maxAge: '7d',
  etag: true,
}));

// Other static files (logo, favicon, manifest, sw) — cache for 1 hour
app.use(express.static(distPath, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
}));

// SPA fallback — no cache on index.html so updates propagate instantly
app.get('/{*path}', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Snow Bro's server running on port ${PORT}`);
});
