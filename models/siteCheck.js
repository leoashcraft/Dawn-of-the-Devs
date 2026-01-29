const { getDb } = require('../lib/db');

/**
 * Get recent site checks for a URL with error categorization.
 */
function getSiteChecks(url, limit = 10) {
  const db = getDb();
  const checks = db.prepare(
    'SELECT * FROM SiteChecks WHERE url = ? ORDER BY datetime DESC LIMIT ?'
  ).all(url, limit);

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
function addSiteCheck(url, errors) {
  const db = getDb();
  db.prepare(
    'INSERT INTO SiteChecks (url, result) VALUES (?, ?)'
  ).run(url, JSON.stringify(errors));
}

module.exports = {
  getSiteChecks,
  addSiteCheck,
};
