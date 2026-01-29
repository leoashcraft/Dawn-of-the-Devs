const { mf2 } = require('microformats-parser');
const config = require('../lib/config');
const { profileFromCard } = require('./profileHelpers');

/**
 * Fetch a site and parse its representative h-card.
 * Implements the representative h-card algorithm:
 * 1. h-card with uid + url matching the page URL
 * 2. h-card with url matching a rel-me
 * 3. Single h-card on the page
 */
async function checkProfile(siteUrl) {
  let html;
  try {
    const res = await fetch(siteUrl, {
      headers: { 'User-Agent': config.USER_AGENT },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const parsed = mf2(html, { baseUrl: siteUrl });
  const hCards = findItems(parsed.items, 'h-card');

  if (hCards.length === 0) return null;

  const relMes = parsed.rels && parsed.rels.me ? parsed.rels.me : [];

  // Step 1: h-card with uid and url both matching page URL
  for (const card of hCards) {
    const uids = card.properties.uid || [];
    const urls = card.properties.url || [];
    const pageMatch = (arr) => arr.some(v => urlsMatch(val(v), siteUrl));
    if (pageMatch(uids) && pageMatch(urls)) {
      return profileFromCard(card.properties);
    }
  }

  // Step 2: h-card with url matching a rel-me
  if (relMes.length > 0) {
    for (const card of hCards) {
      const urls = card.properties.url || [];
      const hasRelMe = urls.some(u => relMes.some(rm => urlsMatch(val(u), rm)));
      if (hasRelMe) {
        return profileFromCard(card.properties);
      }
    }
  }

  // Step 3: single top-level h-card
  const topLevelCards = parsed.items.filter(item =>
    item.type && item.type.includes('h-card')
  );
  if (topLevelCards.length === 1) {
    return profileFromCard(topLevelCards[0].properties);
  }

  // Fallback: just use the first h-card
  return profileFromCard(hCards[0].properties);
}

/**
 * Recursively find all items of a given type in the microformats tree.
 */
function findItems(items, type) {
  let found = [];
  for (const item of items) {
    if (item.type && item.type.includes(type)) {
      found.push(item);
    }
    if (item.children) {
      found = found.concat(findItems(item.children, type));
    }
    // Check properties for nested items
    if (item.properties) {
      for (const [, values] of Object.entries(item.properties)) {
        if (Array.isArray(values)) {
          for (const v of values) {
            if (v && typeof v === 'object' && v.type) {
              if (v.type.includes(type)) found.push(v);
              if (v.children) {
                found = found.concat(findItems(v.children, type));
              }
            }
          }
        }
      }
    }
  }
  return found;
}

/**
 * Get the string value from a microformat property value.
 */
function val(v) {
  return typeof v === 'string' ? v : (v && v.value ? v.value : '');
}

/**
 * Compare two URLs, ignoring trailing slashes and scheme differences.
 */
function urlsMatch(a, b) {
  if (!a || !b) return false;
  const normalize = (u) => u.replace(/\/$/, '').replace(/^https?:\/\//, '').toLowerCase();
  return normalize(a) === normalize(b);
}

module.exports = { checkProfile };
