'use strict';

const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// Admin sessions stored in memory (tokens map to login timestamps)
const adminSessions = new Set();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'VultaAdmin2026!';

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers.authorization?.split(' ')[1];
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: 'Admin authorization required.' });
  }
  next();
}

// ─── POST /api/admin/login ─────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { password } = req.body ?? {};

  if (!password || password !== ADMIN_PASSWORD) {
    console.warn(`[Admin] Failed admin login attempt from IP ${req.ip}`);
    return res.status(401).json({ error: 'Invalid admin password.' });
  }

  const token = 'vulta_admin_' + crypto.randomBytes(24).toString('hex');
  adminSessions.add(token);

  console.log(`[Admin] Successful admin login from IP ${req.ip}`);
  return res.json({ message: 'Admin authenticated successfully.', adminToken: token });
});

// ─── GET /api/admin/messages ────────────────────────────────────────────────
router.get('/messages', requireAdmin, async (_req, res) => {
  try {
    const messages = await db.getContactMessages();
    return res.json({ messages });
  } catch (err) {
    console.error('[Admin] Error fetching messages:', err);
    return res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// ─── DELETE /api/admin/messages/:id ─────────────────────────────────────────
router.delete('/messages/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteContactMessage(req.params.id);
    return res.json({ message: 'Message deleted successfully.' });
  } catch (err) {
    console.error('[Admin] Error deleting message:', err);
    return res.status(500).json({ error: 'Failed to delete message.' });
  }
});

// ─── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const stats = await db.getAdminStats();
    return res.json({ stats });
  } catch (err) {
    console.error('[Admin] Error fetching stats:', err);
    return res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

module.exports = router;
