const db = require('../lib/db');
const config = require('../lib/config');

/**
 * Get the garden journal entry for a URL.
 */
async function journalForUrl(url) {
  return db.getOne('SELECT * FROM GardenJournals WHERE url = $1', [url]);
}

/**
 * Add or update a garden journal entry (upsert).
 */
async function addGardenJournal(url, activeStatus, tier) {
  const waitDays = config.WAIT_TIERS[tier];

  let nextCheck;
  if (waitDays === 'NEVER') {
    nextCheck = '9999-12-31 23:59:59';
  } else {
    const next = new Date();
    next.setDate(next.getDate() + waitDays);
    nextCheck = next.toISOString();
  }

  await db.query(`
    INSERT INTO GardenJournals (url, last_active_status, tier, next_check)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(url) DO UPDATE SET
      last_active_status = EXCLUDED.last_active_status,
      tier = EXCLUDED.tier,
      next_check = EXCLUDED.next_check
  `, [url, activeStatus, tier, nextCheck]);
}

/**
 * Get all sites that are due for a check (next_check <= now).
 */
async function sitesDue() {
  return db.getAll(
    'SELECT gj.*, s.active FROM GardenJournals gj JOIN Sites s ON gj.url = s.url WHERE gj.next_check <= NOW() ORDER BY gj.next_check ASC'
  );
}

module.exports = {
  journalForUrl,
  addGardenJournal,
  sitesDue,
};
