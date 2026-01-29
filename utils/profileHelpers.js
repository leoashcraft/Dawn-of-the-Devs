/**
 * Extract profile info from a parsed h-card's properties.
 */
function profileFromCard(properties) {
  if (!properties) return null;

  const name = firstValue(properties.name);
  const note = firstValue(properties.note);
  const url = firstValue(properties.url);
  const jobTitle = firstValue(properties['job-title']);

  let photo = null;
  if (properties.photo && properties.photo.length > 0) {
    const p = properties.photo[0];
    // photo can be a string or an object with value/alt
    const raw = typeof p === 'string' ? p : (p.value || p);
    photo = sanitizePhotoUrl(raw);
  }

  return { name, note, photo, url, jobTitle };
}

/**
 * Sanitize a photo URL: only allow http/https schemes.
 */
function sanitizePhotoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch { /* invalid URL */ }
  return null;
}

function firstValue(arr) {
  if (!arr || arr.length === 0) return null;
  const val = arr[0];
  return typeof val === 'string' ? val : (val.value || null);
}

module.exports = { profileFromCard, sanitizePhotoUrl };
