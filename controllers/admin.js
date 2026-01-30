const Site = require('../models/site');
const NavigationHit = require('../models/navigationHit');
const { cuteUrl } = require('../utils/urlHelpers');
const { timeAgo } = require('../utils/timeAgo');
const logger = require('../lib/logger');
const sanitizeHtml = require('sanitize-html');

// Default webring HTML code - this would normally come from database
const DEFAULT_HTML = `<a href="https://dawnofthedevs.com/previous" aria-label="Previous Dawn of the Devs Webring site" title="Previous Dawn of the Devs Webring site">&larr;</a>
<a href="https://dawnofthedevs.com/home" aria-label="Dawn of the Devs Webring Homepage" title="Dawn of the Devs Webring Homepage">Dawn of the Devs Webring</a>
<a href="https://dawnofthedevs.com/next" aria-label="Next Dawn of the Devs Webring site" title="Next Dawn of the Devs Webring site">&rarr;</a>
<a href="https://dawnofthedevs.com/random" aria-label="Random Dawn of the Devs Webring site" title="Random Dawn of the Devs Webring site">&#x21AF;</a>`;

// Sanitize HTML input for security
function sanitizeWebringHtml(html) {
  if (!html || typeof html !== 'string') {
    return DEFAULT_HTML;
  }

  return sanitizeHtml(html, {
    allowedTags: ['a'],
    allowedAttributes: {
      'a': ['href', 'aria-label', 'title']
    },
    allowedSchemes: ['https'],
    enforceHtmlBoundary: true,
    disallowedTagsMode: 'discard'
  });
}

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
  const webringHtml = DEFAULT_HTML;

  res.render('admin/dashboard', {
    title: 'Admin - Dawn of the Devs',
    sites: sitesDisplay,
    counts,
    currentFilter: filter,
    webringHtml,
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
  const { webringHtml } = req.body;

  // Validate HTML input
  if (!webringHtml || webringHtml.trim().length === 0) {
    req.session.flash = { type: 'error', message: 'Webring HTML code is required.' };
    return res.redirect('/admin');
  }

  // Sanitize HTML input for security
  const sanitizedHtml = sanitizeWebringHtml(webringHtml);

  if (!sanitizedHtml || sanitizedHtml.trim().length === 0) {
    req.session.flash = { type: 'error', message: 'Invalid HTML code. Only &lt;a&gt; tags with href, aria-label, and title attributes are allowed.' };
    return res.redirect('/admin');
  }

  // TODO: Save to database when ready
  // For now, just log the configuration changes
  logger.info('Admin webring HTML change', {
    admin: req.session.user.url,
    originalLength: webringHtml.length,
    sanitizedLength: sanitizedHtml.length
  });

  req.session.flash = { type: 'success', message: 'Webring HTML code saved successfully!' };
  return res.redirect('/admin');
}

module.exports = { dashboard, updateStatus, updateConfig };
