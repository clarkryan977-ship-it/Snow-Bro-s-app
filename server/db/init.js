const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 20 });
    } else {
      // Fallback for local dev without DATABASE_URL
      pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: process.env.PGPORT || 5432,
        database: process.env.PGDATABASE || 'snowbros',
        user: process.env.PGUSER || 'snowbros',
        password: process.env.PGPASSWORD || 'snowbros2026secure',
        max: 20,
      });
    }
  }
  return pool;
}

async function initDB() {
  const db = getPool();

  // Services
  await db.query(`
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      price REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Clients
  await db.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      zip TEXT DEFAULT '',
      password_hash TEXT,
      notes TEXT DEFAULT '',
      active INTEGER DEFAULT 0,
      latitude REAL DEFAULT NULL,
      longitude REAL DEFAULT NULL,
      service_type TEXT DEFAULT 'residential',
      referral_code TEXT DEFAULT '',
      referred_by TEXT DEFAULT '',
      referral_credits REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Bookings
  await db.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      service_id INTEGER REFERENCES services(id),
      preferred_date TEXT NOT NULL,
      preferred_time TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      client_name TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      assigned_employee_id INTEGER DEFAULT NULL,
      completed_at TEXT DEFAULT '',
      reminder_sent INTEGER DEFAULT 0,
      followup_sent INTEGER DEFAULT 0,
      recurring_id INTEGER DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Employees
  await db.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      active INTEGER DEFAULT 1,
      title TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Time records
  await db.query(`
    CREATE TABLE IF NOT EXISTS time_records (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      clock_in TIMESTAMP NOT NULL,
      clock_out TIMESTAMP,
      duration_minutes REAL DEFAULT 0,
      job_address TEXT DEFAULT '',
      job_contact TEXT DEFAULT '',
      scope_of_work TEXT DEFAULT '',
      job_notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // GPS locations
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_locations (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      recorded_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Invoices
  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Invoice line items
  await db.query(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0
    )
  `);

  // Email log
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      recipients_count INTEGER DEFAULT 0,
      sent_by INTEGER,
      sent_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Contracts
  await db.query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      client_id INTEGER NOT NULL REFERENCES clients(id),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      signed_at TEXT,
      signature_data TEXT,
      signature_type TEXT DEFAULT '',
      signer_name TEXT DEFAULT '',
      signed_file_path TEXT DEFAULT '',
      uploaded_by INTEGER NOT NULL REFERENCES employees(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Estimates
  await db.query(`
    CREATE TABLE IF NOT EXISTS estimates (
      id SERIAL PRIMARY KEY,
      estimate_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      customer_address TEXT DEFAULT '',
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      notes TEXT DEFAULT '',
      valid_until TEXT DEFAULT '',
      emailed_at TEXT,
      converted_invoice_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Estimate line items
  await db.query(`
    CREATE TABLE IF NOT EXISTS estimate_items (
      id SERIAL PRIMARY KEY,
      estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0
    )
  `);

  // Gallery photos
  await db.query(`
    CREATE TABLE IF NOT EXISTS gallery_photos (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      description TEXT DEFAULT '',
      uploaded_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Job photos
  await db.query(`
    CREATE TABLE IF NOT EXISTS job_photos (
      id SERIAL PRIMARY KEY,
      time_record_id INTEGER NOT NULL REFERENCES time_records(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Reviews
  await db.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER REFERENCES bookings(id),
      client_id INTEGER NOT NULL REFERENCES clients(id),
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Referrals
  await db.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_client_id INTEGER NOT NULL REFERENCES clients(id),
      referral_code TEXT UNIQUE NOT NULL,
      referred_email TEXT DEFAULT '',
      referred_client_id INTEGER,
      status TEXT DEFAULT 'pending',
      discount_amount REAL DEFAULT 10,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Recurring services
  await db.query(`
    CREATE TABLE IF NOT EXISTS recurring_services (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      frequency TEXT NOT NULL DEFAULT 'weekly',
      preferred_day TEXT DEFAULT 'Monday',
      preferred_time TEXT DEFAULT '09:00',
      start_date TEXT NOT NULL,
      end_date TEXT DEFAULT '',
      next_date TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Notifications
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'job_assigned',
      read INTEGER DEFAULT 0,
      related_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Before/After photos
  await db.query(`
    CREATE TABLE IF NOT EXISTS before_after_photos (
      id SERIAL PRIMARY KEY,
      time_record_id INTEGER NOT NULL REFERENCES time_records(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      photo_type TEXT NOT NULL CHECK(photo_type IN ('before','after')),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // App settings
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT DEFAULT '',
      description TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Routes table
  await db.query(`
    CREATE TABLE IF NOT EXISTS routes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'lawn',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Route stops
  await db.query(`
    CREATE TABLE IF NOT EXISTS route_stops (
      id SERIAL PRIMARY KEY,
      route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      position INTEGER NOT NULL DEFAULT 0,
      frequency TEXT DEFAULT 'weekly',
      service_type TEXT DEFAULT 'mowing',
      notes TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Route settings
  await db.query(`
    CREATE TABLE IF NOT EXISTS route_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Crew GPS
  await db.query(`
    CREATE TABLE IF NOT EXISTS crew_gps (
      id SERIAL PRIMARY KEY,
      crew_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── Indexes ──
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
    'CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id)',
    'CREATE INDEX IF NOT EXISTS idx_route_stops_client ON route_stops(client_id)',
  ];
  for (const sql of indexes) {
    try { await db.query(sql); } catch (e) { /* ignore */ }
  }

  // ── Seed default settings ──
  const settingsSeed = [
    ['first_time_discount_enabled', '1', 'First-Time Discount Enabled', 'Show a discount offer to new customers on registration and booking'],
    ['first_time_discount_type', 'fixed', 'Discount Type', 'fixed = dollar amount, percent = percentage off'],
    ['first_time_discount_amount', '10', 'Discount Amount', 'Dollar amount or percentage value (e.g. 10 = $10 off or 10%)'],
    ['first_time_discount_message', "Welcome to Snow Bro's! Get $10 off your first service when you book today.", 'Promo Message', 'Message shown to new customers'],
    ['first_time_discount_code', 'NEWCUSTOMER10', 'Discount Code', 'Code customers can mention when booking'],
    ['snow_day_active', '0', 'Snow Day Active', 'Toggle snow routes on/off'],
    ['eta_start_time', '08:00', 'ETA Start Time', 'Default start time for route ETAs'],
    ['eta_jobs_per_hour', '2', 'ETA Jobs Per Hour', 'Jobs per hour per crew'],
    ['eta_num_crews', '1', 'ETA Number of Crews', 'Number of active crews'],
  ];
  for (const [key, value, label, description] of settingsSeed) {
    await db.query(
      `INSERT INTO app_settings (key, value, label, description) VALUES ($1, $2, $3, $4) ON CONFLICT(key) DO NOTHING`,
      [key, value, label, description]
    );
  }
  // Also seed route_settings
  const routeSettingsSeed = [
    ['snow_day_active', '0'],
    ['eta_start_time', '08:00'],
    ['eta_jobs_per_hour', '2'],
    ['eta_num_crews', '1'],
  ];
  for (const [key, value] of routeSettingsSeed) {
    await db.query(
      `INSERT INTO route_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO NOTHING`,
      [key, value]
    );
  }

  // ── Seed default services ──
  const { rows: svcCount } = await db.query('SELECT COUNT(*) as c FROM services');
  if (parseInt(svcCount[0].c) === 0) {
    const services = [
      ['Grass Mowing', 'Professional lawn mowing service', 45],
      ['Tree Trimming', 'Expert tree and shrub trimming', 85],
      ['Dethatching', 'Remove thatch buildup for healthier lawns', 120],
      ['Aeration', 'Core aeration for improved soil health', 95],
      ['Snow Removal', 'Residential snow removal service', 75],
      ['Gutter Cleaning', 'Complete gutter cleaning and inspection', 110],
      ['Commercial Lawn Care', 'Full-service commercial property lawn maintenance', 150],
      ['Parking Lot Snow Removal', 'Commercial parking lot plowing and clearing', 200],
      ['HOA Lawn & Snow Services', 'Complete HOA property maintenance packages', 175],
      ['Commercial Property Maintenance', 'Year-round commercial grounds maintenance', 250],
      ['Ice Management & De-Icing', 'Professional ice control and de-icing services', 125],
      ['Seasonal Service Contract', 'Custom seasonal maintenance contracts for businesses', 300],
    ];
    for (const [name, desc, price] of services) {
      await db.query('INSERT INTO services (name, description, price) VALUES ($1, $2, $3)', [name, desc, price]);
    }
  }

  // ── Seed admin ──
  const { rows: adminCount } = await db.query("SELECT COUNT(*) as c FROM employees WHERE role='admin'");
  if (parseInt(adminCount[0].c) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.query(
      "INSERT INTO employees (first_name,last_name,email,password_hash,role) VALUES ($1,$2,$3,$4,$5)",
      ['Admin', 'User', 'admin@snowbros.com', hash, 'admin']
    );
  }

  // ── Seed Gabe Clark manager ──
  const { rows: gabeCount } = await db.query("SELECT COUNT(*) as c FROM employees WHERE email='gabe@snowbros.com'");
  if (parseInt(gabeCount[0].c) === 0) {
    const hash = bcrypt.hashSync('manager123', 10);
    await db.query(
      "INSERT INTO employees (first_name,last_name,email,phone,password_hash,role,title) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      ['Gabe', 'Clark', 'gabe@snowbros.com', '218-331-5145', hash, 'manager', 'Operations Manager']
    );
  }

  // ── Seed demo employee ──
  const { rows: empCount } = await db.query("SELECT COUNT(*) as c FROM employees WHERE role='employee'");
  if (parseInt(empCount[0].c) === 0) {
    const hash = bcrypt.hashSync('employee123', 10);
    await db.query(
      "INSERT INTO employees (first_name,last_name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5,$6)",
      ['John', 'Worker', 'john@snowbros.com', '555-0101', hash, 'employee']
    );
  }

  // ── Seed Lisa Clark ──
  const { rows: lisaCount } = await db.query("SELECT COUNT(*) as c FROM clients WHERE email='lisaverbout@midco.net'");
  if (parseInt(lisaCount[0].c) === 0) {
    await db.query(
      "INSERT INTO clients (first_name,last_name,email) VALUES ($1,$2,$3)",
      ['Lisa', 'Clark', 'lisaverbout@midco.net']
    );
  }

  return db;
}

module.exports = { initDB, getPool };
