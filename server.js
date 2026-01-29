const path = require('path');
const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const Database = require('better-sqlite3');
const fs = require('fs');
const { csrfSync } = require('csrf-sync');

const config = require('./lib/config');
const { commonLocals, requireAuth } = require('./lib/middleware');

// Controllers
const pages = require('./controllers/pages');
const authController = require('./controllers/auth');
const dashboard = require('./controllers/dashboard');
const navigation = require('./controllers/navigation');

const app = express();

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
app.post('/auth/login', csrfSynchronisedProtection, authController.loginStart);
app.get('/auth/callback', authController.callback);
app.post('/auth/logout', csrfSynchronisedProtection, requireAuth, authController.logout);

// --- Dashboard routes (auth required) ---
app.get('/dashboard', requireAuth, dashboard.show);
app.post('/check-links', csrfSynchronisedProtection, requireAuth, dashboard.checkLinks);
app.post('/check-profile', csrfSynchronisedProtection, requireAuth, dashboard.checkProfile);
app.post('/remove-profile', csrfSynchronisedProtection, requireAuth, dashboard.removeProfile);

// Start server
app.listen(config.PORT, () => {
  console.log(`Dawn of the Devs running at ${config.BASE_URL}`);
});
