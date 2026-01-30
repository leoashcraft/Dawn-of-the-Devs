const Site = require('../models/site');
const NavigationHit = require('../models/navigationHit');
const config = require('../lib/config');
const logger = require('../lib/logger');

/**
 * Extract the referring site URL from the Referer header.
 * Matches against active webring members.
 */
async function getReferringSite(req) {
  const referer = req.get('referer') || req.get('referrer');
  if (!referer) return null;

  try {
    const refUrl = new URL(referer);
    const refDomain = refUrl.hostname.toLowerCase();

    // Don't match our own domain
    if (config.ALLOWED_DOMAINS.includes(refDomain)) return null;

    // Try to find a matching active + approved site
    const sites = await Site.getActiveSitesWithProfiles();
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
 * Navigate the ring in a given direction.
 * Falls back to random, then home.
 * Logs a navigation hit (fire-and-forget) when referrer is known.
 */
async function navigate(req, res, directionFn, linkType) {
  const referrer = await getReferringSite(req);

  if (referrer) {
    const site = await directionFn(referrer);
    if (site) {
      NavigationHit.record(referrer, site.url, linkType).catch(err =>
        logger.error('Failed to record navigation hit', { error: err.message })
      );
      return res.redirect(302, site.url);
    }
  }

  const random = await Site.randomActive(referrer);
  if (random) {
    if (referrer) {
      NavigationHit.record(referrer, random.url, linkType).catch(err =>
        logger.error('Failed to record navigation hit', { error: err.message })
      );
    }
    return res.redirect(302, random.url);
  }

  if (referrer) {
    NavigationHit.record(referrer, config.BASE_URL, linkType).catch(err =>
      logger.error('Failed to record navigation hit', { error: err.message })
    );
  }
  return res.redirect(302, config.BASE_URL);
}

/**
 * GET /next - Navigate to the next site in the ring.
 * Also handles /:slug/next for legacy compatibility.
 */
async function next(req, res) {
  return navigate(req, res, Site.getNextSite, 'next');
}

/**
 * GET /previous - Navigate to the previous site in the ring.
 * Also handles /:slug/previous for legacy compatibility.
 */
async function previous(req, res) {
  return navigate(req, res, Site.getPreviousSite, 'previous');
}

/**
 * GET /random - Redirect to a random active site.
 */
async function random(req, res) {
  return navigate(req, res, () => null, 'random');
}

/**
 * GET /home - Log a home navigation hit, then redirect to the homepage.
 */
async function home(req, res) {
  const referrer = await getReferringSite(req);
  if (referrer) {
    NavigationHit.record(referrer, config.BASE_URL, 'home').catch(err =>
      logger.error('Failed to record navigation hit', { error: err.message })
    );
  }
  return res.redirect(302, config.BASE_URL);
}

module.exports = { next, previous, random, home };
