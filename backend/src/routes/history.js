'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * GET /api/history
 * Returns the last 20 scans owned by the logged-in user (no findings detail to keep it fast).
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await db.getHistoryByOwner(req.user.id);

    const scans = rows.map((r) => ({
      id:          r.id,
      targetUrl:   r.target_url,
      targetType:  r.target_type,
      projectName: r.project_name,
      status:      r.status,
      score:       r.score,
      grade:       r.grade,
      counts:      r.counts_json ? JSON.parse(r.counts_json) : null,
      createdAt:   r.created_at,
      completedAt: r.completed_at,
    }));

    return res.json({ scans });
  } catch (err) {
    console.error('[History Route] Get history failed:', err);
    return res.status(500).json({ error: 'Failed to retrieve scan history.' });
  }
});

module.exports = router;
