const crypto = require('crypto');
const cheerio = require('cheerio');
const config = require('./config');

/**
 * Normalize a URL: add https:// if missing, ensure trailing slash on bare domains.
 */
function normalizeUrl(url) {
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  const parsed = new URL(url);
  // Ensure trailing slash on bare domain paths
  if (parsed.pathname === '') {
    parsed.pathname = '/';
  }
  return parsed.toString();
}

/**
 * Generate PKCE code_verifier (43-128 chars, URL-safe base64).
 */
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate S256 code_challenge from code_verifier.
 */
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate random state parameter.
 */
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Discover IndieAuth endpoints for a URL.
 * Checks Link headers first, then HTML <link> tags, then indieauth-metadata.
 * Returns { authorizationEndpoint, tokenEndpoint, metadata }.
 */
async function discoverEndpoints(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': config.USER_AGENT },
    redirect: 'follow',
  });

  const endpoints = {
    authorizationEndpoint: null,
    tokenEndpoint: null,
  };

  // Check Link headers
  const linkHeader = res.headers.get('link');
  if (linkHeader) {
    const authMatch = linkHeader.match(/<([^>]+)>;\s*rel="?authorization_endpoint"?/i);
    const tokenMatch = linkHeader.match(/<([^>]+)>;\s*rel="?token_endpoint"?/i);
    const metaMatch = linkHeader.match(/<([^>]+)>;\s*rel="?indieauth-metadata"?/i);

    if (authMatch) endpoints.authorizationEndpoint = new URL(authMatch[1], url).toString();
    if (tokenMatch) endpoints.tokenEndpoint = new URL(tokenMatch[1], url).toString();

    if (metaMatch) {
      const metaUrl = new URL(metaMatch[1], url).toString();
      try {
        const metaEndpoints = await fetchMetadata(metaUrl);
        if (metaEndpoints.authorizationEndpoint) endpoints.authorizationEndpoint = metaEndpoints.authorizationEndpoint;
        if (metaEndpoints.tokenEndpoint) endpoints.tokenEndpoint = metaEndpoints.tokenEndpoint;
      } catch { /* ignore metadata fetch errors */ }
    }
  }

  // Check HTML if we still need endpoints
  if (!endpoints.authorizationEndpoint) {
    const html = await res.text();
    const $ = cheerio.load(html);

    const authLink = $('link[rel="authorization_endpoint"]').attr('href');
    const tokenLink = $('link[rel="token_endpoint"]').attr('href');
    const metaLink = $('link[rel="indieauth-metadata"]').attr('href');

    if (authLink) endpoints.authorizationEndpoint = new URL(authLink, url).toString();
    if (tokenLink) endpoints.tokenEndpoint = new URL(tokenLink, url).toString();

    if (!endpoints.authorizationEndpoint && metaLink) {
      const metaUrl = new URL(metaLink, url).toString();
      try {
        const metaEndpoints = await fetchMetadata(metaUrl);
        if (metaEndpoints.authorizationEndpoint) endpoints.authorizationEndpoint = metaEndpoints.authorizationEndpoint;
        if (metaEndpoints.tokenEndpoint) endpoints.tokenEndpoint = metaEndpoints.tokenEndpoint;
      } catch { /* ignore */ }
    }
  }

  return endpoints;
}

/**
 * Fetch indieauth-metadata JSON endpoint.
 */
async function fetchMetadata(metaUrl) {
  const res = await fetch(metaUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': config.USER_AGENT,
    },
  });
  const data = await res.json();
  return {
    authorizationEndpoint: data.authorization_endpoint || null,
    tokenEndpoint: data.token_endpoint || null,
  };
}

/**
 * Build the authorization URL for IndieAuth or indielogin.com fallback.
 */
function buildAuthUrl(endpoint, { me, redirectUri, state, codeChallenge, clientId }) {
  const url = new URL(endpoint);
  url.searchParams.set('me', me);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');

  // Only add PKCE for real IndieAuth endpoints, not indielogin.com
  if (!endpoint.includes('indielogin.com')) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  return url.toString();
}

/**
 * Exchange authorization code for the authenticated "me" URL.
 * Works with both IndieAuth endpoints and indielogin.com.
 */
async function exchangeCode(endpoint, { code, redirectUri, clientId, codeVerifier }) {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', redirectUri);
  body.set('client_id', clientId);

  if (codeVerifier && !endpoint.includes('indielogin.com')) {
    body.set('code_verifier', codeVerifier);
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': config.USER_AGENT,
    },
    body: body.toString(),
  });

  const data = await res.json();

  if (!res.ok || !data.me) {
    throw new Error(data.error_description || data.error || 'IndieAuth code exchange failed');
  }

  return data.me;
}

module.exports = {
  normalizeUrl,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  discoverEndpoints,
  buildAuthUrl,
  exchangeCode,
};
