CREATE TABLE IF NOT EXISTS Sites (
  url TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  profile TEXT,
  sorting REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved'
);

CREATE TABLE IF NOT EXISTS SiteChecks (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL REFERENCES Sites(url),
  datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_sitechecks_url ON SiteChecks(url);
CREATE INDEX IF NOT EXISTS idx_sitechecks_datetime ON SiteChecks(datetime);

CREATE TABLE IF NOT EXISTS GardenJournals (
  url TEXT PRIMARY KEY REFERENCES Sites(url),
  last_active_status BOOLEAN NOT NULL DEFAULT false,
  tier INTEGER NOT NULL DEFAULT 0,
  next_check TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS NavigationHits (
  id SERIAL PRIMARY KEY,
  referrer_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_navigationhits_referrer ON NavigationHits(referrer_url);
CREATE INDEX IF NOT EXISTS idx_navigationhits_created ON NavigationHits(created_at);
CREATE INDEX IF NOT EXISTS idx_navigationhits_link_type ON NavigationHits(link_type);

CREATE TABLE IF NOT EXISTS Migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
