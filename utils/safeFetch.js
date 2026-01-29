const dns = require('dns');
const { URL } = require('url');
const config = require('../lib/config');

/**
 * Check if an IP address is private/reserved.
 */
function isPrivateIP(ip) {
  // IPv4 private/reserved ranges
  if (/^127\./.test(ip)) return true;                       // loopback
  if (/^10\./.test(ip)) return true;                        // 10.0.0.0/8
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;  // 172.16.0.0/12
  if (/^192\.168\./.test(ip)) return true;                  // 192.168.0.0/16
  if (/^169\.254\./.test(ip)) return true;                  // link-local
  if (/^0\./.test(ip)) return true;                         // 0.0.0.0/8

  // IPv6 private/reserved
  if (ip === '::1') return true;                            // loopback
  if (/^f[cd]/i.test(ip)) return true;                      // unique local (fc00::/7)
  if (/^fe80/i.test(ip)) return true;                       // link-local
  if (ip === '::') return true;                             // unspecified

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Mapped) return isPrivateIP(v4Mapped[1]);

  return false;
}

/**
 * Resolve hostname and check all IPs are public.
 */
function resolveAndCheck(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return reject(new Error(`DNS lookup failed for ${hostname}: ${err.message}`));
      if (!addresses || addresses.length === 0) return reject(new Error(`No DNS records for ${hostname}`));

      for (const addr of addresses) {
        if (isPrivateIP(addr.address)) {
          return reject(new Error(`Blocked: ${hostname} resolves to private IP`));
        }
      }
      resolve(addresses);
    });
  });
}

/**
 * SSRF-safe fetch wrapper.
 *
 * @param {string} url - URL to fetch
 * @param {object} [fetchOpts={}] - Options passed to fetch()
 * @param {object} [safeOpts={}] - Safety options
 * @param {boolean} [safeOpts.skipSsrfCheck=false] - Skip DNS/IP check (for trusted endpoints)
 * @param {string} [safeOpts.expectedContentType] - Validate response content-type starts with this
 * @param {number} [safeOpts.timeoutMs] - Override default timeout
 */
async function safeFetch(url, fetchOpts = {}, safeOpts = {}) {
  const parsed = new URL(url);

  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked: unsupported protocol ${parsed.protocol}`);
  }

  // SSRF check: resolve DNS and block private IPs
  if (!safeOpts.skipSsrfCheck) {
    await resolveAndCheck(parsed.hostname);
  }

  // AbortController with timeout
  const timeoutMs = safeOpts.timeoutMs || config.FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchOpts,
      signal: controller.signal,
    });

    // Content-type validation
    if (safeOpts.expectedContentType) {
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith(safeOpts.expectedContentType)) {
        throw new Error(`Unexpected content-type: ${ct}`);
      }
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { safeFetch, isPrivateIP };
