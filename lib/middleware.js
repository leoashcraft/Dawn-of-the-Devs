const config = require('./config');

/**
 * Inject common locals into all templates.
 */
function commonLocals(req, res, next) {
  res.locals.hostname = config.HOSTNAME;
  res.locals.baseUrl = config.BASE_URL;
  res.locals.user = req.session && req.session.user ? req.session.user : null;
  res.locals.flash = req.session && req.session.flash ? req.session.flash : null;
  // Clear flash after reading
  if (req.session) req.session.flash = null;
  next();
}

/**
 * Require authentication. Redirects to / with flash message if not logged in.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    req.session.flash = { type: 'error', message: 'Please sign in first.' };
    return res.redirect('/');
  }
  next();
}

module.exports = { commonLocals, requireAuth };
