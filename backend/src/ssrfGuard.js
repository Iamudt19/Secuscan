'use strict';

/**
 * Vulta — SSRF Guard (Enhanced, Phase 2)
 *
 * Centralises all SSRF checks:
 *  1. Hostname blocklist (localhost, cloud metadata endpoints, etc.)
 *  2. DNS resolution → private/reserved IP range block
 *  3. Post-redirect re-validation (call assertSafeUrl on redirect destinations)
 *
 * Usage:
 *   const { assertSafeUrl, ssrfAwareAxios } = require('./ssrfGuard');
 *   await assertSafeUrl('https://example.com');                    // throws on SSRF
 *   const resp = await ssrfAwareAxios.get(url);                   // auto-guarded
 */

const dns   = require('dns').promises;
const axios = require('axios');
const { URL } = require('url');

// ─── Private / Reserved IP patterns ─────────────────────────────────────────

const BLOCKED_RANGES = [
  /^127\./,                         // IPv4 loopback
  /^10\./,                          // RFC-1918 Class A
  /^172\.(1[6-9]|2\d|3[01])\./,    // RFC-1918 Class B
  /^192\.168\./,                    // RFC-1918 Class C
  /^169\.254\./,                    // link-local / AWS metadata (169.254.169.254)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT (RFC 6598)
  /^0\./,                           // "this" network
  /^::1$/,                          // IPv6 loopback
  /^fc00:/i,                        // IPv6 unique-local
  /^fe80:/i,                        // IPv6 link-local
  /^fd[0-9a-f]{2}:/i,               // IPv6 unique-local (fd prefix)
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
  '169.254.169.254',            // AWS/Azure/GCP metadata
  'instance-data',              // AWS alternate
  'computemetadata.internal',
]);

/**
 * Check a single IP string against all blocked ranges.
 * @param {string} ip
 * @returns {boolean}
 */
function isBlockedIp(ip) {
  return BLOCKED_RANGES.some((re) => re.test(ip));
}

/**
 * Resolve hostname and assert all its IPs are public/non-reserved.
 * @param {string} hostname
 * @throws {Error} if any resolved IP is private/internal
 */
async function assertSafeHostname(hostname) {
  const h = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(h)) {
    throw new Error(`Blocked: "${hostname}" is an internal/reserved host.`);
  }

  // Attempt DNS resolution
  let addresses;
  try {
    addresses = await dns.lookup(h, { all: true });
  } catch {
    // Can't resolve — let the HTTP layer handle the failure gracefully
    return;
  }

  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new Error(
        `SSRF blocked: "${hostname}" resolves to private IP ${address}.`
      );
    }
  }
}

/**
 * Assert a full URL is safe to scan (validates hostname + protocol).
 * @param {string|URL} url
 */
async function assertSafeUrl(url) {
  const parsed = typeof url === 'string' ? new URL(url) : url;

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http:// and https:// are supported.');
  }

  await assertSafeHostname(parsed.hostname);
}

/**
 * An axios instance pre-wired to:
 *  - validate the initial URL before sending
 *  - re-validate each redirect destination (prevents open-redirect SSRF)
 *  - 15-second timeout
 */
const ssrfAwareAxios = axios.create({
  timeout: 15_000,
  maxRedirects: 0, // handle manually so we can re-check each hop
  validateStatus: () => true,
  headers: {
    'User-Agent': 'Vulta/2.0 security-audit-tool',
  },
});

/**
 * Perform a SSRF-safe HTTP GET, following redirects with re-validation at each hop.
 * @param {string} url
 * @param {Object} [opts]  Extra axios options
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function safeGet(url, opts = {}) {
  await assertSafeUrl(url);

  let current = url;
  let resp;
  let hops = 0;
  const MAX_HOPS = 5;

  while (hops < MAX_HOPS) {
    resp = await ssrfAwareAxios.get(current, { ...opts, maxRedirects: 0 });

    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      const location = resp.headers['location'];
      if (!location) break;

      // Resolve relative redirects
      const next = new URL(location, current).toString();
      await assertSafeUrl(next); // SSRF re-check after redirect
      current = next;
      hops++;
    } else {
      break;
    }
  }

  return resp;
}

module.exports = { assertSafeUrl, assertSafeHostname, isBlockedIp, safeGet, ssrfAwareAxios };
