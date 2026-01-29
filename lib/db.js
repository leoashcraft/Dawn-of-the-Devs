const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

let _db = null;

function getDb() {
  if (_db) return _db;

  const dbPath = path.resolve(config.DB_PATH);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Initialize schema
  const schemaPath = path.join(__dirname, '..', 'schema', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  _db.exec(schema);

  // Run migrations
  runMigrations(_db);

  return _db;
}

function runMigrations(db) {
  const migrations = [
    {
      name: '001_add_status_column',
      up(db) {
        // Check if column already exists
        const cols = db.pragma('table_info(Sites)');
        const hasStatus = cols.some(c => c.name === 'status');
        if (!hasStatus) {
          db.exec("ALTER TABLE Sites ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'");
        }
      },
    },
  ];

  for (const migration of migrations) {
    const applied = db.prepare('SELECT 1 FROM Migrations WHERE name = ?').get(migration.name);
    if (!applied) {
      migration.up(db);
      db.prepare('INSERT INTO Migrations (name) VALUES (?)').run(migration.name);
    }
  }
}

module.exports = { getDb };
