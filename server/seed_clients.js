const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const clients = [
  { first_name: 'Mary', last_name: 'Arnholt', email: 'marnholt@yahoo.com', address: '1016 Bemidji Ave N', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Bahr', email: 'debsbahr@yahoo.com', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Debbie', last_name: 'Bahr', email: 'dbahr@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Brent', last_name: 'Bahr', email: 'brentbahr@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Liz', last_name: 'Becker', email: 'lizbecker@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Angie', last_name: 'Bellefeuille', email: 'abellefeuille@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Connie', last_name: 'Benson', email: 'conniebenson@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Kathy', last_name: 'Biermaier', email: 'kbiermaier@yahoo.com', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Lisa', last_name: 'Clark', email: 'lisaverbout@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Gabe', last_name: 'Clark', email: 'clarkryan977@gmail.com', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Tammy', last_name: 'Daggett', email: 'tammydaggett@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Janice', last_name: 'Fairbanks', email: 'jfairbanks@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Becky', last_name: 'Fairbanks', email: 'beckyfairbanks@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Kris', last_name: 'Frick', email: 'krisfrick@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Gast', email: 'debgast@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Pam', last_name: 'Gullingsrud', email: 'pamgullingsrud@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Kathy', last_name: 'Hagg', email: 'kathyhagg@yahoo.com', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Lori', last_name: 'Hofstad', email: 'lorihofstad@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Houghtaling', email: 'debhoughtaling@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Bonnie', last_name: 'Johnson', email: 'bonniejohnson@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Gina', last_name: 'Johnson', email: 'ginajohnson@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Lois', last_name: 'Lahr', email: 'loislahr@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Marge', last_name: 'Lindgren', email: 'margelindgren@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Diane', last_name: 'Marden', email: 'dianemarden@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Barb', last_name: 'Marden', email: 'barbmarden@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Marlene', last_name: 'Marden', email: 'marlenemarden@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Linda', last_name: 'McCollum', email: 'lindamccollum@yahoo.com', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Char', last_name: 'Melhus', email: 'charmelhus@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Nelson', email: 'debnelson@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Kathy', last_name: 'Ose', email: 'kathyose@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Barb', last_name: 'Overby', email: 'barboverby@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Perkins', email: 'debperkins@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Karen', last_name: 'Peterson', email: 'karenpeterson@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Purcell', email: 'debpurcell@yahoo.com', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Donna', last_name: 'Sathre', email: 'donnasathre@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Kathy', last_name: 'Solheim', email: 'kathysolheim@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Barb', last_name: 'Stenberg', email: 'barbstenberg@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Swanson', email: 'debswanson@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Liz', last_name: 'Thompson', email: 'lizthompson@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Kathy', last_name: 'Verbout', email: 'kathyverbout@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Welle', email: 'debwelle@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Barb', last_name: 'Westrum', email: 'barbwestrum@midco.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Deb', last_name: 'Woodwick', email: 'debwoodwick@paulbunyan.net', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
  { first_name: 'Trevor', last_name: 'Yaggie', email: 'trevoryaggie@yahoo.com', address: '', city: 'Bemidji', state: 'MN', zip: '56601', service_type: 'residential', active: 1 },
];

async function seedClients() {
  let inserted = 0;
  let skipped = 0;
  for (const c of clients) {
    try {
      const { rows } = await pool.query('SELECT id FROM clients WHERE email = $1', [c.email]);
      if (rows.length > 0) {
        skipped++;
        continue;
      }
      await pool.query(
        `INSERT INTO clients (first_name, last_name, email, address, city, state, zip, service_type, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [c.first_name, c.last_name, c.email, c.address, c.city, c.state, c.zip, c.service_type, c.active]
      );
      inserted++;
    } catch (e) {
      console.error(`Error inserting ${c.first_name} ${c.last_name}:`, e.message);
    }
  }
  console.log(`Seeding complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
  console.log(`Total clients in list: ${clients.length}`);
  
  // Verify count
  const { rows } = await pool.query('SELECT COUNT(*) as c FROM clients');
  console.log(`Total clients in database: ${rows[0].c}`);
  
  await pool.end();
}

seedClients().catch(e => { console.error(e); process.exit(1); });
