const { getDb } = require('../lib/db');

const VALID_STATUSES = ['pending', 'approved', 'denied', 'banned'];

/**
 * Get a site by URL. Auto-creates if it doesn't exist (with pending status).
 */
function getSite(url) {
  const db = getDb();
  let site = db.prepare('SELECT * FROM Sites WHERE url = ?').get(url);
  if (!site) {
    db.prepare("INSERT INTO Sites (url, status) VALUES (?, 'pending')").run(url);
    site = db.prepare('SELECT * FROM Sites WHERE url = ?').get(url);
  }
  if (site && site.profile) {
    site.profile = JSON.parse(site.profile);
  }
  return site;
}

/**
 * Get all sites.
 */
function all() {
  const db = getDb();
  const sites = db.prepare('SELECT * FROM Sites ORDER BY sorting ASC, timestamp ASC').all();
  return sites.map(s => {
    if (s.profile) s.profile = JSON.parse(s.profile);
    return s;
  });
}

/**
 * Get all active + approved sites with profiles, sorted by sorting column.
 */
function getActiveSitesWithProfiles() {
  const db = getDb();
  const sites = db.prepare(
    "SELECT * FROM Sites WHERE active = 1 AND status = 'approved' AND profile IS NOT NULL ORDER BY sorting ASC"
  ).all();
  return sites.map(s => {
    if (s.profile) s.profile = JSON.parse(s.profile);
    return s;
  });
}

/**
 * Get a random active + approved site, optionally excluding a URL.
 */
function randomActive(excludeUrl) {
  const db = getDb();
  if (excludeUrl) {
    const site = db.prepare(
      "SELECT * FROM Sites WHERE active = 1 AND status = 'approved' AND url != ? ORDER BY RANDOM() LIMIT 1"
    ).get(excludeUrl);
    if (site && site.profile) site.profile = JSON.parse(site.profile);
    // If no other site, fall back to any active
    if (!site) return randomActive(null);
    return site;
  }
  const site = db.prepare(
    "SELECT * FROM Sites WHERE active = 1 AND status = 'approved' ORDER BY RANDOM() LIMIT 1"
  ).get();
  if (site && site.profile) site.profile = JSON.parse(site.profile);
  return site;
}

/**
 * Get the next active + approved site after the given URL by sort order (wrap around).
 */
function getNextSite(currentUrl) {
  const db = getDb();
  const current = db.prepare("SELECT sorting FROM Sites WHERE url = ? AND active = 1 AND status = 'approved'").get(currentUrl);
  if (!current) return randomActive(currentUrl);

  // Find next site with higher sorting, or wrap to first
  let next = db.prepare(
    "SELECT * FROM Sites WHERE active = 1 AND status = 'approved' AND (sorting > ? OR (sorting = ? AND url > ?)) AND url != ? ORDER BY sorting ASC, url ASC LIMIT 1"
  ).get(current.sorting, current.sorting, currentUrl, currentUrl);

  if (!next) {
    // Wrap around to first active site
    next = db.prepare(
      "SELECT * FROM Sites WHERE active = 1 AND status = 'approved' AND url != ? ORDER BY sorting ASC, url ASC LIMIT 1"
    ).get(currentUrl);
  }

  if (!next) return randomActive(null);
  if (next.profile) next.profile = JSON.parse(next.profile);
  return next;
}

/**
 * Get the previous active + approved site before the given URL by sort order (wrap around).
 */
function getPreviousSite(currentUrl) {
  const db = getDb();
  const current = db.prepare("SELECT sorting FROM Sites WHERE url = ? AND active = 1 AND status = 'approved'").get(currentUrl);
  if (!current) return randomActive(currentUrl);

  let prev = db.prepare(
    "SELECT * FROM Sites WHERE active = 1 AND status = 'approved' AND (sorting < ? OR (sorting = ? AND url < ?)) AND url != ? ORDER BY sorting DESC, url DESC LIMIT 1"
  ).get(current.sorting, current.sorting, currentUrl, currentUrl);

  if (!prev) {
    // Wrap around to last active site
    prev = db.prepare(
      "SELECT * FROM Sites WHERE active = 1 AND status = 'approved' AND url != ? ORDER BY sorting DESC, url DESC LIMIT 1"
    ).get(currentUrl);
  }

  if (!prev) return randomActive(null);
  if (prev.profile) prev.profile = JSON.parse(prev.profile);
  return prev;
}

/**
 * Get all sites that have never been checked.
 */
function unchecked() {
  const db = getDb();
  const sites = db.prepare(
    'SELECT s.* FROM Sites s LEFT JOIN SiteChecks sc ON s.url = sc.url WHERE sc.url IS NULL'
  ).all();
  return sites.map(s => {
    if (s.profile) s.profile = JSON.parse(s.profile);
    return s;
  });
}

/**
 * Set the active status for a site.
 */
function setActive(url, active) {
  const db = getDb();
  db.prepare('UPDATE Sites SET active = ? WHERE url = ?').run(active ? 1 : 0, url);
}

/**
 * Set the profile (h-card) data for a site.
 */
function setProfile(url, profile) {
  const db = getDb();
  const json = profile ? JSON.stringify(profile) : null;
  db.prepare('UPDATE Sites SET profile = ? WHERE url = ?').run(json, url);
}

/**
 * Update sorting value using sin()-based monthly shuffle.
 */
function updateSorting(url) {
  const db = getDb();
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  const now = new Date();
  const monthSeed = now.getFullYear() * 12 + now.getMonth();
  const sorting = Math.sin(hash + monthSeed);
  db.prepare('UPDATE Sites SET sorting = ? WHERE url = ?').run(sorting, url);
}

/**
 * Get all sites, optionally filtered by status.
 */
function allWithStatus(filter) {
  const db = getDb();
  let sites;
  if (filter && VALID_STATUSES.includes(filter)) {
    sites = db.prepare('SELECT * FROM Sites WHERE status = ? ORDER BY timestamp DESC').all(filter);
  } else {
    sites = db.prepare('SELECT * FROM Sites ORDER BY timestamp DESC').all();
  }
  return sites.map(s => {
    if (s.profile) s.profile = JSON.parse(s.profile);
    return s;
  });
}

/**
 * Set the moderation status of a site.
 */
function setStatus(url, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const db = getDb();
  db.prepare('UPDATE Sites SET status = ? WHERE url = ?').run(status, url);
}

/**
 * Count sites grouped by status.
 */
function countByStatus() {
  const db = getDb();
  const rows = db.prepare('SELECT status, COUNT(*) as count FROM Sites GROUP BY status').all();
  const counts = { pending: 0, approved: 0, denied: 0, banned: 0, total: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
    counts.total += row.count;
  }
  return counts;
}

module.exports = {
  getSite,
  all,
  getActiveSitesWithProfiles,
  randomActive,
  getNextSite,
  getPreviousSite,
  unchecked,
  setActive,
  setProfile,
  updateSorting,
  allWithStatus,
  setStatus,
  countByStatus,
  VALID_STATUSES,
};
