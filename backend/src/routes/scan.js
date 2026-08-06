'use strict';

/**
 * Vulta — Scan Routes
 *
 * POST /api/scan    — submit a new scan job
 * GET  /api/scan/:id — get scan status + findings
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { URL }        = require('url');
const dns            = require('dns').promises;

const db = require('../db');
const { scoreFromFindings }     = require('../schema');
const queue                     = require('../queue');
const { assertSafeUrl }         = require('../ssrfGuard');
const { runHeaderCheck }        = require('../adapters/headerCheck');
const { runSslCheck }           = require('../adapters/sslCheck');
const { runPathProbe }          = require('../adapters/pathProbe');
const { runSecurityChecklistCheck } = require('../adapters/securityChecklistCheck');
const { cloneRepo }             = require('../adapters/repoClone');
const { runSecretScan }         = require('../adapters/secretScan');
const { runDepScan }            = require('../adapters/depScan');
const { runExposedFilesScan }   = require('../adapters/exposedFiles');
const { processFinding }        = require('../explanations/processor');
const { validateScanGet, validateScanPost, validateCiScanPost } = require('../validation');

const router = express.Router();

// ─── SSRF Guard (delegated to ssrfGuard.js) ──────────────────────────────────

/**
 * Resolve the hostname and check all returned IPs against blocked ranges.
 * Throws if any resolved IP is in a private/internal range.
 *
 * @param {string} hostname
 */
async function assertNotInternalHost(hostname) {
  try {
    await assertSafeUrl(`https://${hostname}`);
  } catch (err) {
    throw err;
  }
}

// ─── URL Validation & Target Detection ───────────────────────────────────────

/**
 * Parse and validate the submitted URL.
 * Returns { parsedUrl, targetType } or throws.
 *
 * @param {string} raw
 * @returns {{ parsedUrl: URL, targetType: 'repo'|'website' }}
 */
function parseAndValidateUrl(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('URL is required.');

  let parsedUrl;
  try {
    parsedUrl = new URL(raw.trim());
  } catch {
    throw new Error('Invalid URL format. Please include http:// or https://.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  // Auto-detect: GitHub repo vs generic website
  const isGitHub =
    parsedUrl.hostname === 'github.com' &&
    /^\/[^/]+\/[^/]+/.test(parsedUrl.pathname);

  return { parsedUrl, targetType: isGitHub ? 'repo' : 'website' };
}

// ─── POST /api/scan ──────────────────────────────────────────────────────────

router.post('/', validateScanPost, async (req, res) => {
  const { url, project_id, project_name } = req.body ?? {};

  // 1. Validate URL
  let parsedUrl, targetType;
  try {
    ({ parsedUrl, targetType } = parseAndValidateUrl(url));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // 2. SSRF guard
  try {
    await assertNotInternalHost(parsedUrl.hostname);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  // 3. Resolve Project (Enforce ownership checks to prevent IDOR)
  let projectId = project_id || null;
  let resolvedProjectName = project_name?.trim() || null;

  if (resolvedProjectName && !projectId) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required to scan under a project.' });
    }
    let proj = await db.getProjectByNameAndOwner(resolvedProjectName, req.user.id);
    if (!proj) {
      const newProjId = uuidv4();
      const apiToken = 'vulta_proj_' + require('crypto').randomBytes(24).toString('hex');
      await db.insertProjectWithOwner(newProjId, resolvedProjectName, apiToken, req.user.id);
      projectId = newProjId;
    } else {
      projectId = proj.id;
    }
  } else if (projectId) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required to scan under a project.' });
    }
    const proj = await db.getProjectWithOwner(projectId, req.user.id);
    if (!proj) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }
    resolvedProjectName = proj.name;
  }

  // 4. Create scan record
  const scanId = uuidv4();
  const targetUrl = parsedUrl.toString();

  await db.insertScan({
    id:           scanId,
    target_url:   targetUrl,
    target_type:  targetType,
    project_name: resolvedProjectName,
    project_id:   projectId,
  });

  // 4. Enqueue the scan job
  queue.enqueue(scanId, async () => {
    await db.updateScanStatus({ id: scanId, status: 'running', error_msg: null });

    let allFindings = [];
    let cleanup     = null;

    try {
      if (targetType === 'website') {
        // Run header check + SSL check + path probe + security checklist in parallel
        const [headerFindings, sslResult, pathResult, checklistResult] = await Promise.allSettled([
          runHeaderCheck(targetUrl, scanId),
          runSslCheck(targetUrl, scanId),
          runPathProbe(targetUrl, scanId),
          runSecurityChecklistCheck(targetUrl, scanId),
        ]);

        if (headerFindings.status === 'fulfilled') allFindings.push(...headerFindings.value);
        else console.warn('[Scan] headerCheck failed:', headerFindings.reason?.message);

        if (sslResult.status === 'fulfilled') allFindings.push(...(sslResult.value.findings ?? []));
        else console.warn('[Scan] sslCheck failed:', sslResult.reason?.message);

        if (pathResult.status === 'fulfilled') allFindings.push(...(pathResult.value.findings ?? []));
        else console.warn('[Scan] pathProbe failed:', pathResult.reason?.message);

        if (checklistResult.status === 'fulfilled') allFindings.push(...(checklistResult.value.findings ?? []));
        else console.warn('[Scan] securityChecklistCheck failed:', checklistResult.reason?.message);

      } else if (targetType === 'repo') {
        // Step 1: clone
        const cloneResult = await cloneRepo(targetUrl);
        const { clonePath } = cloneResult;
        cleanup = cloneResult.cleanup;

        // Step 2: run secret scan + dep scan + exposed files in parallel
        const [secretResult, depResult, exposedResult] = await Promise.allSettled([
          runSecretScan(clonePath, scanId),
          runDepScan(clonePath, scanId),
          Promise.resolve(runExposedFilesScan(clonePath, scanId)),
        ]);

        const secretFindings = secretResult.status === 'fulfilled'
          ? secretResult.value.findings
          : (console.warn('[Scan] secretScan failed:', secretResult.reason?.message), []);

        if (depResult.status === 'fulfilled') allFindings.push(...(depResult.value.findings ?? []));
        else console.warn('[Scan] depScan failed:', depResult.reason?.message);

        // Cross-reference: pass flagged file paths to exposedFiles to avoid duplicates
        const flaggedFiles = secretFindings
          .filter((f) => f.plain_english_summary?.includes('`'))
          .map((f) => { const m = f.plain_english_summary.match(/`([^`]+)`/); return m?.[1] ?? ''; })
          .filter(Boolean);

        if (exposedResult.status === 'fulfilled') {
          allFindings.push(...(exposedResult.value.findings ?? []));
        }

        allFindings.push(...secretFindings);
      }

      // Deduplicate by (title, category) — same finding from two tools
      const seen = new Set();
      const deduped = allFindings.filter((f) => {
        const key = `${f.category}::${f.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Enrich findings through plain-English explanation layer
      const enrichedFindings = await Promise.all(
        deduped.map((f) => processFinding(f))
      );

      if (enrichedFindings.length > 0) await db.insertFindings(enrichedFindings);

      const { score, grade, counts } = scoreFromFindings(enrichedFindings);
      await db.completeScan({ id: scanId, score, grade, counts_json: JSON.stringify(counts) });
      return { score, grade, counts, findings: enrichedFindings };

    } catch (err) {
      await db.failScan({ id: scanId, error_msg: err.message });
      throw err;
    } finally {
      if (typeof cleanup === 'function') cleanup();
    }
  });

  // 5. Return immediately with the scanId for polling
  return res.status(202).json({
    scanId,
    targetType,
    targetUrl,
    message: 'Scan queued. Poll GET /api/scan/:id for status.',
  });
});

// ─── GET /api/scan/:id ────────────────────────────────────────────────────────

router.get('/:id', validateScanGet, async (req, res) => {
  const { id } = req.params;

  // Check in-memory queue status first (fast path for running jobs)
  const queueStatus = queue.getStatus(id);
  const scanRow     = await db.getScan(id);

  if (!scanRow) {
    return res.status(404).json({ error: 'Scan not found.' });
  }

  // Enforce resource ownership checks (prevents IDOR)
  if (scanRow.project_id) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required to access project scans.' });
    }
    const proj = await db.getProjectWithOwner(scanRow.project_id, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: 'Scan not found.' });
    }
  }

  const response = {
    id:           scanRow.id,
    targetUrl:    scanRow.target_url,
    targetType:   scanRow.target_type,
    projectName:  scanRow.project_name,
    projectId:    scanRow.project_id,
    status:       scanRow.status,
    score:        scanRow.score,
    grade:        scanRow.grade,
    counts:       scanRow.counts_json ? JSON.parse(scanRow.counts_json) : null,
    createdAt:    scanRow.created_at,
    completedAt:  scanRow.completed_at,
    error:        scanRow.error_msg,
    findings:     [],
  };

  // Also report queue-level errors that may not yet be flushed to DB
  if (queueStatus?.status === 'error' && !scanRow.error_msg) {
    response.status = 'error';
    response.error  = queueStatus.error;
  }

  if (scanRow.status === 'done') {
    const rows = await db.getFindings(id);
    response.findings = rows.map((r) => ({
      id:                  r.id,
      category:            r.category,
      severity:            r.severity,
      title:               r.title,
      summary:             r.plain_english_summary,
      impact:              r.real_world_impact,
      fix:                 r.fix,
      sourceTool:          r.source_tool,
      technicalDetails:    r.technical_details,
    }));
  }

  return res.json(response);
});

// ─── POST /api/scan/ci-scan (Part A CI pipeline) ─────────────────────────────
router.post('/ci-scan', validateCiScanPost, async (req, res) => {
  const authHeader = req.headers.authorization;
  const { repo_url, commit_sha, project_id } = req.body ?? {};

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token is required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify project and token
    const project = await db.getProject(project_id);
    if (!project || project.api_token !== token) {
      return res.status(403).json({ error: 'Invalid project ID or API authorization token.' });
    }

    if (!repo_url) {
      return res.status(400).json({ error: 'repo_url is required.' });
    }

    // 2. Queue repo scan
    const scanId = uuidv4();
    await db.insertScan({
      id:           scanId,
      target_url:   repo_url,
      target_type:  'repo',
      project_name: project.name,
      project_id:   project.id,
    });

    queue.enqueue(scanId, async () => {
      await db.updateScanStatus({ id: scanId, status: 'running', error_msg: null });
      let allFindings = [];
      let cleanup     = null;

      try {
        const cloneResult = await cloneRepo(repo_url);
        const { clonePath } = cloneResult;
        cleanup = cloneResult.cleanup;

        // Run secret + dep + config scans
        const [secretResult, depResult, exposedResult] = await Promise.allSettled([
          runSecretScan(clonePath, scanId),
          runDepScan(clonePath, scanId),
          Promise.resolve(runExposedFilesScan(clonePath, scanId)),
        ]);

        if (secretResult.status === 'fulfilled') allFindings.push(...(secretResult.value.findings ?? []));
        if (depResult.status === 'fulfilled') allFindings.push(...(depResult.value.findings ?? []));
        if (exposedResult.status === 'fulfilled') allFindings.push(...(exposedResult.value.findings ?? []));

        // Deduplicate
        const seen = new Set();
        const deduped = allFindings.filter((f) => {
          const key = `${f.category}::${f.title}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const enriched = await Promise.all(deduped.map((f) => processFinding(f)));
        if (enriched.length > 0) await db.insertFindings(enriched);

        const { score, grade, counts } = scoreFromFindings(enriched);
        await db.completeScan({ id: scanId, score, grade, counts_json: JSON.stringify(counts) });
      } catch (err) {
        await db.failScan({ id: scanId, error_msg: err.message });
      } finally {
        if (typeof cleanup === 'function') cleanup();
      }
    });

    return res.status(202).json({
      scanId,
      message: 'CI Repository scan successfully queued.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/scan/webhooks/github (Part B webhook app) ─────────────────────
const crypto = require('crypto');
const { postGithubFeedback } = require('../githubApp');

function verifyWebhookSignature(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true; // local sandbox development bypass

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

router.post('/webhooks/github', async (req, res) => {
  if (!verifyWebhookSignature(req)) {
    return res.status(401).json({ error: 'Webhook signature verification failed.' });
  }

  const eventType = req.headers['x-github-event'];
  const payload = req.body ?? {};

  // We are only interested in PR open / update synchronize events
  if (eventType === 'pull_request') {
    const action = payload.action;
    if (['opened', 'synchronize', 'reopened'].includes(action)) {
      const pr = payload.pull_request;
      const repo = payload.repository;
      const installationId = payload.installation?.id;

      const owner = repo.owner.login;
      const repoName = repo.name;
      const prNumber = payload.number;
      const commitSha = pr.head.sha;
      const cloneUrl = pr.head.repo.clone_url;

      // Resolve linked project (fuzzy match target repository URL)
      let projectId = null;
      let projectName = 'Default Github Monitor';

      try {
        const matchScan = await db.findProjectByScanUrl(`${owner}/${repoName}`);

        if (matchScan) {
          projectId = matchScan.project_id;
          projectName = matchScan.project_name;
        }
      } catch (err) {
        console.warn('[Webhook] Failed to query associated project:', err.message);
      }

      // Spawn async job
      const scanId = uuidv4();
      await db.insertScan({
        id:           scanId,
        target_url:   cloneUrl,
        target_type:  'repo',
        project_name: projectName,
        project_id:   projectId,
      });

      queue.enqueue(scanId, async () => {
        await db.updateScanStatus({ id: scanId, status: 'running', error_msg: null });
        let allFindings = [];
        let cleanup     = null;

        try {
          const cloneResult = await cloneRepo(cloneUrl);
          const { clonePath } = cloneResult;
          cleanup = cloneResult.cleanup;

          const [secretResult, depResult, exposedResult] = await Promise.allSettled([
            runSecretScan(clonePath, scanId),
            runDepScan(clonePath, scanId),
            Promise.resolve(runExposedFilesScan(clonePath, scanId)),
          ]);

          if (secretResult.status === 'fulfilled') allFindings.push(...(secretResult.value.findings ?? []));
          if (depResult.status === 'fulfilled') allFindings.push(...(depResult.value.findings ?? []));
          if (exposedResult.status === 'fulfilled') allFindings.push(...(exposedResult.value.findings ?? []));

          // Deduplicate
          const seen = new Set();
          const deduped = allFindings.filter((f) => {
            const key = `${f.category}::${f.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          const enriched = await Promise.all(deduped.map((f) => processFinding(f)));
          if (enriched.length > 0) await db.insertFindings(enriched);

          const { score, grade, counts } = scoreFromFindings(enriched);
          await db.completeScan({ id: scanId, score, grade, counts_json: JSON.stringify(counts) });

          // Fetch latest website findings if project exists
          let websiteFindings = null;
          if (projectId) {
            const latestScans = await db.getLatestScansForProject(projectId, projectId);
            const siteScan = latestScans.find((s) => s.target_type === 'website');
            if (siteScan) {
              websiteFindings = (await db.getFindings(siteScan.id)).map((r) => ({
                title: r.title,
                severity: r.severity,
                summary: r.plain_english_summary,
                impact: r.real_world_impact,
                fix: r.fix,
              }));
            }
          }

          // Post findings back to PR
          await postGithubFeedback({
            owner,
            repo: repoName,
            prNumber,
            commitSha,
            projectName,
            score,
            repoFindings: enriched,
            websiteFindings,
            installationId,
          });

        } catch (err) {
          console.error('[Webhook Scan Job Error]', err);
          await db.failScan({ id: scanId, error_msg: err.message });
        } finally {
          if (typeof cleanup === 'function') cleanup();
        }
      });

      return res.json({ message: 'Pull Request webhook received. Scan triggered.' });
    }
  }

  return res.json({ message: 'Webhook event ignored.' });
});

module.exports = router;
