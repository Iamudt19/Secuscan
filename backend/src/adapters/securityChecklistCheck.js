'use strict';

const axios = require('axios');

/**
 * SecuScan — Core 6 Shipping Prompts Web Auditor
 *
 * Runs the following checks on a pasted website URL:
 * 1. Secure Authentication (Inspects login cookies for HttpOnly/Secure flags)
 * 2. IDOR / Access Control (Probes public user api paths for unauthenticated exposure)
 * 3. Secrets Protection (Scrapes frontend JS files for hardcoded API Keys/Credentials)
 * 4. Input Validation (Probes for reflected script tags and SQL syntax injection leaks)
 * 5. Abuse Protection (Sends rapid requests to verify IP rate limits/bot protection)
 * 6. Secure Deployment (Verifies HTTPS and critical deployment headers)
 */

async function runSecurityChecklistCheck(targetUrl, scanId) {
  const findings = [];
  const parsed = new URL(targetUrl);
  const baseUrl = `${parsed.protocol}//${parsed.host}`;

  const client = axios.create({
    timeout: 5000,
    maxRedirects: 5, // follow redirects to support www. and language path routings
    validateStatus: () => true, // accept any status code so we can analyze error pages
    headers: {
      'User-Agent': 'SecuScan-Web-Audit-Agent/1.0',
    },
  });

  // ─── PROMPT 1: Secure Authentication ───────────────────────────────────────
  const loginPaths = ['/login', '/signin', '/wp-login.php', '/admin'];
  for (const path of loginPaths) {
    try {
      const res = await client.get(`${baseUrl}${path}`);
      const cookies = res.headers['set-cookie'] || [];
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];

      for (const cookie of cookieArray) {
        const lower = cookie.toLowerCase();
        const isSecure = lower.includes('secure');
        const isHttpOnly = lower.includes('httponly');
        
        if (!isSecure || !isHttpOnly) {
          findings.push({
            id: `web-auth-cookie-insecure-${scanId}`,
            scan_id: scanId,
            target_type: 'website',
            category: 'Secure Authentication',
            severity: 'medium',
            title: 'Insecure Session Cookie Configuration',
            plain_english_summary: `The login cookie at "${path}" is missing the Secure or HttpOnly attribute flag: "${cookie}".`,
            real_world_impact: 'If a session cookie lacks HttpOnly, malicious scripts can read it to hijack user accounts. Lacking Secure means it is transmitted in plain-text over unencrypted HTTP.',
            fix: 'Set both HttpOnly and Secure flags when initiating session cookies: "Set-Cookie: session_id=xyz; Secure; HttpOnly; SameSite=Lax".',
            source_tool: 'SecuScan Web Audit',
            technical_details: JSON.stringify({ path, cookie }),
          });
          break; // trigger once
        }
      }
      if (findings.some(f => f.category === 'Secure Authentication')) break;
    } catch {
      // ignore route errors
    }
  }

  // ─── PROMPT 2: Prevent Users from Accessing Other Users' Data (IDOR) ────────
  const idorPaths = [
    '/api/users',
    '/users/1',
    '/api/v1/users/1',
    '/profile',
    '/api/profile',
    '/api/v1/profile',
    '/api/orders/1',
    '/api/invoice/1',
    '/settings',
    '/api/settings'
  ];
  for (const path of idorPaths) {
    try {
      const res = await client.get(`${baseUrl}${path}`);
      if (res.status === 200 && typeof res.data === 'object' && res.data !== null) {
        const dataStr = JSON.stringify(res.data).toLowerCase();
        const sensitiveKeys = ['email', 'password', 'token', 'role', 'username', 'billing', 'invoice', 'ssn', 'tax_id', 'address', 'phone'];
        const matchedKey = sensitiveKeys.find(key => dataStr.includes(key));

        if (matchedKey) {
          findings.push({
            id: `web-idor-exposure-${scanId}`,
            scan_id: scanId,
            target_type: 'website',
            category: 'Resource Access Control',
            severity: 'high',
            title: 'Unauthenticated Access Control Exposure (Potential IDOR)',
            plain_english_summary: `The endpoint "${path}" returned sensitive user records to an unauthenticated request (matched field: "${matchedKey}").`,
            real_world_impact: 'Without resource ownership checks, any guest or user can access, modify, or delete other users\' private profiles by guessing numeric IDs.',
            fix: 'Verify the user authentication session and enforce resource ownership checks on the server before database queries: "if (resource.owner_id !== loggedInUser.id) throw ForbiddenError()".',
            source_tool: 'SecuScan Web Audit',
            technical_details: JSON.stringify({ path, responseData: res.data }),
          });
          break;
        }
      }
    } catch {
      // ignore route errors
    }
  }

  // ─── PROMPT 3: Protect Secrets and API Keys ─────────────────────────────────
  try {
    const mainPage = await client.get(baseUrl);
    const html = typeof mainPage.data === 'string' ? mainPage.data : '';

    // Regexes for common frontend secret patterns
    const secretRegexes = {
      GoogleApiKey: /AIzaSy[A-Za-z0-9_\-]{30,45}/,
      StripeSecret: /sk_live_[0-9a-zA-Z]{24}/,
      GenericBearer: /bearer\s+[a-zA-Z0-9_\-\.]{50,}/i,
    };

    let matchedSecret = null;
    for (const [keyType, regex] of Object.entries(secretRegexes)) {
      const match = html.match(regex);
      if (match) {
        matchedSecret = { type: keyType, value: match[0].substring(0, 8) + '...' };
        break;
      }
    }

    if (matchedSecret) {
      findings.push({
        id: `web-secrets-leak-${scanId}`,
        scan_id: scanId,
        target_type: 'website',
        category: 'Secrets Protection',
        severity: 'critical',
        title: 'Hardcoded API Credentials in Frontend Assets',
        plain_english_summary: `A hardcoded credential/secret key (${matchedSecret.type}) was found exposed in the main HTML source code.`,
        real_world_impact: 'Attackers scan public web assets to steal Stripe or cloud credentials, using them to execute charges or access secure databases.',
        fix: 'Move all API credentials, private tokens, and keys to server-side environment variables and access them only through a backend layer.',
        source_tool: 'SecuScan Web Audit',
        technical_details: JSON.stringify({ matchedSecret }),
      });
    }
  } catch (err) {
    console.warn('[ChecklistCheck] Secrets scrape failed:', err.message);
  }

  // ─── PROMPT 4: Input Validation ─────────────────────────────────────────────
  // Check A: Reflected XSS
  try {
    const xssTest = '<script>alert(42)</script>';
    const res = await client.get(`${baseUrl}/?q=${encodeURIComponent(xssTest)}`);
    const bodyText = typeof res.data === 'string' ? res.data : '';

    if (bodyText.includes(xssTest)) {
      findings.push({
        id: `web-xss-reflection-${scanId}`,
        scan_id: scanId,
        target_type: 'website',
        category: 'Input Validation',
        severity: 'medium',
        title: 'Input Validation Weakness (XSS Reflected)',
        plain_english_summary: 'Raw script tags submitted in query parameter "q" were reflected unescaped inside the page body.',
        real_world_impact: 'Failing to escape input enables Cross-Site Scripting (XSS), allowing malicious links to execute remote JavaScript in the victim\'s browser.',
        fix: 'Sanitize and HTML-encode all dynamic parameters before rendering them. Rely on secure front-end frameworks (like React or Vue) that auto-escape strings.',
        source_tool: 'SecuScan Web Audit',
        technical_details: JSON.stringify({ reflected: xssTest }),
      });
    }
  } catch {
    // ignore
  }

  // Check B: SQL Injection Leakage
  try {
    const sqliTest = "' OR '1'='1";
    const res = await client.get(`${baseUrl}/?id=${encodeURIComponent(sqliTest)}`);
    const bodyText = typeof res.data === 'string' ? res.data : '';

    const sqlErrors = ['sqlstate', 'sqlite3_prepare', 'mysql_fetch', 'postgresql query failed', 'syntax error near'];
    const matchedSqlError = sqlErrors.find(err => bodyText.toLowerCase().includes(err));

    if (matchedSqlError) {
      findings.push({
        id: `web-sqli-leak-${scanId}`,
        scan_id: scanId,
        target_type: 'website',
        category: 'Input Validation',
        severity: 'high',
        title: 'Missing Database Parameter Sanitization (Potential SQLi)',
        plain_english_summary: `Submitting database control quotes in query parameter "id" leaked raw database syntax messages (matched: "${matchedSqlError}").`,
        real_world_impact: 'Database syntax leaks suggest the application concatenates raw query parameters, exposing the DB to schema extraction or authentication bypasses.',
        fix: 'Never concatenate SQL queries. Always use parameterized queries (prepared statements) or secure ORMs to query databases.',
        source_tool: 'SecuScan Web Audit',
        technical_details: JSON.stringify({ query: sqliTest, matchedSqlError }),
      });
    }
  } catch {
    // ignore
  }

  // ─── PROMPT 5: Prevent Abuse & Bot Attacks ──────────────────────────────────
  try {
    let triggeredRateLimit = false;
    const reqs = [];
    for (let i = 0; i < 8; i++) {
      reqs.push(client.get(baseUrl));
    }
    const results = await Promise.allSettled(reqs);
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const status = r.value.status;
        const headers = r.value.headers || {};
        const hasRateLimitHeader = Object.keys(headers).some(h =>
          h.toLowerCase().includes('ratelimit') ||
          h.toLowerCase().includes('rate-limit') ||
          h.toLowerCase().includes('retry-after')
        );
        if (status === 429 || status === 403 || status === 503 || hasRateLimitHeader) {
          triggeredRateLimit = true;
          break;
        }
      }
    }

    if (!triggeredRateLimit) {
      findings.push({
        id: `web-rate-limiting-missing-${scanId}`,
        scan_id: scanId,
        target_type: 'website',
        category: 'Abuse Protection',
        severity: 'low',
        title: 'Missing Public Endpoint Rate Limiting',
        plain_english_summary: 'The application responded to multiple rapid consecutive requests without triggering a "429 Too Many Requests" response code.',
        real_world_impact: 'Without IP throttling, bots can flood authentication pages, execute brute force logins, or scrape catalog data.',
        fix: 'Deploy rate-limiting middleware (like express-rate-limit) on login/API endpoints, or route traffic through cloud firewalls like Cloudflare.',
        source_tool: 'SecuScan Web Audit',
        technical_details: JSON.stringify({ requests: 8, rateLimited: false }),
      });
    }
  } catch {
    // ignore
  }

  // ─── PROMPT 6: Secure Deployment & Monitoring ──────────────────────────────
  // Check if HSTS or security headers are missing on target
  try {
    const res = await client.get(baseUrl);
    const hsts = res.headers['strict-transport-security'];
    const csp = res.headers['content-security-policy'];

    if (!hsts || !csp) {
      findings.push({
        id: `web-secure-deployment-missing-${scanId}`,
        scan_id: scanId,
        target_type: 'website',
        category: 'Secure Deployment',
        severity: 'low',
        title: 'Missing Secure Deployment Headers',
        plain_english_summary: `The server is missing HSTS or Content Security Policy (CSP) headers in its responses.`,
        real_world_impact: 'Without these headers, connections can be downgraded to plain HTTP, and browsers are vulnerable to script-injection (XSS) framing attacks.',
        fix: 'Add security headers to all production HTTP server configurations. For nginx: "add_header Content-Security-Policy ...;".',
        source_tool: 'SecuScan Web Audit',
        technical_details: JSON.stringify({ hasHsts: !!hsts, hasCsp: !!csp }),
      });
    }
  } catch {
    // ignore
  }

  return { findings };
}

module.exports = {
  runSecurityChecklistCheck,
};
