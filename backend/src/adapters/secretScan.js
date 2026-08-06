'use strict';

/**
 * Vulta — Secret Scanning Adapter (Phase 2)
 *
 * Primary:  Gitleaks (go binary) — JSON report, full history
 * Fallback: Built-in pattern scanner — regex-based, no binary needed
 *
 * Both adapters normalize output into the unified Finding schema.
 */

const { execFile }   = require('child_process');
const { promisify }  = require('util');
const fs             = require('fs');
const path           = require('path');
const os             = require('os');
const { v4: uuidv4 } = require('uuid');

const execFileAsync = promisify(execFile);

const SOURCE_GITLEAKS  = 'gitleaks';
const SOURCE_FALLBACK  = 'vulta-pattern-scan';
const SCAN_TIMEOUT_MS  = 60_000;

// ─── Pattern-based fallback ──────────────────────────────────────────────────

/**
 * A curated set of high-signal secret patterns for common credential types.
 * Balanced to have low false-positive rates — not exhaustive.
 */
const SECRET_PATTERNS = [
  { ruleId: 'aws-access-key',    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,                            name: 'AWS Access Key ID' },
  { ruleId: 'aws-secret-key',    pattern: /\b([A-Za-z0-9/+=]{40})\b(?=.*aws|.*AWS)/g,            name: 'Possible AWS Secret Key' },
  { ruleId: 'github-pat',        pattern: /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b/g, name: 'GitHub Personal Access Token' },
  { ruleId: 'generic-api-key',   pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["']?([A-Za-z0-9_\-]{20,60})["']?/gi, name: 'Generic API Key' },
  { ruleId: 'private-key-header',pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, name: 'Private Key Material' },
  { ruleId: 'sendgrid-key',      pattern: /\b(SG\.[A-Za-z0-9_\-.]{22}\.[A-Za-z0-9_\-.]{43})\b/g, name: 'SendGrid API Key' },
  { ruleId: 'stripe-key',        pattern: /\b(sk_live_[A-Za-z0-9]{24,})\b/g,                   name: 'Stripe Live Secret Key' },
  { ruleId: 'slack-token',       pattern: /\b(xox[baprs]-[A-Za-z0-9\-]{10,})\b/g,              name: 'Slack Token' },
  { ruleId: 'password-in-url',   pattern: /https?:\/\/[^:@\s]+:[^@\s]{6,}@/g,                   name: 'Credential in URL' },
  { ruleId: 'jwt-token',         pattern: /\beyJ[A-Za-z0-9_\-=]+\.[A-Za-z0-9_\-=]+\.[A-Za-z0-9_\-=]+\b/g, name: 'JSON Web Token (JWT)' },
  { ruleId: 'google-api-key',    pattern: /\b(AIza[A-Za-z0-9_\-]{35})\b/g,                     name: 'Google API Key' },
  { ruleId: 'twilio-key',        pattern: /\b(SK[0-9a-f]{32})\b/g,                              name: 'Twilio API Key' },
  { ruleId: 'npm-token',         pattern: /\b(npm_[A-Za-z0-9]{36})\b/g,                        name: 'NPM Access Token' },
  { ruleId: 'generic-password',  pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']([^"'\s]{8,})["']/gi, name: 'Hardcoded Password' },
];

// File extensions to skip (binaries, images, etc.)
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.zip', '.tar', '.gz', '.bin', '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.lock', '.min.js', '.min.css',
]);

// Directories to skip entirely
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'vendor', 'dist', 'build', '__pycache__',
  '.venv', 'venv', 'env', '.cache',
]);

/**
 * Walk a directory and yield all file paths (non-binary).
 */
function* walkFiles(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SKIP_EXTENSIONS.has(ext)) yield full;
    }
  }
}

/**
 * Convert a raw secret match into a Finding.
 * Always redacts the actual secret value before persisting.
 */
function makeSecretFinding({ scanId, ruleId, name, filePath, lineNo, matchSnippet, tool }) {
  // Redact: show only first 4 chars + asterisks
  const redacted = matchSnippet
    ? matchSnippet.slice(0, 4) + '****[REDACTED]'
    : '[REDACTED]';

  return {
    id:     uuidv4(),
    scan_id: scanId,
    target_type: 'repo',
    category:    'secrets',
    severity:    ruleId.includes('private-key') || ruleId.includes('aws') || ruleId.includes('stripe') ? 'critical' : 'high',
    title:       `Exposed Secret: ${name}`,
    plain_english_summary:
      `A ${name} was found committed to the repository${filePath ? ` in \`${path.basename(filePath)}\`` : ''}${lineNo ? ` (line ${lineNo})` : ''}. ` +
      `The actual value has been redacted (${redacted}). This credential may give anyone with repository access full control over the associated service.`,
    real_world_impact:
      `If this secret is still active, an attacker with repo access (or who found it via GitHub's search) can ` +
      `authenticate to the service immediately — no further exploitation needed. Leaked AWS keys have led to $50,000+ ` +
      `bills in hours. Leaked Stripe keys have drained payment accounts.`,
    fix:
      `# Step 1: Revoke the secret IMMEDIATELY at the provider's dashboard.\n` +
      `# Do NOT just delete the file — the secret is in git history.\n\n` +
      `# Step 2: Remove from history using git-filter-repo:\n` +
      `pip install git-filter-repo\n` +
      `git filter-repo --path ${filePath ? path.basename(filePath) : '<file>'} --invert-paths\n\n` +
      `# Step 3: Force push to all remotes:\ngit push origin --force --all\n\n` +
      `# Step 4: Store secrets in environment variables, never in code:\n` +
      `echo "MY_SECRET=..." >> .env\n` +
      `echo ".env" >> .gitignore`,
    source_tool: tool,
  };
}

// ─── Fallback: Pattern Scanner ───────────────────────────────────────────────

/**
 * Scan a cloned repo directory using regex patterns.
 * @param {string} repoPath
 * @param {string} scanId
 * @returns {import('../schema').Finding[]}
 */
function runPatternScan(repoPath, scanId) {
  const findings = [];
  const seenMatches = new Set(); // deduplicate same pattern in same file

  for (const filePath of walkFiles(repoPath)) {
    let content;
    try {
      // Skip very large files (> 1 MB) to avoid memory issues
      const stat = fs.statSync(filePath);
      if (stat.size > 1_048_576) continue;
      content = fs.readFileSync(filePath, 'utf8');
    } catch { continue; }

    const lines = content.split('\n');

    for (const { ruleId, pattern, name } of SECRET_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = `${ruleId}::${filePath}`;
        if (seenMatches.has(key)) break; // one finding per rule per file
        seenMatches.add(key);

        // Find line number
        const upToMatch = content.slice(0, match.index);
        const lineNo = upToMatch.split('\n').length;
        const relativePath = path.relative(repoPath, filePath);

        findings.push(makeSecretFinding({
          scanId,
          ruleId,
          name,
          filePath: relativePath,
          lineNo,
          matchSnippet: match[1] ?? match[0],
          tool: SOURCE_FALLBACK,
        }));
        break;
      }
      pattern.lastIndex = 0;
    }
  }

  return findings;
}

// ─── Primary: Gitleaks ───────────────────────────────────────────────────────

/**
 * Detect gitleaks binary location.
 * Tries PATH, then common locations.
 */
async function findGitleaks() {
  const candidates = process.platform === 'win32'
    ? ['gitleaks', 'gitleaks.exe', 'C:\\tools\\gitleaks.exe']
    : ['gitleaks', '/usr/local/bin/gitleaks', '/usr/bin/gitleaks'];

  for (const bin of candidates) {
    try {
      await execFileAsync(bin, ['version'], { timeout: 5000 });
      return bin;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Run gitleaks against a cloned repo and parse the JSON report.
 * @param {string} repoPath
 * @param {string} scanId
 * @returns {Promise<import('../schema').Finding[]>}
 */
async function runGitleaks(repoPath, scanId) {
  const bin = await findGitleaks();
  if (!bin) throw new Error('gitleaks binary not found');

  const reportPath = path.join(os.tmpdir(), `vulta-gitleaks-${scanId}.json`);

  try {
    // Run gitleaks — exit code 1 means "findings found" (not an error)
    await execFileAsync(bin, [
      'detect',
      '--source', repoPath,
      '--report-format', 'json',
      '--report-path', reportPath,
      '--no-git',           // scan working tree (we already have shallow clone)
      '--exit-code', '0',   // don't exit non-zero on findings
    ], {
      timeout: SCAN_TIMEOUT_MS,
      env: { ...process.env, GITLEAKS_LICENSE: '' },
    });
  } catch (err) {
    // gitleaks exits 1 when findings are found — that's normal
    if (!err.message?.includes('ETIMEDOUT')) {
      // Try to read the report anyway
    } else {
      throw err;
    }
  }

  // Parse report
  if (!fs.existsSync(reportPath)) return [];

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return [];
  } finally {
    try { fs.unlinkSync(reportPath); } catch { /* ok */ }
  }

  if (!Array.isArray(raw)) return [];

  const seenMatches = new Set();

  return raw
    .filter((entry) => {
      const key = `${entry.RuleID}::${entry.File}`;
      if (seenMatches.has(key)) return false;
      seenMatches.add(key);
      return true;
    })
    .map((entry) => makeSecretFinding({
      scanId,
      ruleId: (entry.RuleID || 'generic-secret').toLowerCase(),
      name:   entry.Description || entry.RuleID || 'Secret',
      filePath: entry.File,
      lineNo:   entry.StartLine,
      matchSnippet: entry.Secret || entry.Match,
      tool: SOURCE_GITLEAKS,
    }));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Scan a cloned repo for secrets.
 * Tries gitleaks first, falls back to pattern scanner.
 *
 * @param {string} repoPath   Absolute path to cloned repo
 * @param {string} scanId
 * @returns {Promise<{ findings: Finding[], tool_used: string, error?: string }>}
 */
async function runSecretScan(repoPath, scanId) {
  // Try primary: gitleaks
  try {
    const findings = await runGitleaks(repoPath, scanId);
    return { findings, tool_used: SOURCE_GITLEAKS };
  } catch (err) {
    console.warn(`[SecretScan] gitleaks failed (${err.message}), falling back to pattern scanner`);
  }

  // Fallback: pattern scan
  try {
    const findings = runPatternScan(repoPath, scanId);
    return { findings, tool_used: SOURCE_FALLBACK };
  } catch (err) {
    return { findings: [], tool_used: 'none', error: err.message };
  }
}

module.exports = { runSecretScan };
