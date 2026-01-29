# Dawn of the Devs

An IndieWeb webring for web developer portfolios. Members connect their personal sites in a ring that visitors can browse through using next/previous navigation links.

**Live:** [dawnofthedevs.com](https://dawnofthedevs.com)

## What is the IndieWeb?

The [IndieWeb](https://indieweb.org/) is a movement built on a simple idea: **you should own the content you create**, rather than handing it over to third-party silos. Instead of relying on social platforms that control your identity and data, the IndieWeb puts you in charge through your own domain name and website.

Dawn of the Devs builds on several IndieWeb principles outlined at [IndieWebify.me](https://indiewebify.me):

### Level 1 - Own Your Identity

Your domain is your identity. When you sign in to Dawn of the Devs, you authenticate with your own domain via [IndieAuth](https://indieauth.net/) rather than a username and password controlled by someone else. This is Web Sign In — connecting your domain to your identity using `rel=me` links.

### Level 2 - Publish on the IndieWeb

Dawn of the Devs reads your site's [microformats2](https://microformats.org/wiki/microformats2) markup to build your directory profile. Specifically:

- **h-card** — Your profile information (name, photo, bio) marked up in HTML so it's both human-readable and machine-parseable. Add an h-card to your site and Dawn of the Devs will pull it into the [member directory](https://dawnofthedevs.com/directory).

### Level 3 - Federate and Connect

Webrings are one of the oldest forms of site-to-site federation on the web. By adding next/previous links to your site, you connect your portfolio to a network of other developers — no algorithms, no feeds controlled by a platform, just direct links between real people's websites.

## Tech Stack

- **Runtime:** Node.js (>=18)
- **Framework:** [Express.js](https://expressjs.com/)
- **Templates:** [EJS](https://ejs.co/)
- **Database:** SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Auth:** [IndieAuth](https://indieauth.spec.indieweb.org/) with PKCE + [indielogin.com](https://indielogin.com/) fallback
- **Sessions:** express-session with SQLite-backed store
- **CSRF Protection:** [csrf-sync](https://github.com/Psifi-Solutions/csrf-sync) (synchronizer token pattern)
- **Security Headers:** [helmet](https://helmetjs.github.io/) with Content Security Policy
- **Rate Limiting:** [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)
- **HTML Parsing:** [cheerio](https://cheerio.js.org/) for link checking, [microformats-parser](https://github.com/microformats/microformats-parser) for h-card discovery
- **Built with:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code) by Anthropic

## How It Works

1. **Join** — Add `previous` and `next` links to your site pointing to `dawnofthedevs.com/previous` and `dawnofthedevs.com/next`.
2. **Sign in** — Authenticate with your domain via IndieAuth on the home page.
3. **Approval** — New sites start with `pending` status. An admin approves your site before it enters the ring.
4. **Activate** — Check your links from the dashboard. If both links are found, your site goes active in the ring.
5. **Profile** — Optionally add an [h-card](https://indieweb.org/h-card) to your site. Dawn of the Devs will parse it and display your name, photo, and bio in the directory.

### Ring Navigation

When a visitor clicks "next" or "previous" on a member's site, the webring reads the `Referer` header to determine which site they came from, then redirects to the next or previous member in sort order. If no referer is available, a random member is chosen. Only approved and active sites participate in ring navigation.

### Automated Gatekeeper

A CLI gatekeeper (`bin/gatekeeper.js`) periodically checks all member sites for the required webring links. It uses a tiered schedule — active sites are re-checked every 30 days, while inactive sites are checked less frequently until they either come back or stop being checked entirely. Banned and denied sites are skipped.

A directory updater (`bin/directory-updater.js`) re-fetches h-card profiles for active members and recalculates sort order monthly.

### Admin Moderation

Admins (configured via `ADMIN_URLS`) can manage site status from the `/admin` dashboard:

- **Pending** — New registrations awaiting review
- **Approved** — Active in the ring and directory
- **Denied** — Rejected from the ring
- **Banned** — Removed from the ring

## Security

### Headers & Transport

- **Content Security Policy** via helmet: `default-src 'self'`, `script-src 'self'`, `img-src 'self' https: data:`, `style-src 'self' 'unsafe-inline'`
- **HTTPS redirect** in production with `trust proxy` for reverse proxy deployments
- **Secure session cookies** in production (`secure`, `httpOnly`, `sameSite: lax`)
- Helmet defaults: `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy`, and more

### SSRF Protection

All outbound HTTP requests use a `safeFetch` wrapper (`utils/safeFetch.js`) that:

- Resolves DNS and blocks private/reserved IP ranges (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, fc/fd, fe80)
- Rejects non-http/https URL schemes
- Enforces a configurable timeout via `AbortController` (default 10s)
- Supports optional content-type validation

### Rate Limiting

Three tiers of rate limiting per IP address:

| Scope | Limit | Routes |
|-------|-------|--------|
| General | 100 req / 15 min | All routes |
| Auth | 10 req / 15 min | `/auth/login`, `/auth/callback` |
| Actions | 20 req / 15 min | `/check-links`, `/check-profile`, `/remove-profile` |

### Input Validation

- URL length enforced at 2048 characters (`normalizeUrl`)
- Photo URLs from h-cards sanitized to allow only http/https schemes
- Sign-in form uses `type="url"` and `maxlength="2048"`
- Admin status values validated against a strict whitelist

### Authentication & CSRF

- IndieAuth with PKCE (S256) for domain-based authentication
- CSRF synchronizer token on all state-changing POST endpoints
- Session-based auth with `requireAuth` and `requireAdmin` middleware
- Production startup guards: server refuses to start without `SESSION_SECRET`, `CSRF_SECRET`, and `ADMIN_URLS`

### Error Handling

- Generic error messages shown to users in production (no stack trace or internal detail leakage)
- Structured JSON logging in production, human-readable in development
- Request logging middleware captures method, URL, status, duration, and IP

### Database

- All SQL queries use parameterized `?` placeholders via better-sqlite3
- Schema migrations tracked in a `Migrations` table
- WAL mode enabled for concurrent read access

## Setup

```bash
git clone https://github.com/leoashcraft/Dawn-of-the-Devs.git
cd Dawn-of-the-Devs
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `BASE_URL` | Public URL of the site |
| `SESSION_SECRET` | Secret for signing session cookies (required in production) |
| `CSRF_SECRET` | Secret for CSRF token generation (required in production) |
| `USER_AGENT` | User-Agent string for outbound requests |
| `DB_PATH` | Path to the SQLite database file |
| `NODE_ENV` | Set to `production` for security hardening |
| `ADMIN_URLS` | Comma-separated admin user URLs (required in production) |
| `FETCH_TIMEOUT_MS` | Timeout for outbound HTTP requests (default: 10000) |

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run dev` | Start with `--watch` for auto-reload |
| `npm run gatekeeper` | Run the site health checker |
| `npm run update-directory` | Re-fetch profiles and update sort order |

## Project Structure

```
dawnofthedevs/
  server.js                  # Express app, routes, middleware, error handling
  lib/
    config.js                # Env-based configuration with production guards
    db.js                    # SQLite singleton (WAL mode) with migrations
    auth.js                  # IndieAuth: discovery, PKCE, code exchange
    middleware.js            # commonLocals, requireAuth, requireAdmin
    logger.js                # Structured JSON logger
    rateLimiter.js           # Rate limiting (general, auth, actions)
  models/
    site.js                  # Sites CRUD, navigation, sorting, status moderation
    siteCheck.js             # Link check results
    gardenJournal.js         # Tiered check scheduling
  controllers/
    pages.js                 # Home, directory, terms
    dashboard.js             # Member dashboard actions
    navigation.js            # /next, /previous, /random
    auth.js                  # Login, callback, logout
    admin.js                 # Admin dashboard and status management
  utils/
    safeFetch.js             # SSRF-safe fetch wrapper
    linksCheck.js            # Verify webring links on member sites
    profileCheck.js          # Parse h-card profiles
    profileHelpers.js        # h-card property extraction, photo URL sanitization
    timeAgo.js               # Relative time formatting
    urlHelpers.js            # URL display helpers
  bin/
    gatekeeper.js            # Automated site health checker
    directory-updater.js     # Profile re-fetcher
  schema/
    schema.sql               # SQLite schema (4 tables)
  views/                     # EJS templates
    admin/                   # Admin dashboard
    partials/                # Shared template partials
    error.ejs                # Error page (404/500)
  public/                    # Static assets (CSS, JS, images)
```

## License

MIT
