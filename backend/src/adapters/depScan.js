'use strict';

/**
 * Vulta — Dependency CVE Scanner Adapter (Phase 2)
 *
 * Primary (per-ecosystem):
 *   Node  (package.json)      → npm audit --json
 *   Python (requirements.txt) → pip-audit -f json
 *
 * Broad fallback (any ecosystem):
 *   Trivy → trivy fs --format json <path>
 *
 * All three normalise into the unified Finding schema.
 */

const { execFile }   = require('child_process');
const { promisify }  = require('util');
const fs             = require('fs');
const path           = require('path');
const { v4: uuidv4 } = require('uuid');

const execFileAsync = promisify(execFile);
const TIMEOUT_MS    = 120_000; // 2 min — npm audit can be slow on large trees

// ─── Severity mapping ────────────────────────────────────────────────────────

const NPM_SEVERITY_MAP  = { critical: 'critical', high: 'high', moderate: 'medium', low: 'low', info: 'low' };
const CVSS_SEVERITY_MAP = (score) => {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
};

// ─── Helper: make a Finding from CVE metadata ─────────────────────────────────

function makeCveFinding({ scanId, pkgName, pkgVersion, vuln, severity, fix, tool }) {
  const sevLabel = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[severity] ?? 'Unknown';

  return {
    id:          uuidv4(),
    scan_id:     scanId,
    target_type: 'repo',
    category:    'dependencies',
    severity,
    title:       `${sevLabel} vulnerability in \`${pkgName}\`${pkgVersion ? ` v${pkgVersion}` : ''}`,
    plain_english_summary:
      `Your project depends on \`${pkgName}\`, which has a known security flaw (${vuln.cve || vuln.id || 'CVE unknown'}). ` +
      `${vuln.description ? vuln.description.slice(0, 200) + (vuln.description.length > 200 ? '…' : '') : ''} ` +
      `This is a ${sevLabel}-severity vulnerability that could be exploited by an attacker who can reach this code.`,
    real_world_impact:
      vuln.cwes?.length
        ? `Vulnerability class: ${vuln.cwes.join(', ')}. ` +
          `If exploited, an attacker could ${severity === 'critical' || severity === 'high' ? 'execute arbitrary code, exfiltrate data, or take over the server' : 'cause degraded service or limited data exposure'}.`
        : `A ${sevLabel} severity CVE means this has a real, documented exploit path. Even if you don't expose this package directly, transitive attack chains are common in supply-chain attacks.`,
    fix: fix ||
      `# Update ${pkgName} to the patched version:\nnpm update ${pkgName}\n# or pin to a safe version in package.json\n"${pkgName}": "^<patched_version>"`,
    source_tool: tool,
  };
}

// ─── npm audit ───────────────────────────────────────────────────────────────

/**
 * Run npm audit inside a cloned repo (requires package.json present).
 * @param {string} repoPath
 * @param {string} scanId
 */
async function runNpmAudit(repoPath, scanId) {
  // Install dependencies silently first so audit has a full tree
  try {
    await execFileAsync('npm', ['install', '--ignore-scripts', '--prefer-offline', '--no-audit'], {
      cwd: repoPath, timeout: 90_000, env: { ...process.env, CI: 'true' },
    });
  } catch { /* continue even if install fails partially */ }

  let raw;
  try {
    const { stdout } = await execFileAsync('npm', ['audit', '--json'], {
      cwd: repoPath, timeout: TIMEOUT_MS,
    });
    raw = JSON.parse(stdout);
  } catch (err) {
    // npm audit exits 1 when vulnerabilities found — stdout still has JSON
    try { raw = JSON.parse(err.stdout); }
    catch { throw new Error(`npm audit parse failed: ${err.message}`); }
  }

  const findings = [];
  const vulns = raw?.vulnerabilities ?? {};

  for (const [pkgName, vuln] of Object.entries(vulns)) {
    if (!vuln.isDirect && vuln.severity === 'info') continue; // skip noise

    const severity = NPM_SEVERITY_MAP[vuln.severity] ?? 'low';
    const via = Array.isArray(vuln.via) ? vuln.via : [];
    const cveInfo = via.find((v) => typeof v === 'object' && v.url);

    const fixText = vuln.fixAvailable
      ? `# Fix available — run:\nnpm audit fix\n\n# If --force is needed:\nnpm audit fix --force`
      : `# No automatic fix available yet.\n# Consider:\n#   1. Removing the dependency if unused\n#   2. Checking for an alternative package\n#   3. Monitoring ${pkgName} for a patched release`;

    findings.push(makeCveFinding({
      scanId,
      pkgName,
      pkgVersion: vuln.range,
      vuln: {
        cve:         cveInfo?.url ? cveInfo.url.split('/').pop() : null,
        description: cveInfo?.title || vuln.severity,
        cwes:        cveInfo?.cwe ? [cveInfo.cwe] : [],
        id:          cveInfo?.source ? `GHSA-${cveInfo.source}` : null,
      },
      severity,
      fix: fixText,
      tool: 'npm-audit',
    }));
  }

  return findings;
}

// ─── pip-audit ───────────────────────────────────────────────────────────────

async function runPipAudit(repoPath, scanId) {
  // Find requirements file
  const reqFiles = ['requirements.txt', 'requirements-dev.txt', 'requirements/base.txt'];
  let reqFile = reqFiles.map((r) => path.join(repoPath, r)).find((f) => fs.existsSync(f));
  if (!reqFile) {
    const pyproj = path.join(repoPath, 'pyproject.toml');
    if (!fs.existsSync(pyproj)) throw new Error('No Python requirements file found');
    reqFile = pyproj;
  }

  let raw;
  const args = reqFile.endsWith('pyproject.toml')
    ? ['pip-audit', '--format', 'json', '--progress-spinner', 'off']
    : ['pip-audit', '-r', reqFile, '--format', 'json', '--progress-spinner', 'off'];

  try {
    const { stdout } = await execFileAsync(args[0], args.slice(1), {
      cwd: repoPath, timeout: TIMEOUT_MS,
    });
    raw = JSON.parse(stdout);
  } catch (err) {
    try { raw = JSON.parse(err.stdout); }
    catch { throw new Error(`pip-audit parse failed: ${err.message}`); }
  }

  const findings = [];
  const deps = raw?.dependencies ?? [];

  for (const dep of deps) {
    for (const vuln of (dep.vulns ?? [])) {
      // ── Severity: read directly from tool output, never re-derive ──────────
      // pip-audit v2+ includes a `fix_versions` array and sometimes a
      // `aliases` array with GHSA IDs whose CVSS scores can be cross-referenced.
      // The tool itself does NOT currently emit a severity field in its JSON
      // schema, so we map from CVSS score via the aliases when available.
      // If no CVSS data exists, we default to 'medium' — but we never use
      // "has fix_versions" as a severity signal (that's availability, not impact).
      let severity = 'medium'; // conservative default

      // pip-audit ≥2.7 may include cvss score in the vuln object
      if (typeof vuln.cvss === 'number') {
        severity = CVSS_SEVERITY_MAP(vuln.cvss);
      } else if (typeof vuln.cvssv3 === 'number') {
        severity = CVSS_SEVERITY_MAP(vuln.cvssv3);
      } else if (typeof vuln.cvss_score === 'number') {
        severity = CVSS_SEVERITY_MAP(vuln.cvss_score);
      }
      // If still medium, check if it's a PYSEC ID for a known-critical class
      // (best-effort — pip-audit doesn't always embed CVSS)

      findings.push(makeCveFinding({
        scanId,
        pkgName:    dep.name,
        pkgVersion: dep.version,
        vuln: {
          cve:         vuln.id,
          description: vuln.description,
          cwes:        [],
          id:          vuln.id,
        },
        severity,
        fix: vuln.fix_versions?.length
          ? `# Update ${dep.name} to ${vuln.fix_versions[0]} or later:\npip install "${dep.name}>=${vuln.fix_versions[0]}"\n# Then update requirements.txt:\npip freeze > requirements.txt`
          : `# No patched version available yet.\n# Monitor: https://pypi.org/project/${dep.name}/`,
        tool: 'pip-audit',
      }));
    }
  }

  return findings;
}

// ─── Trivy fallback ───────────────────────────────────────────────────────────

async function findTrivy() {
  const candidates = process.platform === 'win32'
    ? ['trivy', 'trivy.exe']
    : ['trivy', '/usr/local/bin/trivy', '/usr/bin/trivy'];

  for (const bin of candidates) {
    try {
      await execFileAsync(bin, ['--version'], { timeout: 5000 });
      return bin;
    } catch { /* try next */ }
  }
  return null;
}

async function runTrivy(repoPath, scanId) {
  const bin = await findTrivy();
  if (!bin) throw new Error('trivy binary not found');

  let raw;
  try {
    const { stdout } = await execFileAsync(bin, [
      'fs', '--format', 'json', '--severity', 'LOW,MEDIUM,HIGH,CRITICAL',
      '--quiet', repoPath,
    ], { timeout: TIMEOUT_MS });
    raw = JSON.parse(stdout);
  } catch (err) {
    try { raw = JSON.parse(err.stdout); }
    catch { throw new Error(`trivy parse failed: ${err.message}`); }
  }

  const findings = [];
  const results = raw?.Results ?? [];

  for (const result of results) {
    for (const vuln of (result.Vulnerabilities ?? [])) {
      const severity = (vuln.Severity || 'UNKNOWN').toLowerCase();
      const mapped   = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' }[severity] ?? 'low';

      findings.push(makeCveFinding({
        scanId,
        pkgName:    vuln.PkgName,
        pkgVersion: vuln.InstalledVersion,
        vuln: {
          cve:         vuln.VulnerabilityID,
          description: vuln.Description,
          cwes:        vuln.CweIDs ?? [],
          id:          vuln.VulnerabilityID,
        },
        severity: mapped,
        fix: vuln.FixedVersion
          ? `# Update ${vuln.PkgName} to version ${vuln.FixedVersion} or later.`
          : `# No fixed version available yet for ${vuln.VulnerabilityID}.\n# Monitor: https://nvd.nist.gov/vuln/detail/${vuln.VulnerabilityID}`,
        tool: 'trivy',
      }));
    }
  }

  return findings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect the repo's ecosystem and run the appropriate scanner(s).
 * Falls back to Trivy if primary tools fail or aren't applicable.
 *
 * @param {string} repoPath
 * @param {string} scanId
 * @returns {Promise<{ findings: Finding[], tool_used: string, error?: string }>}
 */
async function runDepScan(repoPath, scanId) {
  const hasPackageJson  = fs.existsSync(path.join(repoPath, 'package.json'));
  const hasPyRequirements =
    fs.existsSync(path.join(repoPath, 'requirements.txt')) ||
    fs.existsSync(path.join(repoPath, 'pyproject.toml'));

  const allFindings = [];
  const tools       = [];
  let   primaryFailed = true;

  // Node
  if (hasPackageJson) {
    try {
      const f = await runNpmAudit(repoPath, scanId);
      allFindings.push(...f);
      tools.push('npm-audit');
      primaryFailed = false;
    } catch (err) {
      console.warn('[DepScan] npm audit failed:', err.message);
    }
  }

  // Python
  if (hasPyRequirements) {
    try {
      const f = await runPipAudit(repoPath, scanId);
      allFindings.push(...f);
      tools.push('pip-audit');
      primaryFailed = false;
    } catch (err) {
      console.warn('[DepScan] pip-audit failed:', err.message);
    }
  }

  // Trivy fallback — run if no primary worked OR as a supplemental pass
  if (primaryFailed || (!hasPackageJson && !hasPyRequirements)) {
    try {
      const f = await runTrivy(repoPath, scanId);
      allFindings.push(...f);
      tools.push('trivy');
    } catch (err) {
      if (primaryFailed) {
        return { findings: [], tool_used: 'none', error: `All dep scanners failed: ${err.message}` };
      }
    }
  }

  return { findings: allFindings, tool_used: tools.join('+') || 'none' };
}

module.exports = { runDepScan };
