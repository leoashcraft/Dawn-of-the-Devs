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

  return _db;
}

module.exports = { getDb };
