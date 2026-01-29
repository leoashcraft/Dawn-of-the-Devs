#!/usr/bin/env node

/**
 * Directory Updater - Re-fetches h-cards and updates sorting for all active profiled sites.
 *
 * Usage:
 *   node bin/directory-updater.js              # Update all active profiled sites
 *   node bin/directory-updater.js https://...  # Update a single site
 */

const Site = require('../models/site');
const { checkProfile } = require('../utils/profileCheck');
const db = require('../lib/db');

const singleUrl = process.argv[2];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateSite(url) {
  console.log(`Updating: ${url}`);

  try {
    const profile = await checkProfile(url);
    await Site.setProfile(url, profile);
    await Site.updateSorting(url);

    if (profile) {
      console.log(`  -> Profile: ${profile.name || '(no name)'}`);
    } else {
      console.log('  -> No h-card found');
    }
  } catch (err) {
    console.log(`  -> Error: ${err.message}`);
  }
}

async function main() {
  await db.initSchema();

  console.log('Dawn of the Devs Directory Updater');
  console.log('==================================\n');

  if (singleUrl) {
    await Site.getSite(singleUrl); // Ensure it exists
    await updateSite(singleUrl);
    console.log('\nDone.');
    await db.pool.end();
    process.exit(0);
  }

  const sites = await Site.getActiveSitesWithProfiles();

  if (sites.length === 0) {
    console.log('No active sites with profiles to update.');
    await db.pool.end();
    process.exit(0);
  }

  console.log(`Updating ${sites.length} site(s)...\n`);

  for (const site of sites) {
    await updateSite(site.url);
    await sleep(500 + Math.random() * 1000);
  }

  console.log('\nDone.');
  await db.pool.end();
  process.exit(0);
}

main().catch(async err => {
  console.error('Directory updater error:', err);
  await db.pool.end();
  process.exit(1);
});
