const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { initDB, getPool } = require('./db/init');
const app = express();
const PORT = process.env.PORT || 3001;

// Support persistent disk for uploads
const UPLOADS_ROOT = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
['contracts','signed','gallery','jobphotos','beforeafter'].forEach(sub => {
  const dir = path.join(UPLOADS_ROOT, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
process.env.UPLOADS_ROOT = UPLOADS_ROOT;

// ── Middleware ──
app.use(compression({ level: 6, threshold: 1024 }));
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Make db pool available to routes
app.use((req, res, next) => {
  req.db = getPool();
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
app.use('/api/routes',        require('./routes/routes'));
app.use('/api/payroll',       require('./routes/payroll'));
app.use('/api/availability',  require('./routes/availability'));
app.use('/api/push',          require('./routes/push'));
app.use('/api/documents',     require('./routes/documents'));
app.use('/api/booking-requests', require('./routes/bookingrequests'));
app.use('/api/export',           require('./routes/export'));
app.use('/api/applications',     require('./routes/applications'));
app.use('/api/touchup',          require('./routes/touchup'));

// ── Serve uploaded files ──
app.use('/uploads', express.static(UPLOADS_ROOT, { maxAge: '1h', etag: true, lastModified: true }));

// ── Serve React build ──
const distPath = path.join(__dirname, '../client/dist');
app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: '365d', immutable: true, etag: false }));
app.use('/icons', express.static(path.join(distPath, 'icons'), { maxAge: '7d', etag: true }));
app.use(express.static(distPath, { maxAge: '1h', etag: true, lastModified: true }));

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  res.sendFile(path.join(distPath, 'index.html'));
});

// Initialize DB then start server
initDB().then(() => {
  // Start billing scheduler for automated monthly invoicing
  const { startBillingScheduler } = require('./utils/billingScheduler');
  startBillingScheduler(getPool());

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Snow Bro's server running on port ${PORT} (PostgreSQL)`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
