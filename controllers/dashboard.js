const Site = require('../models/site');
const SiteCheck = require('../models/siteCheck');
const NavigationHit = require('../models/navigationHit');
const { checkLinks, isActiveFromErrors } = require('../utils/linksCheck');
const { checkProfile } = require('../utils/profileCheck');
const { flashError } = require('../lib/middleware');
const { cuteUrl } = require('../utils/urlHelpers');
const { timeAgo } = require('../utils/timeAgo');
const config = require('../lib/config');
const logger = require('../lib/logger');

// Default webring HTML code - this would normally come from database
const DEFAULT_HTML = `<a href="https://dawnofthedevs.com/previous" aria-label="Previous Dawn of the Devs Webring site" title="Previous Dawn of the Devs Webring site">&larr;</a>
<a href="https://dawnofthedevs.com/home" aria-label="Dawn of the Devs Webring Homepage" title="Dawn of the Devs Webring Homepage">Dawn of the Devs Webring</a>
<a href="https://dawnofthedevs.com/next" aria-label="Next Dawn of the Devs Webring site" title="Next Dawn of the Devs Webring site">&rarr;</a>
<a href="https://dawnofthedevs.com/random" aria-label="Random Dawn of the Devs Webring site" title="Random Dawn of the Devs Webring site">&#x21AF;</a>`;

/**
 * GET /dashboard - Show the authenticated user's dashboard.
 */
async function show(req, res) {
  const siteUrl = req.session.user.url;
  const site = await Site.getSite(siteUrl);
  const checks = await SiteCheck.getSiteChecks(siteUrl, 10);
  const hits = await NavigationHit.countForSite(siteUrl);

  const checksDisplay = checks.map(c => ({
    ...c,
    timeAgo: timeAgo(c.datetime),
  }));

  // TODO: Load from database when ready
  const webringHtml = DEFAULT_HTML;

  res.render('dashboard', {
    title: 'Dashboard - Dawn of the Devs',
    site,
    cuteUrl: cuteUrl(siteUrl),
    checks: checksDisplay,
    hits,
    baseUrl: config.BASE_URL,
    webringHtml,
  });
}

/**
 * POST /check-links - Check the user's site for webring links.
 */
async function checkLinksAction(req, res) {
  const siteUrl = req.session.user.url;

  try {
    const errors = await checkLinks(siteUrl);
    await SiteCheck.addSiteCheck(siteUrl, errors);

    const active = isActiveFromErrors(errors);
    await Site.setActive(siteUrl, active);

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
    flashError(req, 'An error occurred while checking links. Please try again.', err);
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
    await Site.setProfile(siteUrl, profile);

    if (profile) {
      req.session.flash = { type: 'success', message: 'Profile updated from your h-card!' };
    } else {
      req.session.flash = { type: 'warning', message: 'No h-card found on your site. Add one to appear in the directory with your name and photo.' };
    }
  } catch (err) {
    logger.error('Profile check error', { url: siteUrl, error: err.message });
    flashError(req, 'An error occurred while checking your profile. Please try again.', err);
  }

  return res.redirect('/dashboard');
}

/**
 * POST /remove-profile - Remove the user's profile from the directory.
 */
async function removeProfile(req, res) {
  const siteUrl = req.session.user.url;
  await Site.setProfile(siteUrl, null);
  req.session.flash = { type: 'success', message: 'Profile removed from the directory.' };
  return res.redirect('/dashboard');
}

module.exports = { show, checkLinks: checkLinksAction, checkProfile: checkProfileAction, removeProfile };
