const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'lawncare.db');

function initDB() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Services
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      price REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Clients
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Bookings
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      service_id INTEGER,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      client_name TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);

  // Employees
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Time records (with job site fields)
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      duration_minutes REAL DEFAULT 0,
      job_address TEXT DEFAULT '',
      job_contact TEXT DEFAULT '',
      scope_of_work TEXT DEFAULT '',
      job_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // Migrate time_records columns if missing
  const trCols = db.prepare('PRAGMA table_info(time_records)').all().map(c => c.name);
  const trMigrations = [
    ['job_address',   "ALTER TABLE time_records ADD COLUMN job_address TEXT DEFAULT ''"],
    ['job_contact',   "ALTER TABLE time_records ADD COLUMN job_contact TEXT DEFAULT ''"],
    ['scope_of_work', "ALTER TABLE time_records ADD COLUMN scope_of_work TEXT DEFAULT ''"],
    ['job_notes',     "ALTER TABLE time_records ADD COLUMN job_notes TEXT DEFAULT ''"],
  ];
  for (const [col, sql] of trMigrations) {
    if (!trCols.includes(col)) db.exec(sql);
  }

  // GPS locations
  db.exec(`
    CREATE TABLE IF NOT EXISTS gps_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // Invoices
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Invoice line items
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);

  // Email log
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      recipients_count INTEGER DEFAULT 0,
      sent_by INTEGER,
      sent_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Contracts (uploaded by admin, assigned to a client)
  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      client_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      signed_at TEXT,
      signature_data TEXT,
      signature_type TEXT DEFAULT '',
      signer_name TEXT DEFAULT '',
      signed_file_path TEXT DEFAULT '',
      uploaded_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (uploaded_by) REFERENCES employees(id)
    )
  `);

  // Estimates
  db.exec(`
    CREATE TABLE IF NOT EXISTS estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Estimate line items
  db.exec(`
    CREATE TABLE IF NOT EXISTS estimate_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estimate_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
    )
  `);

  // Gallery photos (admin-uploaded, publicly visible)
  db.exec(`
    CREATE TABLE IF NOT EXISTS gallery_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      description TEXT DEFAULT '',
      uploaded_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Job photos (employee-uploaded per time record)
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time_record_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (time_record_id) REFERENCES time_records(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // Reviews / Ratings
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      client_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Referrals
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_client_id INTEGER NOT NULL,
      referral_code TEXT UNIQUE NOT NULL,
      referred_email TEXT DEFAULT '',
      referred_client_id INTEGER,
      status TEXT DEFAULT 'pending',
      discount_amount REAL DEFAULT 10,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (referrer_client_id) REFERENCES clients(id)
    )
  `);

  // Recurring services
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'weekly',
      preferred_day TEXT DEFAULT 'Monday',
      preferred_time TEXT DEFAULT '09:00',
      start_date TEXT NOT NULL,
      end_date TEXT DEFAULT '',
      next_date TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);

  // Notifications (in-app for employees)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'job_assigned',
      read INTEGER DEFAULT 0,
      related_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // Before/After photos (per time record)
  db.exec(`
    CREATE TABLE IF NOT EXISTS before_after_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time_record_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      photo_type TEXT NOT NULL CHECK(photo_type IN ('before','after')),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (time_record_id) REFERENCES time_records(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // Migrate bookings: add assigned_employee_id, completed_at, reminder_sent
  const bkCols = db.prepare('PRAGMA table_info(bookings)').all().map(c => c.name);
  if (!bkCols.includes('assigned_employee_id')) db.exec("ALTER TABLE bookings ADD COLUMN assigned_employee_id INTEGER DEFAULT NULL");
  if (!bkCols.includes('completed_at')) db.exec("ALTER TABLE bookings ADD COLUMN completed_at TEXT DEFAULT ''");
  if (!bkCols.includes('reminder_sent')) db.exec("ALTER TABLE bookings ADD COLUMN reminder_sent INTEGER DEFAULT 0");
  if (!bkCols.includes('followup_sent')) db.exec("ALTER TABLE bookings ADD COLUMN followup_sent INTEGER DEFAULT 0");
  if (!bkCols.includes('recurring_id')) db.exec("ALTER TABLE bookings ADD COLUMN recurring_id INTEGER DEFAULT NULL");

  // App settings (key-value store for admin-configurable options)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      label TEXT DEFAULT '',
      description TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seed default settings
  const settingsSeed = [
    ['first_time_discount_enabled', '1',    'First-Time Discount Enabled',  'Show a discount offer to new customers on registration and booking'],
    ['first_time_discount_type',    'fixed', 'Discount Type',                'fixed = dollar amount, percent = percentage off'],
    ['first_time_discount_amount',  '10',   'Discount Amount',              'Dollar amount or percentage value (e.g. 10 = $10 off or 10%)'],
    ['first_time_discount_message', 'Welcome to Snow Bro\'s! Get $10 off your first service when you book today.', 'Promo Message', 'Message shown to new customers'],
    ['first_time_discount_code',    'NEWCUSTOMER10', 'Discount Code',       'Code customers can mention when booking'],
  ];
  const upsertSetting = db.prepare(`INSERT INTO app_settings (key, value, label, description) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO NOTHING`);
  for (const [key, value, label, description] of settingsSeed) {
    upsertSetting.run(key, value, label, description);
  }

  // Migrate clients: add referral_code
  const clCols = db.prepare('PRAGMA table_info(clients)').all().map(c => c.name);
  if (!clCols.includes('referral_code')) db.exec("ALTER TABLE clients ADD COLUMN referral_code TEXT DEFAULT ''");
  if (!clCols.includes('referred_by')) db.exec("ALTER TABLE clients ADD COLUMN referred_by TEXT DEFAULT ''");
  if (!clCols.includes('referral_credits')) db.exec("ALTER TABLE clients ADD COLUMN referral_credits REAL DEFAULT 0");

  // Seed default services
  if (db.prepare('SELECT COUNT(*) as c FROM services').get().c === 0) {
    const ins = db.prepare('INSERT INTO services (name, description, price) VALUES (?, ?, ?)');
    [
      ['Grass Mowing',    'Professional lawn mowing service',          45],
      ['Tree Trimming',   'Expert tree and shrub trimming',            85],
      ['Dethatching',     'Remove thatch buildup for healthier lawns', 120],
      ['Aeration',        'Core aeration for improved soil health',    95],
      ['Snow Removal',    'Residential snow removal service',          75],
      ['Gutter Cleaning', 'Complete gutter cleaning and inspection',   110],
    ].forEach(s => ins.run(...s));
  }

  // Migrate employees: add title column if missing
  const empCols = db.prepare('PRAGMA table_info(employees)').all().map(c => c.name);
  if (!empCols.includes('title')) db.exec("ALTER TABLE employees ADD COLUMN title TEXT DEFAULT ''");

  // Seed admin
  if (db.prepare("SELECT COUNT(*) as c FROM employees WHERE role='admin'").get().c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO employees (first_name,last_name,email,password_hash,role) VALUES (?,?,?,?,?)").run(
      'Admin','User','admin@snowbros.com',hash,'admin'
    );
  }

  // Seed Gabe Clark manager account
  if (db.prepare("SELECT COUNT(*) as c FROM employees WHERE email='gabe@snowbros.com'").get().c === 0) {
    const hash = bcrypt.hashSync('manager123', 10);
    db.prepare("INSERT INTO employees (first_name,last_name,email,phone,password_hash,role,title) VALUES (?,?,?,?,?,?,?)").run(
      'Gabe','Clark','gabe@snowbros.com','218-331-5145',hash,'manager','Operations Manager'
    );
  }

  // Seed demo employee
  if (db.prepare("SELECT COUNT(*) as c FROM employees WHERE role='employee'").get().c === 0) {
    const hash = bcrypt.hashSync('employee123', 10);
    db.prepare("INSERT INTO employees (first_name,last_name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?)").run(
      'John','Worker','john@snowbros.com','555-0101',hash,'employee'
    );
  }

  return db;
}

module.exports = { initDB };
