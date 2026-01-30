/**
 * Strip scheme, www, and trailing slash for display.
 */
function cuteUrl(url) {
  if (!url) return '';
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

module.exports = { cuteUrl };
