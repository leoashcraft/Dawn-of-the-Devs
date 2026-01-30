const Site = require('../models/site');
const NavigationHit = require('../models/navigationHit');
const { cuteUrl } = require('../utils/urlHelpers');
const { timeAgo } = require('../utils/timeAgo');
const logger = require('../lib/logger');

// Default webring configuration - this would normally come from database
const DEFAULT_CONFIG = {
  homeText: 'Dawn of the Devs Webring',
  homeLabel: 'Dawn of the Devs Webring Homepage',
  homeTitle: 'Dawn of the Devs Webring Homepage',
  previousLabel: 'Previous Dawn of the Devs Webring site',
  previousTitle: 'Previous Dawn of the Devs Webring site',
  nextLabel: 'Next Dawn of the Devs Webring site',
  nextTitle: 'Next Dawn of the Devs Webring site',
  randomLabel: 'Random Dawn of the Devs Webring site',
  randomTitle: 'Random Dawn of the Devs Webring site',
};

/**
 * GET /admin - Admin dashboard with site moderation.
 */
async function dashboard(req, res) {
  const filter = req.query.filter || null;
  const sites = await Site.allWithStatus(filter);
  const counts = await Site.countByStatus();
  const hitRows = await NavigationHit.countByReferrer();

  const hitsMap = {};
  for (const row of hitRows) {
    hitsMap[row.referrer_url] = row;
  }

  const defaultHits = { total: 0, previous: 0, next: 0, random: 0, home: 0 };

  const sitesDisplay = sites.map(s => ({
    ...s,
    cuteUrl: cuteUrl(s.url),
    timeAgo: timeAgo(s.timestamp),
    hits: hitsMap[s.url] || { ...defaultHits },
  }));

  // TODO: Load from database when ready
  const webringConfig = { ...DEFAULT_CONFIG };

  res.render('admin/dashboard', {
    title: 'Admin - Dawn of the Devs',
    sites: sitesDisplay,
    counts,
    currentFilter: filter,
    webringConfig,
  });
}

/**
 * POST /admin/status - Update a site's moderation status.
 */
async function updateStatus(req, res) {
  const { url, status } = req.body;

  if (!url || !Site.VALID_STATUSES.includes(status)) {
    req.session.flash = { type: 'error', message: 'Invalid request.' };
    return res.redirect('/admin');
  }

  await Site.setStatus(url, status);
  logger.info('Admin status change', {
    admin: req.session.user.url,
    site: url,
    status,
  });

  req.session.flash = { type: 'success', message: `Site status updated to ${status}.` };
  return res.redirect('/admin');
}

/**
 * POST /admin/config - Update webring configuration.
 */
async function updateConfig(req, res) {
  const {
    homeText, homeLabel, homeTitle,
    previousLabel, previousTitle,
    nextLabel, nextTitle,
    randomLabel, randomTitle
  } = req.body;

  // Validate required fields
  if (!homeText || !homeLabel || !homeTitle) {
    req.session.flash = { type: 'error', message: 'Home link fields are required.' };
    return res.redirect('/admin');
  }

  // TODO: Save to database when ready
  // For now, just log the configuration changes
  const config = {
    homeText, homeLabel, homeTitle,
    previousLabel, previousTitle,
    nextLabel, nextTitle,
    randomLabel, randomTitle
  };

  logger.info('Admin config change', {
    admin: req.session.user.url,
    config
  });

  req.session.flash = { type: 'success', message: 'Configuration saved successfully!' };
  return res.redirect('/admin');
}

module.exports = { dashboard, updateStatus, updateConfig };
