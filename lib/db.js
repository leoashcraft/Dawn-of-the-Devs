const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getOne(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

async function getAll(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

async function initSchema() {
  const schemaPath = path.join(__dirname, '..', 'schema', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
  await runMigrations();
}

async function runMigrations() {
  const migrations = [
    {
      name: '001_add_status_column',
      async up() {
        const { rows } = await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'status'"
        );
        if (rows.length === 0) {
          await pool.query("ALTER TABLE Sites ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'");
        }
      },
    },
  ];

  for (const migration of migrations) {
    const existing = await getOne('SELECT 1 FROM Migrations WHERE name = $1', [migration.name]);
    if (!existing) {
      await migration.up();
      await query('INSERT INTO Migrations (name) VALUES ($1)', [migration.name]);
    }
  }
}

module.exports = { query, getOne, getAll, initSchema, pool };
