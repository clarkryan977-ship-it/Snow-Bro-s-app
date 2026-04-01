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
      contract_type TEXT DEFAULT 'uploaded',
      service_category TEXT DEFAULT '',
      rate TEXT DEFAULT '',
      start_date TEXT DEFAULT '',
      sign_token TEXT DEFAULT '',
      contract_html TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Add columns if they don't exist (migration for existing tables)
  const contractCols = [
    ["contract_type", "TEXT DEFAULT 'uploaded'"],
    ["service_category", "TEXT DEFAULT ''"],
    ["rate", "TEXT DEFAULT ''"],
    ["start_date", "TEXT DEFAULT ''"],
    ["end_date", "TEXT DEFAULT ''"],
    ["deposit", "TEXT DEFAULT '0'"],
    ["frequency", "TEXT DEFAULT 'Weekly'"],
    ["service_details", "TEXT DEFAULT ''"],
    ["sign_token", "TEXT DEFAULT ''"],
    ["contract_html", "TEXT DEFAULT ''"],
  ];
  for (const [col, def] of contractCols) {
    await db.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {});
  }

  // Estimatess
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

  // Password reset tokens
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE`).catch(() => {});
  // Before/after photos: add booking_id for direct booking linkage (make time_record_id nullable)
  await db.query(`ALTER TABLE before_after_photos ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE`).catch(() => {});
  await db.query(`ALTER TABLE before_after_photos ALTER COLUMN time_record_id DROP NOT NULL`).catch(() => {});
  await db.query(`CREATE INDEX IF NOT EXISTS idx_beforeafter_booking ON before_after_photos(booking_id)`).catch(() => {});
  // Route order for bookings (employee Assigned Jobs page ordering)
  await db.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS route_order INTEGER DEFAULT 9999`).catch(() => {});
  await db.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`).catch(() => {});
  await db.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city TEXT DEFAULT ''`).catch(() => {});
  await db.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS state TEXT DEFAULT ''`).catch(() => {});
  await db.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS zip TEXT DEFAULT ''`).catch(() => {});

  // Live route sessions
  await db.query(`
    CREATE TABLE IF NOT EXISTS route_sessions (
      id SERIAL PRIMARY KEY,
      route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active',
      num_crews INTEGER DEFAULT 1,
      jobs_per_hour REAL DEFAULT 2,
      snow_condition TEXT DEFAULT 'moderate',
      start_time TIMESTAMP NOT NULL DEFAULT NOW(),
      current_stop INTEGER DEFAULT 0,
      admin_lat REAL,
      admin_lng REAL,
      admin_gps_updated_at TIMESTAMP,
      ended_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── Blocked Times (admin availability management) ──
  await db.query(`
    CREATE TABLE IF NOT EXISTS blocked_times (
      id SERIAL PRIMARY KEY,
      block_date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      all_day BOOLEAN DEFAULT TRUE,
      reason TEXT DEFAULT '',
      created_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── Payroll Periods ──
  await db.query(`
    CREATE TABLE IF NOT EXISTS payroll_periods (
      id SERIAL PRIMARY KEY,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      employee_count INTEGER DEFAULT 0,
      total_minutes INTEGER DEFAULT 0,
      total_gross REAL DEFAULT 0,
      paid_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);


  // ── Push Subscriptions ──
  await db.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      subscription_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── Employee Documents ──
  await db.query(`
    CREATE TABLE IF NOT EXISTS employee_documents (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL DEFAULT 'other',
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_data TEXT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── Named Routes: add date + employee assignment columns ──
  await db.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_date DATE`).catch(() => {});
  await db.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS assigned_employee_ids TEXT DEFAULT '[]'`).catch(() => {});
  await db.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`).catch(() => {});
  await db.query(`CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(route_date)`).catch(() => {});
  // route_stops: add booking_id and label columns for mixed booking+client stops
  await db.query(`ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL`).catch(() => {});
  await db.query(`ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS stop_label TEXT DEFAULT ''`).catch(() => {});
  await db.query(`ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`).catch(() => {});
  await db.query(`ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS city TEXT DEFAULT ''`).catch(() => {});
  await db.query(`ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS state TEXT DEFAULT ''`).catch(() => {});
  await db.query(`ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS zip TEXT DEFAULT ''`).catch(() => {});
  // ETA tracking: per-stop completion + route timing fields
  await db.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS minutes_per_stop INTEGER DEFAULT 15`).catch(() => {});
  await db.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_start_time TIME DEFAULT '06:00'`).catch(() => {});
  await db.query(`ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE`).catch(() => {});
  await db.query(`ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`).catch(() => {});
  // One-time booking requests from public (no account required)
  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      zip TEXT DEFAULT '',
      service_type TEXT NOT NULL,
      preferred_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  // ── Billing automation columns ──
  const billingMigrations = [
    // Contracts: billing parameters
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'per-visit'",
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS monthly_amount TEXT DEFAULT ''",
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS billing_day INTEGER DEFAULT 1",
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMP",
    // Invoices: auto-generation tracking
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_date DATE",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP",
  ];
  for (const sql of billingMigrations) {
    await db.query(sql).catch(() => {});
  }

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
    'CREATE INDEX IF NOT EXISTS idx_route_sessions_status ON route_sessions(status)',
    'CREATE INDEX IF NOT EXISTS idx_route_sessions_route ON route_sessions(route_id)',
    'CREATE INDEX IF NOT EXISTS idx_blocked_times_date ON blocked_times(block_date)',
    'CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(start_date, end_date)',
    'CREATE INDEX IF NOT EXISTS idx_push_subs_employee ON push_subscriptions(employee_id)',
    'CREATE INDEX IF NOT EXISTS idx_employee_docs_employee ON employee_documents(employee_id)',
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

  // ── Seed admin@snowbros.com (INSERT only — DO NOTHING on conflict so manual password changes survive redeploys) ──
  const adminHash = bcrypt.hashSync('snowbros2024', 10);
  await db.query(
    `INSERT INTO employees (first_name,last_name,email,password_hash,role,active)
     VALUES ($1,$2,$3,$4,$5,1)
     ON CONFLICT(email) DO NOTHING`,
    ['Admin', 'User', 'admin@snowbros.com', adminHash, 'admin']
  );

  // ── Seed Gabe Clark (INSERT only — DO NOTHING on conflict) ──
  const gabeHash = bcrypt.hashSync('GabeClark2024!', 10);
  await db.query(
    `INSERT INTO employees (first_name,last_name,email,phone,password_hash,role,title,active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,1)
     ON CONFLICT(email) DO NOTHING`,
    ['Gabe', 'Clark', 'gabeforrestclark@gmail.com', '218-331-5145', gabeHash, 'employee', 'Field Employee']
  );

  // ── Seed demo employee ──
  const { rows: empCount } = await db.query("SELECT COUNT(*) as c FROM employees WHERE role='employee'");
  if (parseInt(empCount[0].c) === 0) {
    const hash = bcrypt.hashSync('employee123', 10);
    await db.query(
      "INSERT INTO employees (first_name,last_name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5,$6)",
      ['John', 'Worker', 'john@snowbros.com', '555-0101', hash, 'employee']
    );
  }

  // ── Ensure Junk Removal / Construction Clean-Up service exists ──
  await db.query(
    `INSERT INTO services (name, description, price)
     SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = $1)`,
    ['Junk Removal / Construction Clean-Up', 'Haul-away of junk, debris, and construction waste. Residential and commercial clean-outs.', 150]
  );

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
