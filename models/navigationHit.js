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

module.exports = { record, countByReferrer };
