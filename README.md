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

- **Runtime:** Node.js (>=20)
- **Framework:** [Express.js](https://expressjs.com/)
- **Templates:** [EJS](https://ejs.co/)
- **Database:** PostgreSQL via [node-postgres (pg)](https://node-postgres.com/)
- **Auth:** [IndieAuth](https://indieauth.spec.indieweb.org/) with PKCE + [indielogin.com](https://indielogin.com/) fallback
- **Sessions:** express-session with [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) (PostgreSQL-backed store)
- **CSRF Protection:** [csrf-sync](https://github.com/Psifi-Solutions/csrf-sync) (synchronizer token pattern)
- **Security Headers:** [helmet](https://helmetjs.github.io/) with Content Security Policy
- **Rate Limiting:** [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)
- **HTML Parsing:** [cheerio](https://cheerio.js.org/) for link checking, [microformats-parser](https://github.com/microformats/microformats-parser) for h-card discovery
- **Built with:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code) by Anthropic

## How It Works

### Joining the Ring

1. **Add links** — Place `previous` and `next` links on your site pointing to `dawnofthedevs.com/previous` and `dawnofthedevs.com/next`. Optionally add `random` and `home` links too.
2. **Sign in** — Authenticate with your domain via IndieAuth on the home page.
3. **Approval** — New sites start with `pending` status. An admin approves your site before it enters the ring.
4. **Activate** — Check your links from the dashboard. If both required links are found, your site goes active.
5. **Profile** — Optionally add an [h-card](https://indieweb.org/h-card) to your site. Dawn of the Devs will parse it and display your name, photo, and bio in the directory.

### Ring Navigation

When a visitor clicks "next" or "previous" on a member's site, the webring reads the `Referer` header to determine which site they came from, then redirects to the next or previous member in sort order. If no referrer is available, a random active member is chosen. The ring wraps around — the last site links back to the first, and vice versa.

Only approved and active sites participate in ring navigation. Sort order is recalculated monthly using a deterministic shuffle so every member gets a fair position over time.

### How Link Verification Works

Dawn of the Devs verifies that member sites actually contain the required webring links. This happens two ways:

**Manual checks** — Members can click "Check links" on their dashboard at any time. The server fetches their site's HTML, parses it with cheerio, and searches for `<a>` tags whose `href` points to the webring domain. It specifically looks for links to `/next` and `/previous` paths.

**Automated checks** — The gatekeeper script runs periodically and re-checks all member sites on a tiered schedule. Active sites with healthy links are checked less frequently (up to every 30 days). Sites that lose their links are checked more often at first, then gradually less.

Each check produces a result with two severity levels:

- **Critical** — A required link (`/next` or `/previous`) is completely missing, or the site could not be fetched at all. Any critical error makes the site **inactive**.
- **Warning** — The links exist but use an older format (like `/:slug/next` instead of `/next`). Warnings alone do not deactivate a site.

A site is **active** if it has zero critical errors. Active + approved sites appear in the ring and directory. If a site goes down or removes its webring links, the gatekeeper will mark it inactive and remove it from rotation until the links are restored.

### Gatekeeper Tiered Schedule

The gatekeeper uses an escalating schedule to avoid hammering sites that are consistently healthy or permanently broken:

| Tier | Re-check interval |
|------|-------------------|
| 0 | 1 day |
| 1 | 3 days |
| 2 | 7 days |
| 3 | 14 days |
| 4 | 30 days |
| 5-6 | 30 days |
| 7 | Stop checking |

Active sites are capped at tier 4 (checked every 30 days). Inactive sites escalate through all tiers until they either come back online or stop being checked. When a site's status changes (active to inactive or vice versa), its tier resets to 0 so it gets rechecked quickly.

### Navigation Analytics

Every time a visitor uses a webring link, the navigation is recorded anonymously — just the referring site URL, the target site URL, and the link type (previous, next, random, or home). No visitor-identifying information is stored.

Members can see their own navigation stats on their dashboard: total navigations from their site and a breakdown by link type. Admins see aggregate stats across all sites.

### h-Card Profile Discovery

Dawn of the Devs uses the [representative h-card algorithm](https://microformats.org/wiki/representative-h-card-parsing) to find your profile:

1. An h-card with both `uid` and `url` matching the page URL (strongest signal)
2. An h-card with a `url` matching a `rel=me` link on the page
3. The only h-card on the page
4. The first h-card found (fallback)

Extracted properties: `name`, `photo`, `note` (bio), `job-title`, and `url`. These display in the member directory as profile cards.

### Admin Moderation

Admins (configured via `ADMIN_URLS`) manage site status from the `/admin` dashboard:

- **Pending** — New registrations awaiting review
- **Approved** — Eligible for the ring (still needs passing link check to go active)
- **Denied** — Rejected from the ring
- **Banned** — Permanently removed, skipped by all automated checks

### IndieAuth Flow

1. User enters their domain on the home page
2. Server discovers the site's IndieAuth authorization endpoint via HTTP `Link` headers or `<link>` tags, falling back to [indielogin.com](https://indielogin.com/) if none is found
3. Server generates a PKCE challenge (S256) and random state parameter
4. User is redirected to their authorization endpoint to authenticate
5. Authorization server redirects back with a code
6. Server exchanges the code (with PKCE verifier) for the authenticated `me` URL
7. Site is auto-created with `pending` status if new, and a session is established

## Security

### SSRF Protection

All outbound HTTP requests (link checks, profile fetches, auth discovery) use a `safeFetch` wrapper that:

- Resolves DNS and blocks private/reserved IP ranges (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, fc/fd, fe80)
- Rejects non-http/https URL schemes
- Enforces a configurable timeout via `AbortController` (default 10s)

### Headers and Transport

- **Content Security Policy** via helmet: `default-src 'self'`, `script-src 'self'`, `img-src 'self' https: data:`, `style-src 'self' 'unsafe-inline'`
- **HTTPS redirect** in production with `trust proxy` for reverse proxy deployments
- **Secure session cookies** in production (`secure`, `httpOnly`, `sameSite: lax`)
- Helmet defaults: `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy`

### Rate Limiting

Three tiers of rate limiting per IP address:

| Scope | Limit | Routes |
|-------|-------|--------|
| General | 100 req / 15 min | All routes |
| Auth | 10 req / 15 min | `/auth/login`, `/auth/callback` |
| Actions | 20 req / 15 min | `/check-links`, `/check-profile`, `/remove-profile` |

### Authentication and CSRF

- IndieAuth with PKCE (S256) for domain-based authentication
- CSRF synchronizer token on all state-changing POST endpoints
- Session-based auth with `requireAuth` and `requireAdmin` middleware
- Production startup guards: server refuses to start without `SESSION_SECRET`, `CSRF_SECRET`, and `ADMIN_URLS`

### Input Validation

- URL length enforced at 2048 characters
- Photo URLs from h-cards sanitized to allow only http/https schemes
- Admin status values validated against a strict whitelist
- All SQL queries use parameterized `$1, $2, ...` placeholders

### Error Handling

- Generic error messages shown to users in production (no stack traces)
- Structured JSON logging in production, human-readable in development
- Request logging captures method, URL, status, duration, and IP

## Database

Five PostgreSQL tables, auto-created on first startup:

| Table | Purpose |
|-------|---------|
| **Sites** | Member registry — URL (primary key), active flag, moderation status, h-card profile JSON, sort order, join timestamp |
| **SiteChecks** | Link verification history — timestamped results with error messages and severity levels |
| **GardenJournals** | Gatekeeper scheduling — tracks each site's check tier, last active status, and next check time |
| **NavigationHits** | Ring navigation analytics — referrer, target, link type, timestamp |
| **Migrations** | Schema versioning — tracks applied database migrations |

## Setup

```bash
git clone https://github.com/leoashcraft/Dawn-of-the-Devs.git
cd Dawn-of-the-Devs
npm install
cp .env.example .env
# Edit .env with your configuration (DATABASE_URL, secrets, etc.)
# Ensure PostgreSQL is running and accessible
npm run dev
```

The database schema is created automatically on first startup.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `BASE_URL` | Public URL of the site |
| `SESSION_SECRET` | Secret for signing session cookies (required in production) |
| `CSRF_SECRET` | Secret for CSRF token generation (required in production) |
| `USER_AGENT` | User-Agent string for outbound requests |
| `DATABASE_URL` | PostgreSQL connection string |
| `NODE_ENV` | Set to `production` for security hardening |
| `ADMIN_URLS` | Comma-separated admin user URLs (required in production) |
| `FETCH_TIMEOUT_MS` | Timeout for outbound HTTP requests in ms (default: 10000) |

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run dev` | Start with `--watch` for auto-reload |
| `npm run gatekeeper` | Run the site health checker (all due sites) |
| `npm run gatekeeper <url>` | Check a single site |
| `npm run update-directory` | Re-fetch profiles and update sort order |
| `npm run update-directory <url>` | Update a single site |

The gatekeeper and directory updater are meant to run on a schedule (e.g. via cron). The gatekeeper is idempotent and safe to run multiple times per day. The directory updater is typically run monthly.

## Routes

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Home page with sign-in form |
| GET | `/directory` | Member directory grid |
| GET | `/terms` | FAQ and terms |

### Ring Navigation

| Method | Path | Description |
|--------|------|-------------|
| GET | `/next` | Redirect to next site in ring |
| GET | `/previous` | Redirect to previous site in ring |
| GET | `/random` | Redirect to random active site |
| GET | `/home` | Redirect to webring home |
| GET | `/:slug/next` | Legacy next (still supported) |
| GET | `/:slug/previous` | Legacy previous (still supported) |

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Start IndieAuth flow |
| GET | `/auth/callback` | IndieAuth callback |
| POST | `/auth/logout` | Sign out |

### Dashboard (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Member dashboard |
| POST | `/check-links` | Verify webring links on your site |
| POST | `/check-profile` | Fetch and update h-card profile |
| POST | `/remove-profile` | Remove profile from directory |

### Admin (authenticated + admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin` | Admin moderation dashboard |
| POST | `/admin/status` | Update a site's moderation status |

## Project Structure

```
dawnofthedevs/
  server.js                  # Express app, routes, middleware, error handling
  lib/
    config.js                # Env-based configuration with production guards
    db.js                    # PostgreSQL pool with async helpers and migrations
    auth.js                  # IndieAuth: discovery, PKCE, code exchange
    middleware.js            # commonLocals, requireAuth, requireAdmin
    logger.js                # Structured JSON logger
    rateLimiter.js           # Rate limiting (general, auth, actions)
  models/
    site.js                  # Sites CRUD, navigation, sorting, status moderation
    siteCheck.js             # Link check results
    gardenJournal.js         # Tiered check scheduling
    navigationHit.js         # Ring navigation tracking
  controllers/
    pages.js                 # Home, directory, terms
    dashboard.js             # Member dashboard actions
    navigation.js            # /next, /previous, /random, /home
    auth.js                  # Login, callback, logout
    admin.js                 # Admin dashboard and status management
  utils/
    safeFetch.js             # SSRF-safe fetch wrapper
    linksCheck.js            # Verify webring links on member sites
    profileCheck.js          # Parse h-card profiles
    profileHelpers.js        # h-card property extraction, photo URL sanitization
    timeAgo.js               # Relative time formatting
    urlHelpers.js            # URL display helpers
    sleep.js                 # Promise-based sleep utility
  bin/
    gatekeeper.js            # Automated site health checker
    directory-updater.js     # Profile re-fetcher and sort order updater
  schema/
    schema.sql               # PostgreSQL schema (5 tables)
  views/                     # EJS templates
    admin/                   # Admin dashboard
    partials/                # Shared template partials
    error.ejs                # Error page (404/500)
  public/                    # Static assets (CSS, JS, images)
```

## Easter Egg

The site UI is wrapped in a draggable macOS-style window, complete with red/yellow/green traffic light buttons that close, minimize, and maximize. Minimizing slides the window into a dock at the bottom of the screen. Closing it reveals a desktop with draggable icons. There's a trash can, context menus, and a small "About" text editor window. None of it affects functionality — it's just for fun.

## License

MIT
