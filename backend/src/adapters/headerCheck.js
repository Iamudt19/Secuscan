'use strict';

/**
 * SecuScan — Website Security Header Adapter (Phase 1, corrected Phase 2)
 *
 * Correctness rules applied here:
 *
 *  1. Always check the FINAL HTTPS response, not the initial HTTP response.
 *     Sites commonly set security headers only on their HTTPS response.
 *     Checking the HTTP response before a redirect fires would wrongly flag
 *     every header as missing on a correctly-configured site.
 *
 *  2. The "no HTTPS" check is NOT here — it belongs to sslCheck.js where
 *     the proper redirect-aware logic lives. Checking it here based on the
 *     submitted URL's scheme (http://) is a false positive.
 *
 *  3. Only raise a missing-header finding after we've inspected the HTTPS
 *     response. If HTTPS isn't reachable at all, bail without header findings
 *     (sslCheck.js will surface the root cause).
 */

const axios  = require('axios');
const { URL } = require('url');
const { v4: uuidv4 } = require('uuid');

const SOURCE_TOOL = 'secuscan-header-check';

/**
 * Security header definitions.
 * Note: strict-transport-security is checked here too (on the HTTPS response).
 * The ssl adapter checks HSTS from the angle of "redirect present but HSTS absent".
 * These two findings have different explanations and fixes — they complement each other.
 */
const HEADER_CHECKS = [
  {
    header: 'content-security-policy',
    category: 'headers',
    severity: 'high',
    title: 'Missing Content-Security-Policy (CSP)',
    plain_english_summary:
      'Your site has no Content Security Policy. Browsers will execute any script on the page — ' +
      'including ones injected by attackers via Cross-Site Scripting (XSS) vulnerabilities.',
    real_world_impact:
      'If an attacker finds an XSS entry point, they can steal session cookies, redirect users to ' +
      'phishing pages, or silently mine cryptocurrency in visitors\' browsers.',
    fix:
      '# Add this HTTP response header:\n' +
      "Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';\n\n" +
      '# Nginx:\nadd_header Content-Security-Policy "default-src \'self\';" always;\n\n' +
      '# Express.js (helmet):\nconst helmet = require("helmet");\napp.use(helmet());',
  },
  {
    header: 'strict-transport-security',
    category: 'headers',
    severity: 'high',
    title: 'Missing HTTP Strict Transport Security (HSTS)',
    plain_english_summary:
      'The HTTPS response does not include a Strict-Transport-Security header. Without it, ' +
      'browsers can be tricked into connecting to your site over plain HTTP, even if HTTPS is available.',
    real_world_impact:
      'SSL-stripping attacks silently downgrade a connection from HTTPS to HTTP, exposing passwords ' +
      'and session tokens to anyone on the same network.',
    fix:
      '# Add to your HTTPS server block:\nStrict-Transport-Security: max-age=31536000; includeSubDomains; preload\n\n' +
      '# Nginx:\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n\n' +
      '# Express.js:\napp.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));',
  },
  {
    header: 'x-frame-options',
    category: 'headers',
    severity: 'medium',
    title: 'Missing X-Frame-Options',
    plain_english_summary:
      'Your site can be embedded inside an invisible iframe on an attacker\'s page — a technique ' +
      'called clickjacking. Victims think they\'re clicking on the attacker\'s UI but are actually ' +
      'clicking buttons on your site.',
    real_world_impact:
      'An attacker could trick a logged-in user into clicking "Delete Account", "Transfer Funds", ' +
      'or "Approve OAuth App" without their knowledge.',
    fix:
      '# Add this HTTP response header:\nX-Frame-Options: DENY\n\n' +
      '# Or allow same-origin framing:\nX-Frame-Options: SAMEORIGIN\n\n' +
      '# Modern alternative (preferred):\nContent-Security-Policy: frame-ancestors \'self\';',
  },
  {
    header: 'x-content-type-options',
    category: 'headers',
    severity: 'medium',
    title: 'Missing X-Content-Type-Options',
    plain_english_summary:
      'Without this header, browsers may "sniff" the content type of a response and interpret ' +
      'it differently from what the server declared. A malicious file uploaded as an image could ' +
      'be executed as JavaScript.',
    real_world_impact:
      'If your site accepts user file uploads, an attacker could upload a crafted file that gets ' +
      'executed as a script in another user\'s browser, leading to XSS or data theft.',
    fix:
      '# Add this HTTP response header:\nX-Content-Type-Options: nosniff\n\n' +
      '# Nginx:\nadd_header X-Content-Type-Options "nosniff" always;\n\n' +
      '# Express.js:\napp.use(helmet.noSniff());',
  },
  {
    header: 'referrer-policy',
    category: 'headers',
    severity: 'low',
    title: 'Missing Referrer-Policy',
    plain_english_summary:
      'When users click links from your site, the browser sends a Referer header to the destination ' +
      'site revealing which page they came from. Without a policy, you may leak sensitive URL paths ' +
      '(password-reset tokens, user IDs) to third-party analytics or ad networks.',
    real_world_impact:
      'Third-party scripts on destination sites can read URL fragments from your pages, potentially ' +
      'exposing user data or single-use authentication tokens.',
    fix:
      '# Add this HTTP response header:\nReferrer-Policy: strict-origin-when-cross-origin\n\n' +
      '# Nginx:\nadd_header Referrer-Policy "strict-origin-when-cross-origin" always;\n\n' +
      '# Express.js:\napp.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));',
  },
  {
    header: 'permissions-policy',
    category: 'headers',
    severity: 'low',
    title: 'Missing Permissions-Policy',
    plain_english_summary:
      'Permissions-Policy controls which browser features (camera, microphone, geolocation, ' +
      'payment) your page and any embedded iframes can access. Without it, third-party scripts ' +
      'can request full access to sensitive device APIs.',
    real_world_impact:
      'A compromised third-party analytics or ad script could silently request access to a ' +
      'visitor\'s microphone, geolocation, or payment info without being blocked at the browser level.',
    fix:
      '# Add this HTTP response header:\nPermissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n\n' +
      '# Nginx:\nadd_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
  },
];

/**
 * Derive the canonical HTTPS URL to check headers on.
 *
 * If the user submitted http://example.com, we probe https://example.com —
 * that's where security headers are expected to live.
 * If they submitted https://example.com, we probe it directly.
 *
 * @param {string} targetUrl
 * @returns {string} URL to fetch for header inspection
 */
function resolveHttpsUrl(targetUrl) {
  const parsed = new URL(targetUrl);
  // Always probe HTTPS regardless of submitted scheme
  parsed.protocol = 'https:';
  // If no explicit port was given, clear any port (443 is implied)
  if (!parsed.port || parsed.port === '80' || parsed.port === '443') {
    parsed.port = '';
  }
  return parsed.toString();
}

/**
 * Run a security header check against a website URL.
 *
 * @param {string} targetUrl
 * @param {string} scanId
 * @returns {Promise<import('../schema').Finding[]>}
 */
async function runHeaderCheck(targetUrl, scanId) {
  // Always inspect the HTTPS response — headers should be set there.
  const httpsUrl = resolveHttpsUrl(targetUrl);

  let response;
  try {
    response = await axios.get(httpsUrl, {
      timeout: 15_000,
      // Follow redirects so we land on the real page (e.g. www → non-www)
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'SecuScan/2.0 security-audit-tool',
        // SNI: important for sites behind shared hosting / CDNs
        Host: new URL(httpsUrl).hostname,
      },
    });
  } catch (err) {
    // HTTPS isn't reachable — the ssl adapter will surface this.
    // Return empty findings here rather than falsely flagging all headers missing.
    console.warn(`[HeaderCheck] Could not reach ${httpsUrl}: ${err.message} — skipping header check`);
    return [];
  }

  const responseHeaders = response.headers;
  const findings        = [];

  for (const check of HEADER_CHECKS) {
    const headerValue = responseHeaders[check.header];

    if (!headerValue) {
      findings.push({
        id:                    uuidv4(),
        scan_id:               scanId,
        target_type:           'website',
        category:              check.category,
        severity:              check.severity,
        title:                 check.title,
        plain_english_summary: check.plain_english_summary,
        real_world_impact:     check.real_world_impact,
        fix:                   check.fix,
        source_tool:           SOURCE_TOOL,
      });
    }
    // Header present → no finding for this check
  }

  // NOTE: The old "Site served over plain HTTP" finding has been REMOVED.
  // The ssl adapter's check (b) correctly handles the HTTP/HTTPS redirect logic
  // with redirect-disabled probing. Duplicating it here based on submitted URL
  // scheme caused false positives on any correctly-configured site.

  return findings;
}

module.exports = { runHeaderCheck };
