CREATE TABLE IF NOT EXISTS Sites (
  url TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  profile TEXT,
  sorting REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved'
);

CREATE TABLE IF NOT EXISTS SiteChecks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  datetime TEXT NOT NULL DEFAULT (datetime('now')),
  result TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (url) REFERENCES Sites(url)
);

CREATE INDEX IF NOT EXISTS idx_sitechecks_url ON SiteChecks(url);
CREATE INDEX IF NOT EXISTS idx_sitechecks_datetime ON SiteChecks(datetime);

CREATE TABLE IF NOT EXISTS GardenJournals (
  url TEXT PRIMARY KEY,
  last_active_status INTEGER NOT NULL DEFAULT 0,
  tier INTEGER NOT NULL DEFAULT 0,
  next_check TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (url) REFERENCES Sites(url)
);

CREATE TABLE IF NOT EXISTS Migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
