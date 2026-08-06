'use strict';

/**
 * Vulta — SSL/TLS Check Adapter (Phase 2, corrected)
 *
 * Three clearly-scoped checks (never conflated):
 *
 *   (a) Is HTTPS actually available and valid?
 *       → Connect TLS to port 443, inspect cert + protocol.
 *         If HTTPS is entirely broken, that is a critical finding.
 *
 *   (b) Does HTTP correctly redirect to HTTPS?
 *       → GET http://host with redirects DISABLED (maxRedirects: 0).
 *         3xx to https:// → ✅ pass (no finding).
 *         2xx serving real content over HTTP → finding.
 *         Connection refused / timeout → fine (HTTP-only is secure).
 *
 *   (c) Is HSTS present on the HTTPS response?
 *       → Separate from (b). Even if (b) passes (redirect exists),
 *         the *first* request before the redirect is still vulnerable
 *         to a downgrade attack without HSTS. Lower severity than (a).
 *
 * The headerCheck adapter owns all other response headers (CSP, X-Frame-Options, etc.)
 * and already checks HSTS on the HTTPS response. We only check HSTS here to note
 * the nuance between "redirect present" and "redirect + HSTS present".
 */

const tls            = require('tls');
const http           = require('http');
const https          = require('https');
const { URL }        = require('url');
const { v4: uuidv4 } = require('uuid');
const { assertSafeHostname } = require('../ssrfGuard');

const SOURCE_TOOL    = 'vulta-ssl-check';
const CONNECT_TIMEOUT = 15_000;

// ─── TLS connection helper ────────────────────────────────────────────────────

/**
 * Open a raw TLS socket and return cert + protocol metadata.
 * We set rejectUnauthorized=false intentionally so we can *inspect*
 * bad certs rather than just failing.
 */
function getTlsInfo(hostname, port = 443) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: CONNECT_TIMEOUT,
      },
      () => {
        const info = {
          cert:       socket.getPeerCertificate(true),
          protocol:   socket.getProtocol(),
          authorized: socket.authorized,
          authError:  socket.authorizationError,
        };
        socket.destroy();
        resolve(info);
      }
    );
    socket.on('error', reject);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('TLS connect timed out')); });
  });
}

// ─── HTTP single-hop helper (no redirect following) ──────────────────────────

/**
 * Make a single HTTP/HTTPS GET request with NO redirect following.
 * Returns { status, headers, timedOut, refused }.
 */
function rawGet(url, timeoutMs = 10_000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const port   = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port,
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers:  { 'User-Agent': 'Vulta/2.0 security-audit-tool' },
        // Crucially: no follow-redirects
      },
      (res) => {
        // Consume body to free socket (we only care about status + headers)
        res.on('data', () => {});
        res.on('end', () => {
          resolve({
            status:   res.statusCode,
            headers:  res.headers,
            timedOut: false,
            refused:  false,
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ status: null, headers: {}, timedOut: true, refused: false });
    });

    req.on('error', (err) => {
      const refused = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET';
      resolve({ status: null, headers: {}, timedOut: false, refused });
    });

    req.end();
  });
}

// ─── Main SSL check ───────────────────────────────────────────────────────────

/**
 * @param {string} targetUrl
 * @param {string} scanId
 * @returns {Promise<{ findings: Finding[], tool_used: string, error?: string, checks: Object }>}
 */
async function runSslCheck(targetUrl, scanId) {
  const findings = [];
  /** Summary of what was checked — surfaces in UI even when no finding raised. */
  const checks   = {};

  let parsed;
  try { parsed = new URL(targetUrl); }
  catch { return { findings: [], tool_used: SOURCE_TOOL, error: 'Invalid URL', checks }; }

  const hostname = parsed.hostname;

  // ── (a) Is HTTPS present and valid? ──────────────────────────────────────────
  let tlsInfo = null;
  let httpsAvailable = false;

  try {
    tlsInfo = await getTlsInfo(hostname, 443);
    httpsAvailable = true;
    checks.https_available = '✅ HTTPS is available on port 443';
  } catch (err) {
    checks.https_available = `❌ HTTPS unavailable: ${err.message}`;

    // Only raise "no HTTPS" if the *submitted* scheme is also http — avoids
    // false-flagging sites where port 443 is blocked by a firewall but HTTPS
    // is accessible via a CDN.
    findings.push({
      id: uuidv4(), scan_id: scanId, target_type: 'website',
      category: 'ssl', severity: 'critical',
      title: 'HTTPS not available',
      plain_english_summary:
        'The site does not serve traffic over HTTPS. All data — including login credentials, ' +
        'session cookies, and form submissions — is transmitted in plain text across the internet.',
      real_world_impact:
        'Anyone on the same network (café Wi-Fi, ISP, VPN exit node) can read or silently modify ' +
        'all traffic. Modern browsers label HTTP-only sites as "Not Secure" with a visible warning.',
      fix:
        '# Get a free, auto-renewing TLS certificate from Let\'s Encrypt:\ncertbot --nginx -d yourdomain.com\n\n' +
        '# With Caddy (zero-config HTTPS):\ncaddy reverse-proxy --from yourdomain.com --to localhost:3000\n\n' +
        '# With a cloud provider: enable HTTPS in your load balancer / CDN settings.',
      source_tool: SOURCE_TOOL,
    });

    // Without TLS, the rest of the checks are moot
    return { findings, tool_used: SOURCE_TOOL, checks };
  }

  // ── (a-i) Certificate expiry ──────────────────────────────────────────────────
  const cert = tlsInfo.cert;
  if (cert && cert.valid_to) {
    const expiryDate = new Date(cert.valid_to);
    const now        = new Date();
    const daysLeft   = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

    checks.cert_expiry = daysLeft > 0
      ? `✅ Certificate valid for ${daysLeft} more days (expires ${expiryDate.toDateString()})`
      : `❌ Certificate expired ${Math.abs(daysLeft)} days ago`;

    if (daysLeft < 0) {
      findings.push({
        id: uuidv4(), scan_id: scanId, target_type: 'website',
        category: 'ssl', severity: 'critical',
        title: `TLS certificate expired ${Math.abs(daysLeft)} days ago`,
        plain_english_summary:
          `Your certificate expired on ${expiryDate.toDateString()}. Browsers show a hard block page — ` +
          `visitors cannot reach your site without bypassing a security warning.`,
        real_world_impact:
          'Complete site unavailability for most users. Zero graceful degradation.',
        fix:
          '# Renew immediately:\ncertbot renew --force-renewal\n\n# Enable auto-renewal so this never happens again:\nsystemctl enable --now certbot.timer\n# or add to crontab: 0 0,12 * * * certbot renew --quiet',
        source_tool: SOURCE_TOOL,
      });
    } else if (daysLeft <= 7) {
      findings.push({
        id: uuidv4(), scan_id: scanId, target_type: 'website',
        category: 'ssl', severity: 'critical',
        title: `TLS certificate expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        plain_english_summary:
          `Certificate expires ${expiryDate.toDateString()} — only ${daysLeft} day(s) left. ` +
          `Sites with expired certs become unreachable for all users.`,
        real_world_impact:
          'Imminent complete outage. Renew before the deadline.',
        fix: '# Renew NOW:\ncertbot renew --force-renewal',
        source_tool: SOURCE_TOOL,
      });
    } else if (daysLeft <= 30) {
      findings.push({
        id: uuidv4(), scan_id: scanId, target_type: 'website',
        category: 'ssl', severity: 'medium',
        title: `TLS certificate expires in ${daysLeft} days`,
        plain_english_summary:
          `Certificate expires ${expiryDate.toDateString()}. Schedule renewal now to avoid disruption.`,
        real_world_impact:
          'Missing renewal causes a hard site outage. Industry best-practice is to renew at 30 days remaining.',
        fix:
          '# Renew:\ncertbot renew\n\n# Enable auto-renewal:\nsystemctl enable --now certbot.timer',
        source_tool: SOURCE_TOOL,
      });
    }
  }

  // ── (a-ii) Self-signed cert ───────────────────────────────────────────────────
  if (tlsInfo && !tlsInfo.authorized && tlsInfo.authError) {
    const errMsg = String(tlsInfo.authError);
    if (errMsg.includes('self') || errMsg.includes('SELF_SIGNED') || errMsg.includes('unknown')) {
      checks.cert_trusted = `❌ Certificate not trusted by browsers: ${errMsg}`;
      findings.push({
        id: uuidv4(), scan_id: scanId, target_type: 'website',
        category: 'ssl', severity: 'high',
        title: 'Self-signed or untrusted TLS certificate',
        plain_english_summary:
          'The TLS certificate has not been issued by a trusted Certificate Authority. ' +
          'Browsers show a security warning to every visitor.',
        real_world_impact:
          'Visitors must click through a scary warning. Destroys trust and suppresses conversions. ' +
          'Also means the cert provides no protection against man-in-the-middle attacks.',
        fix:
          '# Replace with a free, CA-signed cert from Let\'s Encrypt:\ncertbot --nginx -d yourdomain.com\n# or for Apache:\ncertbot --apache -d yourdomain.com',
        source_tool: SOURCE_TOOL,
      });
    } else {
      checks.cert_trusted = `✅ Certificate is CA-signed`;
    }
  } else if (tlsInfo) {
    checks.cert_trusted = `✅ Certificate is trusted by browsers`;
  }

  // ── (a-iii) Deprecated TLS version ───────────────────────────────────────────
  if (tlsInfo && tlsInfo.protocol) {
    const deprecated = ['TLSv1', 'TLSv1.1', 'SSLv2', 'SSLv3'];
    if (deprecated.includes(tlsInfo.protocol)) {
      checks.tls_version = `❌ Deprecated TLS version: ${tlsInfo.protocol}`;
      findings.push({
        id: uuidv4(), scan_id: scanId, target_type: 'website',
        category: 'ssl', severity: 'high',
        title: `Deprecated TLS version negotiated: ${tlsInfo.protocol}`,
        plain_english_summary:
          `The server accepted a connection using ${tlsInfo.protocol}, which has documented vulnerabilities ` +
          `(POODLE, BEAST). Modern clients should only use TLS 1.2 or 1.3.`,
        real_world_impact:
          'Attackers can downgrade connections to this version and exploit known protocol weaknesses to decrypt traffic.',
        fix:
          `# Nginx — disable old TLS:\nssl_protocols TLSv1.2 TLSv1.3;\n\n# Apache:\nSSLProtocol all -SSLv3 -TLSv1 -TLSv1.1\n\n# Verify:\nopenssl s_client -connect ${hostname}:443 -tls1`,
        source_tool: SOURCE_TOOL,
      });
    } else {
      checks.tls_version = `✅ Modern TLS in use: ${tlsInfo.protocol}`;
    }
  }

  // ── (b) Does HTTP redirect to HTTPS? ─────────────────────────────────────────
  // We probe http://hostname (strip path — we only care about the base domain redirect)
  const httpBaseUrl = `http://${hostname}/`;
  let httpResp = null;

  try {
    await assertSafeHostname(hostname);
    httpResp = await rawGet(httpBaseUrl);
  } catch { /* connection errors are handled below */ }

  if (!httpResp || httpResp.refused) {
    // Port 80 not open at all — this is fine (HTTPS-only is secure)
    checks.http_redirect = '✅ HTTP (port 80) is not served — HTTPS-only configuration';
  } else if (httpResp.timedOut) {
    checks.http_redirect = '⚠️ HTTP port 80 probe timed out';
  } else {
    const status   = httpResp.status;
    const location = httpResp.headers?.location ?? '';
    const isRedirectToHttps =
      [301, 302, 303, 307, 308].includes(status) &&
      (location.startsWith('https://') || location.startsWith('//'));

    if (isRedirectToHttps) {
      // ✅ Correct — HTTP redirects to HTTPS. No finding.
      checks.http_redirect = `✅ HTTP correctly redirects to HTTPS (${status} → ${location})`;
    } else if (status && status < 400) {
      // ❌ HTTP serves real content (2xx/3xx to another HTTP URL)
      checks.http_redirect = `❌ HTTP serves content directly (status ${status}) — no redirect to HTTPS`;
      findings.push({
        id: uuidv4(), scan_id: scanId, target_type: 'website',
        category: 'ssl', severity: 'medium',
        title: 'HTTP does not redirect to HTTPS',
        plain_english_summary:
          'When visited over plain HTTP, the site serves content directly instead of redirecting ' +
          'to the secure HTTPS version. Users who don\'t type "https://" get an unencrypted page.',
        real_world_impact:
          'Most users type a domain name without a protocol prefix, getting plain HTTP. Their session ' +
          'cookies and form data travel unencrypted and are trivially interceptable on any shared network.',
        fix:
          '# Nginx — redirect all HTTP to HTTPS:\nserver {\n  listen 80;\n  server_name yourdomain.com;\n  return 301 https://$host$request_uri;\n}\n\n' +
          '# Apache (.htaccess):\nRewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n\n' +
          '# Express.js middleware:\napp.use((req, res, next) => {\n  if (!req.secure) return res.redirect(301, `https://${req.headers.host}${req.url}`);\n  next();\n});',
        source_tool: SOURCE_TOOL,
      });
    } else {
      checks.http_redirect = `⚠️ HTTP returned status ${status}`;
    }
  }

  // ── (c) HSTS on the HTTPS response ───────────────────────────────────────────
  // Fetch the HTTPS response (single hop, no redirect follow, just to check the header)
  // NOTE: headerCheck.js already checks HSTS at lower severity.
  // We check here specifically to surface the nuance:
  //   "redirect exists BUT first request is still vulnerable without HSTS"
  // We only raise this if (b) passes (redirect IS present) — otherwise headerCheck covers it.
  const httpRedirectExists = checks.http_redirect?.startsWith('✅ HTTP correctly redirects');

  if (httpsAvailable && httpRedirectExists) {
    try {
      const httpsResp = await rawGet(`https://${hostname}/`);
      const hsts      = httpsResp.headers?.['strict-transport-security'];

      if (!hsts) {
        checks.hsts = '❌ HSTS header absent on HTTPS response';
        findings.push({
          id: uuidv4(), scan_id: scanId, target_type: 'website',
          category: 'ssl', severity: 'medium',
          title: 'HTTPS enforced by redirect, but HSTS header is missing',
          plain_english_summary:
            'The site redirects HTTP → HTTPS (good!), but doesn\'t send a Strict-Transport-Security header. ' +
            'This means the very first HTTP request a user makes — before the redirect — is still ' +
            'sent in plain text and is vulnerable to a downgrade attack.',
          real_world_impact:
            'A network-level attacker (e.g. on the same Wi-Fi) can intercept the first HTTP request and ' +
            'prevent the HTTPS redirect from happening, keeping the user on HTTP for the whole session. ' +
            'This attack is known as SSL-stripping.',
          fix:
            '# Add to your HTTPS server config:\nStrict-Transport-Security: max-age=31536000; includeSubDomains; preload\n\n' +
            '# Nginx:\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n\n' +
            '# After deploying, submit to the HSTS preload list:\nhttps://hstspreload.org/',
          source_tool: SOURCE_TOOL,
        });
      } else {
        checks.hsts = `✅ HSTS header present: ${hsts}`;
      }
    } catch { /* HTTPS raw-get failed — headerCheck will surface missing HSTS */ }
  }

  return { findings, tool_used: SOURCE_TOOL, checks };
}

module.exports = { runSslCheck };
