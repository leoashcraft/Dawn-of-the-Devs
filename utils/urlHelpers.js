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

/**
 * Extract the domain (hostname) from a URL.
 */
function domainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

module.exports = { cuteUrl, domainFromUrl };
