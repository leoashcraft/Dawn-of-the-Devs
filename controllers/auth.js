const auth = require('../lib/auth');
const config = require('../lib/config');
const { flashError } = require('../lib/middleware');
const Site = require('../models/site');
const logger = require('../lib/logger');

const INDIELOGIN_ENDPOINT = 'https://indielogin.com/auth';
const REDIRECT_URI = config.BASE_URL + '/auth/callback';
const CLIENT_ID = config.BASE_URL + '/';

/**
 * POST /auth/login - Start the IndieAuth login flow.
 */
async function loginStart(req, res) {
  try {
    const url = auth.normalizeUrl(req.body.url || '');

    // Discover IndieAuth endpoints
    let endpoints;
    try {
      endpoints = await auth.discoverEndpoints(url);
    } catch (err) {
      logger.warn('Endpoint discovery failed', { url, error: err.message });
      flashError(req, 'Could not reach your site. Please check the URL and try again.', err);
      return res.redirect('/');
    }

    // Generate PKCE + state
    const codeVerifier = auth.generateCodeVerifier();
    const codeChallenge = auth.generateCodeChallenge(codeVerifier);
    const state = auth.generateState();

    // Determine which endpoint to use
    let authEndpoint = endpoints.authorizationEndpoint;
    let exchangeEndpoint = endpoints.authorizationEndpoint;
    let useIndieLogin = false;

    if (!authEndpoint) {
      // Fallback to indielogin.com
      authEndpoint = INDIELOGIN_ENDPOINT;
      exchangeEndpoint = INDIELOGIN_ENDPOINT;
      useIndieLogin = true;
    }

    // Store in session for callback
    req.session.authState = {
      state,
      codeVerifier,
      exchangeEndpoint,
      useIndieLogin,
      me: url,
    };

    const authUrl = auth.buildAuthUrl(authEndpoint, {
      me: url,
      redirectUri: REDIRECT_URI,
      state,
      codeChallenge,
      clientId: CLIENT_ID,
    });

    return res.redirect(authUrl);
  } catch (err) {
    logger.error('Login start error', { error: err.message });
    flashError(req, 'An error occurred during login. Please try again.', err);
    return res.redirect('/');
  }
}

/**
 * GET /auth/callback - Handle the IndieAuth callback.
 */
async function callback(req, res) {
  try {
    const { code, state } = req.query;
    const authState = req.session.authState;

    if (!authState || state !== authState.state) {
      req.session.flash = { type: 'error', message: 'Invalid auth state. Please try again.' };
      return res.redirect('/');
    }

    // Exchange code for authenticated "me" URL
    const me = await auth.exchangeCode(authState.exchangeEndpoint, {
      code,
      redirectUri: REDIRECT_URI,
      clientId: CLIENT_ID,
      codeVerifier: authState.codeVerifier,
    });

    // Normalize the returned "me" URL
    const normalizedMe = auth.normalizeUrl(me);

    // Get or create the site
    await Site.getSite(normalizedMe);

    // Set session
    req.session.user = { url: normalizedMe };
    delete req.session.authState;

    logger.info('User signed in', { url: normalizedMe });
    req.session.flash = { type: 'success', message: 'Signed in successfully!' };
    return res.redirect('/dashboard');
  } catch (err) {
    logger.error('Auth callback error', { error: err.message });
    flashError(req, 'Authentication failed. Please try again.', err);
    return res.redirect('/');
  }
}

/**
 * POST /auth/logout - Destroy session and redirect home.
 */
function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/');
  });
}

module.exports = { loginStart, callback, logout };
