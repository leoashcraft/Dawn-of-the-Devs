require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const parsed = new URL(BASE_URL);

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  BASE_URL,
  HOSTNAME: parsed.hostname,
  SESSION_SECRET: process.env.SESSION_SECRET || 'change-me',
  CSRF_SECRET: process.env.CSRF_SECRET || 'change-me-csrf',
  USER_AGENT: process.env.USER_AGENT || 'DawnOfTheDevs/1.0 (+https://dawnofthedevs.com)',
  DB_PATH: process.env.DB_PATH || 'data/dawnofthedevs.sqlite3',

  // Domains that count as "this webring" when checking member links
  ALLOWED_DOMAINS: [
    parsed.hostname,
    'dawnofthedevs.com',
    'www.dawnofthedevs.com',
  ],

  // Gardener tier schedule: days until next check
  // Index = tier number. "NEVER" means stop checking.
  WAIT_TIERS: [1, 3, 7, 14, 30, 30, 30, 'NEVER'],

  // Active sites cap at this tier (re-check every 30 days)
  ACTIVE_TIER_CAP: 4,

  // Inactive sites escalate up to WAIT_TIERS.length - 1
  INACTIVE_TIER_CAP: 7,
};
