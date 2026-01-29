/**
 * Extract profile info from a parsed h-card's properties.
 */
function profileFromCard(properties) {
  if (!properties) return null;

  const name = firstValue(properties.name);
  const note = firstValue(properties.note);
  const url = firstValue(properties.url);

  let photo = null;
  if (properties.photo && properties.photo.length > 0) {
    const p = properties.photo[0];
    // photo can be a string or an object with value/alt
    photo = typeof p === 'string' ? p : (p.value || p);
  }

  return { name, note, photo, url };
}

function firstValue(arr) {
  if (!arr || arr.length === 0) return null;
  const val = arr[0];
  return typeof val === 'string' ? val : (val.value || null);
}

module.exports = { profileFromCard };
