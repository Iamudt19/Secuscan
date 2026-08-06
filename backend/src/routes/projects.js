'use strict';

/**
 * Vulta — Projects Routes
 *
 * GET  /api/projects      — List all projects owned by the logged-in user
 * GET  /api/projects/:id  — Get project details and scan history (ownership-protected)
 * POST /api/projects      — Create a new project (ownership-protected)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');
const { validateProjectPost, validateProjectIdParam } = require('../validation');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Helper: Calculate combined score and gap insights
function getCombinedScoreInfo(latestScans) {
  const repoScan = latestScans.find((s) => s.target_type === 'repo');
  const siteScan = latestScans.find((s) => s.target_type === 'website');

  let combinedScore = null;
  let insight = null;

  if (repoScan && siteScan) {
    combinedScore = Math.round((repoScan.score + siteScan.score) / 2);
    const gap = repoScan.score - siteScan.score;

    if (gap > 25) {
      insight = {
        type: 'repo-high',
        text: 'Your codebase looks secure, but the live site has security gaps. Check for exposed files, missing headers, or a configuration issue in your staging/production server.'
      };
    } else if (gap < -25) {
      insight = {
        type: 'site-high',
        text: 'Your live deployment is well-protected, but there are active issues in your code repository (secrets or packages) that could surface on your next deploy.'
      };
    }
  } else if (repoScan) {
    combinedScore = repoScan.score;
  } else if (siteScan) {
    combinedScore = siteScan.score;
  }

  return {
    combinedScore,
    insight,
    hasRepo: !!repoScan,
    hasSite: !!siteScan,
    latestRepo: repoScan || null,
    latestSite: siteScan || null,
  };
}

// ─── GET /api/projects ────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const projects = await db.getProjectsByOwner(req.user.id);
    const result = await Promise.all(projects.map(async (p) => {
      const latestScans = await db.getLatestScansForProject(p.id);
      const scoreInfo   = getCombinedScoreInfo(latestScans);

      return {
        id:            p.id,
        name:          p.name,
        createdAt:     p.created_at,
        combinedScore: scoreInfo.combinedScore,
        hasRepo:       scoreInfo.hasRepo,
        hasSite:       scoreInfo.hasSite,
        latestRepoScore: scoreInfo.latestRepo?.score ?? null,
        latestSiteScore: scoreInfo.latestSite?.score ?? null,
        lastScanned:   latestScans.length > 0
          ? latestScans.reduce((max, s) => s.completed_at > max ? s.completed_at : max, latestScans[0].completed_at)
          : null,
      };
    }));

    return res.json({ projects: result });
  } catch (err) {
    console.error('[Projects Route] Get projects failed:', err);
    return res.status(500).json({ error: 'Failed to retrieve projects list.' });
  }
});

// ─── GET /api/projects/:id ───────────────────────────────────────────────────
router.get('/:id', requireAuth, validateProjectIdParam, async (req, res) => {
  const { id } = req.params;

  try {
    const project = await db.getProjectWithOwner(id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const latestScans = await db.getLatestScansForProject(id);
    const scoreInfo   = getCombinedScoreInfo(latestScans);
    const history     = await db.getScansForProject(id);

    return res.json({
      project: {
        id:        project.id,
        name:      project.name,
        apiToken:  project.api_token,
        createdAt: project.created_at,
      },
      scoreInfo: {
        combinedScore: scoreInfo.combinedScore,
        insight:       scoreInfo.insight,
        hasRepo:       scoreInfo.hasRepo,
        hasSite:       scoreInfo.hasSite,
        latestRepo:    scoreInfo.latestRepo,
        latestSite:    scoreInfo.latestSite,
      },
      history: history.map((s) => ({
        id:          s.id,
        targetUrl:   s.target_url,
        targetType:  s.target_type,
        status:      s.status,
        score:       s.score,
        grade:       s.grade,
        createdAt:    s.created_at,
        completedAt:  s.completed_at,
        error:       s.error_msg,
      })),
    });
  } catch (err) {
    console.error('[Projects Route] Get project details failed:', err);
    return res.status(500).json({ error: 'Failed to retrieve project details.' });
  }
});

// ─── POST /api/projects ──────────────────────────────────────────────────────
router.post('/', requireAuth, validateProjectPost, async (req, res) => {
  const { name } = req.body ?? {};
  const cleanName = name.trim();

  try {
    const existing = await db.getProjectByNameAndOwner(cleanName, req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'A project with this name already exists.', projectId: existing.id });
    }

    const id = uuidv4();
    const apiToken = 'vulta_proj_' + crypto.randomBytes(24).toString('hex');
    await db.insertProjectWithOwner(id, cleanName, apiToken, req.user.id);

    return res.status(201).json({ message: 'Project created.', id, name: cleanName, apiToken });
  } catch (err) {
    console.error('[Projects Route] Project creation failed:', err);
    return res.status(500).json({ error: 'Failed to create project.' });
  }
});

// ─── POST /api/projects/:id/regenerate-token ────────────────────────────────
router.post('/:id/regenerate-token', requireAuth, validateProjectIdParam, async (req, res) => {
  const { id } = req.params;

  try {
    const project = await db.getProjectWithOwner(id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const apiToken = 'vulta_proj_' + crypto.randomBytes(24).toString('hex');
    await db.updateProjectTokenWithOwner(apiToken, id, req.user.id);

    return res.json({ message: 'Token regenerated.', apiToken });
  } catch (err) {
    console.error('[Projects Route] Token regeneration failed:', err);
    return res.status(500).json({ error: 'Failed to regenerate project token.' });
  }
});

module.exports = router;
