const db = require('../lib/db');

const VALID_STATUSES = ['pending', 'approved', 'denied', 'banned'];
const ACTIVE_APPROVED = "active = true AND status = 'approved'";

/**
 * Parse the JSON profile column on a site row.
 */
function parseSite(site) {
  if (site && site.profile) site.profile = JSON.parse(site.profile);
  return site;
}

function parseSites(sites) {
  return sites.map(parseSite);
}

/**
 * Get a site by URL. Auto-creates if it doesn't exist (with pending status).
 */
async function getSite(url) {
  let site = await db.getOne('SELECT * FROM Sites WHERE url = $1', [url]);
  if (!site) {
    await db.query("INSERT INTO Sites (url, status) VALUES ($1, 'pending')", [url]);
    site = await db.getOne('SELECT * FROM Sites WHERE url = $1', [url]);
  }
  return parseSite(site);
}

/**
 * Get all sites.
 */
async function all() {
  const sites = await db.getAll('SELECT * FROM Sites ORDER BY sorting ASC, timestamp ASC');
  return parseSites(sites);
}

/**
 * Get all active + approved sites with profiles, sorted by sorting column.
 */
async function getActiveSitesWithProfiles() {
  const sites = await db.getAll(
    `SELECT * FROM Sites WHERE ${ACTIVE_APPROVED} ORDER BY sorting ASC`
  );
  return parseSites(sites);
}

/**
 * Get a random active + approved site, optionally excluding a URL.
 */
async function randomActive(excludeUrl) {
  if (excludeUrl) {
    const site = parseSite(await db.getOne(
      `SELECT * FROM Sites WHERE ${ACTIVE_APPROVED} AND url != $1 ORDER BY RANDOM() LIMIT 1`,
      [excludeUrl]
    ));
    if (!site) return randomActive(null);
    return site;
  }
  return parseSite(await db.getOne(
    `SELECT * FROM Sites WHERE ${ACTIVE_APPROVED} ORDER BY RANDOM() LIMIT 1`
  ));
}

/**
 * Get the next active + approved site after the given URL by sort order (wrap around).
 */
async function getNextSite(currentUrl) {
  const current = await db.getOne(
    `SELECT sorting FROM Sites WHERE url = $1 AND ${ACTIVE_APPROVED}`,
    [currentUrl]
  );
  if (!current) return randomActive(currentUrl);

  let next = await db.getOne(
    `SELECT * FROM Sites WHERE ${ACTIVE_APPROVED} AND (sorting > $1 OR (sorting = $2 AND url > $3)) AND url != $4 ORDER BY sorting ASC, url ASC LIMIT 1`,
    [current.sorting, current.sorting, currentUrl, currentUrl]
  );

  if (!next) {
    next = await db.getOne(
      `SELECT * FROM Sites WHERE ${ACTIVE_APPROVED} AND url != $1 ORDER BY sorting ASC, url ASC LIMIT 1`,
      [currentUrl]
    );
  }

  if (!next) return randomActive(null);
  return parseSite(next);
}

/**
 * Get the previous active + approved site before the given URL by sort order (wrap around).
 */
async function getPreviousSite(currentUrl) {
  const current = await db.getOne(
    `SELECT sorting FROM Sites WHERE url = $1 AND ${ACTIVE_APPROVED}`,
    [currentUrl]
  );
  if (!current) return randomActive(currentUrl);

  let prev = await db.getOne(
    `SELECT * FROM Sites WHERE ${ACTIVE_APPROVED} AND (sorting < $1 OR (sorting = $2 AND url < $3)) AND url != $4 ORDER BY sorting DESC, url DESC LIMIT 1`,
    [current.sorting, current.sorting, currentUrl, currentUrl]
  );

  if (!prev) {
    prev = await db.getOne(
      `SELECT * FROM Sites WHERE ${ACTIVE_APPROVED} AND url != $1 ORDER BY sorting DESC, url DESC LIMIT 1`,
      [currentUrl]
    );
  }

  if (!prev) return randomActive(null);
  return parseSite(prev);
}

/**
 * Get all sites that have never been checked.
 */
async function unchecked() {
  const sites = await db.getAll(
    'SELECT s.* FROM Sites s LEFT JOIN SiteChecks sc ON s.url = sc.url WHERE sc.url IS NULL'
  );
  return parseSites(sites);
}

/**
 * Set the active status for a site.
 */
async function setActive(url, active) {
  await db.query('UPDATE Sites SET active = $1 WHERE url = $2', [active, url]);
}

/**
 * Set the profile (h-card) data for a site.
 */
async function setProfile(url, profile) {
  const json = profile ? JSON.stringify(profile) : null;
  await db.query('UPDATE Sites SET profile = $1 WHERE url = $2', [json, url]);
}

/**
 * Update sorting value using sin()-based monthly shuffle.
 */
async function updateSorting(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  const now = new Date();
  const monthSeed = now.getFullYear() * 12 + now.getMonth();
  const sorting = Math.sin(hash + monthSeed);
  await db.query('UPDATE Sites SET sorting = $1 WHERE url = $2', [sorting, url]);
}

/**
 * Get all sites, optionally filtered by status.
 */
async function allWithStatus(filter) {
  let sites;
  if (filter && VALID_STATUSES.includes(filter)) {
    sites = await db.getAll('SELECT * FROM Sites WHERE status = $1 ORDER BY timestamp DESC', [filter]);
  } else {
    sites = await db.getAll('SELECT * FROM Sites ORDER BY timestamp DESC');
  }
  return parseSites(sites);
}

/**
 * Set the moderation status of a site.
 */
async function setStatus(url, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  await db.query('UPDATE Sites SET status = $1 WHERE url = $2', [status, url]);
}

/**
 * Count sites grouped by status.
 */
async function countByStatus() {
  const rows = await db.getAll('SELECT status, COUNT(*) as count FROM Sites GROUP BY status');
  const counts = { pending: 0, approved: 0, denied: 0, banned: 0, total: 0 };
  for (const row of rows) {
    counts[row.status] = parseInt(row.count, 10);
    counts.total += parseInt(row.count, 10);
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
