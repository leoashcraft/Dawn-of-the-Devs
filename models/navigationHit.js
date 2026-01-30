const db = require('../lib/db');

async function record(referrerUrl, targetUrl, linkType) {
  await db.query(
    'INSERT INTO NavigationHits (referrer_url, target_url, link_type) VALUES ($1, $2, $3)',
    [referrerUrl, targetUrl, linkType]
  );
}

async function countByReferrer() {
  const rows = await db.getAll(`
    SELECT referrer_url,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE link_type = 'previous') AS previous,
      COUNT(*) FILTER (WHERE link_type = 'next') AS next,
      COUNT(*) FILTER (WHERE link_type = 'random') AS random,
      COUNT(*) FILTER (WHERE link_type = 'home') AS home
    FROM NavigationHits
    GROUP BY referrer_url
    ORDER BY total DESC
  `);
  return rows.map(r => ({
    referrer_url: r.referrer_url,
    total: parseInt(r.total, 10),
    previous: parseInt(r.previous, 10),
    next: parseInt(r.next, 10),
    random: parseInt(r.random, 10),
    home: parseInt(r.home, 10),
  }));
}

async function countForSite(siteUrl) {
  const row = await db.getOne(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE link_type = 'previous') AS previous,
      COUNT(*) FILTER (WHERE link_type = 'next') AS next,
      COUNT(*) FILTER (WHERE link_type = 'random') AS random,
      COUNT(*) FILTER (WHERE link_type = 'home') AS home
    FROM NavigationHits
    WHERE referrer_url = $1
  `, [siteUrl]);
  if (!row) return { total: 0, previous: 0, next: 0, random: 0, home: 0 };
  return {
    total: parseInt(row.total, 10),
    previous: parseInt(row.previous, 10),
    next: parseInt(row.next, 10),
    random: parseInt(row.random, 10),
    home: parseInt(row.home, 10),
  };
}

module.exports = { record, countByReferrer, countForSite };
