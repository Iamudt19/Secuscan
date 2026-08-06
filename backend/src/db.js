'use strict';

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required. Get one free at https://neon.tech');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ─── Schema Initialisation ──────────────────────────────────────────────────
// Creates tables on first run. Safe to call repeatedly (IF NOT EXISTS).

async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id                   TEXT PRIMARY KEY,
      email                TEXT UNIQUE NOT NULL,
      password_hash        TEXT,
      google_id            TEXT UNIQUE,
      display_name         TEXT,
      avatar_url           TEXT,
      failed_attempts      INTEGER NOT NULL DEFAULT 0,
      locked_until         TEXT,
      is_verified          INTEGER NOT NULL DEFAULT 0,
      verification_token   TEXT,
      verification_expires TEXT,
      reset_token          TEXT,
      reset_expires        TEXT,
      api_key              TEXT UNIQUE,
      api_key_usage_count  INTEGER NOT NULL DEFAULT 0,
      api_key_last_used_date TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE`; } catch {}
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_usage_count INTEGER NOT NULL DEFAULT 0`; } catch {}
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_last_used_date TEXT`; } catch {}

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      api_token  TEXT,
      owner_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS scans (
      id           TEXT PRIMARY KEY,
      target_url   TEXT NOT NULL,
      target_type  TEXT NOT NULL CHECK (target_type IN ('repo', 'website')),
      project_name TEXT,
      project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
      error_msg    TEXT,
      score        INTEGER,
      grade        TEXT,
      counts_json  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS findings (
      id                    TEXT PRIMARY KEY,
      scan_id               TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      target_type           TEXT NOT NULL,
      category              TEXT NOT NULL,
      severity              TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
      title                 TEXT NOT NULL,
      plain_english_summary TEXT NOT NULL,
      real_world_impact     TEXT NOT NULL,
      fix                   TEXT NOT NULL,
      source_tool           TEXT NOT NULL,
      technical_details     TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS llm_cache (
      key           TEXT PRIMARY KEY,
      response_json TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  console.log('✅ Neon PostgreSQL schema initialised');
}

// ─── Query Helpers ──────────────────────────────────────────────────────────
// Each function mirrors the old SQLite prepared statement by name.
// .get()  equivalents return rows[0] (single row or undefined).
// .all()  equivalents return the full array.
// .run()  equivalents return nothing (fire-and-forget writes).

const db = {
  sql,
  initDb,

  // ── Projects ────────────────────────────────────────────────────────────────

  insertProject: async (id, name, token) => {
    await sql`INSERT INTO projects (id, name, api_token) VALUES (${id}, ${name}, ${token}) ON CONFLICT DO NOTHING`;
  },

  insertProjectWithOwner: async (id, name, token, ownerId) => {
    await sql`INSERT INTO projects (id, name, api_token, owner_id) VALUES (${id}, ${name}, ${token}, ${ownerId}) ON CONFLICT DO NOTHING`;
  },

  getProjectByName: async (name) => {
    const rows = await sql`SELECT * FROM projects WHERE name = ${name}`;
    return rows[0];
  },

  getProjectByNameAndOwner: async (name, ownerId) => {
    const rows = await sql`SELECT * FROM projects WHERE name = ${name} AND owner_id = ${ownerId}`;
    return rows[0];
  },

  getProject: async (id) => {
    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
    return rows[0];
  },

  getProjectWithOwner: async (id, ownerId) => {
    const rows = await sql`SELECT * FROM projects WHERE id = ${id} AND owner_id = ${ownerId}`;
    return rows[0];
  },

  getProjects: async () => {
    return await sql`SELECT * FROM projects ORDER BY name ASC`;
  },

  getProjectsByOwner: async (ownerId) => {
    return await sql`SELECT * FROM projects WHERE owner_id = ${ownerId} ORDER BY name ASC`;
  },

  updateProjectToken: async (token, id) => {
    await sql`UPDATE projects SET api_token = ${token} WHERE id = ${id}`;
  },

  updateProjectTokenWithOwner: async (token, id, ownerId) => {
    await sql`UPDATE projects SET api_token = ${token} WHERE id = ${id} AND owner_id = ${ownerId}`;
  },

  // ── Users & Sessions ────────────────────────────────────────────────────────

  insertUser: async ({ id, email, password_hash, google_id, display_name, avatar_url, verification_token, verification_expires }) => {
    await sql`
      INSERT INTO users (id, email, password_hash, google_id, display_name, avatar_url, is_verified, verification_token, verification_expires)
      VALUES (${id}, ${email}, ${password_hash || null}, ${google_id || null}, ${display_name || null}, ${avatar_url || null},
              ${google_id ? 1 : 0}, ${verification_token || null}, ${verification_expires || null})
    `;
  },

  getUserByEmail: async (email) => {
    const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
    return rows[0];
  },

  getUserById: async (id) => {
    const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
    return rows[0];
  },

  getUserByGoogleId: async (googleId) => {
    const rows = await sql`SELECT * FROM users WHERE google_id = ${googleId}`;
    return rows[0];
  },

  getUserByVerificationToken: async (token) => {
    const rows = await sql`SELECT * FROM users WHERE verification_token = ${token}`;
    return rows[0];
  },

  getUserByResetToken: async (token) => {
    const rows = await sql`SELECT * FROM users WHERE reset_token = ${token}`;
    return rows[0];
  },

  getUserByApiKey: async (apiKey) => {
    const rows = await sql`SELECT * FROM users WHERE api_key = ${apiKey}`;
    return rows[0];
  },

  generateUserApiKey: async (userId) => {
    const crypto = require('crypto');
    const newKey = 'vulta_live_' + crypto.randomBytes(16).toString('hex');
    await sql`UPDATE users SET api_key = ${newKey} WHERE id = ${userId}`;
    return newKey;
  },

  checkAndUpdateApiKeyUsage: async (userId) => {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    const rows = await sql`SELECT api_key_usage_count, api_key_last_used_date FROM users WHERE id = ${userId}`;
    const user = rows[0];
    if (!user) return { allowed: false, remaining: 0, usageToday: 0 };

    let currentUsage = user.api_key_usage_count || 0;
    let lastDate = user.api_key_last_used_date || '';

    // If date has changed, reset daily counter
    if (lastDate !== today) {
      currentUsage = 0;
      lastDate = today;
    }

    if (currentUsage >= 2) {
      return { allowed: false, remaining: 0, usageToday: currentUsage, limit: 2 };
    }

    const newUsage = currentUsage + 1;
    await sql`UPDATE users SET api_key_usage_count = ${newUsage}, api_key_last_used_date = ${today} WHERE id = ${userId}`;

    return { allowed: true, remaining: 2 - newUsage, usageToday: newUsage, limit: 2 };
  },

  incrementFailedAttempts: async (lockedUntil, id) => {
    await sql`UPDATE users SET failed_attempts = failed_attempts + 1, locked_until = ${lockedUntil} WHERE id = ${id}`;
  },

  resetFailedAttempts: async (id) => {
    await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${id}`;
  },

  verifyUser: async (id) => {
    await sql`UPDATE users SET is_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ${id}`;
  },

  setResetToken: async (token, expires, id) => {
    await sql`UPDATE users SET reset_token = ${token}, reset_expires = ${expires} WHERE id = ${id}`;
  },

  resetPassword: async (hash, id) => {
    await sql`UPDATE users SET password_hash = ${hash}, reset_token = NULL, reset_expires = NULL WHERE id = ${id}`;
  },

  insertSession: async (id, userId, expiresAt) => {
    await sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${id}, ${userId}, ${expiresAt})`;
  },

  getSession: async (id) => {
    const rows = await sql`SELECT * FROM sessions WHERE id = ${id}`;
    return rows[0];
  },

  deleteSession: async (id) => {
    await sql`DELETE FROM sessions WHERE id = ${id}`;
  },

  deleteExpiredSessions: async (before) => {
    await sql`DELETE FROM sessions WHERE expires_at < ${before}`;
  },

  // ── Scans ───────────────────────────────────────────────────────────────────

  insertScan: async ({ id, target_url, target_type, project_name, project_id }) => {
    await sql`
      INSERT INTO scans (id, target_url, target_type, project_name, project_id, status)
      VALUES (${id}, ${target_url}, ${target_type}, ${project_name || null}, ${project_id || null}, 'pending')
    `;
  },

  updateScanStatus: async ({ id, status, error_msg }) => {
    await sql`UPDATE scans SET status = ${status}, error_msg = ${error_msg || null} WHERE id = ${id}`;
  },

  completeScan: async ({ id, score, grade, counts_json }) => {
    await sql`
      UPDATE scans SET status = 'done', score = ${score}, grade = ${grade},
             counts_json = ${counts_json}, completed_at = NOW()
      WHERE id = ${id}
    `;
  },

  failScan: async ({ id, error_msg }) => {
    await sql`UPDATE scans SET status = 'error', error_msg = ${error_msg}, completed_at = NOW() WHERE id = ${id}`;
  },

  getScan: async (id) => {
    const rows = await sql`SELECT * FROM scans WHERE id = ${id}`;
    return rows[0];
  },

  getScansForProject: async (projectId) => {
    return await sql`SELECT * FROM scans WHERE project_id = ${projectId} ORDER BY created_at DESC`;
  },

  getLatestScansForProject: async (projectId) => {
    return await sql`
      SELECT s.* FROM scans s
      WHERE s.id = (
        SELECT id FROM scans WHERE project_id = ${projectId} AND status = 'done' AND target_type = 'repo'
        ORDER BY created_at DESC LIMIT 1
      ) OR s.id = (
        SELECT id FROM scans WHERE project_id = ${projectId} AND status = 'done' AND target_type = 'website'
        ORDER BY created_at DESC LIMIT 1
      )
    `;
  },

  // ── Findings ────────────────────────────────────────────────────────────────

  getFindings: async (scanId) => {
    return await sql`
      SELECT * FROM findings WHERE scan_id = ${scanId}
      ORDER BY CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high'     THEN 2
        WHEN 'medium'   THEN 3
        WHEN 'low'      THEN 4
      END
    `;
  },

  insertFinding: async (f) => {
    await sql`
      INSERT INTO findings (id, scan_id, target_type, category, severity, title,
        plain_english_summary, real_world_impact, fix, source_tool, technical_details)
      VALUES (${f.id}, ${f.scan_id}, ${f.target_type}, ${f.category}, ${f.severity}, ${f.title},
        ${f.plain_english_summary}, ${f.real_world_impact}, ${f.fix}, ${f.source_tool}, ${f.technical_details || null})
    `;
  },

  insertFindings: async (findings) => {
    for (const f of findings) {
      await db.insertFinding(f);
    }
  },

  // ── LLM Cache ───────────────────────────────────────────────────────────────

  getLlmCache: async (key) => {
    const rows = await sql`SELECT response_json FROM llm_cache WHERE key = ${key}`;
    return rows[0];
  },

  insertLlmCache: async (key, responseJson) => {
    await sql`
      INSERT INTO llm_cache (key, response_json) VALUES (${key}, ${responseJson})
      ON CONFLICT (key) DO UPDATE SET response_json = EXCLUDED.response_json, created_at = NOW()
    `;
  },

  // ── History ─────────────────────────────────────────────────────────────────

  getHistory: async () => {
    return await sql`
      SELECT id, target_url, target_type, project_name, status, score, grade,
             counts_json, created_at, completed_at
      FROM scans ORDER BY created_at DESC LIMIT 20
    `;
  },

  getHistoryByOwner: async (ownerId) => {
    return await sql`
      SELECT s.id, s.target_url, s.target_type, s.project_name, s.status, s.score, s.grade,
             s.counts_json, s.created_at, s.completed_at
      FROM scans s
      INNER JOIN projects p ON s.project_id = p.id
      WHERE p.owner_id = ${ownerId}
      ORDER BY s.created_at DESC LIMIT 20
    `;
  },

  // ── Ad-hoc Queries ──────────────────────────────────────────────────────────

  findProjectByScanUrl: async (urlPattern) => {
    const rows = await sql`
      SELECT project_id, project_name FROM scans
      WHERE target_url LIKE ${'%' + urlPattern + '%'} AND project_id IS NOT NULL
      LIMIT 1
    `;
    return rows[0];
  },
};

module.exports = db;
