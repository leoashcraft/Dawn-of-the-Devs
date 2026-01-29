const db = require('../lib/db');

/**
 * Get recent site checks for a URL with error categorization.
 */
async function getSiteChecks(url, limit = 10) {
  const checks = await db.getAll(
    'SELECT * FROM SiteChecks WHERE url = $1 ORDER BY datetime DESC LIMIT $2',
    [url, limit]
  );

  return checks.map(check => {
    const errors = JSON.parse(check.result);
    return {
      ...check,
      errors,
      hasCritical: errors.some(e => e.severity === 'critical'),
      hasWarnings: errors.some(e => e.severity === 'warning'),
    };
  });
}

/**
 * Add a site check result.
 * @param {string} url - The site URL
 * @param {Array} errors - Array of {message, severity} objects
 */
async function addSiteCheck(url, errors) {
  await db.query(
    'INSERT INTO SiteChecks (url, result) VALUES ($1, $2)',
    [url, JSON.stringify(errors)]
  );
}

module.exports = {
  getSiteChecks,
  addSiteCheck,
};
