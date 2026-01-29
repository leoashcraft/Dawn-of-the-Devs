const Site = require('../models/site');
const { profileFromCard } = require('../utils/profileHelpers');
const { cuteUrl } = require('../utils/urlHelpers');
const { timeAgo } = require('../utils/timeAgo');

/**
 * GET / - Home page with sign-in, recent members, etc.
 */
async function index(req, res) {
  const sites = await Site.all();
  const approvedSites = sites.filter(s => s.status === 'approved');
  const activeSites = approvedSites.filter(s => s.active);
  const recentSites = approvedSites
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10)
    .map(s => ({
      ...s,
      cuteUrl: cuteUrl(s.url),
      timeAgo: timeAgo(s.timestamp),
    }));

  res.render('index', {
    title: 'Dawn of the Devs',
    activeSites,
    recentSites,
    cuteUrl,
  });
}

/**
 * GET /directory - Grid of member profiles.
 */
async function directory(req, res) {
  const sites = await Site.getActiveSitesWithProfiles();
  const profiles = sites.map(s => {
    const profile = s.profile || {};
    const cute = cuteUrl(s.url);
    return {
      url: s.url,
      cuteUrl: cute,
      name: profile.name || cute,
      hasName: !!profile.name,
      jobTitle: profile.jobTitle || null,
      note: profile.note || null,
      photo: profile.photo || null,
    };
  });

  res.render('directory', {
    title: 'Directory - Dawn of the Devs',
    profiles,
  });
}

/**
 * GET /terms - FAQ/Terms of Use.
 */
function terms(req, res) {
  res.render('terms', {
    title: 'Terms - Dawn of the Devs',
  });
}

module.exports = { index, directory, terms };
