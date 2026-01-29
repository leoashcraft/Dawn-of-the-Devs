const Site = require('../models/site');
const config = require('../lib/config');
const { cuteUrl } = require('../utils/urlHelpers');

/**
 * Extract the referring site URL from the Referer header.
 * Matches against active webring members.
 */
function getReferringSite(req) {
  const referer = req.get('referer') || req.get('referrer');
  if (!referer) return null;

  try {
    const refUrl = new URL(referer);
    const refDomain = refUrl.hostname.toLowerCase();

    // Don't match our own domain
    if (config.ALLOWED_DOMAINS.includes(refDomain)) return null;

    // Try to find a matching active site
    const sites = Site.all().filter(s => s.active);
    for (const site of sites) {
      try {
        const siteUrl = new URL(site.url);
        if (siteUrl.hostname.toLowerCase() === refDomain) {
          return site.url;
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * GET /next - Navigate to the next site in the ring.
 * Also handles /:slug/next for legacy compatibility.
 */
function next(req, res) {
  const referrer = getReferringSite(req);

  if (referrer) {
    const nextSite = Site.getNextSite(referrer);
    if (nextSite) {
      return res.redirect(302, nextSite.url);
    }
  }

  // Fallback: random site
  const random = Site.randomActive(referrer);
  if (random) {
    return res.redirect(302, random.url);
  }

  // No active sites at all
  return res.redirect(302, config.BASE_URL);
}

/**
 * GET /previous - Navigate to the previous site in the ring.
 * Also handles /:slug/previous for legacy compatibility.
 */
function previous(req, res) {
  const referrer = getReferringSite(req);

  if (referrer) {
    const prevSite = Site.getPreviousSite(referrer);
    if (prevSite) {
      return res.redirect(302, prevSite.url);
    }
  }

  // Fallback: random site
  const random = Site.randomActive(referrer);
  if (random) {
    return res.redirect(302, random.url);
  }

  return res.redirect(302, config.BASE_URL);
}

/**
 * GET /random - Redirect to a random active site.
 */
function random(req, res) {
  const referrer = getReferringSite(req);
  const site = Site.randomActive(referrer);

  if (site) {
    return res.redirect(302, site.url);
  }

  return res.redirect(302, config.BASE_URL);
}

module.exports = { next, previous, random };
