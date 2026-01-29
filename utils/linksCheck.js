const cheerio = require('cheerio');
const config = require('../lib/config');

/**
 * Check a site for webring navigation links.
 * Returns an array of { message, severity } error objects.
 * severity: 'critical' (missing required links) or 'warning' (using legacy format)
 */
async function checkLinks(siteUrl) {
  const errors = [];

  let html;
  try {
    const res = await fetch(siteUrl, {
      headers: { 'User-Agent': config.USER_AGENT },
      redirect: 'follow',
    });
    if (!res.ok) {
      errors.push({ message: `Could not fetch site: HTTP ${res.status}`, severity: 'critical' });
      return errors;
    }
    html = await res.text();
  } catch (err) {
    errors.push({ message: `Could not fetch site: ${err.message}`, severity: 'critical' });
    return errors;
  }

  const $ = cheerio.load(html);
  const links = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const linkUrl = new URL(href, siteUrl);
        const domain = linkUrl.hostname.toLowerCase();
        if (config.ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) {
          links.push({
            href: linkUrl.toString(),
            pathname: linkUrl.pathname,
          });
        }
      } catch { /* ignore invalid URLs */ }
    }
  });

  // Check for /next link
  const hasNext = links.some(l => l.pathname === '/next');
  const hasLegacyNext = links.some(l => /^\/[^/]+\/next$/.test(l.pathname));

  // Check for /previous link
  const hasPrevious = links.some(l => l.pathname === '/previous');
  const hasLegacyPrevious = links.some(l => /^\/[^/]+\/previous$/.test(l.pathname));

  if (!hasNext && !hasLegacyNext) {
    errors.push({ message: 'Missing link to /next', severity: 'critical' });
  } else if (!hasNext && hasLegacyNext) {
    errors.push({ message: 'Using legacy /:slug/next path. Please update to /next', severity: 'warning' });
  }

  if (!hasPrevious && !hasLegacyPrevious) {
    errors.push({ message: 'Missing link to /previous', severity: 'critical' });
  } else if (!hasPrevious && hasLegacyPrevious) {
    errors.push({ message: 'Using legacy /:slug/previous path. Please update to /previous', severity: 'warning' });
  }

  return errors;
}

/**
 * Determine if a site should be active based on check errors.
 * Active = no critical errors.
 */
function isActiveFromErrors(errors) {
  return !errors.some(e => e.severity === 'critical');
}

module.exports = { checkLinks, isActiveFromErrors };
