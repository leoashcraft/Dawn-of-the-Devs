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
- **HTML Parsing:** [cheerio](https://cheerio.js.org/) for link checking, [microformats-parser](https://github.com/microformats/microformats-parser) for h-card discovery
- **Built with:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code) by Anthropic

## How It Works

1. **Join** — Add `previous` and `next` links to your site pointing to `dawnofthedevs.com/previous` and `dawnofthedevs.com/next`.
2. **Sign in** — Authenticate with your domain via IndieAuth on the home page.
3. **Activate** — Check your links from the dashboard. If both links are found, your site goes active in the ring.
4. **Profile** — Optionally add an [h-card](https://indieweb.org/h-card) to your site. Dawn of the Devs will parse it and display your name, photo, and bio in the directory.

### Ring Navigation

When a visitor clicks "next" or "previous" on a member's site, the webring reads the `Referer` header to determine which site they came from, then redirects to the next or previous member in sort order. If no referer is available, a random member is chosen.

### Automated Gardening

A CLI gardener (`bin/gardener.js`) periodically checks all member sites for the required webring links. It uses a tiered schedule — active sites are re-checked every 30 days, while inactive sites are checked less frequently until they either come back or stop being checked entirely.

A directory updater (`bin/directory-updater.js`) re-fetches h-card profiles for active members and recalculates sort order monthly.

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
| `SESSION_SECRET` | Secret for signing session cookies |
| `CSRF_SECRET` | Secret for CSRF token generation |
| `USER_AGENT` | User-Agent string for outbound requests |
| `DB_PATH` | Path to the SQLite database file |

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run dev` | Start with `--watch` for auto-reload |
| `npm run garden` | Run the site health checker |
| `npm run update-directory` | Re-fetch profiles and update sort order |

## Project Structure

```
dawnofthedevs/
  server.js                  # Express app, routes, middleware
  lib/
    config.js                # Env-based configuration
    db.js                    # SQLite singleton (WAL mode)
    auth.js                  # IndieAuth: discovery, PKCE, code exchange
    middleware.js            # commonLocals, requireAuth
  models/
    site.js                  # Sites CRUD, navigation, sorting
    siteCheck.js             # Link check results
    gardenJournal.js         # Tiered check scheduling
  controllers/
    pages.js                 # Home, directory, terms
    dashboard.js             # Member dashboard actions
    navigation.js            # /next, /previous, /random
    auth.js                  # Login, callback, logout
  utils/
    linksCheck.js            # Verify webring links on member sites
    profileCheck.js          # Parse h-card profiles
    profileHelpers.js        # h-card property extraction
    timeAgo.js               # Relative time formatting
    urlHelpers.js            # URL display helpers
  bin/
    gardener.js              # Automated site health checker
    directory-updater.js     # Profile re-fetcher
  schema/
    schema.sql               # SQLite schema (3 tables)
  views/                     # EJS templates
  public/                    # Static assets (CSS, JS, images)
```

## License

MIT
