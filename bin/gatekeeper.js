#!/usr/bin/env node

/**
 * Gatekeeper - Automated site health checker.
 * Checks all sites for webring links and updates active status.
 * Skips banned and denied sites.
 *
 * Usage:
 *   node bin/gatekeeper.js              # Check all due sites
 *   node bin/gatekeeper.js https://...  # Check a single site
 */

const Site = require('../models/site');
const SiteCheck = require('../models/siteCheck');
const GardenJournal = require('../models/gardenJournal');
const { checkLinks, isActiveFromErrors } = require('../utils/linksCheck');
const config = require('../lib/config');
const db = require('../lib/db');

const singleUrl = process.argv[2];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldSkip(site) {
  return site.status === 'banned' || site.status === 'denied';
}

async function checkSite(url) {
  console.log(`Checking: ${url}`);

  const errors = await checkLinks(url);
  await SiteCheck.addSiteCheck(url, errors);

  const active = isActiveFromErrors(errors);
  await Site.setActive(url, active);

  // Update garden journal
  const journal = await GardenJournal.journalForUrl(url);
  let newTier = 0;

  if (journal) {
    const wasActive = journal.last_active_status === true;

    if (active) {
      // Active: cap at ACTIVE_TIER_CAP
      if (wasActive) {
        newTier = Math.min(journal.tier + 1, config.ACTIVE_TIER_CAP);
      } else {
        // Was inactive, now active: reset tier
        newTier = 0;
      }
    } else {
      // Inactive: escalate up to INACTIVE_TIER_CAP
      if (!wasActive) {
        newTier = Math.min(journal.tier + 1, config.INACTIVE_TIER_CAP);
      } else {
        // Was active, now inactive: start escalation
        newTier = 0;
      }
    }
  }

  await GardenJournal.addGardenJournal(url, active, newTier);

  const status = active ? 'ACTIVE' : 'INACTIVE';
  const errCount = errors.length;
  console.log(`  -> ${status} (${errCount} error${errCount !== 1 ? 's' : ''}, tier ${newTier})`);
}

async function main() {
  await db.initSchema();

  console.log('Dawn of the Devs Gatekeeper');
  console.log('===========================\n');

  if (singleUrl) {
    // Single site mode
    await Site.getSite(singleUrl); // Ensure it exists
    await checkSite(singleUrl);
    console.log('\nDone.');
    await db.pool.end();
    process.exit(0);
  }

  // Batch mode: unchecked sites first
  const unchecked = (await Site.unchecked()).filter(s => !shouldSkip(s));
  if (unchecked.length > 0) {
    console.log(`Checking ${unchecked.length} unchecked site(s)...\n`);
    for (const site of unchecked) {
      await checkSite(site.url);
      // Rate limit: 0.5-1.5s random delay
      await sleep(500 + Math.random() * 1000);
    }
  }

  // Then sites that are due for re-check
  const due = await GardenJournal.sitesDue();
  if (due.length > 0) {
    // Filter out banned/denied sites
    const allSites = await Site.all();
    const eligible = [];
    for (const entry of due) {
      const site = allSites.find(s => s.url === entry.url);
      if (site && !shouldSkip(site)) {
        eligible.push(entry);
      } else {
        console.log(`Skipping ${entry.url} (${site ? site.status : 'unknown'})`);
      }
    }

    if (eligible.length > 0) {
      console.log(`\nChecking ${eligible.length} site(s) due for re-check...\n`);
      for (const entry of eligible) {
        await checkSite(entry.url);
        await sleep(500 + Math.random() * 1000);
      }
    }
  }

  if (unchecked.length === 0 && due.length === 0) {
    console.log('No sites need checking right now.');
  }

  console.log('\nDone.');
  await db.pool.end();
  process.exit(0);
}

main().catch(async err => {
  console.error('Gatekeeper error:', err);
  await db.pool.end();
  process.exit(1);
});
