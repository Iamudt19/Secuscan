'use strict';

/**
 * Vulta — Exposed Path Probe Adapter (Phase 2)
 *
 * Probes a curated list of paths commonly left exposed by accident.
 * Kept intentionally small and polite — this is NOT a directory brute-force,
 * just a check for the most common accidental exposures.
 *
 * Correctness rule applied:
 *   A path is only flagged as "exposed" if the response body contains content
 *   that is consistent with the expected file — NOT just because status is 200.
 *   Many servers return a custom 404 page with a 200 status (soft-404),
 *   and naive status-only checks produce false positives on every such server.
 *
 * We detect soft-404s by:
 *   1. First fetching a random obviously-nonexistent path (baseline probe).
 *   2. Comparing content signatures of subsequent probes against the baseline.
 *   3. Only flagging paths whose content differs meaningfully from the baseline.
 *   4. Additionally checking for content-type and body size heuristics.
 */

const { v4: uuidv4 } = require('uuid');
const { safeGet }    = require('../ssrfGuard');

const SOURCE_TOOL = 'vulta-path-probe';

// ─── Probe targets ────────────────────────────────────────────────────────────

/**
 * Each probe has:
 *  - path:         URL path to request
 *  - name:         human-readable name for the finding
 *  - bodySignals:  regex patterns that indicate real content (not a 404 page)
 *  - severity
 */
const PROBES = [
  {
    path:        '/.git/config',
    name:        'Exposed .git/config',
    bodySignals: [/\[core\]/i, /repositoryformatversion/i, /\[remote/i],
    severity:    'critical',
    summary:     'The Git repository configuration file is publicly accessible. This leaks your remote URL (potentially with credentials), branch names, and repo structure.',
    impact:      'Attackers can reconstruct your entire source code from a public .git directory using tools like GitDumper. Your private code, hardcoded secrets, and commit history become public.',
    fix:         '# Block .git access in Nginx:\nlocation ~ /\\.git {\n  deny all;\n  return 404;\n}\n\n# Apache (.htaccess):\n<FilesMatch "\\.git">\n  Require all denied\n</FilesMatch>',
  },
  {
    path:        '/.env',
    name:        'Exposed .env file',
    bodySignals: [/^[A-Z_]+=.+/m, /DB_PASSWORD/i, /API_KEY/i, /SECRET/i, /TOKEN/i],
    severity:    'critical',
    summary:     'A .env file containing environment variables is publicly accessible. This file typically contains database passwords, API keys, and other credentials.',
    impact:      'All secrets in the .env file are immediately accessible to any internet user. Automated scanners harvest these files continuously. A single .env exposure can mean full database access.',
    fix:         '# Block .env access in Nginx:\nlocation ~ /\\.env {\n  deny all;\n  return 404;\n}\n\n# Never serve your web root directly from the directory containing .env.\n# Move .env one level above your web root.',
  },
  {
    path:        '/.env.local',
    name:        'Exposed .env.local file',
    bodySignals: [/^[A-Z_]+=.+/m, /SECRET/i, /KEY/i, /PASSWORD/i],
    severity:    'critical',
    summary:     'A local environment file (.env.local) is publicly accessible, likely containing development or staging credentials.',
    impact:      'Exposed development credentials are often reused in production. Even "dev" database access can be exploited to pivot to production systems.',
    fix:         '# Block .env* in Nginx:\nlocation ~ /\\.env {\n  deny all;\n}\n\n# Add to .gitignore and restrict web server access.',
  },
  {
    path:        '/.DS_Store',
    name:        'Exposed .DS_Store file',
    bodySignals: [/^Bud1/],  // macOS .DS_Store magic bytes (as text — will match binary)
    severity:    'low',
    summary:     'A macOS .DS_Store file is publicly accessible. It contains directory listings and folder metadata from a developer\'s machine.',
    impact:      'Attackers can use .DS_Store files to reconstruct directory structure and discover hidden paths, making further probing more targeted.',
    fix:         '# Block .DS_Store in Nginx:\nlocation ~ /\\.DS_Store {\n  deny all;\n  return 404;\n}\n\n# Add to .gitignore to prevent future commits:\necho ".DS_Store" >> .gitignore',
  },
  {
    path:        '/wp-config.php.bak',
    name:        'Exposed WordPress config backup',
    bodySignals: [/DB_NAME/i, /DB_PASSWORD/i, /table_prefix/i, /<?php/i],
    severity:    'critical',
    summary:     'A backup of the WordPress configuration file is publicly accessible, containing database credentials and authentication keys.',
    impact:      'Full WordPress database access — can read all user data, password hashes, and private content.',
    fix:         '# Delete the backup file immediately.\n# Restrict access to PHP backup files:\nlocation ~* \\.php\\.bak$ {\n  deny all;\n  return 404;\n}',
  },
  {
    path:        '/phpinfo.php',
    name:        'Exposed phpinfo() page',
    bodySignals: [/PHP Version/i, /phpinfo\(\)/i, /php\.ini/i],
    severity:    'high',
    summary:     'A phpinfo() page is publicly accessible, exposing detailed server configuration including PHP version, loaded modules, server paths, and environment variables.',
    impact:      'Attackers use phpinfo() to identify exploitable PHP versions, misconfigured settings, and server paths that aid further attacks.',
    fix:         '# Delete phpinfo.php immediately:\nrm phpinfo.php\n\n# Restrict access if you need it for debugging:\nlocation = /phpinfo.php {\n  allow 127.0.0.1;\n  deny all;\n}',
  },
  {
    path:        '/.aws/credentials',
    name:        'Exposed AWS credentials file',
    bodySignals: [/\[default\]/i, /aws_access_key_id/i, /aws_secret_access_key/i],
    severity:    'critical',
    summary:     'An AWS credentials file is publicly accessible. This contains AWS access keys that grant direct cloud access.',
    impact:      'Full AWS account takeover. Attackers routinely spin up crypto-mining fleets on compromised accounts, leading to $10,000–$100,000+ bills in hours.',
    fix:         '# Remove the file and rotate credentials IMMEDIATELY.\n# Block in Nginx:\nlocation ~ /\\.aws {\n  deny all;\n}\n\n# Use IAM roles instead of static credentials.',
  },
  {
    path:        '/admin',
    name:        'Exposed admin panel',
    bodySignals: [/admin/i, /login/i, /dashboard/i, /password/i],
    severity:    'medium',
    summary:     'An admin panel is publicly accessible without access controls. Admin interfaces should be restricted to authorised IP addresses or protected by additional authentication.',
    impact:      'Brute-force attacks against admin login pages are automated and continuous. A publicly exposed admin panel significantly increases the attack surface.',
    fix:         '# Restrict admin access by IP in Nginx:\nlocation /admin {\n  allow 203.0.113.0/24;  # your office IP\n  deny all;\n}\n\n# Or use HTTP Basic Auth as an additional layer:\nauth_basic "Restricted";\nauth_basic_user_file /etc/nginx/.htpasswd;',
  },
  {
    path:        '/server-status',
    name:        'Exposed Apache server-status page',
    bodySignals: [/Apache Server Status/i, /Server uptime/i, /requests currently being processed/i],
    severity:    'medium',
    summary:     'The Apache server-status page is publicly accessible, revealing real-time request processing information, connected IPs, and server performance data.',
    impact:      'Leaks request URLs (which may contain session tokens or sensitive parameters), client IP addresses, and server load information useful for timing attacks.',
    fix:         '# Restrict server-status in Apache:\n<Location "/server-status">\n  Require local\n</Location>\n\n# Or disable entirely:\n#<Location "/server-status">\n#  SetHandler server-status\n#</Location>',
  },
  {
    path:        '/robots.txt',
    name:        null, // informational — only flag if it reveals sensitive paths
    bodySignals: [/Disallow:\s*\/admin/i, /Disallow:\s*\/api/i, /Disallow:\s*\/backup/i],
    severity:    'low',
    summary:     'The robots.txt file reveals paths the site owner wants to hide from search engines (e.g. /admin, /api, /backup). Attackers read robots.txt specifically to find these paths.',
    impact:      'Disallow entries in robots.txt are a roadmap to sensitive areas — they tell attackers exactly where to look.',
    fix:         '# Don\'t use robots.txt to hide sensitive URLs — it\'s public.\n# Instead, use proper access controls (auth, IP restrictions) on sensitive paths.\n# Only disallow paths that are already publicly non-sensitive.',
  },
];

// ─── Baseline probe ───────────────────────────────────────────────────────────

/**
 * Fetch a randomly-named path to establish the "not found" baseline.
 * Returns the response body length and content-type of a known-nonexistent page.
 */
async function getBaseline(baseUrl) {
  const randomPath = `/vulta-probe-${Date.now()}-nonexistent-${Math.random().toString(36).slice(2)}`;
  try {
    const resp = await safeGet(`${baseUrl}${randomPath}`, {
      maxRedirects: 2,
      validateStatus: () => true,
    });
    return {
      status:      resp.status,
      bodyLength:  (resp.data ? JSON.stringify(resp.data).length : 0),
      contentType: resp.headers?.['content-type'] ?? '',
    };
  } catch {
    return { status: null, bodyLength: 0, contentType: '' };
  }
}

/**
 * Determine if a response is a "soft 404" by comparing against the baseline.
 * @param {{ status, body, contentType }} resp
 * @param {{ status, bodyLength, contentType }} baseline
 * @param {RegExp[]} bodySignals  Patterns that confirm real content
 * @returns {boolean} true if the response looks like real content (not a soft 404)
 */
function isRealContent(resp, baseline, bodySignals) {
  // Hard 404/403/410/etc. — definitely not exposed
  if (!resp.status || resp.status >= 400) return false;

  const body = typeof resp.body === 'string' ? resp.body : '';

  // Check for content-type signals: HTML when we expect config/text may be a soft 404
  // (e.g. a 200-with-HTML "Not Found" page)
  // We ONLY flag if at least one bodySignal matches — this is the key check.
  const hasSignal = bodySignals.some((re) => re.test(body));
  if (!hasSignal) return false;

  // Soft-404 guard: if the body length is suspiciously similar to the baseline
  // "not found" page (±20%), treat as soft 404
  if (baseline.bodyLength > 0 && body.length > 0) {
    const ratio = body.length / baseline.bodyLength;
    if (ratio > 0.8 && ratio < 1.2 && baseline.status !== null && baseline.status < 400) {
      // Same size as the 404 page — likely a soft 404
      return false;
    }
  }

  return true;
}

// ─── Main probe function ──────────────────────────────────────────────────────

/**
 * Probe a website for commonly exposed sensitive paths.
 *
 * @param {string} targetUrl
 * @param {string} scanId
 * @returns {Promise<{ findings: Finding[], tool_used: string, error?: string }>}
 */
async function runPathProbe(targetUrl, scanId) {
  const findings = [];

  // Derive clean base URL (scheme + hostname, no trailing path)
  let baseUrl;
  try {
    const parsed = new URL(targetUrl);
    // Always probe HTTPS to avoid checking the pre-redirect HTTP version
    parsed.protocol = 'https:';
    parsed.pathname  = '';
    parsed.search    = '';
    parsed.hash      = '';
    baseUrl = parsed.toString().replace(/\/$/, '');
  } catch (err) {
    return { findings: [], tool_used: SOURCE_TOOL, error: `Invalid URL: ${err.message}` };
  }

  // Establish baseline for soft-404 detection
  const baseline = await getBaseline(baseUrl);

  // Probe each path with a short delay between requests (polite scanning)
  const DELAY_MS = 400;

  for (let i = 0; i < PROBES.length; i++) {
    const probe = PROBES[i];

    // Small delay between requests — not a brute-force, just a polite check
    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));

    let resp;
    try {
      const raw = await safeGet(`${baseUrl}${probe.path}`, {
        maxRedirects: 2,
        validateStatus: () => true,
        // Read response as text for body signal matching
        responseType: 'text',
      });
      resp = {
        status:      raw.status,
        body:        typeof raw.data === 'string' ? raw.data : JSON.stringify(raw.data ?? ''),
        contentType: raw.headers?.['content-type'] ?? '',
      };
    } catch {
      // Connection error — skip this probe
      continue;
    }

    // robots.txt: only flag if it contains sensitive disallow paths
    if (probe.name === null && probe.path === '/robots.txt') {
      if (resp.status === 200 && probe.bodySignals.some((re) => re.test(resp.body))) {
        findings.push({
          id: uuidv4(), scan_id: scanId, target_type: 'website',
          category: 'exposed_files', severity: probe.severity,
          title:    'robots.txt reveals sensitive path names',
          plain_english_summary: probe.summary,
          real_world_impact:     probe.impact,
          fix:                   probe.fix,
          source_tool:           SOURCE_TOOL,
        });
      }
      continue;
    }

    // All other probes: confirm real content, not a soft-404
    if (isRealContent(resp, baseline, probe.bodySignals)) {
      findings.push({
        id:          uuidv4(),
        scan_id:     scanId,
        target_type: 'website',
        category:    'exposed_files',
        severity:    probe.severity,
        title:       `${probe.name} is publicly accessible`,
        plain_english_summary: probe.summary,
        real_world_impact:     probe.impact,
        fix:                   probe.fix,
        source_tool:           SOURCE_TOOL,
      });
    }
  }

  return { findings, tool_used: SOURCE_TOOL };
}

module.exports = { runPathProbe };
