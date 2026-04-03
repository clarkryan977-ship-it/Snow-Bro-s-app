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
app.use('/api/weather',          require('./routes/weather'));

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

// ── Weather snapshot scheduler: persist KFAR observations every hour ──
// This builds a historical weather record used for route history service verification.
function startWeatherSnapshotScheduler(db) {
  const https = require('https');

  const fetchAndStore = async () => {
    try {
      const html = await new Promise((resolve, reject) => {
        const req = https.get(
          'https://forecast.weather.gov/data/obhistory/KFAR.html',
          { headers: { 'User-Agent': 'SnowBros-WeatherLogger/1.0' }, timeout: 12000 },
          (res) => { let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(b)); }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });

      // Parse observation rows
      const allTrs = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      const strip = h => h.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&deg;/g,'\u00b0').replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ').trim();
      const obsRows = allTrs.filter(tr => {
        const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)||[]).map(strip);
        return cells.length >= 10 && /^\d{1,2}$/.test(cells[0]) && /^\d{2}:\d{2}$/.test(cells[1]);
      });

      if (!obsRows.length) return;

      // Store up to the last 6 observations (backfill recent hours)
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth(); // 0-indexed

      for (const tr of obsRows.slice(0, 6)) {
        const cells = (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)||[]).map(strip);
        const day = parseInt(cells[0]), time = cells[1]; // e.g. "14:53"
        const [hh, mm] = time.split(':').map(Number);
        // Construct UTC observed_at — use current month/year, handle month rollover
        let obsDate = new Date(Date.UTC(year, month, day, hh, mm, 0));
        // If the day is in the future (e.g. day=31 but today=1), it's last month
        if (obsDate > now) obsDate = new Date(Date.UTC(year, month - 1, day, hh, mm, 0));

        const row = {
          observed_at: obsDate.toISOString(),
          air_temp:    cells[6]  || '',
          wind:        cells[2]  || '',
          weather:     cells[4]  || '',
          sky_cond:    cells[5]  || '',
          precip_1hr:  cells[15] || '',
          precip_3hr:  cells[16] || '',
          precip_6hr:  cells[17] || '',
          humidity:    cells[10] || '',
          visibility:  cells[3]  || '',
          wind_chill:  cells[11] || '',
          raw_json:    JSON.stringify({ cells }),
        };
        await db.query(`
          INSERT INTO weather_snapshots
            (observed_at, air_temp, wind, weather, sky_cond, precip_1hr, precip_3hr, precip_6hr, humidity, visibility, wind_chill, raw_json)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (observed_at) DO NOTHING
        `, [row.observed_at, row.air_temp, row.wind, row.weather, row.sky_cond,
            row.precip_1hr, row.precip_3hr, row.precip_6hr, row.humidity, row.visibility,
            row.wind_chill, row.raw_json]);
      }
      console.log(`[weather-snapshot] Stored up to ${Math.min(obsRows.length, 6)} KFAR observations`);
    } catch (err) {
      console.warn('[weather-snapshot] Failed:', err.message);
    }
  };

  // Run immediately on startup, then every 55 minutes
  fetchAndStore();
  setInterval(fetchAndStore, 55 * 60 * 1000);
}

// Initialize DB then start server
initDB().then(() => {
  const db = getPool();

  // Start billing scheduler for automated monthly invoicing
  const { startBillingScheduler } = require('./utils/billingScheduler');
  startBillingScheduler(db);

  // Start weather snapshot scheduler for route history weather context
  startWeatherSnapshotScheduler(db);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Snow Bro's server running on port ${PORT} (PostgreSQL)`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
