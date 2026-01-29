const Site = require('../models/site');
const SiteCheck = require('../models/siteCheck');
const { checkLinks, isActiveFromErrors } = require('../utils/linksCheck');
const { checkProfile } = require('../utils/profileCheck');
const { cuteUrl } = require('../utils/urlHelpers');
const { timeAgo } = require('../utils/timeAgo');
const config = require('../lib/config');
const logger = require('../lib/logger');

/**
 * GET /dashboard - Show the authenticated user's dashboard.
 */
function show(req, res) {
  const siteUrl = req.session.user.url;
  const site = Site.getSite(siteUrl);
  const checks = SiteCheck.getSiteChecks(siteUrl, 10);

  const checksDisplay = checks.map(c => ({
    ...c,
    timeAgo: timeAgo(c.datetime),
  }));

  res.render('dashboard', {
    title: 'Dashboard - Dawn of the Devs',
    site,
    cuteUrl: cuteUrl(siteUrl),
    checks: checksDisplay,
    baseUrl: config.BASE_URL,
  });
}

/**
 * POST /check-links - Check the user's site for webring links.
 */
async function checkLinksAction(req, res) {
  const siteUrl = req.session.user.url;

  try {
    const errors = await checkLinks(siteUrl);
    SiteCheck.addSiteCheck(siteUrl, errors);

    const active = isActiveFromErrors(errors);
    Site.setActive(siteUrl, active);

    logger.info('Link check completed', { url: siteUrl, active, errorCount: errors.length });

    if (errors.length === 0) {
      req.session.flash = { type: 'success', message: 'All links look good! Your site is active in the webring.' };
    } else if (active) {
      req.session.flash = { type: 'warning', message: 'Your site is active, but there are some warnings.' };
    } else {
      req.session.flash = { type: 'error', message: 'Your site is missing required webring links and is currently inactive.' };
    }
  } catch (err) {
    logger.error('Link check error', { url: siteUrl, error: err.message });
    const message = config.IS_PRODUCTION
      ? 'An error occurred while checking links. Please try again.'
      : `Error checking links: ${err.message}`;
    req.session.flash = { type: 'error', message };
  }

  return res.redirect('/dashboard');
}

/**
 * POST /check-profile - Fetch and update the user's h-card profile.
 */
async function checkProfileAction(req, res) {
  const siteUrl = req.session.user.url;

  try {
    const profile = await checkProfile(siteUrl);
    Site.setProfile(siteUrl, profile);

    if (profile) {
      req.session.flash = { type: 'success', message: 'Profile updated from your h-card!' };
    } else {
      req.session.flash = { type: 'warning', message: 'No h-card found on your site. Add one to appear in the directory with your name and photo.' };
    }
  } catch (err) {
    logger.error('Profile check error', { url: siteUrl, error: err.message });
    const message = config.IS_PRODUCTION
      ? 'An error occurred while checking your profile. Please try again.'
      : `Error checking profile: ${err.message}`;
    req.session.flash = { type: 'error', message };
  }

  return res.redirect('/dashboard');
}

/**
 * POST /remove-profile - Remove the user's profile from the directory.
 */
function removeProfile(req, res) {
  const siteUrl = req.session.user.url;
  Site.setProfile(siteUrl, null);
  req.session.flash = { type: 'success', message: 'Profile removed from the directory.' };
  return res.redirect('/dashboard');
}

module.exports = { show, checkLinks: checkLinksAction, checkProfile: checkProfileAction, removeProfile };
