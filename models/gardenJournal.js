const { getDb } = require('../lib/db');
const config = require('../lib/config');

/**
 * Get the garden journal entry for a URL.
 */
function journalForUrl(url) {
  const db = getDb();
  return db.prepare('SELECT * FROM GardenJournals WHERE url = ?').get(url);
}

/**
 * Add or update a garden journal entry (upsert).
 */
function addGardenJournal(url, activeStatus, tier) {
  const db = getDb();
  const waitDays = config.WAIT_TIERS[tier];

  let nextCheck;
  if (waitDays === 'NEVER') {
    // Set far-future date
    nextCheck = '9999-12-31 23:59:59';
  } else {
    const next = new Date();
    next.setDate(next.getDate() + waitDays);
    nextCheck = next.toISOString().replace('T', ' ').slice(0, 19);
  }

  db.prepare(`
    INSERT INTO GardenJournals (url, last_active_status, tier, next_check)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      last_active_status = excluded.last_active_status,
      tier = excluded.tier,
      next_check = excluded.next_check
  `).run(url, activeStatus ? 1 : 0, tier, nextCheck);
}

/**
 * Get all sites that are due for a check (next_check <= now).
 */
function sitesDue() {
  const db = getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return db.prepare(
    'SELECT gj.*, s.active FROM GardenJournals gj JOIN Sites s ON gj.url = s.url WHERE gj.next_check <= ? ORDER BY gj.next_check ASC'
  ).all(now);
}

module.exports = {
  journalForUrl,
  addGardenJournal,
  sitesDue,
};
