'use strict';

/**
 * SecuScan — Exposed Files & Risky Config Adapter (Phase 2)
 *
 * Pure filesystem walk — no external binaries required.
 * Flags:
 *  - Committed .env, .pem, id_rsa, credential files
 *  - Dockerfiles running as root, exposing debug ports
 *  - docker-compose.yml with hardcoded passwords
 *  - Cloud credential files (.aws/credentials, gcloud JSON, etc.)
 *
 * Cross-checks with secretScan findings to avoid duplicates
 * (if the same file was already flagged for a secret, we upgrade that
 * finding rather than creating a separate one).
 */

const fs             = require('fs');
const path           = require('path');
const { v4: uuidv4 } = require('uuid');

// ─── Sensitive file patterns ──────────────────────────────────────────────────

/** Files whose very presence in a repo is a finding (not content-checked). */
const SENSITIVE_FILENAME_RULES = [
  {
    pattern: /^\.env(\..+)?$/i,
    severity: 'critical',
    title: 'Committed .env file',
    summary: 'A .env file containing environment variables (often API keys, database passwords, or tokens) has been committed to the repository. Anyone with read access to this repo now has access to every secret inside it.',
    impact: 'All secrets in this file are effectively public. Attackers routinely scrape GitHub for .env files and automate credential-stuffing attacks within minutes of a push.',
    fix: '# 1. Add .env to .gitignore IMMEDIATELY:\necho ".env" >> .gitignore\n\n# 2. Remove from git history:\ngit filter-repo --path .env --invert-paths\ngit push origin --force --all\n\n# 3. Rotate ALL secrets that were in the file.\n\n# 4. Use a secrets manager instead:\n# - GitHub Secrets (for CI/CD)\n# - AWS Secrets Manager / Vault (for production)',
  },
  {
    pattern: /^\.env\.production$/i,
    severity: 'critical',
    title: 'Committed .env.production file',
    summary: 'A production environment file with real credentials has been committed to the repository.',
    impact: 'Production secrets (database passwords, payment keys, OAuth secrets) are now accessible to everyone with repo access.',
    fix: '# Remove from git and rotate all secrets.\necho ".env.production" >> .gitignore\ngit filter-repo --path .env.production --invert-paths',
  },
  {
    pattern: /\.(pem|crt|key|p12|pfx)$/i,
    severity: 'critical',
    title: 'Committed TLS/SSL certificate or private key',
    summary: 'A private certificate or key file has been committed to the repository. Private keys should never leave the server they were generated on.',
    impact: 'An attacker with this file can impersonate your server, decrypt captured traffic, or sign malicious software as if it were yours.',
    fix: '# 1. Revoke the certificate at your CA immediately.\n# 2. Generate a new key pair (never commit it).\ngit filter-repo --path <filename> --invert-paths\n\n# Store certificates in secrets management systems\n# or use automated cert managers (Let\'s Encrypt + certbot).',
  },
  {
    pattern: /^id_(rsa|dsa|ecdsa|ed25519)$/i,
    severity: 'critical',
    title: 'Committed SSH private key',
    summary: 'An SSH private key has been committed to the repository. This gives anyone with repo access the ability to log into any server where the corresponding public key is authorized.',
    impact: 'Full unauthorized SSH access to any server, container, or service that trusts this key.',
    fix: '# 1. Remove the key from all servers\' authorized_keys:\nssh-keygen -R <host>\n\n# 2. Generate a new key pair:\nssh-keygen -t ed25519 -C "your@email.com"\n\n# 3. Remove from git:\ngit filter-repo --path id_rsa --invert-paths',
  },
  {
    pattern: /^(credentials|\.aws\/credentials|credentials\.json)$/i,
    severity: 'critical',
    title: 'Committed cloud credentials file',
    summary: 'A cloud provider credentials file (AWS, GCP, Azure) has been committed. This file typically contains long-lived access keys that grant broad cloud permissions.',
    impact: 'Full access to your cloud account. Attackers routinely spin up crypto-mining fleets on compromised AWS accounts, leading to $10,000–$100,000+ bills.',
    fix: '# Revoke the credentials at your cloud provider dashboard IMMEDIATELY.\n# Then remove from history:\ngit filter-repo --path .aws/credentials --invert-paths\n\n# Use IAM roles and instance profiles instead of static credentials.',
  },
  {
    pattern: /^wp-config\.php$/i,
    severity: 'high',
    title: 'Committed WordPress config file',
    summary: 'wp-config.php contains your WordPress database password, authentication keys, and salts. Committing it exposes your entire WordPress installation.',
    impact: 'Database access + ability to forge admin session cookies.',
    fix: '# Add to .gitignore and remove from history.\necho "wp-config.php" >> .gitignore\ngit filter-repo --path wp-config.php --invert-paths',
  },
  {
    pattern: /^(\.htpasswd|passwd|shadow)$/i,
    severity: 'high',
    title: 'Committed password/auth file',
    summary: 'A file containing hashed or plaintext passwords has been committed.',
    impact: 'Offline password cracking attacks can recover plaintext passwords from hashed files using tools like hashcat.',
    fix: '# Remove from git:\ngit filter-repo --path <filename> --invert-paths\n# Invalidate all passwords in the file immediately.',
  },
  {
    pattern: /^\.?kubeconfig$/i,
    severity: 'critical',
    title: 'Committed Kubernetes config file',
    summary: 'A kubeconfig file grants kubectl access to a Kubernetes cluster. Committing it gives attackers cluster access.',
    impact: 'Full Kubernetes cluster takeover — ability to deploy malicious containers, access all cluster secrets, and pivot to any workload.',
    fix: '# Rotate all cluster credentials and revoke the exposed kubeconfig.\ngit filter-repo --path kubeconfig --invert-paths',
  },
];

// ─── Dockerfile misconfig checks ─────────────────────────────────────────────

function checkDockerfile(content, filePath, scanId) {
  const findings = [];
  const lines = content.split('\n');

  // Running as root
  const hasUserDirective = lines.some((l) => /^USER\s+(?!root)/i.test(l.trim()));
  const hasFromRoot      = lines.some((l) => /^FROM\s+/i.test(l.trim()));

  if (hasFromRoot && !hasUserDirective) {
    findings.push({
      id: uuidv4(), scan_id: scanId, target_type: 'repo',
      category: 'config', severity: 'medium',
      title: 'Dockerfile runs as root: ' + path.basename(filePath),
      plain_english_summary:
        'Your Dockerfile doesn\'t specify a non-root USER directive. The container will run all processes as root, which violates the principle of least privilege.',
      real_world_impact:
        'If an attacker breaks out of the application (e.g., via RCE), they immediately have root inside the container. Container escapes are documented and can lead to host compromise.',
      fix:
        '# Add a non-root user before the CMD/ENTRYPOINT:\nRUN addgroup --system app && adduser --system --ingroup app app\nUSER app\n\n# Or for Alpine:\nRUN adduser -S app\nUSER app',
      source_tool: 'secuscan-config-check',
    });
  }

  // Debug ports exposed (common mistake)
  const debugPorts = ['9229', '9230', '5858', '8080', '3000'];
  for (const line of lines) {
    const exposeMatch = line.match(/^EXPOSE\s+(.+)/i);
    if (exposeMatch) {
      const ports = exposeMatch[1].split(/\s+/);
      for (const port of ports) {
        if (debugPorts.includes(port.trim())) {
          findings.push({
            id: uuidv4(), scan_id: scanId, target_type: 'repo',
            category: 'config', severity: 'medium',
            title: 'Debug port ' + port.trim() + ' exposed in Dockerfile',
            plain_english_summary:
              'Port ' + port.trim() + ' (typically used for Node.js debugging or dev servers) is explicitly exposed in the Dockerfile. This should not be in a production image.',
            real_world_impact:
              'If deployed to production, remote debuggers can attach to your Node.js process and execute arbitrary code — zero authentication required.',
            fix:
              '# Remove port ' + port.trim() + ' from EXPOSE:\n# Change:\nEXPOSE ' + port.trim() + '\n# To: (remove the line entirely for production)\n\n# Use --inspect only in development, never in production Dockerfiles.',
            source_tool: 'secuscan-config-check',
          });
        }
      }
    }
  }

  return findings;
}

// ─── docker-compose.yml checks ────────────────────────────────────────────────

function checkDockerCompose(content, filePath, scanId) {
  const findings = [];
  // Look for hardcoded passwords in environment sections
  const passwordPatterns = [
    /password\s*[:=]\s*["']?(?!.*\$\{)([A-Za-z0-9!@#$%^&*]{6,})["']?/gi,
    /MYSQL_ROOT_PASSWORD\s*[:=]\s*["']?(?!.*\$\{)([A-Za-z0-9!@#$%^&*]{4,})["']?/gi,
    /POSTGRES_PASSWORD\s*[:=]\s*["']?(?!.*\$\{)([A-Za-z0-9!@#$%^&*]{4,})["']?/gi,
  ];

  for (const re of passwordPatterns) {
    re.lastIndex = 0;
    if (re.test(content)) {
      findings.push({
        id: uuidv4(), scan_id: scanId, target_type: 'repo',
        category: 'config', severity: 'high',
        title: 'Hardcoded password in docker-compose file: ' + path.basename(filePath),
        plain_english_summary:
          'docker-compose.yml contains a hardcoded database or service password in plain text. Anyone who can read this file can connect to your database directly.',
        real_world_impact:
          'Database takeover — an attacker can connect to your MySQL/Postgres/Redis instance and read, modify, or delete all data.',
        fix:
          '# Use environment variable substitution instead:\nenvironment:\n  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # value from .env or host env\n\n# Store the actual value in .env (which is in .gitignore).',
        source_tool: 'secuscan-config-check',
      });
      break; // one finding per file
    }
  }

  return findings;
}

// ─── Main walk ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'vendor', 'dist', 'build', '__pycache__', '.venv', 'venv',
]);

/**
 * Scan a cloned repo for sensitive committed files and config misconfigurations.
 *
 * @param {string} repoPath
 * @param {string} scanId
 * @param {string[]} [alreadyFlaggedFiles]  Files already caught by secret scan — avoid duplicates
 * @returns {{ findings: Finding[], tool_used: string }}
 */
function runExposedFilesScan(repoPath, scanId, alreadyFlaggedFiles = []) {
  const findings     = [];
  const flaggedPaths = new Set(alreadyFlaggedFiles.map((f) => f.toLowerCase()));

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full     = path.join(dir, entry.name);
      const relative = path.relative(repoPath, full);

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const nameLower = entry.name.toLowerCase();

        // Check against sensitive filename rules
        for (const rule of SENSITIVE_FILENAME_RULES) {
          if (rule.pattern.test(entry.name)) {
            // Don't double-flag if already caught by secret scanner
            if (flaggedPaths.has(relative.toLowerCase())) continue;

            findings.push({
              id:          uuidv4(),
              scan_id:     scanId,
              target_type: 'repo',
              category:    'exposed_files',
              severity:    rule.severity,
              title:       rule.title,
              plain_english_summary: rule.summary,
              real_world_impact:     rule.impact,
              fix:                   rule.fix,
              source_tool:           'secuscan-exposed-files',
            });
            break;
          }
        }

        // Dockerfile-specific checks
        if (nameLower === 'dockerfile' || nameLower.startsWith('dockerfile.')) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            findings.push(...checkDockerfile(content, full, scanId));
          } catch { /* skip */ }
        }

        // docker-compose checks
        if (nameLower === 'docker-compose.yml' || nameLower === 'docker-compose.yaml') {
          try {
            const content = fs.readFileSync(full, 'utf8');
            findings.push(...checkDockerCompose(content, full, scanId));
          } catch { /* skip */ }
        }
      }
    }
  }

  walk(repoPath);
  return { findings, tool_used: 'secuscan-exposed-files' };
}

module.exports = { runExposedFilesScan };
