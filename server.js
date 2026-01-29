const path = require('path');
const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const Database = require('better-sqlite3');
const fs = require('fs');
const { csrfSync } = require('csrf-sync');
const helmet = require('helmet');

const config = require('./lib/config');
const { commonLocals, requireAuth, requireAdmin } = require('./lib/middleware');
const { generalLimiter, authLimiter, actionLimiter } = require('./lib/rateLimiter');
const logger = require('./lib/logger');

// Controllers
const pages = require('./controllers/pages');
const authController = require('./controllers/auth');
const dashboard = require('./controllers/dashboard');
const navigation = require('./controllers/navigation');
const admin = require('./controllers/admin');

const app = express();

// Trust first proxy (for x-forwarded-proto, rate limiting by IP)
if (config.IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https:", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
}));

// HTTPS redirect in production
if (config.IS_PRODUCTION) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: false }));

// Session store (separate SQLite DB)
const dataDir = path.dirname(path.resolve(config.DB_PATH));
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const sessionDb = new Database(path.join(dataDir, 'sessions.sqlite3'));

app.use(session({
  store: new SqliteStore({
    client: sessionDb,
    expired: { clear: true, intervalMs: 900000 },
  }),
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    sameSite: 'lax',
    secure: config.IS_PRODUCTION,
  },
}));

// CSRF protection
const {
  csrfSynchronisedProtection,
  generateToken,
} = csrfSync({
  getTokenFromRequest: (req) => req.body.csrfToken,
  getTokenFromState: (req) => req.session.csrfToken,
  storeTokenInState: (req, token) => { req.session.csrfToken = token; },
  size: 64,
});

// Make CSRF token available in all views
app.use((req, res, next) => {
  // Generate token for every request so it's available in templates
  const token = generateToken(req);
  res.locals.csrfToken = token;
  next();
});

// Common locals
app.use(commonLocals);

// General rate limiter (all routes)
app.use(generalLimiter);

// Request logging
app.use(logger.requestLogger);

// --- Public routes ---
app.get('/', pages.index);
app.get('/directory', pages.directory);
app.get('/terms', pages.terms);

// --- Navigation routes (no auth, no CSRF) ---
app.get('/next', navigation.next);
app.get('/previous', navigation.previous);
app.get('/random', navigation.random);

// Legacy slug-based navigation
app.get('/:slug/next', navigation.next);
app.get('/:slug/previous', navigation.previous);

// --- Auth routes ---
app.post('/auth/login', authLimiter, csrfSynchronisedProtection, authController.loginStart);
app.get('/auth/callback', authLimiter, authController.callback);
app.post('/auth/logout', csrfSynchronisedProtection, requireAuth, authController.logout);

// --- Dashboard routes (auth required) ---
app.get('/dashboard', requireAuth, dashboard.show);
app.post('/check-links', actionLimiter, csrfSynchronisedProtection, requireAuth, dashboard.checkLinks);
app.post('/check-profile', actionLimiter, csrfSynchronisedProtection, requireAuth, dashboard.checkProfile);
app.post('/remove-profile', actionLimiter, csrfSynchronisedProtection, requireAuth, dashboard.removeProfile);

// --- Admin routes ---
app.get('/admin', requireAuth, requireAdmin, admin.dashboard);
app.post('/admin/status', csrfSynchronisedProtection, requireAuth, requireAdmin, admin.updateStatus);

// --- Error handling ---

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Not Found - Dawn of the Devs',
    statusCode: 404,
    message: 'Page not found.',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, url: req.url });
  const message = config.IS_PRODUCTION ? 'Something went wrong.' : err.message;
  res.status(err.status || 500).render('error', {
    title: 'Error - Dawn of the Devs',
    statusCode: err.status || 500,
    message,
  });
});

// Start server
app.listen(config.PORT, () => {
  logger.info('Server started', { url: config.BASE_URL, port: config.PORT });
});
