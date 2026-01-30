const Site = require('../models/site');
const NavigationHit = require('../models/navigationHit');
const { cuteUrl } = require('../utils/urlHelpers');
const { timeAgo } = require('../utils/timeAgo');
const logger = require('../lib/logger');

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

  res.render('admin/dashboard', {
    title: 'Admin - Dawn of the Devs',
    sites: sitesDisplay,
    counts,
    currentFilter: filter,
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

module.exports = { dashboard, updateStatus };
